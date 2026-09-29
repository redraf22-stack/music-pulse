// ===== ЛИЧНЫЕ ПЛЕЙЛИСТЫ =====
const PERSONAL_PLAYLISTS_KEY='mp_personal_playlists';
let PL_MEMORY=null;
function plNormalize(pls){
if(!Array.isArray(pls))pls=[];
if(!pls.find(p=>p.classic))pls.unshift({id:'personal-classic',name:'Все песни',tracks:[],classic:true,autoShare:true});
pls.forEach(p=>{if(p.classic)p.name='Все песни';});
return pls;
}
async function plStoreInit(){
if(PL_MEMORY)return PL_MEMORY;
let ipc=null;
if(window.electronAPI&&window.electronAPI.getPersonalPlaylists){try{ipc=await window.electronAPI.getPersonalPlaylists();}catch(e){}}
let local=null;try{local=JSON.parse(localStorage.getItem(PERSONAL_PLAYLISTS_KEY));}catch(e){}
let pls;
if(Array.isArray(ipc)){pls=plNormalize(ipc);}
else{pls=plNormalize(local||[]);}
PL_MEMORY=pls;
plPersist();
return PL_MEMORY;
}
function plPersist(){
try{localStorage.setItem(PERSONAL_PLAYLISTS_KEY,JSON.stringify(PL_MEMORY));}catch(e){}
if(window.electronAPI&&window.electronAPI.setPersonalPlaylists)window.electronAPI.setPersonalPlaylists(PL_MEMORY);
}
function getPersonalPlaylists(){
if(!PL_MEMORY){try{PL_MEMORY=plNormalize(JSON.parse(localStorage.getItem(PERSONAL_PLAYLISTS_KEY)));}catch(e){PL_MEMORY=plNormalize([]);}}
return PL_MEMORY;
}
function savePersonalPlaylists(pls){PL_MEMORY=plNormalize(pls);plPersist();return true;}
function getTrackKey(t){
if(t.type==='url')return 'url|'+(t.id||t.url);
if(t.type==='shared')return 'shared|'+(t.file||t.title);
return 'local|'+(t.filename||t.title);
}
function createPersonalPlaylist(name,tracks){
const pls=getPersonalPlaylists();
const pl={id:'personal-'+Date.now().toString(36)+Math.random().toString(36).substr(2,4),name:name||'Новый плейлист',tracks:tracks||[],classic:false};
pls.push(pl);savePersonalPlaylists(pls);return pl;
}
function deletePersonalPlaylist(id){const pls=getPersonalPlaylists();savePersonalPlaylists(pls.filter(p=>p.id!==id));}
function updatePersonalPlaylist(id,name,tracks){const pls=getPersonalPlaylists();const pl=pls.find(p=>p.id===id);if(!pl||pl.classic)return false;pl.name=name;pl.tracks=tracks;savePersonalPlaylists(pls);return true;}

// ===== UI =====
let plDraft=null;
let plAllTracks=[];
let plEditorMode='create';

