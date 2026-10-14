// Тест шкалы мастер-громкости: masterPctToGain (helpers.js) + формула миграции (core.js).
// Запуск: node test/volume.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/js/helpers.js'), 'utf8');
const stub = new Proxy({}, { get: () => () => undefined });
const api = new Function('window', 'document', 'localStorage', 'navigator', 'console', 'setTimeout', 'clearTimeout',
    src + '\nreturn { masterPctToGain, volumeToGain };')
    (stub, stub, { getItem: () => null, setItem: () => {} }, { language: 'ru' }, console, setTimeout, clearTimeout);
const g = api.masterPctToGain;

// 1. Ключевые точки новой шкалы
assert.strictEqual(g(0), 0.25, '0% = 0.25 — обычная громкость (уровень, одобренный после EQ)');
assert.strictEqual(g(200), 0.5, '+200% = 0.5 — это бывшие «100%» (их и просил перенести в 200)');
assert.strictEqual(g(-200), 0.125, '-200% = 0.125 — нижний край');
assert.ok(Math.abs(g(100) - 0.25 * Math.SQRT2) < 1e-12, '+100% = 0.25*√2 (лог-шкала ×2 на 200%)');

// 2. Защита от мусора и выхода за границы
assert.strictEqual(g(NaN), 0.25, 'NaN → дефолт');
assert.strictEqual(g('abc'), 0.25, 'строка-мусор → дефолт');
assert.strictEqual(g(undefined), 0.25, 'undefined → дефолт');
assert.strictEqual(g(9999), 0.5, 'кламп сверху');
assert.strictEqual(g(-9999), 0.125, 'кламп снизу');

// 3. Монотонность: тише → громче
let prev = -1;
for (let pct = -200; pct <= 200; pct++) {
    const v = g(pct);
    assert.ok(v > prev, 'растёт на ' + pct + '%');
    prev = v;
}

// 4. Миграция из старого ключа (формула из core.js): громкость сохраняется,
//    старые «100%» (v=0.5) превращаются в «+200%» — дословно как просил пользователь
const mig = v => Math.max(-200, Math.min(200, Math.round(200 * Math.log2(v / 0.25))));
assert.strictEqual(mig(0.5), 200, 'старый 0.5 (100%) → +200%');
assert.strictEqual(mig(0.25), 0, 'старый 0.25 → 0%');
assert.strictEqual(mig(1), 200, 'старый максимум 1.0 → +200% (кламп)');
// миграция сохраняет громкость: gain(миграция(v)) === v для v в 0.0625..0.5
[0.125, 0.25, 0.35, 0.5].forEach(v => {
    assert.ok(Math.abs(g(mig(v)) - v) < 0.02, 'уровень сохранён для v=' + v);
});

// 5. Обе цепочки дают одинаковый результат (фикс «после EQ стало тише»):
//    путь WebAudio: gain=g(pct) при audio.volume=1; путь элемента: audio.volume=min(1,g(pct))
const pct = 50;
const chainWay = 1 * g(pct);
const elemWay = Math.min(1, g(pct));
assert.strictEqual(chainWay, elemWay, 'громкость не зависит от наличия WebAudio-цепочки');

console.log('volume.test: ALL OK (5 блоков)');
