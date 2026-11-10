import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import ts from 'typescript';

// Offline DOM logic tests: no browser, rendering, network, or external scripts.
const html = await readFile('dist/index.html', 'utf8');
const source = await readFile('src/scripts/gallery.ts', 'utf8');
const script = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace(/export\s*\{\s*\};?/g, '');

function setup(t, { supported = true, brokenThumbnail = false } = {}) {
    const window = new Window({ settings: {
        enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true,
        enableCSSFileLoading: false, enableImageFileLoading: false,
        navigation: { disableMainFrameNavigation: true, disableChildFrameNavigation: true, disableChildPageNavigation: true },
    } });
    const { document } = window;
    document.write(html.replace(/<script\b[^>]*src=[^>]*>[\s\S]*?<\/script>/gi, ''));
    const data = document.querySelector('#portfolio-data');
    const collections = JSON.parse(data.textContent);
    collections[0].photos = collections[0].photos.slice(0, 2);
    for (const photo of collections[0].photos) Object.assign(photo, {
        caption: 'CAPTION MUST NEVER APPEAR', location: 'LOCATION MUST NEVER APPEAR', date: 'DATE MUST NEVER APPEAR',
    });
    data.textContent = JSON.stringify(collections);
    const links = [...document.querySelectorAll('#people .photo-link')].slice(0, 2);
    for (const img of document.querySelectorAll('.photo-link img')) {
        Object.defineProperty(img, 'complete', { value: true });
        Object.defineProperty(img, 'naturalWidth', { value: brokenThumbnail ? 0 : 640 });
    }
    const dialog = document.querySelector('#photo-viewer');
    if (!supported) dialog.showModal = undefined;
    const pendingImages = [];
    function Image() {
        const img = document.createElement('img');
        // URLs are recorded only. No image request is made.
        for (const property of ['src', 'srcset', 'sizes']) {
            let value = '';
            Object.defineProperty(img, property, { get: () => value, set: (next) => { value = next; } });
        }
        img.decode = async () => {};
        pendingImages.push(img);
        return img;
    }
    let scroll = 520;
    Object.defineProperty(window, 'scrollY', { get: () => scroll });
    window.scrollTo = ({ top }) => { scroll = top; };
    const timers = new Map();
    let timerID = 0;
    const globals = {
        window, document, Image, Node: window.Node, Element: window.Element,
        setTimeout: (fn) => { timers.set(++timerID, fn); return timerID; },
        clearTimeout: (id) => timers.delete(id),
    };
    new Function(...Object.keys(globals), script)(...Object.values(globals));
    const click = (node, options = {}) => {
        const event = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...options });
        node.dispatchEvent(event);
        return event;
    };
    const key = (name) => dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    t.after(async () => { if (dialog.open) dialog.close(); await window.happyDOM.close(); });
    return { window, document, dialog, links, pendingImages, click, key,
        flushTimers: () => { const work = [...timers.values()]; timers.clear(); work.forEach((fn) => fn()); },
        counter: () => document.querySelector('#viewer-counter').textContent,
    };
}

test('lightbox opens, wraps with arrow keys, closes, and restores focus and body scroll styles', async (t) => {
    const s = setup(t);
    s.document.body.style.color = 'red';
    const initialStyle = s.document.body.style.cssText;
    assert.equal(s.click(s.links[0]).defaultPrevented, true);
    assert.equal(s.dialog.open, true);
    assert.equal(s.document.activeElement.id, 'viewer-close');
    assert.equal(s.document.body.style.position, 'fixed');
    assert.equal(s.counter(), '01 / 02');
    s.key('ArrowLeft');
    assert.equal(s.counter(), '02 / 02');
    s.key('ArrowRight');
    assert.equal(s.counter(), '01 / 02');
    s.click(s.document.querySelector('#viewer-close'));
    assert.equal(s.dialog.open, false);
    assert.equal(s.document.activeElement, s.links[0]);
    assert.equal(s.document.body.style.cssText, initialStyle);
    assert.equal(s.window.scrollY, 520);
});

test('late image completions cannot replace the current photo or reopen a closed viewer', async (t) => {
    const s = setup(t);
    s.click(s.links[0]);
    const stale = s.pendingImages.at(-1);
    s.key('ArrowRight');
    const current = s.pendingImages.at(-1);
    await stale.onload();
    assert.notEqual(s.document.querySelector('#viewer-images').firstChild, stale);
    await current.onload();
    assert.equal(s.document.querySelector('#viewer-images').lastChild, current);
    s.dialog.close();
    await current.onload();
    assert.equal(s.document.querySelector('#viewer-images').children.length, 0);
});

test('slow images show status; WebP failure falls back to JPEG, then offers retry', async (t) => {
    const s = setup(t);
    s.click(s.links[0]);
    const status = s.document.querySelector('#viewer-status');
    assert.equal(status.hidden, true);
    s.flushTimers();
    assert.equal(status.hidden, false);
    const image = s.pendingImages.at(-1);
    image.onerror();
    const fallback = s.pendingImages.at(-1);
    assert.notEqual(fallback, image);
    assert.match(fallback.src, /\.jpg$/);
    image.onerror(); // A late error from WebP must not fail the JPEG attempt.
    assert.equal(s.document.querySelector('#viewer-retry').hidden, true);
    fallback.onerror();
    assert.equal(s.document.querySelector('#viewer-retry').hidden, false);
    s.click(s.document.querySelector('#viewer-retry'));
    const retried = s.pendingImages.at(-1);
    assert.notEqual(retried, image);
    await retried.onload();
    assert.equal(status.hidden, true);
});

