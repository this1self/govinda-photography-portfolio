# Photo platform architecture

Date: 2026-11-10.
Status: future-platform proposal. Today's implementation is governed by
[Portfolio release scope](2026-11-10-portfolio-release-scope.md): public one-pager
only, no Supabase or R2 setup, independent `photography.govindarampingali.com`
subdomain. The subpath discussion below is retained as earlier analysis, not
the selected deployment plan. No future-platform infrastructure is provisioned.
Supersedes: `2026-11-10-photography-architecture.md`, except its design contract and progressive-loading requirements.

## Direction and evidence

The portfolio will become the public face of a photographic asset library with private client galleries, purchases, controlled downloads, and eventual print orders. Storage, identity, and publication must support that direction from the first upload.

The user identifies the existing website as hosted on Cloudflare and its repository as https://github.com/this1self/govindarampingali. This photography repository remains independent. Attempts to fetch the main repository through web retrieval and GitHub CLI failed; its specific Cloudflare product, deployment rules, and source configuration have not been inspected. Do not infer them from the hosting provider alone.

The Astro application must not hardcode `/photography` or depend on the main site's code/build. The proposed public path remains `www.govindarampingali.com/photography`, with mounting handled outside Astro. DNS alone cannot implement path routing.

## Recommended division of responsibilities

| Layer | Proposed service | Responsibility |
| --- | --- | --- |
| Application source | Existing GitHub photography repository | UI, scripts, migrations, configuration, documentation; no production photographs |
| Public UI | Astro, initially statically generated | Reference design, portfolio, accessible viewer |
| Object storage | Cloudflare R2 Standard | Private masters, private client renditions, separately published public derivatives |
| Database | One Supabase Postgres project | Asset catalogue, albums, memberships, publication, orders, entitlements, processing state |
| Authentication | Supabase Auth | Individual client/admin identity and sessions |
| Authorization and application API | Cloudflare Worker | Verify identity, enforce album/purchase rights, authorize uploads and downloads |
| Media processing | Initial local ingestion CLI; later queued processor | Validate, orient, resize, color-convert, watermark, verify, write derivatives |
| Payments, later phase | Stripe Checkout, subject to merchant setup | Collect payment; verified webhooks update orders and entitlements |
| Print fulfillment, later phase | Manual fulfillment first, then selected lab | Product/crop approval, print export, order tracking |

Astro remains suitable. The broader product needs backend execution, but not a continuously running Node.js web server. Workers can handle request authorization and payment endpoints. Heavy image processing is a separate workload; do not assume ordinary native Node/Sharp code will run unchanged inside Workers. Choose a compatible image service or container/job runtime when processing moves off the local machine.

R2 plus Supabase introduces an explicit authorization integration, which must be tested. Supabase Storage is a reasonable alternative if minimizing integrations becomes the priority: it integrates object access with Postgres RLS. R2 is the proposed primary store because the project already uses Cloudflare and expects substantial image delivery. Its storage/request charges and zero R2 internet-egress charge must be distinguished from processing, Workers, database, and backup costs.

## Store photographs here from the first ingestion

Use three proposed R2 buckets, with names finalized at provisioning:

| Bucket | Access | Contents |
| --- | --- | --- |
| `photography-originals` | Private, no public domain or r2.dev access | Full-resolution edited masters; optional RAW/source files and edit sidecars |
| `photography-client-media` | Private, no public domain or r2.dev access | Watermarked proofs, clean purchased-download exports, print-ready exports |
| `photography-public` | Public CDN domain, explicitly configured | Only approved portfolio derivatives |

Keep immutable revisions with generated IDs. Example object keys:

```text
assets/<asset-uuid>/<revision-uuid>/master.jpg
assets/<asset-uuid>/<revision-uuid>/proof-960-watermark-v1.webp
assets/<asset-uuid>/<revision-uuid>/delivery-srgb.jpg
```

These paths are examples within their respective buckets, not public URLs. Avoid putting client names/emails in object keys. Record original filenames privately in Postgres. Random paths reduce accidental discovery but do not authorize access.

