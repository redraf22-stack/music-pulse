function startServer(port) {
    return new Promise((resolve, reject) => {
        try {
            const mod = require('../src/server/index.js');
            if (!mod.server.listening) {
                mod.server.listen(port, '0.0.0.0', () => setTimeout(() => resolve({ port, isHttps: mod.IS_HTTPS }), 300));
                mod.server.on('error', e => reject(e));
            } else setTimeout(() => resolve({ port, isHttps: mod.IS_HTTPS }), 300);
        } catch (e) { reject(e); }
    });
}
module.exports = { startServer };