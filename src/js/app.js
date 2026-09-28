// ===== ПРИЛОЖЕНИЕ: вход в комнату, пользователи, LAN, инициализация =====
const urlParams=new URLSearchParams(window.location.search);
const voiceUsers=new Set();
socket.on('user-joined-voice',d=>{if(d&&d.id){voiceUsers.add(d.id);if(lastUsersList)renderUsersList(lastUsersList);}});
socket.on('user-left-voice',d=>{if(d&&d.id){voiceUsers.delete(d.id);if(lastUsersList)renderUsersList(lastUsersList);}});
function backToStart(){try{if(window.electronAPI&&window.electronAPI.closeChatWindow)window.electronAPI.closeChatWindow();}catch(e){}if(window.electronAPI&&window.electronAPI.goStart){window.electronAPI.goStart(currentLang);}else{window.location.replace('/');}}
const bootMode=urlParams.get('mode');
const bootNick=(urlParams.get('nick')||'').trim();
const bootCode=(urlParams.get('code')||'').trim().toUpperCase();
let techOpen=false,voteOpen=false;
let autoRequestTracks=false;
let prefsLock=true;
function saveRoomPrefs(){if(myRole!=='admin'||prefsLock)return;try{localStorage.setItem('mp_room_prefs_'+myNickname,JSON.stringify({lanOpen:isLanOpen,voiceEnabled:voiceChatEnabled,voteCooldown:voteCooldown,voteDuration:voteDuration}));}catch(e){}}
function applyRoomPrefs(){if(myRole!=='admin')return;try{const p=JSON.parse(localStorage.getItem('mp_room_prefs_'+myNickname)||'null');if(!p)return;if(p.lanOpen&&!isLanOpen)socket.emit('toggle-lan');if(p.voiceEnabled&&!voiceChatEnabled)socket.emit('toggle-voice-chat',true);if((p.voteCooldown!==undefined&&p.voteCooldown!==voteCooldown)||(p.voteDuration!==undefined&&p.voteDuration!==voteDuration))socket.emit('update-settings',{voteCooldown:p.voteCooldown!==undefined?p.voteCooldown:voteCooldown,voteDuration:p.voteDuration!==undefined?p.voteDuration:voteDuration});}catch(e){}}
function toggleTechSettings(){techOpen=!techOpen;const b=document.getElementById('tech-settings-btn');const p=document.getElementById('tech-settings-panel');if(b)b.classList.toggle('open',techOpen);if(p)p.style.display=techOpen?'flex':'none';if(!techOpen){voteOpen=false;const vb=document.getElementById('vote-settings-btn');const vp=document.getElementById('admin-controls');if(vb)vb.classList.remove('open');if(vp)vp.style.display='none';}}
function toggleVoteSettings(){if(myRole!=='admin')return;voteOpen=!voteOpen;const b=document.getElementById('vote-settings-btn');const p=document.getElementById('admin-controls');if(b)b.classList.toggle('open',voteOpen);if(p)p.style.display=voteOpen?'block':'none';}
function toggleAutoRequest(){
autoRequestTracks=!autoRequestTracks;
const b=document.getElementById('auto-request-btn');
if(b)b.classList.toggle('active',autoRequestTracks);
localStorage.setItem('mp_auto_request',autoRequestTracks?'1':'0');
if(autoRequestTracks&&currentRoomCode){
// Сразу отправляем запросы всем
(lastUsersList||[]).forEach(u=>{
if(u.id!==mySocketId&&u.name!==myNickname){
socket.emit('request-share',u.name);
}
});
showToast('📥 Авто-запрос включён');
}else{
showToast('📥 Авто-запрос выключен');
}
}

