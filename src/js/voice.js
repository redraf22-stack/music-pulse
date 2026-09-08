function volStore(){try{return JSON.parse(localStorage.getItem('mp_volumes')||'{}');}catch(e){return{};}}
function volStoreSet(name,v){const s=volStore();s[name]=v;localStorage.setItem('mp_volumes',JSON.stringify(s));}
function volByName(name){const s=volStore();return s[name];}
// ===== ГОЛОС, ВИДЕО, ЭКРАН =====
function startSpeakingDetection(p,s){try{const c=getGlobalAudioContext();if(!c||s.getAudioTracks().length===0)return;const x=c.createMediaStreamSource(s);const g=c.createGain();g.gain.value=4.0;const a=c.createAnalyser();a.fftSize=256;a.smoothingTimeConstant=0.3;x.connect(g);g.connect(a);analysers[p]=a;gains[p]=g;}catch(e){}}
function startSelfSpeakingDetection(s){try{const c=getGlobalAudioContext();if(!c)return;const x=c.createMediaStreamSource(s);const g=c.createGain();g.gain.value=4.0;const a=c.createAnalyser();a.fftSize=256;a.smoothingTimeConstant=0.3;x.connect(g);g.connect(a);myAnalyser=a;}catch(e){}}
function stopSelfSpeakingDetection(){myAnalyser=null;if(mySocketId)speakingUsers.delete(mySocketId);}
function stopSpeakingDetection(p){try{if(gains[p]){gains[p].disconnect();delete gains[p];}}catch(e){}delete analysers[p];speakingUsers.delete(p);}
setInterval(()=>{let ch=false;if(myAnalyser&&mySocketId){const d=new Uint8Array(myAnalyser.frequencyBinCount);myAnalyser.getByteFrequencyData(d);let s=0;for(let i=0;i<d.length;i++)s+=d[i];const w=speakingUsers.has(mySocketId),n=(s/d.length)>8;if(w!==n){if(n)speakingUsers.add(mySocketId);else speakingUsers.delete(mySocketId);ch=true;}}Object.keys(analysers).forEach(p=>{const a=analysers[p];if(!a)return;const sid=peerToSocket[p];if(!sid)return;const d=new Uint8Array(a.frequencyBinCount);a.getByteFrequencyData(d);let s=0;for(let i=0;i<d.length;i++)s+=d[i];const w=speakingUsers.has(sid),n=(s/d.length)>8;if(w!==n){if(n)speakingUsers.add(sid);else speakingUsers.delete(sid);ch=true;}});if(ch)renderSpeakingDots();},100);
function renderSpeakingDots(){document.querySelectorAll('.voice-dot').forEach(d=>d.classList.remove('speaking'));speakingUsers.forEach(s=>{const d=document.getElementById('vdot-'+s);if(d)d.classList.add('speaking');});}
async function toggleVoiceConnection(){if(isLeaving)return;if(isInVoice)await leaveVoiceChat();else await joinVoiceChat();}
async function leaveVoiceChat(){
if(isLeaving)return;
isLeaving=true;
isInVoice=false;forceMuted=false;forceDeafened=false;isMuted=false;isDeafened=false;
updateVoiceEntryButton();updateVoiceControlsInPlayer();stopSelfSpeakingDetection();
try{socket.emit('leave-voice');}catch(e){}
Object.keys(currentCalls).forEach(p=>{try{const c=currentCalls[p];if(c._audioElement){c._audioElement.pause();c._audioElement.srcObject=null;c._audioElement.remove();}if(c._gainNode)c._gainNode.disconnect();if(c._sourceNode)c._sourceNode.disconnect();if(c._shaperNode)c._shaperNode.disconnect();c.close();stopSpeakingDetection(p);}catch(e){}});
currentCalls={};
if(peer&&!myVideoEnabled&&!myScreenEnabled){try{peer.destroy();}catch(e){}peer=null;myPeerId=null;}
if(myStream){try{myStream.getTracks().forEach(t=>{t.stop();t.enabled=false;});}catch(e){}myStream=null;}
isLeaving=false;
updateMediaUsersList();
}
async function joinVoiceChat(){
if(!voiceChatEnabled){showToast(translate('voice_disabled'),true);return;}
if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){showToast(translate('no_browser_support'),true);updateVoiceEntryButton();return;}
const c=getGlobalAudioContext();if(c&&c.state==='suspended')await c.resume();
const eb=document.getElementById('voice-entry-btn');eb.innerHTML=translate('connecting');eb.disabled=true;
try{
const co={audio:selectedMicId?{deviceId:{exact:selectedMicId}}:true,video:false};
myStream=await navigator.mediaDevices.getUserMedia(co);
startSelfSpeakingDetection(myStream);
peer=new Peer({host:window.location.hostname,port:3002,path:'/peerjs',secure:window.location.protocol==='https:',debug:1});
peer.on('open',pid=>{myPeerId=pid;isInVoice=true;forceMuted=false;forceDeafened=false;isLeaving=false;socket.emit('register-peer-id',pid);updateVoiceEntryButton();updateVoiceControlsInPlayer();socket.emit('join-voice');showToast(translate('connected'));});
peer.on('call',handleIncomingCall);
peer.on('error',e=>{showToast(translate('error_prefix')+e.type,true);leaveVoiceChat();});
}catch(e){let m=e.message;if(e.name==='NotAllowedError')m=translate('mic_denied');else if(e.name==='NotFoundError')m=translate('mic_not_found');else if(e.name==='SecurityError')m=translate('need_https');showToast(m,true);eb.disabled=false;updateVoiceEntryButton();}
}
function handleIncomingCall(call){
const isVideo=call.metadata&&call.metadata.type==='video';
const isScreen=call.metadata&&call.metadata.type==='screen';
if(isVideo){if(myVideoStream)call.answer(myVideoStream);else call.answer();handleVideoCall(call);}
else if(isScreen){if(myScreenStream)call.answer(myScreenStream);else call.answer();handleScreenCall(call);}
else{call.answer(myStream);handleAudioCall(call);}
}
function handleAudioCall(c){
currentCalls[c.peer]=c;
c.on('stream',rs=>{
const ctx=getGlobalAudioContext();const pid=c.peer;
let sv=localVolumes[pid]!==undefined?localVolumes[pid]:undefined;
if(sv===undefined){const sid=peerToSocket[pid];const u=(lastUsersList||[]).find(x=>x.id===sid);const saved=u?volByName(u.name):undefined;if(saved!==undefined){sv=saved;localVolumes[pid]=sv;}}
if(sv===undefined)sv=0.5;
const ae=new Audio();ae.srcObject=rs;ae.volume=0;ae.muted=false;c._audioElement=ae;
if(ctx&&ctx.state==='running'){try{const g=ctx.createGain();g.gain.value=volumeToGain(sv);const s=ctx.createWaveShaper();s.curve=makeSoftClipCurve();s.oversample='4x';const src=ctx.createMediaStreamSource(rs);src.connect(g);g.connect(s);s.connect(ctx.destination);c._gainNode=g;c._sourceNode=src;c._shaperNode=s;}catch(e){}}
ae.play().catch(()=>{});startSpeakingDetection(pid,rs);
});
c.on('close',()=>{const x=currentCalls[c.peer];if(x){try{if(x._audioElement){x._audioElement.pause();x._audioElement.srcObject=null;x._audioElement.remove();}if(x._gainNode)x._gainNode.disconnect();if(x._sourceNode)x._sourceNode.disconnect();if(x._shaperNode)x._shaperNode.disconnect();}catch(e){}}stopSpeakingDetection(c.peer);delete currentCalls[c.peer];});
}
function handleVideoCall(call){
const peerId=call.peer;
videoCalls[peerId]=call;
if(call.metadata){const tabId=call.metadata.tabId||'unknown';const uniqueKey=peerId+'_'+tabId;videoUserInfo[uniqueKey]={userId:call.metadata.userId,userName:call.metadata.userName,isAdmin:call.metadata.isAdmin,isMod:call.metadata.isMod,isVip:call.metadata.isVip,peerId:peerId,tabId:tabId};allUsersWithVideo[uniqueKey]={userId:call.metadata.userId,userName:call.metadata.userName,peerId:peerId,isAdmin:call.metadata.isAdmin,isMod:call.metadata.isMod,isVip:call.metadata.isVip,tabId:tabId,isSelf:false};}
call.on('stream',stream=>{videoStreams[peerId]=stream;const uniqueKey=Object.keys(videoUserInfo).find(k=>videoUserInfo[k].peerId===peerId);if(uniqueKey&&videoWindows[uniqueKey]){const video=videoWindows[uniqueKey].querySelector('video');if(video)video.srcObject=stream;}updateMediaUsersList();});
call.on('close',()=>{delete videoCalls[peerId];delete videoStreams[peerId];const uniqueKey=Object.keys(videoUserInfo).find(k=>videoUserInfo[k].peerId===peerId);if(uniqueKey){delete videoUserInfo[uniqueKey];delete allUsersWithVideo[uniqueKey];if(videoWindows[uniqueKey])closeVideoWindow(uniqueKey);}updateMediaUsersList();});
}
function handleScreenCall(call){
const peerId=call.peer;
screenCalls[peerId]=call;
if(call.metadata){const tabId=call.metadata.tabId||'unknown';const uniqueKey=peerId+'_'+tabId;screenUserInfo[uniqueKey]={userId:call.metadata.userId,userName:call.metadata.userName,isAdmin:call.metadata.isAdmin,isMod:call.metadata.isMod,isVip:call.metadata.isVip,peerId:peerId,tabId:tabId};allUsersWithScreen[uniqueKey]={userId:call.metadata.userId,userName:call.metadata.userName,peerId:peerId,isAdmin:call.metadata.isAdmin,isMod:call.metadata.isMod,isVip:call.metadata.isVip,tabId:tabId,isSelf:false};}
call.on('stream',stream=>{screenStreams[peerId]=stream;const uniqueKey=Object.keys(screenUserInfo).find(k=>screenUserInfo[k].peerId===peerId);if(uniqueKey&&screenWindows[uniqueKey]){const video=screenWindows[uniqueKey].querySelector('video');if(video)video.srcObject=stream;}updateMediaUsersList();});
call.on('close',()=>{delete screenCalls[peerId];delete screenStreams[peerId];const uniqueKey=Object.keys(screenUserInfo).find(k=>screenUserInfo[k].peerId===peerId);if(uniqueKey){delete screenUserInfo[uniqueKey];delete allUsersWithScreen[uniqueKey];if(screenWindows[uniqueKey])closeScreenWindow(uniqueKey);}updateMediaUsersList();});
}
socket.on('user-joined-voice',({id,peerId})=>{
if(!isInVoice||!peer||!peerId||peerId===myPeerId)return;
socketToPeer[id]=peerId;peerToSocket[peerId]=id;
if(!currentCalls[peerId]){const call=peer.call(peerId,myStream);handleAudioCall(call);}
setTimeout(()=>updateMediaUsersList(),500);
});
socket.on('user-left-voice',({id,peerId})=>{const tp=peerId||socketToPeer[id];if(id)delete socketToPeer[id];if(tp)delete peerToSocket[tp];if(currentCalls[tp]){try{if(currentCalls[tp]._audioElement){currentCalls[tp]._audioElement.pause();currentCalls[tp]._audioElement.remove();}if(currentCalls[tp]._gainNode)currentCalls[tp]._gainNode.disconnect();if(currentCalls[tp]._sourceNode)currentCalls[tp]._sourceNode.disconnect();if(currentCalls[tp]._shaperNode)currentCalls[tp]._shaperNode.disconnect();currentCalls[tp].close();}catch(e){}stopSpeakingDetection(tp);delete currentCalls[tp];}if(videoCalls[tp]){try{videoCalls[tp].close();}catch(e){}delete videoCalls[tp];delete videoStreams[tp];const uk=Object.keys(videoUserInfo).find(k=>videoUserInfo[k].peerId===tp);if(uk){delete videoUserInfo[uk];delete allUsersWithVideo[uk];if(videoWindows[uk])closeVideoWindow(uk);}}if(screenCalls[tp]){try{screenCalls[tp].close();}catch(e){}delete screenCalls[tp];delete screenStreams[tp];const uk=Object.keys(screenUserInfo).find(k=>screenUserInfo[k].peerId===tp);if(uk){delete screenUserInfo[uk];delete allUsersWithScreen[uk];if(screenWindows[uk])closeScreenWindow(uk);}}updateMediaUsersList();});
async function toggleVideo(){
const btn=document.getElementById('video-toggle-btn');
if(myVideoEnabled){
myVideoEnabled=false;btn.classList.remove('active');btn.innerHTML='📷 Включить видеосвязь';
if(myVideoStream){myVideoStream.getTracks().forEach(t=>{t.stop();});myVideoStream=null;}
socket.emit('toggle-video',false,TAB_ID);
const myUniqueKey=myPeerId+'_'+TAB_ID;
delete allUsersWithVideo[myUniqueKey];
if(videoWindows[myUniqueKey])closeVideoWindow(myUniqueKey);
updateMediaUsersList();
}else{
try{
if(!peer){peer=new Peer({host:window.location.hostname,port:3002,path:'/peerjs',secure:window.location.protocol==='https:',debug:1});peer.on('call',handleIncomingCall);peer.on('error',e=>{showToast(translate('error_prefix')+e.type,true);});await new Promise(resolve=>{peer.on('open',pid=>{myPeerId=pid;socket.emit('register-peer-id',pid);resolve();});});}
const constraints={video:selectedCameraId?{deviceId:{exact:selectedCameraId}}:true,audio:false};
myVideoStream=await navigator.mediaDevices.getUserMedia(constraints);myVideoEnabled=true;
btn.classList.add('active');btn.innerHTML='📷 Выключить видеосвязь';
socket.emit('toggle-video',true,TAB_ID);
const myUniqueKey=myPeerId+'_'+TAB_ID;
allUsersWithVideo[myUniqueKey]={userId:mySocketId,userName:myNickname,peerId:myPeerId,isAdmin:myRole==='admin',isMod:isMod,isVip:isVip,isSelf:true,tabId:TAB_ID};
Object.keys(allUsersWithVideo).forEach(k=>{const u=allUsersWithVideo[k];if(u.peerId&&u.peerId!==myPeerId&&!videoCalls[u.peerId]){try{const call=peer.call(u.peerId,myVideoStream,{metadata:{type:'video',userId:mySocketId,userName:myNickname,isAdmin:myRole==='admin',isMod:isMod,isVip:isVip,tabId:TAB_ID}});handleVideoCall(call);}catch(e){}}});
updateMediaUsersList();
showToast('📹 Видеосвязь включена');
}catch(e){showToast('Не удалось включить камеру: '+e.message,true);}
}
}
async function toggleScreen(){
const btn=document.getElementById('screen-toggle-btn');
if(myScreenEnabled){
myScreenEnabled=false;btn.classList.remove('active');btn.innerHTML='📺 Транслировать экран';
if(myScreenStream){myScreenStream.getTracks().forEach(t=>{t.stop();});myScreenStream=null;}
socket.emit('toggle-screen',false,TAB_ID);
const myUniqueKey=myPeerId+'_'+TAB_ID;
delete allUsersWithScreen[myUniqueKey];
if(screenWindows[myUniqueKey])closeScreenWindow(myUniqueKey);
updateMediaUsersList();
}else{
try{
if(!peer){peer=new Peer({host:window.location.hostname,port:3002,path:'/peerjs',secure:window.location.protocol==='https:',debug:1});peer.on('call',handleIncomingCall);peer.on('error',e=>{showToast(translate('error_prefix')+e.type,true);});await new Promise(resolve=>{peer.on('open',pid=>{myPeerId=pid;socket.emit('register-peer-id',pid);resolve();});});}
myScreenStream=await navigator.mediaDevices.getDisplayMedia({video:{cursor:"always"},audio:false});
myScreenEnabled=true;
btn.classList.add('active');btn.innerHTML='📺 Остановить трансляцию';
myScreenStream.getVideoTracks()[0].onended=()=>{if(myScreenEnabled)toggleScreen();};
socket.emit('toggle-screen',true,TAB_ID);
const myUniqueKey=myPeerId+'_'+TAB_ID;
allUsersWithScreen[myUniqueKey]={userId:mySocketId,userName:myNickname,peerId:myPeerId,isAdmin:myRole==='admin',isMod:isMod,isVip:isVip,isSelf:true,tabId:TAB_ID};
Object.keys(allUsersWithScreen).forEach(k=>{const u=allUsersWithScreen[k];if(u.peerId&&u.peerId!==myPeerId&&!screenCalls[u.peerId]){try{const call=peer.call(u.peerId,myScreenStream,{metadata:{type:'screen',userId:mySocketId,userName:myNickname,isAdmin:myRole==='admin',isMod:isMod,isVip:isVip,tabId:TAB_ID}});handleScreenCall(call);}catch(e){}}});
updateMediaUsersList();
showToast('📺 Трансляция экрана включена');
}catch(e){showToast('Не удалось начать трансляцию: '+e.message,true);}
}
}
socket.on('user-video-state',({userId,peerId,userName,enabled,tabId,isAdmin,isMod,isVip})=>{
    if(userId===mySocketId&&tabId===TAB_ID)return;
    const uniqueKey=peerId+'_'+(tabId||'unknown');
    if(enabled){
        allUsersWithVideo[uniqueKey]={userId,userName,peerId,isAdmin:isAdmin||false,isMod:isMod||false,isVip:isVip||false,tabId,isSelf:false};
        if(!videoStreams[peerId]){socket.emit('request-media',{userId:userId,type:'video'});}
    }else{
        delete allUsersWithVideo[uniqueKey];
        delete videoUserInfo[uniqueKey];
        if(videoCalls[peerId]){try{videoCalls[peerId].close();}catch(e){}delete videoCalls[peerId];delete videoStreams[peerId];}
        if(videoWindows[uniqueKey])closeVideoWindow(uniqueKey);
    }
    updateMediaUsersList();
});
socket.on('user-screen-state',({userId,peerId,userName,enabled,tabId,isAdmin,isMod,isVip})=>{
    if(userId===mySocketId&&tabId===TAB_ID)return;
    const uniqueKey=peerId+'_'+(tabId||'unknown');
    if(enabled){
        allUsersWithScreen[uniqueKey]={userId,userName,peerId,isAdmin:isAdmin||false,isMod:isMod||false,isVip:isVip||false,tabId,isSelf:false};
        if(!screenStreams[peerId]){socket.emit('request-media',{userId:userId,type:'screen'});}
    }else{
        delete allUsersWithScreen[uniqueKey];
        delete screenUserInfo[uniqueKey];
        if(screenCalls[peerId]){try{screenCalls[peerId].close();}catch(e){}delete screenCalls[peerId];delete screenStreams[peerId];}
        if(screenWindows[uniqueKey])closeScreenWindow(uniqueKey);
    }
    updateMediaUsersList();
});
socket.on('active-streams',streams=>{
streams.forEach(stream=>{
const uniqueKey=stream.peerId+'_'+(stream.tabId||'unknown');
if(stream.type==='video'){allUsersWithVideo[uniqueKey]={userId:stream.userId,userName:stream.userName,peerId:stream.peerId,isAdmin:stream.isAdmin,isMod:stream.isMod,isVip:stream.isVip,isSelf:stream.userId===mySocketId,tabId:stream.tabId};}
else if(stream.type==='screen'){allUsersWithScreen[uniqueKey]={userId:stream.userId,userName:stream.userName,peerId:stream.peerId,isAdmin:stream.isAdmin,isMod:stream.isMod,isVip:stream.isVip,isSelf:stream.userId===mySocketId,tabId:stream.tabId};}
});
updateMediaUsersList();
});
function updateMediaUsersList(){
const list=document.getElementById('media-users-list');
if(!list)return;
list.innerHTML='';
const allUsers=new Map();
Object.values(allUsersWithVideo).forEach(u=>{const key=u.userId+'_'+u.tabId;if(!allUsers.has(key)){allUsers.set(key,{userId:u.userId,userName:u.userName,peerId:u.peerId,isAdmin:u.isAdmin,isMod:u.isMod,isVip:u.isVip,isSelf:u.isSelf,tabId:u.tabId,hasVideo:true,hasScreen:false});}else{allUsers.get(key).hasVideo=true;}});
Object.values(allUsersWithScreen).forEach(u=>{const key=u.userId+'_'+u.tabId;if(!allUsers.has(key)){allUsers.set(key,{userId:u.userId,userName:u.userName,peerId:u.peerId,isAdmin:u.isAdmin,isMod:u.isMod,isVip:u.isVip,isSelf:u.isSelf,tabId:u.tabId,hasVideo:false,hasScreen:true});}else{allUsers.get(key).hasScreen=true;}});
const users=Array.from(allUsers.values());
if(users.length===0){list.innerHTML='<div style="color:var(--sub);font-size:12px;padding:8px;text-align:center;">Нет участников с медиа</div>';return;}
users.forEach(u=>{
const uniqueKey=u.peerId+'_'+(u.tabId||'unknown');
const item=document.createElement('div');item.className='media-user-item';
const avatar=document.createElement('div');avatar.className='media-user-avatar';avatar.textContent=u.userName.charAt(0).toUpperCase();
if(u.isAdmin)avatar.style.background='var(--accent)';else if(u.isMod)avatar.style.background='var(--mod)';else if(u.isVip)avatar.style.background='var(--vip)';else avatar.style.background='#666';
const info=document.createElement('div');info.className='media-user-info';
const name=document.createElement('div');name.className='media-user-name';name.textContent=u.isSelf?u.userName+' (Вы)':u.userName;
const role=document.createElement('div');role.className='media-user-role';
let roleText=u.isAdmin?'Админ':u.isMod?'Модератор':u.isVip?'VIP':'Участник';
if(u.hasVideo&&u.hasScreen)roleText+=' • Видео + Экран';else if(u.hasVideo)roleText+=' • Видео';else if(u.hasScreen)roleText+=' • Экран';
role.textContent=roleText;
info.appendChild(name);info.appendChild(role);
item.appendChild(avatar);item.appendChild(info);
const buttonsDiv=document.createElement('div');buttonsDiv.className='media-buttons';
if(u.hasVideo){
const videoBtn=document.createElement('button');
videoBtn.className='media-show-btn video'+(videoWindows[uniqueKey]?' active':'');
videoBtn.textContent=videoWindows[uniqueKey]?'✓ Видео':'📹 Видео';
videoBtn.title=videoWindows[uniqueKey]?'Закрыть видео':'Смотреть видео';
videoBtn.onclick=()=>{if(videoWindows[uniqueKey]){closeVideoWindow(uniqueKey);}else{if(!videoStreams[u.peerId]&&!u.isSelf){socket.emit('request-media',{userId:u.userId,type:'video'});showToast('📹 Запрашиваю видео...');setTimeout(()=>{if(videoStreams[u.peerId])openVideoWindow(uniqueKey,u.userName,u.isSelf,u.peerId);updateMediaUsersList();},1500);}else{openVideoWindow(uniqueKey,u.userName,u.isSelf,u.peerId);}}updateMediaUsersList();};
buttonsDiv.appendChild(videoBtn);
}
if(u.hasScreen){
const screenBtn=document.createElement('button');
screenBtn.className='media-show-btn screen'+(screenWindows[uniqueKey]?' active':'');
screenBtn.textContent=screenWindows[uniqueKey]?'✓ Экран':'📺 Экран';
screenBtn.title=screenWindows[uniqueKey]?'Закрыть экран':'Смотреть экран';
screenBtn.onclick=()=>{if(screenWindows[uniqueKey]){closeScreenWindow(uniqueKey);}else{if(!screenStreams[u.peerId]&&!u.isSelf){socket.emit('request-media',{userId:u.userId,type:'screen'});showToast('📺 Запрашиваю трансляцию...');setTimeout(()=>{if(screenStreams[u.peerId])openScreenWindow(uniqueKey,u.userName,u.isSelf,u.peerId);updateMediaUsersList();},1500);}else{openScreenWindow(uniqueKey,u.userName,u.isSelf,u.peerId);}}updateMediaUsersList();};
buttonsDiv.appendChild(screenBtn);
}
item.appendChild(buttonsDiv);list.appendChild(item);
});
}
function openVideoWindow(uniqueKey,userName,isSelf,peerId){
if(videoWindows[uniqueKey])return;
const win=document.createElement('div');win.className='video-window';win.style.width='480px';win.style.height='360px';win.style.left=(100+Object.keys(videoWindows).length*30)+'px';win.style.top=(100+Object.keys(videoWindows).length*30)+'px';
const header=document.createElement('div');header.className='video-window-header';
const title=document.createElement('div');title.className='video-window-title';title.textContent='📹 '+userName;
const fullscreenBtn=document.createElement('button');fullscreenBtn.className='video-window-btn';fullscreenBtn.innerHTML='⛶';fullscreenBtn.onclick=()=>toggleVideoFullscreen(uniqueKey);
const closeBtn=document.createElement('button');closeBtn.className='video-window-btn close';closeBtn.innerHTML='✕';closeBtn.onclick=()=>closeVideoWindow(uniqueKey);
header.appendChild(title);header.appendChild(fullscreenBtn);header.appendChild(closeBtn);
const video=document.createElement('video');video.autoplay=true;video.playsInline=true;if(isSelf)video.muted=true;
const resize=document.createElement('div');resize.className='video-window-resize';
win.appendChild(header);win.appendChild(video);win.appendChild(resize);
if(isSelf){const ind=document.createElement('div');ind.className='video-self-indicator';ind.textContent='Вы';win.appendChild(ind);}
document.body.appendChild(win);videoWindows[uniqueKey]=win;
if(isSelf){if(myVideoStream)video.srcObject=myVideoStream;}else{if(videoStreams[peerId])video.srcObject=videoStreams[peerId];}
makeVideoDraggable(win,header);makeVideoResizable(win,resize);
}
function openScreenWindow(uniqueKey,userName,isSelf,peerId){
if(screenWindows[uniqueKey])return;
const win=document.createElement('div');win.className='video-window';win.style.width='640px';win.style.height='480px';win.style.left=(150+Object.keys(screenWindows).length*30)+'px';win.style.top=(150+Object.keys(screenWindows).length*30)+'px';
const header=document.createElement('div');header.className='video-window-header';
const title=document.createElement('div');title.className='video-window-title';title.textContent='📺 '+userName;
const fullscreenBtn=document.createElement('button');fullscreenBtn.className='video-window-btn';fullscreenBtn.innerHTML='⛶';fullscreenBtn.onclick=()=>toggleScreenFullscreen(uniqueKey);
const closeBtn=document.createElement('button');closeBtn.className='video-window-btn close';closeBtn.innerHTML='✕';closeBtn.onclick=()=>closeScreenWindow(uniqueKey);
header.appendChild(title);header.appendChild(fullscreenBtn);header.appendChild(closeBtn);
const video=document.createElement('video');video.autoplay=true;video.playsInline=true;
const resize=document.createElement('div');resize.className='video-window-resize';
win.appendChild(header);win.appendChild(video);win.appendChild(resize);
if(isSelf){const ind=document.createElement('div');ind.className='screen-indicator';ind.textContent='Ваш экран';win.appendChild(ind);}
document.body.appendChild(win);screenWindows[uniqueKey]=win;
if(isSelf){if(myScreenStream)video.srcObject=myScreenStream;}else{if(screenStreams[peerId])video.srcObject=screenStreams[peerId];}
makeVideoDraggable(win,header);makeVideoResizable(win,resize);
}
function closeVideoWindow(uniqueKey){if(videoWindows[uniqueKey]){videoWindows[uniqueKey].remove();delete videoWindows[uniqueKey];updateMediaUsersList();}}
function closeScreenWindow(uniqueKey){if(screenWindows[uniqueKey]){screenWindows[uniqueKey].remove();delete screenWindows[uniqueKey];updateMediaUsersList();}}
function toggleVideoFullscreen(uniqueKey){
const win=videoWindows[uniqueKey];if(!win)return;
win.classList.toggle('fullscreen');
const btn=win.querySelector('.video-window-btn:not(.close)');
if(win.classList.contains('fullscreen')){btn.innerHTML='🗗';win.style.left='';win.style.top='';win.style.right='';win.style.bottom='';win.style.width='';win.style.height='';}
else{btn.innerHTML='⛶';win.style.width='480px';win.style.height='360px';win.style.left='100px';win.style.top='100px';}
}
function toggleScreenFullscreen(uniqueKey){
const win=screenWindows[uniqueKey];if(!win)return;
win.classList.toggle('fullscreen');
const btn=win.querySelector('.video-window-btn:not(.close)');
if(win.classList.contains('fullscreen')){btn.innerHTML='🗗';win.style.left='';win.style.top='';win.style.right='';win.style.bottom='';win.style.width='';win.style.height='';}
else{btn.innerHTML='⛶';win.style.width='640px';win.style.height='480px';win.style.left='150px';win.style.top='150px';}
}
function makeVideoDraggable(win,header){
let isDragging=false,offsetX=0,offsetY=0;
header.addEventListener('mousedown',e=>{if(win.classList.contains('fullscreen'))return;if(e.target.closest('.video-window-btn'))return;isDragging=true;const rect=win.getBoundingClientRect();offsetX=e.clientX-rect.left;offsetY=e.clientY-rect.top;win.style.right='auto';win.style.bottom='auto';e.preventDefault();});
document.addEventListener('mousemove',e=>{if(!isDragging)return;let x=e.clientX-offsetX;let y=e.clientY-offsetY;x=Math.max(0,Math.min(window.innerWidth-win.offsetWidth,x));y=Math.max(0,Math.min(window.innerHeight-win.offsetHeight,y));win.style.left=x+'px';win.style.top=y+'px';});
document.addEventListener('mouseup',()=>{isDragging=false;});
}
function makeVideoResizable(win,resizer){
let isResizing=false,startX,startY,startW,startH,startLeft,startTop;
resizer.addEventListener('mousedown',e=>{if(win.classList.contains('fullscreen'))return;isResizing=true;startX=e.clientX;startY=e.clientY;startW=win.offsetWidth;startH=win.offsetHeight;const rect=win.getBoundingClientRect();startLeft=rect.left;startTop=rect.top;win.style.left=startLeft+'px';win.style.top=startTop+'px';win.style.right='auto';win.style.bottom='auto';e.preventDefault();});
document.addEventListener('mousemove',e=>{if(!isResizing)return;const dx=e.clientX-startX;const dy=e.clientY-startY;const newW=Math.max(240,Math.min(window.innerWidth-startLeft-20,startW+dx));const newH=Math.max(180,Math.min(window.innerHeight-startTop-20,startH+dy));win.style.width=newW+'px';win.style.height=newH+'px';});
document.addEventListener('mouseup',()=>{isResizing=false;});
}
function toggleMic(){if(!myStream||forceMuted){if(forceMuted)showToast(translate('force_muted'),true);return;}isMuted=!isMuted;myStream.getAudioTracks()[0].enabled=!isMuted;updateVoiceControlsInPlayer();syncSelfVoiceState();}
function toggleDeafen(){if(forceDeafened){showToast(translate('force_deafened'),true);return;}isDeafened=!isDeafened;applyDeafenState();updateVoiceControlsInPlayer();syncSelfVoiceState();}
function applyDeafenState(){const shouldBeDeafened=forceDeafened||isDeafened;Object.values(currentCalls).forEach(c=>{if(c._shaperNode){try{if(shouldBeDeafened)c._shaperNode.disconnect();else{const ctx=getGlobalAudioContext();if(ctx)c._shaperNode.connect(ctx.destination);}}catch(e){}}if(c._audioElement&&!c._shaperNode){c._audioElement.muted=shouldBeDeafened;}});}
socket.on('force-voice-update',({action,value})=>{if(action==='mute'){forceMuted=!!value;if(myStream&&myStream.getAudioTracks().length>0){myStream.getAudioTracks()[0].enabled=!forceMuted&&!isMuted;}showToast(forceMuted?translate('force_muted'):translate('unmuted'),forceMuted);}else if(action==='deafen'){forceDeafened=!!value;Object.values(currentCalls).forEach(c=>{if(c._shaperNode){try{if(forceDeafened)c._shaperNode.disconnect();else{const ctx=getGlobalAudioContext();if(ctx)c._shaperNode.connect(ctx.destination);}}catch(e){}}if(c._audioElement&&!c._shaperNode){c._audioElement.muted=forceDeafened||isDeafened;}});showToast(forceDeafened?translate('force_deafened'):translate('undeafened'),forceDeafened);}updateVoiceControlsInPlayer();updateForceStatusBanner();});
function setLocalUserVolume(sid,v){const val=parseFloat(v);const pid=socketToPeer[sid];let tp=pid;if(!tp){for(const p of Object.keys(currentCalls)){if(peerToSocket[p]===sid){tp=p;socketToPeer[sid]=p;break;}}}if(!tp)return;localVolumes[tp]=val;const u=(lastUsersList||[]).find(x=>x.id===sid);if(u)volStoreSet(u.name,val);const c=currentCalls[tp];if(!c)return;const gv=volumeToGain(v);if(c._gainNode){const ctx=getGlobalAudioContext();if(ctx&&ctx.state==='running'){c._gainNode.gain.setTargetAtTime(gv,ctx.currentTime,0.015);return;}}if(c._audioElement)c._audioElement.volume=Math.min(1,gv);}
function onUserVolumeInput(sid,el,rng){let v=parseInt(el.value);if(isNaN(v)||v<0)v=0;if(v>200)v=200;el.value=v;const sv=v/200;if(rng)rng.value=sv;setLocalUserVolume(sid,sv);}
function spinUserVolume(sid,delta,rng,inp){let v=parseInt(inp.value);if(isNaN(v))v=100;v+=delta;if(v<0)v=0;if(v>200)v=200;inp.value=v;onUserVolumeInput(sid,inp,rng);}
socket.on('media-requested', async ({ requesterSocketId, type }) => {
    if (!peer) return;
    const targetPeerId = socketToPeer[requesterSocketId];
    if (!targetPeerId) return;
    try {
        if (type === 'video' && myVideoStream && myVideoEnabled) {
            const call = peer.call(targetPeerId, myVideoStream, {
                metadata: { type: 'video', userId: mySocketId, userName: myNickname, isAdmin: myRole === 'admin', isMod: isMod, isVip: isVip, tabId: TAB_ID }
            });
            handleVideoCall(call);
        } else if (type === 'screen' && myScreenStream && myScreenEnabled) {
            const call = peer.call(targetPeerId, myScreenStream, {
                metadata: { type: 'screen', userId: mySocketId, userName: myNickname, isAdmin: myRole === 'admin', isMod: isMod, isVip: isVip, tabId: TAB_ID }
            });
            handleScreenCall(call);
        }
    } catch (e) { console.error('[media-request]', e); }
});