// Заплатка: убирает поле "binary" из peer/package.json,
// из-за которого падает electron-builder
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '..', 'node_modules', 'peer', 'package.json');
try {
    if (fs.existsSync(target)) {
        const pkg = JSON.parse(fs.readFileSync(target, 'utf8'));
        if (typeof pkg.binary === 'string') {
            delete pkg.binary;
            fs.writeFileSync(target, JSON.stringify(pkg, null, 2));
            console.log('✅ peer/package.json исправлен для сборки');
        } else {
            console.log('✅ peer/package.json уже в порядке');
        }
    } else {
        console.warn('⚠️ node_modules/peer не найден — сначала npm install');
    }
} catch (e) {
    console.warn('⚠️ fix-peer:', e.message);
}