const dgram = require('dgram');
module.exports = function (info, getOpenRooms) {
    let sock = null;
    try { sock = dgram.createSocket('udp4'); sock.on('error', () => {}); sock.bind(33334, () => { try { sock.setBroadcast(true); } catch (e) {} }); } catch (e) { sock = null; }
    setInterval(() => {
        if (!sock) return;
        const payload = Buffer.from(JSON.stringify({ type: 'musicpulse-rooms', port: info.port, https: info.https, rooms: getOpenRooms() }));
        try { sock.send(payload, 0, payload.length, 33335, '255.255.255.255'); } catch (e) {}
    }, 2000);
};