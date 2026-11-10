# Photography portfolio: architecture proposal

Status: superseded by [Photo platform architecture](2026-11-10-photo-platform-architecture.md).
The design contract and interaction notes remain useful. Git-based photo storage,
the 3200px source-export recommendation, and the original deployment proposal
are superseded by the private-storage and independent-app architecture below.
Date: 2026-11-10.
Target URL: https://www.govindarampingali.com/photography

## Evidence and scope

Inspected locally:

- `Not Public/v0 Design/v0_10 - One pager@1x.png`
- `Not Public/v0 Design/v0_10 - One pager-html/OnePager.dc.html`
- The reference export's README, which explicitly identifies its runtime as mockup infrastructure rather than production code.
- Repository `this1self/govinda-photography-portfolio`: README and untracked reference files; no application or package configuration at inspection time.

The mockup contains 40 placeholder frames across People, Gatherings, Structures, Land, Textures, and Shot on iPhone. Counts, aspect ratios, location, and dates are example data, not verified photograph metadata. Final photographs are pending. Repository visibility and the existing domain's hosting configuration have not been verified.

Build a single, responsive photography page, a contact disclosure, and a full-screen image viewer. Keep the design's restrained typography, spacing, natural photograph proportions, and warm neutral palette.

## Recommended stack

- Astro in static output mode, with scoped/plain CSS and a small browser TypeScript module.
- Astro image utilities for build-time renditions; inspect the selected version's image service behavior before relying on metadata removal.
- Native HTML for the gallery, contact disclosure, and modal dialog. No React runtime or UI framework is required.
- Node.js for local development and the build environment only. The deployed result is static HTML, CSS, JavaScript, fonts, and images.
- Static hosting with HTTPS and CDN caching. No database, public upload endpoint, or application server in v1.
- Pin dependency versions and commit the package lockfile during implementation.

Plain HTML/CSS/JS is also viable and supports the same native lazy loading. Astro is recommended for reusable templates, validated content, and automated image generation. It does not inherently make the browser's lazy loading faster. Avoid adding a second custom image pipeline unless Astro's processing cannot meet a verified requirement.

Traffic scales through static delivery. Growth in the photo library primarily affects Git size, build duration, and page weight; additional collections can become separate static pages. A CMS or object store can replace the content source later without requiring a new gallery UI.

## Design contract

| Element | Reference value or behavior |
| --- | --- |
| Background | `#E7E5E0` |
| Primary text | `#1C1C1A` |
| Secondary text | `#5E5B55` |
| Dividers | `#CBC8C1` |
| Display type | Newsreader, light/regular and light italic |
| Utility type | Instrument Sans, regular/medium |
| Content wrapper | Reference uses `max-width: 1360px` plus horizontal padding; reproduce its actual geometry before adjusting box sizing |
| Horizontal padding | `clamp(16px, 4vw, 64px)` |
| Gallery rows | Justified rows preserving aspect ratios, with an incomplete final row aligned left |
| Target row height | 220px desktop; 110px at widths up to 640px |
| Image gap | 10px desktop; 5px at widths up to 640px |
| Section headings | Newsreader, `clamp(24px, 2.4vw, 30px)` |
| Viewer | Warm full-screen surface, category, counter, previous/next/close, location and date |

Use self-hosted licensed WOFF2 font assets, retaining license files. Load only used styles. Preserve actual image proportions without stretching or imposed crops. The mockup's flex layout is a starting point; verify row alignment with real images and extreme aspect ratios. Add a small layout calculation only if CSS cannot satisfy the design consistently.

The email in the mockup is `govinda@pgr.earth`; treat it as a provisional contact value until confirmed. Do not publish the mockup's repeated Kavanapura/June 2026 metadata as real captions.

## Source organization

Proposed paths, to be created during implementation:

