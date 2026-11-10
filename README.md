# Govinda Ram Pingali · Photography

A static Astro portfolio for `https://photography.govindarampingali.com`.
Today's release contains only the public one-page gallery, contact disclosure,
and accessible full-screen viewer. The gallery uses five columns on desktop,
four on tablets, and two on phones, with 10px gaps (5px on phones). Portraits span two rows;
thumbnail crops fill the tiles while the lightbox retains the full image.
Blank space above People reserves room for future introductory text. Hovering
keeps the normal cursor and image brightness, revealing only a narrow translucent,
blurred frame along the image edges in one quick 80ms fade.
No database, accounts, commerce, or R2 setup is required.

## Local development

Requires Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

With no photographs selected, development displays the supplied reference's
neutral placeholders, explicitly marked as a design preview. Production builds
refuse to publish an empty portfolio. With photographs selected, empty sections
are omitted and counts are derived automatically.

```sh
npm test
npm run build:preview
npm run build
npm run preview
```

`build:preview` writes to `dist-preview/`, which the Cloudflare deployment
configuration does not use. `build` prepares images, checks Astro/TypeScript,
builds to `dist/`, and checks the generated files and bundle budgets.

## Add the photographs

The current page includes 67 photos across People, Spaces, Land, Textures, and
Things. Gatherings is excluded; its event folders are reserved for a later review.

Keep final source exports in the ignored `Original Photographs/` folder, grouped however
you prefer. Keep your archival masters and backups independently. Only files
explicitly selected in `src/content/portfolio.json` are processed/published.

Example photo record inside a collection's `photos` array:

```json
{
    "id": "portrait-window-light",
    "source": "People/window-light.jpg",
    "alt": "A person sitting beside a window in soft afternoon light.",
    "location": "Atlanta, Georgia",
    "date": "November 2026",
    "caption": ""
}
```

The example is illustrative, not a description of a supplied photograph.
Use descriptive alt text. No captions, locations, or dates are displayed on the
page or in the lightbox. Optional metadata fields are reserved for future use;
leave them blank for this release. `id` is a
stable, globally unique lowercase slug. Array order is display order. Location,
date, and caption are optional. Paths are relative to `Original Photographs/`.

JPEG, PNG, WebP, and single-image TIFF inputs are supported. Export HEIC/RAW files
to a supported format before ingestion. Web derivatives are capped at 3200px on
the long edge, converted to sRGB, stripped of private metadata, and encoded as
WebP and JPEG. No visible or invisible watermark is added. Sources are never
copied into the site. A local content-hash cache
avoids processing unchanged images; unselected generated files are removed.

Change the contact email and site metadata in `src/lib/portfolio.ts`.
The initial contact address comes from the supplied design reference.

## Cloudflare deployment today

This is a standalone static site at the subdomain root. The main website needs
no code changes. `wrangler.jsonc` targets `photography.govindarampingali.com` and
uploads **only `dist/`** with Workers Static Assets.

For the first release, deploy from the machine containing the ignored photographs:

```sh
npx wrangler login
npm run deploy
```

The deploy command builds and audits `dist/` before uploading it. Wrangler uses
the included custom-domain configuration. Sign in to the Cloudflare account
managing `govindarampingali.com`. No database or application server is required.
See [Cloudflare’s static-site deployment documentation](https://developers.cloudflare.com/workers/static-assets/get-started/).

Do not enable a Git-only cloud build while source images exist only locally:
that build cannot see them. Automated remote builds need an explicit media
source first. R2 is the planned durable source, but is not needed for today's
local-build-and-upload release. Do not upload the repository root or
`dist-preview/`. Confirm photographs, contact address, and domain before launch.

## Search and AI training policy

`public/robots.txt` allows search indexing and declares
`Content-Signal: search=yes, ai-train=no`. It explicitly disallows GPTBot,
ClaudeBot, Google-Extended, Applebot-Extended, and CCBot. Googlebot, Bingbot,
Applebot, OAI-SearchBot, and Claude-SearchBot remain allowed. This is a crawler
and content-use policy, not DRM or a guarantee against noncompliant scraping.

Wrangler disables `workers.dev` and version preview URLs; the public origin is
the photography custom domain. Security headers and immutable media caching
are configured in `public/_headers`.

Cloudflare managed AI crawler blocking is not configured by this repository.
The current CLI credentials cannot read or edit Bot Management (HTTP 403).
Its dashboard requires a separate sign-in. Before enabling zone-wide AI
policies, review their effect on the main website as well as photography.
Cloudflare documents these under Security > Settings > AI Crawler and Agent
access policies; keep Search allowed and deny Training. Bot Preference Sync
can publish corresponding managed robots directives. See
[Cloudflare's policy documentation](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/).

## Future storage

The public UI consumes `src/generated/portfolio.json`, containing stable photo
IDs, approved captions, dimensions, and rendition URLs. Today the local image
command generates it. A future R2/Postgres publishing job can produce the same
contract without replacing the gallery UI. No future platform dependencies are
included in today's runtime.

Architecture and release scope are in `docs/build-specs/`. Fonts are self-hosted;
their OFL license files are in `public/fonts/`.

## UI verification

`npm test` rebuilds the site and runs image-pipeline and offline DOM interaction
tests. These check the lightbox state transitions, stale image loads, fallback,
retry, swipe handling, focus restoration, and the absence of captions. Offline
DOM tests do not verify browser layout, native focus trapping, or touch hardware.

The Playwright suite covers desktop Chromium, 320px mobile, Android, iPhone/WebKit,
and tablet/WebKit. It checks all gallery images, overflow, image proportions,
contact placement, lightbox navigation and controls, native focus trapping,
script-free links, reduced motion, and reference design measurements. It also
captures portfolio/lightbox screenshots for visual review.

```sh
npx playwright install chromium webkit
npm run test:ui
```

Run `npm run test:ui:list` to list cases without launching a browser. Reports,
traces, and screenshots go under `.cache/ui-report` and `.cache/ui-results`.
The original v0.10 screenshot contains placeholder images and different section
counts: compare typography, palette, spacing, and image treatment rather than
requiring pixel equality with today's photographs.

Browser execution in this session was blocked by a saved permission setting.
The browser suite has been parsed and enumerated, but has **not been executed**;
visual and real mobile acceptance remain outstanding. No golden screenshot has
been approved, and no deployment has been performed.
