const utils = require('./utils.js');
const urltracks = require('./urltracks.js');
function defaultPlaylists(hostNick) { return [{ id: 'classic', name: 'Классический', classic: true, includeAll: { [hostNick]: true }, selected: {} }]; }
function hostNickOf(room) { return (room.users.find(u => u.isAdmin) || {}).name || ''; }
function getPlaylist(room) { if (!room.playlists || !room.playlists.length) room.playlists = defaultPlaylists(hostNickOf(room)); return room.playlists.find(p => p.id === room.activePlaylistId) || room.playlists[0]; }
function keyOfLocal(t) { return 'local|' + t.filename; }
function keyOfUrl(t, nick) { return 'url|' + nick + '|' + t.id; }
async function getUserTracks(nick, hostNick, room) {
    const local = nick === hostNick ? await utils.getLocalTracks() : [];
    const shared = (room && nick !== hostNick && room.sharedMusic && room.sharedMusic[nick]) ? room.sharedMusic[nick].tracks : [];
    return { local, urls: urltracks.listFor(nick), shared };
}
async function resolveTracks(room, withCovers) {
    const pl = getPlaylist(room); const host = hostNickOf(room);
    const local = await utils.getLocalTracks();
    const out = []; const seen = new Set();
    const pushLocal = t => { const k = keyOfLocal(t); if (seen.has(k)) return; seen.add(k); out.push({ key: k, owner: host, title: t.title, artist: t.artist, filename: t.filename, preview: '/local-file?p=' + encodeURIComponent(t.filename), isLocal: true, isUrl: false, duration: Math.floor(t.duration || 30) }); };
    const pushUrl = (t, nick) => { const k = keyOfUrl(t, nick); if (seen.has(k)) return; seen.add(k); out.push({ key: k, owner: nick, title: t.title, artist: t.artist, id: t.id, rawUrl: t.url, autoCover: t.autoCover, coverSaved: t.cover || '', preview: t.preview || ('/url-proxy?url=' + encodeURIComponent(t.url)), isLocal: true, isUrl: true, duration: 0 }); };
    const pushShared = (t, nick) => { const k = 'shared|' + nick + '|' + t.file; if (seen.has(k)) return; seen.add(k); const sh = (room.sharedMusic || {})[nick] || {}; out.push({ key: k, owner: nick, title: t.title, artist: t.artist, preview: '/url-proxy?url=' + encodeURIComponent((sh.base || '') + '/' + encodeURIComponent(t.file)), isLocal: true, isUrl: false, isShared: true, autoCover: true, duration: 0 }); };
    Object.keys(pl.includeAll || {}).forEach(n => { if (!pl.includeAll[n]) return; if (n === host) local.forEach(pushLocal); urltracks.listFor(n).forEach(t => pushUrl(t, n)); if (n !== host) (((room.sharedMusic || {})[n]) || { tracks: [] }).tracks.forEach(t => pushShared(t, n)); });
    Object.keys(pl.selected || {}).forEach(k => {
        if (!pl.selected[k] || seen.has(k)) return;
        const parts = k.split('|');
        if (parts[0] === 'local') { const t = local.find(x => x.filename === parts.slice(1).join('|')); if (t) pushLocal(t); }
        else if (parts[0] === 'url') { const nick = parts[1]; const t = urltracks.listFor(nick).find(x => x.id === parts.slice(2).join('|')); if (t) pushUrl(t, nick); }
        else if (parts[0] === 'shared') { const nick = parts[1]; const sh = (room.sharedMusic || {})[nick]; const t = sh && sh.tracks.find(x => x.file === parts.slice(2).join('|')); if (t) pushShared(t, nick); }
    });
    if (withCovers) await Promise.all(out.map(async tr => { tr.cover = tr.isUrl ? (tr.autoCover ? await utils.findCover(tr.title, tr.artist) : (tr.coverSaved || '')) : await utils.findCover(tr.title, tr.artist); }));
    return out;
}
module.exports = { defaultPlaylists, getPlaylist, hostNickOf, getUserTracks, resolveTracks };