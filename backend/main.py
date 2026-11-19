"""Ulan Alert API (simulation only).

Changes vs. the first version:
  * GET endpoints are pure. A background task advances the simulation, so extra browser tabs no longer
    speed it up and /api/status can't change state.
  * Features come from features.compute_features(), the same code used in training (no train/serve skew).
  * The trained model + metrics are cached on disk; first start trains in a background thread while the API
    reports model_ready=false.
  * Every simulated minute gets a probability, so alert behaviour can be verified live (/api/ml/live).
  * /api/status returns the top drivers behind the current probability (occlusion explanation).
"""
from __future__ import annotations

import asyncio
import json
import os
import threading
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import ml
from features import DEFINITIONS, FEATURES, HISTORY, compute_features
from simulator import SCENARIOS, SyntheticWeather

CACHE = Path(__file__).parent / ".cache" / "model.joblib"
TICK_SECONDS = float(os.environ.get("ULAN_TICK_SECONDS", "2.0"))
LIVE_MODEL = "Random Forest"
MAX_ROWS = 20000

lock = threading.RLock()
store = {"models": None, "metrics": {}, "medians": None, "ready": False, "error": None, "training": False}
DEFAULT_LOC = {"name": "Indang, Cavite, Philippines", "latitude": 14.1953, "longitude": 120.8769, "source": "default"}


class Live:
    """Everything that changes while the simulation runs."""
    def __init__(self):
        self.seed, self.scenario, self.speed, self.running = 73, "natural", 1, True
        self.location = dict(DEFAULT_LOC)
        self.reset()

    def reset(self, seed=None, scenario=None):
        if seed is not None:
            self.seed = int(seed)
        if scenario is not None:
            self.scenario = scenario if scenario in SCENARIOS else "natural"
        self.sim = SyntheticWeather(seed=self.seed, scenario=self.scenario, latitude=self.location["latitude"],
                                    longitude=self.location["longitude"])
        self.rows: deque = deque(maxlen=MAX_ROWS)
        self.probs: deque = deque(maxlen=MAX_ROWS)
        self.last_features = None
        self.drivers: list = []
        self._advance(HISTORY + 59)       # warm-up so every feature is defined immediately

    # ------------------------------------------------------------------
    def _advance(self, k: int):
        for _ in range(k):
            s = self.sim.step()
            self.rows.append({"timestamp": s.timestamp.isoformat(), "pressure": s.pressure_hpa, "temperature": s.temperature_c,
                              "humidity": s.humidity_pct, "light": s.light_lux, "rain_mm": s.rain_mm, "raining": s.raining,
                              "scenario": s.scenario})
        # probabilities for the k new minutes (vectorised)
        need = min(len(self.rows), HISTORY + k)
        df = pd.DataFrame(list(self.rows)[-need:])
        F = compute_features(df)
        newF = F.iloc[-k:]
        p = np.full(k, np.nan)
        ok = ~newF.isna().any(axis=1).to_numpy()
        models = store["models"]
        if models is not None and ok.any():
            p[ok] = models[LIVE_MODEL].predict_proba(newF.to_numpy(float)[ok])[:, 1]
        for v in p:
            self.probs.append(float(v))
        # fill history for rows that predate the model (so live eval has something once the model arrives)
        last = F.iloc[-1]
        self.last_features = None if last.isna().any() else last.to_numpy(float)
        self.drivers = []
        if models is not None and self.last_features is not None and not np.isnan(p[-1]) and p[-1] > 0.1:
            self.drivers = ml.explain(models[LIVE_MODEL], self.last_features, store["medians"])

    def tick(self):
        if self.running:
            self._advance(max(1, self.speed))


live = Live()


def _train_and_store():
    with lock:
        store["training"] = True
    try:
        models, metrics, medians = ml.train_all()
        for m in models.values():                      # single-row inference: avoid thread-pool overhead
            try:
                m.model.set_params(n_jobs=1)
            except Exception:
                pass
        CACHE.parent.mkdir(exist_ok=True)
        joblib.dump({"sklearn": sklearn.__version__, "models": models, "metrics": metrics, "medians": medians}, CACHE)
        with lock:
            store.update(models=models, metrics=metrics, medians=medians, ready=True, error=None)
            live.reset()
    except Exception as e:                                # pragma: no cover
        store["error"] = repr(e)
    finally:
        store["training"] = False


def _load_or_train():
    if CACHE.exists():
        try:
            blob = joblib.load(CACHE)
            if blob.get("sklearn") == sklearn.__version__:
                for m in blob["models"].values():
                    try:
                        m.model.set_params(n_jobs=1)
                    except Exception:
                        pass
                with lock:
                    store.update(models=blob["models"], metrics=blob["metrics"], medians=blob["medians"], ready=True)
                    live.reset()
                return
        except Exception:
            pass
    _train_and_store()


async def _ticker():
    while True:
        await asyncio.sleep(TICK_SECONDS)
        with lock:
            live.tick()


@asynccontextmanager
async def lifespan(app):
    threading.Thread(target=_load_or_train, daemon=True).start()
    task = asyncio.create_task(_ticker())
    yield
    task.cancel()


app = FastAPI(title="Ulan Alert Synthetic Simulation", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])


