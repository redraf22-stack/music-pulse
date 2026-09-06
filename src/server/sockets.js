module.exports = function (io, R, utils) {
    const PL = require('./playlists.js');
    const rooms = R.rooms;
    io.on('connection', (socket) => {
        socket.lastVoteTime = 0; socket.peerId = null; socket.lastActivity = Date.now();
        const clientIp = socket.handshake.address; socket.clientIp = clientIp;
        socket.onAny(() => { socket.lastActivity = Date.now(); });
        socket.on('ping-server', cb => { if (typeof cb === 'function') cb(); });
        socket.on('time-sync', (t0, cb) => { if (typeof cb === 'function') cb(Date.now()); });
        socket.on('heartbeat', () => { socket.lastActivity = Date.now(); socket.emit('heartbeat-ack'); });
        socket.on('register-peer-id', p => { socket.peerId = p; });
        socket.on('create-room', (nickname, cb) => {
            const code = String(Math.floor(10000 + Math.random() * 90000));
            const name = nickname?.trim() || 'Аноним';
            rooms[code] = { adminId: socket.id, lanOpen: false, adminDisconnectedAt: null, users: [{ id: socket.id, name, isAdmin: true, isMod: false, isVip: false }], queue: [], inbox: [], voteCooldown: 0, voteDuration: 15, activePoll: null, voiceEnabled: false, voiceStates: {}, randomMode: false, randomHistory: [], playHistory: [], bannedIps: [], chatMessages: [], state: { playing: false, currentTime: 0, trackUrl: null, trackName: null, trackArtist: null, trackCover: null, isLocal: false, isRepeat: false, startedAt: null, prevTrack: null } };
            rooms[code].playlists = PL.defaultPlaylists(name); rooms[code].activePlaylistId = 'classic';
            socket.join(code); socket.roomCode = code; socket.isAdmin = true; socket.isMod = false; socket.isVip = false; socket.nickname = name;
            R.broadcastUsers(code); R.broadcastQueue(code); R.broadcastInbox(code);
            cb({ code, role: 'admin', nickname: name, voteCooldown: 0, voteDuration: 15, voiceEnabled: false, lanOpen: false });
        });
        socket.on('join-room', ({ code, nickname }, cb) => {
            const room = rooms[String(code || '').toUpperCase()];
            if (!room) return cb({ error: 'Комната не найдена' });
            const name = nickname?.trim() || 'Аноним';
            if (room.bannedIps && room.bannedIps.includes(clientIp)) return cb({ error: 'banned' });
            const exAdm = room.users.find(u => u.isAdmin);
            const reAdm = !!(exAdm && exAdm.name.toLowerCase() === name.toLowerCase());
            if (!reAdm && room.users.some(u => u.name.toLowerCase() === name.toLowerCase())) return cb({ error: 'Этот никнейм уже занят' });
            socket.join(room && String(code).toUpperCase()); socket.roomCode = String(code).toUpperCase();
            socket.nickname = name; socket.isMod = false; socket.isVip = false; socket.isAdmin = reAdm;
            if (reAdm) { exAdm.id = socket.id; room.adminId = socket.id; room.adminDisconnectedAt = null; }
            else room.users.push({ id: socket.id, name, isAdmin: false, isMod: false, isVip: false });
            R.broadcastUsers(socket.roomCode); R.broadcastQueue(socket.roomCode);
            const st = { ...room.state, playHistory: room.playHistory || [] };
            if (st.playing && st.startedAt) st.currentTime = (Date.now() - st.startedAt) / 1000;
            socket.emit('sync', st);
            socket.emit('settings-update', { voteCooldown: room.voteCooldown, voteDuration: room.voteDuration });
            socket.emit('voice-status', room.voiceEnabled);
            socket.emit('random-mode-update', room.randomMode || false);
            socket.emit('lan-update', !!room.lanOpen);
            socket.emit('chat-history', room.chatMessages || []);
            const as = [];
            room.users.forEach(u => {
                const s = io.sockets.sockets.get(u.id);
                if (room.voiceStates[u.id]?.videoEnabled) as.push({ type: 'video', userId: u.id, userName: u.name, peerId: s?.peerId || null, isAdmin: u.isAdmin, isMod: u.isMod, isVip: u.isVip, tabId: s?.tabId || 'unknown' });
                if (room.voiceStates[u.id]?.screenEnabled) as.push({ type: 'screen', userId: u.id, userName: u.name, peerId: s?.peerId || null, isAdmin: u.isAdmin, isMod: u.isMod, isVip: u.isVip, tabId: s?.tabId || 'unknown' });
            });
            socket.emit('active-streams', as);
            if (room.activePoll) socket.emit('poll-start', room.activePoll.track);
            socket.emit('playlists-update', { list: room.playlists, active: room.activePlaylistId });
            cb({ code: socket.roomCode, role: reAdm ? 'admin' : 'user', nickname: name, voteCooldown: room.voteCooldown, voteDuration: room.voteDuration, voiceEnabled: room.voiceEnabled, lanOpen: !!room.lanOpen });
        });
        socket.on('toggle-lan', () => { if (!socket.isAdmin || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; room.lanOpen = !room.lanOpen; io.to(socket.roomCode).emit('lan-update', room.lanOpen); });
        socket.on('leave-room', () => {
            if (!socket.roomCode || !rooms[socket.roomCode]) return; const room = rooms[socket.roomCode];
            if (socket.isAdmin) { io.to(socket.roomCode).emit('room-closed'); delete rooms[socket.roomCode]; }
            else { room.users = room.users.filter(u => u.id !== socket.id); delete room.voiceStates[socket.id]; socket.to(socket.roomCode).emit('user-left-voice', { id: socket.id, peerId: socket.peerId }); R.broadcastUsers(socket.roomCode); socket.leave(socket.roomCode); }
            socket.roomCode = null;
        });
        socket.on('regenerate-room-code', () => {
            if (!socket.isAdmin || !socket.roomCode) return; const old = rooms[socket.roomCode]; if (!old) return;
            const nc = String(Math.floor(10000 + Math.random() * 90000));
            rooms[nc] = { ...old, adminId: socket.id }; delete rooms[socket.roomCode];
            [...old.users].forEach(u => { const s = io.sockets.sockets.get(u.id); if (s) { s.leave(socket.roomCode); s.join(nc); s.roomCode = nc; } });
            socket.roomCode = nc; io.to(nc).emit('room-code-changed', nc);
            R.broadcastUsers(nc); R.broadcastQueue(nc); R.broadcastInbox(nc);
        });
        socket.on('request-media', ({ userId, type }) => {
            if (!socket.roomCode) return;
            const room = rooms[socket.roomCode]; if (!room) return;
            const target = room.users.find(u => u.id === userId);
            if (target) io.to(target.id).emit('media-requested', { requesterSocketId: socket.id, type });
        });
        socket.on('kick-user', id => { if (!socket.isAdmin || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; const u = room.users.find(x => x.id === id); if (!u || u.isAdmin) return; const ts = io.sockets.sockets.get(id); if (ts) { ts.emit('kicked'); ts.leave(socket.roomCode); } room.users = room.users.filter(x => x.id !== id); delete room.voiceStates[id]; R.broadcastUsers(socket.roomCode); });
        socket.on('ban-user', id => { if (!socket.isAdmin || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; const u = room.users.find(x => x.id === id); if (!u || u.isAdmin) return; const ts = io.sockets.sockets.get(id); if (ts) { if (!room.bannedIps) room.bannedIps = []; if (!room.bannedIps.includes(ts.clientIp)) room.bannedIps.push(ts.clientIp); ts.emit('banned'); ts.leave(socket.roomCode); } room.users = room.users.filter(x => x.id !== id); delete room.voiceStates[id]; R.broadcastUsers(socket.roomCode); });
        socket.on('toggle-voice-chat', en => { if (!socket.isAdmin || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; room.voiceEnabled = !!en; if (!en) { room.voiceStates = {}; io.to(socket.roomCode).emit('voice-chat-disabled'); } io.to(socket.roomCode).emit('voice-status', room.voiceEnabled); R.broadcastUsers(socket.roomCode); });
        socket.on('get-peer-id', cb => cb(socket.peerId));
        socket.on('join-voice', () => {
    if (!socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room || !room.voiceEnabled) return;
    const old = room.voiceStates[socket.id] || {};
    room.voiceStates[socket.id] = { selfMuted: false, selfDeafened: false, forceMuted: false, forceDeafened: false, videoEnabled: !!old.videoEnabled, screenEnabled: !!old.screenEnabled, inVoice: true };
    socket.to(socket.roomCode).emit('user-joined-voice', { id: socket.id, name: socket.nickname, peerId: socket.peerId });
    R.broadcastUsers(socket.roomCode);
});
        socket.on('leave-voice', () => {
    if (!socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return;
    const st = room.voiceStates[socket.id];
    socket.to(socket.roomCode).emit('user-left-voice', { id: socket.id, peerId: socket.peerId });
    if (st) {
        st.inVoice = false;
        if (!st.videoEnabled && !st.screenEnabled) delete room.voiceStates[socket.id];
    }
    R.broadcastUsers(socket.roomCode);
});
        socket.on('toggle-video', (en, tabId) => { if (!socket.roomCode || !rooms[socket.roomCode]) return; const room = rooms[socket.roomCode]; if (!room.voiceStates[socket.id]) room.voiceStates[socket.id] = { selfMuted: false, selfDeafened: false, forceMuted: false, forceDeafened: false, videoEnabled: false, screenEnabled: false, inVoice: false }; room.voiceStates[socket.id].videoEnabled = !!en; socket.tabId = tabId || 'unknown'; io.to(socket.roomCode).emit('user-video-state', { userId: socket.id, peerId: socket.peerId, userName: socket.nickname, enabled: !!en, tabId: tabId || 'unknown', isAdmin: socket.isAdmin, isMod: socket.isMod, isVip: socket.isVip }); R.broadcastUsers(socket.roomCode); });
        socket.on('toggle-screen', (en, tabId) => { if (!socket.roomCode || !rooms[socket.roomCode]) return; const room = rooms[socket.roomCode]; if (!room.voiceStates[socket.id]) room.voiceStates[socket.id] = { selfMuted: false, selfDeafened: false, forceMuted: false, forceDeafened: false, videoEnabled: false, screenEnabled: false, inVoice: false }; room.voiceStates[socket.id].screenEnabled = !!en; socket.tabId = tabId || 'unknown'; io.to(socket.roomCode).emit('user-screen-state', { userId: socket.id, peerId: socket.peerId, userName: socket.nickname, enabled: !!en, tabId: tabId || 'unknown', isAdmin: socket.isAdmin, isMod: socket.isMod, isVip: socket.isVip }); R.broadcastUsers(socket.roomCode); });
        socket.on('force-voice-action', ({ targetSocketId, action }) => { if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; const ts = io.sockets.sockets.get(targetSocketId); if (!ts) return; const u = room.users.find(x => x.id === targetSocketId); if (!u || u.isAdmin || !room.voiceStates[targetSocketId]) return; if (action === 'mute') room.voiceStates[targetSocketId].forceMuted = !room.voiceStates[targetSocketId].forceMuted; else if (action === 'deafen') room.voiceStates[targetSocketId].forceDeafened = !room.voiceStates[targetSocketId].forceDeafened; const ns = room.voiceStates[targetSocketId]; ts.emit('force-voice-update', { action, value: action === 'mute' ? ns.forceMuted : ns.forceDeafened }); R.broadcastUsers(socket.roomCode); });
        socket.on('self-voice-state', s => {
    if (!socket.roomCode) return;
    const room = rooms[socket.roomCode];
    if (!room || !room.voiceStates[socket.id]) return;
    if (s.muted !== undefined) room.voiceStates[socket.id].selfMuted = !!s.muted;
    if (s.deafened !== undefined) room.voiceStates[socket.id].selfDeafened = !!s.deafened;
    R.broadcastUsers(socket.roomCode);
});
        socket.on('toggle-role', ({ targetSocketId, roleType }) => { if (!socket.isAdmin || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; const u = room.users.find(x => x.id === targetSocketId); if (!u || u.isAdmin) return; if (roleType === 'vip') { u.isVip = !u.isVip; if (u.isVip) u.isMod = false; } else if (roleType === 'mod') { u.isMod = !u.isMod; if (u.isMod) u.isVip = false; } const ts = io.sockets.sockets.get(targetSocketId); if (ts) { ts.isVip = u.isVip; ts.isMod = u.isMod; ts.emit('role-updated', { isVip: u.isVip, isMod: u.isMod }); if (!u.isMod) ts.emit('inbox-update', []); else ts.emit('inbox-update', room.inbox); } R.broadcastUsers(socket.roomCode); });
        socket.on('update-settings', s => { if (!socket.isAdmin || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; if (s.voteCooldown !== undefined) room.voteCooldown = parseInt(s.voteCooldown) || 0; if (s.voteDuration !== undefined) room.voteDuration = parseInt(s.voteDuration) || 10; io.to(socket.roomCode).emit('settings-update', { voteCooldown: room.voteCooldown, voteDuration: room.voteDuration }); });
        socket.on('suggest-track', track => { if (!socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; const now = Date.now(), cd = (room.voteCooldown || 0) * 1000; if (now - socket.lastVoteTime < cd) return socket.emit('vote-error', `Подождите ${Math.ceil((cd - (now - socket.lastVoteTime)) / 1000)} сек.`); socket.lastVoteTime = now; let sb = socket.nickname; if (socket.isVip) sb = `⭐ ${socket.nickname}`; const nt = utils.normalizeTrack(track); room.inbox.push({ id: Date.now().toString() + Math.random().toString(36).substr(2, 4), title: nt.title, artist: nt.artist.name, preview: nt.preview, isLocal: nt.isLocal, duration: nt.duration, cover: nt.cover, suggestedBy: sb }); if (!room.activePoll) R.broadcastInbox(socket.roomCode); });
        socket.on('start-poll', track => { if (!socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room || room.activePoll || (!socket.isAdmin && !socket.isMod)) return; const nt = utils.normalizeTrack(track); const pt = { id: 'poll-' + Date.now(), title: nt.title, artist: nt.artist.name, cover: nt.cover, suggestedBy: track.suggestedBy || (socket.isAdmin ? '👑 Админ' : '🛡️ Мод'), isLocal: nt.isLocal, preview: nt.preview, isPoll: true }; room.activePoll = { track: pt, startTime: Date.now(), votes: { for: 0, against: 0, neutral: 0 }, voters: new Set() }; io.to(socket.roomCode).emit('poll-start', pt); R.broadcastInbox(socket.roomCode); setTimeout(() => endPoll(socket.roomCode), room.voteDuration * 1000); });
        socket.on('cast-vote', vt => { if (!socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room || !room.activePoll || room.activePoll.voters.has(socket.id)) return; room.activePoll.votes[vt]++; room.activePoll.voters.add(socket.id); });
        function endPoll(rc) { const room = rooms[rc]; if (!room || !room.activePoll) return; const p = room.activePoll, t = p.votes.for + p.votes.against + p.votes.neutral; const res = { for: t ? Math.round(p.votes.for / t * 100) : 0, against: t ? Math.round(p.votes.against / t * 100) : 0, neutral: t ? Math.round(p.votes.neutral / t * 100) : 0, total: t }; room.activePoll = null; R.broadcastInbox(rc); io.to(rc).emit('poll-close'); }
        socket.on('add-to-queue', track => { if (!socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room || (!socket.isAdmin && !socket.isMod && !socket.isVip)) return; let sb = socket.nickname; if (socket.isAdmin) sb = '👑 Админ'; else if (socket.isMod) sb = '🛡️ ' + socket.nickname; else if (socket.isVip) sb = `⭐ ${socket.nickname}`; const nt = utils.normalizeTrack(track); nt.id = Date.now().toString() + Math.random().toString(36).substr(2, 4); nt.suggestedBy = sb; room.queue.push(nt); R.broadcastQueue(socket.roomCode); });
        socket.on('remove-from-queue', id => { if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; room.queue = room.queue.filter(t => t.id !== id); R.broadcastQueue(socket.roomCode); });
        socket.on('reorder-queue', ({ id, direction }) => { if ((!socket.isAdmin && !socket.isMod && !socket.isVip) || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; const i = room.queue.findIndex(t => t.id === id); if (i === -1) return; if (direction === 'up' && i > 0) [room.queue[i], room.queue[i - 1]] = [room.queue[i - 1], room.queue[i]]; else if (direction === 'down' && i < room.queue.length - 1) [room.queue[i], room.queue[i + 1]] = [room.queue[i + 1], room.queue[i]]; R.broadcastQueue(socket.roomCode); });
        socket.on('resolve-inbox', ({ id, action }) => { if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; const i = room.inbox.findIndex(s => s.id === id); if (i === -1) return; const it = room.inbox.splice(i, 1)[0]; if (action === 'now') R.playTrackInRoom(socket.roomCode, room, it); else if (action === 'next') room.queue.unshift(utils.normalizeTrack(it)); else if (action === 'end') room.queue.push(utils.normalizeTrack(it)); R.broadcastInbox(socket.roomCode); R.broadcastQueue(socket.roomCode); });
        socket.on('play-prev', () => {
            if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return;
            const room = rooms[socket.roomCode]; if (!room || !room.playHistory || !room.playHistory.length) return;
    // ✅ текущий трек становится ПЕРВЫМ в очереди ожидания
            if (room.state.trackUrl) {
                 const cur = utils.normalizeTrack({ title: room.state.trackName, artist: room.state.trackArtist, cover: room.state.trackCover, preview: room.state.originalPreview || room.state.trackUrl, isLocal: room.state.isLocal });
                cur.id = 'prev-' + Date.now().toString() + Math.random().toString(36).substr(2, 4);
                cur.suggestedBy = '◀ Назад';
                room.queue.unshift(cur);
                R.broadcastQueue(socket.roomCode);
            }
            const prev = room.playHistory.pop();
            if (prev) R.playTrackInRoom(socket.roomCode, room, prev);
        });
        socket.on('play-next', async () => {
            if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return;
            if (room.state.trackUrl) { room.playHistory.push(utils.normalizeTrack({ title: room.state.trackName, artist: room.state.trackArtist, cover: room.state.trackCover, preview: room.state.originalPreview || room.state.trackUrl, isLocal: room.state.isLocal })); if (room.playHistory.length > 50) room.playHistory.shift(); }
            let next = null;
            if (room.queue.length) { next = room.queue.shift(); if (room.randomMode && !R.hasRandomInQueue(room)) R.addRandomToQueueEnd(room); }
            else if (room.randomMode) { next = await R.getRandomTrackForRoom(socket.roomCode); if (next) R.addRandomToQueueEnd(room); }
            if (next) { R.playTrackInRoom(socket.roomCode, room, next); R.broadcastQueue(socket.roomCode); }
else { room.state.playing = false; room.state.startedAt = null; io.to(socket.roomCode).emit('sync', { ...room.state, playHistory: room.playHistory || [] }); }
        });
        socket.on('toggle-random-mode', async () => { if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; room.randomMode = !room.randomMode; io.to(socket.roomCode).emit('random-mode-update', room.randomMode); if (room.randomMode) { room.queue = room.queue.filter(t => !(t.suggestedBy || '').includes('Рандом')); R.broadcastQueue(socket.roomCode); if (!room.state.playing || !room.state.trackUrl) { const tr = await R.getRandomTrackForRoom(socket.roomCode); if (tr) R.playTrackInRoom(socket.roomCode, room, tr); } if (!R.hasRandomInQueue(room)) R.addRandomToQueueEnd(room); } });
        socket.on('seek', time => { if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; room.state.currentTime = time; if (room.state.playing) room.state.startedAt = Date.now() - time * 1000; io.to(socket.roomCode).emit('sync', { ...room.state, playHistory: room.playHistory || [], isSeek: true }); });
        socket.on('update-state', ns => {
    if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return;
    const room = rooms[socket.roomCode]; if (!room) return;
    room.state = { ...room.state, ...ns };
    if (ns.playing === true && typeof ns.currentTime === 'number') {
        room.state.startedAt = Date.now() - ns.currentTime * 1000;
    }
    if (ns.playing === false) room.state.startedAt = null;
    io.to(socket.roomCode).emit('sync', { ...room.state, playHistory: room.playHistory || [] });
});
        socket.on('send-chat-message', text => { if (!socket.roomCode || !rooms[socket.roomCode]) return; const room = rooms[socket.roomCode]; const ct = String(text || '').trim().substring(0, 500); if (!ct) return; const msg = { id: Date.now().toString() + Math.random().toString(36).substr(2, 4), userId: socket.id, userName: socket.nickname || 'Аноним', isAdmin: !!socket.isAdmin, isMod: !!socket.isMod, isVip: !!socket.isVip, text: ct, timestamp: Date.now() }; room.chatMessages.push(msg); if (room.chatMessages.length > 200) room.chatMessages.shift(); io.to(socket.roomCode).emit('chat-message', msg); });
        socket.on('send-chat-media', data => { if (!socket.roomCode || !rooms[socket.roomCode]) return; const room = rooms[socket.roomCode]; const { type, fileUrl, fileName, fileSize, text } = data || {}; if (!type || !fileUrl) return; const msg = { id: Date.now().toString() + Math.random().toString(36).substr(2, 4), userId: socket.id, userName: socket.nickname || 'Аноним', isAdmin: !!socket.isAdmin, isMod: !!socket.isMod, isVip: !!socket.isVip, text: String(text || '').trim().substring(0, 500), mediaType: type, fileUrl, fileName: fileName || 'file', fileSize: fileSize || 0, timestamp: Date.now() }; room.chatMessages.push(msg); if (room.chatMessages.length > 200) room.chatMessages.shift(); io.to(socket.roomCode).emit('chat-message', msg); });
        socket.on('get-active-streams', () => { if (!socket.roomCode || !rooms[socket.roomCode]) return; const room = rooms[socket.roomCode]; const as = []; room.users.forEach(u => { const s = io.sockets.sockets.get(u.id); if (room.voiceStates[u.id]?.videoEnabled) as.push({ type: 'video', userId: u.id, userName: u.name, peerId: s?.peerId || null, isAdmin: u.isAdmin, isMod: u.isMod, isVip: u.isVip, tabId: s?.tabId || 'unknown' }); if (room.voiceStates[u.id]?.screenEnabled) as.push({ type: 'screen', userId: u.id, userName: u.name, peerId: s?.peerId || null, isAdmin: u.isAdmin, isMod: u.isMod, isVip: u.isVip, tabId: s?.tabId || 'unknown' }); }); socket.emit('active-streams', as); });
        function broadcastPlaylists(code) { const r = rooms[code]; if (r) io.to(code).emit('playlists-update', { list: r.playlists, active: r.activePlaylistId }); }
        socket.on('switch-playlist', dir => {
            if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return;
            const room = rooms[socket.roomCode]; if (!room) return;
            if (room.playlists.length < 2) return;
            const d = dir === -1 ? -1 : 1;
            const i = room.playlists.findIndex(p => p.id === room.activePlaylistId);
            room.activePlaylistId = room.playlists[(i + d + room.playlists.length) % room.playlists.length].id;
            broadcastPlaylists(socket.roomCode);
        });
        socket.on('create-playlist', () => {
            if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return;
            const room = rooms[socket.roomCode]; if (!room) return; PL.getPlaylist(room);
            const id = 'pl-' + Date.now().toString(36);
            room.playlists.push({ id, name: 'Плейлист ' + room.playlists.length, classic: false, includeAll: {}, selected: {} });
            broadcastPlaylists(socket.roomCode);
            socket.emit('playlist-open-settings', id);
        });
        socket.on('update-playlist', data => { if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; const pl = room.playlists.find(p => p.id === (data || {}).id); if (!pl) return; if (!pl.classic && data.name) pl.name = String(data.name).substring(0, 40); pl.includeAll = data.includeAll || pl.includeAll; pl.selected = data.selected || pl.selected; broadcastPlaylists(socket.roomCode); });
        socket.on('share-music', data => {
            if (!socket.roomCode) return;
            const room = rooms[socket.roomCode]; if (!room) return;
            room.sharedMusic = room.sharedMusic || {};
            room.sharedMusic[socket.nickname] = { base: (data || {}).base, tracks: (data || {}).tracks || [] };
            io.to(socket.roomCode).emit('shared-music-update', { nick: socket.nickname, count: ((data || {}).tracks || []).length });
        });
        socket.on('request-share', targetNick => {
            if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return;
            const room = rooms[socket.roomCode]; if (!room) return;
            const target = room.users.find(u => u.name === targetNick);
            if (!target) return;
            io.to(target.id).emit('share-requested', { requester: socket.nickname });
        });
        socket.on('get-playlists', () => { if (!socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; PL.getPlaylist(room); socket.emit('playlists-update', { list: room.playlists, active: room.activePlaylistId }); });
        socket.on('get-playlist-view', async (cb) => {
    if (typeof cb !== 'function' || !socket.roomCode) return;
    const room = rooms[socket.roomCode]; if (!room) return cb([]);
    try {
        const tracks = await PL.resolveTracks(room, true);
        const map = new Map();
        tracks.forEach(t => {
            const owner = t.owner || '?';
            if (!map.has(owner)) map.set(owner, { owner, local: [], urls: [] });
            const g = map.get(owner);
            const item = { title: t.title, artist: (t.artist && t.artist.name) || t.artist || '' };
            if (t.isUrl) g.urls.push(item); else g.local.push(item);
        });
        cb([...map.values()]);
    } catch (e) { cb([]); }
});
        socket.on('set-playlist', id => { if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return; const room = rooms[socket.roomCode]; if (!room) return; PL.getPlaylist(room); if (room.playlists.find(p => p.id === id)) { room.activePlaylistId = id; broadcastPlaylists(socket.roomCode); } });
        socket.on('delete-playlist', data => {
            if ((!socket.isAdmin && !socket.isMod) || !socket.roomCode) return;
            const room = rooms[socket.roomCode]; if (!room) return; PL.getPlaylist(room);
            const id = (data || {}).id;
            const pl = room.playlists.find(p => p.id === id);
            if (!pl || pl.classic) return;
            room.playlists = room.playlists.filter(p => p.id !== id);
            if (room.activePlaylistId === id) room.activePlaylistId = 'classic';
            broadcastPlaylists(socket.roomCode);
        });
        socket.on('disconnect', () => {
            if (!socket.roomCode || !rooms[socket.roomCode]) return; const room = rooms[socket.roomCode];
            delete room.voiceStates[socket.id];
            socket.to(socket.roomCode).emit('user-left-voice', { id: socket.id, peerId: socket.peerId });
            if (socket.isAdmin) room.adminDisconnectedAt = Date.now();
            else { room.users = room.users.filter(u => u.id !== socket.id); R.broadcastUsers(socket.roomCode); }
        });
    });
    // grace-период админа (30 сек)
    setInterval(() => {
        const now = Date.now();
        Object.keys(rooms).forEach(code => {
            const room = rooms[code]; const adm = io.sockets.sockets.get(room.adminId);
            if (!adm) { if (!room.adminDisconnectedAt) room.adminDisconnectedAt = now; if (now - room.adminDisconnectedAt > 30000) { io.to(code).emit('room-closed'); delete rooms[code]; } }
            else room.adminDisconnectedAt = null;
        });
    }, 10000);
    setInterval(() => {
    Object.keys(rooms).forEach(code => {
        const r = rooms[code];
        if (r && r.state && r.state.playing && r.state.trackUrl) {
            io.to(code).emit('sync', { ...r.state });
        }
    });
}, 5000);
};