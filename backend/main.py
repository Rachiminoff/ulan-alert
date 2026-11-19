from __future__ import annotations
from collections import deque
from datetime import datetime, timedelta
from typing import Optional
import random, math
import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score, f1_score, average_precision_score, accuracy_score, confusion_matrix, brier_score_loss
from sklearn.model_selection import TimeSeriesSplit
from simulator import SyntheticWeather, SCENARIOS

app = FastAPI(title="Ulan Alert Synthetic Simulation", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])
FEATURES = ["pressure_delta_30m","pressure_delta_1h","pressure_delta_3h","humidity","humidity_delta_30m","temp_delta_30m","temp_residual","light_ratio","hour_sin","hour_cos"]
WINDOW = 30
rows: deque = deque(maxlen=20000)
model_store: dict = {}
metrics_store: dict = {}
current_sim = SyntheticWeather(seed=73)
last_prediction = 0.0
last_raining = False
speed = 1
running = True
scenario_key = "natural"
current_location = {"name":"Indang, Cavite, Philippines","latitude":14.1953,"longitude":120.8769,"source":"default"}

def row_of(s):
    return {"timestamp":s.timestamp.isoformat(),"pressure":s.pressure_hpa,"temperature":s.temperature_c,"humidity":s.humidity_pct,"light":s.light_lux,"rain_mm":s.rain_mm,"raining":s.raining,"scenario":s.scenario}

def feature_row(history):
    if len(history)<181: return None
    a=list(history)
    p=a[-1]["pressure"]
    h=a[-1]["humidity"]
    t=a[-1]["temperature"]
    l=a[-1]["light"]
    hour=datetime.fromisoformat(a[-1]["timestamp"]).hour + datetime.fromisoformat(a[-1]["timestamp"]).minute/60
    # Deltas use current minus historical values. Light ratio compares current to rolling hour mean.
    mean_light=np.mean([x["light"] for x in a[-60:]])
    hourly_temp=26.0+2.4*math.sin(2*math.pi*(hour-8)/24)
    return {"pressure_delta_30m":p-a[-31]["pressure"],"pressure_delta_1h":p-a[-61]["pressure"],"pressure_delta_3h":p-a[-181]["pressure"],
            "humidity":h,"humidity_delta_30m":h-a[-31]["humidity"],"temp_delta_30m":t-a[-31]["temperature"],"temp_residual":t-hourly_temp,
            "light_ratio":l/(mean_light+1),"hour_sin":math.sin(2*math.pi*hour/24),"hour_cos":math.cos(2*math.pi*hour/24)}

def create_synthetic_dataset(seed=2026, days=7, month=8):
    # Generate two deterministic synthetic sequences; RNG controls variation within each pattern.
    samples=[]
    for seq_seed in range(seed, seed+4):
        sequence_month = [2, 5, 8, 11][seq_seed-seed]
        sim=SyntheticWeather(seed=seq_seed, start=datetime(2026,sequence_month,1,0,0))
        hist=[]
        for _ in range(days*24*60):
            hist.append(row_of(sim.step()))
        for i in range(181, len(hist)-30):
            current=hist[i]
            if current["raining"]: continue
            prev30,prev60,prev180=hist[i-30],hist[i-60],hist[i-180]
            hour=datetime.fromisoformat(current["timestamp"]).hour+datetime.fromisoformat(current["timestamp"]).minute/60
            light_avg=sum(x["light"] for x in hist[i-59:i+1])/60
            hourly_temp=26+2.4*math.sin(2*math.pi*(hour-8)/24)
            f={"pressure_delta_30m":current["pressure"]-prev30["pressure"],"pressure_delta_1h":current["pressure"]-prev60["pressure"],
               "pressure_delta_3h":current["pressure"]-prev180["pressure"],"humidity":current["humidity"],
               "humidity_delta_30m":current["humidity"]-prev30["humidity"],"temp_delta_30m":current["temperature"]-prev30["temperature"],
               "temp_residual":current["temperature"]-hourly_temp,"light_ratio":current["light"]/(light_avg+1),
               "hour_sin":math.sin(2*math.pi*hour/24),"hour_cos":math.cos(2*math.pi*hour/24)}
            label=int(any(x["raining"] for x in hist[i+1:i+31]))
            samples.append((f,label,current["timestamp"]))
    return samples

