let serverTimeOffset=0;
function measureServerOffset(){
if(!socket||!socket.connected)return;
const t0=Date.now();
socket.emit('time-sync',t0,function(serverNow){
const t1=Date.now();
serverTimeOffset=serverNow-(t0+(t1-t0)/2);
});
}
setInterval(measureServerOffset,15000);measureServerOffset();
// ===== ПЛЕЕР, ПОИСК, ОЧЕРЕДЬ, ГОЛОСОВАНИЯ =====
const SVG_PLAY='<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const SVG_PAUSE='<svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>';
const SVG_PREV='<svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 6h2v12H6zM18 6l-8.5 6L18 18V6z" fill="currentColor"/></svg>';
const SVG_NEXT='<svg width="16" height="16" viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 6l8.5 6L6 18V6z" fill="currentColor"/></svg>';
const SVG_REPEAT='<svg width="16" height="16" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill="currentColor"/></svg>';
const SVG_QUEUE='<svg width="16" height="16" viewBox="0 0 24 24"><path d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3zM5 19h14v2H5z" fill="currentColor"/></svg>';
let trackLoadedAt=0;
audio.addEventListener('error',()=>{if(trackChanging){trackChanging=false;showToast(translate('load_problem'),true);}});
const searchAC=new CustomAutocomplete('search-input','ac-search-list','ac-search-wrapper','syncmusic_search_history');
document.getElementById('search-input').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();if(searchAC.isOpen&&searchAC.selectedIndex>=0){this.value=searchAC.items[searchAC.selectedIndex];}searchAC.close();setTimeout(()=>{searchMusic();},10);}});
function showReadyButton(){document.getElementById('player-bar').innerHTML=`<div style="width:100%;text-align:center;padding:10px;"><p style="color:var(--sub);margin-bottom:12px;font-size:14px;">${translate('autoplay_blocked')}</p><button class="primary" id="unlock-audio-btn" style="max-width:350px;margin:0 auto;">${escapeHtml(translate('click_to_enable'))}</button></div>`;document.getElementById('unlock-audio-btn').addEventListener('click',enableAudio);}
function enableAudio(){const c=getGlobalAudioContext();if(c&&c.state==='suspended')c.resume();const b=(new(window.AudioContext||window.webkitAudioContext)());const s=b.createBuffer(1,1,22050);const src=b.createBufferSource();src.buffer=s;src.connect(b.destination);src.start(0);audio.src='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';audio.play().then(()=>{isReady=true;audio.pause();audio.currentTime=0;applySpeakerToDevice();initMusicGainNode();restorePlayerBar();}).catch(()=>showAlert('⚠️','Ошибка',translate('no_browser_support')));}
function initMusicGainNode(){if(musicGainNode)return true;try{const c=getGlobalAudioContext();if(!c)return false;if(c.state==='suspended')c.resume();const s=c.createMediaElementSource(audio);musicGainNode=c.createGain();musicGainNode.gain.value=volumeToGain(masterVolume);musicShaperNode=c.createWaveShaper();musicShaperNode.curve=makeSoftClipCurve();musicShaperNode.oversample='4x';s.connect(musicGainNode);musicGainNode.connect(musicShaperNode);musicShaperNode.connect(c.destination);musicAudioCtx=c;return true;}catch(e){return false;}}
function setMasterVolume(v){masterVolume=parseFloat(v);localStorage.setItem('mp_master_volume',String(masterVolume));if(musicGainNode&&musicAudioCtx)musicGainNode.gain.setTargetAtTime(volumeToGain(v),musicAudioCtx.currentTime,0.015);else audio.volume=Math.min(1,volumeToGain(v));}
function restorePlayerBar(){
const bar=document.getElementById('player-bar');const cc=myRole==='admin'||isMod;const sc=cc?'progress-bar can-seek':'progress-bar';const ra=isRepeat?'active':'';const pv=Math.round(masterVolume*200);
bar.innerHTML=`<div class="track-display"><img src="" class="current-cover" id="p-cover" style="display:none"><div class="track-text"><div class="t-title" id="p-title">${translate('waiting')}</div><div class="t-artist" id="p-artist">—</div></div></div><div class="controls"><div class="btn-row"><button class="voice-ctrl-btn" id="vc-mic" onclick="toggleMic()" style="display:none">🎤</button><button class="voice-ctrl-btn" id="vc-deafen" onclick="toggleDeafen()" style="display:none">🎧</button>${cc?`<button class="ctrl-btn" id="prev-btn" onclick="playPrevTrack()" title="Предыдущий">${SVG_PREV}</button>`:''}<button class="ctrl-btn play-btn" id="play-btn" onclick="${cc?'togglePlay()':''}">${SVG_PLAY}</button>${cc?`<button class="ctrl-btn" id="next-btn" onclick="playNextTrack()">${SVG_NEXT}</button>`:''}${cc?`<button class="repeat-btn ${ra}" id="repeat-btn" onclick="toggleRepeat()">${SVG_REPEAT}</button>`:''}</div><div class="progress-wrap"><span id="time-current">0:00</span><input type="range" class="${sc}" id="progress" min="0" max="100" value="0" step="0.1" ${cc?'':'disabled'}><span id="time-total">0:30</span></div></div><div class="master-volume-wrap"><span style="font-size:16px">🔊</span><input type="range" class="master-vol-range" id="master-vol-slider" min="0" max="1" step="0.01" value="${masterVolume}"><div class="volume-input-wrap"><input type="number" class="vol-pct-input" id="master-vol-input" min="0" max="200" value="${pv}" step="1"><div class="vol-spinners"><button class="vol-spinner vol-up" id="master-vol-up" type="button">▲</button><button class="vol-spinner vol-down" id="master-vol-down" type="button">▼</button></div><span class="pct-sign">%</span></div></div>`;
updateVoiceControlsInPlayer();
const mvs=document.getElementById('master-vol-slider');const mvi=document.getElementById('master-vol-input');const mvu=document.getElementById('master-vol-up');const mvd=document.getElementById('master-vol-down');
if(mvs)mvs.oninput=function(){setMasterVolume(this.value);if(mvi)mvi.value=Math.round(parseFloat(this.value)*200);};
if(mvi){mvi.onchange=function(){onMasterVolumeInput(this);};mvi.onblur=function(){onMasterVolumeInput(this);};mvi.onkeydown=function(e){if(e.key==='Enter'){onMasterVolumeInput(this);this.blur();}else if(e.key==='ArrowUp'){e.preventDefault();spinMasterVolume(1);}else if(e.key==='ArrowDown'){e.preventDefault();spinMasterVolume(-1);}};}
if(mvu)mvu.onmousedown=function(e){e.preventDefault();spinMasterVolume(1);};
if(mvd)mvd.onmousedown=function(e){e.preventDefault();spinMasterVolume(-1);};
if(cc){const p=document.getElementById('progress');p.addEventListener('mousedown',()=>{isSeeking=true;});p.addEventListener('touchstart',()=>{isSeeking=true;},{passive:true});p.addEventListener('input',()=>{const pc=p.value;p.style.background=`linear-gradient(to right,var(--accent) ${pc}%,#4d4d4d ${pc}%)`;const c=document.getElementById('time-current');if(c&&audio.duration)c.textContent=formatTime((pc/100)*audio.duration);});p.addEventListener('mouseup',()=>{if(isSeeking){isSeeking=false;seekAudio(p.value);}});p.addEventListener('touchend',()=>{if(isSeeking){isSeeking=false;seekAudio(p.value);}});audio.removeEventListener('timeupdate',updateProgress);audio.addEventListener('timeupdate',updateProgress);audio.removeEventListener('loadedmetadata',onMeta);audio.addEventListener('loadedmetadata',onMeta);audio.removeEventListener('ended',onEnded);audio.addEventListener('ended',onEnded);}else{audio.removeEventListener('timeupdate',updateProgressRO);audio.addEventListener('timeupdate',updateProgressRO);audio.removeEventListener('loadedmetadata',onMeta);audio.addEventListener('loadedmetadata',onMeta);}
}
function onMasterVolumeInput(el){let v=parseInt(el.value);if(isNaN(v)||v<0)v=0;if(v>200)v=200;el.value=v;const sv=v/200;masterVolume=sv;localStorage.setItem('mp_master_volume',String(sv));const s=document.getElementById('master-vol-slider');if(s)s.value=sv;if(musicGainNode&&musicAudioCtx)musicGainNode.gain.setTargetAtTime(volumeToGain(sv),musicAudioCtx.currentTime,0.015);else audio.volume=Math.min(1,volumeToGain(sv));}
function spinMasterVolume(delta){const el=document.getElementById('master-vol-input');if(!el)return;let v=parseInt(el.value);if(isNaN(v))v=100;v+=delta;if(v<0)v=0;if(v>200)v=200;el.value=v;onMasterVolumeInput(el);}
function onMeta(){const e=document.getElementById('time-total');if(e)e.textContent=formatTime(audio.duration);}
function onEnded(){if(isRepeat){audio.currentTime=0;audio.play().catch(()=>{setTimeout(()=>audio.play().catch(()=>{}),100);});if(myRole==='admin'||isMod)socket.emit('update-state',{currentTime:0,playing:true});}else{if(myRole==='admin'||isMod)socket.emit('play-next');}}
function toggleRepeat(){if(myRole!=='admin'&&!isMod)return;isRepeat=!isRepeat;const b=document.getElementById('repeat-btn');if(b)b.classList.toggle('active',isRepeat);socket.emit('update-state',{isRepeat:isRepeat});}
function playNextTrack(){if(myRole!=='admin'&&!isMod)return;isRepeat=false;const b=document.getElementById('repeat-btn');if(b)b.classList.remove('active');socket.emit('update-state',{isRepeat:false});socket.emit('play-next');}
function playPrevTrack(){if(myRole!=='admin'&&!isMod)return;socket.emit('play-prev');}
function togglePlay(){if(myRole!=='admin'&&!isMod)return;socket.emit('update-state',{playing:audio.paused,currentTime:audio.currentTime});}
function updateProgress(){if(isSeeking)return;const p=document.getElementById('progress'),c=document.getElementById('time-current');if(!p||!audio.duration)return;const pc=(audio.currentTime/audio.duration)*100;p.value=pc;if(c)c.textContent=formatTime(audio.currentTime);p.style.background=`linear-gradient(to right,var(--accent) ${pc}%,#4d4d4d ${pc}%)`;}
function updateProgressRO(){const p=document.getElementById('progress'),c=document.getElementById('time-current');if(!p||!audio.duration)return;const pc=(audio.currentTime/audio.duration)*100;p.value=pc;if(c)c.textContent=formatTime(audio.currentTime);p.style.background=`linear-gradient(to right,var(--accent) ${pc}%,#4d4d4d ${pc}%)`;}
function seekAudio(pc){if(!audio.duration||(myRole!=='admin'&&!isMod))return;audio.currentTime=(pc/100)*audio.duration;socket.emit('seek',audio.currentTime);}
socket.on('sync',state=>{
const ti=document.getElementById('p-title'),a=document.getElementById('p-artist'),p=document.getElementById('play-btn'),c=document.getElementById('p-cover');
if(ti&&state.trackName!==undefined)ti.textContent=state.trackName||translate('waiting');
if(a&&state.trackArtist!==undefined)a.textContent=state.trackArtist||'—';
if(p&&state.playing!==undefined)p.innerHTML=state.playing?SVG_PAUSE:SVG_PLAY;
if(c){if(state.trackCover!==undefined){if(state.trackCover){c.src=state.trackCover;c.style.display='block';}else c.style.display='none';}}
if(state.isRepeat!==undefined){isRepeat=!!state.isRepeat;const rb=document.getElementById('repeat-btn');if(rb)rb.classList.toggle('active',isRepeat);}
updateQueueTrackInfo(state);
const ns=state.trackUrl?(window.location.origin+state.trackUrl):'';
const trackIdentity=(state.trackName||'')+'|'+(state.trackArtist||'');
const prevIdentity=currentTrackName+'|'+currentTrackArtist;
const identityChanged=trackIdentity!==prevIdentity;
const urlChanged=ns&&audio.src!==ns;
if(ns&&(urlChanged||identityChanged)){
trackChanging=true;currentTrackName=state.trackName||'';currentTrackArtist=state.trackArtist||'';
audio.pause();audio.src=ns;audio.load();
const onReady=()=>{if(audio.readyState<2){setTimeout(onReady,100);return;}if(audio.duration&&state.currentTime>=0){try{audio.currentTime=state.currentTime;}catch(e){}}if(state.playing&&isReady){audio.play().then(()=>{if(myRole==='admin'||isMod)socket.emit('update-state',{playing:true,currentTime:audio.currentTime||0});}).catch(()=>{});}else{audio.pause();}trackChanging=false;lastSyncTime=Date.now();trackLoadedAt=Date.now();audio.removeEventListener('canplay',onReady);audio.removeEventListener('loadedmetadata',onReady);};
audio.addEventListener('canplay',onReady,{once:true});
audio.addEventListener('loadedmetadata',onReady,{once:true});
setTimeout(()=>{if(trackChanging){trackChanging=false;showToast(translate('load_problem'),true);}},60000);
return;
}
if(!trackChanging&&state.trackUrl){
if(state.isSeek&&audio.readyState>=2){audio.currentTime=state.currentTime;lastSyncTime=Date.now();}
else if(!isSeeking&&Date.now()-trackLoadedAt>5000){
const expected=(state.playing&&state.startedAt)?(Date.now()+serverTimeOffset-state.startedAt)/1000:(state.currentTime||0);
if(expected>=0&&(!audio.duration||expected<=audio.duration)){
const diff=Math.abs(audio.currentTime-expected);
if(diff>2&&audio.readyState>=2){audio.currentTime=expected;}
}
}
}
lastSyncTime=Date.now();
if(state.playing&&isReady){if(audio.paused&&!audio.ended)audio.play().catch(()=>{});}else if(!state.playing){if(!audio.paused)audio.pause();}
});
function updateQueueTrackInfo(st){
const np=document.getElementById('queue-now-playing'),pt=document.getElementById('queue-prev-track');
if(st.trackName!==undefined){if(st.trackName&&st.trackUrl){np.style.display='flex';document.getElementById('qnp-title').textContent=st.trackName||'—';document.getElementById('qnp-artist').textContent=st.trackArtist||'—';const nc=document.getElementById('qnp-cover');if(st.trackCover){nc.src=st.trackCover;nc.style.display='block';}else nc.style.display='none';}else np.style.display='none';}
const pr=st.prevTrack;
if(pr&&(pr.trackName||pr.title)){pt.style.display='flex';document.getElementById('qpt-title').textContent=pr.trackName||pr.title||'—';let pa='';if(pr.trackArtist&&typeof pr.trackArtist==='object')pa=pr.trackArtist.name||'';else if(pr.artist&&typeof pr.artist==='object')pa=pr.artist.name||'';else pa=pr.trackArtist||pr.artist||'?';document.getElementById('qpt-artist').textContent=pa;const pc=document.getElementById('qpt-cover');const cu=pr.trackCover||pr.cover||'';if(cu){pc.src=cu;pc.style.display='block';}else pc.style.display='none';}else pt.style.display='none';
}
async function searchMusic(page=1){
const el=document.getElementById('search-input');const query=el.value.trim();if(!query)return;searchAC.addToHistory(query);
const btn=document.querySelector('#search-panel input[type="text"]');const origPh=btn.placeholder;btn.disabled=true;
const pagDiv=document.getElementById('pagination');const localTags=['#скачанное','#full','#скаченное','#downloaded'];const lowerQuery=query.toLowerCase();let matchedTag=null;
for(const tag of localTags){if(lowerQuery.startsWith(tag)){matchedTag=tag;break;}}
try{
if(matchedTag){isLocalSearch=true;localPage=page;localFilter=query.substring(matchedTag.length).trim();const params=new URLSearchParams({page:String(page)});if(myNickname)params.set('owner',myNickname);if(currentRoomCode)params.set('room',currentRoomCode);
if(localFilter)params.set('filter',localFilter);const res=await fetch(`/api/local-tracks?${params}`);const data=await res.json();searchResults=data.data||[];localPages=data.pages||0;if(!searchResults.length){document.getElementById('results').innerHTML=localFilter?`<div style="padding:20px;color:var(--sub)">${translate('nothing_found_filter',{filter:escapeHtml(localFilter)})}</div>`:`<div style="padding:20px;color:var(--sub)">${escapeHtml(translate('no_local_tracks'))}</div>`;pagDiv.style.display='none';return;}renderSearchResults();renderPagination(data.page,data.pages);}
else{isLocalSearch=false;localPage=1;localFilter='';const params=new URLSearchParams({q:query,page:String(page)});if(myNickname)params.set('owner',myNickname);if(currentRoomCode)params.set('room',currentRoomCode);
const res=await fetch(`/api/search?${params}`);const data=await res.json();if(!data.data?.length){document.getElementById('results').innerHTML=`<div style="padding:20px;color:var(--sub)">${escapeHtml(translate('nothing_found'))}</div>`;searchResults=[];pagDiv.style.display='none';return;}searchResults=data.data;renderSearchResults();renderPagination(data.page,data.pages);}
}catch(e){console.error(e);showToast(translate('search_error'),true);}finally{btn.disabled=false;btn.placeholder=origPh;}
}
function renderPagination(currentPage,totalPages){const p=document.getElementById('pagination');if(totalPages<=1){p.style.display='none';return;}p.style.display='flex';p.innerHTML=`<button class="page-btn" onclick="searchMusic(${currentPage-1})" ${currentPage<=1?'disabled':''}>${escapeHtml(translate('back'))}</button><span class="page-info">${translate('page_of',{cur:currentPage,total:totalPages})}</span><button class="page-btn" onclick="searchMusic(${currentPage+1})" ${currentPage>=totalPages?'disabled':''}>${escapeHtml(translate('forward'))}</button>`;}
function extractArtist(tr){if(!tr)return'?';if(typeof tr.artist==='object'&&tr.artist)return tr.artist.name||tr.artist||'?';return tr.artist||'?';}
function renderSearchResults(){
if(!searchResults.length)return;const cc=myRole==='admin'||isMod,cq=myRole==='admin'||isMod||isVip,cp=myRole==='admin'||isMod;
document.getElementById('results').innerHTML='';const el=document.getElementById('results');
searchResults.forEach((tr,i)=>{
const d=document.createElement('div');d.className='track-card';const ti=tr.title||'';const an=extractArtist(tr);const du=Math.floor((tr.duration||30)/60)+':'+String(Math.floor((tr.duration||30)%60)).padStart(2,'0');
if(tr.isLocal){const b=document.createElement('div');b.className='local-badge'+(tr.isUrl?' url-badge':'');b.textContent=tr.isUrl?'🔗 Full url':translate('local_badge');d.appendChild(b);}
const img=document.createElement('img');img.src=tr.album?.cover_small||tr.cover||'';img.width=56;img.height=56;img.loading='lazy';img.onerror=function(){this.style.background='#333';this.src='';};d.appendChild(img);
const m=document.createElement('div');m.className='track-meta';m.style.flex='1';const te=document.createElement('b');te.textContent=ti;m.appendChild(te);const ae=document.createElement('span');ae.textContent=escapeHtml(an)+' • '+(tr.isUrl?'🔗 URL':tr.isLocal?'💾 Local':du);m.appendChild(ae);d.appendChild(m);
let a=document.createElement('div');a.className='track-actions';
if(cc||cq){if(cq){const qb=document.createElement('button');qb.className='action-btn btn-queue';qb.innerHTML=SVG_QUEUE;qb.onclick=()=>addToQueue(i);a.appendChild(qb);}if(cp){const pb=document.createElement('button');pb.className='action-btn btn-poll';pb.textContent=translate('start_poll');pb.onclick=()=>startPoll(i);a.appendChild(pb);}if(cc){const pl=document.createElement('button');pl.className='action-btn btn-play';pl.innerHTML='<svg width="16" height="18" viewBox="0 0 16 18"><path d="M14.5 7.268a2 2 0 0 1 0 3.464L3.5 17.268a2 2 0 0 1-3-1.732V2.464a2 2 0 0 1 3-1.732l11 6.536Z" fill="currentColor"/></svg>';pl.onclick=()=>selectTrack(i);a.appendChild(pl);}}
else{const n=Date.now();const tl=Math.max(0,Math.ceil(((voteCooldown*1000)-(n-lastVoteTime))/1000));const dis=tl>0;const sb=document.createElement('button');sb.className='action-btn btn-suggest';if(dis)sb.disabled=true;sb.onclick=()=>suggestTrack(i);sb.innerHTML='📩'+(dis?`<span class="cooldown-timer">${tl}s</span>`:'');a.appendChild(sb);}
d.appendChild(a);el.appendChild(d);
});
}
function selectTrack(i){if(myRole!=='admin'&&!isMod)return;const tr=searchResults[i];if(!tr)return;if(isRandomMode){socket.emit('toggle-random-mode');}let u=tr.preview;if(!tr.isLocal)u=`/proxy?url=${encodeURIComponent(tr.preview)}`;socket.emit('update-state',{trackName:tr.title,trackArtist:extractArtist(tr),trackCover:tr.album?.cover_small||tr.cover||'',trackUrl:u,isLocal:tr.isLocal,playing:true,currentTime:0});}
function startPoll(i){if(myRole!=='admin'&&!isMod)return;const tr=searchResults[i];if(!tr)return;socket.emit('start-poll',tr);}
function addToQueue(i){if(myRole!=='admin'&&!isMod&&!isVip)return;const tr=searchResults[i];if(!tr)return;socket.emit('add-to-queue',tr);}
function suggestTrack(i){if(myRole==='admin'||isMod||isVip)return;const n=Date.now();if(n-lastVoteTime<voteCooldown*1000)return;const tr=searchResults[i];if(!tr)return;socket.emit('suggest-track',tr);lastVoteTime=n;renderSearchResults();}
socket.on('vote-error',m=>{showToast(m,true);renderSearchResults();});
socket.on('poll-start',tr=>{const m=document.getElementById('poll-modal');document.getElementById('poll-title').textContent=tr.title||'';document.getElementById('poll-artist').textContent=extractArtist(tr);document.getElementById('poll-cover').src=tr.album?.cover_small||tr.cover||'';m.style.display='flex';});
function castVote(t){socket.emit('cast-vote',t);document.getElementById('poll-modal').style.display='none';showToast(translate('vote_accepted'));}
socket.on('poll-close',()=>{document.getElementById('poll-modal').style.display='none';});
socket.on('inbox-update',ib=>{if(myRole!=='admin'&&!isMod){currentInbox=[];renderInbox();return;}currentInbox=ib;renderInbox();});
function renderInbox(){const m=document.getElementById('inbox-modal');if((myRole!=='admin'&&!isMod)||!currentInbox.length){m.style.display='none';m.innerHTML='';return;}const s=currentInbox[0];m.style.display='flex';m.innerHTML='';let ah='';if(s.isPoll){ah=`<div class="inbox-actions"><span style="color:var(--accent);font-size:12px">${escapeHtml(translate('poll_voting'))}</span></div>`;}else{let pb='';if(!s.pollResults&&s.suggestedBy&&!s.suggestedBy.includes('Админ')&&!s.suggestedBy.includes('Мод')&&!s.suggestedBy.includes('👑')&&!s.suggestedBy.includes('🛡️'))pb=`<button class="ib-btn ib-poll" onclick="startGuestPoll('${escapeHtml(s.id)}')">${escapeHtml(translate('start_poll'))}</button>`;ah=`<div class="inbox-actions" style="display:flex"><button class="ib-btn ib-now" onclick="resolveInbox('${escapeHtml(s.id)}','now')">${escapeHtml(translate('play_now'))}</button>${pb}<button class="ib-btn ib-next" onclick="resolveInbox('${escapeHtml(s.id)}','next')">${escapeHtml(translate('next_queue'))}</button><button class="ib-btn ib-end" onclick="resolveInbox('${escapeHtml(s.id)}','end')">${escapeHtml(translate('end_queue'))}</button><button class="ib-btn ib-reject" onclick="resolveInbox('${escapeHtml(s.id)}','reject')">${escapeHtml(translate('reject'))}</button></div>`;}let rh='';if(s.pollResults){const r=s.pollResults;rh=`<div class="poll-results"><div style="display:flex;justify-content:space-between"><span>👍 ${r.for}%</span><span>👎 ${r.against}%</span><span>😐 ${r.neutral}%</span></div><div style="display:flex;height:4px;width:100%;border-radius:2px;overflow:hidden;margin-top:2px"><div class="result-fill fill-for" style="width:${r.for}%"></div><div class="result-fill fill-neutral" style="width:${r.neutral}%"></div><div class="result-fill fill-against" style="width:${r.against}%"></div></div><span style="font-size:10px;color:#666">${translate('total_votes',{n:r.total})}</span></div>`;}m.innerHTML=`<img src="${escapeHtml(s.cover||'')}" width="50" height="50" onerror="this.src=''"><div class="inbox-info"><b>${escapeHtml((s.isLocal?'💾 ':'')+(s.title||''))}</b><span>${escapeHtml(s.artist||'')} • ${escapeHtml(translate('suggested_by'))} ${escapeHtml(s.suggestedBy||'?')}</span>${rh}</div>${ah}`;}
function startGuestPoll(id){const tr=currentInbox.find(x=>x.id===id);if(tr)socket.emit('start-poll',tr);}
function resolveInbox(id,ac){socket.emit('resolve-inbox',{id:id,action:ac});}
socket.on('queue-update',q=>{document.getElementById('queue-count').textContent=q.length;const qp=document.getElementById('queue-plural');if(qp){const m=q.length%100;qp.textContent=(typeof currentLang!=='undefined'&&currentLang==='en')?'tracks':((m>=11&&m<=14)?'треков':(q.length%10===1?'трек':([2,3,4].includes(q.length%10)?'трека':'треков')));}const l=document.getElementById('queue-list');if(!l)return;if(!q.length){l.innerHTML=`<div style="color:var(--sub);font-size:13px;padding:12px;text-align:center;">${escapeHtml(translate('queue_empty'))}</div>`;return;}const cq=myRole==='admin'||isMod||isVip;l.innerHTML='';q.forEach((s,i)=>{const d=document.createElement('div');d.className='queue-item';const n=document.createElement('span');n.className='queue-num';n.textContent=String(i+1);d.appendChild(n);const img=document.createElement('img');img.src=s.cover||'';img.width=36;img.height=36;img.loading='lazy';img.onerror=function(){this.style.background='#333';this.src='';};d.appendChild(img);const inf=document.createElement('div');inf.className='queue-info';const tb=document.createElement('b');tb.textContent=((s.isUrl?'🔗 ':s.isLocal?'💾 ':''))+(s.title||'');inf.appendChild(tb);const sp=document.createElement('span');sp.textContent=((s.artist&&s.artist.name)||s.artist||'?')+' • '+(s.suggestedBy||'?').replace('🔀','');inf.appendChild(sp);d.appendChild(inf);if(cq){const cd=document.createElement('div');cd.className='queue-controls';const ub=document.createElement('button');ub.className='q-btn';ub.textContent='▲';ub.onclick=()=>moveTrack(s.id,'up');if(i===0)ub.disabled=true;const db=document.createElement('button');db.className='q-btn';db.textContent='▼';db.onclick=()=>moveTrack(s.id,'down');if(i===q.length-1)db.disabled=true;cd.appendChild(ub);cd.appendChild(db);d.appendChild(cd);}if(myRole==='admin'||isMod){const rb=document.createElement('button');rb.className='queue-remove';rb.textContent='✕';rb.onclick=()=>removeFromQueue(s.id);d.appendChild(rb);}l.appendChild(d);});});
function moveTrack(id,dir){if(myRole!=='admin'&&!isMod&&!isVip)return;socket.emit('reorder-queue',{id:id,direction:dir});}
function removeFromQueue(id){if(myRole!=='admin'&&!isMod)return;socket.emit('remove-from-queue',id);}
socket.on('settings-update',s=>{if(s.voteCooldown!==undefined){voteCooldown=s.voteCooldown;if(myRole==='admin')document.getElementById('cooldown-input').value=voteCooldown;}if(s.voteDuration!==undefined){voteDuration=s.voteDuration;if(myRole==='admin')document.getElementById('vote-duration-input').value=voteDuration;}searchMusic();});
socket.on('random-mode-update',e=>{isRandomMode=e;const b=document.getElementById('random-toggle-btn');if(b)b.classList.toggle('active',isRandomMode);});
function toggleRandomMode(){if(myRole!=='admin'&&!isMod)return;socket.emit('toggle-random-mode');}
// ===== ТРЕКИ ПО URL =====
let pendingUrlCover='';
function openUrlTrackModal(){
document.getElementById('url-title').value='';document.getElementById('url-artist').value='';document.getElementById('url-album').value='';document.getElementById('url-link').value='';
document.getElementById('url-auto-cover').checked=true;pendingUrlCover='';
document.getElementById('url-cover-preview').src='';
document.getElementById('url-track-modal').classList.add('open');
}
function closeUrlTrackModal(){document.getElementById('url-track-modal').classList.remove('open');}
async function pickUrlCover(e){
const f=e.target.files[0];if(!f)return;
const fd=new FormData();fd.append('file',f);
try{const r=await fetch('/api/upload-chat',{method:'POST',body:fd});const d=await r.json();if(d.success){pendingUrlCover=d.url;document.getElementById('url-cover-preview').src=d.url;}}catch(err){showToast('Ошибка загрузки обложки',true);}
e.target.value='';
}
async function saveUrlTrack(){
const url=document.getElementById('url-link').value.trim();
if(!url||!/^https?:\/\//i.test(url)){showToast('Вставь ссылку (https://...)',true);return;}
showToast('⏳ Проверяю ссылку...');
let rd;
try{
const r=await fetch('/api/resolve-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})});
rd=await r.json();
}catch(e){showToast('Ошибка проверки ссылки',true);return;}
if(!rd.ok){showToast(rd.error||'Не удалось распознать ссылку',true);return;}
// авто-заполнение пустых полей из метаданных
if(rd.title&&!document.getElementById('url-title').value.trim())document.getElementById('url-title').value=rd.title;
if(rd.artist&&!document.getElementById('url-artist').value.trim())document.getElementById('url-artist').value=rd.artist;
if(rd.album&&!document.getElementById('url-album').value.trim())document.getElementById('url-album').value=rd.album;
const title=document.getElementById('url-title').value.trim()||rd.title||'Без названия';
const body={owner:myNickname,title:title,
artist:document.getElementById('url-artist').value.trim()||'Unknown Artist',
album:document.getElementById('url-album').value.trim(),
url:rd.streamUrl,
cover:pendingUrlCover||(rd.cover||''),
autoCover:document.getElementById('url-auto-cover').checked&&!rd.cover&&!pendingUrlCover};
try{
const r2=await fetch('/api/url-track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const d=await r2.json();
if(d.success){closeUrlTrackModal();showToast('🔗 Трек сохранён!');searchMusic(1);}
else showToast(d.error||'Ошибка сохранения',true);
}catch(e){showToast('Ошибка сохранения',true);}
}
// ===== ДОБАВЛЕНИЕ ФАЙЛОМ =====
let pendingMusicId='';
let pendingFtCover='';
async function pickFtCover(e){
const f=e.target.files[0];if(!f)return;
const fd=new FormData();fd.append('file',f);
try{const r=await fetch('/api/upload-chat',{method:'POST',body:fd});const d=await r.json();if(d.success){pendingFtCover=d.url;document.getElementById('ft-cover-preview').src=d.url;document.getElementById('ft-auto-cover').checked=false;}}catch(err){showToast('Ошибка загрузки обложки',true);}
e.target.value='';
}
function toggleAddMenu(){const m=document.getElementById('add-menu');if(!m.style.display||m.style.display==='none'){const b=document.getElementById('add-url-btn');const r=b.getBoundingClientRect();m.style.left=r.left+'px';m.style.top=(r.bottom+6)+'px';m.style.display='flex';}else{m.style.display='none';}}
function closeAddMenu(){document.getElementById('add-menu').style.display='none';}
document.addEventListener('click',e=>{if(!e.target.closest('#add-menu')&&!e.target.closest('#add-url-btn'))closeAddMenu();});
function openFileTrackModal(){closeAddMenu();pendingMusicId='';pendingFtCover='';document.getElementById('ft-file').value='';document.getElementById('ft-cover-input').value='';document.getElementById('ft-cover-preview').src='';document.getElementById('ft-auto-cover').checked=true;document.getElementById('ft-title').value='';document.getElementById('ft-artist').value='';document.getElementById('ft-album').value='';document.getElementById('ft-status').textContent='';const pb=document.getElementById('ft-pick-btn');pb.textContent='📂 Выбрать файл…';pb.classList.remove('has');document.getElementById('file-track-modal').classList.add('open');}
function closeFileTrackModal(){document.getElementById('file-track-modal').classList.remove('open');}
async function pickMusicFile(e){
const f=e.target.files[0];if(!f)return;
const pb=document.getElementById('ft-pick-btn');pb.textContent='📂 '+f.name;pb.classList.add('has');
document.getElementById('ft-status').textContent='⏳ Загружаю и читаю теги...';
const fd=new FormData();fd.append('file',f);
try{
const r=await fetch('/api/upload-music',{method:'POST',body:fd});const d=await r.json();
if(d.success){pendingMusicId=d.id;document.getElementById('ft-title').value=d.title||'';document.getElementById('ft-artist').value=d.artist||'';document.getElementById('ft-album').value=d.album||'';if(d.cover){pendingFtCover=d.cover;document.getElementById('ft-cover-preview').src=d.cover;document.getElementById('ft-auto-cover').checked=false;document.getElementById('ft-status').textContent='✅ Теги и обложка считаны из файла.';}else{document.getElementById('ft-auto-cover').checked=true;document.getElementById('ft-status').textContent='✅ Теги считаны. Обложки в файле нет — подберём по названию.';}}
else showToast(d.error||'Ошибка загрузки',true);
}catch(err){showToast('Ошибка загрузки',true);}
}
async function confirmMusicFile(){
if(!pendingMusicId){showToast('Сначала выбери файл',true);return;}
const title=document.getElementById('ft-title').value.trim();if(!title){showToast('Укажи название',true);return;}
try{
const r=await fetch('/api/confirm-music',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pendingMusicId,title:title,artist:document.getElementById('ft-artist').value.trim()||'Unknown Artist',album:document.getElementById('ft-album').value.trim(),owner:myNickname,cover:document.getElementById('ft-auto-cover').checked?'':pendingFtCover})});
const d=await r.json();
if(d.success){closeFileTrackModal();showToast('💾 Добавлено! Включи трек галочкой в настройках плейлиста.');socket.emit('tracks-changed');searchMusic(1);}
else showToast(d.error||'Ошибка',true);
}catch(e){showToast('Ошибка сохранения',true);}
}
// ===== МОЯ МУЗЫКА И РЕДАКТИРОВАНИЕ =====
let editingTrack=null;
let myMusicTracks=[];
async function openMyMusic(){
const c=document.getElementById('my-music-content');c.innerHTML='<div style="color:var(--sub);padding:20px;text-align:center;">Загрузка...</div>';
document.getElementById('my-music-modal').classList.add('open');
try{
const r=await fetch('/api/my-tracks?owner='+encodeURIComponent(myNickname)+'&room='+encodeURIComponent(currentRoomCode));
const d=await r.json();
if(d.error){c.innerHTML='<div style="color:var(--sub);padding:20px;text-align:center;">Ошибка: '+escapeHtml(d.error)+'</div>';return;}
myMusicTracks=d.data||[];
const si=document.getElementById('my-music-search');if(si)si.value='';
renderMyMusicList('');
}catch(e){c.innerHTML='<div style="color:var(--sub);padding:20px;text-align:center;">Ошибка загрузки</div>';}
}
function renderMyMusicList(filter){
const c=document.getElementById('my-music-content');if(!c)return;
const f=(filter||'').toLowerCase().trim();
const tracks=f?myMusicTracks.filter(t=>((t.title||'')+' '+(((t.artist&&t.artist.name)||t.artist||''))).toLowerCase().includes(f)):myMusicTracks;
if(!tracks.length){c.innerHTML='<div style="color:var(--sub);padding:20px;text-align:center;">'+(myMusicTracks.length?'Ничего не найдено':'У тебя пока нет треков.<br>Добавь через ➕')+'</div>';return;}
c.innerHTML='';
tracks.forEach(t=>{
const item=document.createElement('div');item.className='my-music-item';
const img=document.createElement('img');img.src=t.cover||'';img.onerror=function(){this.style.background='#333';this.src='';};item.appendChild(img);
const info=document.createElement('div');info.className='mm-info';
const title=document.createElement('div');title.className='mm-title';title.textContent=t.title||'Без названия';info.appendChild(title);
const artist=document.createElement('div');artist.className='mm-artist';artist.textContent=(t.artist&&t.artist.name)||t.artist||'Unknown Artist';info.appendChild(artist);
item.appendChild(info);
const badge=document.createElement('div');badge.className='mm-badge';badge.textContent=t.type==='url'?'🔗 URL':(t.type==='shared'?'📤 Общая':'💾 Файл');item.appendChild(badge);
const del=document.createElement('button');del.className='mm-del';del.textContent='🗑';del.title='Удалить';del.onclick=(e)=>{e.stopPropagation();deleteMyTrack(t);};item.appendChild(del);
item.ondblclick=()=>openEditTrack(t);
c.appendChild(item);
});
}
function deleteMyTrack(t){
const msg=t.type==='url'?'Убрать трек из списка URL? Сам файл не удаляется.':'Удалить файл с диска БЕЗВОЗВРАТНО?';
showConfirm('🗑','Удаление',msg,async()=>{
try{
const r=await fetch('/api/delete-track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:t.type,id:t.type==='url'?t.id:t.filename,owner:myNickname})});
const d=await r.json();
if(d.success){showToast('🗑 Удалено.');socket.emit('tracks-changed');openMyMusic();searchMusic(1);}
else showToast(d.error||'Ошибка',true);
}catch(e){showToast('Ошибка удаления',true);}
});
}
function closeMyMusic(){document.getElementById('my-music-modal').classList.remove('open');}
function openEditTrack(t){
editingTrack=t;editingTrack._newCover='';
const artistName=(t.artist&&t.artist.name)||t.artist||'';
document.getElementById('et-title-modal').textContent='⚙ '+(t.title||'Без названия');
document.getElementById('et-fields').innerHTML=`
<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">
<div style="position:relative;flex-shrink:0;">
<img id="et-cover-preview" src="${escapeHtml(t.cover||'')}" width="72" height="72" style="border-radius:8px;background:#333;object-fit:cover;display:block;">
<button style="position:absolute;bottom:-8px;right:-8px;width:28px;height:28px;border-radius:50%;border:none;background:var(--accent);color:black;cursor:pointer;font-size:13px;" onclick="document.getElementById('et-cover-input').click()" title="Выбрать фото">📷</button>
<input type="file" id="et-cover-input" accept="image/*" style="display:none;" onchange="pickEtCover(event)">
</div>
<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sub);cursor:pointer;"><input type="checkbox" id="et-auto-cover"${t.autoCover?' checked':''}> Авто-обложка (по названию)</label>
</div>
<div class="url-field"><label>Название *</label><input type="text" id="et-title" value="${escapeHtml(t.title||'')}"></div>
<div class="url-field"><label>Исполнитель</label><input type="text" id="et-artist" value="${escapeHtml(artistName)}"></div>
<div class="url-field"><label>Альбом</label><input type="text" id="et-album" value="${escapeHtml(t.album||'')}"></div>
${t.type==='url'?`<div class="url-field"><label>Ссылка на трек</label><input type="text" id="et-url" value="${escapeHtml(t.url||'')}"></div>`:''}`;
document.getElementById('edit-track-modal').classList.add('open');
const ac=document.getElementById('et-auto-cover');
if(ac)ac.onchange=function(){const pv=document.getElementById('et-cover-preview');if(!pv||!editingTrack)return;if(this.checked){pv.src=editingTrack.cover||'';}else if(!editingTrack._newCover){pv.src=editingTrack.prevCover||editingTrack.cover||'';}};
}
function closeEditTrack(){document.getElementById('edit-track-modal').classList.remove('open');editingTrack=null;}
async function pickEtCover(e){
const f=e.target.files[0];if(!f)return;
const fd=new FormData();fd.append('file',f);
try{const r=await fetch('/api/upload-chat',{method:'POST',body:fd});const d=await r.json();if(d.success){document.getElementById('et-cover-preview').src=d.url;editingTrack._newCover=d.url;document.getElementById('et-auto-cover').checked=false;}}catch(err){showToast('Ошибка загрузки',true);}
e.target.value='';
}
async function saveEditTrack(){
if(!editingTrack)return;
const autoChecked=document.getElementById('et-auto-cover').checked;
const data={title:document.getElementById('et-title').value.trim()||editingTrack.title,artist:document.getElementById('et-artist').value.trim()||'Unknown Artist',album:document.getElementById('et-album').value.trim()||'',cover:autoChecked?'':(editingTrack._newCover||editingTrack.prevCover||editingTrack.cover||''),autoCover:autoChecked,url:(document.getElementById('et-url')?document.getElementById('et-url').value.trim():'')};
try{
const r=await fetch('/api/update-track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:editingTrack.type,id:editingTrack.type==='url'?editingTrack.id:(editingTrack.type==='shared'?editingTrack.file:editingTrack.filename),owner:myNickname,data:data})});
const d=await r.json();
if(d.success){closeEditTrack();showToast('✅ Сохранено! Изменения видны всем.');socket.emit('tracks-changed');openMyMusic();searchMusic(1);}
else showToast(d.error||'Ошибка',true);
}catch(e){showToast('Ошибка сохранения',true);}
}
socket.on('tracks-refresh',()=>{
if(document.getElementById('my-music-modal').classList.contains('open'))openMyMusic();
const q=document.getElementById('search-input').value.trim();
if(q)searchMusic(1);
});