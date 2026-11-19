import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudRain, History, Home, Settings, Info, CircleHelp, ChevronRight, MapPin, FlaskConical } from "lucide-react";
import { LangContext, makeT } from "./lang";
import { useDevice } from "./useDevice";
import { logEvent } from "./sessionLog";
import { getSavedLocation } from "./components/LocationPicker";
import HomeView from "./components/HomeView";
import HistoryView from "./components/HistoryView";
import SettingsView from "./components/SettingsView";
import FacilitatorPanel from "./components/FacilitatorPanel";
import AboutView from "./components/AboutView";
import HelpView from "./components/HelpView";
import Toast from "./components/Toast";
const DEFAULTS={sensitivity:"medium",sound:true,vibration:true,cover:false,lang:"en"};
const KEY="ulan-alert-settings";
function loadSettings(){try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return DEFAULTS}}
export default function App(){
 const [settings,setSettings]=useState(loadSettings);const [tab,setTab]=useState("now");const [toast,setToast]=useState("");const [researchOpen,setResearchOpen]=useState(false);const [coverClosed,setCoverClosed]=useState(false);const [location,setLocation]=useState(getSavedLocation);const device=useDevice(settings.sensitivity);
 const update=useCallback(patch=>setSettings(s=>{const n={...s,...patch};try{localStorage.setItem(KEY,JSON.stringify(n))}catch{}return n}),[]);
 const notify=useCallback(m=>setToast(m),[]),clearToast=useCallback(()=>setToast(""),[]);
 const lang=useMemo(()=>({lang:settings.lang,t:makeT(settings.lang)}),[settings.lang]);const {t}=lang;
 const tabs=[["now",t("tabNow"),Home], ["history",t("tabHistory"),History], ["settings",t("tabSettings"),Settings], ["about","About",Info], ["help","Help",CircleHelp]];
 const go=id=>{setTab(id);logEvent("tab_opened",id)};
 useEffect(()=>{fetch("/api/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(location)}).catch(()=>{});},[]);
 const changeLocation=async next=>{setLocation(next);try{const r=await fetch("/api/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(next)});if(!r.ok)throw new Error("location api error");logEvent("location_changed",next.name)}catch{notify("Location saved, but the simulator service couldn't update. Restart the app service and try again.")}};
 const titles={now:"Overview",history:"Weather history",settings:"Settings",about:"About Ulan Alert",help:"Help Center"};
 return <LangContext.Provider value={lang}><div className="app-shell">
  <aside className="desktop-sidebar"><div className="brand"><div className="brand-mark"><CloudRain/></div><div><b>ULAN ALERT</b></div></div><p className="nav-label">MENU</p>{tabs.map(([id,label,Icon])=><button className={`side-nav ${tab===id?"active":""}`} key={id} onClick={()=>go(id)}><Icon/><span>{label}</span>{tab===id&&<ChevronRight className="nav-arrow"/>}</button>)}</aside>
  <div className="main-column"><header className="topbar"><div className="brand-mobile"><div className="brand-mark"><CloudRain/></div><b>ULAN ALERT</b></div><div className="top-title"><span>SYNTHETIC WEATHER MONITORING & RAIN-WARNING RESEARCH</span><h1>{titles[tab]}</h1></div><div className="topbar-actions"><span className="simulation-mode-chip">SIMULATION ONLY</span><div className="status-chip"><span className={device.apiReady?"dot live":"dot"}></span>{device.apiReady?"Simulation ready":"Service unavailable"}</div><button className="research-trigger" onClick={()=>setResearchOpen(true)}><FlaskConical size={16}/> <span>Research Lab</span></button></div></header>
  <main className="content"><div className="location-strip"><div><small>SIMULATION LOCATION</small><strong>{location?.name||"Indang, Cavite, Philippines"}</strong></div><button className="location-shortcut" onClick={()=>go("settings")}><MapPin size={16}/> Change</button></div>
   {tab==="now"&&<HomeView device={device} settings={settings} notify={notify} coverClosed={coverClosed} setCoverClosed={setCoverClosed}/>}
   {tab==="history"&&<HistoryView demo={device.demo}/>}
   {tab==="settings"&&<SettingsView settings={settings} update={update} notify={notify} location={location} onLocationChange={changeLocation}/>}
   {tab==="about"&&<AboutView/>}{tab==="help"&&<HelpView/>}
   <div className="footer-note"><CloudRain size={15}/> SYNTHETIC WEATHER SIMULATION · NOT AN OFFICIAL FORECAST</div>
  </main></div>
  <FacilitatorPanel device={device} open={researchOpen} onClose={()=>setResearchOpen(false)}/>
  <Toast message={toast} onDone={clearToast}/>
  <nav aria-label="Main" className="mobile-nav">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>go(id)} aria-current={tab===id?"page":undefined} className={tab===id?"active":""}><Icon/><span>{label}</span></button>)}</nav>
 </div></LangContext.Provider>
}