async function openPersonalPlaylistsManager(){
const m=document.getElementById('personal-playlists-manager-modal');if(!m)return;
m.classList.add('open');
await plStoreInit();
renderPersonalPlaylistsList();
}
function closePersonalPlaylistsManager(){const m=document.getElementById('personal-playlists-manager-modal');if(m)m.classList.remove('open');}
function renderPersonalPlaylistsList(){
const list=document.getElementById('personal-playlists-list');if(!list)return;
list.innerHTML='';
getPersonalPlaylists().forEach(pl=>{
const row=document.createElement('div');row.className='pl-user-row';row.style.cursor='pointer';
const nm=document.createElement('span');nm.style.flex='1';nm.textContent=pl.name;row.appendChild(nm);
const cnt=document.createElement('span');cnt.style.color='var(--sub)';cnt.style.fontSize='11px';cnt.textContent=(pl.classic?'все треки':pl.tracks.length+' треков')+(pl.autoShare!==false?' 📤 в комнате':'');row.appendChild(cnt);
row.ondblclick=()=>openPersonalPlaylistEditor(pl.id);
list.appendChild(row);
});
}
async function loadAllMyTracks(){
const out=[];const seen=new Set();
try{
const list=await window.loadMyTracks(typeof currentRoomCode!=='undefined'?currentRoomCode:'');
const base=await plBase();
list.forEach(t=>{
const key=getTrackKey(t);if(seen.has(key))return;seen.add(key);
out.push({
type:t.type||'local',
id:t.id||'',
filename:t.filename||'',
file:t.file||'',
url:t.url||'',
title:t.title,
artist:(t.artist&&t.artist.name)||t.artist||'',
cover:plAbsCover(t.cover,base)
});
});
}catch(e){console.error('[loadAllMyTracks]',e);}
return out;
}
async function openPersonalPlaylistEditor(id){
await plStoreInit();
plEditorMode=id?'edit':'create';
const pls=getPersonalPlaylists();
const src=id?pls.find(p=>p.id===id):null;
plDraft=src?{id:src.id,name:src.name,classic:!!src.classic,tracks:(src.tracks||[]).map(t=>Object.assign({},t))}:{id:'',name:'',classic:false,tracks:[]};
const m=document.getElementById('personal-playlist-editor-modal');if(!m)return;
m.classList.add('open');
const allL=document.getElementById('personal-pl-all-tracks');if(allL)allL.innerHTML='<div style="color:var(--sub);font-size:12px;padding:10px;text-align:center;">Загрузка треков...</div>';
const selL=document.getElementById('personal-pl-selected-tracks');if(selL)selL.innerHTML='';
const title=document.getElementById('personal-pl-editor-title');
if(title)title.textContent=plEditorMode==='create'?'➕ Новый плейлист':'⚙ Плейлист: '+(plDraft.name||'');
const ni=document.getElementById('personal-pl-name-input');
if(ni){ni.value=plDraft.classic?plDraft.name+' (все треки)':plDraft.name;ni.disabled=plDraft.classic;}
const ac=document.getElementById('personal-pl-autoshare');
if(ac){ac.checked=src?(src.autoShare!==false):false;}
const db=document.getElementById('personal-pl-delete-btn');
if(db)db.style.display=(plEditorMode==='edit'&&!plDraft.classic)?'inline-block':'none';
const s1=document.getElementById('personal-pl-all-search');if(s1)s1.value='';
const s2=document.getElementById('personal-pl-sel-search');if(s2)s2.value='';
plAllTracks=await loadAllMyTracks();
renderPersonalEditorColumns();
}
function closePersonalPlaylistEditor(){const m=document.getElementById('personal-playlist-editor-modal');if(m)m.classList.remove('open');plDraft=null;}

function plDraftHas(key){return plDraft.classic||plDraft.tracks.some(t=>getTrackKey(t)===key);}
function renderPersonalEditorColumns(){
if(!plDraft)return;
const allList=document.getElementById('personal-pl-all-tracks');
const selList=document.getElementById('personal-pl-selected-tracks');
if(!allList||!selList)return;
const f1=((document.getElementById('personal-pl-all-search')||{}).value||'').toLowerCase().trim();
const f2=((document.getElementById('personal-pl-sel-search')||{}).value||'').toLowerCase().trim();
allList.innerHTML='';
plAllTracks.forEach(t=>{
const title=(t.title||'Без названия');
const artist=((t.artist&&t.artist.name)||t.artist||'');
if(f1&&!(title+' '+artist).toLowerCase().includes(f1))return;
const key=getTrackKey(t);
const row=document.createElement('div');row.className='pl-user-row';
const cb=document.createElement('input');cb.type='checkbox';cb.checked=plDraftHas(key);cb.disabled=plDraft.classic;
cb.onchange=()=>{
if(plDraft.classic)return;
if(cb.checked){plDraft.tracks.push({title:title,artist:artist,cover:t.cover||'',filename:t.filename||'',url:t.url||'',file:t.file||'',id:t.id||'',type:t.type||'local'});}
else{plDraft.tracks=plDraft.tracks.filter(x=>getTrackKey(x)!==key);}
renderPersonalEditorColumns();
};
row.appendChild(cb);
const nm=document.createElement('span');nm.style.flex='1';nm.textContent=title+(artist?' — '+artist:'');row.appendChild(nm);
allList.appendChild(row);
});
if(!allList.children.length)allList.innerHTML='<div style="color:var(--sub);font-size:12px;padding:10px;text-align:center;">'+(plAllTracks.length?'Ничего не найдено':'У тебя пока нет треков — добавь через ➕ в комнате')+'</div>';
selList.innerHTML='';
const selTracks=plDraft.classic?plAllTracks:plDraft.tracks;
selTracks.forEach(t=>{
const title=(t.title||'Без названия');
const artist=((t.artist&&t.artist.name)||t.artist||'');
if(f2&&!(title+' '+artist).toLowerCase().includes(f2))return;
const row=document.createElement('div');row.className='pl-user-row';
const nm=document.createElement('span');nm.style.flex='1';nm.textContent=title+(artist?' — '+artist:'');row.appendChild(nm);
if(!plDraft.classic){
const del=document.createElement('button');del.className='mm-del';del.textContent='✕';del.title='Убрать';
del.onclick=()=>{plDraft.tracks=plDraft.tracks.filter(x=>getTrackKey(x)!==getTrackKey(t));renderPersonalEditorColumns();};
row.appendChild(del);
}
selList.appendChild(row);
});
if(!selList.children.length)selList.innerHTML='<div style="color:var(--sub);font-size:12px;padding:10px;text-align:center;">Пусто</div>';
}

