    import fs from 'node:fs';
    
    export function sniffMime(buf) {
    if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
    if (buf.slice(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
    if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    if (buf.slice(0, 1024).toString('utf8').includes('<svg')) return 'image/svg+xml';
    return null;
    }
    
    export function bufferToDataUri(buf) {
    const mime = sniffMime(buf);
    if (!mime) throw new Error('Unknown image type (use PNG, JPEG, GIF, WebP or SVG)');
    return `data:${mime};base64,${buf.toString('base64')}`;
    }
    
    export function fileToDataUri(filePath) {
    return bufferToDataUri(fs.readFileSync(filePath));
    }
    