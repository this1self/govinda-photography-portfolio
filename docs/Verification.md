# Portfolio verification — 2026-11-10

## Implemented scope

Static Astro one-pager at the root of `photography.govindarampingali.com`.
67 selected photographs: People 22, Spaces 20, Land 6, Textures 13, Things 6.
Gatherings and its two event galleries are deferred. No visible/invisible
watermark, image captions, location labels, or date labels. Accessibility alt
text remains. No Supabase, accounts, commerce, or application server.

The v0.10 reference is in `docs/v0 Design/`. Its warm palette, typography,
section dividers, spacious header, and restrained lightbox were carried into
the implementation. The current visual revision retains the larger blank introduction, uses a
five-column desktop grid with 10px gaps (5px on phones), and keeps two-row
portrait tiles. Hover reveals one masked frosted frame with an 80ms opacity fade without changing the
cursor or the whole image's brightness. The grid crops thumbnails to fill their
tiles; lightbox images remain complete. The name link opens in a new tab.
The real image proportions and selected
categories differ from its placeholders. Rendered visual equivalence has not
been verified.

## Completed checks

- `npm test`: production build, Astro/TypeScript check, output audit, and all
  11 automated tests passed. Zero Astro errors, warnings, or hints.
- Image tests: unsafe paths/symlinks rejected, EXIF orientation applied,
  metadata removed, source paths omitted, unpublished generated files pruned.
- Offline DOM tests: open/close, wraparound navigation, focus/scroll restoration,
  stale-load protection, delayed status, JPEG fallback, retry, horizontal swipe
  logic, direct-link fallback, contact dismissal, and absence of captions.
  These use a DOM model, not a browser or a rendering engine.
- `npm run test:ui:list`: 35 Playwright cases discovered successfully, across
  desktop Chromium, 320px mobile Chromium, Android Chromium, iPhone WebKit,
  and tablet WebKit. Test modules and local server pass syntax checks.
- Dependency lock validation: `npm ci --dry-run --offline --ignore-scripts`
  succeeded; dependencies have registry URLs and integrity hashes.
- `wrangler deploy --dry-run`: accepted the static asset configuration and
  production output. This does not upload or verify the live domain.
- Output inventory: exactly 1072 selected image renditions; no Gatherings media,
  originals, captions, or source directory paths in the public page.
- After the latest visual revision, the production build and all 11 tests passed
  again. Output inspection confirmed the new-tab link, an empty introductory spacer,
  67 photo links, 20 portrait tiles, and removal of the deleted Land image.
  The 35 browser tests were updated and enumerated; they remain unexecuted.
- `git diff --check` passed. Temporary preview servers were stopped.

## Measured output

| Measurement | Result |
| --- | --- |
| Selected source exports | 993.0 MB |
| All public variants combined | 248.9 MB |
| Median 640px WebP | 48.3 KB |
| Median largest WebP | 540.9 KB |
| Largest public file | 2.03 MB |
| HTML, compressed | 20.5 KB gzip |
| JavaScript, compressed | 1.7 KB gzip |
| CSS, compressed | 2.7 KB gzip |

Combined asset size is the deployment inventory, not an initial page load.
Browsers select one responsive variant, lazy-load offscreen gallery images,
and request larger variants when a photograph is opened. Actual network load
and browser performance scores have not been measured.

## Outstanding acceptance checks

Browser access to the local preview was rejected by a saved permission/managed
policy setting. The browser suite was not executed, and no browser screenshots
or real mobile-device results were obtained. Do not mark visual matching,
native focus trapping, or mobile interaction acceptance as passed based on the
offline tests. Run:

```sh
npx playwright install chromium webkit
npm run test:ui
```

Review the generated portfolio and lightbox screenshots in `.cache/ui-results`
against the v0.10 reference, then check at least one physical phone. The test
suite records screenshots for review; it does not approve its own baseline.

The Cloudflare CLI is now authenticated. The user reauthorized deployment on
2026-11-10. No Git commit or push has been performed by the agent.

## Published release

- Live URL: https://photography.govindarampingali.com/
- Worker: `govinda-photography-portfolio`.
- Final version: `1d2b7ae3-f3ba-4768-8737-7c0cdda41cc7`, serving 100% of traffic.
- Deployment completed 2026-11-10 at 09:33 UTC. The first upload published
  1084 assets; the final crawler-policy update reused 1083 and uploaded one.
- Cloudflare API confirms the enabled production custom domain and certificate,
  disabled workers.dev/version previews, compatibility date 2026-11-10,
  no bindings or tail consumers, and Logpush disabled.
- Live HTTPS verification passed: homepage, robots, sitemap, ten WebP/JPEG
  samples spanning all five categories, and missing-page HTTP 404. All fetched
  published files matched the local build's SHA-256 hashes. Security headers
  were present; sampled images use a one-year immutable cache policy. The
  homepage has no noindex directive.
- Production build and 11 automated tests passed before upload; the final
  robots-only update also passed the production build and output audit.

## Search and AI training policy

The public robots policy allows search and image indexing while declaring
`Content-Signal: search=yes, ai-train=no`. GPTBot, ClaudeBot, Google-Extended,
Applebot-Extended, and CCBot are explicitly disallowed. Python's independent
robots parser confirmed allowed access for Googlebot, Googlebot-Image,
Bingbot, Applebot, OAI-SearchBot, and Claude-SearchBot, and denied access for
the five listed training/dataset tokens, for both page and media URLs.

Wrangler disables workers.dev and version preview URLs.

Cloudflare Bot Management API access returned HTTP 403 with the current CLI
credentials. The dashboard browser reached a sign-in page. Managed edge
blocking has therefore not been configured or verified. The robots policy is
voluntary and cannot guarantee protection against noncompliant scraping.
Cloudflare's AI policies apply across a zone; review their effects on the
main website before changing them. The repository policy is scoped to the
photography subdomain.

`npm run dev` starts the local portfolio for manual review. Original photographs
are intentionally ignored by Git; build and deploy from this machine until a
durable remote media source is configured.
