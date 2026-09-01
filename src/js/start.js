// ===== ЛОГИКА СТАРТОВОЙ СТРАНИЦЫ =====
(function(){
const nickInput=document.getElementById('nickname');
const codeInput=document.getElementById('room-code');

// Ник запоминается на устройстве
const savedNick=localStorage.getItem('mp_nickname')||'';
if(savedNick)nickInput.value=savedNick;
try{
const params=new URLSearchParams(window.location.search);
const urlNick=(params.get('nick')||'').trim();
if(urlNick){nickInput.value=urlNick;localStorage.setItem('mp_nickname',urlNick);}
}catch(e){}
function saveNick(){const n=nickInput.value.trim();if(n)localStorage.setItem('mp_nickname',n);return n;}
function showStatus(m,isErr){const el=document.getElementById('status');if(!el)return;el.textContent=m;el.className='status '+(isErr?'error':'ok');}
window.showStatus=showStatus;

// ✅ ОДНА кнопка создания: в Electron сама запускает сервер
window.createRoom=function(){
const n=saveNick();
if(!n)return showAlert('⚠️',translate('err_title'),translate('nickname_ph'));
nickAC.addToHistory(n);
if(window.electronAPI){
showStatus('⏳ Запуск сервера...',false);
window.electronAPI.startServerAndCreate(n).then(function(r){if(r&&!r.success)showStatus('Ошибка: '+(r.error||'неизвестная'),true);});
}else{
window.location.href='/room?mode=create&nick='+encodeURIComponent(n);
}
};

// Веб-вход по коду (вне приложения)
window.joinRoom=function(){
const n=saveNick();
const c=codeInput.value.trim().toUpperCase();
if(!n)return showAlert('⚠️',translate('err_title'),translate('nickname_ph'));
if(!c)return showAlert('⚠️',translate('err_title'),translate('room_code_ph'));
nickAC.addToHistory(n);
window.location.href='/room?mode=join&code='+encodeURIComponent(c)+'&nick='+encodeURIComponent(n);
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
el.onclick=function(){const n=saveNick();window.electronAPI.connectToServer({ip:item.ip,port:item.port,https:item.https,roomCode:String(item.room.code),nick:n});};
list.appendChild(el);
});
}
window.electronAPI.onServersFound(function(ls){found=ls||[];renderList();});

// Прямое подключение: ОДНО поле IP:код (как в майне)
window.connectManual=function(){
const v=document.getElementById('manual-addr').value.trim();
const parts=v.split(':');
const ip=(parts[0]||'').trim();
const second=(parts[1]||'').trim();
if(!ip||!second){showStatus(translate('enter_ip'),true);return;}
let port=3001,roomCode='';
if(/^\d{5}$/.test(second)){roomCode=second;}else{port=parseInt(second,10)||3001;}
const n=saveNick();
window.electronAPI.connectToServer({ip:ip,port:port,https:document.getElementById('manual-https').checked,roomCode:roomCode,nick:n});
};
}

const nickAC=new CustomAutocomplete('nickname','ac-nick-list','ac-nick-wrapper','syncmusic_nick_history');
applyTranslations();
})();
// ===== ВЫБОР ПАПКИ С МУЗЫКОЙ =====
async function loadMusicDir() {
    try {
        const r = await fetch('/api/music-dir');
        const d = await r.json();
        const inp = document.getElementById('music-dir-input');
        if (inp && d.dir) inp.value = d.dir;
    } catch (e) {}
}

async function pickMusicDir() {
    if (!window.electronAPI || !window.electronAPI.selectFolder) {
        showToast('Выбор папки доступен только в приложении', true);
        return;
    }
    const dir = await window.electronAPI.selectFolder();
    if (!dir) return;
    try {
        const r = await fetch('/api/music-dir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir }) });
        const d = await r.json();
        if (d.success) {
            document.getElementById('music-dir-input').value = d.dir;
            showToast('📁 Папка изменена');
        } else showToast(d.error || 'Ошибка', true);
    } catch (e) { showToast('Ошибка сохранения', true); }
}

// Загружаем текущую папку при открытии настроек
const origOpenSettings = window.openSettings;
window.openSettings = function() {
    origOpenSettings();
    loadMusicDir();
};