def train_models():
    global model_store, metrics_store
    samples=create_synthetic_dataset()
    X=np.array([[s[0][k] for k in FEATURES] for s in samples], dtype=float)
    y=np.array([s[1] for s in samples], dtype=int)
    # Chronological holdout and horizon gap. Synthetic sequences are generated in batches;
    # order is kept and no random shuffle is used.
    split=int(len(X)*0.70); gap=WINDOW
    X_train,y_train=X[:max(0,split-gap)],y[:max(0,split-gap)]
    X_test,y_test=X[split:],y[split:]
    candidates={"Logistic Regression":LogisticRegression(class_weight="balanced",max_iter=600),
               "Decision Tree":DecisionTreeClassifier(max_depth=7,min_samples_leaf=10,class_weight="balanced",random_state=42),
               "Random Forest":RandomForestClassifier(n_estimators=70,max_depth=9,min_samples_leaf=5,class_weight="balanced_subsample",random_state=42,n_jobs=-1)}
    model_store={}; metrics_store={}
    for name,model in candidates.items():
        model.fit(X_train,y_train)
        prob=model.predict_proba(X_test)[:,1]
        pred=prob>=0.60
        cm=confusion_matrix(y_test,pred,labels=[0,1]).tolist()
        metrics_store[name]={"precision":float(precision_score(y_test,pred,zero_division=0)),"recall":float(recall_score(y_test,pred,zero_division=0)),
           "f1":float(f1_score(y_test,pred,zero_division=0)),"pr_auc":float(average_precision_score(y_test,prob)),"accuracy":float(accuracy_score(y_test,pred)),
           "brier":float(brier_score_loss(y_test,prob)),"confusion_matrix":cm,"threshold":0.60}
        model_store[name]=model
    # Majority baseline and pressure-drop/humidity-rise heuristic.
    prevalence=float(y_test.mean())
    baseline_pred=np.zeros_like(y_test)
    metrics_store["Majority baseline"]={"precision":0.0,"recall":0.0,"f1":0.0,"pr_auc":prevalence,"accuracy":float(accuracy_score(y_test,baseline_pred)),"brier":prevalence,"confusion_matrix":confusion_matrix(y_test,baseline_pred,labels=[0,1]).tolist(),"threshold":0.0}
    rule_pred=((X_test[:,0]<-0.8)&(X_test[:,4]>2.0)&(X_test[:,3]>75)).astype(int)
    metrics_store["Pressure/humidity rule"]={"precision":float(precision_score(y_test,rule_pred,zero_division=0)),"recall":float(recall_score(y_test,rule_pred,zero_division=0)),"f1":float(f1_score(y_test,rule_pred,zero_division=0)),"pr_auc":0.0,"accuracy":float(accuracy_score(y_test,rule_pred)),"brier":float(brier_score_loss(y_test,rule_pred.astype(float))),"confusion_matrix":confusion_matrix(y_test,rule_pred,labels=[0,1]).tolist(),"threshold":0.0}
    metrics_store["meta"]={"rows":len(samples),"train_rows":len(X_train),"test_rows":len(X_test),"positive_rate_test":prevalence,"features":FEATURES,"seed":2026,"synthetic":True,"location":current_location["name"]}
    # quick feature importance for RF
    if "Random Forest" in model_store:
        metrics_store["feature_importance"]=[{"feature":k,"importance":float(v)} for k,v in sorted(zip(FEATURES,model_store["Random Forest"].feature_importances_),key=lambda z:z[1],reverse=True)]

train_models()
# Seed enough simulated history so features are available immediately after startup.
for _ in range(181): rows.append(row_of(current_sim.step()))

def tick():
    global last_prediction,last_raining
    for _ in range(max(1,speed)):
        rows.append(row_of(current_sim.step()))
    f=feature_row(list(rows))
    if f is not None:
        x=np.array([[f[k] for k in FEATURES]])
        last_prediction=float(model_store["Random Forest"].predict_proba(x)[0][1])
    last_raining=bool(rows[-1]["raining"])

