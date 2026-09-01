const { app } = require('electron');
if (app && !process.env.MUSICPULSE_DATA) {
    process.env.MUSICPULSE_DATA = app.getPath('userData');
}
const fs = require('fs');
const path = require('path');
const FILE = path.join(require('./config.js').DATA_DIR, 'url-tracks.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; } }
function save(d) { fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); }
function listFor(owner) { return load()[owner] || []; }
function add(owner, track) {
    const all = load();
    if (!all[owner]) all[owner] = [];
    track.id = 'url-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    track.addedAt = Date.now();
    all[owner].unshift(track);
    save(all);
    return track;
}
function remove(owner, id) {
    const all = load(); if (!all[owner]) return null;
    const t = all[owner].find(x => x.id === id) || null;
    all[owner] = all[owner].filter(x => x.id !== id);
    save(all); return t;
}
function update(owner, track) {
    const all = load(); if (!all[owner]) return null;
    const i = all[owner].findIndex(t => t.id === track.id); if (i === -1) return null;
    all[owner][i] = { ...all[owner][i], ...track }; save(all); return all[owner][i];
}
module.exports = { listFor, add, remove, update };