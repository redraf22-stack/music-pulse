// Регрессионный тест единого окна настроек (settings-hub.js) на мини-DOM.
// Ловит два бага 2.0.21:
//   1) «захожу в настройки, потом назад — а справа ничего нету»: при переключении
//      вкладок pane.innerHTML='' должен уничтожать только заголовок, а не модалки;
//      если переезд не вернулся — элемент пропадает из документа навсегда.
//   2) дубли/потеря контента при перерисовке innerHTML (eqSetSource/openEqModal).
// Живой браузер для этой проверки не нужен: здесь моделируется ровно тот кусок DOM,
// который использует хаб (getElementById, appendChild/insertBefore, innerHTML, classList).
// Запуск: node test/hub.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/js/settings-hub.js'), 'utf8');

// ===== Мини-DOM =====
let REG = new Map(); // id -> element (глобальный регистр, как в браузере)
class El {
    constructor(tag) {
        this.tagName = String(tag || 'div').toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.style = {};
        this.dataset = {};
        this._cls = new Set();
        this._id = null;
        this.textContent = '';
        this._html = '';
        this.onclick = null;
    }
    get id() { return this._id; }
    set id(v) { this._id = v; if (v) REG.set(v, this); }
    get className() { return Array.from(this._cls).join(' '); }
    set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get classList() {
        const s = this._cls;
        return {
            contains: c => s.has(c),
            add: c => s.add(c),
            remove: c => s.delete(c),
            toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; on ? s.add(c) : s.delete(c); return on; }
        };
    }
    get nextSibling() {
        if (!this.parentNode) return null;
        const a = this.parentNode.children, i = a.indexOf(this);
        return (i >= 0 && i < a.length - 1) ? a[i + 1] : null;
    }
    _detach() {
        if (this.parentNode) {
            const i = this.parentNode.children.indexOf(this);
            if (i >= 0) this.parentNode.children.splice(i, 1);
        }
        this.parentNode = null;
    }
    appendChild(el) { el._detach(); el.parentNode = this; this.children.push(el); return el; }
    insertBefore(el, ref) {
        el._detach();
        el.parentNode = this;
        if (ref == null || this.children.indexOf(ref) < 0) { this.children.push(el); return el; }
        this.children.splice(this.children.indexOf(ref), 0, el);
        return el;
    }
    addEventListener() {}
    removeEventListener() {}
    set innerHTML(v) {
        this._html = String(v);
        // как в браузере: содержимое удаляется из документа (id теряются!)
        const wipe = els => els.forEach(e => { wipe(e.children); if (e._id) REG.delete(e._id); e.children = []; e.parentNode = null; });
        wipe(this.children.slice());
        this.children = [];
        if (this._html === '') return;
        // разметка с id="..." создаёт элементы (шапка хаба: sh-title/sh-nav/sh-pane)
        const self = this;
        this._html.replace(/id="([^"]+)"/g, (m, id) => {
            const e = new El('div'); e._id = id; e.parentNode = self; REG.set(id, e); return m;
        });
    }
    get innerHTML() { return this._html; }
}
function findCls(root, cls) {
    if (root.classList.contains(cls)) return root;
    for (const c of root.children) { const r = findCls(c, cls); if (r) return r; }
    return null;
}
function makeDoc() {
    REG = new Map();
    const doc = {
        head: new El('head'),
        body: new El('body'),
        createElement: t => new El(t),
        getElementById: id => REG.get(id) || null,
        querySelector: sel => {
            let m = /^#([\w-]+)$/.exec(sel);
            if (m) return REG.get(m[1]) || null;
            m = /^#([\w-]+)\s+\.([\w-]+)$/.exec(sel);
            if (m) { const r = REG.get(m[1]); return r ? findCls(r, m[2]) : null; }
            return null;
        },
        querySelectorAll: sel => {
            if (sel === '#sh-nav .sh-item') {
                const nav = REG.get('sh-nav');
                return nav ? nav.children.filter(c => c.classList.contains('sh-item')) : [];
            }
            return [];
        },
        addEventListener: () => {}
    };
    return doc;
}

