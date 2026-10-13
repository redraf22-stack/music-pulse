// Интеграционный тест MusicPulse-сервера: фикс кика/бана (голос рвётся у всех) + rate-limit входа.
// Запуск: node mp-server-test.js   (из любого места; сервер поднимается на порту 3911)
const path = require('path');
const WebSocket = require('ws');

const PORT = 3911;
const URL = 'wss://127.0.0.1:' + PORT + '/socket.io/?EIO=4&transport=websocket';

let passed = 0, failed = 0;
function check(cond, name) {
    if (cond) { passed++; console.log('  OK  ' + name); }
    else { failed++; console.log('  FAIL ' + name); }
}
function waitUntil(fn, ms) {
    return new Promise(res => {
        const t0 = Date.now();
        const iv = setInterval(() => {
            if (fn()) { clearInterval(iv); res(true); }
            else if (Date.now() - t0 > (ms || 3000)) { clearInterval(iv); res(false); }
        }, 40);
    });
}

// Мини-клиент socket.io по протоколу engine.io v4 (ws-транспорт)
class C {
    constructor(name) { this.name = name; this.handlers = {}; this.acks = {}; this.ackId = 0; this.users = []; }
    connect() {
        return new Promise((res, rej) => {
            this.ws = new WebSocket(URL, { rejectUnauthorized: false });
            this.ws.on('error', rej);
            this.ws.on('message', d => this.handle(d.toString()));
            this._openRes = res;
        });
    }
    handle(s) {
        if (s[0] === '0') { this.ws.send('40'); return; }          // engine open -> socket connect
        if (s === '2') { this.ws.send('3'); return; }              // ping
        if (s.startsWith('40')) { this._openRes && this._openRes(); return; }
        if (s.startsWith('42')) { const [ev, arg] = JSON.parse(s.slice(2)); (this.handlers[ev] || []).forEach(f => f(arg)); return; }
        if (s.startsWith('43')) { const m = s.match(/^43(\d+)\[([\s\S]*)\]$/); if (!m) return; const cb = this.acks[m[1]]; delete this.acks[m[1]]; const args = JSON.parse('[' + m[2] + ']'); cb && cb(args[0]); return; }
    }
    on(ev, f) { (this.handlers[ev] = this.handlers[ev] || []).push(f); }
    emit(ev, arg, ack) {
        const id = ++this.ackId;
        let payload = '["' + ev + '"' + (arg !== undefined ? ',' + JSON.stringify(arg) : '') + ']';
        if (ack) { this.acks[id] = ack; this.ws.send('42' + id + payload); }
        else this.ws.send('42' + payload);
    }
    call(ev, arg) { return new Promise(res => this.emit(ev, arg, res)); }
}

async function main() {
    // Поднимаем сервер приложения на тестовом порту (HTTP-режим через временный DATA_DIR)
    // PeerServer (порт 3002) тесту не нужен, а занимать порты под запущенным приложением нельзя —
    // подменяем модуль целиком через require.cache (exports у него на геттерах, простая перезапись не работает)
    const peerPath = require.resolve('peer');
    require.cache[peerPath] = { id: peerPath, filename: peerPath, loaded: true, exports: { PeerServer: () => null, ExpressPeerServer: () => null } };
    const serverMod = require('../src/server/index.js');
    await new Promise(res => serverMod.server.listen(PORT, '127.0.0.1', res));
    console.log('тестовый сервер поднят на :' + PORT);

    const A = new C('admin'); await A.connect();                       // админ
    A.on('users-update', u => { A.users = u; });
    const rA = await A.call('create-room', { nickname: 'Admin' });
    check(rA && rA.code && rA.role === 'admin', 'create-room: комната создана, код ' + (rA && rA.code));

    const B = new C('friend'); await B.connect();
    const rB = await B.call('join-room', { code: rA.code, nickname: 'Friend' });
    check(rB && !rB.error && rB.code === rA.code, 'join-room: друг вошёл');

    A.emit('register-peer-id', 'peerA'); B.emit('register-peer-id', 'peerB');
    await waitUntil(() => { const u = A.users.find(x => x.name === 'Friend'); return u && u.peerId === 'peerB'; });
    const bId = (A.users.find(x => x.name === 'Friend') || {}).id;
    check(!!bId, 'peerId друга разослан по комнате');

    // ===== КИК: раньше user-left-voice НЕ отправлялся — админ слышал кикнутого навсегда =====
    let leftB = null, kickedB = false;
    A.on('user-left-voice', d => { if (d.id === bId) leftB = d; });
    B.on('kicked', () => { kickedB = true; });
    A.emit('kick-user', bId);
    await waitUntil(() => leftB && kickedB);
    check(!!leftB, 'kick: админ получил user-left-voice (голос кикнутого обрывается)');
    check(leftB && leftB.peerId === 'peerB', 'kick: в событии дошёл peerId');
    check(kickedB, 'kick: кикнутый получил событие kicked');

    // ===== БАН: та же история =====
    const D = new C('dude'); await D.connect();
    const rD = await D.call('join-room', { code: rA.code, nickname: 'Dude' });
    check(rD && !rD.error, 'join-room: второй друг вошёл');
    D.emit('register-peer-id', 'peerD');
    await waitUntil(() => { const u = A.users.find(x => x.name === 'Dude'); return u && u.peerId === 'peerD'; });
    const dId = (A.users.find(x => x.name === 'Dude') || {}).id;
    let leftD = null, bannedD = false;
    A.on('user-left-voice', d => { if (d.id === dId) leftD = d; });
    D.on('banned', () => { bannedD = true; });
    A.emit('ban-user', dId);
    await waitUntil(() => leftD && bannedD);
    check(!!leftD && leftD.peerId === 'peerD', 'ban: user-left-voice с peerId ушёл комнате');
    check(bannedD, 'ban: забаненный получил событие banned');

    // Забаненный IP (тут у всех клиентов 127.0.0.1) не пускается в комнату
    const rBan = await B.call('join-room', { code: rA.code, nickname: 'Friend' });
    check(!!(rBan && rBan.error === 'banned'), 'ban-ip: забаненный IP не может вернуться: "' + (rBan && rBan.error) + '"');

    // ===== RATE-LIMIT: перебор кодов комнаты (блок на 11-й попытке после 10 неудач) =====
    const E = new C('brute'); await E.connect();
    let last = null;
    for (let i = 0; i < 10 && !(last && last.error && last.error.indexOf('Слишком много') === 0); i++) {
        last = await E.call('join-room', { code: String(90000 + i), nickname: 'Bot' });
    }
    last = await E.call('join-room', { code: '99999', nickname: 'Bot' }); // ещё одна — должна упереться в лимит
    check(!!(last && last.error && last.error.indexOf('Слишком много') === 0), 'ratelimit: после 10 неудач вход блокируется: "' + (last && last.error) + '"');

    console.log('\nИтог: ' + passed + ' OK, ' + failed + ' FAIL');
    process.exit(failed ? 1 : 0);
}

setTimeout(() => { console.log('ТАЙМАУТ'); process.exit(2); }, 20000);
main().catch(e => { console.error('ОШИБКА ТЕСТА:', e); process.exit(3); });
