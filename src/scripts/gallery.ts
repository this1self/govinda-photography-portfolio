import type { Collection, Photo, Rendition } from '../lib/portfolio';

const data = document.querySelector<HTMLScriptElement>('#portfolio-data');
const dialog = document.querySelector<HTMLDialogElement>('#photo-viewer');
const contact = document.querySelector<HTMLDetailsElement>('#contact');

document.addEventListener('click', (event) => {
    if (contact?.open && event.target instanceof Node && !contact.contains(event.target)) contact.open = false;
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && contact?.open) {
        contact.open = false;
        contact.querySelector('summary')?.focus();
    }
});

for (const image of document.querySelectorAll<HTMLImageElement>('.photo-link img')) {
    const message = image.closest('.photo-link')?.querySelector<HTMLElement>('.photo-error');
    const ready = () => {
        image.removeAttribute('data-loading');
        image.hidden = false;
        if (message) message.hidden = true;
    };
    const failed = () => {
        image.removeAttribute('data-loading');
        image.hidden = true;
        if (message) message.hidden = false;
    };
    image.addEventListener('load', ready);
    image.addEventListener('error', failed);
    // Lazy images can report complete with zero naturalWidth before any request.
    // Only an actual error event establishes failure; a later load can recover.
    if (image.complete && image.naturalWidth > 0) ready();
    else image.setAttribute('data-loading', '');
}

if (data?.textContent && dialog && typeof dialog.showModal === 'function') {
    initializeViewer(dialog, JSON.parse(data.textContent) as Collection[]);
}