// ===== Фикстуры =====
function fixtureIndex() {
    const doc = makeDoc();
    const modal = doc.createElement('div'); modal.id = 'room-device-modal'; modal.style.display = 'none';
    const box = doc.createElement('div'); box.className = 'modal-box';
    const close = doc.createElement('button'); close.className = 'modal-close';
    const h2 = doc.createElement('h2');
    const lang = doc.createElement('div'); lang.id = 'room-lang-field'; lang.className = 'modal-field';
    const sw = doc.createElement('div'); sw.className = 'lang-switch'; lang.appendChild(sw);
    const mic = doc.createElement('div'); mic.className = 'modal-field';
    box.appendChild(close); box.appendChild(h2); box.appendChild(lang); box.appendChild(mic);
    modal.appendChild(box);
    doc.body.appendChild(modal);
    ['tech-settings-panel', 'admin-controls', 'vote-settings-btn'].forEach(id => {
        const e = doc.createElement('div'); e.id = id; e.style.display = 'none'; doc.body.appendChild(e);
    });
    // «Настройки песен» — раньше отдельное окошко 520px, теперь вкладка хаба
    const song = doc.createElement('div'); song.id = 'song-settings-modal'; song.className = 'playlist-view-modal';
    const pv = doc.createElement('div'); pv.className = 'plv-box';
    const sh2 = doc.createElement('h2'); const scl = doc.createElement('button'); scl.className = 'url-modal-close';
    pv.appendChild(sh2); pv.appendChild(scl); song.appendChild(pv); doc.body.appendChild(song);
    return doc;
}
function fixtureStart() {
    const doc = makeDoc();
    ['settings-modal', 'devices-modal', 'music-modal'].forEach(id => {
        const ov = doc.createElement('div'); ov.id = id; ov.className = 'modal-overlay';
        const box = doc.createElement('div'); box.className = 'modal-box';
        const h2 = doc.createElement('h2'); box.appendChild(h2);
        const f = doc.createElement('div'); f.className = 'modal-field'; box.appendChild(f);
        ov.appendChild(box); doc.body.appendChild(ov);
    });
    return doc;
}

// ===== Окружение и загрузка settings-hub.js =====
function loadHub(doc, env) {
    const warns = [];
    const stubConsole = { warn: (...a) => warns.push(a.join(' ')), log: () => {}, error: () => {} };
    const translate = k => k;
    const hub = new Function('document', 'console', 'translate', 'env',
        'const {myRole,isMod,currentRoomCode,ensureHotkeysModal,ensureEqModal,' +
        'populateRoomDeviceSelects,enumerateDevices,loadMusicDirSetting,' +
        'openPersonalPlaylistsManager,openMyMusic,eqEditSet}=env;\n' +
        src + '\nreturn {openSettingsHub,closeSettingsHub,shShow,shTabs};'
    )(doc, stubConsole, translate, env);
    return { hub, warns };
}
function makeEnv(doc) {
    const env = {
        myRole: 'admin', isMod: false, currentRoomCode: '12345',
        populateRoomDeviceSelects: () => {}, enumerateDevices: () => {}, loadMusicDirSetting: () => {},
        openPersonalPlaylistsManager: () => {},
        openMyMusic: () => {},
        eqSource: 'personal',
        eqActiveSource: () => env.eqSource,
        eqEditTarget: 'auto',
        eqEditSet: t => { // как в eq.js: смена режима редактирования перерисовывает innerHTML модалки
            env.eqEditTarget = (t === 'room' && env.currentRoomCode) ? 'room' : 'auto';
            const m = REG.get('eq-modal');
            if (m) m.innerHTML = '<div class="eq-box"><h2 class="eq-title">t</h2><button class="eq-close">x</button><div class="eq-sliders"></div></div>';
        },
        eqSetSource: s => { // источник в обычной вкладке EQ
            env.eqSource = s === 'personal' ? 'personal' : 'room';
            const m = REG.get('eq-modal');
            if (m) m.innerHTML = '<div class="eq-box"><h2 class="eq-title">t</h2><button class="eq-close">x</button><div class="eq-sliders"></div></div>';
        },
        ensureEqModal: () => {
            if (REG.get('eq-modal')) return;
            const m = doc.createElement('div'); m.id = 'eq-modal'; m.style.display = 'none';
            m.innerHTML = '<div class="eq-box"><h2 class="eq-title">t</h2><button class="eq-close">x</button><div class="eq-sliders"></div></div>';
            doc.body.appendChild(m);
        },
        ensureHotkeysModal: () => {
            if (REG.get('hotkeys-modal')) return;
            const m = doc.createElement('div'); m.id = 'hotkeys-modal'; m.style.display = 'none';
            m.innerHTML = '<div class="hk-box"><h2 class="hk-title">t</h2><button class="hk-close">x</button><div class="hk-row"></div></div>';
            doc.body.appendChild(m);
        }
    };
    return env;
}

