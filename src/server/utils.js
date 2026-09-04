const fs = require('fs'); const path = require('path'); const axios = require('axios'); const mm = require('music-metadata');
function normalizeStr(s) { if (!s) return ''; return String(s).toLowerCase().replace(/[^\w\sа-яё]/gi, '').trim(); }
function normalizeTrack(t) {
    if (!t) return null;
    let an = 'Unknown Artist';
    if (typeof t.artist === 'object' && t.artist !== null) an = t.artist.name || t.artist.artist || 'Unknown Artist';
    else if (typeof t.artist === 'string') an = t.artist;
    return { ...t, title: t.title || t.trackName || 'Unknown Title', artist: { name: an }, cover: t.cover || t.trackCover || '', preview: t.preview || t.trackUrl || '', isLocal: !!t.isLocal, duration: t.duration || 0 };
}
function createLimit(concurrency) { let ac = 0; const q = []; const next = () => { if (q.length > 0 && ac < concurrency) { ac++; q.shift()(); } }; return fn => new Promise((res, rej) => { const run = async () => { try { res(await fn()); } catch (e) { rej(e); } finally { ac--; next(); } }; if (ac < concurrency) { ac++; run(); } else q.push(run); }); }
const limit = createLimit(10);
async function readMetadata(fp) { try { const m = await mm.parseFile(fp); return { title: m.common.title || null, artist: m.common.artist || null, album: m.common.album || null, duration: m.format.duration || 0 }; } catch (e) { return null; } }
// ✅ Рекурсивный обход папки (музыка в подпапках тоже найдётся)
function walkDir(dir, out, depth) {
    if (depth > 5) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const en of entries) {
        const full = path.join(dir, en.name);
        if (en.isDirectory()) walkDir(full, out, depth + 1);
        else if (en.isFile() && /\.(mp3|wav|ogg|flac|m4a)$/i.test(en.name)) out.push(full);
    }
}
let localTracksCache = null, lastCacheUpdate = 0; const CACHE_TTL = 300000;
async function getLocalTracks(force) {
    const now = Date.now();
    if (localTracksCache && !force && (now - lastCacheUpdate) < CACHE_TTL) return localTracksCache;
    const dir = require('./config.js').getCustomMusicDir();
    if (!dir || !fs.existsSync(dir)) { localTracksCache = []; lastCacheUpdate = now; return []; }
    const abs = []; walkDir(dir, abs, 0);
    const tracks = await Promise.all(abs.map(f => limit(async () => {
        const meta = await readMetadata(f); const base = path.parse(f).name;
        const rel = path.relative(dir, f).replace(/\\/g, '/');
        let artist, title, album;
        if (meta && meta.title) { title = meta.title; artist = meta.artist || 'Unknown Artist'; album = meta.album || null; }
        else if (base.includes('-')) { const p = base.split('-'); artist = p[0].trim(); title = p.slice(1).join('-').trim(); album = null; }
        else { artist = 'Unknown Artist'; title = base; album = null; }
        return { filename: rel, title, artist, album, duration: meta?.duration || 0, normalizedTitle: normalizeStr(title), normalizedArtist: normalizeStr(artist), normalizedAlbum: normalizeStr(album) };
    })));
    localTracksCache = tracks; lastCacheUpdate = now; return tracks;
}
const coverCache = {};
async function findCover(title, artist) {
    const key = `${normalizeStr(artist)}-${normalizeStr(title)}`;
    if (coverCache[key] !== undefined) return coverCache[key];
    let cover = null;
    const raw = (title || '').trim(); const clean = raw.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
    const artists = (artist || '').split(/[&,;,]/).map(a => a.replace(/feat\.?.*/gi, '').replace(/ft\.?.*/gi, '').trim()).filter(a => a);
    const queries = [`${artists.join(' ')} ${raw}`, `${artists.join(' ')} ${clean}`, clean].filter(q => q.trim());
    for (const q of queries) {
        if (cover) break;
        try { const r = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`, { timeout: 3000 }); if (r.data.data?.length) cover = r.data.data[0]?.album?.cover_medium || null; } catch (e) {}
    }
    coverCache[key] = cover || ''; return cover || '';
}
function findLocalMatch(deezerTrack, localTracks) {
    const dt = normalizeStr(deezerTrack.title), da = normalizeStr(deezerTrack.artist?.name || deezerTrack.artist);
    let best = null, bestScore = 0;
    for (const l of localTracks) {
        let score = 0, mismatch = false;
        if (l.normalizedTitle === dt) score += 100;
        else if (l.normalizedTitle.includes(dt) || dt.includes(l.normalizedTitle)) score += 50;
        else continue;
        if (l.normalizedArtist && da) {
            if (l.normalizedArtist === da) score += 100;
            else if (l.normalizedArtist.includes(da) || da.includes(l.normalizedArtist)) score += 70;
            else mismatch = true;
        }
        if (mismatch) continue;
        if (score >= 150 && score > bestScore) { bestScore = score; best = l; }
    }
    return best;
}
function setMusicDir(newDir) { const config = require('./config.js'); config.setCustomMusicDir(newDir); localTracksCache = null; lastCacheUpdate = 0; }
module.exports = { normalizeStr, normalizeTrack, getLocalTracks, findCover, limit, findLocalMatch, setMusicDir };