| Path | Responsibility |
| --- | --- |
| `src/pages/index.astro` | One page, deployed with `/photography` as its base |
| `src/layouts/SiteLayout.astro` | Document metadata and base styling |
| `src/components/GallerySection.astro` | Ordered gallery section and derived count |
| `src/components/Photo.astro` | Responsive image and progressive-enhancement viewer link |
| `src/components/PhotoViewer.astro` | Accessible dialog shell |
| `src/components/SiteHeader.astro` | Identity and contact disclosure |
| `src/scripts/viewer.ts` | Dialog navigation, image loading, and focus restoration |
| `src/styles/global.css` | Tokens and shared responsive styling |
| `src/assets/photos/` | Curated source JPEGs, organized by collection |
| `src/data/portfolio.json` | Editorial collection and photo manifest |
| `public/fonts/` | Self-hosted font files and licenses |
| `scripts/validate-media.mjs` | Content checks and output inspection |
| `docs/` | Architecture and photo publishing instructions |

A single manifest is sufficient at this scale. Each section contains an ID, title, and ordered photo records. Each photo contains a stable ID, source path, descriptive `altText`, optional caption, optional location, and optional display date. Ordering comes from the manifest. Dimensions, aspect ratio, rendition URLs, and section counts are derived automatically.

Only listed photos enter the published gallery. Validate unique IDs, existing supported source files, usable alt text, and allowed paths. Escape editorial text; do not accept raw HTML. Do not add an API request for data already available at build time.

## Photo ingestion and publication

1. Export a curated JPEG from the editing application, with final crop and color treatment.
2. Add it under `src/assets/photos/<collection>/` with a stable, descriptive filename.
3. Add its editorial record to the manifest.
4. Run validation and build; review the preview for order, crops, color, compression, captions, and responsive layout.
5. Commit and push through authenticated Git access. Configure the selected host to build the production branch and deploy only the generated output.

This uses Git authentication as the authoring boundary. Keep deployment credentials in the host's secret settings. There is no browser upload credential or visitor-facing administration surface in v1.

Only commit exports that may be public. A folder called `Not Public` does not make files private in a public repository. Keep RAW files, full-resolution archival masters, and sensitive metadata out of Git. They belong in the photographer's archive. A private repository can protect source access, but published renditions remain downloadable by visitors.

Sources must not be placed in `public/`, because files there are copied unchanged. Inspect the production output to ensure it contains only intended derivatives, not source exports, design references, or source metadata. Strip EXIF/GPS and other private metadata from public derivatives after applying orientation and converting to sRGB. Store deliberately published date/location text separately in the manifest.

If a browser upload interface becomes necessary later, prefer an authenticated CMS or a small admin service with short-lived signed uploads into private object storage. Validate and re-encode uploads before publishing derivatives. This would introduce a backend boundary; it is not required to launch this portfolio.

## Image specifications

These are starting targets to tune against the final photos, not measured results or hard visual-quality guarantees.

| Purpose | Dimensions | Format and target |
| --- | --- | --- |
| Source export supplied by photographer | 3200px long edge; smaller sources accepted without enlargement | JPEG, sRGB, approximately quality 90–95; no GPS; preserve crop |
| Gallery derivatives | Candidate widths 320, 480, 640, 960, 1280px | AVIF and WebP with JPEG fallback; roughly 30–150KB for typical selected renditions |
| Viewer derivatives | Candidate long edges 1600, 2400, 3200px | AVIF and WebP with JPEG fallback; roughly 150–600KB typical, larger allowed when detail requires it |
| Loading placeholder | Solid neutral or image-derived average color | Inline color; no additional request |

Gallery dimensions are widths; viewer dimensions are long-edge limits. Derive actual width descriptors for portrait and landscape variants. Never upscale. Deduplicate matching dimensions. A 3200px export is a practical quality/bandwidth compromise, not a guarantee of native resolution on every large high-density display. DPI/PPI metadata does not determine screen detail; pixel dimensions do.

Use `srcset` and accurate `sizes` so the browser selects a suitable rendition. Tune each codec independently, starting around AVIF 55, WebP 80, and JPEG 85; their quality scales are not equivalent. Review foliage, hair, skin, grain, gradients, and dark areas before settling defaults. Use per-photo overrides only where visible evidence warrants them.