const pane = doc => doc.getElementById('sh-pane');
// Контент вкладок живёт в фиксированной рамке .sh-frame (одинаковый прямоугольник
// во всех вкладках) — сравниваем детей рамки, а не самой панели
const content = doc => {
    const kids = pane(doc).children.filter(c => c.tagName !== 'H3');
    const frame = kids.find(c => c.className.includes('sh-frame'));
    return frame ? frame.children.slice() : kids;
};
const assertNoWarns = warns => warns.forEach(w => assert.ok(!w.includes('[settings-hub]'), 'найдена пустая вкладка: ' + w));

// ===== Сценарий A: index (комната, admin) =====
{
    const doc = fixtureIndex();
    const env = makeEnv(doc);
    const { hub, warns } = loadHub(doc, env);
    const body = doc.body;
    const modal = doc.getElementById('room-device-modal');
    const lang = doc.getElementById('room-lang-field');
    const box = lang.parentNode; // .modal-box внутри модалки

    hub.openSettingsHub();
    assert.deepStrictEqual(content(doc), [modal], 'Общие (язык+устройства одна вкладка): в панели модалка целиком');
    assert.strictEqual(lang.parentNode, box, 'язык остался внутри модалки — отдельной вкладки «Общие» больше нет');

    // Старый id «devices» (вкладка объединена) должен падать на первую вкладку, а не пустеть
    hub.shShow('devices');
    assert.deepStrictEqual(content(doc), [modal], 'старый id «devices»: показана первая вкладка');

    // Настройки песен: были отдельным окошком 520px — теперь вкладка хаба
    const song = doc.getElementById('song-settings-modal');
    hub.shShow('songs');
    assert.deepStrictEqual(content(doc), [song], 'Настройки песен: вкладка в хабе');

    hub.shShow('eq');
    assert.deepStrictEqual(content(doc), [doc.getElementById('eq-modal')], 'Эквалайзер: в панели корень модалки');
    // пользователь щёлкает источник — eq.js перерисовывает innerHTML модалки
    env.eqSetSource('personal');
    assert.deepStrictEqual(content(doc), [doc.getElementById('eq-modal')], 'после перерисовки EQ панель не опустела');

    hub.shShow('general');
    assert.deepStrictEqual(content(doc), [modal], 'возврат на Общие после EQ: панель НЕ пустая (баг «назад — пусто»)');
    assert.strictEqual(song.parentNode, body, 'Настройки песен вернулись в body');
    assert.strictEqual(doc.getElementById('eq-modal').parentNode, body, 'EQ вернулся в body');

    // action-вкладка не должна трогать панель
    const before = content(doc).slice();
    hub.shShow('playlists');
    assert.deepStrictEqual(content(doc), before, 'action-вкладка не меняет панель');

    hub.shShow('general');
    assert.deepStrictEqual(content(doc), [modal], 'и снова возврат на Общие — не пусто');

    // Эквалайзер комнаты: admin-вкладка правит ТОЛЬКО комнатный EQ, источник слушателя
    // не переключается (раньше eqroom принудительно ставил room — баг 2.0.21)
    env.eqSource = 'personal';
    hub.shShow('eqroom');
    assert.deepStrictEqual(content(doc), [doc.getElementById('eq-modal')], 'Эквалайзер комнаты: панель не пустая');
    assert.strictEqual(env.eqSource, 'personal', 'eqroom НЕ переключает мой источник слушателя');
    assert.strictEqual(env.eqEditTarget, 'room', 'eqroom: правим только комнатный EQ');

    // Возврат на обычный EQ — снова правится активный источник
    hub.shShow('eq');
    assert.strictEqual(env.eqEditTarget, 'auto', 'обычная вкладка EQ: режим редактирования сброшен');
    env.eqSetSource('personal');
    assert.deepStrictEqual(content(doc), [doc.getElementById('eq-modal')], 'после перерисовки EQ панель не опустела');

    // Тех-панель
    hub.shShow('room');
    assert.deepStrictEqual(content(doc), [doc.getElementById('tech-settings-panel')], 'Технические: панель на месте');

    // Горячие клавиши (ленивое создание модалки)
    hub.shShow('hotkeys');
    assert.deepStrictEqual(content(doc), [doc.getElementById('hotkeys-modal')], 'Горячие клавиши: панель не пустая');

    hub.shShow('general');
    hub.closeSettingsHub();
    assert.strictEqual(modal.parentNode, body, 'закрытие: модалка вернулась в body');
    assert.strictEqual(lang.parentNode, box, 'закрытие: язык вернулся в бокс');
    assert.strictEqual(doc.getElementById('eq-modal').parentNode, body, 'закрытие: EQ вернулся в body');
    assert.strictEqual(doc.getElementById('hotkeys-modal').parentNode, body, 'закрытие: HK вернулся в body');
    assert.strictEqual(doc.getElementById('tech-settings-panel').parentNode, body, 'закрытие: тех-панель вернулась');
    assert.strictEqual(doc.getElementById('settings-hub').style.display, 'none', 'закрытие: оверлей скрыт');

    // повторное открытие
    hub.openSettingsHub();
    assert.deepStrictEqual(content(doc), [modal], 'повторное открытие: контент показан');
    hub.closeSettingsHub();
    assertNoWarns(warns);
    console.log('  OK  index: переключения вкладок, action, EQ-перерисовка, eqroom, закрытие/открытие');
}

