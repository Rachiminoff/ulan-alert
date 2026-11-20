import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudRain, History, Home, Settings, Info, CircleHelp, ChevronRight, MapPin, FlaskConical, X, Sparkles } from "lucide-react";
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
import TerminalPanel from "./components/TerminalPanel";
const DEFAULTS={sensitivity:"medium",sound:true,vibration:true,cover:false,lang:"en",fullMoon:false,showTrivia:true};
const KEY="ulan-alert-settings";
function loadSettings(){try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return DEFAULTS}}
export default function App(){
 const [settings,setSettings]=useState(loadSettings);const [tab,setTab]=useState("now");const [toast,setToast]=useState("");const [researchOpen,setResearchOpen]=useState(false);const [coverClosed,setCoverClosed]=useState(false);const [location,setLocation]=useState(getSavedLocation);const [terminalOpen,setTerminalOpen]=useState(false);const [developerMessage,setDeveloperMessage]=useState(false);const logoClicks=useRef({count:0,last:0});const device=useDevice(settings.sensitivity);
 const update=useCallback(patch=>setSettings(s=>{const n={...s,...patch};try{localStorage.setItem(KEY,JSON.stringify(n))}catch{}return n}),[]);
 const notify=useCallback(m=>setToast(m),[]),clearToast=useCallback(()=>setToast(""),[]);
 const lang=useMemo(()=>({lang:settings.lang,t:makeT(settings.lang)}),[settings.lang]);const {t}=lang;
 const tabs=[["now",t("tabNow"),Home], ["history",t("tabHistory"),History], ["settings",t("tabSettings"),Settings], ["about","About",Info], ["help","Help",CircleHelp]];
 const go=id=>{setTab(id);logEvent("tab_opened",id)};
 const onLogoClick=()=>{
  const now=Date.now();const state=logoClicks.current;
  state.count=now-state.last>3000?1:state.count+1;state.last=now;
  if(state.count>=5){state.count=0;setDeveloperMessage(true);logEvent("developer_easter_egg_unlocked");}
 };
 const toggleFullMoon=()=>{update({fullMoon:!settings.fullMoon});logEvent("full_moon_mode",!settings.fullMoon?"enabled":"disabled");notify(!settings.fullMoon?"Full Moon mode enabled.":"Full Moon mode disabled.")};
 useEffect(()=>{fetch("/api/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(location)}).catch(()=>{});},[]);
 const changeLocation=async next=>{setLocation(next);try{const r=await fetch("/api/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(next)});if(!r.ok)throw new Error("location api error");logEvent("location_changed",next.name)}catch{notify("Location saved, but the simulator service couldn't update. Restart the app service and try again.")}};
 const titles={now:"Overview",history:"Weather history",settings:"Settings",about:"About Ulan Alert",help:"Help Center"};
 return <LangContext.Provider value={lang}><div className={`app-shell${settings.fullMoon?" full-moon-mode":""}`}>
  <aside className="desktop-sidebar"><button className="brand brand-clickable" onClick={onLogoClick} aria-label="Ulan Alert logo"><div className="brand-mark"><CloudRain/></div><div><b>ULAN ALERT</b></div></button><p className="nav-label">MENU</p>{tabs.map(([id,label,Icon])=><button className={`side-nav ${tab===id?"active":""}`} key={id} onClick={()=>go(id)}><Icon/><span>{label}</span>{tab===id&&<ChevronRight className="nav-arrow"/>}</button>)}</aside>
  <div className="main-column"><header className="topbar"><button className="brand-mobile brand-clickable" onClick={onLogoClick} aria-label="Ulan Alert logo"><div className="brand-mark"><CloudRain/></div><b>ULAN ALERT</b></button><div className="top-title"><span>SYNTHETIC WEATHER MONITORING & RAIN-WARNING RESEARCH</span><h1>{titles[tab]}</h1></div><div className="topbar-actions"><button className="research-trigger" onClick={()=>setResearchOpen(true)}><FlaskConical size={16}/> <span>Research Lab</span></button></div></header>
  <main className="content"><div className="location-strip"><div><small>SIMULATION LOCATION</small><strong>{location?.name||"Indang, Cavite, Philippines"}</strong></div><button className="location-shortcut" onClick={()=>go("settings")}><MapPin size={16}/> Change</button></div>
   {tab==="now"&&<HomeView device={device} settings={settings} notify={notify} coverClosed={coverClosed} setCoverClosed={setCoverClosed}/>}
   {tab==="history"&&<HistoryView demo={device.demo}/>}
   {tab==="settings"&&<SettingsView settings={settings} update={update} notify={notify} location={location} onLocationChange={changeLocation} onOpenTerminal={()=>setTerminalOpen(true)} onToggleFullMoon={toggleFullMoon}/>}
   {tab==="about"&&<AboutView/>}{tab==="help"&&<HelpView/>}
   <div className="footer-note"><CloudRain size={15}/> SYNTHETIC WEATHER SIMULATION · NOT AN OFFICIAL FORECAST</div>
  </main></div>
  <FacilitatorPanel device={device} sensitivity={settings.sensitivity} open={researchOpen} onClose={()=>setResearchOpen(false)}/>
  <Toast message={toast} onDone={clearToast}/>
  {terminalOpen&&<TerminalPanel onClose={()=>setTerminalOpen(false)}/>}
  {developerMessage&&<div className="easter-egg-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDeveloperMessage(false)}}><section className="developer-easter-egg" role="dialog" aria-modal="true" aria-labelledby="developer-message-title"><button className="easter-egg-close" onClick={()=>setDeveloperMessage(false)} aria-label="Close message"><X size={18}/></button><div className="easter-egg-sparkle"><Sparkles/></div><small>SECRET MESSAGE UNLOCKED</small><h2 id="developer-message-title">You found the hidden rain gauge.</h2><p>Every good weather station has a little mystery. Thanks for exploring Ulan Alert — keep watching the skies, questioning the numbers, and never trust a forecast without understanding its uncertainty.</p><span>— The Ulan Alert development team</span></section></div>}
  <nav aria-label="Main" className="mobile-nav">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>go(id)} aria-current={tab===id?"page":undefined} className={tab===id?"active":""}><Icon/><span>{label}</span></button>)}</nav>
 </div></LangContext.Provider>
}
