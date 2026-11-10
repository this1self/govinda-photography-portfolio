import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { validateCatalogue } from '../scripts/lib/catalogue.mjs';
import { preparePortfolio } from '../scripts/lib/media.mjs';

function catalogue(photo = {}) {
    return { collections: [{ id: 'people', title: 'People', photos: [{ id: 'portrait-one', source: 'portrait.jpg', alt: 'A portrait in soft light.', ...photo }] }] };
}

test('catalogue rejects paths outside the source folder and requires meaningful image identity', () => {
    for (const source of ['../secret.jpg', '/private/secret.jpg', 'https://example.com/photo.jpg', 'dir\\photo.jpg']) {
        assert.throws(() => validateCatalogue(catalogue({ source })), /relative/);
    }
    assert.throws(() => validateCatalogue(catalogue({ alt: '  ' })), /alt text/);
    const duplicate = catalogue();
    duplicate.collections[0].photos.push({ ...duplicate.collections[0].photos[0] });
    assert.throws(() => validateCatalogue(duplicate), /duplicate photo ID/);
});

async function fixture(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'portfolio-media-test-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const options = {
        cataloguePath: path.join(root, 'catalogue.json'),
        sourceRoot: path.join(root, 'sources'),
        outputRoot: path.join(root, 'public/media'),
        manifestPath: path.join(root, 'generated/portfolio.json'),
    };
    await mkdir(options.sourceRoot, { recursive: true });
    return { root, options };
}

test('production cannot publish an empty portfolio; preview placeholders remain explicitly marked', async (t) => {
    const { options } = await fixture(t);
    await writeFile(options.cataloguePath, JSON.stringify({ collections: [{ id: 'people', title: 'People', photos: [] }] }));
    await assert.rejects(preparePortfolio(options), /No photos selected/);
    const result = await preparePortfolio({ ...options, allowPlaceholders: true });
    assert.equal(result.preview, true);
    assert.ok(result.collections[0].photos.every((photo) => photo.placeholder));
});

test('public renditions apply orientation, remove EXIF, omit source paths, and prune unpublished media', async (t) => {
    const { options } = await fixture(t);
    await sharp({ create: { width: 300, height: 200, channels: 3, background: '#755e4b' } })
        .jpeg().withMetadata({ orientation: 6 }).toFile(path.join(options.sourceRoot, 'portrait.jpg'));
    await writeFile(options.cataloguePath, JSON.stringify(catalogue()));
    await mkdir(path.join(options.outputRoot, 'unpublished-old-photo'), { recursive: true });
    await writeFile(path.join(options.outputRoot, 'unpublished-old-photo/private.jpg'), 'stale');
    const result = await preparePortfolio(options);
    assert.equal(result.preview, false);
    const photo = result.collections[0].photos[0];
    assert.equal(photo.width, 200);
    assert.equal(photo.height, 300);
    for (const rendition of [...photo.jpeg, ...photo.webp]) {
        const file = path.join(options.outputRoot, rendition.src.slice('/media/'.length));
        const metadata = await sharp(file).metadata();
        assert.equal(metadata.exif, undefined);
        assert.equal(metadata.orientation, undefined);
        assert.equal(metadata.width, 200);
        assert.equal(metadata.height, 300);
        await sharp(file).raw().toBuffer();
    }
    const manifest = await readFile(options.manifestPath, 'utf8');
    assert.ok(!manifest.includes('portrait.jpg'));
    assert.ok(!manifest.includes(options.sourceRoot));
    assert.equal((await readdir(options.outputRoot)).length, 1);
});

test('source symlinks cannot publish a file outside the approved source directory', async (t) => {
    const { root, options } = await fixture(t);
    await writeFile(path.join(root, 'secret.jpg'), 'not a photograph');
    await symlink(path.join(root, 'secret.jpg'), path.join(options.sourceRoot, 'portrait.jpg'));
    await writeFile(options.cataloguePath, JSON.stringify(catalogue()));
    await assert.rejects(preparePortfolio(options), /outside Original Photographs/);
});