Assign the asset ID before upload. Store bucket, object key, version, checksum, bytes, MIME type, dimensions, and processing status in the database. Use a separate version/variant record for each rendition. Albums reference assets through a join table, allowing reuse without duplicating masters.

R2 is the durable origin; CDN caches are temporary delivery copies created on demand, not the archive. GitHub does not automatically transfer photographs into R2. An explicit ingestion tool performs upload and catalogue registration.

The operational library must have a separate recovery copy: retain local archival copies and establish an independent backup of originals and database records, with restore checks. Replication/durability within one storage service does not replace protection against accidental deletion or compromised credentials. Keep immutable object revisions rather than relying on unverified S3-style object-versioning assumptions.

## Master files and generated image sizes

The former 3200px recommendation applied only to a portfolio web source. It must not be used as the sole master for this platform.

| Asset type | Proposed specification |
| --- | --- |
| Edited master | Preserve full pixel resolution and intended color profile; retain the highest-quality available edit export |
| RAW/source and sidecar | Preserve when part of the intended archive; access restricted to the photographer, not automatically purchasable |
| Public gallery rendition | Widths 320, 480, 640, 960, 1280px, no enlargement; AVIF/WebP/JPEG as useful after testing |
| Public enlarged view | Long edges 1600/2400/3200px, configurable; no claim this prevents copying |
| Private unpaid proof | Start with a maximum long edge around 1600px, baked-in visible watermark; tune for proofing needs |
| Purchased download | Explicit delivery export at the sold resolution/profile; do not equate this with the archival source |
| Print file | Generated for the selected lab/product/crop/profile; never derived from a small web preview |

Normalize orientation before removing metadata. Convert web derivatives to sRGB; strip GPS, serial numbers, and unintended personal metadata. Keep approved public captions separate from private original metadata. Preserve masters unmodified. Dimensions and public captions may be published; source filenames and storage keys must not leak through public catalogue responses.

## One catalogue, explicit access rules

Proposed tables, not yet migrations:

| Table | Purpose |
| --- | --- |
| `assets` | Stable photo identity and private source metadata |
| `asset_versions` | Immutable master revisions and processing state |
| `asset_variants` | Object locations, resolution, format, checksum, watermark policy |
| `albums` | Portfolio sections or client collections |
| `album_assets` | Ordered many-to-many album membership |
| `album_members` | Which authenticated user can access each client album |
| `portfolio_entries` | Selected public asset/version, section, order, approved captions, publication status |
| `orders` / `order_items` | Purchaser, payment references, frozen products/prices/status |
| `download_entitlements` | Granted asset/version/product rights and revocation/expiry policy |
| `processing_jobs` / `audit_events` | Job retry/state and material access/admin actions |

The UI can expose the requested “Show in portfolio” checkbox. Internally, make it an admin-only publication operation that creates/updates a portfolio entry. A separate entry supports category/order/captions without making a private album public. It also distinguishes selected, processing, published, and failed states.

Rules:

- Anonymous visitors receive only an allowlisted public projection: public derivative URLs and approved captions/dimensions/order. Do not grant anonymous users access to entire private asset rows just because a photo is selected.
- Clients can access albums where they have active membership. Album access grants proof viewing; downloading clean high-resolution files requires a separate entitlement unless explicitly included in their package.
- Clients may not assign memberships, publish assets, set prices, mark payments successful, or grant their own entitlements.
- Admin privileges are managed server-side. Use individual identities rather than shared gallery passwords as the durable permissions model. Email/password or email sign-in links are both viable.
- Enable and test default-deny RLS on client-facing tables. Queries using client identity should preserve that identity through database access. Supabase secret/service credentials bypass RLS; privileged operations require explicit authorization and must never expose those credentials to a browser.

Postgres RLS governs database access. It does not automatically govern Cloudflare R2. A Worker must verify the session and authorized database record before returning the corresponding private bytes or signing access. Never accept an arbitrary caller-supplied R2 key as sufficient authorization.

## Upload, processing, and publication