test('horizontal touch swipes navigate; vertical gestures do not', (t) => {
    const s = setup(t);
    s.click(s.links[0]);
    const stage = s.document.querySelector('#viewer-stage');
    const pointer = (type, x, y) => stage.dispatchEvent(new s.window.PointerEvent(type, {
        pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y,
    }));
    pointer('pointerdown', 220, 100); pointer('pointerup', 100, 110);
    assert.equal(s.counter(), '02 / 02');
    pointer('pointerdown', 220, 100); pointer('pointerup', 200, 240);
    assert.equal(s.counter(), '02 / 02');
});

test('captions and location/date labels never render, even when metadata contains them', (t) => {
    const s = setup(t);
    s.click(s.links[0]);
    assert.equal(s.document.querySelectorAll('figcaption, #viewer-caption, .caption-text, .caption-detail').length, 0);
    assert.doesNotMatch(s.dialog.textContent, /MUST NEVER APPEAR/);
});

test('modified clicks and browsers without dialog support retain direct-image links', (t) => {
    const s = setup(t);
    assert.equal(s.click(s.links[0], { ctrlKey: true }).defaultPrevented, false);
    assert.equal(s.dialog.open, false);
    const fallback = setup(t, { supported: false });
    assert.equal(fallback.click(fallback.links[0]).defaultPrevented, false);
    assert.match(fallback.links[0].getAttribute('href'), /^\/media\/.+\.jpg$/);
});

test('broken thumbnails expose a usable image link; contact closes on outside click', (t) => {
    const s = setup(t, { brokenThumbnail: true });
    s.links[0].querySelector('img').dispatchEvent(new s.window.Event('error'));
    assert.equal(s.links[0].querySelector('img').hidden, true);
    assert.equal(s.links[0].querySelector('.photo-error').hidden, false);
    const contact = s.document.querySelector('#contact');
    contact.open = true;
    s.click(s.document.querySelector('h1'));
    assert.equal(contact.open, false);
});


test('viewer selects one source by display width and pixel density; stale errors cannot spoil success', async (t) => {
    const s = setup(t);
    const stage = s.document.querySelector('#viewer-stage');
    Object.defineProperty(stage, 'clientWidth', { value: 700 });
    Object.defineProperty(stage, 'clientHeight', { value: 900 });
    Object.defineProperty(s.window, 'devicePixelRatio', { value: 2 });
    s.click(s.links[0]);
    const image = s.pendingImages.at(-1);
    assert.match(image.src, /\/1600\.webp$/);
    assert.equal(image.srcset, '');
    image.onerror();
    const fallback = s.pendingImages.at(-1);
    assert.match(fallback.src, /\/1600\.jpg$/);
    assert.equal(fallback.srcset, '');
    await fallback.onload();
    image.onerror();
    fallback.onerror();
    assert.equal(s.document.querySelector('#viewer-status').hidden, true);
    assert.equal(s.document.querySelector('#viewer-images').lastChild, fallback);
});


test('unrequested lazy images are not hidden and subsequent loads recover earlier errors', (t) => {
    const s = setup(t, { brokenThumbnail: true });
    const image = s.links[1].querySelector('img');
    const message = s.links[1].querySelector('.photo-error');
    assert.equal(image.complete, true);
    assert.equal(image.naturalWidth, 0);
    assert.equal(image.hidden, false);
    assert.equal(message.hidden, true);
    image.dispatchEvent(new s.window.Event('load'));
    assert.equal(image.hidden, false);
    assert.equal(image.hasAttribute('data-loading'), false);
    image.dispatchEvent(new s.window.Event('error'));
    assert.equal(message.hidden, false);
    image.dispatchEvent(new s.window.Event('load'));
    assert.equal(image.hidden, false);
    assert.equal(message.hidden, true);
});

test('thumbnail stays visible until full-image decode and through the entire crossfade', async (t) => {
    const s = setup(t);
    s.click(s.links[0]);
    const images = s.document.querySelector('#viewer-images');
    const preview = images.firstChild;
    const full = s.pendingImages.at(-1);
    let finishDecode;
    full.decode = () => new Promise((resolve) => { finishDecode = resolve; });
    const loading = full.onload();
    assert.equal(images.children.length, 1);
    assert.equal(images.firstChild, preview);
    assert.equal(preview.hidden, false);
    finishDecode();
    await loading;
    assert.equal(images.children.length, 2);
    assert.equal(images.firstChild, preview);
    assert.equal(images.lastChild, full);
    full.dispatchEvent(new s.window.Event('animationend'));
    assert.equal(images.children.length, 1);
    assert.equal(images.firstChild, full);
});

test('reduced motion replaces the thumbnail after decode without retaining a fading layer', async (t) => {
    const s = setup(t);
    s.window.matchMedia = () => ({ matches: true });
    s.click(s.links[0]);
    const full = s.pendingImages.at(-1);
    await full.onload();
    const images = s.document.querySelector('#viewer-images');
    assert.equal(images.children.length, 1);
    assert.equal(images.firstChild, full);
});
