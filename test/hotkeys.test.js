// Функциональный тест hotkeys.js: хранилище, сопоставление, захват, диспетчер PTT
// Запуск: npm run test:hotkeys
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ---- стабы браузера ----
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const listeners = {};
global.document = {
  addEventListener: (ev, fn) => { listeners[ev] = fn; },
  createElement: () => ({ style: {}, addEventListener: () => {}, set innerHTML(v) {}, get innerHTML() { return ''; } }),
  getElementById: () => null,
  body: { appendChild: () => {} }
};
global.window = { addEventListener: (ev, fn) => { listeners['win:' + ev] = fn; } };
const toasts = [];
global.showToast = (m, e) => toasts.push({ m, e });
global.translate = (k, p) => k + (p ? '[' + Object.keys(p).map(x => x + '=' + p[x]).join(',') + ']' : '');

// ---- загрузка тестируемого файла в глобальную область ----
// let-переменные файла не видны из модуля Node — пробрасываем аксессоры внутри той же eval-области
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'hotkeys.js'), 'utf8')
  + '\n;globalThis.__hk={get pttHeld(){return pttHeld;},get capturing(){return _hkCapturing;},set cfgNull(v){if(v)_hkCfg=null;}};');

const key = (code, mods, target) => Object.assign({
  code, ctrlKey: false, altKey: false, shiftKey: false, repeat: false,
  target: target || { tagName: 'DIV' },
  preventDefault() {}, stopPropagation() {}
}, mods || {});

// 1. Значения по умолчанию
let cfg = hkLoad();
assert.strictEqual(cfg.ptt.enabled, false, 'PTT по умолчанию выключен');
assert.strictEqual(cfg.mute.combo.code, 'KeyM', 'мьют по умолчанию = M');
assert.strictEqual(cfg.deafen.combo.code, 'KeyB', 'глушение по умолчанию = B');
assert.strictEqual(cfg.ptt.combo.code, 'KeyV', 'PTT по умолчанию = V');
assert.strictEqual(cfg.playpause.combo.code, 'F8', 'пауза/продолжить по умолчанию = F8');
assert.strictEqual(cfg.next.combo.code, 'F9', 'следующий трек по умолчанию = F9');
assert.strictEqual(cfg.prev.combo.code, 'F7', 'предыдущий трек по умолчанию = F7');

// 2. comboLabel
assert.strictEqual(comboLabel({ code: 'KeyV', ctrl: false, alt: false, shift: false }), 'V');
assert.strictEqual(comboLabel({ code: 'KeyV', ctrl: true, alt: false, shift: true }), 'Ctrl+Shift+V');
assert.strictEqual(comboLabel({ code: 'Digit1' }), '1');
assert.strictEqual(comboLabel({ code: 'Space' }), 'Пробел');
assert.strictEqual(comboLabel({ code: 'F5' }), 'F5');
assert.strictEqual(comboLabel(null), '—');

// 3. comboMatches: точное совпадение с модификаторами
assert.ok(comboMatches(hkCombo('mute'), key('KeyM')), 'M без модификаторов = матч');
assert.ok(!comboMatches(hkCombo('mute'), key('KeyM', { ctrlKey: true })), 'Ctrl+M ≠ M');
assert.ok(!comboMatches(hkCombo('mute'), key('KeyN')), 'N ≠ M');

// 4. Диспетчер: PTT нажатие/отпускание
hkSetPtt(true);
listeners.keydown(key('KeyV'));
assert.strictEqual(__hk.pttHeld, true, 'зажатие V включает PTT');
listeners.keydown(key('KeyV', { repeat: true }));
assert.strictEqual(__hk.pttHeld, true, 'автоповтор не ломает');
listeners.keyup(key('KeyV'));
assert.strictEqual(__hk.pttHeld, false, 'отпускание V выключает PTT');
// отпускание с зажатым Shift (комбо без модификаторов) — ключевой кейс "зависания"
listeners.keydown(key('KeyV'));
listeners.keyup(key('KeyV', { shiftKey: true }));
assert.strictEqual(__hk.pttHeld, false, 'keyup с лишним модификатором всё равно отпускает');

// 5. Ввод текста не триггерит горячие клавиши
hkSetPtt(true);
listeners.keydown(key('KeyV', {}, { tagName: 'INPUT' }));
assert.strictEqual(__hk.pttHeld, false, 'V в поле ввода не включает PTT');
listeners.keydown(key('KeyM', {}, { tagName: 'TEXTAREA' }));
assert.strictEqual(toasts.filter(t => t.m === 'join_voice_first').length, 0, 'M в чате не даёт тост "войди в войс"');

// 6. blur сбрасывает PTT (потеря keyup)
listeners.keydown(key('KeyV'));
listeners['win:blur']();
assert.strictEqual(__hk.pttHeld, false, 'blur сбрасывает PTT');

// 7. Мьют вне войса → тост, состояние не меняется
listeners.keydown(key('KeyM'));
assert.ok(toasts.some(t => t.m === 'join_voice_first' && t.e), 'мьют вне войса = тост-ошибка');

