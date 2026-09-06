module.exports = function (io, utils) {
    const PL = require('./playlists.js');
    const rooms = {};
    function broadcastUsers(code) { if (rooms[code]) io.to(code).emit('users-update', rooms[code].users.map(u => { const s = io.sockets.sockets.get(u.id); const vs = rooms[code].voiceStates[u.id] || null; return { ...u, voiceState: vs, videoEnabled: !!(vs && vs.videoEnabled), screenEnabled: !!(vs && vs.screenEnabled), peerId: s?.peerId || null }; })); }
    function broadcastQueue(code) { if (rooms[code]) io.to(code).emit('queue-update', rooms[code].queue); }
    function broadcastInbox(code) { if (rooms[code]) { const r = rooms[code]; io.to(r.adminId).emit('inbox-update', r.inbox); r.users.forEach(u => { if (u.isMod) io.to(u.id).emit('inbox-update', r.inbox); }); } }
    function playTrackInRoom(code, room, track) {
        const nt = utils.normalizeTrack(track); if (!nt) return;
        const orig = nt.preview; let url = orig;
        if (!nt.isLocal && orig && orig.includes('dzcdn.net')) url = `/proxy?url=${encodeURIComponent(orig)}`;
        const prev = (room.playHistory && room.playHistory.length) ? room.playHistory[room.playHistory.length - 1] : null;
        room.state = { ...room.state, trackName: nt.title, trackArtist: nt.artist.name, trackCover: nt.cover, trackUrl: url, originalPreview: orig, isLocal: nt.isLocal, playing: true, currentTime: 0, startedAt: Date.now(), prevTrack: prev };
        io.to(code).emit('sync', { ...room.state, playHistory: room.playHistory || [] });
    }
    function hasRandomInQueue(r) { return r.queue.some(t => (t.suggestedBy || '').includes('Рандом')); }
    async function getRandomTrackForRoom(code) {
        const room = rooms[code]; if (!room) return null;
       const all = await PL.resolveTracks(room, true);
       if (!all.length) return null;
      let hist = room.randomHistory || [];
      let avail = all.filter(t => !hist.includes(t.key));
      if (!avail.length) { avail = all; room.randomHistory = []; }
     const t = avail[Math.floor(Math.random() * avail.length)];
     room.randomHistory.push(t.key);
     if (room.randomHistory.length > Math.max(1, Math.floor(all.length * 0.8))) room.randomHistory.shift();
      return utils.normalizeTrack(t);
    }
    async function addRandomToQueueEnd(room) {
        try {
            const code = Object.keys(rooms).find(k => rooms[k] === room); if (!code) return;
            room.queue = room.queue.filter(t => !(t.suggestedBy || '').includes('Рандом'));
            const tr = await getRandomTrackForRoom(code); if (!tr) return;
            tr.suggestedBy = '🎲 Рандом'; tr.id = 'rand-' + Date.now().toString() + Math.random().toString(36).substr(2, 4);
            room.queue.push(tr); broadcastQueue(code);
        } catch (e) { console.error('Random error:', e); }
    }
    return { rooms, broadcastUsers, broadcastQueue, broadcastInbox, playTrackInRoom, hasRandomInQueue, getRandomTrackForRoom, addRandomToQueueEnd };
};