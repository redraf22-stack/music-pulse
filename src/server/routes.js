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
        const ip = String(req.ip || '');
        if (ip !== '127.0.0.1' && ip !== '::1' && !ip.startsWith('::ffff:127.')) return res.status(403).send('Forbidden');
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
            normalizedArtist: utils.normalizeStr((t.artist && t.artist.name) || t.artist || ''),
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
                const cover = await require('./playlists.js').resolveLocalCover({ filename: t.filename, title: t.title, artist: t.artist, cover: t.cover });
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
                    .filter(t => !t.isUrl && ((utils.normalizeStr(t.title) || '').includes(nq) || (utils.normalizeStr((t.artist && t.artist.name) || t.artist || '') || '').includes(nq)))
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
            const r = await axios.get(url, { responseType: 'stream', timeout: 60000, headers, validateStatus: s => s < 400 });
            if (r.headers['content-range']) res.set('Content-Range', r.headers['content-range']);
            res.set('Accept-Ranges', 'bytes');
            res.set('Content-Type', r.headers['content-type'] || 'audio/mpeg');
            if (r.headers['content-length']) res.set('Content-Length', r.headers['content-length']);
            res.status(r.status);
            r.data.pipe(res);
        } catch (e) { console.error('[url-proxy] FAIL', url, e.message); res.status(502).send('Ошибка аудио'); }
    });

    app.get('/api/url-tracks', (req, res) => {
        const owner = (req.query.owner || '').trim();
        const nick = (req.query.nick || '').trim();
        if (nick && nick !== owner) return res.status(403).send('Forbidden');
        res.json({ data: urltracks.listFor(owner) });
    });
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
    // ===== Добавление музыки файлом =====