// 8. Захват клавиши: назначение
toasts.length = 0;
hkStartCapture('mute');
assert.strictEqual(__hk.capturing, 'mute', 'захват начат');
_hkCaptureKey(key('KeyQ'));
assert.strictEqual(__hk.capturing, null, 'захват завершён');
assert.strictEqual(hkCombo('mute').code, 'KeyQ', 'мьют переназначен на Q');
assert.ok(store.mp_hotkeys && JSON.parse(store.mp_hotkeys).mute.combo.code === 'KeyQ', 'сохранено в localStorage');

// 9. Конфликт: та же клавиша у другого действия отклоняется
hkStartCapture('deafen');
toasts.length = 0;
_hkCaptureKey(key('KeyQ')); // уже занята мьютом
assert.strictEqual(hkCombo('deafen').code, 'KeyB', 'конфликт — комбо не изменилось');
assert.ok(toasts.some(t => t.e && t.m.indexOf('hk_name_mute') >= 0), 'тост о конфликте с указанием действия');

// 10. Модификатор сам по себе не назначается, Escape отменяет
hkStartCapture('ptt');
_hkCaptureKey(key('ControlLeft'));
assert.strictEqual(__hk.capturing, 'ptt', 'модификатор в ожидании');
_hkCaptureKey(key('Escape'));
assert.strictEqual(__hk.capturing, null, 'Escape отменил захват');
assert.strictEqual(hkCombo('ptt').code, 'KeyV', 'комбо PTT не изменилось');

// 11. Сброс по умолчанию
hkStartCapture('mute'); _hkCaptureKey(key('KeyQ'));
hkResetDefaults();
assert.strictEqual(hkCombo('mute').code, 'KeyM', 'сброс вернул M');
assert.strictEqual(hkLoad().ptt.enabled, false, 'сброс выключил PTT');

// 12. Битое хранилище не роняет загрузку
store.mp_hotkeys = '{oops';
__hk.cfgNull = true;
cfg = hkLoad();
assert.strictEqual(cfg.mute.combo.code, 'KeyM', 'битый JSON → дефолты');

// 13. Кнопка мыши «назад»: навигация гасится, кнопка назначается как хоткей
function mouseEv(button) { return { button, ctrlKey: false, altKey: false, shiftKey: false, _pd: false, preventDefault() { this._pd = true; } }; }
let mev = mouseEv(3);
listeners.mousedown(mev);
assert.strictEqual(mev._pd, true, 'mousedown мыши «назад» заблокирован (preventDefault)');
hkStartCapture('ptt');
mev = mouseEv(3);
listeners.mousedown(mev);
assert.strictEqual(__hk.capturing, null, 'захват мыши завершён');
assert.strictEqual(hkCombo('ptt').code, 'XButton1', 'PTT назначена на кнопку «назад»');
assert.strictEqual(comboLabel(hkCombo('ptt')), 'Мышь ←', 'подпись кнопки мыши');

// 14. PTT на мыши: удержание/отпускание, старая клавиша V отвязана
hkSetPtt(true);
mev = mouseEv(3);
listeners.mousedown(mev);
assert.strictEqual(__hk.pttHeld, true, 'мышь «назад» удерживает PTT');
listeners.keydown(key('KeyV'));
assert.strictEqual(__hk.pttHeld, true, 'V отвязана — PTT не сбивается');
listeners.mouseup(mouseEv(3));
assert.strictEqual(__hk.pttHeld, false, 'отпускание мыши снимает PTT');

// 15. События из главного процесса (IPC-канал глобального режима)
toasts.length = 0;
_hkGlobalEvent({ action: 'mute', type: 'down' });
assert.ok(toasts.some(t => t.m === 'join_voice_first' && t.e), 'глобальный мьют вне войса → тост');
_hkGlobalEvent({ action: 'ptt', type: 'down' });
assert.strictEqual(__hk.pttHeld, true, 'IPC PTT-down ставит удержание');
_hkGlobalEvent({ action: 'ptt', type: 'up' });
assert.strictEqual(__hk.pttHeld, false, 'IPC PTT-up снимает удержание');

// 16. Медиадействия: F8/F9/F7 управляют плеером (локальный диспетчер + IPC-канал)
let mediaLog = [];
global.togglePlay = () => mediaLog.push('playpause');
global.playNextTrack = () => mediaLog.push('next');
global.playPrevTrack = () => mediaLog.push('prev');
listeners.keydown(key('F8'));
listeners.keydown(key('F9'));
listeners.keydown(key('F7'));
assert.deepStrictEqual(mediaLog, ['playpause', 'next', 'prev'], 'F8/F9/F7 → пауза/следующий/предыдущий');
mediaLog = [];
_hkGlobalEvent({ action: 'playpause', type: 'down' });
_hkGlobalEvent({ action: 'next', type: 'down' });
_hkGlobalEvent({ action: 'prev', type: 'down' });
assert.deepStrictEqual(mediaLog, ['playpause', 'next', 'prev'], 'IPC-события медиадействий');
// захват: F8 занята паузой — мьют не может её забрать
hkStartCapture('mute');
toasts.length = 0;
_hkCaptureKey(key('F8'));
assert.strictEqual(hkCombo('mute').code, 'KeyM', 'конфликт с медиа-клавишей — мьют остался на M');
assert.ok(toasts.some(t => t.e && t.m.indexOf('hk_name_playpause') >= 0), 'тост о конфликте указывает на паузу');
delete global.togglePlay; delete global.playNextTrack; delete global.playPrevTrack;

console.log('ALL TESTS PASSED (16 блоков, медиа включительно)');
