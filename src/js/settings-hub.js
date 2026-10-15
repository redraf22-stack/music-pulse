// ===== ЕДИНОЕ ОКНО НАСТРОЕК: слева навигация (как в Unity), справа контент =====
// Не дублирует разметку, а ПЕРЕМЕЩАЕТ существующие модалки в правую панель и
// возвращает их на место при закрытии — вся старая логика (id, onclick, сохранение)
// продолжает работать без правок. Роли: секция «Настройки комнаты» — только admin/mod.
// Секции: Общие / Устройства / Музыка (старт) / Горячие клавиши / Эквалайзер /
// Личные плейлисты / --- Настройки комнаты --- Эквалайзер комнаты и Технические
// (кулдауны и т.п.) — только admin/mod.
let shOpen=false,shLastTab=null,shMoved=new Map(),shCurrentTab=null;

function shIsAdmin(){try{return typeof myRole!=='undefined'&&(myRole==='admin'||(typeof isMod!=='undefined'&&isMod));}catch(e){return false;}}
function shInRoom(){try{return typeof currentRoomCode!=='undefined'&&!!currentRoomCode;}catch(e){return false;}}
// Вызывается из close* — если хаб открыт, любая внутренняя кнопка «Закрыть/Готово» закрывает хаб
function shInterceptClose(){if(!shOpen)return false;closeSettingsHub();return true;}

function shTabs(){
    // Перемещаем КОРНИ модалок (а не внутренние боксы): их CSS висит на #id предках
    // (#room-device-modal .modal-select, #eq-modal .eq-* и т.д.) — при выносе только
    // бокса все эти правила переставали матчиться и контент «голел». Корень увозим
    // целиком — предок сохраняется, стили продолжают работать; нейтрализацию
    // оверлея (position/display/z-index) делает CSS хаба в shEnsure().
    const isIndex=!!document.getElementById('room-device-modal');
    const t=[];
    if(isIndex){
        // Язык и устройства — ОДНА вкладка: язык (#room-lang-field) физически живёт
        // внутри #room-device-modal, раньше он выносился отдельной вкладкой «Общие»,
        // где был только язык — пользователь просил объединить.
        t.push({id:'general',ico:'🌐',label:translate('sh_general'),
            nodes:()=>[document.getElementById('room-device-modal')].filter(Boolean),
            show:()=>{try{if(typeof populateRoomDeviceSelects==='function')populateRoomDeviceSelects();}catch(e){}}});
        // «Настройки песен» (поиск/фильтры) — раньше открывались отдельным маленьким
        // окошком 520px; теперь это вкладка хаба, чтобы все настройки были одним окном
        t.push({id:'songs',ico:'🔍',label:translate('sh_songs'),
            nodes:()=>[document.getElementById('song-settings-modal')].filter(Boolean),
            show:()=>{try{if(typeof markSongSettings==='function')markSongSettings();}catch(e){}}});
    }else{
        // На start тоже одна вкладка: устройства (mic/speaker/camera) + язык/автозапуск
        t.push({id:'general',ico:'🌐',label:translate('sh_general'),
            nodes:()=>[document.getElementById('devices-modal'),document.getElementById('settings-modal')].filter(Boolean),
            show:()=>{try{if(typeof enumerateDevices==='function')enumerateDevices();}catch(e){}}});
        t.push({id:'music',ico:'🎵',label:translate('sh_music'),
            nodes:()=>[document.getElementById('music-modal')].filter(Boolean),
            show:()=>{try{if(typeof loadMusicDirSetting==='function')loadMusicDirSetting();}catch(e){}}});
    }
    t.push({id:'hotkeys',ico:'⌨️',label:translate('sh_hotkeys'),
        nodes:()=>{try{ensureHotkeysModal();}catch(e){}return [document.getElementById('hotkeys-modal')].filter(Boolean);}});
    t.push({id:'eq',ico:'🎛',label:translate('sh_eq'),
        nodes:()=>{try{ensureEqModal();}catch(e){}return [document.getElementById('eq-modal')].filter(Boolean);},
        show:()=>{try{if(typeof eqEditSet==='function')eqEditSet('auto');}catch(e){}}});
    t.push({id:'playlists',ico:'📚',label:translate('sh_playlists'),action:()=>{
        try{openPersonalPlaylistsManager();}catch(e){}}});
    if(typeof openMyMusic==='function') // «Моя музыка» живёт в player.js — есть только в комнате
        t.push({id:'mymusic',ico:'📝',label:translate('sh_mymusic'),action:()=>{
            try{openMyMusic();}catch(e){}}});
    if(shInRoom()&&shIsAdmin()){
        t.push({section:translate('sh_room_section')});
        // Отдельный вход в КОМНАТНЫЙ эквалайзер (только admin/mod): правит ТОЛЬКО
        // комнатный EQ — мой источник слушателя не переключает (eqEditTarget='room'),
        // личный EQ при этом продолжает звучать, если выбран он.
        t.push({id:'eqroom',ico:'🎛',label:translate('sh_eq_room'),
            nodes:()=>{try{ensureEqModal();}catch(e){}return [document.getElementById('eq-modal')].filter(Boolean);},
            show:()=>{try{if(typeof eqEditSet==='function')eqEditSet('room');}catch(e){}},
            hide:()=>{try{if(typeof eqEditSet==='function')eqEditSet('auto');}catch(e){}}});
        t.push({id:'room',ico:'⚙️',label:translate('sh_room_tech'),
            nodes:()=>{const p=document.getElementById('tech-settings-panel');return p?[p]:[];},
            show:()=>shTechPanelFix(true),hide:()=>shTechPanelFix(false)});
    }
    return t;
}
// Тех-панель в сайдбаре лежит display:none и раскрывается кнопкой — в хабе показываем её
// целиком (включая кулдауны), а на возврате восстанавливаем ровно те значения, что были.
let shTechOrig=null;
function shTechPanelFix(on){
    const p=document.getElementById('tech-settings-panel');
    const a=document.getElementById('admin-controls');
    const b=document.getElementById('vote-settings-btn');
    if(!p)return;
    if(on){
        shTechOrig={p:p.style.display,a:a?a.style.display:null,b:b?b.style.display:null};
        p.style.display='block';
        if(a)a.style.display='';
        if(b)b.style.display='none'; // раскрыто — кнопка-раскрывашка не нужна
    }else if(shTechOrig){
        p.style.display=shTechOrig.p;
        if(a&&shTechOrig.a!==null)a.style.display=shTechOrig.a;
        if(b&&shTechOrig.b!==null)b.style.display=shTechOrig.b;
        shTechOrig=null;
    }
}

