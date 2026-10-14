// ===== СОЧЕТАНИЯ КЛАВИШ: PTT (голос по зажатию, как в CS), мьют, глушение =====
// Настройки: вкладка «Сочетания клавиш» — на стартовом экране (⚙ → Сочетания клавиш)
// и в комнате (⚙ Устройства → Сочетания клавиш).
// Хранение: localStorage.mp_hotkeys. Рабочее состояние: pttHeld = клавиша PTT зажата.
// Микрофон в войсе управляется через voice.js:applyMicGate() — она сводит
// isMuted/forceMuted/PTT в одно состояние трека.
const HK_DEFAULTS={
ptt:{enabled:false,combo:{code:'KeyV',ctrl:false,alt:false,shift:false}},
mute:{combo:{code:'KeyM',ctrl:false,alt:false,shift:false}},
deafen:{combo:{code:'KeyB',ctrl:false,alt:false,shift:false}},
playpause:{combo:{code:'F8',ctrl:false,alt:false,shift:false}},
next:{combo:{code:'F9',ctrl:false,alt:false,shift:false}},
prev:{combo:{code:'F7',ctrl:false,alt:false,shift:false}}
};
const HK_ACTIONS=['ptt','mute','deafen','playpause','next','prev'];
const HK_MODIFIER_CODES=['ControlLeft','ControlRight','ShiftLeft','ShiftRight','AltLeft','AltRight','MetaLeft','MetaRight'];
const HK_KEY_NAMES={Space:'Пробел',Escape:'Esc',Tab:'Tab',Enter:'Enter',Backspace:'Backspace',Delete:'Del',Insert:'Ins',Home:'Home',End:'End',PageUp:'PgUp',PageDown:'PgDn',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',CapsLock:'Caps',PrintScreen:'PrtSc',ScrollLock:'ScrLk',Pause:'Pause',NumLock:'NumLk',Comma:',',Period:'.',Slash:'/',Backslash:'\\',Minus:'-',Equal:'=',Quote:"'",Semicolon:';',BracketLeft:'[',BracketRight:']',Backquote:'`',XButton1:'Мышь ←',XButton2:'Мышь →'};
let _hkCfg=null,_hkCapturing=null,pttHeld=false;
// Глобальный опрос клавиш в главном процессе Electron (koffi/Win32): true = локальный
// диспетчер молчит, события приходят по IPC. Оптимистично true при наличии electronAPI,
// чтобы не было двойного срабатывания в окне между стартом и ответом главного процесса.
let _hkGlobalActive=typeof window!=='undefined'&&!!(window.electronAPI&&window.electronAPI.hkGlobalSet);

function hkLoad(){
if(_hkCfg)return _hkCfg;
let c=null;try{c=JSON.parse(localStorage.getItem('mp_hotkeys')||'null');}catch(e){}
if(!c||typeof c!=='object')c={};
HK_ACTIONS.forEach(a=>{
if(!c[a]||typeof c[a]!=='object')c[a]=JSON.parse(JSON.stringify(HK_DEFAULTS[a]));
if(!c[a].combo||typeof c[a].combo!=='object'||!c[a].combo.code)c[a].combo=JSON.parse(JSON.stringify(HK_DEFAULTS[a].combo));
});
if(typeof c.ptt.enabled!=='boolean')c.ptt.enabled=HK_DEFAULTS.ptt.enabled;
_hkCfg=c;return c;
}
function hkSave(){try{localStorage.setItem('mp_hotkeys',JSON.stringify(_hkCfg));}catch(e){}}
function hkCombo(a){return hkLoad()[a].combo;}
function hkPttOn(){return !!hkLoad().ptt.enabled;}
function comboFromEvent(e){return {code:e.code,ctrl:!!e.ctrlKey,alt:!!e.altKey,shift:!!e.shiftKey};}
function comboEquals(a,b){return !!a&&!!b&&a.code===b.code&&!!a.ctrl===!!b.ctrl&&!!a.alt===!!b.alt&&!!a.shift===!!b.shift;}
function comboMatches(combo,e){return !!combo&&e.code===combo.code&&!!e.ctrlKey===!!combo.ctrl&&!!e.altKey===!!combo.alt&&!!e.shiftKey===!!combo.shift;}
function comboLabel(combo){
if(!combo||!combo.code)return '—';
let k=HK_KEY_NAMES[combo.code];
if(!k){
if(/^Key[A-Z]$/.test(combo.code))k=combo.code.slice(3);
else if(/^Digit[0-9]$/.test(combo.code))k=combo.code.slice(5);
else if(combo.code.indexOf('Numpad')===0)k='Num '+(combo.code.slice(6)||'?');
else k=combo.code;
}
return (combo.ctrl?'Ctrl+':'')+(combo.alt?'Alt+':'')+(combo.shift?'Shift+':'')+k;
}
function _hkEditable(t){
if(!t)return false;
const tag=(t.tagName||'').toUpperCase();
return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||!!t.isContentEditable;
}
function _hkVoiceOk(){
if(typeof isInVoice!=='undefined'&&isInVoice&&typeof myStream!=='undefined'&&myStream)return true;
showToast(translate('join_voice_first'),true);return false;
}
function _hkMicGate(){if(typeof applyMicGate==='function'){try{applyMicGate();}catch(e){}}}
function _hkVoiceUi(){if(typeof updateVoiceControlsInPlayer==='function'){try{updateVoiceControlsInPlayer();}catch(e){}}}
// Медиадействия: вне комнаты (нет плеера) — тихая нет-операция
function _hkMediaAction(a){console.log('[pause] хоткей → '+a);
if(a==='playpause'&&typeof togglePlay==='function')togglePlay();
else if(a==='next'&&typeof playNextTrack==='function')playNextTrack();
else if(a==='prev'&&typeof playPrevTrack==='function')playPrevTrack();
}

// ===== Диспетчер клавиш =====
document.addEventListener('keydown',e=>{
if(_hkCapturing){_hkCaptureKey(e);return;}
if(_hkEditable(e.target))return;
// Esc закрывает модалку (пока не идёт захват — там Esc отменяет захват)
if(e.code==='Escape'){const m=document.getElementById('hotkeys-modal');if(m&&m.style.display==='flex'){closeHotkeysModal();return;}}
if(_hkGlobalActive)return; // главный процесс сам слышит эту клавишу поверх всех окон
if(e.repeat)return;
const cfg=hkLoad();
if(cfg.ptt.enabled&&comboMatches(cfg.ptt.combo,e)){
e.preventDefault();
if(!pttHeld){pttHeld=true;_hkMicGate();_hkVoiceUi();}
return;
}
if(comboMatches(cfg.mute.combo,e)){
e.preventDefault();
if(_hkVoiceOk()&&typeof toggleMic==='function')toggleMic();
return;
}
if(comboMatches(cfg.deafen.combo,e)){
e.preventDefault();
if(_hkVoiceOk()&&typeof toggleDeafen==='function')toggleDeafen();
return;
}
if(comboMatches(cfg.playpause.combo,e)){e.preventDefault();_hkMediaAction('playpause');return;}
if(comboMatches(cfg.next.combo,e)){e.preventDefault();_hkMediaAction('next');return;}
if(comboMatches(cfg.prev.combo,e)){e.preventDefault();_hkMediaAction('prev');return;}
});
// Отпускание PTT: сверяемся только по code — иначе можно "зависнуть",
// если модификатор отпустили раньше основной клавиши.
document.addEventListener('keyup',e=>{
if(_hkCapturing||!pttHeld)return;
if(hkLoad().ptt.enabled&&e.code===hkLoad().ptt.combo.code){
pttHeld=false;_hkMicGate();_hkVoiceUi();
}
});
// Потеря фокуса окна: keyup не придёт — сбрасываем PTT, чтобы не "зависнуть" в режиме говорения.
window.addEventListener('blur',()=>{if(pttHeld){pttHeld=false;_hkMicGate();_hkVoiceUi();}});

// ===== Кнопки мыши «назад»/«вперёд» (XButton1/XButton2) =====
// Гасим их навигацию по истории (Chromium) — вместо этого кнопки работают как хоткеи:
// на кнопку «назад» можно повесить PTT (как просил пользователь), мьют или глушение.
document.addEventListener('mousedown',e=>{if(e.button!==3&&e.button!==4)return;e.preventDefault();_hkMouseButton(e,'down');},true);
document.addEventListener('mouseup',e=>{if(e.button!==3&&e.button!==4)return;e.preventDefault();_hkMouseButton(e,'up');},true);
document.addEventListener('auxclick',e=>{if(e.button===3||e.button===4)e.preventDefault();},true);
function _hkMouseButton(e,type){
const code=e.button===3?'XButton1':'XButton2';
if(_hkCapturing){
if(type==='down')_hkSaveCombo(_hkCapturing,comboFromEvent({code:code,ctrlKey:e.ctrlKey,altKey:e.altKey,shiftKey:e.shiftKey}));
return;
}
if(_hkGlobalActive)return; // глобальный опрос видит и мышь тоже
const ev={code:code,ctrlKey:e.ctrlKey,altKey:e.altKey,shiftKey:e.shiftKey};
const cfg=hkLoad();
if(type==='down'){
if(cfg.ptt.enabled&&comboMatches(cfg.ptt.combo,ev)){if(!pttHeld){pttHeld=true;_hkMicGate();_hkVoiceUi();}return;}
if(comboMatches(cfg.mute.combo,ev)){if(_hkVoiceOk()&&typeof toggleMic==='function')toggleMic();return;}
if(comboMatches(cfg.deafen.combo,ev)){if(_hkVoiceOk()&&typeof toggleDeafen==='function')toggleDeafen();return;}
if(comboMatches(cfg.playpause.combo,ev)){_hkMediaAction('playpause');return;}
if(comboMatches(cfg.next.combo,ev)){_hkMediaAction('next');return;}
if(comboMatches(cfg.prev.combo,ev)){_hkMediaAction('prev');return;}
}else if(pttHeld&&code===cfg.ptt.combo.code){pttHeld=false;_hkMicGate();_hkVoiceUi();}
}

// ===== Захват клавиши/кнопки мыши =====
function hkStartCapture(action){
_hkCapturing=action;
pttHeld=false;_hkMicGate();_hkVoiceUi(); // PTT замолчит на время захвата — иначе keyup не придёт и микрофон «зависнет» открытым
_hkGlobalPause(true); // иначе глобальный опрос сработает прямо в момент назначения
renderHotkeysModal();
}
function _hkEndCapture(){
_hkCapturing=null;
pttHeld=false;_hkMicGate();_hkVoiceUi(); // вдруг PTT был зажат в момент захвата
_hkGlobalPause(false);
renderHotkeysModal();
}
function _hkSaveCombo(action,combo){
let other=null;
HK_ACTIONS.forEach(a=>{if(a!==action&&comboEquals(hkCombo(a),combo))other=a;});
if(other){showToast(translate('hk_conflict',{action:translate('hk_name_'+other)}),true);_hkEndCapture();return;}
hkLoad()[action].combo=combo;hkSave();
if(action==='ptt'){pttHeld=false;_hkMicGate();}
showToast(translate('hk_saved')+': '+comboLabel(combo));
_hkEndCapture();
hkSyncGlobal();
}
function _hkCaptureKey(e){
e.preventDefault();e.stopPropagation();
if(e.code==='Escape'){_hkEndCapture();return;}
if(HK_MODIFIER_CODES.indexOf(e.code)>=0)return; // ждём основную клавишу, а не модификатор
const action=_hkCapturing;if(!action)return;
_hkSaveCombo(action,comboFromEvent(e));
}
function _hkGlobalPause(p){
if(window.electronAPI&&window.electronAPI.hkGlobalPause){try{window.electronAPI.hkGlobalPause(!!p);}catch(e){}}
}
function hkSetPtt(on){
hkLoad().ptt.enabled=!!on;hkSave();
pttHeld=false;_hkMicGate();_hkVoiceUi();
renderHotkeysModal();
hkSyncGlobal();
}
function hkResetDefaults(){
if(_hkCapturing)_hkEndCapture(); // иначе глобальный опрос останется на паузе
_hkCfg=JSON.parse(JSON.stringify(HK_DEFAULTS));hkSave();
pttHeld=false;_hkMicGate();_hkVoiceUi();
renderHotkeysModal();
showToast(translate('hk_reset_done'));
hkSyncGlobal();
}

// ===== Модалка (создаётся динамически — работает и на start.html, и в комнате) =====
// Стили инжектятся своим <style>: классы .primary/.secondary у страниц разные
// (в start.css button.primary имеет width:100%, в комнате его нет вовсе) —
// модалка обязана выглядеть одинаково везде, поэтому оформлена своими классами hk-*.
const HK_MODAL_CSS=[
'#hotkeys-modal{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:3500;display:none;align-items:center;justify-content:center;}',
'#hotkeys-modal .hk-box{position:relative;background:var(--card,#1e1e1e);border:1px solid var(--border,#3a3a3a);border-radius:14px;padding:24px 26px;width:480px;max-width:92vw;max-height:90vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.6);}',
'#hotkeys-modal .hk-close{position:absolute;top:12px;right:14px;background:none;border:none;color:#888;font-size:16px;cursor:pointer;padding:4px;line-height:1;}',
'#hotkeys-modal .hk-close:hover{color:#fff;}',
'#hotkeys-modal .hk-title{margin:0 0 8px;font-size:19px;color:var(--accent,#1db954);}',
'#hotkeys-modal .hk-hint{font-size:11.5px;color:#9a9a9a;line-height:1.55;margin-bottom:14px;background:#242424;border:1px solid var(--border,#333);border-radius:8px;padding:9px 11px;}',
'#hotkeys-modal .hk-row{display:flex;align-items:center;gap:12px;padding:11px 13px;background:var(--input-bg,#2a2a2a);border:1px solid var(--border,#333);border-radius:10px;margin-bottom:10px;}',
'#hotkeys-modal .hk-ico{font-size:18px;line-height:1;width:22px;text-align:center;flex-shrink:0;}',
'#hotkeys-modal .hk-label{flex:1;min-width:0;}',
'#hotkeys-modal .hk-name{font-size:13px;color:#eee;font-weight:600;}',
'#hotkeys-modal .hk-check{display:flex;align-items:center;gap:7px;font-size:12px;color:#9a9a9a;cursor:pointer;margin-top:7px;}',
'#hotkeys-modal .hk-key{min-width:112px;box-sizing:border-box;padding:8px 10px;background:#2a2a2a;border:1px solid #3a3a3a;border-bottom:2px solid #141414;border-radius:7px;color:#eee;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:border-color .15s,color .15s,opacity .15s;font-family:inherit;}',
'#hotkeys-modal .hk-key:hover{border-color:var(--accent,#1db954);color:var(--accent,#1db954);}',
'#hotkeys-modal .hk-key.capturing{border-color:var(--accent,#1db954);border-bottom-color:var(--accent,#1db954);color:var(--accent,#1db954);opacity:.85;animation:hkPulse 1.1s ease-in-out infinite;}',
'@keyframes hkPulse{0%,100%{box-shadow:0 0 0 0 rgba(29,185,84,.5);}50%{box-shadow:0 0 0 5px rgba(29,185,84,0);}}',
'#hotkeys-modal .hk-status{display:none;text-align:center;font-size:12.5px;font-weight:700;color:var(--accent,#1db954);min-height:17px;margin-top:2px;}',
'#hotkeys-modal .hk-status.on{display:block;animation:hkBlink 1.1s ease-in-out infinite;}',
'@keyframes hkBlink{0%,100%{opacity:1;}50%{opacity:.55;}}',
'#hotkeys-modal .hk-foot{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:16px;}',
'#hotkeys-modal .hk-reset{padding:9px 16px;border-radius:8px;border:none;background:#333;color:var(--sub,#b3b3b3);font-weight:700;font-size:12.5px;cursor:pointer;transition:.15s;font-family:inherit;}',
'#hotkeys-modal .hk-reset:hover{background:#444;color:#fff;}',
'#hotkeys-modal .hk-done{padding:9px 24px;border-radius:8px;border:none;background:var(--accent,#1db954);color:#000;font-weight:700;font-size:13px;cursor:pointer;transition:.15s;font-family:inherit;}',
'#hotkeys-modal .hk-done:hover{filter:brightness(1.1);}'
].join('\n');
function _hkRow(icon,label,action,extra){
return '<div class="hk-row">'
+'<span class="hk-ico">'+icon+'</span>'
+'<div class="hk-label"><div class="hk-name">'+label+'</div>'+(extra||'')+'</div>'
+'<button id="hk-btn-'+action+'" class="hk-key" onclick="hkStartCapture(\''+action+'\')" title="'+translate('hk_press_key')+'"></button>'
+'</div>';
}
function renderHotkeysModal(){
const box=document.getElementById('hk-rows');
if(!box)return;
box.innerHTML=
_hkRow('🎙',translate('hk_ptt_row'),'ptt','<label class="hk-check"><input type="checkbox" id="hk-ptt-check" onchange="hkSetPtt(this.checked)">'+translate('hk_ptt_check')+'</label>')
+_hkRow('🔇',translate('hk_mute_row'),'mute')
+_hkRow('🎧',translate('hk_deafen_row'),'deafen')
+_hkRow('⏯️',translate('hk_playpause_row'),'playpause')
+_hkRow('⏭️',translate('hk_next_row'),'next')
+_hkRow('⏮️',translate('hk_prev_row'),'prev');
HK_ACTIONS.forEach(a=>{
const b=document.getElementById('hk-btn-'+a);
if(!b)return;
b.textContent=comboLabel(hkCombo(a)); // текст не меняется при захвате — вёрстка не прыгает
b.classList.toggle('capturing',_hkCapturing===a);
});
const cb=document.getElementById('hk-ptt-check');
if(cb)cb.checked=hkLoad().ptt.enabled;
// Строка-подсказка при захвате: что делать и как отменить
const st=document.getElementById('hk-status');
if(st){const on=!!_hkCapturing;st.classList.toggle('on',on);st.textContent=on?(translate('hk_press_key')+' · '+translate('hk_esc_cancel')):'';}
}
function ensureHotkeysModal(){
let m=document.getElementById('hotkeys-modal');
if(m)return m;
if(!document.getElementById('hk-style')){const s=document.createElement('style');s.id='hk-style';s.textContent=HK_MODAL_CSS;document.head.appendChild(s);}
m=document.createElement('div');
m.id='hotkeys-modal';
m.innerHTML='<div class="hk-box">'
+'<button class="hk-close" onclick="closeHotkeysModal()" title="'+translate('btn_cancel')+'">✕</button>'
+'<h2 class="hk-title">'+translate('settings_hotkeys')+'</h2>'
+'<div class="hk-hint">'+translate('hk_hint')+'</div>'
+'<div id="hk-rows"></div>'
+'<div class="hk-status" id="hk-status"></div>'
+'<div class="hk-foot">'
+'<button class="hk-reset" onclick="hkResetDefaults()">'+translate('hk_reset')+'</button>'
+'<button class="hk-done" onclick="closeHotkeysModal()">'+translate('hk_done')+'</button>'
+'</div></div>';
document.body.appendChild(m);
m.addEventListener('click',e=>{if(e.target===m)closeHotkeysModal();});
renderHotkeysModal();
return m;
}
function openHotkeysModal(){ensureHotkeysModal();renderHotkeysModal();document.getElementById('hotkeys-modal').style.display='flex';}
function closeHotkeysModal(){
const m=document.getElementById('hotkeys-modal');
if(m)m.style.display='none';
if(_hkCapturing)_hkEndCapture(); // иначе глобальный опрос останется на паузе
if(typeof shInterceptClose==='function'&&shInterceptClose())return; // «Готово/✕» из вкладки хаба — закрыть хаб
}

// ===== Глобальный режим (Electron: главный процесс опрашивает клавиши через koffi/Win32) =====
function hkSyncGlobal(){
if(!(window.electronAPI&&window.electronAPI.hkGlobalSet))return; // браузер/старые версии — локальный режим
const cfg=hkLoad();
const m={ptt:{combo:cfg.ptt.combo,enabled:!!cfg.ptt.enabled},mute:{combo:cfg.mute.combo},deafen:{combo:cfg.deafen.combo},playpause:{combo:cfg.playpause.combo},next:{combo:cfg.next.combo},prev:{combo:cfg.prev.combo}};
Promise.resolve(window.electronAPI.hkGlobalSet(m)).then(r=>{_hkGlobalActive=!!(r&&r.ok);}).catch(()=>{_hkGlobalActive=false;});
}
function _hkGlobalEvent(d){
if(!d||!d.action)return;
if(d.type==='up'){
if(d.action==='ptt'){pttHeld=false;_hkMicGate();_hkVoiceUi();}
return;
}
// down: если окно в фокусе и мы сами печатаем в поле ввода — не мешаем печати
if(typeof document!=='undefined'&&document.hasFocus&&document.hasFocus()&&_hkEditable(document.activeElement))return;
if(d.action==='ptt'){if(!pttHeld){pttHeld=true;_hkMicGate();_hkVoiceUi();}return;}
if(d.action==='mute'){if(_hkVoiceOk()&&typeof toggleMic==='function')toggleMic();return;}
if(d.action==='deafen'){if(_hkVoiceOk()&&typeof toggleDeafen==='function')toggleDeafen();return;}
if(d.action==='playpause'||d.action==='next'||d.action==='prev'){_hkMediaAction(d.action);return;}
}
if(window.electronAPI&&window.electronAPI.onHkGlobal)window.electronAPI.onHkGlobal(_hkGlobalEvent);
hkSyncGlobal();
