const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const PORT = 3001;
const DATA_DIR = process.env.MUSICPULSE_DATA || path.join(__dirname, '..');
const MUSIC_DIR = path.join(DATA_DIR, 'music');
try { fs.mkdirSync(MUSIC_DIR, { recursive: true }); } catch (e) {}

// ✅ SRC_DIR = папка src (родитель папки server)
// Работает и при прямом запуске, и через Electron
const SRC_DIR = path.resolve(__dirname, '..');

console.log('📁 SRC_DIR =', SRC_DIR);
console.log('📁 JS folder exists:', fs.existsSync(path.join(SRC_DIR, 'js')));
console.log('📁 i18n.js exists:', fs.existsSync(path.join(SRC_DIR, 'js', 'i18n.js')));
console.log('📁 index.html exists:', fs.existsSync(path.join(SRC_DIR, 'index.html')));
console.log('📁 start.html exists:', fs.existsSync(path.join(SRC_DIR, 'start.html')));

const KEY_PATH = path.join(DATA_DIR, 'server-key.pem');
const CERT_PATH = path.join(DATA_DIR, 'server-cert.pem');

let forge = null;
try { forge = require('node-forge'); } catch (e) { console.warn('⚠️ node-forge не установлен — режим HTTP'); }

function generateSelfSignedCert() {
    if (!forge) return false;
    try {
        const pki = forge.pki;
        const keys = pki.rsa.generateKeyPair(2048);
        const cert = pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
        const attrs = [{ name: 'commonName', value: 'MusicPulse Local' }];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.sign(keys.privateKey, forge.md.sha256.create());
        fs.writeFileSync(KEY_PATH, pki.privateKeyToPem(keys.privateKey));
        fs.writeFileSync(CERT_PATH, pki.certificateToPem(cert));
        console.log('🔏 Сертификат сгенерирован:', CERT_PATH);
        return true;
    } catch (e) { console.warn('Cert generation failed:', e.message); return false; }
}

let IS_HTTPS = false;
try {
    if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) generateSelfSignedCert();
    IS_HTTPS = fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH);
} catch (e) { IS_HTTPS = false; }

function createServer(app) {
    return IS_HTTPS
        ? https.createServer({ key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CERT_PATH) }, app)
        : http.createServer(app);
}

module.exports = { PORT, SRC_DIR, KEY_PATH, CERT_PATH, IS_HTTPS, DATA_DIR, MUSIC_DIR, createServer };