Initial implementation can be a local admin CLI, avoiding a premature admin UI:

1. Assign an asset/version ID, validate the input, compute checksum, and register a pending record.
2. Upload the master privately using scoped credentials; verify object size/checksum.
3. Produce web/proof/delivery variants as appropriate. Run the watermark stage where policy requires it.
4. Write derivative records only after uploads succeed; mark the version ready. Failed uploads/processing remain unpublished, with safe retries and cleanup of orphan objects.
5. An explicit portfolio selection publishes only approved derivatives to the public bucket and generates a sanitized public snapshot.
6. Trigger the photography app's independent build from that snapshot. Deploy only after success; record the published revision. This makes checkbox changes automatic after the publish job, not instant database-driven changes in already-built HTML.

Later, an authenticated admin browser can obtain short-lived, object-scoped upload permissions and upload directly to private storage. Use pending/quarantine state, finalize with server-side validation, restrict allowed origins, and never trust the declared content type or filename alone. CORS is browser policy, not authentication.

Public gallery generation should process only changed assets. The entire client library must not be imported into every Astro build. The public snapshot is a generated cache, not a second authoritative database.

Unpublishing removes the public entry, deletes or disables its public derivatives, purges relevant CDN objects, and updates the public page/snapshot. A removed gallery entry alone does not revoke a public image URL, and no system can recall copies already downloaded.

## Private previews and purchased downloads

Private previews initially go through an authenticated Worker endpoint with private/no-store response policy. Authenticate before any cache lookup that could return private data. Shared caching is deferred until its authorization boundary is separately designed and tested.

For purchased files, check active entitlement on every new download request. Either stream the approved variant through the Worker or issue a short-lived R2 signed GET URL. R2 S3 presigned URLs use the R2 S3 API hostname, not a custom CDN domain. Anyone holding that URL can reuse it until expiry; logout does not invalidate an already-issued URL. Use the Worker path when immediate authorization checks are required.

Never expose private originals via a public custom domain. A Worker binding itself does not enforce user permissions; that logic belongs in the application. Rate limits and audit events supplement authorization, not replace it.

Later payment flow: create the order and checkout session server-side from allowed products/prices, then use verified Stripe webhook events to confirm payment and grant entitlements idempotently. Handle delayed success, duplicate events, and refund/revocation policy. A browser reaching a “success” URL is not proof of payment. Print requests can start as recorded requests for manual quoting/approval; print product/pricing/shipping integration is a later, explicit scope.

## Protection and watermarking

There is no ordinary web-image DRM that makes a photograph viewable while guaranteeing it cannot be copied, photographed, or screenshotted. Encryption and authentication can control delivery; they cannot revoke pixels after display or an authorized file download.

Use distinct layers:

| Layer | Intended effect | Limitation |
| --- | --- | --- |
| Private storage and authenticated access | Restrict who receives files | Authorized viewers can copy displayed content |
| Reduced-resolution previews | Keep useful masters away from unpaid viewers | Does not prevent reuse at preview resolution |
| Visible watermark baked into preview pixels | Deter casual unpaid reuse | Can be cropped, edited, or reconstructed |
| Invisible robust watermark | Identify an asset or potentially trace a delivered copy | Detection robustness, false positives, and adversarial removal must be tested |
| Copyright/provenance metadata | Carry attribution and provenance information | Can be stripped; not a robust watermark or access control |

Do not use a removable CSS/HTML watermark overlay as protection. Generate visible proof watermarks during processing and cache only the appropriate marked variant. Paid exports can omit the visible mark according to the product terms while retaining an evaluated invisible mark.

Invisible watermarking is a required architectural extension point, with provider selection still open. Evaluate a commercial SDK/API such as Digimarc and a maintained research implementation only after verifying commercial licensing, deployment costs, data handling, and preservation of visual quality. Do not invent an LSB/metadata scheme and call it robust DRM.

Store watermark algorithm/version, policy, and opaque payload ID with each generated variant. A registry maps IDs to assets; later per-order variants may map to deliveries. Never embed customer email addresses directly. Keep pristine masters unchanged. Per-order copies create additional processing/storage work and should be generated asynchronously when selected.