def _status():
    cur = live.rows[-1]
    prob = live.probs[-1] if live.probs else float("nan")
    recent = list(live.rows)[-31:]
    f = live.last_features
    return {
        "probability": 0.0 if np.isnan(prob) else prob, "raining": bool(cur["raining"]),
        "recently_wet": any(r["raining"] for r in recent), "online": True, "simulated": True,
        "model_ready": store["ready"], "scenario": live.scenario, "location": live.location["name"],
        "timestamp": cur["timestamp"], "pressureDelta3h": float(f[FEATURES.index("pressure_delta_3h")]) if f is not None else 0.0,
        "readings": {"pressure": cur["pressure"], "humidity": cur["humidity"], "temperature": cur["temperature"],
                     "light": round(cur["light"] / 1000, 1)},
        "rain_mm": cur["rain_mm"], "speed": live.speed, "drivers": live.drivers,
    }


@app.get("/")
def root():
    return {"name": "Ulan Alert synthetic weather API", "docs": "/docs", "mode": "simulation-only", "model_ready": store["ready"]}


@app.get("/api/status")
def get_status():
    with lock:
        return _status()


@app.post("/api/simulation/scenario")
def change_scenario(payload: dict):
    with lock:
        live.scenario = payload.get("scenario", "natural") if payload.get("scenario") in SCENARIOS else "natural"
        live.sim.set_scenario(live.scenario)
    return {"scenario": live.scenario, "ok": True}


@app.post("/api/simulation/reset")
def reset(payload: dict = None):
    payload = payload or {}
    with lock:
        live.reset(seed=payload.get("seed", 73), scenario=payload.get("scenario", "natural"))
    return {"ok": True, "seed": live.seed, "scenario": live.scenario}


@app.post("/api/simulation/speed")
def set_speed(payload: dict):
    with lock:
        live.speed = int(max(1, min(60, payload.get("speed", 1))))
    return {"speed": live.speed}


@app.post("/api/simulation/pause")
def pause(payload: dict):
    with lock:
        live.running = not bool(payload.get("paused", True))
    return {"running": live.running}


@app.get("/api/history")
def history(limit: int = 500):
    with lock:
        rows = list(live.rows)[-min(MAX_ROWS, max(1, limit)):]
        probs = list(live.probs)[-len(rows):]
    items = [{**r, "probability": (None if np.isnan(p) else round(p, 4))} for r, p in zip(rows, probs)]
    return {"items": items, "synthetic": True}


@app.get("/api/simulation/scenarios")
def scenarios():
    return {"scenarios": [{"id": "natural", "label": "Natural weather"}, {"id": "sunny", "label": "Sunny / dry"},
                          {"id": "cloud_build", "label": "Cloud buildup"}, {"id": "shower", "label": "Passing shower"},
                          {"id": "rain_now", "label": "Rain now"}, {"id": "thunderstorm", "label": "Thunderstorm"},
                          {"id": "habagat", "label": "Habagat rain"}, {"id": "false_warning", "label": "Humid / cloudy, no rain"},
                          {"id": "cool_evening", "label": "Cool evening"}]}


@app.post("/api/location")
def set_location(payload: dict):
    name = str(payload.get("name", "Selected location"))[:120]
    latitude = float(payload.get("latitude", 14.1953)); longitude = float(payload.get("longitude", 120.8769))
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return {"ok": False, "message": "Coordinates are outside valid bounds"}
    with lock:
        live.location = {"name": name, "latitude": latitude, "longitude": longitude, "source": payload.get("source", "manual")}
        live.reset()
        return {"ok": True, "location": live.location}


# ------------------------------------------------------------------ ML endpoints
@app.get("/api/ml/metrics")
def get_metrics():
    return {**store["metrics"], "model_ready": store["ready"], "training": store["training"], "error": store["error"]}


@app.get("/api/ml/features")
def get_features():
    return {"features": FEATURES, "definitions": DEFINITIONS}


@lru_cache(maxsize=1)
def _preview():
    seq = ml.build_sequences(n_seq=1, days=6)[0]
    ix = np.flatnonzero(seq.valid)[::30]
    rows = seq.X.iloc[ix].copy(); rows["rain_next_30min"] = seq.y[ix].astype(int)
    rows["timestamp"] = seq.df["timestamp"].iloc[ix].astype(str).to_numpy()
    return rows.round(4).to_dict("records")


@app.get("/api/ml/dataset")
def dataset_preview(limit: int = 100):
    return {"synthetic": True, "columns": FEATURES + ["rain_next_30min"], "rows": _preview()[-limit:]}


@app.post("/api/ml/train")
def retrain():
    if store["training"]:
        return {"ok": False, "message": "Training already running", "metrics": store["metrics"]}
    _train_and_store()
    return {"ok": store["error"] is None, "metrics": store["metrics"], "error": store["error"]}


@app.get("/api/ml/live")
def live_eval(minutes: int = 1440):
    """Verify the live model on what the running simulation has actually done (last N simulated minutes)."""
    with lock:
        n = min(len(live.rows), max(HISTORY, minutes))
        wet = np.array([r["raining"] for r in list(live.rows)[-n:]], bool)
        prob = np.array(list(live.probs)[-n:], float)
    res = ml.alert_eval(prob, wet, ml.WARN_DEFAULT)
    return {"window_minutes": n, "warn_threshold": ml.WARN_DEFAULT, **ml.merge_alert_evals([res]),
            "note": "Computed on the running simulation's own history; small windows are noisy."}
