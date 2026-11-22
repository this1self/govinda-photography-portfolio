import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rm, writeFile, access, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createDesignPreview, validateCatalogue } from './catalogue.mjs';

const pipelineVersion = `v1-sharp-${sharp.versions.sharp}-webp82-jpeg86-srgb`;
export const mediaCategories = {
    people: '01 People',
    spaces: '02 Spaces',
    land: '03 Land',
    textures: '04 Textures',
    things: '05 Things',
    gatherings: '06 Gatherings',
};
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
    const expectedFiles = new Set();
    const expectedDirectories = new Set(Object.values(mediaCategories));
    for (const category of expectedDirectories) {
        await mkdir(path.join(outputRoot, category), { recursive: true });
    }
    for (const collection of catalogue.collections) {
        if (!collection.photos.length) continue;
        const category = mediaCategories[collection.id];
        if (!category) throw new Error(`Unknown media category: ${collection.id}`);
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
            const photoDirectory = path.join(category, folder);
            const destination = path.join(outputRoot, photoDirectory);
            expectedDirectories.add(photoDirectory);
            // Reuse the existing derivatives when migrating the old flat layout.
            const legacyDirectory = path.join(outputRoot, folder);
            if (!await access(destination).then(() => true, () => false)
                && await access(legacyDirectory).then(() => true, () => false)) {
                await rename(legacyDirectory, destination);
            }
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
            // Filenames identify the size preset; manifest dimensions remain exact.
            // 960 is thumbnail width, while 3200 is the lightbox's maximum long edge.
            const renditions = [{ size: 960, width: Math.min(960, maxWidth) }];
            if (maxWidth > renditions[0].width) renditions.push({ size: 3200, width: maxWidth });
            const colorBytes = await source.clone().rotate().resize(1, 1, { fit: 'fill' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
            const color = '#' + [...colorBytes.subarray(0, 3)].map((value) => value.toString(16).padStart(2, '0')).join('');
            const variants = { webp: [], jpeg: [] };
            for (const rendition of renditions) {
                const outputWidth = rendition.width;
                for (const format of ['webp', 'jpeg']) {
                    const extension = format === 'jpeg' ? 'jpg' : format;
                    const filename = `${rendition.size}.${extension}`;
                    const file = path.join(destination, filename);
                    expectedFiles.add(path.join(photoDirectory, filename));
                    const legacyFile = path.join(destination, `${outputWidth}.${extension}`);
                    if (file !== legacyFile && !await access(file).then(() => true, () => false)
                        && await access(legacyFile).then(() => true, () => false)) {
                        await rename(legacyFile, file);
                    }
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
                    variants[format].push({ src: `/media/${encodeURIComponent(category)}/${folder}/${filename}`, width: generated.width, height: generated.height });
                }
            }
            photos.push({
                id: photo.id, alt: photo.alt.trim(), width, height, color,
                ...(photo.location ? { location: photo.location.trim() } : {}),
                ...(photo.date ? { date: photo.date.trim() } : {}),
                ...(photo.caption ? { caption: photo.caption.trim() } : {}),
                ...variants,
            });
            console.log(`Prepared ${photo.id}: ${width} × ${height}, ${renditions.length * 2} renditions`);
        }
        collections.push({ id: collection.id, title: collection.title, photos });
    }
    // Remove unpublished/obsolete files so a static deployment cannot expose old selections.
    async function prune(directory = '') {
        for (const entry of await readdir(path.join(outputRoot, directory), { withFileTypes: true })) {
            const relative = path.join(directory, entry.name);
            if (entry.isDirectory() && expectedDirectories.has(relative)) {
                await prune(relative);
            } else if (!entry.isFile() || !expectedFiles.has(relative)) {
                await rm(path.join(outputRoot, relative), { recursive: true, force: true });
            }
        }
    }
    await prune();
    const portfolio = { preview: false, collections };
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify(portfolio, null, 4) + '\n');
    return portfolio;
}
