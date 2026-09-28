// ===== ЛОГИКА СТАРТОВОЙ СТРАНИЦЫ =====
(function(){
const nickInput=document.getElementById('nickname');
const codeInput=document.getElementById('room-code');

const savedNick=localStorage.getItem('mp_nickname')||'';
if(savedNick)nickInput.value=savedNick;
try{
const params=new URLSearchParams(window.location.search);
const urlNick=(params.get('nick')||'').trim();
if(urlNick){nickInput.value=urlNick;localStorage.setItem('mp_nickname',urlNick);}
}catch(e){}
function saveNick(){const n=nickInput.value.trim();if(n)localStorage.setItem('mp_nickname',n);return n;}
function currentLang(){return localStorage.getItem('syncmusic_lang')||'ru';}
function showStatus(m,isErr){const el=document.getElementById('status');if(!el)return;el.textContent=m;el.className='status '+(isErr?'error':'ok');}
window.showStatus=showStatus;

// ✅ Создание комнаты (Electron + язык)
async function netOk(){
if(!navigator.onLine)return false;
try{const c=new AbortController();const t=setTimeout(()=>c.abort(),2000);
await fetch('https://api.deezer.com/search?q=test&limit=1',{mode:'no-cors',signal:c.signal});clearTimeout(t);return true;}
catch(e){return false;}
}
function offerOfflineDialog(n){
const ov=document.createElement('div');ov.id='offline-offer';
ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:5000;display:flex;align-items:center;justify-content:center;';
ov.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:26px;max-width:440px;width:92%;position:relative;box-shadow:0 12px 40px rgba(0,0,0,.6);text-align:left;">
<button id="oo-x" style="position:absolute;top:12px;right:14px;background:none;border:none;color:#888;font-size:18px;cursor:pointer;">✕</button>
<div style="font-size:20px;font-weight:bold;margin-bottom:10px;">📡 Нет соединения</div>
<div style="color:var(--sub);font-size:13px;line-height:1.55;margin-bottom:18px;">Похоже, интернета нет. Можно создать <b>локальную комнату</b>: в ней не будет 30‑секундных превью Deezer, обложек из интернета и url‑песен, и к ней не смогут присоединиться друзья по коду. Локальные файлы из твоей папки будут работать.</div>
<div style="display:flex;flex-direction:column;gap:8px;">
<button id="oo-local" class="primary" style="width:100%;padding:12px;">Создать локальную комнату</button>
<button id="oo-retry" class="secondary" style="width:100%;padding:12px;">Попробовать ещё раз</button>
</div></div>`;
document.body.appendChild(ov);
const close=()=>ov.remove();
document.getElementById('oo-x').onclick=close;
document.getElementById('oo-retry').onclick=()=>{close();createRoom();};
document.getElementById('oo-local').onclick=()=>{close();showStatus('Создаю локальную комнату…',false);window.electronAPI.startServerAndCreate(n,currentLang(),true).then(r=>{if(r&&!r.success)showStatus('Ошибка: '+(r.error||'неизвестная'),true);});};
}
window.createRoom=function(){
    const n=saveNick();
    if(!n)return showAlert('⚠️',translate('err_title'),translate('nickname_ph'));
    nickAC.addToHistory(n);
    if(window.electronAPI){
        if(navigator.onLine===false){offerOfflineDialog(n);return;}
        showStatus(translate('connecting'),false);
        window.electronAPI.startServerAndCreate(n,currentLang(),false).then(function(r){
            if(r&&!r.success)showStatus('Ошибка: '+(r.error||'неизвестная'),true);
        });
        netOk().then(ok=>{if(!ok)showToast(translate('no_internet_toast'),true);}).catch(()=>{});
    }else{
        window.location.href='/room?mode=create&nick='+encodeURIComponent(n)+'&lang='+encodeURIComponent(currentLang());
    }
};

// Веб-вход по коду (вне приложения)
window.joinRoom=function(){
const n=saveNick();
const c=codeInput.value.trim().toUpperCase();
if(!n)return showAlert('⚠️',translate('err_title'),translate('nickname_ph'));
if(!c)return showAlert('⚠️',translate('err_title'),translate('room_code_ph'));
nickAC.addToHistory(n);
window.location.href='/room?mode=join&code='+encodeURIComponent(c)+'&nick='+encodeURIComponent(n)+'&lang='+encodeURIComponent(currentLang());
};
nickInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();createRoom();}});
codeInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();joinRoom();}});

// ===== ELECTRON: как в майне =====
const elSection=document.getElementById('electron-section');
if(window.electronAPI&&elSection){
elSection.classList.add('visible');
const wj=document.getElementById('web-join');if(wj)wj.style.display='none';
const list=document.getElementById('server-list');
let found=[];
function renderList(){
list.innerHTML='';
const flat=[];
found.forEach(function(s){(s.rooms||[]).forEach(function(r){flat.push({ip:s.ip,port:s.port,https:s.https,room:r});});});
if(!flat.length){list.innerHTML='<div class="empty-state">'+escapeHtml(translate('no_servers'))+'</div>';return;}
flat.forEach(function(item){
const el=document.createElement('div');el.className='server-item';
el.innerHTML='<div class="server-info"><div class="server-status"></div><div><div class="server-name">'+escapeHtml(item.room.name)+' • '+escapeHtml(String(item.room.code))+'</div><div class="server-ip">'+escapeHtml(item.ip+':'+item.port)+' • '+escapeHtml(String(item.room.users||0))+' чел.</div></div></div><span>→</span>';
el.onclick=function(){const n=saveNick();window.electronAPI.connectToServer({ip:item.ip,port:item.port,https:item.https,roomCode:String(item.room.code),nick:n,lang:currentLang()});};
list.appendChild(el);
});
}
window.electronAPI.onServersFound(function(ls){found=ls||[];renderList();});

// Прямое подключение
window.connectManual=function(){
const v=document.getElementById('manual-addr').value.trim();
const parts=v.split(':');
const ip=(parts[0]||'').trim();
const second=(parts[1]||'').trim();
if(!ip||!second){showStatus(translate('enter_ip'),true);return;}
let port=3001,roomCode='';
if(/^\d{5}$/.test(second)){roomCode=second;}else{port=parseInt(second,10)||3001;}
const n=saveNick();
window.electronAPI.connectToServer({ip:ip,port:port,https:document.getElementById('manual-https').checked,roomCode:roomCode,nick:n,lang:currentLang()});
};
}

const nickAC=new CustomAutocomplete('nickname','ac-nick-list','ac-nick-wrapper','syncmusic_nick_history');
applyTranslations();
})();
// ===== ВЫБОР ПАПКИ С МУЗЫКОЙ =====
async function loadMusicDir() {
    try {
        let dir = '';
        if (window.electronAPI && window.electronAPI.getMusicDir) dir = await window.electronAPI.getMusicDir();
        else { const r = await fetch('/api/music-dir'); dir = (await r.json()).dir || ''; }
        const inp = document.getElementById('music-dir-input');
        if (inp && dir) inp.value = dir;
    } catch (e) {}
}

async function pickMusicDir() {
    if (!window.electronAPI || !window.electronAPI.selectFolder) { showToast('Выбор папки доступен только в приложении', true); return; }
    const dir = await window.electronAPI.selectFolder();
    if (!dir) return;
    try {
        let ok = false;
        if (window.electronAPI.setMusicDir) { const r = await window.electronAPI.setMusicDir(dir); ok = !!(r && r.success); }
        else { const r = await fetch('/api/music-dir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir }) }); ok = (await r.json()).success; }
        if (ok) { document.getElementById('music-dir-input').value = dir; showToast('📁 Папка сохранена'); }
        else showToast('Ошибка сохранения', true);
    } catch (e) { showToast('Ошибка сохранения', true); }
}

const origOpenSettings = window.openSettings;
window.openSettings = function() {
    origOpenSettings();
    loadMusicDir();
};