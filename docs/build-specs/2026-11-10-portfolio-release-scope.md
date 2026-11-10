# Portfolio release scope

Date: 2026-11-10. Target: ready to show within the user's eight-hour window.

## Current decision

Ship only the responsive public portfolio at
`https://photography.govindarampingali.com`. Astro runs at `/`, independently of
the main website. Supabase, client authentication, purchases, print fulfillment,
R2 provisioning, and invisible-watermark integration are future work.

The broader photo-platform document describes future direction; it is not a
launch checklist or a dependency of this release. Its subpath mounting proposal
has been replaced by the independent subdomain decision.

## Smallest robust implementation

- Static Astro, plain CSS, small browser script. No application server.
- Match the v0.10 reference: five categories, a compact grid with narrow gaps,
  two-row portrait tiles, warm palette, self-hosted Newsreader/Instrument Sans fonts.
- Native contact disclosure and dialog, keyboard navigation, focus restoration,
  touch swipe, mobile safe areas, and reduced-motion support.
- Source photographs remain local and ignored by Git. A build command creates
  content-hashed, sRGB, metadata-stripped WebP/JPEG display images.
- One manually curated catalogue controls ordering and descriptive alt text.
  No image captions, location labels, or dates are displayed, including in the
  lightbox. The generated public manifest is the future storage integration
  boundary.
- Public derivatives are capped at 3200px long edge; archival originals are kept
  separately and unchanged. No visible or invisible watermark is applied.
  The site makes no DRM claims.
- Lazy-load gallery images except the first priority image. Fetch enlarged
  images on opening; retain the thumbnail while the selected image loads.
- Development may show clearly identified reference placeholders. Production
  builds require at least one real photo and reject placeholders.
- Build locally with source images available; deploy only `dist/` to Cloudflare.
  Git-only remote builds wait until an external media source is configured.

## Required launch inputs

The current selection contains 67 photographs from `Original Photographs/`:
People (22), Spaces (20), Land (6), Textures (13), and Things (6).
Category order follows the numbered folders; photos initially follow filename
order. Descriptive alt text was added from visual inspection.

Gatherings is excluded from this release, including its 30 photographs. Later,
its two event subfolders will appear as folder-like entries leading to separate
gallery pages: `2025-04 Hands off Protest` and `2025-06 No Kings Protest`.
Do not build those entries or pages until the user has reviewed the one-pager.
The loose photograph directly under Gatherings is also excluded.

The contact email defaults to the supplied reference, `govinda@pgr.earth`.

Deployment needs access to the user's Cloudflare account and the subdomain.
Neither the account nor its current deployment configuration has been changed.

## Verification

Run Astro type checks, image privacy/path-validation tests, and static output
auditing. Verify the page at narrow mobile, tablet, and desktop widths where
browser access permits. Check overflow, portrait/landscape proportions, modal
focus/close behavior, touch controls, missing images, and script-free links.
Final compression and performance review requires the actual photographs.

## Image specification for this release

Supply full-size edited JPEG, PNG, WebP, or single-image TIFF exports. Preserve
archival masters separately; do not downsize them for this site. The build reads
only catalogue entries from `Original Photographs/` and emits public derivatives.

| Use | Generated size | Encoding |
| --- | --- | --- |
| Gallery | 320, 480, 640, 960, 1280px widths, bounded by source size and maximum long edge | WebP quality 82, JPEG fallback quality 86 |
| Full-screen viewer | 1600, 2400, 3200px long edges, without upscaling | WebP quality 82, JPEG fallback quality 86 |

EXIF orientation is applied before resizing. Public output uses sRGB and drops
EXIF, GPS, IPTC, and XMP. No watermark of either kind is added. File size varies
with detail and noise; dimensions and encoding settings are constraints, not a
promise that every image has the same byte count. The browser selects responsive
variants, defers offscreen gallery images, and requests larger versions when a
photo is opened. Initial gallery loading uses a sampled background color;
the viewer retains an available thumbnail and shows a small spinner only after
250ms. Motion respects the device's reduced-motion preference.

## First visual revision

- The header name opens the main website in a new tab with `noopener noreferrer`.
- Three visible lines of `...` reserve introductory copy space before People.
- Five equal-width desktop columns, four tablet columns, two phone columns.
- Zero inter-image gap or padding; portrait tiles span two rows. Landscape
  thumbnail tiles use 4:3 and portrait tiles 2:3, with `object-fit: cover`.
  The lightbox retains the complete original composition with `contain`.
- Reconciled the five source folders: eight additions and one removal, yielding
  67 selected images. Gatherings remains excluded. No captions or watermarks.

## Second visual revision

- Remove the visible ellipses while retaining the larger blank introductory area.
- Restore 10px gallery gaps on desktop/tablet and 5px gaps on phones.
- Keep the default arrow cursor over photos and remove whole-image hover opacity.
- Reveal a 6px frosted frame at the edges on hover or keyboard focus. Translucent
  fill and 4px backdrop blur affect only the narrow frame strips, leaving the
  image center unchanged. The overlay does not intercept clicks or shift layout.
- Keep five/four/two columns and two-row portrait spans; include the restored
  gaps in the row-height calculation.

## Hover animation refinement

Replace the four separate blur strips with one masked frame. Its shape and blur
stay fixed; only opacity changes over 80ms with linear timing. The whole border
appears together, with no stagger, drawing, or animated blur. Reduced-motion
preferences continue to disable the transition.