Acceptance study before claiming tracing capability: use representative portraits, foliage, grain, gradients, and dark images; measure detection after JPEG/WebP/AVIF encoding, resizing, cropping, screenshots, and edits, including unmarked controls and false-positive rates. Benchmark final exported bytes. Watermark/resize/encode ordering must follow the selected algorithm and measured results. If invisible watermarking is required for launch, publication remains gated until that study and licensing decision are complete.

## Independent app at `/photography`

DNS resolves hostnames; it cannot distinguish `/photography` from `/about`. Cloudflare HTTP routing can distinguish them.

Use a separate photography deployment and an edge route for the exact `/photography` entry and `/photography/*`. Canonicalize the bare entry to a trailing slash if required by the asset strategy. Other main-site paths keep their existing routing. Do not use a broad prefix that captures `/photography-other` inadvertently. The exact integration depends on whether the main site is Pages, Workers Static Assets, or another origin behind Cloudflare; verify before configuration changes.

Keep the Astro source at root `/`, with no hardcoded photography prefix. Configure the external mounting layer during deployment. Cloudflare currently documents a static-assets base-path option, but asset lookup is only part of mounting: HTML containing `src="/_astro/file.js"` still causes the browser to request the main site's root path.

Therefore a genuinely root-built Astro app at a subpath needs deployment-owned URL handling: rewrite generated asset/navigation references during packaging or at the edge, or put assets on a dedicated absolute origin and correctly handle navigation/API/auth URLs. Strip/reapply the prefix consistently, and account for redirects, canonical tags, login callbacks, and cookies. Avoid intercepting all `/_astro/*` requests, which could collide with the main site. Do not assert that stripping the incoming path alone solves this.

Recommended under the user's constraint: a narrowly scoped Cloudflare mounting layer outside Astro, with explicit output URL handling and tests. The tradeoff is extra deployment logic. The simpler alternative for complete root-path independence is `photography.govindarampingali.com`, optionally redirecting the original `/photography` entry there; that changes the visible URL and remains a user choice.

Same-origin path routing provides independent code and deployment, not full browser security isolation from the main website. If isolation of client authentication is important, prefer a dedicated client-app subdomain with host-only cookies and deliberately restricted cross-origin access.

## Phases and verification

**Foundation now:** R2 layout and independent backups; Supabase asset/album/publication schema; admin ingestion command; media processing interface with watermark policy; portfolio consuming a public snapshot; reference design and independent deployment contract.

**Private galleries next:** Supabase Auth, invitation/membership flow, proof viewer, authorized private-file endpoints, access tests, admin UI when useful.

**Commerce later:** verified checkout/webhooks, product-specific download entitlements, optional per-delivery watermarking, then print requests/fulfillment.

The invisible-watermark feasibility study should happen early because the user considers it critical. It is not replaced by visible watermarks, nor represented as unbreakable DRM.

Required security checks before private launch: anonymous denial, one client denied another client's albums and assets, revoked membership, stale signed URLs, guessed keys, service-key leakage, cross-user cache exposure, and public projection leakage. Before commerce: forged prices, forged/duplicate payment events, download rights, and refund behavior. Before path deployment: every asset/deep link/login callback works under the mount and existing homepage routes remain intact.

No cloud resources, fees, credentials, production routes, or merchant settings have been changed by this architecture work.

## Primary references

- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- R2 public delivery/CDN: https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- R2 Worker bindings and authorization: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- R2 signed URL semantics: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Cloudflare routes: https://developers.cloudflare.com/workers/configuration/routing/routes/
- Cloudflare static-asset subpaths: https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage alternative: https://supabase.com/docs/guides/storage/security/access-control
- Stripe fulfillment: https://docs.stripe.com/checkout/fulfillment
- Digimarc product/API scope: https://www.digimarc.com/legal/products
- Watermark evaluation framework: https://github.com/facebookresearch/omnisealbench