function initializeViewer(viewer: HTMLDialogElement, collections: Collection[]) {
    const title = viewer.querySelector<HTMLElement>('#viewer-title')!;
    const counter = viewer.querySelector<HTMLElement>('#viewer-counter')!;
    const stage = viewer.querySelector<HTMLElement>('#viewer-stage')!;
    const images = viewer.querySelector<HTMLElement>('#viewer-images')!;
    const status = viewer.querySelector<HTMLElement>('#viewer-status')!;
    const statusText = viewer.querySelector<HTMLElement>('#viewer-status-text')!;
    const retry = viewer.querySelector<HTMLButtonElement>('#viewer-retry')!;
    const close = viewer.querySelector<HTMLButtonElement>('#viewer-close')!;
    const previous = viewer.querySelector<HTMLButtonElement>('#viewer-previous')!;
    const next = viewer.querySelector<HTMLButtonElement>('#viewer-next')!;
    const lookup = new Map<string, { collection: Collection; index: number }>();
    for (const collection of collections) {
        collection.photos.forEach((photo, index) => lookup.set(photo.id, { collection, index }));
    }
    let active: Collection | null = null;
    let index = 0;
    let generation = 0;
    let loadingTimer: ReturnType<typeof setTimeout> | undefined;
    let opener: HTMLElement | null = null;
    let scrollPosition = 0;
    let previousBodyStyle = '';
    let pointer: { id: number; x: number; y: number } | null = null;

    function currentThumbnail(photo: Photo): HTMLImageElement | null {
        return document.querySelector<HTMLImageElement>(`[data-photo="${photo.id}"] img`);
    }

    function render() {
        if (!active) return;
        const photo = active.photos[index]!;
        const token = ++generation;
        clearTimeout(loadingTimer);
        title.textContent = active.title;
        counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(active.photos.length).padStart(2, '0')}`;
        previous.disabled = next.disabled = active.photos.length < 2;
        status.hidden = true;
        status.classList.remove('has-error');
        statusText.textContent = 'Loading photograph';
        retry.hidden = true;
        images.replaceChildren();
        images.setAttribute('aria-busy', 'false');

        if (photo.placeholder) {
            const block = document.createElement('div');
            block.className = 'viewer-block';
            block.style.setProperty('--ratio', String(photo.width / photo.height));
            block.style.setProperty('--tone', photo.color);
            block.style.setProperty('--block-width', `${stage.clientHeight * photo.width / photo.height}px`);
            block.setAttribute('role', 'img');
            block.setAttribute('aria-label', photo.alt);
            images.append(block);
            return;
        }

        const thumbnail = currentThumbnail(photo);
        if (thumbnail?.complete && thumbnail.naturalWidth) {
            const preview = new Image();
            preview.src = thumbnail.currentSrc || thumbnail.src;
            preview.alt = '';
            preview.setAttribute('aria-hidden', 'true');
            preview.className = 'viewer-image';
            images.append(preview);
        }
        images.setAttribute('aria-busy', 'true');
        loadingTimer = setTimeout(() => {
            if (token === generation && viewer.open) status.hidden = false;
        }, 250);

        const displayWidth = Math.min(stage.clientWidth, stage.clientHeight * photo.width / photo.height);
        const requiredWidth = Math.max(1, displayWidth * (window.devicePixelRatio || 1));
        let attempt = 0;
        function load(variants: Rendition[], fallback = false) {
            // A single source avoids overlapping responsive-source updates on a
            // detached image. Each fallback gets its own element and callbacks.
            const candidates = [...variants].sort((a, b) => a.width - b.width);
            const rendition = candidates.find((item) => item.width >= requiredWidth) ?? candidates.at(-1)!;
            const request = ++attempt;
            const image = new Image();
            let loaded = false;
            const isCurrent = () => token === generation && request === attempt && viewer.open;
            image.alt = photo.alt;
            image.width = photo.width;
            image.height = photo.height;
            image.decoding = 'async';
            image.className = 'viewer-image revealed';
            image.onload = async () => {
                if (loaded || !isCurrent()) return;
                loaded = true;
                try { await image.decode(); } catch { /* A loaded image can still be displayed. */ }
                if (!isCurrent()) return;
                clearTimeout(loadingTimer);
                status.hidden = true;
                status.classList.remove('has-error');
                retry.hidden = true;
                images.setAttribute('aria-busy', 'false');
                if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    images.replaceChildren(image);
                    return;
                }
                // Keep the thumbnail beneath the decoded image throughout the
                // fade so there is no blank frame or sudden sharpness change.
                const preview = images.querySelector('img');
                image.addEventListener('animationend', () => preview?.remove(), { once: true });
                images.append(image);
            };
            image.onerror = () => {
                if (loaded || !isCurrent()) return;
                if (!fallback) {
                    load(photo.jpeg, true);
                    return;
                }
                clearTimeout(loadingTimer);
                images.setAttribute('aria-busy', 'false');
                status.classList.add('has-error');
                statusText.textContent = 'The photograph couldn’t load.';
                status.hidden = false;
                retry.hidden = false;
            };
            image.src = rendition.src;
        }
        load(photo.webp);
    }

    function move(direction: number) {
        if (!active || active.photos.length < 2) return;
        index = (index + direction + active.photos.length) % active.photos.length;
        render();
    }

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest<HTMLElement>('[data-photo]');
        const match = link?.dataset.photo ? lookup.get(link.dataset.photo) : undefined;
        if (!link || !match) return;
        event.preventDefault();
        active = match.collection;
        index = match.index;
        opener = link;
        if (contact) contact.open = false;
        scrollPosition = window.scrollY;
        previousBodyStyle = document.body.style.cssText;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollPosition}px`;
        document.body.style.width = '100%';
        viewer.showModal();
        close.focus({ preventScroll: true });
        render();
    });

    close.addEventListener('click', () => viewer.close());
    viewer.addEventListener('close', () => {
        generation++;
        clearTimeout(loadingTimer);
        images.replaceChildren();
        document.body.style.cssText = previousBodyStyle;
        window.scrollTo({ top: scrollPosition, behavior: 'instant' });
        opener?.focus({ preventScroll: true });
        active = null;
    });
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    retry.addEventListener('click', render);
    viewer.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowLeft' ? -1 : 1);
        }
    });
    stage.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' || !event.isPrimary) { pointer = null; return; }
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    stage.addEventListener('pointerup', (event) => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const deltaX = event.clientX - pointer.x;
        const deltaY = event.clientY - pointer.y;
        pointer = null;
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) move(deltaX < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { pointer = null; });
    let resizeTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (viewer.open) render(); }, 150);
    });
}
