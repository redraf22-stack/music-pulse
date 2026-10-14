// Тест эквалайзера: цепочка фильтров, пресеты, границы, сохранение.
// Запуск: node test/eq.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/js/eq.js'), 'utf8');

// --- заглушки окружения браузера ---
const store = {};
const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const document = { addEventListener() {}, getElementById: () => null };

function fakeGain() { return { value: 0, setTargetAtTime(v) { this.value = v; } }; }
function fakeFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, gain: fakeGain(), out: null, connect(t) { this.out = t; } }; }

const createdFilters = [];
const ctx = { currentTime: 0, createBiquadFilter() { const f = fakeFilter(); createdFilters.push(f); return f; } };
const input = { out: null, connect(t) { this.out = t; } };
const output = { };

// musicAudioCtx и initMusicGainNode — глобалы из core/player.js, подменяем параметрами
const api = new Function('localStorage', 'document', 'musicAudioCtx', 'initMusicGainNode',
    src + '\nreturn { eqLoad, eqBuild, eqApply, eqSetBand, eqToggle, eqPreset, EQ_BANDS, EQ_PRESETS };')
    (localStorage, document, ctx, null);

// 1. Дефолты
let cfg = api.eqLoad();
assert.strictEqual(cfg.on, false, 'eq по умолчанию выключен');
assert.strictEqual(cfg.g.length, 5, '5 полос');
assert.ok(cfg.g.every(v => v === 0), 'все полосы по нулям');

// 2. Цепочка строится и подключается input → f0…f4 → output
assert.strictEqual(api.eqBuild(ctx, input, output), true, 'eqBuild вернул true');
assert.strictEqual(createdFilters.length, 5, 'создано 5 фильтров');
assert.strictEqual(input.out, createdFilters[0], 'вход подключён к первому фильтру');
assert.strictEqual(createdFilters[0].out, createdFilters[1], 'фильтры соединены по цепочке');
assert.strictEqual(createdFilters[3].out, createdFilters[4], 'последний предпоследнему');
assert.strictEqual(createdFilters[4].out, output, 'хвост цепочки ушёл в output');
assert.ok(createdFilters.every(f => f.type === 'peaking'), 'все фильтры peaking');
assert.deepStrictEqual(createdFilters.map(f => f.frequency.value), [60, 230, 910, 3600, 14000], 'частоты полос');

// 3. Смена полосы: включает eq, сохраняет, применяет к фильтрам
api.eqSetBand(0, 6);
cfg = api.eqLoad();
assert.strictEqual(cfg.on, true, 'движение слайдера включает эквалайзер');
assert.strictEqual(cfg.g[0], 6, 'полоса 60 Гц = +6');
assert.strictEqual(createdFilters[0].gain.value, 6, 'фильтр получил +6');
assert.strictEqual(createdFilters[1].gain.value, 0, 'соседняя полоса нетронута');
assert.ok(JSON.parse(store.mp_eq).g[0] === 6, 'сохранилось в localStorage');

// 4. Границы
api.eqSetBand(1, 99);
assert.strictEqual(api.eqLoad().g[1], 12, 'потолок +12');
api.eqSetBand(1, -99);
assert.strictEqual(api.eqLoad().g[1], -12, 'пол -12');

// 5. Выключение: фильтры обнуляются, значения полос сохраняются
api.eqToggle(false);
assert.strictEqual(createdFilters[0].gain.value, 0, 'выключенный eq обнуляет фильтры');
assert.strictEqual(api.eqLoad().g[0], 6, 'значения полос при этом сохранены');

// 6. Пресеты
api.eqPreset('eq_p_rock');
cfg = api.eqLoad();
assert.strictEqual(cfg.on, true, 'пресет включает эквалайзер');
assert.deepStrictEqual(cfg.g, api.EQ_PRESETS.eq_p_rock, 'rock-пресет применён');
assert.deepStrictEqual(createdFilters.map(f => f.gain.value), api.EQ_PRESETS.eq_p_rock, 'фильтры получили rock');

// 7. Кривой localStorage не роняет загрузку
store.mp_eq = 'не json';
const fresh = new Function('localStorage', 'document', 'musicAudioCtx', 'initMusicGainNode',
    src + '\nreturn eqLoad();')(localStorage, document, ctx, null);
assert.strictEqual(fresh.on, false, 'битый JSON → дефолты');
assert.ok(fresh.g.every(v => v === 0), 'битый JSON → нули');

console.log('eq.test: ALL OK (7 блоков)');
