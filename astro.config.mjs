import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://photography.govindarampingali.com',
    output: 'static',
    outDir: process.env.PORTFOLIO_PREVIEW === '1' ? './dist-preview' : './dist',
    devToolbar: { enabled: false },
    build: { inlineStylesheets: 'never' },
});
