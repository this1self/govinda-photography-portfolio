export interface Rendition {
    src: string;
    width: number;
    height: number;
}

export interface Photo {
    id: string;
    alt: string;
    width: number;
    height: number;
    color: string;
    location?: string;
    date?: string;
    caption?: string;
    placeholder?: boolean;
    webp: Rendition[];
    jpeg: Rendition[];
}

export interface Collection {
    id: string;
    title: string;
    photos: Photo[];
}

export interface Portfolio {
    preview: boolean;
    collections: Collection[];
}

export const site = {
    name: 'Govinda Ram Pingali',
    title: 'Photography by Govinda Ram Pingali',
    description: 'Photographs of people, spaces, land, textures, and things.',
    url: 'https://photography.govindarampingali.com',
    home: 'https://www.govindarampingali.com',
    email: 'govinda@pgr.earth',
};

export function srcset(variants: Rendition[]): string {
    return variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ');
}