const musicTempDir = path.join(require('./config.js').DATA_DIR, 'music-temp');
const coversDir = path.join(require('./config.js').DATA_DIR, 'covers');
if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
app.use('/covers', require('express').static(coversDir));
if (!fs.existsSync(musicTempDir)) fs.mkdirSync(musicTempDir, { recursive: true });
const uploadMusic = multer({ storage: multer.diskStorage({ destination: (r, f, cb) => cb(null, musicTempDir), filename: (r, f, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(f.originalname)) }), limits: { fileSize: 1024 * 1024 * 1024 } });
app.post('/api/upload-music', (req, res, next) => {
    uploadMusic.single('file')(req, res, (err) => { if (err) return res.status(413).json({ error: 'Файл слишком большой' }); next(); });
}, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const fp = path.join(musicTempDir, req.file.filename);
    let title = null, artist = null, album = null, coverUrl = '';
    try {
        const mm = require('music-metadata');
        const m = await mm.parseFile(fp);
        title = m.common.title || null; artist = m.common.artist || null; album = m.common.album || null;
        if (m.common.picture && m.common.picture.length) {
            const pic = m.common.picture[0];
            const cname = 'emb-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + (pic.format === 'image/png' ? '.png' : '.jpg');
            fs.writeFileSync(path.join(coversDir, cname), Buffer.from(pic.data));
            coverUrl = '/covers/' + cname;
        }
    } catch (e) {}
    if (!title) { const b = path.parse(req.file.originalname).name; if (b.includes('-')) { const p = b.split('-'); artist = artist || p[0].trim(); title = p.slice(1).join('-').trim(); } else title = b; }
    res.json({ success: true, id: req.file.filename, title: title || 'Без названия', artist: artist || 'Unknown Artist', album: album || '', cover: coverUrl });
});
app.post('/api/confirm-music', require('express').json(), async (req, res) => {
    const { id, title, artist, album, owner, cover } = req.body || {};
    if (!id || !title || !/^[0-9]+-[0-9]+\.[a-z0-9]+$/i.test(id)) return res.status(400).json({ error: 'Нет данных' });
    const src = path.join(musicTempDir, id);
    if (!fs.existsSync(src)) return res.status(404).json({ error: 'Временный файл устарел, выбери заново' });
    const ext = path.extname(id) || '.mp3';
    const safe = s => String(s || '').replace(/[\\/:*?"<>|]/g, '').trim() || 'track';
    const dir = require('./config.js').getCustomMusicDir();
    let name = safe(artist) + ' - ' + safe(title) + ext;
    let dest = path.join(dir, name); let i = 1;
    while (fs.existsSync(dest)) { name = safe(artist) + ' - ' + safe(title) + ' (' + (i++) + ')' + ext; dest = path.join(dir, name); }
    fs.copyFileSync(src, dest); try { fs.unlinkSync(src); } catch (e) {}
    try { utils.getLocalTracks(true); } catch (e) {}
    if (cover) { try { require('./playlists.js').setOverride(name, { cover: cover }); } catch (e) {} }
    // Новая песня — ВЫКЛЮЧЕНА во всех плейлистах комнаты, где есть владелец
    if (ROOMS && owner) {
        Object.keys(ROOMS).forEach(code => {
            const room = ROOMS[code];
            if (!room || !room.users.some(u => u.name === owner)) return;
            (room.playlists || []).forEach(pl => {
                if (pl.includeAll && pl.includeAll[owner]) { pl.excluded = pl.excluded || {}; pl.excluded['local|' + name] = true; }
            });
        });
    }
    res.json({ success: true, filename: name });
});
app.post('/api/update-track', require('express').json(), async (req, res) => {
    const { type, id, owner, data } = req.body || {};
    if (!type || !id || !owner || !data) return res.status(400).json({ error: 'Нет данных' });
    if (type === 'url') {
        const ut = require('./urltracks.js');
        const upd = { id, title: data.title, artist: data.artist, album: data.album, cover: data.cover, autoCover: !!data.autoCover };
        if (data.url) upd.url = data.url;
        const updated = ut.update(owner, upd);
        if (!updated) return res.status(404).json({ error: 'Трек не найден' });
    } else if (type === 'shared') {
        require('./playlists.js').setOverride('shared|' + owner + '|' + id, data);
    } else if (type === 'local') {
        const PL = require('./playlists.js');
        const ovr = {};
        if (data.title) ovr.title = data.title;
        if (data.artist) ovr.artist = data.artist;
        if (data.album) ovr.album = data.album;
        if (data.cover !== undefined) {
            const prev = PL.loadOverrides()[id] || {};
            if (data.cover === '') {
                if (prev.cover) ovr.prevCover = prev.cover;
                else if (prev.prevCover) ovr.prevCover = prev.prevCover;
                else { try { const emb = await PL.embeddedCover(id); if (emb) ovr.prevCover = emb; } catch (e) {} }
                ovr.cover = '';
            } else {
                ovr.cover = data.cover;
            }
        }
        PL.setOverride(id, ovr);
    } else return res.status(400).json({ error: 'Неизвестный тип' });
    res.json({ success: true });
});
app.get('/api/my-tracks', async (req, res) => {
    const owner = (req.query.owner || '').trim();
    try {
        const ip = String(req.ip || '');
        const isLocal = ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.');
        const PL = require('./playlists.js');
        const ovr = PL.loadOverrides();
        let local = [];
        if (isLocal) {
            const all = await utils.getLocalTracks();
            local = await Promise.all(all.map(async t => {
                const o = ovr[t.filename] || {};
                let cover = '';
                try { cover = await PL.resolveLocalCover(t); } catch (e) { cover = t.cover || ''; }
                return { type: 'local', filename: t.filename, title: o.title || t.title, artist: o.artist || t.artist, album: o.album || t.album || '', cover, duration: Math.floor(t.duration || 0), autoCover: ('cover' in o) && !o.cover, prevCover: o.prevCover || '' };
            }));
        }
        const urls = [];
        for (const t of require('./urltracks.js').listFor(owner)) {
            let cover = t.cover || '';
            if (!cover && t.autoCover) { try { cover = await utils.findCover(t.title, t.artist); } catch (e) {} }
                        urls.push({ type: 'url', id: t.id, title: t.title, artist: t.artist, album: t.album || '', cover, url: t.url || '', duration: 0, autoCover: !!t.autoCover, prevCover: '' });
        }
                const shared = [];
        const roomCode = (req.query.room || '').toUpperCase();
        const room = ROOMS && ROOMS[roomCode];
        if (room && room.sharedMusic && room.sharedMusic[owner]) {
            room.sharedMusic[owner].tracks.forEach(t => {
                const o = ovr['shared|' + owner + '|' + t.file] || {};
                shared.push({ type: 'shared', file: t.file, title: o.title || t.title, artist: o.artist || t.artist, album: '', cover: o.cover || t.cover || '', duration: 0, autoCover: !(('cover' in o ? o.cover : '') || t.cover || ''), prevCover: '' });
            });
        }
        res.json({ data: [...local, ...urls, ...shared] });
    } catch (e) { console.error('[my-tracks]', e.message); res.status(500).json({ error: e.message }); }
});
app.post('/api/delete-track', require('express').json(), async (req, res) => {
    const { type, id, owner } = req.body || {};
    if (!type || !id) return res.status(400).json({ error: 'Нет данных' });
    try {
        if (type === 'url') {
            const removed = require('./urltracks.js').remove(owner || '', id);
            if (!removed) return res.status(404).json({ error: 'Не найдено' });
        } else if (type === 'local') {
            const dir = require('./config.js').getCustomMusicDir();
            const full = path.resolve(path.join(dir, id));
            if (!full.startsWith(path.resolve(dir) + path.sep) || !fs.existsSync(full)) return res.status(404).json({ error: 'Файл не найден' });
            fs.unlinkSync(full);
            try { utils.getLocalTracks(true); } catch (e) {}
            try { require('./playlists.js').removeOverride(id); } catch (e) {}
        } else return res.status(400).json({ error: 'Неизвестный тип' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Ошибка удаления' }); }
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