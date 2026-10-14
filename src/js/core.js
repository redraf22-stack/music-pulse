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
// Мастер-громкость: шкала mp_master_volume_pct (-200..+100, 0% = обычная, +100% = ×3).
// mp_master_volume_scale='2' — флаг новой шкалы (2.0.21). Без него значение ещё лежит
// в старой шкале (-200..+200, ×2 на 200%) и переводится без изменения ГРОМКОСТИ:
// старый gain берётся по старой формуле и ищется pct новой шкалы с тем же gain.
// Ещё старее mp_master_volume (0..1 — это просто gain) → тот же путь.
let masterVolumePct=(function(){
    function gainToNewPct(g){
        if(!(g>0))return -200;
        let p;
        if(g>=0.25)p=100*Math.log(g/0.25)/Math.log(3);
        else p=200*Math.log2((g/0.25+1)/2);
        return Math.max(-200,Math.min(100,Math.round(p)));
    }
    const s=localStorage.getItem('mp_master_volume_pct');
    const legacyScale=localStorage.getItem('mp_master_volume_scale');
    let p=null;
    if(s!==null&&!isNaN(parseInt(s,10))){
        if(legacyScale==='2')p=Math.max(-200,Math.min(100,parseInt(s,10)));
        else p=gainToNewPct(0.25*Math.pow(2,Math.max(-200,Math.min(200,parseInt(s,10)))/200)); // старая шкала → новая, громкость та же
    }else{
        const o=parseFloat(localStorage.getItem('mp_master_volume'));
        p=gainToNewPct((!isNaN(o)&&o>0)?o:0.25); // древний ключ (0..1 = gain)
    }
    try{localStorage.setItem('mp_master_volume_pct',String(p));localStorage.setItem('mp_master_volume_scale','2');}catch(e){}
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