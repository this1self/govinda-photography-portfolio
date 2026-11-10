import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rm, writeFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createDesignPreview, validateCatalogue } from './catalogue.mjs';

const pipelineVersion = `v1-sharp-${sharp.versions.sharp}-webp82-jpeg86-srgb`;
sharp.concurrency(2);

export async function preparePortfolio({ cataloguePath, sourceRoot, outputRoot, manifestPath, allowPlaceholders = false }) {
    const catalogue = validateCatalogue(JSON.parse(await readFile(cataloguePath, 'utf8')));
    const photoCount = catalogue.collections.reduce((count, collection) => count + collection.photos.length, 0);
    if (!photoCount) {
        if (!allowPlaceholders) {
            throw new Error('No photos selected. Add final photos to Original Photographs/ and src/content/portfolio.json before a production build. Use npm run dev to preview the design.');
        }
        const preview = createDesignPreview(catalogue.collections);
        await mkdir(path.dirname(manifestPath), { recursive: true });
        await writeFile(manifestPath, JSON.stringify(preview, null, 4) + '\n');
        return preview;
    }

    const realRoot = await realpath(sourceRoot);
    const collections = [];
    const expectedFolders = new Set();
    for (const collection of catalogue.collections) {
        if (!collection.photos.length) continue;
        const photos = [];
        for (const photo of collection.photos) {
            const sourcePath = await realpath(path.join(sourceRoot, photo.source));
            const relative = path.relative(realRoot, sourcePath);
            if (relative.startsWith('..') || path.isAbsolute(relative)) {
                throw new Error(`Photo ${photo.id} points outside Original Photographs/.`);
            }
            const bytes = await readFile(sourcePath);
            const hash = createHash('sha256').update(bytes).update(pipelineVersion).digest('hex').slice(0, 16);
            const folder = `${photo.id}-${hash}`;
            const destination = path.join(outputRoot, folder);
            expectedFolders.add(folder);
            await mkdir(destination, { recursive: true });

            const source = sharp(bytes, { limitInputPixels: 100_000_000, failOn: 'warning' });
            const metadata = await source.metadata();
            if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
                throw new Error(`Photo ${photo.id} must be a single, decodable image.`);
            }
            const rotated = [5, 6, 7, 8].includes(metadata.orientation);
            const width = rotated ? metadata.height : metadata.width;
            const height = rotated ? metadata.width : metadata.height;
            const longEdge = Math.max(width, height);
            const maxWidth = Math.max(1, Math.round(width * Math.min(1, 3200 / longEdge)));
            const widths = [...new Set([
                ...[320, 480, 640, 960, 1280].map((value) => Math.min(value, maxWidth)),
                ...[1600, 2400, 3200].map((edge) => Math.max(1, Math.round(width * Math.min(1, edge / longEdge)))),
            ])].sort((a, b) => a - b);
            const colorBytes = await source.clone().rotate().resize(1, 1, { fit: 'fill' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
            const color = '#' + [...colorBytes.subarray(0, 3)].map((value) => value.toString(16).padStart(2, '0')).join('');
            const variants = { webp: [], jpeg: [] };
            for (const outputWidth of widths) {
                for (const format of ['webp', 'jpeg']) {
                    const filename = `${outputWidth}.${format === 'jpeg' ? 'jpg' : format}`;
                    const file = path.join(destination, filename);
                    const exists = await access(file).then(() => true, () => false);
                    if (!exists) {
                        // No keepMetadata/withMetadata: public output must not carry source EXIF/GPS.
                        await source.clone().rotate().resize({ width: outputWidth, withoutEnlargement: true })
                            .toColourspace('srgb').toFormat(format, format === 'webp' ? { quality: 82 } : { quality: 86, mozjpeg: true })
                            .toFile(file);
                    }
                    const generated = await sharp(file).metadata();
                    if (generated.exif || generated.xmp || generated.iptc || !generated.width || !generated.height) {
                        throw new Error(`Unsafe or invalid generated image: ${filename}`);
                    }
                    variants[format].push({ src: `/media/${folder}/${filename}`, width: generated.width, height: generated.height });
                }
            }
            photos.push({
                id: photo.id, alt: photo.alt.trim(), width, height, color,
                ...(photo.location ? { location: photo.location.trim() } : {}),
                ...(photo.date ? { date: photo.date.trim() } : {}),
                ...(photo.caption ? { caption: photo.caption.trim() } : {}),
                ...variants,
            });
            console.log(`Prepared ${photo.id}: ${width} × ${height}, ${widths.length * 2} renditions`);
        }
        collections.push({ id: collection.id, title: collection.title, photos });
    }
    // Remove unpublished/obsolete files so a static deployment cannot expose old selections.
    for (const entry of await readdir(outputRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || !expectedFolders.has(entry.name)) {
            await rm(path.join(outputRoot, entry.name), { recursive: true, force: true });
        }
    }
    const portfolio = { preview: false, collections };
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify(portfolio, null, 4) + '\n');
    return portfolio;
}