## Loading and interaction

- Render the document and gallery immediately. Do not gate the page behind a full-screen loading animation.
- Reserve image space from known dimensions and aspect ratios to prevent photo-driven layout shifts.
- Load the initial visible gallery row eagerly; give high fetch priority only to the likely largest visible image. Tune this after responsive network inspection.
- Use native lazy loading for subsequent images. Browsers may request nearby offscreen photos before they become visible.
- Use a warm placeholder and an approximately 180ms opacity fade after decode, disabled for reduced-motion preferences. Images must remain visible if enhancement JavaScript fails.
- Keep viewer URLs as inert data until a photo is opened; hidden image elements with live sources can cause premature fetching.
- On opening, display the available thumbnail while loading a suitable viewer rendition. Add a small local progress indicator only after roughly 250ms, and an accessible error/retry state on failure.
- Optionally prefetch one neighboring viewer image after the current image finishes; avoid doing so when a supported data-saving preference is active.
- Guard asynchronous loads against rapid navigation and closing so stale photos cannot replace the active one.
- Provide Escape, previous/next arrow keys, visible controls, contained focus, scroll locking, and return focus to the originating thumbnail. Wrap within the current collection, matching the reference.
- Use ordinary optimized-image links as the no-JavaScript fallback. Use a native contact disclosure where practical.

## Domain and deployment

Provisional Astro configuration: `site: 'https://www.govindarampingali.com'`, `base: '/photography'`, and `output: 'static'`. Use base-aware URLs throughout. Select canonical trailing-slash behavior after inspecting the host's routing.

The `base` configuration governs generated URLs; it does not configure hosting or DNS. DNS cannot route a URL path to a different service.

Preferred deployment: integrate the generated photography output under `/photography` in the existing domain's static deployment. If this repository must deploy independently, the domain's existing host or edge layer must route `/photography` and `/photography/*` to that deployment, including all images, fonts, and scripts. Explicitly verify whether the origin receives the prefix or a stripped path.

Deploy only the build output, never the repository root. Use long-lived immutable caching for content-hashed assets and revalidated HTML. Scope any redirects and security headers to the photography deployment so existing site routes continue working.

Open dependency: identify the current host, deployment repository, and control over path routing. The public website could not be retrieved through the research tool, so its hosting provider has not been inferred.

## Implementation sequence and acceptance

1. Scaffold static Astro, content validation, base-aware routing, design tokens, fonts, and the six reference sections. Use explicit development fixtures while final photos are absent; production must not silently publish fixtures.
2. Integrate final JPEGs, metadata, automated renditions, progressive loading, and the accessible viewer.
3. Verify desktop/mobile appearance, no-JavaScript gallery access, keyboard interaction, reduced motion, failed loads, rapid navigation, and the exact `/photography` path.
4. Inspect network requests and generated output: no source images or EXIF/GPS leaks, no initial full-size viewer downloads, no missing base prefixes, and no reference runtime in production.
5. Integrate with the confirmed host and verify the deployed route and existing homepage.

Proposed performance budgets: first-party browser JavaScript at most 15KB gzip, CSS at most 15KB gzip, and initial viewport image transfers preferably under 1MB. Measure with real photos and a recorded viewport/network profile. Aim for LCP at most 2.5 seconds and CLS below 0.05 in representative mobile lab testing; these are targets, not guarantees of field performance.

Implementation can begin before hosting is resolved. Deployment needs the host decision. Final visual-quality and performance acceptance needs the actual photographs.

## Primary technical references

- Astro static output and base path: https://docs.astro.build/en/reference/configuration-reference/
- Astro image processing: https://docs.astro.build/en/guides/images/
- Native loading and responsive image attributes: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img
- Image loading performance: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Multimedia
- Sharp output and metadata behavior: https://sharp.pixelplumbing.com/api-output/
