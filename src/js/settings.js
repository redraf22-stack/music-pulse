// ===== НАСТРОЙКИ УСТРОЙСТВ =====
let selectedMicId=localStorage.getItem('syncmusic_mic')||'';
let selectedSpeakerId=localStorage.getItem('syncmusic_speaker')||'';
let selectedCameraId=localStorage.getItem('syncmusic_camera')||'';
async function enumerateDevices(){
try{
const ts=await navigator.mediaDevices.getUserMedia({audio:true,video:true}).catch(function(){return navigator.mediaDevices.getUserMedia({audio:true});});
ts.getTracks().forEach(function(t){t.stop();});
const d=await navigator.mediaDevices.enumerateDevices();
const m=document.getElementById('mic-select'),s=document.getElementById('speaker-select'),cam=document.getElementById('camera-select');
if(!m||!s||!cam)return;
const cm=m.value||selectedMicId,cs=s.value||selectedSpeakerId,cc=cam.value||selectedCameraId;
m.innerHTML='<option value="">'+escapeHtml(translate('settings_default'))+'</option>';
s.innerHTML='<option value="">'+escapeHtml(translate('settings_default'))+'</option>';
cam.innerHTML='<option value="">'+escapeHtml(translate('settings_default'))+'</option>';
d.forEach(function(x){const o=document.createElement('option');o.value=x.deviceId;o.textContent=x.label||(x.kind+' ('+x.deviceId.slice(0,8)+'...)');if(x.kind==='audioinput')m.appendChild(o);if(x.kind==='audiooutput')s.appendChild(o);if(x.kind==='videoinput')cam.appendChild(o);});
m.value=cm;s.value=cs;cam.value=cc;
applySpeakerToDevice();
}catch(e){console.error('enumerateDevices:',e);}
}
function saveDeviceSettings(){const m=document.getElementById('mic-select'),s=document.getElementById('speaker-select'),cam=document.getElementById('camera-select');selectedMicId=m?m.value:'';selectedSpeakerId=s?s.value:'';selectedCameraId=cam?cam.value:'';localStorage.setItem('syncmusic_mic',selectedMicId);localStorage.setItem('syncmusic_speaker',selectedSpeakerId);localStorage.setItem('syncmusic_camera',selectedCameraId);applySpeakerToDevice();}
async function applySpeakerToDevice(){if(typeof audio!=='undefined'&&selectedSpeakerId&&audio.setSinkId){try{await audio.setSinkId(selectedSpeakerId);}catch(e){}}}
function openSettings(){const m=document.getElementById('settings-modal');if(!m)return;m.classList.add('open');enumerateDevices();}
function closeSettings(){const m=document.getElementById('settings-modal');if(m)m.classList.remove('open');}
(function(){const m=document.getElementById('settings-modal');if(m)m.addEventListener('click',function(e){if(e.target===m)closeSettings();});})();