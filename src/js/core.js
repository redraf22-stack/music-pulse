// ===== ЯДРО: socket, состояние, аудио-контекст =====
const TAB_ID=Date.now().toString(36)+Math.random().toString(36).substr(2,5);
const socket=io(window.location.origin,{maxHttpBufferSize:10*1024*1024});
const audio=new Audio();
let myRole='',isVip=false,isMod=false,isReady=false;
let currentRoomCode='';
let voteCooldown=0,voteDuration=15,lastVoteTime=0,cooldownTimerInterval=null;
let voiceChatEnabled=false,mySocketId=null,isLeaving=false;
let myNickname='';
let peer=null,myStream=null,currentCalls={};
let isMuted=false,isDeafened=false,isInVoice=false,myPeerId=null;
let forceMuted=false,forceDeafened=false,localVolumes={};
let isRepeat=false,lastSyncTime=0;
let trackChanging=false,currentTrackName='',currentTrackArtist='';
let searchResults=[],currentInbox=[],isSeeking=false;
let localPage=1,localPages=0,isLocalSearch=false,localFilter='';
let isRandomMode=false,isLanOpen=false;
let musicGainNode=null,musicShaperNode=null,musicAudioCtx=null;
// Мастер-громкость: новая шкала mp_master_volume_pct (-200..+200, 0% = обычная).
// Однократная миграция из старого ключа mp_master_volume (0..1): громкость сохраняется,
// но старые «100%» теперь значат «+200%» — как и просил пользователь.
let masterVolumePct=(function(){
    let s=localStorage.getItem('mp_master_volume_pct');
    if(s!==null){const n=parseInt(s,10);if(!isNaN(n))return Math.max(-200,Math.min(200,n));}
    let p=0;
    const o=parseFloat(localStorage.getItem('mp_master_volume'));
    if(!isNaN(o)&&o>0)p=Math.round(200*Math.log2(o/0.25));
    p=Math.max(-200,Math.min(200,p));
    try{localStorage.setItem('mp_master_volume_pct',String(p));}catch(e){}
    return p;
})();
audio.volume=Math.min(1,masterPctToGain(masterVolumePct));
let myVideoStream=null,myVideoEnabled=false,videoCalls={},videoStreams={},videoUserInfo={},videoWindows={},allUsersWithVideo={};
let myScreenStream=null,myScreenEnabled=false,screenCalls={},screenStreams={},screenUserInfo={},screenWindows={},allUsersWithScreen={};
let speakingUsers=new Set(),audioContext=null,analysers={},gains={},myAnalyser=null;
let socketToPeer={},peerToSocket={};
let lastUsersList=null,manageMode=false;
function getGlobalAudioContext(){if(!audioContext){try{audioContext=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(audioContext&&audioContext.state==='suspended')audioContext.resume().catch(()=>{});return audioContext;}
// Применяем настройки устройств после создания audio
setTimeout(()=>{
if(typeof applySpeakerToDevice==='function'){
applySpeakerToDevice().then(r=>{
if(r&&r.ok&&!r.silent)console.log('[speaker] applied in core',r);
}).catch(()=>{});
}
},100);