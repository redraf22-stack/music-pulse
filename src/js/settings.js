// ===== НАСТРОЙКИ УСТРОЙСТВ =====
let selectedMicId='',selectedSpeakerId='',selectedCameraId='';

let _dsMicLabel='',_dsSpeakerLabel='',_dsCameraLabel='',_dsMicGroup='',_dsSpeakerGroup='',_dsCameraGroup='';
async function loadDeviceSettings(){
if(!(window.electronAPI&&window.electronAPI.getDeviceSettings))return;
try{
const ds=await window.electronAPI.getDeviceSettings();
if(ds){
selectedMicId=ds.mic||'';selectedSpeakerId=ds.speaker||'';selectedCameraId=ds.camera||'';
_dsMicLabel=ds.micLabel||'';_dsSpeakerLabel=ds.speakerLabel||'';_dsCameraLabel=ds.cameraLabel||'';
_dsMicGroup=ds.micGroup||'';_dsSpeakerGroup=ds.speakerGroup||'';_dsCameraGroup=ds.cameraGroup||'';
}
}catch(e){console.error('[loadDeviceSettings]',e);}
}

async function enumerateDevices(){
try{
await loadDeviceSettings();
const ts=await navigator.mediaDevices.getUserMedia({audio:true,video:true}).catch(function(){return navigator.mediaDevices.getUserMedia({audio:true});});
ts.getTracks().forEach(function(t){t.stop();});
const d=await navigator.mediaDevices.enumerateDevices();
const m=document.getElementById('mic-select'),s=document.getElementById('speaker-select'),cam=document.getElementById('camera-select');
if(!m||!s||!cam)return;
m.innerHTML='<option value="">'+escapeHtml(translate('settings_default'))+'</option>';
s.innerHTML='<option value="">'+escapeHtml(translate('settings_default'))+'</option>';
cam.innerHTML='<option value="">'+escapeHtml(translate('settings_default'))+'</option>';
d.forEach(function(x){const o=document.createElement('option');o.value=x.deviceId;o.textContent=x.label||(x.kind+' ('+x.deviceId.slice(0,8)+'...)');if(x.kind==='audioinput')m.appendChild(o);if(x.kind==='audiooutput')s.appendChild(o);if(x.kind==='videoinput')cam.appendChild(o);});
resolveSelectValue(m,selectedMicId,'audioinput');resolveSelectValue(s,selectedSpeakerId,'audiooutput');resolveSelectValue(cam,selectedCameraId,'videoinput');
applySpeakerToDevice();
}catch(e){console.error('enumerateDevices:',e);}
}

async function saveDeviceSettings(){
const m=document.getElementById('mic-select'),s=document.getElementById('speaker-select'),cam=document.getElementById('camera-select');
selectedMicId=m?m.value:'';selectedSpeakerId=s?s.value:'';selectedCameraId=cam?cam.value:'';
const devs=await navigator.mediaDevices.enumerateDevices();
const pick=(id,kind)=>{const d=devs.find(x=>x.deviceId===id&&x.kind===kind);return d?{label:d.label,groupId:d.groupId}:null;};
const sp=pick(selectedSpeakerId,'audiooutput'),mi=pick(selectedMicId,'audioinput'),ca=pick(selectedCameraId,'videoinput');
const payload={mic:selectedMicId,speaker:selectedSpeakerId,camera:selectedCameraId};
if(sp){payload.speakerLabel=sp.label;payload.speakerGroup=sp.groupId;}
if(mi){payload.micLabel=mi.label;payload.micGroup=mi.groupId;}
if(ca){payload.cameraLabel=ca.label;payload.cameraGroup=ca.groupId;}
if(window.electronAPI&&window.electronAPI.setDeviceSettings)await window.electronAPI.setDeviceSettings(payload);
applySpeakerToDevice().then(r=>{
if(r&&r.ok&&!r.silent){showToast('🔊 Вывод звука переключен');}
else{showToast('💾 Сохранено');}
});
}

async function applySpeakerToDevice(){
await loadDeviceSettings();
if(!selectedSpeakerId&&!_dsSpeakerLabel)return{ok:true,silent:true};
if(typeof audio==='undefined')return{ok:true,silent:true};
let outs=[];
try{outs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput');}catch(e){}
let dev=outs.find(d=>d.deviceId===selectedSpeakerId)||null;
if(!dev&&_dsSpeakerGroup)dev=outs.find(d=>d.groupId===_dsSpeakerGroup)||null;
if(!dev&&_dsSpeakerLabel)dev=outs.find(d=>d.label===_dsSpeakerLabel)||null;
if(!dev&&outs.length&&outs.every(d=>!d.label)){
try{const ts=await navigator.mediaDevices.getUserMedia({audio:true});ts.getTracks().forEach(t=>t.stop());outs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput');dev=outs.find(d=>d.deviceId===selectedSpeakerId)||(_dsSpeakerGroup?outs.find(d=>d.groupId===_dsSpeakerGroup):null)||(_dsSpeakerLabel?outs.find(d=>d.label===_dsSpeakerLabel):null);}catch(e){}
}
if(!dev)return{ok:false,err:'device-not-found'};
const targetId=dev.deviceId;
let ok=false,err='';
try{if(audio.setSinkId){await audio.setSinkId(targetId);ok=true;}}catch(e){err='audio:'+e.name;}
try{if(typeof getGlobalAudioContext==='function'){const ctx=getGlobalAudioContext();if(ctx&&ctx.setSinkId){await ctx.setSinkId(targetId);ok=true;}}}catch(e){err+=' ctx:'+e.name;}
console.warn('[speaker] apply',targetId,dev.label,ok?'OK':'FAIL',err);
return{ok:ok,err:err};
}

function resolveSelectValue(sel,savedId,kind){
if(!sel)return;
const opts=Array.from(sel.options);
if(savedId&&opts.some(o=>o.value===savedId)){sel.value=savedId;return;}
const label=kind==='audioinput'?_dsMicLabel:kind==='audiooutput'?_dsSpeakerLabel:_dsCameraLabel;
if(label){const o=opts.find(x=>x.textContent===label);if(o){sel.value=o.value;return;}}
sel.value='';
}

function openSettings(){const m=document.getElementById('settings-modal');if(!m)return;m.classList.add('open');enumerateDevices();}
function closeSettings(){const m=document.getElementById('settings-modal');if(m)m.classList.remove('open');}

(function(){
const m=document.getElementById('settings-modal');
if(m)m.addEventListener('click',function(e){if(e.target===m)closeSettings();});
})();

(function(){
const cb=document.getElementById('autostart-check');
if(!cb)return;
cb.addEventListener('change',function(){if(window.electronAPI&&window.electronAPI.setAutostart)window.electronAPI.setAutostart(cb.checked);});
const origOpenAutostart=window.openSettings;
window.openSettings=function(){origOpenAutostart();if(window.electronAPI&&window.electronAPI.getAutostart)window.electronAPI.getAutostart().then(r=>{cb.checked=!!(r&&r.enabled);});};
})();

window.addEventListener('load',()=>{
setTimeout(()=>{applySpeakerToDevice().catch(()=>{});},500);
setTimeout(()=>{applySpeakerToDevice().catch(()=>{});},2000);
setTimeout(()=>{applySpeakerToDevice().catch(()=>{});},5000);
try{if(typeof audio!=='undefined')audio.addEventListener('play',()=>{applySpeakerToDevice().catch(()=>{});});}catch(e){}
});