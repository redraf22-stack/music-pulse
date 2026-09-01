const path = require('path'); const fs = require('fs'); const multer = require('multer'); const rateLimit = require('express-rate-limit'); const axios = require('axios');
module.exports = function (app, utils) {
    const uploadsDir = path.join(require('./config.js').DATA_DIR, 'uploads');
    const urlcacheDir = path.join(require('./config.js').DATA_DIR, 'urlcache');
    const urltracks = require('./urltracks.js');
    const resolver = require('./resolver.js');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    if (!fs.existsSync(urlcacheDir)) fs.mkdirSync(urlcacheDir, { recursive: true });
    app.use('/uploads', require('express').static(uploadsDir));
    const storage = multer.diskStorage({ destination: (r, f, cb) => cb(null, uploadsDir), filename: (r, f, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(f.originalname)) });
    const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });
    const searchLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
    const localLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
    const uploadLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 20 });
    app.get('/api/local-tracks', localLimiter, async (req, res) => {
        const page = parseInt(req.query.page) || 1, perPage = 5, filter = (req.query.filter || '').toLowerCase().trim();
        const owner = (req.query.owner || '').trim();
        try {
            const all = await utils.getLocalTracks();
            let urlAll = [];
            if (owner) {
                urlAll = urltracks.listFor(owner).map(t => ({ filename: t.id, title: t.title, artist: t.artist, album: t.album || null, duration: 0, isUrl: true, rawUrl: t.url, autoCover: t.autoCover, coverSaved: t.cover || '', normalizedTitle: utils.normalizeStr(t.title), normalizedArtist: utils.normalizeStr(t.artist), normalizedAlbum: utils.normalizeStr(t.album) }));
            }
            // ✅ скачанные впереди (приоритет 1), URL-треки — вторые (приоритет 2)
            let combined = [...all, ...urlAll];
            if (filter) { const nf = utils.normalizeStr(filter); combined = combined.filter(t => t.normalizedTitle.includes(nf) || t.normalizedArtist.includes(nf) || (t.normalizedAlbum && t.normalizedAlbum.includes(nf))); }
            const total = combined.length, start = (page - 1) * perPage;
            const enriched = await Promise.all(combined.slice(start, start + perPage).map(async t => {
                if (t.isUrl) {
                    const cover = t.autoCover ? await utils.findCover(t.title, t.artist) : (t.coverSaved || '');
                    return utils.normalizeTrack({ id: t.filename, title: t.title, artist: t.artist, cover, preview: t.preview || ('/url-proxy?url=' + encodeURIComponent(t.rawUrl)), duration: 0, isLocal: true, isUrl: true });
                }
                const cover = await utils.findCover(t.title, t.artist);
                return utils.normalizeTrack({ id: 'local-' + t.filename, title: t.title, artist: t.artist, cover, preview: '/music/' + encodeURIComponent(t.filename), duration: Math.floor(t.duration || 30), isLocal: true });
            }));
            res.json({ data: enriched, total, page, pages: Math.ceil(total / perPage) });
        } catch (e) { res.status(500).json({ error: 'Ошибка' }); }
    });
    app.get('/api/search', searchLimiter, async (req, res) => {
        const q = req.query.q, page = parseInt(req.query.page) || 1, lc = 5;
        if (!q) return res.status(400).json({ error: 'Нет запроса' });
        try {
            const r = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${lc}&index=${(page - 1) * lc}`);
            const localTracks = await utils.getLocalTracks();
            let tracks = (r.data.data || []).map(t => {
                const lm = utils.findLocalMatch(t, localTracks);
                if (lm) return utils.normalizeTrack({ ...t, isLocal: true, preview: '/music/' + encodeURIComponent(lm.filename), duration: Math.floor(lm.duration || t.duration), cover: t.album?.cover_small });
                return utils.normalizeTrack({ ...t, isLocal: false, cover: t.album?.cover_small });
            });
            res.json({ data: tracks, total: r.data.total || 0, page, pages: Math.ceil((r.data.total || 0) / lc) });
        } catch (e) { res.status(500).json({ error: 'Ошибка API' }); }
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
            const headers = {};
            if (req.headers.range) headers.Range = req.headers.range;
            const r = await axios.get(url, { responseType: 'stream', timeout: 15000, headers, validateStatus: s => s < 400 });
            if (r.headers['content-range']) res.set('Content-Range', r.headers['content-range']);
            res.set('Accept-Ranges', 'bytes');
            res.set('Content-Type', r.headers['content-type'] || 'audio/mpeg');
            if (r.headers['content-length']) res.set('Content-Length', r.headers['content-length']);
            res.status(r.status);
            r.data.pipe(res);
        } catch (e) { res.status(502).send('Ошибка аудио'); }
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
        // ✅ Смена папки с музыкой
    app.get('/api/music-dir', (req, res) => { res.json({ dir: require('./config.js').getCustomMusicDir() }); });
    app.post('/api/music-dir', require('express').json(), (req, res) => {
        const dir = (req.body || {}).dir;
        if (!dir || !fs.existsSync(dir)) return res.status(400).json({ error: 'Папка не найдена' });
        utils.setMusicDir(dir);
        res.json({ success: true, dir });
    });
    return { uploadsDir };
};