// ===== ПРИЛОЖЕНИЕ: вход в комнату, пользователи, LAN, инициализация =====
const urlParams=new URLSearchParams(window.location.search);
const bootMode=urlParams.get('mode');
const bootNick=(urlParams.get('nick')||'').trim();
const bootCode=(urlParams.get('code')||'').trim().toUpperCase();
let booted=false;
function backToStart(){window.location.replace('/');}
function bootstrap(){
if(bootMode==='create'&&bootNick){
myNickname=bootNick;
myNickname=bootNick;localStorage.setItem('mp_nickname',bootNick);
socket.emit('create-room',bootNick,function(d){
if(d&&d.code){history.replaceState(null,'','/room?mode=join&code='+d.code+'&nick='+encodeURIComponent(bootNick));enterRoom(d);}
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
document.getElementById('room-code-el').innerText=d.code;
document.getElementById('sidebar').style.display='flex';
document.getElementById('player-bar').style.display='flex';
document.getElementById('queue-sidebar').style.display='flex';
document.getElementById('search-panel').style.display='block';
document.getElementById('chat-fab').style.display='flex';
if(myRole==='admin'||myRole==='mod'){document.getElementById('admin-controls').style.display='block';document.getElementById('cooldown-input').value=voteCooldown;document.getElementById('vote-duration-input').value=voteDuration;updateVoiceToggleButton();isReady=true;restorePlayerBar();}
else{document.getElementById('admin-controls').style.display='none';showReadyButton();startCooldownTimer();}
updateVoiceEntryButton();updateManageBtnVisibility();updateRegenBtnVisibility();updateRandomButtonVisibility();
socket.emit('get-active-streams');
}
function leaveRoom(){
const msg=myRole==='admin'?translate('leave_admin_confirm'):translate('leave_user_confirm');
showConfirm('🚪',translate('leave_room_title'),msg,function(){
try{socket.emit('leave-room');}catch(e){}
setTimeout(backToStart,100);
});
}
function toggleLan(){if(myRole!=='admin'){showToast(translate('lan_admin_only'),true);return;}socket.emit('toggle-lan');}
socket.on('lan-update',o=>{isLanOpen=!!o;updateLanButton();});
function updateLanButton(){const b=document.getElementById('lan-toggle-btn');if(!b)return;b.style.display='flex';b.classList.toggle('active',isLanOpen);b.textContent=isLanOpen?translate('lan_on'):translate('lan_off');}
function copyRoomCode(){if(!currentRoomCode)return;navigator.clipboard.writeText(currentRoomCode).then(()=>showToast(translate('copied')));}
function regenerateCode(){if(myRole!=='admin')return;showConfirm('🔑',translate('confirm_regen_title'),translate('confirm_regen_msg'),()=>{socket.emit('regenerate-room-code');});}
socket.on('room-code-changed',c=>{currentRoomCode=c;document.getElementById('room-code-el').innerText=c;showToast(translate('code_changed'));});
socket.on('kicked',()=>{showAlert('❌','Кик',translate('kicked_msg'));setTimeout(()=>location.reload(),2000);});
socket.on('banned',()=>{showAlert('🚫','Бан',translate('banned_msg'));setTimeout(()=>location.reload(),2000);});
socket.on('room-closed',()=>{showAlert('👋','Комната закрыта',translate('admin_left'));setTimeout(()=>location.reload(),2000);});
socket.on('voice-status',e=>{voiceChatEnabled=e;if(myRole==='admin')updateVoiceToggleButton();if(!e&&isInVoice)leaveVoiceChat();updateVoiceEntryButton();});
socket.on('voice-chat-disabled',()=>{if(isInVoice)leaveVoiceChat();voiceChatEnabled=false;updateVoiceEntryButton();});
function toggleVoiceChatSetting(){if(myRole!=='admin')return;socket.emit('toggle-voice-chat',!voiceChatEnabled);}
function updateVoiceToggleButton(){const b=document.getElementById('voice-chat-toggle');if(!b)return;b.className=voiceChatEnabled?'voice-toggle-btn on':'voice-toggle-btn off';b.innerText=voiceChatEnabled?translate('voice_on'):translate('voice_off');}
function updateVoiceEntryButton(){const b=document.getElementById('voice-entry-btn');if(!voiceChatEnabled){b.style.display='none';return;}b.style.display='flex';b.disabled=false;isLeaving=false;b.className=isInVoice?'voice-entry-btn leave':'voice-entry-btn join';b.innerHTML=isInVoice?translate('leave_voice'):translate('join_voice');}
function updateManageBtnVisibility(){const b=document.getElementById('manage-toggle-btn');if(b)b.style.display=myRole==='admin'?'inline-block':'none';}
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
const div=document.createElement('div');let cl=['user-item'];if(u.isAdmin)cl.push('admin');if(u.isMod)cl.push('mod');if(u.isVip)cl.push('vip');div.className=cl.join(' ');
const icon=u.isAdmin?'👑 ':u.isMod?'🛡️ ':u.isVip?'⭐ ':'';
const displayName=u.id===mySocketId?u.name+' (Вы)':u.name;
let actionsHTML='';if(manageMode&&myRole==='admin'&&!u.isAdmin){actionsHTML+=`<button class="role-btn ${u.isVip?'active-vip':''}" onclick="toggleRole('${escapeHtml(u.id)}','vip')">VIP</button><button class="role-btn ${u.isMod?'active-mod':''}" onclick="toggleRole('${escapeHtml(u.id)}','mod')">MOD</button><button class="kick-btn" onclick="kickUser('${escapeHtml(u.id)}')" title="Кикнуть">❌</button><button class="ban-btn" onclick="banUser('${escapeHtml(u.id)}')" title="Забанить">🚫</button>`;}
let vdHTML='',voiceBtns='';
if(u.voiceState){
const vs=u.voiceState;const clk=cmv&&!u.isAdmin?'clickable':'';
const mc=vs.forceMuted?`force-btn active ${clk}`:vs.selfMuted?`force-btn self-active ${clk}`:`force-btn ${clk}`;
const dc=vs.forceDeafened?`force-btn active ${clk}`:vs.selfDeafened?`force-btn self-active ${clk}`:`force-btn ${clk}`;
const mck=cmv&&!u.isAdmin?`onclick="forceVoiceAction('${escapeHtml(u.id)}','mute')"`:'';
const dck=cmv&&!u.isAdmin?`onclick="forceVoiceAction('${escapeHtml(u.id)}','deafen')"`:'';
voiceBtns+=`<button class="${escapeHtml(mc)}" ${mck} title="${escapeHtml(vs.forceMuted?translate('muted_by_admin'):vs.selfMuted?translate('self_muted'):(cmv?translate('mute_action'):translate('not_muted')))}">🎤</button><button class="${escapeHtml(dc)}" ${dck} title="${escapeHtml(vs.forceDeafened?translate('deafened_by_admin'):vs.selfDeafened?translate('self_deafened'):(cmv?translate('deafen_action'):translate('not_deafened')))}">🎧</button>`;
vdHTML=`<div class="voice-dot" id="vdot-${escapeHtml(u.id)}"></div>`;
if(vs.videoEnabled)vdHTML+='<div class="video-dot" title="Видео включено"></div>';
if(vs.screenEnabled)vdHTML+='<div class="screen-dot" title="Экран включен"></div>';
}
div.innerHTML=`<div class="user-top-row"><span class="user-name">${escapeHtml(icon)}${escapeHtml(displayName)}</span>${vdHTML}<div class="user-actions">${actionsHTML}${voiceBtns}</div></div>`;
if(isInVoice&&u.id!==mySocketId&&u.voiceState){
const pid=socketToPeer[u.id];
const sv=pid&&localVolumes[pid]!==undefined?localVolumes[pid]:0.5;
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
});
renderSpeakingDots();
}
socket.on('users-update',u=>renderUsersList(u));
function toggleRole(u,t){socket.emit('toggle-role',{targetSocketId:u,roleType:t});}
function forceVoiceAction(uid,action){if(myRole!=='admin'&&!isMod)return;const user=lastUsersList?.find(u=>u.id===uid);if(!user||!user.voiceState){showToast('Пользователь не в голосовом чате',true);return;}socket.emit('force-voice-action',{targetSocketId:uid,action:action});}
function kickUser(u){if(myRole!=='admin')return;showConfirm('❌',translate('confirm_kick_title'),translate('confirm_kick_msg'),()=>{socket.emit('kick-user',u);});}
function banUser(u){if(myRole!=='admin')return;showConfirm('🚫',translate('confirm_ban_title'),translate('confirm_ban_msg'),()=>{socket.emit('ban-user',u);});}
function startCooldownTimer(){if(cooldownTimerInterval)clearInterval(cooldownTimerInterval);cooldownTimerInterval=setInterval(()=>{if(searchResults.length>0)renderSearchResults();},1000);}
socket.on('role-updated',r=>{const wm=isMod;isVip=r.isVip;isMod=r.isMod;if(wm&&!isMod){currentInbox=[];renderInbox();}showToast(isVip?translate('vip_received'):isMod?translate('mod_received'):translate('roles_removed'),!isVip&&!isMod);restorePlayerBar();updateManageBtnVisibility();updateRegenBtnVisibility();updateRandomButtonVisibility();searchMusic();});
document.addEventListener('click',()=>{getGlobalAudioContext();},{once:true});
setInterval(()=>{if(socket&&socket.connected){socket.emit('heartbeat');}},2*60*1000);
// ===== ИНИЦИАЛИЗАЦИЯ =====
applyTranslations();
applySpeakerToDevice();
initEmojiPicker();
updateMediaUsersList();