function shEnsure(){
    if(document.getElementById('settings-hub'))return;
    let s=document.getElementById('settings-hub-style');
    if(!s){
        s=document.createElement('style');s.id='settings-hub-style';
        s.textContent=[
            '#settings-hub{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:3400;display:none;align-items:center;justify-content:center;}',
            '#settings-hub .sh-\boxed{width:840px;max-width:96vw;height:560px;max-height:92vh;background:var(--card,#1e1e1e);border:1px solid var(--border,#3a3a3a);border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.6);}',
            '#settings-hub .sh-head{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;border-bottom:1px solid var(--border,#2c2c2c);font-size:15.5px;font-weight:700;color:var(--text,#eee);}',
            '#settings-hub .sh-close{background:none;border:none;color:#888;font-size:16px;cursor:pointer;padding:4px 6px;line-height:1;}',
            '#settings-hub .sh-close:hover{color:#fff;}',
            '#settings-hub .sh-body{flex:1;display:flex;min-height:0;}',
            '#settings-hub .sh-nav{width:225px;flex-shrink:0;background:var(--bg,#121212);border-right:1px solid var(--border,#2c2c2c);overflow-y:auto;padding:10px 0;}',
            '#settings-hub .sh-item{display:flex;align-items:center;gap:10px;padding:10px 16px;font-size:13.5px;color:#cfcfcf;cursor:pointer;user-select:none;transition:.12s;}',
            '#settings-hub .sh-item:hover{background:#232323;color:#fff;}',
            // Активный пункт — только подсветка фоном/цветом, как в CS: без «марки» слева
            '#settings-hub .sh-item.active{background:rgba(29,185,84,.1);color:var(--accent,#1db954);font-weight:600;}',
            '#settings-hub .sh-section{margin-top:14px;padding:8px 16px 4px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#7a7a7a;border-top:1px solid #262626;}',
            // Единый фон панели — как страница приложения (--bg). Раньше панель была
            // прозрачной на карточке, и каждый модал привносил свою подложку: вкладки
            // выглядели по-разному («фон меняется зависимо от выбранной настройки»).
            '#settings-hub .sh-pane{flex:1;overflow-y:auto;padding:20px 24px;min-width:0;background:var(--bg,#121212);scrollbar-gutter:stable;overscroll-behavior:contain;}',
            '#settings-hub .sh-pane .sh-tab-title{margin:0 0 14px;font-size:16px;color:var(--text,#eee);}',
            // Корни-модалки, перенесённые в панель: гасим оверлей-обвязку (позиция,
            // фон, z-index, display:none от их собственных #id-правил) — стили
            // СОДЕРЖИМОГО при этом остаются от предков с теми же #id.
            '#settings-hub .sh-pane>#settings-modal,#settings-hub .sh-pane>#devices-modal,#settings-hub .sh-pane>#music-modal,#settings-hub .sh-pane>#room-device-modal,#settings-hub .sh-pane>#hotkeys-modal,#settings-hub .sh-pane>#eq-modal,#settings-hub .sh-pane>#song-settings-modal{position:static!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;inset:auto!important;background:none!important;z-index:auto!important;display:block!important;align-items:unset!important;justify-content:unset!important;max-width:none!important;max-height:none!important;overflow:visible!important;}',
            '#settings-hub .sh-pane .modal-box{background:none!important;border:none!important;padding:0!important;width:auto!important;box-shadow:none!important;max-height:none!important;}',
            '#settings-hub .sh-pane .hk-box,#settings-hub .sh-pane .eq-box,#settings-hub .sh-pane .plv-box{position:static!important;background:none!important;border:none!important;box-shadow:none!important;width:auto!important;max-width:none!important;padding:0!important;max-height:none!important;overflow:visible!important;}',
            // Штартовый хром модалок (заголовок/✕) внутри панели прячем CSS-ом, а не
            // инлайном: eqSetSource/eqEditSet/openEqModal перерисовывают innerHTML — новые
            // элементы инлайн-скрытие уже не унаследуют, а CSS-правило действует.
            '#settings-hub .sh-pane .modal-box>h2,#settings-hub .sh-pane .modal-close,#settings-hub .sh-pane .hk-title,#settings-hub .sh-pane .hk-close,#settings-hub .sh-pane .eq-title,#settings-hub .sh-pane .eq-close,#settings-hub .sh-pane .plv-box>h2,#settings-hub .sh-pane .plv-box>.url-modal-close{display:none!important;}',
            // Тех-панель в панели: приводим к единому дизайну вкладок — карточки-строки
            // во всю ширину (label слева, управление справа), без своих фонов и рамок.
            '#settings-hub .sh-pane .tech-panel{position:static!important;display:flex!important;flex-direction:column;gap:10px;width:100%!important;max-width:none!important;background:none!important;border:none!important;padding:0!important;margin:0!important;}',
            '#settings-hub .sh-pane .tech-panel .tech-btn{width:100%;box-sizing:border-box;display:flex;align-items:center;text-align:left;padding:11px 13px;min-height:42px;border-radius:10px;border:1px solid var(--border,#333);background:var(--input-bg,#2a2a2a);color:#eee;font-size:13px;font-weight:600;cursor:pointer;transition:.15s;font-family:inherit;}',
            '#settings-hub .sh-pane .tech-panel .tech-btn:hover{border-color:var(--accent,#1db954);color:var(--accent,#1db954);}',
            '#settings-hub .sh-pane .tech-panel .tech-btn.active{background:rgba(29,185,84,.12);color:var(--accent,#1db954);border-color:var(--accent,#1db954);}',
            '#settings-hub .sh-pane .tech-panel .voice-toggle-row,#settings-hub .sh-pane .tech-panel .setting-row{box-sizing:border-box;width:100%;margin:0;padding:11px 13px;border:1px solid var(--border,#333);border-radius:10px;background:var(--input-bg,#2a2a2a);gap:12px;font-size:13px;color:#eee;font-weight:600;}',
            '#settings-hub .sh-pane .tech-panel .sidebar-label{margin:0!important;font-size:13px!important;color:#eee!important;font-weight:600!important;}',
            '#settings-hub .sh-pane .tech-panel .tech-sub-panel{display:flex;flex-direction:column;gap:10px;background:none!important;border:none!important;padding:0!important;margin:0!important;}',
            '#settings-hub .sh-pane .tech-panel .tech-sub-panel .setting-row{margin:0;}',
            '#personal-playlists-manager-modal{z-index:3600!important;}',
            '#my-music-modal{z-index:3600!important;}',
            '#edit-track-modal{z-index:3600!important;}'
        ].join('\n');
        document.head.appendChild(s);
    }
    const ov=document.createElement('div');
    ov.id='settings-hub';
    ov.innerHTML='<div class="sh-box">'+
        '<div class="sh-head"><span id="sh-title"></span><button class="sh-close" onclick="closeSettingsHub()">✕</button></div>'+
        '<div class="sh-body"><div class="sh-nav" id="sh-nav"></div><div class="sh-pane" id="sh-pane"></div></div>'+
        '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',e=>{if(e.target===ov)closeSettingsHub();});
    document.addEventListener('keydown',e=>{if(e.code==='Escape'&&shOpen)closeSettingsHub();});
}

