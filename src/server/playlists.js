const fs = require('fs'); const path = require('path');
const OVR_FILE = path.join(require('./config.js').DATA_DIR, 'music-overrides.json');
const EMB_FILE = path.join(require('./config.js').DATA_DIR, 'embedded-covers.json');
function loadEmb(){ try { return JSON.parse(fs.readFileSync(EMB_FILE, 'utf8')); } catch (e) { return {}; } }
async function embeddedCover(filename){
    if (!filename) return '';
    const cache = loadEmb();
    if (filename in cache) return cache[filename] || '';
    let url = '';
    try {
        const mm = require('music-metadata');
        const dir = require('./config.js').getCustomMusicDir();
        const fp = path.join(dir, filename);
        if (fs.existsSync(fp)) {
            const m = await mm.parseFile(fp, { duration: false });
            if (m.common.picture && m.common.picture.length) {
                const pic = m.common.picture[0];
                const cdir = path.join(require('./config.js').DATA_DIR, 'covers');
                if (!fs.existsSync(cdir)) fs.mkdirSync(cdir, { recursive: true });
                const cname = 'emb-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + (pic.format === 'image/png' ? '.png' : '.jpg');
                fs.writeFileSync(path.join(cdir, cname), Buffer.from(pic.data));
                url = '/covers/' + cname;
            }
        }
    } catch (e) {}
    cache[filename] = url;
    try { fs.writeFileSync(EMB_FILE, JSON.stringify(cache)); } catch (e) {}
    return url;
}
async function resolveLocalCover(t) {
    const o = loadOverrides()[t.filename] || {};
    if ('cover' in o) { if (o.cover) return o.cover; return await utils.findCover(t.title, t.artist); }
    if (t.cover) return t.cover;
    return (await embeddedCover(t.filename)) || await utils.findCover(t.title, t.artist);
}
function replaceOverride(filename, data){ const o = loadOverrides(); o[filename] = Object.assign({}, data); fs.writeFileSync(OVR_FILE, JSON.stringify(o, null, 2)); }
function loadOverrides(){ try { return JSON.parse(fs.readFileSync(OVR_FILE, 'utf8')); } catch (e) { return {}; } }
function setOverride(filename, data){ const o = loadOverrides(); o[filename] = Object.assign(o[filename] || {}, data); fs.writeFileSync(OVR_FILE, JSON.stringify(o, null, 2)); }
function removeOverride(filename){ const o = loadOverrides(); delete o[filename]; fs.writeFileSync(OVR_FILE, JSON.stringify(o, null, 2)); }
function getOverride(filename){ return loadOverrides()[filename] || null; }
const utils = require('./utils.js');
const urltracks = require('./urltracks.js');
function defaultPlaylists(hostNick) { return [{ id: 'classic', name: 'Классический', classic: true, includeAll: { [hostNick]: true }, selected: {}, excluded: {} }]; }
function hostNickOf(room) { return (room.users.find(u => u.isAdmin) || {}).name || ''; }
function getPlaylist(room) { if (!room.playlists || !room.playlists.length) room.playlists = defaultPlaylists(hostNickOf(room)); const pl = room.playlists.find(p => p.id === room.activePlaylistId) || room.playlists[0]; pl.excluded = pl.excluded || {}; pl.selected = pl.selected || {}; pl.includeAll = pl.includeAll || {}; return pl; }
function keyOfLocal(t) { return 'local|' + t.filename; }
function keyOfUrl(t, nick) { return 'url|' + nick + '|' + t.id; }
async function getUserTracks(nick, hostNick, room) {
    const local = nick === hostNick ? await utils.getLocalTracks() : [];
    const shared = (room && nick !== hostNick && room.sharedMusic && room.sharedMusic[nick]) ? room.sharedMusic[nick].tracks : [];
    return { local, urls: urltracks.listFor(nick), shared };
}
async function resolveTracks(room, withCovers) {
    const pl = getPlaylist(room); const host = hostNickOf(room);
    const ovr = loadOverrides();
    const local = (await utils.getLocalTracks()).map(t => { const o = ovr[t.filename]; return o ? Object.assign({}, t, o) : t; });
    const out = []; const seen = new Set();
    const pushLocal = t => { const k = keyOfLocal(t); if (pl.excluded[k] && !pl.selected[k]) return; if (seen.has(k)) return; seen.add(k); out.push({ key: k, owner: host, title: t.title, artist: (typeof t.artist === 'string' ? { name: t.artist } : t.artist) || { name: 'Unknown Artist' }, filename: t.filename, preview: '/local-file?p=' + encodeURIComponent(t.filename), isLocal: true, isUrl: false, cover: t.cover || '', duration: Math.floor(t.duration || 30) }); };
    const pushUrl = (t, nick) => { const k = keyOfUrl(t, nick); if (pl.excluded[k] && !pl.selected[k]) return; if (seen.has(k)) return; seen.add(k); out.push({ key: k, owner: nick, title: t.title, artist: (typeof t.artist === 'string' ? { name: t.artist } : t.artist) || { name: 'Unknown Artist' }, id: t.id, rawUrl: t.url, autoCover: t.autoCover, coverSaved: t.cover || '', preview: t.preview || ('/url-proxy?url=' + encodeURIComponent(t.url)), isLocal: true, isUrl: true, duration: 0 }); };
    const pushShared = (t, nick) => { const k = 'shared|' + nick + '|' + t.file; if (pl.excluded[k] && !pl.selected[k]) return; if (seen.has(k)) return; seen.add(k); const sh = (room.sharedMusic || {})[nick] || {}; const o = ovr[k] || {}; out.push({ key: k, owner: nick, title: o.title || t.title, artist: o.artist ? { name: o.artist } : (t.artist ? (typeof t.artist === 'string' ? { name: t.artist } : t.artist) : { name: 'Unknown Artist' }), preview: '/url-proxy?url=' + encodeURIComponent((sh.base || '') + '/' + encodeURIComponent(t.file)), isLocal: true, isUrl: false, isShared: true, autoCover: !(o.cover || t.cover), coverSaved: o.cover || t.cover || '', duration: 0 }); };
    Object.keys(pl.includeAll || {}).forEach(n => { if (!pl.includeAll[n]) return; if (n === host) local.forEach(pushLocal); urltracks.listFor(n).forEach(t => pushUrl(t, n)); if (n !== host) (((room.sharedMusic || {})[n]) || { tracks: [] }).tracks.forEach(t => pushShared(t, n)); });
    Object.keys(pl.selected || {}).forEach(k => {
        if (!pl.selected[k] || seen.has(k)) return;
        const parts = k.split('|');
        if (parts[0] === 'local') { const t = local.find(x => x.filename === parts.slice(1).join('|')); if (t) pushLocal(t); }
        else if (parts[0] === 'url') { const nick = parts[1]; const t = urltracks.listFor(nick).find(x => x.id === parts.slice(2).join('|')); if (t) pushUrl(t, nick); }
        else if (parts[0] === 'shared') { const nick = parts[1]; const sh = (room.sharedMusic || {})[nick]; const t = sh && sh.tracks.find(x => x.file === parts.slice(2).join('|')); if (t) pushShared(t, nick); }
    });
    if (withCovers) await Promise.all(out.map(async tr => {
    if (tr.isUrl) { tr.cover = tr.autoCover ? await utils.findCover(tr.title, tr.artist) : (tr.coverSaved || ''); return; }
    if (tr.isShared) { tr.cover = tr.coverSaved || await utils.findCover(tr.title, tr.artist); return; }
    tr.cover = await resolveLocalCover(tr);
}));
    return out;
}
module.exports = { defaultPlaylists, getPlaylist, hostNickOf, getUserTracks, resolveTracks, getOverride, setOverride, loadOverrides, removeOverride, embeddedCover, resolveLocalCover, replaceOverride };