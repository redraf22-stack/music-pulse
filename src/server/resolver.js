const axios = require('axios');

// ✅ Умный распознаватель ссылок: возвращает играбельный аудио-URL + метаданные
async function resolveAudioUrl(url) {
    url = String(url || '').trim();
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Нужна ссылка http(s)://' };

    // 1) Прямой аудио-файл по расширению
    if (/\.(mp3|wav|ogg|oga|opus|m4a|aac|flac)(\?.*)?$/i.test(url)) {
        return { ok: true, streamUrl: url, type: 'direct' };
    }

    // 2) Deezer (официальный API, превью 30 сек)
    const dz = url.match(/deezer\.com\/(?:[a-z]{2}\/)?track\/(\d+)/i);
    if (dz) {
        try {
            const r = await axios.get('https://api.deezer.com/track/' + dz[1], { timeout: 8000 });
            if (r.data && r.data.preview) {
                return { ok: true, streamUrl: r.data.preview, type: 'deezer',
                    title: r.data.title || '', artist: (r.data.artist && r.data.artist.name) || '',
                    album: (r.data.album && r.data.album.title) || '', cover: (r.data.album && r.data.album.cover_medium) || '' };
            }
        } catch (e) {}
        return { ok: false, error: 'Не удалось получить трек Deezer' };
    }

    // 3) Internet Archive (официальный metadata API)
    const ia = url.match(/archive\.org\/(?:details|embed|download|metadata)\/([^\/?#]+)/i);
    if (ia) {
        try {
            const ident = ia[1];
            const r = await axios.get('https://archive.org/metadata/' + ident, { timeout: 10000 });
            const md = r.data && r.data.metadata;
            const files = (r.data && r.data.files) || [];
            const audio = files.filter(f => /\.(mp3|ogg|flac|wav)$/i.test(f.name)).sort((a, b) => (a.name > b.name ? 1 : -1));
            if (audio.length) {
                return { ok: true, streamUrl: 'https://archive.org/download/' + ident + '/' + encodeURIComponent(audio[0].name), type: 'archive',
                    title: (md && md.title) || ident,
                    artist: (md && (Array.isArray(md.creator) ? md.creator[0] : md.creator)) || '',
                    cover: 'https://archive.org/services/get-item-image.php?identifier=' + ident };
            }
        } catch (e) {}
        return { ok: false, error: 'В Internet Archive не нашлось аудио-файлов' };
    }

    // 4) HEAD-проверка: вдруг ссылка сразу отдаёт аудио
    try {
        const head = await axios.head(url, { timeout: 8000, maxRedirects: 5 });
        const ct = head.headers['content-type'] || '';
        if (ct.startsWith('audio/') || ct.includes('octet-stream')) return { ok: true, streamUrl: url, type: 'direct' };
    } catch (e) {}

    // 5) Сканируем страницу: <audio src>, <source src>, прямые .mp3 в коде
    try {
        const page = await axios.get(url, { timeout: 10000, maxRedirects: 5 });
        const html = String(page.data || '');
        const m = html.match(/<audio[^>]*src=["']([^"']+)["']/i)
            || html.match(/<source[^>]*src=["']([^"']+)["']/i)
            || html.match(/["']([^"'\s]+\.mp3(?:\?[^"'\s]*)?)["']/i);
        if (m) {
            return { ok: true, streamUrl: new URL(m[1], url).href, type: 'page' };
        }
    } catch (e) {}

    return { ok: false, error: 'Не распознал ссылку. Поддерживаются: прямые MP3/WAV/OGG, Deezer, archive.org, страницы со встроенным аудио.' };
}

module.exports = { resolveAudioUrl };