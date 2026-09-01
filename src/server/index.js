const express = require('express'); const path = require('path'); const fs = require('fs');
const { Server } = require('socket.io'); const { PeerServer } = require('peer');
const config = require('./config.js'); const utils = require('./utils.js');
const app = express();

// 🔍 Диагностика: видит ли сервер файлы
// 🔍 Отладка: покажет откуда сервер раздаёт файлы
app.get('/debug', (req, res) => {
    res.json({
        SRC_DIR: config.SRC_DIR,
        js_folder: fs.existsSync(path.join(config.SRC_DIR, 'js')),
        css_folder: fs.existsSync(path.join(config.SRC_DIR, 'css')),
        i18n_js: fs.existsSync(path.join(config.SRC_DIR, 'js', 'i18n.js')),
        helpers_js: fs.existsSync(path.join(config.SRC_DIR, 'js', 'helpers.js')),
        style_css: fs.existsSync(path.join(config.SRC_DIR, 'css', 'style.css')),
        index_html: fs.existsSync(path.join(config.SRC_DIR, 'index.html')),
        start_html: fs.existsSync(path.join(config.SRC_DIR, 'start.html'))
    });
});

app.get('/', (req, res) => res.sendFile(path.join(config.SRC_DIR, 'start.html')));
app.get('/room', (req, res) => res.sendFile(path.join(config.SRC_DIR, 'index.html')));
// ✅ Явная раздача js и css (дублируем static для надёжности)
app.use('/js', express.static(path.join(config.SRC_DIR, 'js')));
app.use('/css', express.static(path.join(config.SRC_DIR, 'css')));
app.use(express.static(config.SRC_DIR));
app.use('/music', express.static(path.join(config.SRC_DIR, 'music')));
const { uploadsDir } = require('./routes.js')(app, utils);
const server = config.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] }, maxHttpBufferSize: 10 * 1024 * 1024 });
try { if (config.IS_HTTPS) PeerServer({ port: 3002, path: '/peerjs', debug: false, ssl: { key: fs.readFileSync(config.KEY_PATH), cert: fs.readFileSync(config.CERT_PATH) } }); else PeerServer({ port: 3002, path: '/peerjs', debug: false }); } catch (e) { console.warn('PeerServer failed:', e.message); }
const roomsApi = require('./rooms.js')(io, utils);
require('./sockets.js')(io, roomsApi, utils);
require('./lan.js')({ port: config.PORT, https: config.IS_HTTPS }, () => Object.keys(roomsApi.rooms).filter(c => roomsApi.rooms[c].lanOpen).map(c => ({ code: c, name: (roomsApi.rooms[c].users.find(u => u.isAdmin) || {}).name || 'MusicPulse', users: roomsApi.rooms[c].users.length })));
setInterval(() => { try { fs.readdirSync(uploadsDir).forEach(f => { const fp = path.join(uploadsDir, f); const st = fs.statSync(fp); if (Date.now() - st.mtimeMs > 7 * 24 * 60 * 60 * 1000) { fs.unlinkSync(fp); } }); } catch (e) {} }, 24 * 60 * 60 * 1000);
server.on('error', e => console.error('❌ Server error:', e.message));
if (require.main === module) server.listen(config.PORT, '0.0.0.0', () => { console.log(`🚀 ${config.IS_HTTPS ? 'https' : 'http'}://localhost:${config.PORT}`); utils.getLocalTracks(); });
module.exports = { app, server, io, IS_HTTPS: config.IS_HTTPS, PORT: config.PORT };