def status_dict():
    if running: tick()
    current=rows[-1]
    return {"probability":last_prediction,"raining":last_raining,"online":True,"simulated":True,"scenario":scenario_key,"location":current_location["name"],
       "timestamp":current["timestamp"],"pressureDelta3h":feature_row(list(rows)).get("pressure_delta_3h",0) if len(rows)>=181 else 0,
       "readings":{"pressure":current["pressure"],"humidity":current["humidity"],"temperature":current["temperature"],"light":round(current["light"]/1000,1)},"rain_mm":current["rain_mm"],"speed":speed}

@app.get("/")
def root(): return {"name":"Ulan Alert synthetic weather API","docs":"/docs","mode":"simulation-only"}
@app.get("/api/status")
def get_status(): return status_dict()
@app.post("/api/simulation/scenario")
def change_scenario(payload:dict):
    global scenario_key
    scenario_key=payload.get("scenario","natural")
    current_sim.set_scenario(scenario_key)
    return {"scenario":scenario_key,"ok":True}
@app.post("/api/simulation/reset")
def reset(payload:dict=None):
    global current_sim,last_prediction,scenario_key,rows
    seed=(payload or {}).get("seed",73)
    scenario_key=(payload or {}).get("scenario","natural")
    current_sim=SyntheticWeather(seed=seed,scenario=scenario_key,latitude=current_location["latitude"],longitude=current_location["longitude"])
    rows=deque(maxlen=20000); last_prediction=0
    for _ in range(181): rows.append(row_of(current_sim.step()))
    return {"ok":True,"seed":seed,"scenario":scenario_key}
@app.post("/api/simulation/speed")
def set_speed(payload:dict):
    global speed
    speed=int(max(1,min(60,payload.get("speed",1))))
    return {"speed":speed}
@app.get("/api/history")
def history(limit:int=500): return {"items":list(rows)[-min(20000,max(1,limit)):],"synthetic":True}
@app.get("/api/ml/metrics")
def get_metrics(): return metrics_store
@app.get("/api/ml/features")
def get_features(): return {"features":FEATURES,"definitions":{"pressure_delta_30m":"Current pressure minus pressure 30 minutes ago","pressure_delta_1h":"Current pressure minus pressure 1 hour ago","pressure_delta_3h":"Current pressure minus pressure 3 hours ago","humidity":"Current relative humidity","humidity_delta_30m":"Humidity change over 30 minutes","temp_delta_30m":"Temperature change over 30 minutes","temp_residual":"Temperature minus synthetic diurnal expectation","light_ratio":"Current light divided by rolling 1-hour average","hour_sin":"Cyclic hour encoding sine","hour_cos":"Cyclic hour encoding cosine"}}
@app.get("/api/ml/dataset")
def dataset_preview(limit:int=100):
    data=create_synthetic_dataset(seed=2026,days=5)
    return {"synthetic":True,"columns":FEATURES+["rain_next_30min"],"rows":[{**f,"rain_next_30min":y,"timestamp":t} for f,y,t in data[-limit:]]}
@app.post("/api/ml/train")
def retrain():
    train_models()
    return {"ok":True,"metrics":metrics_store}
@app.post("/api/location")
def set_location(payload: dict):
    global current_location, current_sim, rows, last_prediction, last_raining, scenario_key
    name=str(payload.get("name", "Selected location"))[:120]
    latitude=float(payload.get("latitude", 14.1953)); longitude=float(payload.get("longitude", 120.8769))
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return {"ok":False,"message":"Coordinates are outside valid bounds"}
    current_location={"name":name,"latitude":latitude,"longitude":longitude,"source":payload.get("source","manual")}
    current_sim=SyntheticWeather(seed=73, scenario=scenario_key, latitude=latitude, longitude=longitude)
    rows=deque(maxlen=20000); last_prediction=0.0; last_raining=False
    for _ in range(181): rows.append(row_of(current_sim.step()))
    return {"ok":True,"location":current_location}

@app.get("/api/simulation/scenarios")
def scenarios(): return {"scenarios":[{"id":"natural","label":"Natural weather"},{"id":"sunny","label":"Sunny / dry"},{"id":"cloud_build","label":"Cloud buildup"},{"id":"shower","label":"Passing shower"},{"id":"rain_now","label":"Rain now"},{"id":"thunderstorm","label":"Thunderstorm"},{"id":"habagat","label":"Habagat rain"},{"id":"false_warning","label":"Humid / cloudy, no rain"},{"id":"cool_evening","label":"Cool evening"}]}
