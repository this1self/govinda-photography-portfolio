import path from 'node:path';

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateCatalogue(input) {
    if (!input || !Array.isArray(input.collections) || !input.collections.length) {
        throw new Error('The catalogue needs a collections array.');
    }
    const collectionIds = new Set();
    const photoIds = new Set();
    for (const collection of input.collections) {
        if (!slug.test(collection.id ?? '') || collectionIds.has(collection.id)) {
            throw new Error(`Invalid or duplicate collection ID: ${collection.id}`);
        }
        collectionIds.add(collection.id);
        if (typeof collection.title !== 'string' || !collection.title.trim() || !Array.isArray(collection.photos)) {
            throw new Error(`Collection ${collection.id} needs a title and photos array.`);
        }
        for (const photo of collection.photos) {
            if (!slug.test(photo.id ?? '') || photoIds.has(photo.id)) {
                throw new Error(`Invalid or duplicate photo ID: ${photo.id}`);
            }
            photoIds.add(photo.id);
            if (typeof photo.alt !== 'string' || !photo.alt.trim()) {
                throw new Error(`Photo ${photo.id} needs descriptive alt text.`);
            }
            if (typeof photo.source !== 'string' || !photo.source.trim()
                || photo.source.includes('\\') || photo.source.split('/').includes('..')
                || path.isAbsolute(photo.source) || /^[a-z]+:/i.test(photo.source)
                || !/\.(jpe?g|png|webp|tiff?)$/i.test(photo.source)) {
                throw new Error(`Photo ${photo.id} needs a relative JPEG, PNG, WebP, or TIFF path inside Original Photographs/.`);
            }
            for (const field of ['caption', 'location', 'date']) {
                if (photo[field] !== undefined && typeof photo[field] !== 'string') {
                    throw new Error(`Photo ${photo.id}: ${field} must be text.`);
                }
            }
        }
    }
    return input;
}

const referenceRatios = [
    [0.8, 0.667, 1.5, 0.8, 1, 0.667, 1.5, 0.8],
    [1.5, 1.5, 0.8, 1.778, 1.5],
    [1.5, 0.8, 1.5, 0.667, 1.5, 1],
    [1.778, 1.5, 0.8, 1.5, 1.5, 0.667, 1.5],
    [1, 1.5, 0.8, 1.5, 0.667, 1.5],
    [0.75, 1.333, 0.75, 0.75, 1.333, 1.778, 0.75, 1.333],
];
const tones = ['#D3D0C9', '#CAC6BE', '#D8D5CF', '#C4C0B7', '#CFCBC4'];

export function createDesignPreview(collections) {
    return {
        preview: true,
        collections: collections.map((collection, index) => ({
            id: collection.id,
            title: collection.title,
            photos: (referenceRatios[index] ?? [1.5, 0.8, 1]).map((ratio, photoIndex) => ({
                id: `${collection.id}-placeholder-${photoIndex + 1}`,
                alt: `Design placeholder ${photoIndex + 1}`,
                width: Math.round(ratio * 1000),
                height: 1000,
                color: tones[(index + photoIndex) % tones.length],
                placeholder: true,
                webp: [],
                jpeg: [],
            })),
        })),
    };
}
