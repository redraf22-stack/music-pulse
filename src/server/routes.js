const path = require('path'); const fs = require('fs'); const multer = require('multer'); const rateLimit = require('express-rate-limit'); const axios = require('axios');
let ROOMS = null;
const deezerCache = new Map();
async function deezerSearch(q) {
    const key = String(q || '').toLowerCase().trim();
    const now = Date.now();
    const c = deezerCache.get(key);
    if (c && now - c.time < 120000) return c;
    const r = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=50&index=0`, { timeout: 10000 });
    const entry = { time: now, tracks: r.data.data || [], total: r.data.total || 0 };
    deezerCache.set(key, entry);
    if (deezerCache.size > 100) deezerCache.delete(deezerCache.keys().next().value);
    return entry;
}
module.exports = function (app, utils) {
    const uploadsDir = path.join(require('./config.js').DATA_DIR, 'uploads');
    const urlcacheDir = path.join(require('./config.js').DATA_DIR, 'urlcache');
    const urltracks = require('./urltracks.js');
    const resolver = require('./resolver.js');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    if (!fs.existsSync(urlcacheDir)) fs.mkdirSync(urlcacheDir, { recursive: true });
    app.use('/uploads', require('express').static(uploadsDir));

    app.get('/local-file', (req, res) => {
        const dir = require('./config.js').getCustomMusicDir();
        const rel = req.query.p || '';
        const full = path.resolve(path.join(dir, rel));
        if (!rel || !full.startsWith(path.resolve(dir) + path.sep)) return res.status(403).send('Forbidden');
        if (!fs.existsSync(full)) return res.status(404).send('Not found');
        res.sendFile(full);
    });

    app.get('/api/user-tracks', async (req, res) => {
        const roomCode = (req.query.room || '').toUpperCase();
        res.json(await require('./playlists.js').getUserTracks((req.query.nick || '').trim(), (req.query.host || '').trim(), ROOMS ? ROOMS[roomCode] : null));
    });

    app.get('/api/debug-music', async (req, res) => {
        const dir = require('./config.js').getCustomMusicDir();
        const tracks = await utils.getLocalTracks(true);
        res.json({ dir: dir, count: tracks.length, sample: tracks.slice(0, 3).map(t => t.filename) });
    });

    const storage = multer.diskStorage({ destination: (r, f, cb) => cb(null, uploadsDir), filename: (r, f, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(f.originalname)) });
    const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });
    const searchLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
    const localLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
    const uploadLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 20 });

    app.get('/api/local-tracks', localLimiter, async (req, res) => {
    const page = parseInt(req.query.page) || 1, perPage = 5, filter = (req.query.filter || '').toLowerCase().trim();
    const owner = (req.query.owner || '').trim();
    const roomCode = (req.query.room || '').toUpperCase();
    try {
        let combined = [];
        const room = roomCode && ROOMS && ROOMS[roomCode] ? ROOMS[roomCode] : null;
        if (room) {
            // Берём треки из АКТИВНОГО плейлиста
            const plTracks = await require('./playlists.js').resolveTracks(room, true);
            combined = plTracks.map(t => ({
                ...t,
                normalizedTitle: utils.normalizeStr(t.title),
                normalizedArtist: utils.normalizeStr(t.artist),
                normalizedAlbum: ''
            }));
        } else {
            // Вне комнаты — все скачанные + URL
            const all = await utils.getLocalTracks();
            const urlAll = owner ? urltracks.listFor(owner).map(t => ({
                filename: t.id, title: t.title, artist: t.artist, album: t.album || null, duration: 0,
                isUrl: true, rawUrl: t.url, autoCover: t.autoCover, coverSaved: t.cover || '',
                normalizedTitle: utils.normalizeStr(t.title), normalizedArtist: utils.normalizeStr(t.artist), normalizedAlbum: ''
            })) : [];
            combined = [...all.map(t => ({ ...t, normalizedTitle: utils.normalizeStr(t.title), normalizedArtist: utils.normalizeStr(t.artist), normalizedAlbum: '' })), ...urlAll];
        }
        if (filter) {
            const nf = utils.normalizeStr(filter);
            combined = combined.filter(t => (t.normalizedTitle || '').includes(nf) || (t.normalizedArtist || '').includes(nf));
        }
        const total = combined.length, start = (page - 1) * perPage;
        const enriched = await Promise.all(combined.slice(start, start + perPage).map(async t => {
            if (t.isUrl) {
                const cover = t.autoCover ? await utils.findCover(t.title, t.artist) : (t.coverSaved || t.cover || '');
                return utils.normalizeTrack({ id: 'url-' + (t.id || t.filename), title: t.title, artist: t.artist, cover, preview: t.preview || ('/url-proxy?url=' + encodeURIComponent(t.rawUrl || t.url || '')), duration: 0, isLocal: true, isUrl: true });
            }
            if (t.cover) return utils.normalizeTrack(t);
            const cover = await utils.findCover(t.title, t.artist);
            return utils.normalizeTrack({ id: 'local-' + t.filename, title: t.title, artist: t.artist, cover, preview: '/local-file?p=' + encodeURIComponent(t.filename), duration: Math.floor(t.duration || 30), isLocal: true });
        }));
        res.json({ data: enriched, total, page, pages: Math.ceil(total / perPage) });
    } catch (e) { console.error('[local-tracks]', e.message); res.status(500).json({ error: 'Ошибка' }); }
});

    app.get('/api/search', searchLimiter, async (req, res) => {
    const q = (req.query.q || '').trim(), page = parseInt(req.query.page) || 1, lc = 5;
    const owner = (req.query.owner || '').trim();
    const roomCode = (req.query.room || '').toUpperCase();
    if (!q) return res.status(400).json({ error: 'Нет запроса' });
    try {
        const nq = utils.normalizeStr(q);
        const room = roomCode && ROOMS && ROOMS[roomCode] ? ROOMS[roomCode] : null;

        // 1. Скачанные (из плейлиста) + URL — считаем на каждой странице (нужно для смещения)
        let fixed = [];
        if (room) {
            try {
                const plTracks = await require('./playlists.js').resolveTracks(room, false);
                fixed = plTracks
                    .filter(t => !t.isUrl && ((utils.normalizeStr(t.title) || '').includes(nq) || (utils.normalizeStr(t.artist) || '').includes(nq)))
                    .map(t => utils.normalizeTrack({ id: 'local-' + t.filename, title: t.title, artist: t.artist, duration: Math.floor(t.duration || 30), cover: t.cover || '', preview: '/local-file?p=' + encodeURIComponent(t.filename), isLocal: true, isUrl: false }));
            } catch (e) { console.error('[search] playlist fail:', e.message); }
        }
        if (owner) {
            urltracks.listFor(owner).forEach(t => {
                if ((utils.normalizeStr(t.title) || '').includes(nq) || (utils.normalizeStr(t.artist || '') || '').includes(nq)) {
                    fixed.push(utils.normalizeTrack({ id: 'url-' + t.id, title: t.title, artist: t.artist, duration: 0, cover: t.cover || '', preview: t.preview || ('/url-proxy?url=' + encodeURIComponent(t.url)), isLocal: true, isUrl: true, autoCover: t.autoCover }));
                }
            });
        }

        // 2. Deezer — ОДИН запрос на весь поиск (кеш 2 мин), как в старом + обложки
        let dzTracks = [], dzTotal = 0;
        try {
            const dz = await deezerSearch(q);
            dzTracks = dz.tracks; dzTotal = dz.total;
        } catch (e) { console.error('[search] deezer fail:', e.message); }

        const localTracks = await utils.getLocalTracks();
        const fixedKeys = new Set(fixed.map(t => utils.normalizeStr(t.title) + '|' + utils.normalizeStr((t.artist && t.artist.name) || '')));
        const deezerAll = dzTracks
            .filter(d => !fixedKeys.has(utils.normalizeStr(d.title) + '|' + utils.normalizeStr((d.artist && d.artist.name) || '')))
            .map(t => {
                const lm = utils.findLocalMatch(t, localTracks);
                if (lm) return utils.normalizeTrack({ ...t, isLocal: true, preview: '/local-file?p=' + encodeURIComponent(lm.filename), duration: Math.floor(lm.duration || t.duration), cover: t.album?.cover_small });
                return utils.normalizeTrack({ ...t, isLocal: false, cover: t.album?.cover_small });
            });

        // 3. Обложки для fixed (только 1-я страница)
        if (page === 1) {
    const coverMap = new Map();
    dzTracks.forEach(d => coverMap.set(utils.normalizeStr(d.title) + '|' + utils.normalizeStr((d.artist && d.artist.name) || ''), (d.album && (d.album.cover_medium || d.album.cover_small)) || ''));
    await Promise.all(fixed.map(async t => {
        if (!t.cover) {
            const key = utils.normalizeStr(t.title) + '|' + utils.normalizeStr((t.artist && t.artist.name) || '');
            t.cover = coverMap.get(key) || await utils.findCover(t.title, (t.artist && t.artist.name) || '');
        }
    }));
}

        // 4. Страница: ровно 5 карточек. Стр.1: fixed сверху + deezer. Стр.2+: deezer со смещением
        let data;
        if (page === 1) {
            data = [...fixed, ...deezerAll.slice(0, Math.max(0, lc - fixed.length))];
        } else {
            const dStart = Math.max(0, (page - 1) * lc - fixed.length);
            data = deezerAll.slice(dStart, dStart + lc);
        }

        console.log('[search]', JSON.stringify({ q, page, fixed: fixed.length, deezer: deezerAll.length, out: data.length }));
        const total = fixed.length + dzTotal;
        res.json({ data, total, page, pages: Math.ceil(total / lc) });
    } catch (e) { console.error('[search]', e.message); res.status(500).json({ error: 'Ошибка API' }); }
});

    app.post('/api/upload-chat', uploadLimiter, (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err) return res.status(413).json({ error: 'Файл слишком большой (макс. 1 ГБ)' });
            next();
        });
    }, (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
        const mt = req.file.mimetype; let type = 'file';
        if (mt.startsWith('image/')) type = 'image'; else if (mt.startsWith('video/')) type = 'video'; else if (mt.startsWith('audio/')) type = 'audio';
        res.json({ success: true, url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size, type, mimetype: mt });
    });

    app.get('/proxy', async (req, res) => {
        const url = req.query.url;
        if (!url || !url.includes('dzcdn.net')) return res.status(403).send('Forbidden');
        try { const r = await axios.get(url, { responseType: 'stream' }); res.set('Content-Type', 'audio/mpeg'); r.data.pipe(res); } catch (e) { res.status(502).send('Ошибка аудио'); }
    });

    app.get('/url-proxy', async (req, res) => {
        const url = req.query.url;
        if (!url || !/^https?:\/\//i.test(url)) return res.status(403).send('Forbidden');
        try {
            const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
            if (req.headers.range) headers.Range = req.headers.range;
            const r = await axios.get(url, { responseType: 'stream', timeout: 30000, headers, validateStatus: s => s < 400 });
            if (r.headers['content-range']) res.set('Content-Range', r.headers['content-range']);
            res.set('Accept-Ranges', 'bytes');
            res.set('Content-Type', r.headers['content-type'] || 'audio/mpeg');
            if (r.headers['content-length']) res.set('Content-Length', r.headers['content-length']);
            res.status(r.status);
            r.data.pipe(res);
        } catch (e) { console.error('[url-proxy] FAIL', url, e.message); res.status(502).send('Ошибка аудио'); }
    });

    app.get('/api/url-tracks', (req, res) => { res.json({ data: urltracks.listFor((req.query.owner || '').trim()) }); });
    app.post('/api/url-track', require('express').json(), (req, res) => {
        const { owner, title, artist, album, url, cover, autoCover } = req.body || {};
        if (!owner || !title || !url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Нужны ник, название и корректный URL' });
        const t = urltracks.add(owner, { title, artist: artist || 'Unknown Artist', album: album || '', url, cover: cover || '', autoCover: !!autoCover });
        res.json({ success: true, track: t });
    });
    app.delete('/api/url-track', (req, res) => { res.json({ success: urltracks.remove((req.query.owner || '').trim(), req.query.id || '') }); });
    app.post('/api/resolve-url', require('express').json(), async (req, res) => {
        try { res.json(await resolver.resolveAudioUrl((req.body || {}).url)); }
        catch (e) { res.json({ ok: false, error: 'Ошибка проверки ссылки' }); }
    });

    app.get('/api/music-dir', (req, res) => { res.json({ dir: require('./config.js').getCustomMusicDir() }); });
    app.post('/api/music-dir', require('express').json(), (req, res) => {
        const dir = (req.body || {}).dir;
        if (!dir || !fs.existsSync(dir)) return res.status(400).json({ error: 'Папка не найдена' });
        utils.setMusicDir(dir);
        res.json({ success: true, dir });
    });

    return { uploadsDir };
};
module.exports.setRooms = r => { ROOMS = r; };