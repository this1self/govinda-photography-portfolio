import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const catalogue = JSON.parse(readFileSync('src/content/portfolio.json', 'utf8')).collections;
const photoCount = catalogue.reduce((sum, collection) => sum + collection.photos.length, 0);
const spacesCount = catalogue.find((collection) => collection.id === 'spaces').photos.length;

async function loaded(image) {
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
}

async function noOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test('selected photos, image loading, no captions, and responsive proportions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.gallery-section h2')).toHaveText(catalogue.map((c) => c.title));
    await expect(page.locator('.photo-link')).toHaveCount(photoCount);
    await expect(page.locator('#gatherings, figcaption, #viewer-caption, .caption-text, .caption-detail')).toHaveCount(0);
    const images = page.locator('.photo-link img');
    await loaded(images.first());
    await expect(images.first()).toHaveAttribute('loading', 'eager');
    await expect(images.nth(1)).toHaveAttribute('loading', 'lazy');
    // Scroll every image into view: verifies lazy-loaded files actually decode.
    for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded();
        await loaded(image);
    }
    const ratios = await page.locator('.photo-link').evaluateAll((links) => links.map((link) => {
        const img = link.querySelector('img');
        const box = link.getBoundingClientRect();
        const portrait = Number(img.getAttribute('height')) > Number(img.getAttribute('width'));
        const gap = parseFloat(getComputedStyle(link.parentElement).rowGap);
        const expectedHeight = portrait ? box.width * 1.5 + gap : box.width * 0.75;
        return { delta: Math.abs(box.height - expectedHeight), width: box.width, height: box.height };
    }));
    for (const ratio of ratios) {
        expect(ratio.delta).toBeLessThan(1);
        expect(ratio.width).toBeGreaterThanOrEqual(44);
        expect(ratio.height).toBeGreaterThanOrEqual(44);
    }
    await noOverflow(page);
    expect(errors).toEqual([]);
});

test('contact disclosure remains within the viewport and dismisses', async ({ page }) => {
    await page.goto('/');
    await page.locator('#contact summary').click();
    const panel = page.locator('.contact-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await noOverflow(page);
});

test('lightbox opens, loads, navigates, wraps, and restores focus and scroll', async ({ page }) => {
    await page.goto('/');
    const opener = page.locator('#spaces .photo-link').first();
    await opener.scrollIntoViewIfNeeded();
    const beforeScroll = await page.evaluate(() => window.scrollY);
    await opener.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await loaded(dialog.locator('.viewer-image.revealed'));
    await expect(page.locator('#viewer-status')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Close viewer' })).toBeFocused();
    await expect(page.locator('#viewer-counter')).toHaveText(`01 / ${spacesCount}`);
    await page.getByRole('button', { name: 'Previous photograph' }).click();
    await expect(page.locator('#viewer-counter')).toHaveText(`${spacesCount} / ${spacesCount}`);
    await page.getByRole('button', { name: 'Next photograph' }).click();
    await expect(page.locator('#viewer-counter')).toHaveText(`01 / ${spacesCount}`);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#viewer-counter')).toHaveText(`02 / ${spacesCount}`);
    await loaded(dialog.locator('.viewer-image.revealed'));
    await expect(page.locator('#viewer-status')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(Math.abs(await page.evaluate(() => window.scrollY) - beforeScroll)).toBeLessThan(2);
});

test('dialog keeps keyboard focus inside and close control fits on mobile', async ({ page }) => {
    await page.goto('/');
    await page.locator('.photo-link').first().click();
    for (let i = 0; i < 7; i++) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.querySelector('#photo-viewer').contains(document.activeElement))).toBe(true);
    }
    for (const button of ['Close viewer', 'Previous photograph', 'Next photograph']) {
        const box = await page.getByRole('button', { name: button }).boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
    }
    await page.getByRole('button', { name: 'Close viewer' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
});

test('script-free visitors retain images and direct-image links', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
    const page = await context.newPage();
    try {
        await page.goto('http://127.0.0.1:4321/');
        await loaded(page.locator('.photo-link img').first());
        const link = page.locator('.photo-link').first();
        await expect(link).toHaveAttribute('href', /^\/media\/.+\.jpg$/);
        await link.click();
        await expect(page).toHaveURL(/\/media\/.+\.jpg$/);
    } finally { await context.close(); }
});

test('reference palette, typography, spacing, and review screenshots', async ({ page }, testInfo) => {
    await page.goto('/');
    await loaded(page.locator('.photo-link img').first());
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(231, 229, 224)');
    await expect(page.locator('.section-heading h2').first()).toHaveCSS('font-family', /Newsreader/);
    await expect(page.locator('.photo-link img').first()).toHaveCSS('object-fit', 'cover');
    await expect(page.locator('.identity-name')).toHaveAttribute('target', '_blank');
    await expect(page.locator('.intro-space')).toBeEmpty();
    const gap = page.viewportSize().width <= 640 ? '5px' : '10px';
    await expect(page.locator('.gallery').first()).toHaveCSS('column-gap', gap);
    await expect(page.locator('.gallery').first()).toHaveCSS('row-gap', gap);
    if (testInfo.project.name === 'desktop-chromium') {
        const section = await page.locator('.gallery-section').first().boundingBox();
        const first = await page.locator('.photo-link').first().boundingBox();
        expect(Math.abs(section.x - 57.6)).toBeLessThan(2);
        expect(section.y).toBeGreaterThan(350);
        expect(first.y - section.y).toBeGreaterThan(70);
        expect(first.width).toBeCloseTo((section.width - 40) / 5, 0);
        const tile = page.locator('.photo-link').first();
        await tile.hover();
        await expect(tile).toHaveCSS('cursor', 'default');
        await expect(tile).toHaveCSS('opacity', '1');
        await expect(tile.locator('img')).toHaveCSS('opacity', '1');
        await expect(tile.locator('img')).toHaveCSS('filter', 'none');
        await expect(tile.locator('.photo-frame')).toHaveCSS('opacity', '1');
        await expect(tile.locator('.photo-frame')).toHaveCSS('backdrop-filter', 'blur(4px)');
        await expect(tile.locator('.photo-frame')).toHaveCSS('pointer-events', 'none');
    }
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('portfolio.png'), fullPage: true });
    await page.locator('.photo-link').first().click();
    await loaded(page.locator('.viewer-image.revealed'));
    await page.screenshot({ path: testInfo.outputPath('lightbox.png') });
    // Screenshots are review artifacts, not an unreviewed golden-image baseline.
});

test('reduced-motion preference disables reveal and loading animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('.photo-link').first().click();
    await loaded(page.locator('.viewer-image.revealed'));
    await expect(page.locator('.viewer-image.revealed')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.loading-ring')).toHaveCSS('animation-name', 'none');
});