let booted=false;
function bootstrap(){
if(bootMode==='create'&&bootNick){
myNickname=bootNick;
myNickname=bootNick;localStorage.setItem('mp_nickname',bootNick);
const bootOffline=urlParams.get('offline')==='1';
socket.emit('create-room',{nickname:bootNick,offline:bootOffline},function(d){
if(d&&d.code){history.replaceState(null,'','/room?mode=join&code='+d.code+'&nick='+encodeURIComponent(bootNick));enterRoom(d);applyRoomPrefs();}
else{showAlert('⚠️',translate('leave_room_title'),translate('boot_error'));setTimeout(backToStart,1500);}
});
}else if(bootMode==='join'&&bootNick&&bootCode){
myNickname=bootNick;
myNickname=bootNick;localStorage.setItem('mp_nickname',bootNick);
socket.emit('join-room',{code:bootCode,nickname:bootNick},function(r){
if(r.error){showAlert('⚠️',translate('leave_room_title'),r.error==='banned'?translate('banned_msg'):r.error);setTimeout(backToStart,1500);}
else enterRoom(r);
});
}else{backToStart();}
}
socket.on('connect',()=>{mySocketId=socket.id;if(!booted&&bootMode){booted=true;bootstrap();}});
function enterRoom(d){
myRole=d.role;currentRoomCode=d.code;voteCooldown=d.voteCooldown||0;voteDuration=d.voteDuration||15;voiceChatEnabled=d.voiceEnabled||false;
isLanOpen=!!d.lanOpen;updateLanButton();
prefsLock=true;setTimeout(()=>{prefsLock=false;},2000);
document.getElementById('room-code-el').innerText=d.code;
document.getElementById('sidebar').style.display='flex';
document.getElementById('player-bar').style.display='grid';
document.getElementById('queue-sidebar').style.display='flex';
document.getElementById('search-panel').style.display='block';
document.getElementById('chat-fab').style.display='flex';
if(myRole==='admin'||myRole==='mod'){
document.getElementById('cooldown-input').value=voteCooldown;
document.getElementById('vote-duration-input').value=voteDuration;
updateVoiceToggleButton();updateLanButton();
isReady=true;restorePlayerBar();
}
else{document.getElementById('admin-controls').style.display='none';if(window.electronAPI){isReady=true;restorePlayerBar();}else{showReadyButton();}startCooldownTimer();}
updateVoiceEntryButton();updateManageBtnVisibility();updateRegenBtnVisibility();updateRandomButtonVisibility();
const sv=localStorage.getItem('mp_master_volume');if(sv!==null&&typeof audio!=='undefined'){audio.volume=parseFloat(sv);}
socket.emit('get-active-streams');
socket.emit('get-playlists');
if(window.electronAPI&&typeof publishPersonalShare==='function'){setTimeout(()=>publishPersonalShare(),1500);}
// Восстанавливаем настройку автозапроса
autoRequestTracks=localStorage.getItem('mp_auto_request')==='1';
const arb=document.getElementById('auto-request-btn');
if(arb)arb.classList.toggle('active',autoRequestTracks);
// Автоматический запрос треков при входе
if(autoRequestTracks){
setTimeout(()=>{
(lastUsersList||[]).forEach(u=>{
if(u.id!==mySocketId&&u.name!==myNickname){
socket.emit('request-share',u.name);
}
});
},2000);
}
renderPlaylistBar();
}
function leaveRoom(){
const msg=myRole==='admin'?translate('leave_admin_confirm'):translate('leave_user_confirm');
showConfirm('🚪',translate('leave_room_title'),msg,function(){
try{socket.emit('leave-room');}catch(e){}
if(window.electronAPI&&window.electronAPI.closeFloatingWindows)window.electronAPI.closeFloatingWindows({});
techOpen=false;voteOpen=false;
const tp=document.getElementById('tech-settings-panel');if(tp)tp.style.display='none';
const vp=document.getElementById('admin-controls');if(vp)vp.style.display='none';
setTimeout(backToStart,100);
});
}
function toggleLan(){if(myRole!=='admin'){showToast(translate('lan_admin_only'),true);return;}socket.emit('toggle-lan');}
socket.on('lan-update',o=>{isLanOpen=!!o;updateLanButton();saveRoomPrefs();});
function updateLanButton(){const b=document.getElementById('lan-toggle-btn');if(!b)return;b.style.display='flex';b.classList.toggle('active',isLanOpen);b.textContent=isLanOpen?translate('lan_on'):translate('lan_off');}
function copyRoomCode(){if(!currentRoomCode)return;navigator.clipboard.writeText(currentRoomCode).then(()=>showToast(translate('copied')));}
function regenerateCode(){if(myRole!=='admin')return;showConfirm('🔑',translate('confirm_regen_title'),translate('confirm_regen_msg'),()=>{socket.emit('regenerate-room-code');});}
socket.on('room-code-changed',c=>{currentRoomCode=c;document.getElementById('room-code-el').innerText=c;showToast(translate('code_changed'));});
socket.on('kicked',()=>{if(window.electronAPI&&window.electronAPI.closeFloatingWindows)window.electronAPI.closeFloatingWindows({});showAlert('❌','Кик',translate('kicked_msg'));setTimeout(backToStart,2000);});
socket.on('banned',()=>{if(window.electronAPI&&window.electronAPI.closeFloatingWindows)window.electronAPI.closeFloatingWindows({});showAlert('🚫','Бан',translate('banned_msg'));setTimeout(backToStart,2000);});
socket.on('room-closed',()=>{if(window.electronAPI&&window.electronAPI.closeFloatingWindows)window.electronAPI.closeFloatingWindows({});showAlert('👋','Комната закрыта',translate('admin_left'));setTimeout(backToStart,2000);});
socket.on('disconnect',()=>{if(window.electronAPI&&window.electronAPI.closeFloatingWindows)window.electronAPI.closeFloatingWindows({});if(currentRoomCode){showAlert('👋','Связь потеряна','Хост вышел из комнаты или сервер недоступен.');setTimeout(backToStart,2500);}});
socket.on('voice-status',e=>{voiceChatEnabled=e;if(myRole==='admin')updateVoiceToggleButton();if(!e&&isInVoice)leaveVoiceChat();updateVoiceEntryButton();saveRoomPrefs();});
socket.on('voice-chat-disabled',()=>{if(isInVoice)leaveVoiceChat();voiceChatEnabled=false;updateVoiceEntryButton();});
function toggleVoiceChatSetting(){if(myRole!=='admin')return;socket.emit('toggle-voice-chat',!voiceChatEnabled);}
function updateVoiceToggleButton(){const b=document.getElementById('voice-chat-toggle');if(!b)return;b.className=voiceChatEnabled?'voice-toggle-btn on':'voice-toggle-btn off';b.innerText=voiceChatEnabled?translate('voice_on'):translate('voice_off');}
function updateVoiceEntryButton(){const b=document.getElementById('voice-entry-btn');if(!voiceChatEnabled){b.style.display='none';return;}b.style.display='flex';b.disabled=false;isLeaving=false;b.className=isInVoice?'voice-entry-btn leave':'voice-entry-btn join';b.innerHTML=isInVoice?translate('leave_voice'):translate('join_voice');}
function updateManageBtnVisibility(){
const m=document.getElementById('manage-toggle-btn');if(m)m.style.display=myRole==='admin'?'inline-block':'none';
const t=document.getElementById('tech-settings-btn');if(t)t.style.display=(myRole==='admin'||isMod)?'flex':'none';
const v=document.getElementById('vote-settings-btn');if(v)v.style.display=myRole==='admin'?'flex':'none';
}
function updateRegenBtnVisibility(){const b=document.getElementById('regen-code-btn');if(b)b.style.display=myRole==='admin'?'inline-block':'none';}
function updateRandomButtonVisibility(){const b=document.getElementById('random-toggle-btn');if(b)b.style.display=(myRole==='admin'||isMod)?'flex':'none';}
function updateForceStatusBanner(){const b=document.getElementById('force-status-banner');if(!b)return;if(forceMuted&&forceDeafened){b.className='force-status-banner muted';b.innerHTML='🎤̶ ̶ '+translate('muted_by_admin')+' & '+translate('deafened_by_admin');}else if(forceMuted){b.className='force-status-banner muted';b.innerHTML='🎤̶ '+translate('muted_by_admin');}else if(forceDeafened){b.className='force-status-banner deafened';b.innerHTML='🎧̶ '+translate('deafened_by_admin');}else{b.className='force-status-banner';b.innerHTML='';}}
function updateVoiceControlsInPlayer(){const m=document.getElementById('vc-mic'),d=document.getElementById('vc-deafen');if(m&&d){if(isInVoice){m.style.display='block';d.style.display='block';const em=isMuted||forceMuted,ed=isDeafened||forceDeafened;m.className=em?'voice-ctrl-btn muted':'voice-ctrl-btn';m.innerHTML='🎤';m.title=forceMuted?translate('muted_by_admin'):(em?translate('self_muted'):translate('mute_action'));d.className=ed?'voice-ctrl-btn deafened':'voice-ctrl-btn';d.innerHTML='🎧';d.title=forceDeafened?translate('deafened_by_admin'):(ed?translate('self_deafened'):translate('deafen_action'));}else{m.style.display='none';d.style.display='none';}}updateForceStatusBanner();}
function syncSelfVoiceState(){if(!isInVoice)return;socket.emit('self-voice-state',{muted:isMuted,deafened:isDeafened});}
function toggleManageMode(){manageMode=!manageMode;const b=document.getElementById('manage-toggle-btn');if(b){b.style.background=manageMode?'var(--danger)':'';b.style.color=manageMode?'white':'';b.style.borderColor=manageMode?'var(--danger)':'';}if(lastUsersList)renderUsersList(lastUsersList);}
function renderUsersList(users){
lastUsersList=users;const list=document.getElementById('users-list');if(!list)return;const cmv=myRole==='admin'||isMod;
users.forEach(u=>{if(u.peerId&&u.id){socketToPeer[u.id]=u.peerId;peerToSocket[u.peerId]=u.id;}});
list.innerHTML='';
users.forEach(u=>{
try{
const div=document.createElement('div');let cl=['user-item'];if(u.isAdmin)cl.push('admin');if(u.isMod)cl.push('mod');if(u.isVip)cl.push('vip');div.className=cl.join(' ');
const icon=u.isAdmin?'👑 ':u.isMod?'🛡️ ':u.isVip?'⭐ ':'';
const displayName=u.id===mySocketId?u.name+' (Вы)':u.name;
let actionsHTML='';if(manageMode&&myRole==='admin'&&!u.isAdmin){actionsHTML+=`<button class="role-btn ${u.isVip?'active-vip':''}" onclick="toggleRole('${escapeHtml(u.id)}','vip')">VIP</button><button class="role-btn ${u.isMod?'active-mod':''}" onclick="toggleRole('${escapeHtml(u.id)}','mod')">MOD</button><button class="kick-btn" onclick="kickUser('${escapeHtml(u.id)}')" title="Кикнуть">❌</button><button class="ban-btn" onclick="banUser('${escapeHtml(u.id)}')" title="Забанить">🚫</button>`;}
let vdHTML='',voiceBtns='';
if(u.voiceState&&u.voiceState.inVoice===true)voiceUsers.add(u.id);else voiceUsers.delete(u.id);
const hasVoice=voiceUsers.has(u.id)||(u.id===mySocketId&&isInVoice)||(!!u.voiceState&&u.voiceState.inVoice===true);
const hasVideo=!!(u.videoEnabled)||(!!u.voiceState&&!!u.voiceState.videoEnabled);
const hasScreen=!!(u.screenEnabled)||(!!u.voiceState&&!!u.voiceState.screenEnabled);
if(hasVoice||hasVideo||hasScreen){
const vs=u.voiceState||{selfMuted:false,selfDeafened:false,forceMuted:false,forceDeafened:false};
const clk=cmv&&!u.isAdmin&&hasVoice?'clickable':'';
const mc=vs.forceMuted?`force-btn active ${clk}`:vs.selfMuted?`force-btn self-active ${clk}`:`force-btn ${clk}`;
const dc=vs.forceDeafened?`force-btn active ${clk}`:vs.selfDeafened?`force-btn self-active ${clk}`:`force-btn ${clk}`;
const mck=cmv&&!u.isAdmin&&hasVoice?`onclick="forceVoiceAction('${escapeHtml(u.id)}','mute')"`:'';
const dck=cmv&&!u.isAdmin&&hasVoice?`onclick="forceVoiceAction('${escapeHtml(u.id)}','deafen')"`:'';
if(hasVoice){voiceBtns+=`<button class="${escapeHtml(mc)}" ${mck} title="${escapeHtml(vs.forceMuted?translate('muted_by_admin'):vs.selfMuted?translate('self_muted'):(cmv?translate('mute_action'):translate('not_muted')))}">🎤</button><button class="${escapeHtml(dc)}" ${dck} title="${escapeHtml(vs.forceDeafened?translate('deafened_by_admin'):vs.selfDeafened?translate('self_deafened'):(cmv?translate('deafen_action'):translate('not_deafened')))}">🎧</button>`;}
if(hasVoice)vdHTML+=`<div class="voice-dot" id="vdot-${escapeHtml(u.id)}"></div>`;
if(hasVideo)vdHTML+='<div class="video-dot" title="Видео включено"></div>';
if(hasScreen)vdHTML+='<div class="screen-dot" title="Экран включен"></div>';
}
div.innerHTML=`<div class="user-top-row"><span class="user-name">${escapeHtml(icon)}${escapeHtml(displayName)}</span>${vdHTML}<div class="user-actions">${actionsHTML}${voiceBtns}</div></div>`;
if(isInVoice&&u.id!==mySocketId&&hasVoice){
const pid=socketToPeer[u.id];
let sv=pid&&localVolumes[pid]!==undefined?localVolumes[pid]:undefined;
if(sv===undefined){const saved=getUserVol(u);if(saved!==undefined){sv=saved;if(pid)localVolumes[pid]=sv;}}
if(sv===undefined)sv=0.5;
const pv=Math.round(sv*200);
const row=document.createElement('div');row.className='user-volume-row';
const lbl=document.createElement('span');lbl.className='vol-label';lbl.textContent='🔊';row.appendChild(lbl);
const rng=document.createElement('input');rng.type='range';rng.className='user-vol-slider';rng.min='0';rng.max='1';rng.step='0.01';rng.value=String(sv);
const uid=u.id;
const wrap=document.createElement('div');wrap.className='volume-input-wrap';
const inp=document.createElement('input');inp.type='number';inp.className='vol-pct-input';inp.min='0';inp.max='200';inp.step='1';inp.value=pv;
inp.onchange=function(){onUserVolumeInput(uid,this,rng);};inp.onblur=function(){onUserVolumeInput(uid,this,rng);};
inp.onkeydown=function(e){if(e.key==='Enter'){onUserVolumeInput(uid,this,rng);this.blur();}else if(e.key==='ArrowUp'){e.preventDefault();spinUserVolume(uid,1,rng,this);}else if(e.key==='ArrowDown'){e.preventDefault();spinUserVolume(uid,-1,rng,this);}};
const spin=document.createElement('div');spin.className='vol-spinners';
const up=document.createElement('button');up.className='vol-spinner vol-up';up.type='button';up.textContent='▲';up.onmousedown=function(e){e.preventDefault();spinUserVolume(uid,1,rng,inp);};
const dn=document.createElement('button');dn.className='vol-spinner vol-down';dn.type='button';dn.textContent='▼';dn.onmousedown=function(e){e.preventDefault();spinUserVolume(uid,-1,rng,inp);};
spin.appendChild(up);spin.appendChild(dn);
const sign=document.createElement('span');sign.className='pct-sign';sign.textContent='%';
wrap.appendChild(inp);wrap.appendChild(spin);wrap.appendChild(sign);
rng.oninput=function(){setLocalUserVolume(uid,this.value);inp.value=Math.round(parseFloat(this.value)*200);};
row.appendChild(rng);row.appendChild(wrap);div.appendChild(row);
}
list.appendChild(div);
}catch(e){console.error('[renderUsers]',e);}
});
renderSpeakingDots();
}
socket.on('users-update',u=>renderUsersList(u));
function toggleRole(u,t){socket.emit('toggle-role',{targetSocketId:u,roleType:t});}
function forceVoiceAction(uid,action){if(myRole!=='admin'&&!isMod)return;const user=lastUsersList?.find(u=>u.id===uid);if(!user||!user.voiceState){showToast('Пользователь не в голосовом чате',true);return;}socket.emit('force-voice-action',{targetSocketId:uid,action:action});}
function kickUser(u){if(myRole!=='admin')return;showConfirm('❌',translate('confirm_kick_title'),translate('confirm_kick_msg'),()=>{socket.emit('kick-user',u);});}
function banUser(u){if(myRole!=='admin')return;showConfirm('🚫',translate('confirm_ban_title'),translate('confirm_ban_msg'),()=>{socket.emit('ban-user',u);});}
function startCooldownTimer(){if(cooldownTimerInterval)clearInterval(cooldownTimerInterval);cooldownTimerInterval=setInterval(()=>{if(searchResults.length>0)renderSearchResults();},1000);}
socket.on('role-updated',r=>{const wm=isMod;isVip=r.isVip;isMod=r.isMod;if(wm&&!isMod){currentInbox=[];renderInbox();}showToast(isVip?translate('vip_received'):isMod?translate('mod_received'):translate('roles_removed'),!isVip&&!isMod);restorePlayerBar();updateManageBtnVisibility();updateRegenBtnVisibility();updateRandomButtonVisibility();searchMusic();renderPlaylistBar();});
document.addEventListener('click',()=>{getGlobalAudioContext();},{once:true});
setInterval(()=>{if(socket&&socket.connected){socket.emit('heartbeat');}},2*60*1000);
// ===== ИНИЦИАЛИЗАЦИЯ =====
applyTranslations();
applySpeakerToDevice();
initEmojiPicker();
updateMediaUsersList();
// ===== ПЛЕЙЛИСТЫ =====
let roomPlaylists=[],activePlaylistId='classic',viewPlaylistId='classic',plEdit=null;
let plCurrentNick='';
socket.on('share-requested',d=>{
const name=(d&&d.requester)||'Админ';
if(typeof openShareSelectModal==='function')openShareSelectModal(name);
else showToast('📤 Запрос треков от: '+name);
});
socket.on('shared-music-update',d=>{
if(d.removed){
if(document.getElementById('playlist-modal').classList.contains('open')){closePlaylistSettings();setTimeout(()=>openPlaylistSettings(),100);}
if(document.getElementById('playlist-view-modal').classList.contains('open')){closePlaylistView();setTimeout(()=>openPlaylistView(),100);}
socket.emit('get-playlists');
showToast('📤 '+escapeHtml(d.nick)+' вышел — его треки убраны из плейлистов');
return;
}
if(document.getElementById('playlist-modal').classList.contains('open')&&plCurrentNick===d.nick){loadPlTracks(d.nick);}
});
socket.on('playlists-update',d=>{roomPlaylists=d.list||[];activePlaylistId=d.active||'classic';if(!roomPlaylists.find(p=>p.id===viewPlaylistId))viewPlaylistId=activePlaylistId;renderPlaylistBar();});
socket.on('playlist-open-settings',id=>setTimeout(()=>openPlaylistSettings(id),150));
function renderPlaylistBar(){
const vp=roomPlaylists.find(p=>p.id===viewPlaylistId)||roomPlaylists[0];
const el=document.getElementById('playlist-name-btn');
if(el){el.textContent=vp?vp.name:'—';el.classList.toggle('active',!!vp&&vp.id===activePlaylistId);}
const can=(myRole==='admin'||isMod);
const a=document.getElementById('pl-add'),s=document.getElementById('pl-settings');
if(a)a.style.display=can?'inline-block':'none';
if(s)s.style.display=can?'inline-block':'none';
document.querySelectorAll('.pl-arrow').forEach(b=>{b.style.display=(roomPlaylists.length>1)?'inline-block':'none';});
}
function viewPlaylist(dir){if(!roomPlaylists.length)return;let i=roomPlaylists.findIndex(p=>p.id===viewPlaylistId);if(i<0)i=0;i=(i+dir+roomPlaylists.length)%roomPlaylists.length;viewPlaylistId=roomPlaylists[i].id;renderPlaylistBar();}
function selectPlaylist(){if(myRole==='admin'||isMod){socket.emit('set-playlist',viewPlaylistId);}else{openPlaylistView();}}
function createPlaylist(){socket.emit('create-playlist');}
function openPlaylistSettings(id){if(myRole!=='admin'&&!isMod)return;const pl=roomPlaylists.find(p=>p.id===(id||viewPlaylistId||activePlaylistId));if(!pl)return;plEdit=JSON.parse(JSON.stringify(pl));plEdit.excluded=plEdit.excluded||{};document.getElementById('pl-name-input').value=plEdit.name;document.getElementById('pl-name-input').disabled=!!plEdit.classic;const db=document.getElementById('pl-delete-btn');if(db)db.style.display=plEdit.classic?'none':'inline-block';renderPlUsers();document.getElementById('playlist-modal').classList.add('open');loadAllRoomTracks();}
function closePlaylistSettings(){document.getElementById('playlist-modal').classList.remove('open');plEdit=null;}
function renderPlUsers(){
const list=document.getElementById('pl-users-list');list.innerHTML='';
(lastUsersList||[]).forEach(u=>{
const row=document.createElement('div');row.className='pl-user-row';
const nm=document.createElement('span');nm.style.flex='1';nm.textContent=u.name;nm.onclick=()=>openUserSharedPlaylists(u.name);
const cb=document.createElement('input');cb.type='checkbox';cb.className='pl-checkbox';
cb.checked=ownerHasSelected(u.name);
cb.onchange=()=>{ownerSetAll(u.name,cb.checked);renderPlUsers();const q=(document.getElementById('pl-track-search')||{}).value||'';if(plColMode==='all')renderGlobalTracks(q);else if(plColMode==='tracks'&&plBrowseNick===u.name)renderSharedPlTracks(q);else if(plColMode==='playlists'&&plBrowseNick===u.name)renderSharedPlaylistsList(u.name,window._sharedPlList||[]);};
row.appendChild(nm);row.appendChild(cb);list.appendChild(row);
});
}
let plTracksData=null;
async function loadPlTracks(nick){
plBrowsePlaylist=null;
const host=(lastUsersList||[]).find(u=>u.isAdmin);
try{
const r=await fetch('/api/user-tracks?nick='+encodeURIComponent(nick)+'&host='+encodeURIComponent(host?host.name:'')+'&room='+encodeURIComponent(currentRoomCode));
const d=await r.json();
plTracksData={nick:nick,local:d.local||[],urls:d.urls||[],shared:d.shared||[]};
plCurrentNick=nick;
document.getElementById('pl-tracks-col').style.display='flex';
document.getElementById('pl-tracks-title').textContent='Треки: '+nick;
plColMode='tracks';document.getElementById('pl-back-btn').style.display='inline-block';
const si=document.getElementById('pl-track-search');if(si)si.value='';
si.style.display='';
renderPlTracks('');
}catch(e){showToast('Ошибка загрузки треков',true);}
}
function renderPlTracks(filter){
if(!plTracksData||!plEdit)return;
const nick=plTracksData.nick;
const includeAll=!!plEdit.includeAll[nick];
const f=(filter||'').toLowerCase().trim();
const list=document.getElementById('pl-tracks-list');list.innerHTML='';
const hostU=(lastUsersList||[]).find(u=>u.isAdmin);
if(nick!==(hostU?hostU.name:'')){
const row=document.createElement('div');row.style.padding='6px';
const sb=document.createElement('button');sb.className='pl-share-btn';sb.textContent='📤 Запросить треки музыки';
sb.onclick=()=>{socket.emit('request-share',nick);showToast('📤 Запрос отправлен: '+nick);};
row.appendChild(sb);list.appendChild(row);
}
const mk=(t,key,pre)=>{
const row=document.createElement('div');row.className='pl-user-row';
const nm=document.createElement('span');nm.style.flex='1';nm.textContent=pre+(t.title||'');
const cb=document.createElement('input');cb.type='checkbox';cb.className='pl-checkbox';
cb.checked=includeAll?!plEdit.excluded[key]:!!plEdit.selected[key];
cb.onchange=()=>{if(includeAll){if(cb.checked)delete plEdit.excluded[key];else plEdit.excluded[key]=true;}else{if(cb.checked)plEdit.selected[key]=true;else delete plEdit.selected[key];}};
row.appendChild(nm);row.appendChild(cb);list.appendChild(row);
};
const h1=document.createElement('div');h1.className='pl-col-title';h1.textContent='СКАЧАННЫЕ';list.appendChild(h1);
plTracksData.local.filter(t=>!f||(t.title||'').toLowerCase().includes(f)).forEach(t=>mk(t,'local|'+t.filename,'💾 '));
(plTracksData.shared||[]).filter(t=>!f||(t.title||'').toLowerCase().includes(f)).forEach(t=>mk(t,'shared|'+nick+'|'+t.file,'📤 '));
const h2=document.createElement('div');h2.className='pl-col-title';h2.textContent='URL';list.appendChild(h2);
plTracksData.urls.filter(t=>!f||(t.title||'').toLowerCase().includes(f)).forEach(t=>mk(t,'url|'+nick+'|'+t.id,'🔗 '));
}
function savePlaylistSettings(){if(!plEdit)return;socket.emit('update-playlist',{id:plEdit.id,name:document.getElementById('pl-name-input').value.trim()||plEdit.name,includeAll:{},selected:plEdit.selected,excluded:{}});closePlaylistSettings();}
function deletePlaylist(){if(!plEdit||plEdit.classic)return;const id=plEdit.id;const name=plEdit.name;closePlaylistSettings();showConfirm('🗑','Удалить плейлист?','Плейлист «'+name+'» будет удалён.',()=>{socket.emit('delete-playlist',{id:id});});}
function openPlaylistView(){
socket.emit('get-playlist-view',function(groups){
const vp=roomPlaylists.find(p=>p.id===viewPlaylistId)||roomPlaylists[0];
document.getElementById('pl-view-title').textContent='🎼 '+(vp?vp.name:'Плейлист');
const c=document.getElementById('pl-view-content');c.innerHTML='';
if(!groups||!groups.length){c.innerHTML='<div style="color:var(--sub);padding:12px;text-align:center;">'+escapeHtml(translate('pl_empty'))+'</div>';}
(groups||[]).forEach(g=>{
const h=document.createElement('div');h.className='pl-col-title';h.textContent='👤 '+g.owner;c.appendChild(h);
if(g.local.length){const s=document.createElement('div');s.className='pl-col-title';s.style.opacity='0.7';s.textContent='💾 СКАЧАННЫЕ ('+g.local.length+')';c.appendChild(s);g.local.forEach(t=>c.appendChild(mkPlViewRow(t,'💾 ')));}
if(g.urls.length){const s=document.createElement('div');s.className='pl-col-title';s.style.opacity='0.7';s.textContent='🔗 URL ('+g.urls.length+')';c.appendChild(s);g.urls.forEach(t=>c.appendChild(mkPlViewRow(t,'🔗 ')));}
});
document.getElementById('playlist-view-modal').classList.add('open');
});
}
function mkPlViewRow(t,pre){
    const row=document.createElement('div');row.className='pl-user-row';
    const nm=document.createElement('span');nm.style.flex='1';
    const title=(t.title||'').trim()||'Без названия';
    const a=((t.artist&&t.artist.name)||t.artist||'').trim();
    nm.textContent=pre+title+(a?' — '+a:'');
    row.appendChild(nm);
    return row;
}
function closePlaylistView(){document.getElementById('playlist-view-modal').classList.remove('open');}
// ===== НАСТРОЙКИ УСТРОЙСТВ В КОМНАТЕ =====
async function openRoomDeviceSettings(){
const m=document.getElementById('room-device-modal');if(!m)return;
m.style.display='flex';
await loadDeviceSettings();
try{
const ts=await navigator.mediaDevices.getUserMedia({audio:true,video:true}).catch(()=>navigator.mediaDevices.getUserMedia({audio:true}));
ts.getTracks().forEach(t=>t.stop());
const devs=await navigator.mediaDevices.enumerateDevices();
const mic=document.getElementById('room-mic-select');
const sp=document.getElementById('room-speaker-select');
const cam=document.getElementById('room-camera-select');
mic.innerHTML='<option value="">'+escapeHtml(translate('settings_default'))+'</option>';
sp.innerHTML='<option value="">'+escapeHtml(translate('settings_default'))+'</option>';
cam.innerHTML='<option value="">'+escapeHtml(translate('settings_default'))+'</option>';
devs.forEach(d=>{
const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||(d.kind+' ('+d.deviceId.slice(0,8)+'...)');
if(d.kind==='audioinput')mic.appendChild(o);
if(d.kind==='audiooutput')sp.appendChild(o);
if(d.kind==='videoinput')cam.appendChild(o);
});
resolveSelectValue(mic,selectedMicId,'audioinput');resolveSelectValue(sp,selectedSpeakerId,'audiooutput');resolveSelectValue(cam,selectedCameraId,'videoinput');
}catch(e){console.error('[room-devices]',e);}
}

