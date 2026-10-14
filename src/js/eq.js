// ===== ЭКВАЛАЙЗЕР МУЗЫКИ (WebAudio, 5 полос) =====
// Цепочка: audio → musicGainNode → [5 peaking-фильтров] → musicShaperNode → destination.
// Фильтры втыкает eqBuild(), которую зовёт initMusicGainNode() из player.js.
// В Electron цепочки WebAudio изначально нет (нет unlock-экрана) — она создаётся
// лениво при первом открытии эквалайзера (это пользовательский жест, контекст стартует).
// Затрагивает только музыку комнаты: голос идёт отдельными узлами в voice.js.
// Хранение: localStorage.mp_eq = {on:false, g:[-12..12 × 5]}
const EQ_BANDS=[60,230,910,3600,14000];
const EQ_FREQ_LABELS=['60','230','910','3.6k','14k'];
const EQ_PRESETS={
    eq_p_bass:[6,4,1,-1,-2],
    eq_p_pop:[-1,2,4,3,0],
    eq_p_rock:[5,3,-1,3,5],
    eq_p_vocal:[-2,-1,3,5,4],
    eq_p_treble:[-2,0,0,3,6]
};
let eqFilters=null,eqCfg=null;

function eqLoad(){
    if(eqCfg)return eqCfg;
    let c=null;try{c=JSON.parse(localStorage.getItem('mp_eq')||'null');}catch(e){}
    if(!c||typeof c!=='object')c={};
    if(typeof c.on!=='boolean')c.on=false;
    if(!Array.isArray(c.g)||c.g.length!==EQ_BANDS.length)c.g=EQ_BANDS.map(()=>0);
    else c.g=c.g.map(v=>{v=parseFloat(v);return isNaN(v)?0:Math.max(-12,Math.min(12,v));});
    eqCfg=c;return c;
}
function eqSave(){try{localStorage.setItem('mp_eq',JSON.stringify(eqCfg));}catch(e){}}

// Строит цепочку фильтров и подключает input→фильтры→output. Вызывается из initMusicGainNode.
function eqBuild(ctx,input,output){
    try{
        eqFilters=EQ_BANDS.map((hz,i)=>{
            const f=ctx.createBiquadFilter();
            f.type='peaking';f.frequency.value=hz;f.Q.value=1.1;
            f.gain.value=eqLoad().on?eqLoad().g[i]:0;
            return f;
        });
        input.connect(eqFilters[0]);
        for(let i=0;i<eqFilters.length-1;i++)eqFilters[i].connect(eqFilters[i+1]);
        eqFilters[eqFilters.length-1].connect(output);
        return true;
    }catch(e){eqFilters=null;return false;}
}

function eqApply(){
    if(!eqFilters)return;
    const c=eqLoad();
    const ctx=musicAudioCtx||(eqFilters[0]&&eqFilters[0].context);
    if(!ctx)return;
    eqFilters.forEach((f,i)=>{
        const v=c.on?c.g[i]:0;
        try{f.gain.setTargetAtTime(v,ctx.currentTime,0.02);}catch(e){f.gain.value=v;}
    });
}

// Ленивая инициализация цепочки (в Electron её нет до первого обращения)
function eqEnsureChain(){
    if(eqFilters)return true;
    if(typeof initMusicGainNode==='function')initMusicGainNode();
    return !!eqFilters;
}

function eqSetBand(i,v){
    const c=eqLoad();
    v=parseFloat(v);if(isNaN(v))return;
    c.g[i]=Math.max(-12,Math.min(12,v));
    c.on=true;
    eqSave();eqEnsureChain();eqApply();eqRefreshUi();
}
function eqToggle(on){
    const c=eqLoad();c.on=!!on;eqSave();eqEnsureChain();eqApply();eqRefreshUi();
}
function eqPreset(name){
    const p=EQ_PRESETS[name];if(!p)return;
    const c=eqLoad();c.g=p.slice();c.on=true;eqSave();eqEnsureChain();eqApply();eqRefreshUi();
}

