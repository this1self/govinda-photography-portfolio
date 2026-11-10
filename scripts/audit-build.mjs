import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';

const root = path.resolve(process.argv[2] ?? 'dist');
const preview = process.argv.includes('--preview');
const portfolio = JSON.parse(await readFile('src/generated/portfolio.json', 'utf8'));
const html = await readFile(path.join(root, 'index.html'), 'utf8');
if (!preview && (portfolio.preview || html.includes('Design preview'))) throw new Error('Preview content in production output.');
if (html.includes('Not Public/') || html.includes('Photographs/')) throw new Error('Private source path in public HTML.');
let scriptBytes = 0;
let styleBytes = 0;
let mediaCount = 0;
async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) { await walk(file); continue; }
        if (file.endsWith('.js')) scriptBytes += gzipSync(await readFile(file)).length;
        if (file.endsWith('.css')) styleBytes += gzipSync(await readFile(file)).length;
        if (/\.(jpg|webp)$/i.test(file)) {
            if (!file.startsWith(path.join(root, 'media') + path.sep)) throw new Error('Unexpected image outside generated media.');
            const metadata = await sharp(file).metadata();
            if (metadata.exif || metadata.xmp || metadata.iptc) throw new Error(`Private metadata found in ${file}`);
            if (Math.max(metadata.width, metadata.height) > 3201) throw new Error(`Oversized public rendition: ${file}`);
            mediaCount++;
        }
    }
}
await walk(root);
for (const collection of portfolio.collections) {
    for (const photo of collection.photos) {
        for (const variant of [...photo.webp, ...photo.jpeg]) {
            if (!variant.src.startsWith('/media/')) throw new Error('Unexpected media origin.');
            const info = await stat(path.join(root, variant.src));
            if (!info.size) throw new Error(`Empty rendition: ${variant.src}`);
        }
    }
}
if (scriptBytes > 15 * 1024 || styleBytes > 15 * 1024) throw new Error('JavaScript/CSS exceeded the 15KB gzip budget.');
console.log(`Output verified: ${mediaCount} public renditions; JS ${(scriptBytes / 1024).toFixed(1)}KB gzip; CSS ${(styleBytes / 1024).toFixed(1)}KB gzip.`);