// ===== Сценарий B: start (нет room-device-modal) =====
{
    const doc = fixtureStart();
    const env = makeEnv(doc);
    delete env.openMyMusic; // на start плеера нет — вкладки «Моя музыка» быть не должно
    const { hub, warns } = loadHub(doc, env);
    const body = doc.body;

    hub.openSettingsHub();
    assert.deepStrictEqual(content(doc), [doc.getElementById('devices-modal'), doc.getElementById('settings-modal')],
        'start/Общие: устройства + язык/автозапуск в одной вкладке');

    ['music', 'hotkeys', 'eq', 'general', 'music', 'general'].forEach(id => {
        hub.shShow(id);
        assert.ok(content(doc).length > 0, 'start/' + id + ': панель не пустая');
    });

    hub.closeSettingsHub();
    ['settings-modal', 'devices-modal', 'music-modal', 'eq-modal', 'hotkeys-modal'].forEach(id => {
        const el = doc.getElementById(id);
        if (el) assert.strictEqual(el.parentNode, body, 'закрытие: ' + id + ' вернулся в body');
    });
    hub.openSettingsHub();
    assert.ok(content(doc).length > 0, 'start: повторное открытие не пустое');
    hub.closeSettingsHub();
    assertNoWarns(warns);
    console.log('  OK  start: все вкладки, закрытие/открытие');
}

console.log('hub.test: ALL OK (2 сценария)');