function shMove(node){
    if(shMoved.has(node))return;
    const info={parent:node.parentNode,next:node.nextSibling,display:node.style.display,hidden:[]};
    Array.from(node.children||[]).forEach(ch=>{
        if(ch.tagName==='H2'||ch.classList.contains('modal-close')||ch.classList.contains('hk-close')||ch.classList.contains('eq-close')){
            info.hidden.push([ch,ch.style.display]);
            ch.style.display='none'; // свой заголовок/✕ хаба вместо дубля из модалки
        }
    });
    shMoved.set(node,info);
}
function shRestore(node){
    const info=shMoved.get(node);
    if(!info)return;
    info.hidden.forEach(([el,d])=>{el.style.display=d;});
    node.style.display=info.display;
    try{info.parent.insertBefore(node,info.next);}catch(e){try{info.parent.appendChild(node);}catch(e2){}}
    shMoved.delete(node);
}
function shRestoreAll(){shMoved.forEach((info,node)=>{shRestore(node);});shMoved.clear();}

function shShow(id){
    const tabs=shTabs();
    let tab=tabs.find(t=>t.id===id);
    // Неизвестный id (вкладка объединена/переименована) → первая обычная вкладка
    if(!tab)tab=tabs.find(t=>!t.action&&!t.section);
    if(!tab||tab.action)return; // action-вкладки не должны управлять панелью
    // убрать предыдущую вкладку
    if(shCurrentTab){
        try{if(shCurrentTab.hide)shCurrentTab.hide();}catch(e){}
        shCurrentTab=null;
    }
    // Страховка: вернуть ВСЁ, что когда-либо переехало (не только nodes() предыдущей
    // вкладки). Иначе pane.innerHTML='' ниже способен уничтожить модалку вместе с
    // содержимым — и при следующем переключении справа оказывается пусто.
    shRestoreAll();
    document.querySelectorAll('#sh-nav .sh-item').forEach(el=>el.classList.toggle('active',el.dataset.tab===id));
    const pane=document.getElementById('sh-pane');
    pane.innerHTML='';
    const title=document.createElement('h3');
    title.className='sh-tab-title';
    title.textContent=tab.label;
    pane.appendChild(title);
    const nodes=tab.nodes();
    nodes.forEach(n=>{shMove(n);pane.appendChild(n);});
    if(!nodes.length&&typeof console!=='undefined')console.warn('[settings-hub] вкладка',id,'не нашла свои элементы — панель будет пустой');
    shCurrentTab=tab;
    try{if(tab.show)tab.show();}catch(e){}
    shLastTab=id;
}