// ===== Модалка (создаётся лениво — тот же приём, что у hotkeys-modal) =====
function ensureEqModal(){
    let s=document.getElementById('eq-modal-style');
    if(!s){
        s=document.createElement('style');s.id='eq-modal-style';
        s.textContent=[
            '#eq-modal{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:3500;display:none;align-items:center;justify-content:center;}',
            '#eq-modal .eq-box{position:relative;background:var(--card,#1e1e1e);border:1px solid var(--border,#3a3a3a);border-radius:14px;padding:24px 26px;width:430px;max-width:92vw;box-shadow:0 12px 40px rgba(0,0,0,.6);}',
            '#eq-modal .eq-close{position:absolute;top:12px;right:14px;background:none;border:none;color:#888;font-size:16px;cursor:pointer;padding:4px;line-height:1;}',
            '#eq-modal .eq-close:hover{color:#fff;}',
            '#eq-modal .eq-title{margin:0 0 8px;font-size:19px;color:var(--accent,#1db954);}',
            '#eq-modal .eq-hint{font-size:11.5px;color:#9a9a9a;line-height:1.55;margin-bottom:14px;background:#242424;border:1px solid var(--border,#333);border-radius:8px;padding:9px 11px;}',
            '#eq-modal .eq-switch{display:flex;align-items:center;gap:9px;margin-bottom:12px;font-size:13px;color:#eee;font-weight:600;cursor:pointer;}',
            '#eq-modal .eq-switch input{accent-color:var(--accent,#1db954);width:16px;height:16px;cursor:pointer;}',
            '#eq-modal .eq-sliders{display:flex;justify-content:space-between;gap:6px;background:var(--input-bg,#2a2a2a);border:1px solid var(--border,#333);border-radius:12px;padding:16px 10px 12px;margin-bottom:12px;}',
            '#eq-modal .eq-band{display:flex;flex-direction:column;align-items:center;gap:8px;}',
            '#eq-modal .eq-band input[type=range]{writing-mode:vertical-lr;direction:rtl;width:22px;height:130px;accent-color:var(--accent,#1db954);cursor:pointer;}',
            '#eq-modal .eq-db{font-size:11px;color:#bbb;font-weight:700;min-height:14px;}',
            '#eq-modal .eq-freq{font-size:10.5px;color:#8a8a8a;}',
            '#eq-modal .eq-presets{display:flex;flex-wrap:wrap;gap:7px;}',
            '#eq-modal .eq-preset{padding:7px 12px;border-radius:7px;border:1px solid #3a3a3a;background:#2a2a2a;color:#ddd;font-size:12px;font-weight:700;cursor:pointer;transition:.15s;font-family:inherit;}',
            '#eq-modal .eq-preset:hover{border-color:var(--accent,#1db954);color:var(--accent,#1db954);}'
        ].join('\n');
        document.head.appendChild(s);
    }
    let m=document.getElementById('eq-modal');
    if(m)return;
    m=document.createElement('div');m.id='eq-modal';
    m.innerHTML=eqRenderHtml();
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)closeEqModal();});
}
function eqRenderHtml(){
    const c=eqLoad();
    const bands=EQ_BANDS.map((hz,i)=>
        '<div class="eq-band">'+
        '<input type="range" min="-12" max="12" step="1" value="'+c.g[i]+'" id="eq-b'+i+'" oninput="eqSetBand('+i+',this.value)">'+
        '<span class="eq-db" id="eq-db'+i+'">'+(c.g[i]>0?'+':'')+c.g[i]+'</span>'+
        '<span class="eq-freq">'+EQ_FREQ_LABELS[i]+'</span>'+
        '</div>').join('');
    const presets=Object.keys(EQ_PRESETS).map(k=>
        '<button class="eq-preset" onclick="eqPreset(\''+k+'\')">'+translate(k)+'</button>').join('');
    return '<div class="eq-box">'+
        '<button class="eq-close" onclick="closeEqModal()">✕</button>'+
        '<h2 class="eq-title">'+translate('eq_title')+'</h2>'+
        '<div class="eq-hint">'+translate('eq_hint')+'</div>'+
        '<label class="eq-switch"><input type="checkbox" id="eq-on-check" '+(c.on?'checked':'')+' onchange="eqToggle(this.checked)"> '+translate('eq_on')+'</label>'+
        '<div class="eq-sliders">'+bands+'</div>'+
        '<div class="eq-presets">'+
        '<button class="eq-preset" onclick="eqToggle(false)">'+translate('eq_off')+'</button>'+
        presets+
        '</div></div>';
}
function eqRefreshUi(){
    const c=eqLoad();
    EQ_BANDS.forEach((hz,i)=>{
        const s=document.getElementById('eq-b'+i);if(s)s.value=c.g[i];
        const d=document.getElementById('eq-db'+i);if(d)d.textContent=(c.g[i]>0?'+':'')+c.g[i];
    });
    const chk=document.getElementById('eq-on-check');if(chk)chk.checked=c.on;
}
function openEqModal(){ensureEqModal();eqEnsureChain();eqRefreshUi();document.getElementById('eq-modal').style.display='flex';}
function closeEqModal(){const m=document.getElementById('eq-modal');if(m)m.style.display='none';}
document.addEventListener('keydown',e=>{if(e.code==='Escape'){const m=document.getElementById('eq-modal');if(m&&m.style.display==='flex')closeEqModal();}});