function savePersonalPlaylistEditor(){
if(!plDraft)return;
if(plDraft.classic){closePersonalPlaylistEditor();return;}
const ni=document.getElementById('personal-pl-name-input');
const name=(ni&&ni.value.trim())||'Новый плейлист';
if(plEditorMode==='create')createPersonalPlaylist(name,plDraft.tracks);
else updatePersonalPlaylist(plDraft.id,name,plDraft.tracks);
closePersonalPlaylistEditor();
renderPersonalPlaylistsList();
if(typeof showToast==='function')showToast('💾 Сохранено');
}
function deleteCurrentPersonalPlaylist(){
if(!plDraft||plDraft.classic)return;
const id=plDraft.id;
if(typeof showConfirm==='function'){
showConfirm('🗑','Удалить плейлист?','Плейлист будет удалён безвозвратно.',()=>{deletePersonalPlaylist(id);closePersonalPlaylistEditor();renderPersonalPlaylistsList();if(typeof plRoomSync==='function')plRoomSync();});
}else{deletePersonalPlaylist(id);closePersonalPlaylistEditor();renderPersonalPlaylistsList();if(typeof plRoomSync==='function')plRoomSync();}
}
// ===== АВТО-ШАРИНГ И ПЕРЕДАЧА В КОМНАТУ =====
async function getLocalShareList(){
const now=Date.now();
if(window._plLocalCache&&now-window._plLocalCache.time<60000)return window._plLocalCache.list||[];
if(!(window.electronAPI&&window.electronAPI.startMusicShare))return [];
try{
const s=await window.electronAPI.startMusicShare();
if(!s||!s.ok)return [];
const r=await fetch('http://localhost:'+s.port+'/list.json');
const list=await r.json();
window._plLocalCache={time:now,list:list};
return list;
}catch(e){return [];}
}
window._shareConfirmed=window._shareConfirmed||{};
window.publishPersonalShare=async function(forceIds){
if(!(window.electronAPI&&typeof socket!=='undefined'&&socket&&socket.connected&&currentRoomCode))return;
let all=[];try{all=await getLocalShareList();}catch(e){all=[];}
let pls=[];try{pls=getPersonalPlaylists()||[];}catch(e){pls=[];}
const explicit=Array.isArray(forceIds);
const selected=explicit?pls.filter(p=>forceIds.indexOf(p.id)>=0):pls.filter(p=>p.autoShare);
if(!explicit&&!selected.length){return;}
const filesSet=new Set();const playlistsOut=[];
let allUrls=[];try{allUrls=(await window.loadMyTracks(currentRoomCode||'')).filter(t=>t.type==='url');}catch(e){}
const urlMap=new Map();
selected.forEach(p=>{
const files=p.classic?all.map(t=>t.file):(p.tracks||[]).filter(t=>t.type==='local'&&t.filename).map(t=>t.filename);
files.forEach(f=>filesSet.add(f));
const purls=p.classic?allUrls.map(t=>t.id||t.url):(p.tracks||[]).filter(t=>t.type==='url').map(t=>t.id||t.url);
purls.forEach(u=>{if(!urlMap.has(u)){const src=allUrls.find(t=>(t.id||t.url)===u);if(src)urlMap.set(u,{id:src.id||u,url:src.url||'',title:src.title,artist:(src.artist&&src.artist.name)||src.artist,cover:src.cover||'',autoCover:!src.cover});}});
playlistsOut.push({id:p.id,name:p.classic?'Все песни':p.name,classic:!!p.classic,files:files,urls:purls});
});
const tracks=all.filter(t=>filesSet.has(t.file));
const urlsOut=[...urlMap.values()];
let ip='127.0.0.1';try{ip=await window.electronAPI.getLanIp();}catch(e){}
socket.emit('share-music',{base:'http://'+ip+':3005',tracks:tracks,urls:urlsOut,playlists:playlistsOut});
window._shareConfirmed[currentRoomCode]=selected.map(p=>p.id);
window.iSharedMusic=true;
};
// повторная отправка ТОГО ЖЕ подтверждённого набора (для живой синхронизации после правок)
window.refreshShareIfActive=function(){
try{const c=window._shareConfirmed&&window._shareConfirmed[currentRoomCode];if(c&&c.length&&typeof window.publishPersonalShare==='function')window.publishPersonalShare(c);}catch(e){}
};
async function openShareSelectModal(requester){
await plStoreInit();
const m=document.getElementById('share-select-modal');if(!m)return;
m.classList.add('open');
const who=document.getElementById('share-select-who');if(who)who.textContent=requester||'Админ';
const list=document.getElementById('share-select-list');if(!list)return;
list.innerHTML='';
getPersonalPlaylists().forEach(p=>{
const row=document.createElement('div');row.className='pl-user-row';
const cb=document.createElement('input');cb.type='checkbox';cb.checked=p.autoShare!==false;cb.setAttribute('data-plid',p.id);
const nm=document.createElement('span');nm.style.flex='1';nm.textContent=p.classic?p.name+' (все треки)':p.name;
row.appendChild(cb);row.appendChild(nm);list.appendChild(row);
});
}
async function confirmShareSelected(){
const m=document.getElementById('share-select-modal');if(!m)return;
const ids=[].slice.call(m.querySelectorAll('input[type="checkbox"]')).filter(c=>c.checked).map(c=>c.getAttribute('data-plid'));
m.classList.remove('open');
if(!ids.length)return;
await publishPersonalShare(ids);
if(typeof showToast==='function')showToast('📤 Передано плейлистов: '+ids.length);
}
function declineShare(){const m=document.getElementById('share-select-modal');if(m)m.classList.remove('open');}
// Сохранение с учётом галки авто-шаринга (переопределяем)
function savePersonalPlaylistEditor(){
if(!plDraft)return;
const ni=document.getElementById('personal-pl-name-input');
const ac=document.getElementById('personal-pl-autoshare');
const autoShare=ac?ac.checked:(plDraft.classic?true:!!plDraft.autoShare);
const pls=getPersonalPlaylists();
if(plDraft.classic){
const pl=pls.find(p=>p.id===plDraft.id);if(pl){pl.autoShare=autoShare;savePersonalPlaylists(pls);}
closePersonalPlaylistEditor();renderPersonalPlaylistsList();if(typeof plRoomSync==='function')plRoomSync();return;
}
const name=(ni&&ni.value.trim())||'Новый плейлист';
if(plEditorMode==='create'){
const pl=createPersonalPlaylist(name,plDraft.tracks);
const pp=getPersonalPlaylists().find(x=>x.id===pl.id);if(pp){pp.autoShare=autoShare;savePersonalPlaylists(getPersonalPlaylists());}
}else{
const pl=pls.find(p=>p.id===plDraft.id);
if(pl){pl.name=name;pl.tracks=plDraft.tracks;pl.autoShare=autoShare;savePersonalPlaylists(pls);}
}
closePersonalPlaylistEditor();
renderPersonalPlaylistsList();
if(typeof showToast==='function')showToast('💾 Сохранено');
}
// ===== МОЯ МУЗЫКА / ТРЕКИ (работает и на старте, и в комнате) =====
let _srvBase = '';
async function ensureMyServer() {
    if (_srvBase) return _srvBase;
    if (window.electronAPI && window.electronAPI.ensureServer) {
        try {
            const r = await window.electronAPI.ensureServer();
            if (r && r.ok && r.port) { _srvBase = (r.isHttps ? 'https' : 'http') + '://localhost:' + r.port; return _srvBase; }
        } catch (e) { console.error('[ensureMyServer]', e); }
    }
    if (!window.location.protocol.startsWith('file:')) { _srvBase = window.location.origin; return _srvBase; }
    return '';
}
async function plBase(){ return (location.protocol==='file:') ? (await ensureMyServer()) : location.origin; }
function plAbsCover(u,base){ if(!u) return ''; if(/^(https?:|data:)/i.test(u)) return u; if(u.charAt(0)==='/') return base+u; return u; }
// Единая загрузка треков: owner = ник в комнате или поле ника на старте
window.loadMyTracks = async function (room) {
    const base = await ensureMyServer();
    if (!base) throw new Error('Сервер не запущен');
    const owner = (typeof myNickname !== 'undefined' && myNickname) ? myNickname : (((document.getElementById('nickname') || {}).value || '').trim() || 'Аноним');
    const r = await fetch(base + '/api/my-tracks?owner=' + encodeURIComponent(owner) + '&room=' + encodeURIComponent(room || ''));
    if (!r.ok) throw new Error('http ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return (d.data || []).map(t => Object.assign({}, t, { cover: plAbsCover(t.cover, base) }));
};
window.deleteMyTrackApi = async function (payload) {
    const base = await ensureMyServer();
    if (!base) throw new Error('Сервер не запущен');
    const r = await fetch(base + '/api/delete-track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error || ('http ' + r.status));
    return d;
};
if (typeof window.openMyMusic === 'undefined') {
    window.openMyMusic = async function () {
        const modal = document.getElementById('my-music-modal');
        if (!modal) return;
        modal.classList.add('open');
        const c = document.getElementById('my-music-content');
        c.innerHTML = '<div style="color:var(--sub);padding:20px;text-align:center;">Загрузка…</div>';
        const si = document.getElementById('my-music-search'); if (si) si.value = '';
        try {
            window._startMyTracks = await window.loadMyTracks('');
            renderStartMyMusic('');
        } catch (e) {
            c.innerHTML = '<div style="color:var(--sub);padding:20px;text-align:center;">Не удалось загрузить: ' + escapeHtml(e.message) + '<br><button class="ib-btn ib-now" style="margin-top:10px;" onclick="openMyMusic()">Повторить</button></div>';
        }
    };
    window.closeMyMusic = function () { const m = document.getElementById('my-music-modal'); if (m) m.remove ? null : 0; if (m) m.classList.remove('open'); };
    window.renderStartMyMusic = function (filter) {
        const c = document.getElementById('my-music-content'); if (!c) return;
        const tracks = window._startMyTracks || [];
        const f = (filter || '').toLowerCase().trim();
        const list = f ? tracks.filter(t => ((t.title || '') + ' ' + ((t.artist && t.artist.name) || t.artist || '')).toLowerCase().includes(f)) : tracks;
        if (!list.length) { c.innerHTML = '<div style="color:var(--sub);padding:20px;text-align:center;">' + (tracks.length ? 'Ничего не найдено' : 'У тебя пока нет треков.<br>Добавь их в комнате через ➕') + '</div>'; return; }
        c.innerHTML = '';
        list.forEach(t => {
            const item = document.createElement('div'); item.className = 'my-music-item';
            const img = document.createElement('img'); img.src = t.cover || ''; img.onerror = function () { this.style.background = '#333'; this.src = ''; }; item.appendChild(img);
            const info = document.createElement('div'); info.className = 'mm-info';
            const tt = document.createElement('div'); tt.className = 'mm-title'; tt.textContent = t.title || 'Без названия'; info.appendChild(tt);
            const ar = document.createElement('div'); ar.className = 'mm-artist'; ar.textContent = (t.artist && t.artist.name) || t.artist || 'Unknown Artist'; info.appendChild(ar);
            item.appendChild(info);
            const badge = document.createElement('div'); badge.className = 'mm-badge'; badge.textContent = t.type === 'url' ? '🔗 URL' : '💾 Файл'; item.appendChild(badge);
            const del = document.createElement('button'); del.className = 'mm-del'; del.textContent = '🗑'; del.title = 'Удалить';
            del.onclick = async (e) => {
                e.stopPropagation();
                if (!confirm('Удалить трек "' + (t.title || '') + '"' + (t.type === 'local' ? ' с диска?' : '?'))) return;
                try {
                    const owner = (((document.getElementById('nickname') || {}).value || '').trim()) || 'Аноним';
                    await window.deleteMyTrackApi({ type: t.type, id: t.type === 'url' ? t.id : t.filename, owner });
                    window._startMyTracks = (window._startMyTracks || []).filter(x => x !== t);
                    renderStartMyMusic((document.getElementById('my-music-search') || {}).value || '');
                    showToast('🗑 Удалено.');
                } catch (err) { showToast('Ошибка удаления: ' + err.message, true); }
            };
            item.appendChild(del);
            item.ondblclick = () => openStartEditTrack(t);
            c.appendChild(item);
        });
    };
}
// ===== СТАРТОВЫЙ РЕДАКТОР ТРЕКА (работает и на старте, и в комнате) =====
let _setTrack=null;
window.openStartEditTrack=async function(t){
_setTrack=Object.assign({},t);_setTrack._newCover='';
const m=document.getElementById('edit-track-modal');if(!m)return;
const base=await plBase();
const artistName=(t.artist&&t.artist.name)||t.artist||'';
document.getElementById('set-title-modal').textContent='⚙ '+(t.title||'Без названия');
document.getElementById('set-fields').innerHTML=`
<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">
<div style="position:relative;flex-shrink:0;">
<img id="set-cover-preview" src="${escapeHtml(plAbsCover(t.cover,base))}" width="72" height="72" style="border-radius:8px;background:#333;object-fit:cover;display:block;">
<button style="position:absolute;bottom:-8px;right:-8px;width:28px;height:28px;border-radius:50%;border:none;background:var(--accent);color:black;cursor:pointer;font-size:13px;" onclick="document.getElementById('set-cover-input').click()" title="Выбрать фото">📷</button>
<input type="file" id="set-cover-input" accept="image/*" style="display:none;" onchange="pickSetCover(event)">
</div>
<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sub);cursor:pointer;"><input type="checkbox" id="set-auto-cover"${t.autoCover?' checked':''}> Авто-обложка (по названию)</label>
</div>
<div class="url-field"><label>Название *</label><input type="text" id="set-title" value="${escapeHtml(t.title||'')}"></div>
<div class="url-field"><label>Исполнитель</label><input type="text" id="set-artist" value="${escapeHtml(artistName)}"></div>
<div class="url-field"><label>Альбом</label><input type="text" id="set-album" value="${escapeHtml(t.album||'')}"></div>
${t.type==='url'?`<div class="url-field"><label>Ссылка на трек</label><input type="text" id="set-url" value="${escapeHtml(t.url||'')}"></div>`:''}`;
m.classList.add('open');
};
window.closeStartEditTrack=function(){const m=document.getElementById('edit-track-modal');if(m)m.classList.remove('open');_setTrack=null;};
window.pickSetCover=async function(e){
const f=e.target.files[0];if(!f||!_setTrack)return;
const base=await plBase();const fd=new FormData();fd.append('file',f);
try{const r=await fetch(base+'/api/upload-chat',{method:'POST',body:fd});const d=await r.json();if(d.success){document.getElementById('set-cover-preview').src=plAbsCover(d.url,base);_setTrack._newCover=d.url;document.getElementById('set-auto-cover').checked=false;}}catch(err){showToast('Ошибка загрузки обложки',true);}
e.target.value='';
};
window.saveStartEditTrack=async function(){
if(!_setTrack)return;
const base=await plBase();
const autoChecked=document.getElementById('set-auto-cover').checked;
let coverVal,resetCover=false;
if(autoChecked){coverVal='';}
else if(_setTrack._newCover){coverVal=_setTrack._newCover;}
else if(_setTrack.cover){coverVal=_setTrack.cover;resetCover=true;}
else{coverVal='';}
const data={title:document.getElementById('set-title').value.trim()||_setTrack.title,artist:document.getElementById('set-artist').value.trim()||'Unknown Artist',album:document.getElementById('set-album').value.trim()||'',cover:coverVal,resetCover:resetCover,autoCover:autoChecked,url:(document.getElementById('set-url')?document.getElementById('set-url').value.trim():'')};
const owner=(typeof myNickname!=='undefined'&&myNickname)?myNickname:(((document.getElementById('nickname')||{}).value||'').trim()||'Аноним');
try{
const r=await fetch(base+'/api/update-track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:_setTrack.type,id:_setTrack.type==='url'?_setTrack.id:(_setTrack.type==='shared'?_setTrack.file:_setTrack.filename),owner:owner,data:data})});
const d=await r.json();
if(d.success){closeStartEditTrack();showToast('✅ Сохранено!');window._startMyTracks=await window.loadMyTracks('');renderStartMyMusic((document.getElementById('my-music-search')||{}).value||'');}
else showToast(d.error||'Ошибка',true);
}catch(e){showToast('Ошибка сохранения',true);}
};