function openSettingsHub(tab){
    shEnsure();
    const nav=document.getElementById('sh-nav');
    nav.innerHTML='';
    document.getElementById('sh-title').textContent=translate('sh_title');
    let roomSectionDone=false;
    shTabs().forEach(t=>{
        if(t.section){
            const sec=document.createElement('div');
            sec.className='sh-section';
            sec.textContent=t.section;
            nav.appendChild(sec);
            roomSectionDone=true;
            return;
        }
        const it=document.createElement('div');
        it.className='sh-item';
        it.dataset.tab=t.id||('act-'+Math.random());
        it.innerHTML='<span>'+(t.ico||'')+'</span><span>'+t.label+'</span>';
        // action-вкладки (плейлисты/моя музыка) открывают свою модалку ПОВЕРХ хаба
        // и не трогают текущую вкладку — иначе панель опустеет (баг «ломаются настройки»)
        if(t.action)it.onclick=()=>{try{t.action();}catch(e){}};
        else it.onclick=()=>shShow(t.id);
        nav.appendChild(it);
    });
    document.getElementById('settings-hub').style.display='flex';
    shOpen=true;
    shShow(tab||shLastTab||'general');
    return true;
}
function closeSettingsHub(){
    if(!shOpen)return;
    try{if(shCurrentTab){if(shCurrentTab.hide)shCurrentTab.hide();shCurrentTab=null;}}catch(e){}
    shRestoreAll();
    const ov=document.getElementById('settings-hub');
    if(ov)ov.style.display='none';
    shOpen=false;
}