function closeRoomDeviceSettings(){const m=document.getElementById('room-device-modal');if(m)m.style.display='none';}

async function saveRoomDeviceSettings(){
const mic=document.getElementById('room-mic-select').value;
const sp=document.getElementById('room-speaker-select').value;
const cam=document.getElementById('room-camera-select').value;
selectedMicId=mic;selectedSpeakerId=sp;selectedCameraId=cam;
const devs=await navigator.mediaDevices.enumerateDevices();
const pick=(id,kind)=>{const d=devs.find(x=>x.deviceId===id&&x.kind===kind);return d?{label:d.label,groupId:d.groupId}:null;};
const spInfo=pick(sp,'audiooutput');
const miInfo=pick(mic,'audioinput');
const caInfo=pick(cam,'videoinput');
const payload={mic,speaker:sp,camera:cam};
if(spInfo){payload.speakerLabel=spInfo.label;payload.speakerGroup=spInfo.groupId;}
if(miInfo){payload.micLabel=miInfo.label;payload.micGroup=miInfo.groupId;}
if(caInfo){payload.cameraLabel=caInfo.label;payload.cameraGroup=caInfo.groupId;}
if(window.electronAPI&&window.electronAPI.setDeviceSettings)await window.electronAPI.setDeviceSettings(payload);
applySpeakerToDevice().then(r=>{
if(r&&r.ok&&!r.silent){showToast('🔊 Вывод звука переключен');}
else{showToast('💾 Сохранено');}
});
closeRoomDeviceSettings();
}
async function refreshMyShare(){
if(!(window.electronAPI&&window.electronAPI.startMusicShare))return false;
try{
const s=await window.electronAPI.startMusicShare();
if(s&&s.ok){
const ip=await window.electronAPI.getLanIp();
const r=await fetch('http://localhost:'+s.port+'/list.json');
const list=await r.json();
socket.emit('share-music',{base:'http://'+ip+':'+s.port,tracks:list});
window.iSharedMusic=true;
return true;
}
}catch(e){}
return false;
}
// ===== Просмотр переданных личных плейлистов участника =====
let plBrowseNick=null,plBrowsePlaylist=null,plColMode='all';
function plTracksSearch(v){if(plColMode==='all')renderGlobalTracks(v);else if(plColMode==='tracks')renderSharedPlTracks(v);}
function plBack(){if(plColMode==='tracks'){openUserSharedPlaylists(plBrowseNick);}else if(plColMode==='playlists'){loadAllRoomTracks();}}
function mkPlTrackRow(key,label,owner){
const row=document.createElement('div');row.className='pl-user-row';
const cb=document.createElement('input');cb.type='checkbox';cb.className='pl-checkbox';
cb.checked=!!plEdit.selected[key];
cb.onchange=()=>{if(cb.checked)plEdit.selected[key]=true;else delete plEdit.selected[key];if(owner)renderPlUsers();};
const nm=document.createElement('span');nm.style.flex='1';nm.className='marquee-able';nm.textContent=label;enableMarquee(nm);
row.appendChild(cb);row.appendChild(nm);
if(owner){const b=document.createElement('span');b.style.fontSize='10px';b.style.color='var(--sub)';b.textContent=owner;row.appendChild(b);}
return row;
}
function loadAllRoomTracks(){
plColMode='all';plBrowseNick=null;plBrowsePlaylist=null;
document.getElementById('pl-tracks-col').style.display='flex';
document.getElementById('pl-back-btn').style.display='none';
document.getElementById('pl-tracks-title').textContent='Все треки комнаты';
const si=document.getElementById('pl-track-search');si.style.display='';const sr=document.getElementById('pl-sort-row');if(sr)sr.style.display='flex';si.value='';
socket.emit('get-room-tracks-all',function(list){window._allRoomTracks=list||[];migrateIncludeAllToSelected();renderPlUsers();renderGlobalTracks('');});
}
function renderGlobalTracks(f){
if(!plEdit)return;
const listEl=document.getElementById('pl-tracks-list');listEl.innerHTML='';
const q=(f||'').toLowerCase().trim();
plApplySort(window._allRoomTracks||[]).forEach(t=>{
if(q&&!((t.title||'')+' '+(t.artist||'')+' '+(t.owner||'')).toLowerCase().includes(q))return;
listEl.appendChild(mkPlTrackRow(t.key,(t.title||'')+(t.artist?' — '+t.artist:''),t.owner));
});
if(!listEl.children.length)listEl.innerHTML='<div style="color:var(--sub);font-size:12px;padding:10px;text-align:center;">Ничего не найдено</div>';
}
async function openUserSharedPlaylists(nick){
const isHostMe=(location.hostname==='localhost'||location.hostname==='127.0.0.1')&&nick===myNickname&&typeof getPersonalPlaylists==='function';
if(isHostMe){
window._sharedMode='local';
const all=await getLocalShareList();
let myUrls=[];try{myUrls=(await window.loadMyTracks(currentRoomCode||'')).filter(t=>t.type==='url');}catch(e){}
const pls=getPersonalPlaylists().map(p=>({id:p.id,name:p.classic?'Все песни':p.name,classic:!!p.classic,
files:p.classic?all.map(t=>t.file):(p.tracks||[]).filter(t=>t.type==='local').map(t=>t.filename),
urls:p.classic?myUrls.map(t=>t.id||t.url):(p.tracks||[]).filter(t=>t.type==='url').map(t=>t.id||t.url)}));
renderSharedPlaylistsList(nick,pls);
return;
}
window._sharedMode='shared';
socket.emit('get-shared-playlists',nick,function(list){
if(!list||!list.length){loadPlTracks(nick);return;}
renderSharedPlaylistsList(nick,list);
});
}
function renderSharedPlaylistsList(nick,list){
plColMode='playlists';plBrowseNick=nick;plBrowsePlaylist=null;
window._sharedPlList=list;
document.getElementById('pl-tracks-col').style.display='flex';
document.getElementById('pl-back-btn').style.display='inline-block';
document.getElementById('pl-tracks-title').textContent='Плейлисты: '+nick;
document.getElementById('pl-track-search').style.display='none';
const sr=document.getElementById('pl-sort-row');if(sr)sr.style.display='none';
const listEl=document.getElementById('pl-tracks-list');listEl.innerHTML='';
list.forEach(p=>{
const keys=plKeysForPlaylist(nick,p);
const allSel=keys.length>0&&keys.some(k=>plEdit.selected[k]);
const row=document.createElement('div');row.className='pl-user-row';row.style.cursor='pointer';
const cb=document.createElement('input');cb.type='checkbox';cb.className='pl-checkbox';
cb.checked=allSel;
cb.onchange=()=>{keys.forEach(k=>{if(cb.checked)plEdit.selected[k]=true;else delete plEdit.selected[k];});renderPlUsers();renderSharedPlaylistsList(nick,list);};
cb.onclick=e=>e.stopPropagation();
row.appendChild(cb);
const nm2=document.createElement('span');nm2.style.flex='1';nm2.className='marquee-able';nm2.textContent='📚 '+p.name;enableMarquee(nm2);
const cnt=document.createElement('span');cnt.style.color='var(--sub)';cnt.style.fontSize='11px';cnt.textContent=(p.count!==undefined?p.count:((p.files||[]).length+(p.urls||[]).length))+' треков';
row.appendChild(nm2);row.appendChild(cnt);
row.onclick=()=>loadSharedPlaylistTracks(nick,p.id);
listEl.appendChild(row);
});
if(!listEl.children.length)listEl.innerHTML='<div style="color:var(--sub);font-size:12px;padding:10px;text-align:center;">Нет переданных плейлистов</div>';
}
function loadSharedPlaylistTracks(nick,plId){
const meta=(window._sharedPlMeta||{})[plId];
if(window._sharedMode==='local'){
(async()=>{
let tracks=[];
const plRec=(getPersonalPlaylists().find(p=>p.id===plId)||{tracks:[]});
if(plRec.classic){
const all=await getLocalShareList();
tracks=all.map(t=>({type:'local',file:t.file,title:t.title,artist:t.artist}));
try{const mine=await window.loadMyTracks(currentRoomCode||'');mine.filter(t=>t.type==='url').forEach(t=>tracks.push({type:'url',id:t.id||t.url,url:t.url||'',title:t.title,artist:(t.artist&&t.artist.name)||t.artist,cover:t.cover||''}));}catch(e){}
}else{
(plRec.tracks||[]).filter(t=>t.type==='local').forEach(t=>tracks.push({type:'local',file:t.filename,title:t.title,artist:t.artist}));
(plRec.tracks||[]).filter(t=>t.type==='url').forEach(t=>tracks.push({type:'url',id:t.id||t.url,url:t.url||'',title:t.title,artist:t.artist,cover:t.cover||''}));
}
window._sharedPlTracks=tracks;
showSharedTracksView(nick,plRec.name||meta?.name||plId);
})();
return;
}
socket.emit('get-shared-playlist-tracks',{nick:nick,id:plId},function(data){
window._sharedPlTracks=data.tracks||[];
showSharedTracksView(nick,data.name||plId);
});
}
function showSharedTracksView(nick,name){
plColMode='tracks';plBrowseNick=nick;plBrowsePlaylist=nick+'|'+name;
document.getElementById('pl-tracks-title').textContent='Треки: '+name;
const si=document.getElementById('pl-track-search');si.style.display='';const sr=document.getElementById('pl-sort-row');if(sr)sr.style.display='flex';si.value='';
document.getElementById('pl-back-btn').style.display='inline-block';
renderSharedPlTracks('');
}
function renderSharedPlTracks(filter){
if(!plEdit)return;
const nick=plBrowseNick;
const f=(filter||'').toLowerCase().trim();
const listEl=document.getElementById('pl-tracks-list');listEl.innerHTML='';
plApplySort(window._sharedPlTracks||[]).forEach(t=>{
if(f&&!((t.title||'')+' '+(t.artist||'')).toLowerCase().includes(f))return;
let key,label;
if(t.type==='url'){key='url|'+nick+'|'+(t.id||t.url);label='🔗 '+(t.title||'')+(t.artist?' — '+t.artist:'');}
else if(window._sharedMode==='local'){key='local|'+(t.file||t.filename);label='💾 '+(t.title||t.file||t.filename)+(t.artist?' — '+t.artist:'');}
else{key='shared|'+nick+'|'+t.file;label='📤 '+(t.title||t.file)+(t.artist?' — '+t.artist:'');}
listEl.appendChild(mkPlTrackRow(key,label,null));
});
if(!listEl.children.length)listEl.innerHTML='<div style="color:var(--sub);font-size:12px;padding:10px;text-align:center;">Пусто</div>';
}
function ownerKeys(nick){return (window._allRoomTracks||[]).filter(t=>t.owner===nick).map(t=>t.key);}
function ownerHasSelected(nick){return ownerKeys(nick).some(k=>plEdit&&plEdit.selected[k]);}
function ownerSetAll(nick,on){ownerKeys(nick).forEach(k=>{if(on)plEdit.selected[k]=true;else delete plEdit.selected[k];});}
function plKeysForPlaylist(nick,p){const mode=window._sharedMode;const ks=[];(p.files||[]).forEach(f=>ks.push(mode==='local'?('local|'+f):('shared|'+nick+'|'+f)));(p.urls||[]).forEach(u=>ks.push('url|'+nick+'|'+u));return ks;}
function migrateIncludeAllToSelected(){if(!plEdit||!plEdit.includeAll)return;Object.keys(plEdit.includeAll).forEach(n=>{if(plEdit.includeAll[n]){ownerKeys(n).forEach(k=>{if(!plEdit.excluded[k])plEdit.selected[k]=true;else delete plEdit.selected[k];});plEdit.includeAll[n]=false;}});}
function refreshPlColumns(){renderPlUsers(lastUsersList||[]);if(window._sharedPlList&&plBrowseNick)renderSharedPlaylistsList(plBrowseNick,window._sharedPlList);}
function enableMarquee(span){
span.addEventListener('mouseenter',()=>{
if(span.dataset.mqBusy)return;
if(span.scrollWidth<=span.clientWidth+2)return;
const text=span.dataset.mqText!==undefined?span.dataset.mqText:span.textContent;
span.dataset.mqText=text;
span.classList.add('marquee-on');
span.innerHTML='';
const inner=document.createElement('span');inner.className='mq-inner';
const c1=document.createElement('span');c1.className='mq-copy';c1.textContent=text;
const c2=document.createElement('span');c2.className='mq-copy';c2.textContent=text;
inner.appendChild(c1);inner.appendChild(c2);span.appendChild(inner);
const w=c1.offsetWidth;
span.style.setProperty('--shift','-'+w+'px');
span.style.setProperty('--dur',Math.max(3,w/50)+'s');
});
span.addEventListener('mouseleave',()=>{
if(span.dataset.mqText!==undefined){span.textContent=span.dataset.mqText;span.classList.remove('marquee-on');}
});
}
let plSortField=null,plSortDir=1;
function plSortBy(f){
if(plSortField===f)plSortDir*=-1;else{plSortField=f;plSortDir=1;}
const lbl={title:'Назв.',artist:'Автор',owner:'Ник'};
['title','artist','owner'].forEach(x=>{const b=document.getElementById('pl-sort-'+x);if(b)b.textContent=lbl[x]+(plSortField===x?(plSortDir>0?' ↑':' ↓'):'');});
const q=(document.getElementById('pl-track-search')||{}).value||'';
if(plColMode==='all')renderGlobalTracks(q);else if(plColMode==='tracks')renderSharedPlTracks(q);
}
function plApplySort(arr){
if(!plSortField)return arr;
return arr.slice().sort((a,b)=>{
let va=a[plSortField]||'';let vb=b[plSortField]||'';
if(plSortField==='artist'){va=va||a.title||'';vb=vb||b.title||'';}
va=String(va).toLowerCase();vb=String(vb).toLowerCase();
if(va<vb)return -plSortDir;if(va>vb)return plSortDir;return 0;
});
}