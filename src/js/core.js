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
let musicGainNode=null,musicShaperNode=null,musicAudioCtx=null,masterVolume=parseFloat(localStorage.getItem('mp_master_volume'));if(isNaN(masterVolume))masterVolume=0.5;
audio.volume=Math.min(1,volumeToGain(masterVolume));
let myVideoStream=null,myVideoEnabled=false,videoCalls={},videoStreams={},videoUserInfo={},videoWindows={},allUsersWithVideo={};
let myScreenStream=null,myScreenEnabled=false,screenCalls={},screenStreams={},screenUserInfo={},screenWindows={},allUsersWithScreen={};
let speakingUsers=new Set(),audioContext=null,analysers={},gains={},myAnalyser=null;
let socketToPeer={},peerToSocket={};
let lastUsersList=null,manageMode=false;
function getGlobalAudioContext(){if(!audioContext){try{audioContext=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(audioContext&&audioContext.state==='suspended')audioContext.resume().catch(()=>{});return audioContext;}