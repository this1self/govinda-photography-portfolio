import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparePortfolio } from './lib/media.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
    const portfolio = await preparePortfolio({
        cataloguePath: path.join(root, 'src/content/portfolio.json'),
        sourceRoot: path.join(root, 'Original Photographs'),
        outputRoot: path.join(root, 'public/media'),
        manifestPath: path.join(root, 'src/generated/portfolio.json'),
        allowPlaceholders: process.argv.includes('--preview'),
    });
    console.log(portfolio.preview ? 'Design preview only: no final photographs selected.' : 'Portfolio media ready.');
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
