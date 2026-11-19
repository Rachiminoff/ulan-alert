import { useCallback, useEffect, useRef, useState } from "react";
import { logEvent } from "./sessionLog";
export const THRESHOLDS = { low:{watch:.5,warn:.75}, medium:{watch:.4,warn:.6}, high:{watch:.3,warn:.5} };
const API="/api";
const SCENARIOS={ safe:{api:"sunny",p:.08,raining:false,readings:{pressure:1010,humidity:62,temperature:31,light:82},dP3:-.1}, watch:{api:"cloud_build",p:.5,raining:false,readings:{pressure:1008.8,humidity:74,temperature:29,light:55},dP3:-1.2}, warning:{api:"thunderstorm",p:.85,raining:false,readings:{pressure:1007.1,humidity:88,temperature:27,light:25},dP3:-2.1}, raining:{api:"rain_now",p:.75,raining:true,readings:{pressure:1006.5,humidity:96,temperature:25,light:12},dP3:-2.4}, offline:{api:null,p:0,raining:false,online:false,readings:{pressure:0,humidity:0,temperature:0,light:0},dP3:0} };
export const SCENARIO_KEYS=Object.keys(SCENARIOS);
export function useDevice(sensitivity){
 const [scenario,setScenarioState]=useState("safe");
 const [state,setState]=useState({level:"offline",probability:0,online:false,raining:false,readings:{pressure:0,humidity:0,temperature:0,light:0},dP3:0,updatedAt:Date.now(),cooling:false,apiReady:false});
 const refs=useRef({over:0,cooldown:0,lastLevel:"",sensitivity,apiReady:false}); refs.current.sensitivity=sensitivity;
 const evaluate=useCallback((raw)=>{const r=refs.current,th=THRESHOLDS[r.sensitivity];if(r.cooldown>0)r.cooldown--;r.over=raw.probability>=th.warn?r.over+1:0;let level="safe";if(!raw.online)level="offline";else if(raw.raining)level="raining";else if(r.over>=2&&r.cooldown===0)level="warning";else if(raw.probability>=th.watch)level="watch";if(r.lastLevel!==level){logEvent("status_changed",level);r.lastLevel=level;}setState({...raw,level,updatedAt:Date.now(),cooling:r.cooldown>0});},[]);
 useEffect(()=>{let alive=true;const poll=async()=>{if(scenario==="offline"){if(alive)evaluate({...SCENARIOS.offline,apiReady:true});return;}try{const res=await fetch(`${API}/status`);if(!res.ok)throw new Error("API unavailable");const j=await res.json();if(alive)evaluate({probability:Number(j.probability)||0,raining:!!j.raining,online:j.online!==false,readings:j.readings||{},dP3:j.pressureDelta3h||0,scenario:j.scenario,timestamp:j.timestamp,apiReady:true,simulated:true,location:j.location});}catch{if(alive)evaluate({probability:0,raining:false,online:false,readings:SCENARIOS.offline.readings,dP3:0,apiReady:false,simulated:true});}};poll();const timer=setInterval(poll,2000);return()=>{alive=false;clearInterval(timer)};},[evaluate,scenario]);
 const setScenario=useCallback(async(key)=>{refs.current.over=0;refs.current.cooldown=0;refs.current.lastLevel="";setScenarioState(key);logEvent("scenario_set",key);if(key!=="offline"&&SCENARIOS[key]?.api){try{await fetch(`${API}/simulation/scenario`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scenario:SCENARIOS[key].api})});}catch{}}},[]);
 const pauseAlerts=useCallback(()=>{refs.current.cooldown=15;setState(s=>({...s,level:s.level==="warning"?"watch":s.level,cooling:true}));},[]);
 return {...state,scenario,setScenario,pauseAlerts,demo:true};
}
