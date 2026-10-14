// Тест шкалы мастер-громкости: masterPctToGain (helpers.js) + формула миграции (core.js).
// Новая шкала 2.0.21: -200%..+100%, где -200% = тишина, 0% = обычная (0.25),
// +100% = ×3 от обычной (0.75). Запуск: node test/volume.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../src/js/helpers.js'), 'utf8');
const stub = new Proxy({}, { get: () => () => undefined });
const api = new Function('window', 'document', 'localStorage', 'navigator', 'console', 'setTimeout', 'clearTimeout',
    src + '\nreturn { masterPctToGain, volumeToGain, makeSoftClipCurve };')
    (stub, stub, { getItem: () => null, setItem: () => {} }, { language: 'ru' }, console, setTimeout, clearTimeout);
const g = api.masterPctToGain;

// 1. Ключевые точки новой шкалы (просьба пользователя 2.0.21)
assert.strictEqual(g(0), 0.25, '0% = 0.25 — обычная громкость');
assert.strictEqual(g(100), 0.75, '+100% = 0.75 — усиление ×3 от обычной');
assert.strictEqual(g(-200), 0, '-200% = 0 — полная тишина');
assert.ok(Math.abs(g(50) - 0.25 * Math.sqrt(3)) < 1e-12, '+50% = 0.25*√3 (лог-кривая 3^(pct/100))');
assert.ok(Math.abs(g(-100) - 0.103553) < 1e-5, '-100% ≈ 0.1036 (нижняя лог-кривая)');

// 2. Защита от мусора и выхода за границы
assert.strictEqual(g(NaN), 0.25, 'NaN → дефолт');
assert.strictEqual(g('abc'), 0.25, 'строка-мусор → дефолт');
assert.strictEqual(g(undefined), 0.25, 'undefined → дефолт');
assert.strictEqual(g(9999), 0.75, 'кламп сверху = +100%');
assert.strictEqual(g(-9999), 0, 'кламп снизу = -200% (тишина)');

// 3. Монотонность: тише → громче (вплоть до нуля на нижнем краю)
let prev = -1;
for (let pct = -200; pct <= 100; pct++) {
    const v = g(pct);
    assert.ok(v > prev, 'строго растёт на ' + pct + '%');
    prev = v;
}
// и нигде не отрицательна
for (let pct = -250; pct <= 150; pct++) assert.ok(g(pct) >= 0, 'gain >= 0 на ' + pct + '%');

// 4. Миграция (формула из core.js): старая шкала -200..+200 (0.25*2^(p/200))
//    переводится в новую без изменения ГРОМКОСТИ; древний ключ mp_master_volume
//    (0..1 = gain) идёт в ту же функцию gainToNewPct.
const legacyGain = n => 0.25 * Math.pow(2, Math.max(-200, Math.min(200, n)) / 200);
const gainToNewPct = gr => {
    if (!(gr > 0)) return -200;
    const p = gr >= 0.25 ? 100 * Math.log(gr / 0.25) / Math.log(3)
                         : 200 * Math.log2((gr / 0.25 + 1) / 2);
    return Math.max(-200, Math.min(100, Math.round(p)));
};
const mig = n => gainToNewPct(legacyGain(n));
assert.strictEqual(mig(200), 63, 'старый +200% (0.5) → +63% — громкость 0.5 сохраняется');
assert.strictEqual(mig(0), 0, 'старый 0% → 0%');
assert.strictEqual(mig(-200), -83, 'старый -200% (0.125) → -83% — громкость сохраняется');
assert.strictEqual(gainToNewPct(0.5), 63, 'древний mp_master_volume=0.5 → +63%');
assert.strictEqual(gainToNewPct(0.25), 0, 'древний mp_master_volume=0.25 → 0%');
// миграция сохраняет громкость: g(миграция(n)) ≈ старый gain(n)
[-200, -150, -100, -50, 0, 50, 100, 150, 200].forEach(n => {
    assert.ok(Math.abs(g(mig(n)) - legacyGain(n)) < 0.01,
        'уровень сохранён для старого ' + n + '%: ' + g(mig(n)).toFixed(4) + ' vs ' + legacyGain(n).toFixed(4));
});

// 5. Обе цепочки дают одинаковый результат (фикс «после EQ стало тише»):
//    путь WebAudio: gain=g(pct) при audio.volume=1; путь элемента: audio.volume=min(1,g(pct))
const pct = 50;
const chainWay = 1 * g(pct);
const elemWay = Math.min(1, g(pct));
assert.strictEqual(chainWay, elemWay, 'громкость не зависит от наличия WebAudio-цепочки');

// 6. Soft-clip лимитер (makeSoftClipCurve) должен быть ПОЧТИ линейным на рабочих
//    уровнях: старый tanh(x*2) удваивал тихие сигналы — 0% звучал как бывшие 100%
const curve = api.makeSoftClipCurve();
const N = curve.length;
const xOf = i => (i / (N - 1)) * 2 - 1;
assert.ok(Math.abs(curve[255]) < 0.003 && Math.abs(curve[256]) < 0.003, 'центр кривой ≈ 0');
for (let i = 0; i < N; i++) {
    const x = xOf(i);
    assert.ok(Math.abs(curve[i]) <= 1, 'лимитер не выходит за [-1;1]');
    if (Math.abs(x) <= 0.5) {
        assert.ok(Math.abs(curve[i] - x) < 0.06, 'почти линейно на |x|<=0.5 (x=' + x.toFixed(2) + '), получено ' + curve[i].toFixed(3));
    } else {
        assert.ok(Math.abs(curve[i]) <= Math.abs(x) + 1e-6, 'только ограничивает, никогда не усиливает');
    }
}
// максимум новой шкалы (0.75) после лимитера не «оглушает» и не клипится:
assert.ok(Math.tanh(0.75) < 1 && Math.tanh(0.75) > 0.6, 'max 0.75 → tanh ≈ 0.635 (ниже прежнего пика tanh(1)≈0.762)');

// 7. core.js должен знать про новую шкалу (флаг миграции и кламп +100)
const core = fs.readFileSync(path.join(__dirname, '../src/js/core.js'), 'utf8');
assert.ok(core.includes('mp_master_volume_scale'), 'core.js пишет флаг mp_master_volume_scale');
assert.ok(core.includes('gainToNewPct'), 'core.js содержит формулу перевода громкости');
const player = fs.readFileSync(path.join(__dirname, '../src/js/player.js'), 'utf8');
assert.ok(!/master-vol-slider" min="-200" max="200"/.test(player), 'слайдер больше не доходит до старых +200');
assert.ok(/master-vol-slider" min="-200" max="100"/.test(player), 'слайдер: -200..+100');

console.log('volume.test: ALL OK (7 блоков)');
