# HICO Customer Platform Stabilization and Hypercare Handoff

## Release identity

- PR: `15.8`
- PR15.8 source commit: not committed in this worktree; base HEAD is
  `482ca8baca5332461cf86220c0d27df1778e9b3b`.
- PR15.8 documentation commit: not committed in this worktree.
- Migration head: `012_customer_platform_cutover.sql`
- Current branch worktree evidence is not a production approval.

## Cutover evidence

The isolated QA run used a disposable Docker project with two backend instances,
PostgreSQL, frontend, and Mailpit. It did not touch `cuongdesign-*` containers.

- Inventory preserved five `LEGACY_UNRESOLVED` legacy orders.
- Two demo profiles, one mock eSIM, and two mock manual QR records were not
  imported; they were represented in quarantine planning only.
- Execute report inserted ten quarantine rows with safe metadata and no PII.
- No email-based ownership link was created.
- Customer, owned-order, guest-order, fulfillment, inventory, loyalty,
  referral, notification, profile, address, session, support, and attachment
  runtime counts were zero in the disposable target unless explicitly listed
  above. Use the final aggregate report as the source of truth.
- Mode was `real`; demo fallback and legacy `/api/user/*` were disabled.
- Platform health returned HTTP 200 with an empty blocker list after migration.
- `/api/user/orders` returned HTTP 410 with
  `LEGACY_CUSTOMER_API_DISABLED`, `Deprecation`, and `Sunset` headers.
- Backup creation and verification passed. An isolated restore drill passed
  using the expanded customer table order and preserved quarantine data.
- Docker Compose configuration passed and the stack was torn down after QA.

## Hypercare window

The production owner must approve the duration; the implementation does not
hard-code it. Recommended operational coverage is a staffed 24-hour internal
canary followed by an approved 72-hour monitored period. During the window,
the on-call owner, customer support owner, security owner, and database owner
must have named escalation paths.

## Metrics and alerts

Track by instance and release SHA:

- customer platform health and readiness status;
- login, verification, reset, session revoke, and CSRF failure rates;
- `404 ORDER_NOT_FOUND` and guest claim request/consume/replay rates;
- dashboard and asset API latency/error rates;
- sensitive reveal denials, re-auth failures, audit write failures, and
  no-store/cache violations;
- quarantine row growth, manual review age, and unresolved order count;
- backup success, restore verification, database pool errors, and restart
  recovery;
- disabled loyalty/referral attempts and legacy API 410 volume.

Alert on any ownership mismatch, non-owner data response, secret/PII log
finding, unexpected mock import, fallback flag change, health degradation,
quarantine deletion, duplicate claim consume, or backup verification failure.

## Required smoke coverage

Before accepting the window, repeat on both backend instances:

1. public home/catalog/checkout availability;
2. customer registration/login/verification/reset with a disposable verified
   account;
3. owner-only dashboard and order access;
4. non-owner order, support, address, and asset access;
5. guest claim generic response, expiry, single-use, replay rejection;
6. asset reveal owner/CSRF/re-auth/no-store/audit behavior;
7. notification dedupe and support attachment allowlist/private storage;
8. disabled loyalty/referral response;
9. restart and database outage/recovery behavior;
10. browser desktop and 390px mobile layouts without horizontal overflow,
    console errors, private-route indexing, or mojibake.

The completed browser smoke in this handoff covered protected-route redirects,
desktop width 1280, and mobile width 390 with no overflow or console errors.
Full private customer flows require a disposable verified account and were not
claimed from source-only or no-account tests.

## Rollback triggers

Rollback immediately for any IDOR, ownership assignment, claim replay,
sensitive-data exposure, mock/demo import, fallback activation, health/readiness
regression, migration parity failure, or backup/restore failure. Follow
`docs/customer/CUSTOMER_PLATFORM_ROLLBACK_RUNBOOK.md` and preserve evidence.

## Exit criteria

Hypercare exits only when the approved window is complete, all critical metrics
are within approved thresholds, no open security incident exists, quarantine
items have an owner-reviewed disposition plan, backup/restore is verified, and
the on-call and release owners sign the report. Legacy API removal criteria,
legal retention/anonymization policy, off-site backup, domain/TLS, secret
rotation, external alerts, canary, and Go/No-Go evidence remain PR14 blockers.

Production status remains `NO-GO`; PR15.8 local or isolated QA evidence does
not waive those blockers or enable loyalty/referral redemption.

## PR15.8.2.5B.10 Fulfillment family contract handoff

- Added migration `017_catalog_variant_fulfillment_profiles.sql` for structured,
  versioned provider family profiles and append-only profile events. Legacy
  `MANUAL_PROCESSING` values were not bulk-converted.
- The bounded QA backfill covered only `var-1032` (exact 1D) and `var-1033`
  (2D catalog entitlement resolved to next-longer 3D). The provider reference
  contained no 2D snapshot. No fuzzy identity, price/name inference, Product ID
  inference, or Sheet writeback was used.
- Family keys are built from structured provider, region, medium, data, speed,
  and operation fields; duration, price, WMID, display name, row number, and an
  explicit caller key are excluded. Admin confirmation and version checks are
  required before persistence.
- The isolated QA project `hico-pr15-8-sheet-identity` was torn down with
  `down -v --remove-orphans`. Its database volume, provider fixture, generated
  catalog version, Mailpit data, and temporary backup were removed. The three
  `cuongdesign-*` containers remained running and untouched.
- Backend tests are `231/231` PASS; lint, build, prerender, security,
  integrity, Vietnamese encoding, family contract, Sheet contract, and Docker
  configuration gates passed. Production remains `NO-GO` because this worktree
  is mixed/uncommitted and B.9 production closure is not certified.

## PR15.8.1 Vietnamese UI and encoding handoff

- PR15.8.1 source commit: not committed in this worktree; the worktree also
  contains the previously uncommitted PR15.8 cutover changes.
- Migration head remains `012_customer_platform_cutover.sql`; no migration,
  URL, API, enum, status value, or customer input contract changed.
- Backend baseline after the change: 182 tests passed, 0 failed. Frontend
  `lint`, `build`, and `prerender` passed.
- `npm run check:vietnamese` passed across `src`, `server`, customer/agent
  docs, public assets, Nginx, and Compose configuration. It checks fatal UTF-8,
  unexpected BOM, NFC normalization, U+FFFD, and reviewed mojibake markers.
- `npm run check:customer-copy` passed across 49 Customer source files. It
  rejects reviewed no-diacritic UI phrases, legacy `UserDashboard` or
  `/api/user/` references in Customer UI, and demo/mock private copy.
- Customer copy now uses the typed Vietnamese modules under `src/i18n/vi/`,
  shared status labels under `src/utils/customerStatusLabels.ts`, and the
  `Be Vietnam Pro`, `Inter`, then system fallback stack. Customer CSS no
  longer uses negative heading letter spacing.
- Nginx declares `charset utf-8`; customer token emails include Vietnamese
  subject/body text, HTML escaping, and a plain-text link fallback without
  changing token paths or token semantics.
- Inventory remains five `LEGACY_UNRESOLVED` orders, two demo profiles, one
  mock eSIM, two mock manual QR records, and no persisted fulfillment or
  inventory data in the disposable target. No raw PII, QR, LPA, PIN, or PUK
  values are included in the inventory or handoff.
- Isolated QA was refreshed against the rebuilt PR15.8.1 image. The project
  `hico-pr15-8-check` remains running on frontend `5173`, backend `5000` and
  `5001`, PostgreSQL `5432`, and Mailpit `8025`; no `cuongdesign-*` container
  was changed. Health is `200` with current migrations, real mode, mock
  fallback disabled, and no blockers. The root response is
  `text/html; charset=utf-8` with the Vietnamese HICO title.
- The authenticated in-app browser tab is logged in as the disposable QA
  Customer account and was smoke-tested across the customer auth/account
  routes at desktop width 1280 with no horizontal overflow or console errors.
  The account snapshot shows Vietnamese navigation and empty states. A new
  password-reset message was delivered to Mailpit with subject `Đặt lại mật
  khẩu HICO`; token paths and message link semantics remain unchanged.
- Production remains `NO-GO`; this QA evidence does not waive PR14 launch
  blockers or enable loyalty/referral redemption.

## PR15.8.2 Canonical public catalog integrity handoff

- Public product resolution now follows `route slug -> public catalog API ->
  canonical product -> public canonical variants`. Public UI no longer reads
  `/api/admin/*`, legacy product maps, or a product-specific fallback.
- The confirmed root cause was the old ProductDetail path resolving an
  unmatched id through `getFallbackKey`, then mixing `COUNTRIES`,
  `FALLBACK_PACKAGES_MAP`, calculated `DATA_OPTIONS` prices, and Japan media.
  The device home section had the same risk because it rendered a hard-coded
  device list when `/api/admin/devices` failed.
- Canonical version: `catalog-4080debd5f765c41ca08`. Inventory contains 93
  products and 21,879 variants; 37 products and 9,775 variants are currently
  public after publish/readiness filtering. There are currently 0 canonical
  `device_sale` products and 0 canonical `topup` products, so those public
  routes show an explicit empty state and never invent a product, price, stock,
  image, or specification.
- Integrity report: no missing slugs, duplicate slugs, orphan variants, mixed
  currency products, invalid route mappings, Admin API references, or fallback
  references in the scanned public surface. Six public products lack a primary
  image; the media helper uses category-neutral assets and never uses
  `dest_japan.png` as a shared fallback. These media gaps remain Admin review
  items.
- Public cart items now carry `productId`, `variantId`, `slug`, `operation`,
  currency, and image snapshot. Checkout continues to validate trusted price,
  currency, active variant, stock, and fulfillment from canonical data; order
  statuses, fulfillment methods, currency values, customer ownership, and
  legacy data were not changed.
- Monitoring to add before production review: slug resolution failures,
  public product 404s, product/cart mismatch, checkout snapshot mismatch,
  device stock mismatch, SEO canonical mismatch, and hard-code scanner failures.
- Latest isolated QA after the 404/noindex fix: `/san-pham`, the Philippines
  canonical detail, `/diem-den/philippines`, `/thiet-bi`, `/nap-them`, and an
  unknown product slug were checked at desktop width 1280 with document width
  1274 and zero browser console errors. The unknown slug renders the explicit
  404 state with `noindex,nofollow`; the Philippines detail and coverage use
  the canonical Philippines product; device and top-up routes show an explicit
  empty state because their canonical public counts are zero.
- Public API QA returned a paginated catalog of 37 public products, a safe
  Philippines product projection with 184 public variants and no provider
  secret fields, and `404 PRODUCT_NOT_FOUND` for the unknown slug. Checkout
  health remains `503 CHECKOUT_NOT_READY` with only
  `PHYSICAL_INVENTORY_NOT_CONFIGURED`; the QA webhook secret is configured,
  but no physical inventory record was fabricated. Production remains
  `NO-GO` until real inventory and the remaining launch evidence are approved.

## PR15.8.2.1 Product Detail UI parity handoff

- UI baseline reference: `78a8a8f`, the last committed pre-customer-platform
  baseline containing the legacy Product Detail JSX/CSS. Baseline files are
  `src/components/ProductDetail/ProductDetail.tsx` and
  `src/components/ProductDetail/ProductDetail.css`; no baseline screenshot was
  committed in the repository, so parity evidence is recorded from the
  restored implementation and the legacy class inventory.
- The restored view keeps the legacy three-column structure, gallery and
  thumbnails, product header, rating/review area, feature grid, SIM/data/time
  selectors, quantity controls, add-to-cart/buy-now CTAs, quick benefits,
  technical/install/compatibility/review/FAQ tabs, description, stats and
  signup sections. `ProductDetail.tsx` now receives canonical data through
  `src/adapters/productDetailViewModel.ts` and keeps `selectedVariantId` as
  the selector source of truth.
- The adapter is presentation-only: it does not fetch, resolve routes, read
  Admin APIs, invent products/media/network/specs, or calculate prices. Cart
  entries retain canonical `productId`, `variantId`, `slug`, `operation`,
  currency and quantity semantics.
- Regression guard `npm run check:product-detail-parity` verifies the legacy
  section/class contract and blocks Japan fallback, legacy product maps and
  public Admin API references. `npm run check:catalog-hardcodes` now scans the
  adapter directory as well.
- Browser evidence after the isolated QA rebuild: Philippines detail rendered
  the restored sections at desktop 1280px with document width 1274 and no
  console errors. Selecting `1GB/ Ngày` changed the canonical selected
  variant with SKU `WM-PH-1GB` and Buy now opened the cart with the
  Philippines product and selected variant. At mobile 390px the Product
  Detail rendered all legacy layout regions with `scrollWidth` 385 and no
  horizontal overflow or console errors. The browser cache was refreshed
  against the rebuilt asset bundle before this check.
- The catalog remains canonical: Philippines is still the Philippines product,
  the API projection exposes only public safe fields, and no Japan fallback was
  restored. Device/top-up remain explicit empty states because canonical public
  counts are zero. Production remains `NO-GO`; this worktree is uncommitted.

## PR15.8.2.2 Admin -> public product contract audit handoff

- This worktree remains uncommitted by instruction. PR15.8.2.2 adds the contract matrix, hardcode inventory, data-gap report, public payload validator, Admin/public contract audit, and Product Detail hardcode gate.
- The public boundary now has one explicit allowlist serializer at `server/catalog/public/publicProductSerializer.js`; the legacy projection module re-exports that contract so catalog routes share the same fields. Provider IDs, tokens, secrets, QR/LPA/PIN/PUK, redemption codes, raw inventory and reconciliation/audit data are not public fields.
- Admin Product Wizard, canonical write validation, public TypeScript types, media handling and the Product Detail adapter now carry the same safe content, gallery, FAQ, shipping and device-specification contract. Missing type-specific data remains a recorded gap; no product fallback was added.
- New gates are `npm run audit:product-contract`, `npm run validate:public-products`, and `npm run check:product-hardcodes`. They print aggregate field/count findings only and do not write runtime reports or fixtures.
- Current data gap remains: 93 canonical products, 21,879 variants, 37 public products, 9,775 public variants, 0 public device products, 0 public top-up products, and six public products without a primary image. Physical inventory is still not configured; no checkout inventory was fabricated.
- QA must re-run the full frontend/backend/security/integrity gates and the public API -> Product Detail -> cart -> checkout round trip. Production remains `NO-GO` pending real device/top-up/physical data, inventory and the existing customer-platform launch blockers. No `cuongdesign-*` container is in scope.

## PR15.8.2.3 Admin Media Library normalization handoff

- Admin image inputs now use `MediaAssetField`, `MediaGalleryField` and the
  existing Media Library picker for Product Wizard, devices, destinations and
  articles. RichTextEditor inserts images through the same picker and no longer
  accepts a free-form image URL prompt.
- `server/media/mediaAssetRepository.js` provides the MediaAsset contract over
  the existing upload storage, with ACTIVE/ARCHIVED status, random upload names,
  MIME/signature checks and reference-aware deletion. Manual QR remains a
  private fulfillment exception and is not a public MediaAsset.
- Public catalog serialization resolves ACTIVE Media IDs and excludes private
  asset details. Legacy local image fields remain read-compatible pending an
  owner-approved migration; no runtime bulk rewrite or auto-delete was run.
- New gates: `npm run check:admin-media`, `npm run media:audit`, and
  `npm run media:validate`. The current QA snapshot checks 22,139 entities and
  146 media assets; it reports no external/data/private/missing/duplicate/broken
  reference, with 6 orphan assets queued for review only.
- Media contract and inventory are recorded in
  `docs/media/ADMIN_MEDIA_USAGE_INVENTORY.md`,
  `docs/media/MEDIA_LIBRARY_INTEGRATION_CONTRACT.md`, and
  `docs/media/MEDIA_REFERENCE_MIGRATION_REPORT.md`. Production remains
  `NO-GO` until owner review, full browser QA, and all Critical launch evidence
  are complete. No `cuongdesign-*` container is in scope.

## PR15.8.2.5A Live Sheet QA and closure handoff

- Baseline starting commit is `482ca8b` (`docs(customer): record PR15.7
  completion and PR15.8 handoff`). Canonical inventory is 93 products and
  21,879 variants; public inventory is 37 products and 9,775 variants.
- Catalog Sheet Sync is implemented as a read-only Sheet reference flow:
  parse, exact variant match, validation, preview, Admin approval, idempotent
  apply, canonical catalog commit and public Product Detail selection.
- Migration head is `013_catalog_sheet_sync.sql`. The migration includes
  batch/row constraints, status checks, unique source/apply keys and the
  batch-variant duplicate-target guard. No credential, token, raw Sheet
  snapshot, runtime report, backup, dump or Docker volume is committed.
- Automated gates passed: lint, build, prerender, 195/195 backend tests,
  security, integrity, UTF-8/mojibake, public catalog validation and the Sheet
  Sync parser/matcher/idempotency tests.
- Automated idempotency passed for a repeated apply, including the atomic
  apply claim. Multi-instance concurrency and transaction rollback against a
  live two-backend topology were not run in this QA window.
- Browser QA passed for Admin Sheet Sync in the unconfigured state on desktop
  and mobile. Product Detail rendered multiple canonical variants on desktop;
  selecting `500MB/ Ngay SIM vat ly` and adding it to the cart succeeded. The
  public payload contained no provider ID, provider cost, batch or raw-row
  fields.
- Live Google Sheet QA is `BLOCKED`: the QA environment has no
  `CATALOG_SHEET_*` configuration or read-only Google credential. No fake live
  batch result is recorded. Therefore batch ID, rows read, matched, conflicts,
  errors and applied counts are `N/A`; the required two-variant live evidence
  must be run after an owner-approved read-only credential is supplied.
- Docker QA project `hico-pr15-8-sheet-sync` was stopped after verification;
  only the existing `cuongdesign-*` containers remain running. Production stays
  `NO-GO` until live Sheet evidence, owner approval and the remaining launch
  blockers are closed.
- This worktree still contains unrelated uncommitted PR15 changes. No mixed
  PR15.8.2.5A commit was created because doing so would violate the scoped
  commit requirement. Final commit SHA remains pending a clean scope review.
- Closure scope inventory: Sheet-only files are the `server/catalog/sheetSync/`
  modules, migration 013, `CatalogSheetSync`, Sheet Sync API/types, tests and
  runbooks. Shared mixed-hunk files are `server/hicoBackend.js`, the catalog
  router/service, `AdminDashboard`, Product Detail and the public
  serializer/view-model wiring. Unrelated changes cover the remaining
  customer, media, SEO, wizard and legacy cleanup files. No files are staged;
  no runtime artifact, dump, volume, local `.env` or credential is included.

## PR15.8.2.5B Google Sheet settings and credential management handoff

- The Admin Settings contract is implemented for read-only Google Sheet
  catalog reference configuration. It provides masked GET/PUT settings,
  credential replace, connection test, credential revoke and preview routes
  under `/api/admin/settings/integrations/google-sheet`.
- Migration head for this scope is `014_catalog_sheet_integration_settings.sql`.
  It stores encrypted service-account JSON and safe metadata only, uses
  optimistic version checks, records safe integration events, and seeds the
  separate settings/test/preview/apply permissions. Migration 013 is not
  modified.
- Credential encryption uses AES-256-GCM and requires
  `INTEGRATION_SETTINGS_ENCRYPTION_KEY`. The backend uses PostgreSQL for
  persistence; when PostgreSQL is unavailable the settings API returns a safe
  503 instead of keeping credentials in process memory. Environment fallback
  remains read-only and is never automatically copied into Admin Settings.
- Frontend credential text is temporary component state only. It is cleared
  after successful actions and is not written to browser storage, URL state,
  HTML, GET responses, logs, or audit metadata. New UI uses CSS classes and
  responsive states.
- Targeted verification passed: `npm run lint`, backend targeted integration
  tests (3 matching tests; the Node test runner loaded 63 files), and syntax
  checks for all new Google Sheet modules. Full build/prerender/backend and
  live database gates remain pending in this worktree.
- Live Google Sheet QA is `BLOCKED`: no owner-approved read-only service
  account credential is available. No fake connection, row count, preview, or
  apply evidence is recorded. Production remains `NO-GO`.
- This worktree still contains unrelated uncommitted PR15 changes and shared
  mixed-hunk files. No PR15.8.2.5B commit was created; no runtime artifact,
  backup, dump, Docker volume, local `.env`, or credential is in scope. A
  scoped commit requires a clean patch review after the shared files are
  separated.

## PR15.8.2.5B.1 Google Sheet credential guide handoff

- Added `src/components/Admin/Settings/Integrations/GoogleSheetCredentialGuide.tsx`
  as a separate copy-only guide. `GoogleSheetSettings.tsx` mounts it inside
  the Google Sheet Catalog Settings surface without moving credential state or
  API logic into the guide.
- The guide contains nine expandable steps: Google Cloud Project, Sheets API,
  Service Account, JSON key, direct Sheet sharing, Spreadsheet ID, tab/range,
  HICO form setup, and connection test. It explicitly requires Sheet Viewer
  access, prohibits Editor/Owner/Anyone-with-the-link, prohibits writeback,
  and includes safe links with `noopener noreferrer` and no query secrets.
- Error copy maps credential invalid, permission denied, not found, invalid
  range, invalid header, decrypt failure, and rate limit codes. The guide
  contains no credential state, API import, fetch call, raw JSON, private-key
  sample, or browser storage access. File input and temporary credential state
  are cleared by the existing Settings flow after successful save/rotate.
- Accessibility/UI evidence: accordion buttons expose `aria-expanded` and
  `aria-controls`, steps are keyboard buttons with visible focus states,
  warnings use icon plus text, external links have explicit labels, and the
  stylesheet includes a 390px responsive layout with no fixed-width overflow.
- Copy/security gates passed: `npm run check:google-sheet-guide`,
  `npm run check:vietnamese`, `npm run lint`, and `npm run build` (including
  prerender). The guide scanner checks all nine steps, required Viewer/error
  copy, UTF-8/NFC, safe links, and forbidden secret/API patterns.
- Browser QA was attempted on a temporary Vite server at port 5174. The
  Admin route correctly redirected to `/quan-tri/dang-nhap`; desktop/mobile
  guide interaction, upload, test, revoke, and Network checks remain pending
  an authorized Admin session and an owner-approved read-only Google
  credential. No credential was entered and no Docker container was started.

## PR15.8.2.5B.2 Authorized Admin and live Google Sheet QA status

- QA is `BLOCKED` before Docker startup because no QA `.env` is present and
  the required owner-approved inputs are missing: an authorized Admin QA
  session/account with the five catalog Sheet permissions, a QA-only
  `INTEGRATION_SETTINGS_ENCRYPTION_KEY` shared by both backend instances, a
  read-only Service Account credential, and the approved Spreadsheet ID, tab,
  range, and header row.
- No password, MFA code, Google credential, encryption key, production
  database, or legacy runtime credential was guessed, read from source, or
  entered. No Docker project was started and no `cuongdesign-*` container was
  touched.
- The required QA project remains `hico-pr15-8-sheet-live` with the `qa`
  profile for backend-secondary. Once the owner supplies the QA inputs, run
  the live evidence chain and teardown with `docker compose -p
  hico-pr15-8-sheet-live down -v`; never use that teardown against
  `cuongdesign-*` containers.

## 2026-08-05 HICO Docker QA, Worldmove test and Google Sheet handoff

- User confirmed Worldmove is a test/QA account and confirmed the Google Sheet
  was shared to the service account as Viewer. Created local `D:\Hico\.env`
  from `.env.example`; generated QA-only PostgreSQL, session, CSRF, customer
  and integration encryption secrets; reused the existing Worldmove test
  credential from `server/uploads/api_config.json`; did not print secrets.
- Google Sheet metadata discovery is still `BLOCKED`. The repo has
  `service-account.json` for `sheethico@sheetapi-475915.iam.gserviceaccount.com`,
  but no Spreadsheet ID is present in repo or referenced chat. OAuth token
  minting succeeded, while Drive spreadsheet listing returned `DRIVE_403`.
  Without Spreadsheet ID, Sheets API cannot safely infer tab/range/header row.
- Docker QA used project `hico` with a temporary port override because an
  existing HICO QA project already owns ports 5432, 5000 and 5173. Effective
  ports were database `15432`, backend `15000`, frontend `15173`, mailpit
  `18025`. Build completed, migration completed through
  `014_catalog_sheet_integration_settings.sql`, backend health returned
  `{"status":"alive"}`, and frontend returned HTTP 200.
- Checkout readiness is `BLOCKED` by existing data/setup, not by Worldmove
  credential: `/api/health/checkout` returned `503 CHECKOUT_NOT_READY` with
  blocker `PHYSICAL_INVENTORY_NOT_CONFIGURED`.
- Worldmove live QA is `BLOCKED` by provider TLS. Calling
  `/Api/QuoteMg/myQueryAll` from the backend container with the QA credential
  failed before an HTTP response with `CERT_HAS_EXPIRED` for both the configured
  HTTPS URL and the HTTP URL after redirect. TLS verification was not bypassed.
- Admin Google Sheet/provider routes returned `401` without an authorized
  Admin session, so no settings were saved, no credential was uploaded through
  Admin UI, no Sheet preview/apply was created, and no production credential or
  production database was used.
- Teardown command for this run is `docker compose -p hico down` only. Do not
  use `down -v` for this QA cleanup, and do not stop unrelated projects such as
  `hico-pr15-8-check-*` or `cuongdesign-*` unless the owner explicitly asks.

### 2026-08-05 Docker cleanup addendum

- After the `hico` QA project was stopped, two pre-existing Docker Compose
  projects from `D:\Hico` were still running and holding HICO ports/RAM:
  `hico-pr15-8-sheet-sync` and `hico-pr15-8-check`. Both were stopped with
  `docker compose -p <project> down` and no `-v`. `cuongdesign-*` containers
  were not touched.

## 2026-08-05 PR15.8.2.5B.3 Sheets API-only connection discovery

- Scope: Google Sheet Catalog integration only. Existing mixed worktree preserved; no broad staging or commit performed.
- Google auth: Service Account credential path retained server-side; OAuth scope is `https://www.googleapis.com/auth/spreadsheets.readonly` only.
- Drive API calls/scopes in Sheet integration: 0. Added `scripts/check-google-sheet-no-drive-dependency.mjs`; scanner PASS across 27 files.
- Backend patch: added Sheets-only metadata/header/range discovery service and client interface (`getSpreadsheet`, `getValues`), sanitized metadata, GRID-only tabs, quoted A1 tab names, bounded header sample, contract validation, safe range validation, and Admin routes `/discover`, `/discover-header`, `/validate-range`.
- Security: discovery responses contain masked spreadsheet id only; no credential/private key/access token; discovery does not save settings. Admin auth remains enforced by the existing `/api/admin` middleware.
- Automated QA: 9 Google Sheets integration tests PASS; frontend `npm run build` PASS; prerender generated 114 routes; `git diff --check` PASS for scoped files.
- Docker QA: project `hico-pr15-8-sheet-live` built successfully. Backend, database, frontend and mailpit became healthy; backend health 200, frontend 200, unauthenticated discovery route 401. Project was torn down with `down -v`; only `cuongdesign-*` containers remain running.
- Live Google Sheet discovery: NOT RUN. The final owner-confirmed Spreadsheet ID was not available in repo/thread, and Drive metadata discovery returned `DRIVE_403`; no ID/tab/range/header was guessed.
- Live Sheet batch, multi-instance, rollback: NOT RUN, blocked by missing final Spreadsheet ID and therefore no safe Sheet read.
- Worldmove live QA: `BLOCKED_CERT_EXPIRED`; TLS verification was not bypassed.
- Checkout readiness: `BLOCKED_EXPECTED` (`PHYSICAL_INVENTORY_NOT_CONFIGURED`, HTTP 503); no fake inventory created.
- Production: NO-GO.
- Commit: not created; worktree contains mixed pre-existing changes and scoped files remain uncommitted.

### Final verification addendum

- Backend suite: 204/204 tests PASS.
- `check:google-sheet-guide`: PASS.
- `check:vietnamese`: PASS.
- `.env`: local ignored file remains present; no secret values were printed or added to handoff.
- No commit created because the worktree has mixed unrelated changes and the B.3 patch was not staged as an isolated chain.

### 2026-08-05 Live Spreadsheet ID QA evidence

- Spreadsheet ID supplied by owner: `1jUpDnzSPegi0VrXWPmVxhGqYl3H6gBuHr6fCY5HsUmc` (handoff mask: `1jUp…5sUmc`).
- Service Account Viewer check: PASS. Sheets-only `spreadsheets.get` metadata and bounded `values.get` reads succeeded; no Drive API/scope was used.
- Spreadsheet title: `SDL DL.HICO.VN`. GRID tabs discovered: 9. Tabs included `Sim HICO`, `HICO GỐC`, `product-sim4g`, `web đặt đơn`, `giao diện báo giá`, `giao diện esim`, `wm id goc`, `cs sỉ`, and `topup sẵn`.
- Admin discovery/header flow: metadata discovery PASS; header contract discovery FAIL. Row 1 of the catalog-looking tabs contains business headers such as `Loại data`, `Giá eSim`, `APN`, `Quốc gia/ nhà mạng`, and `Ghi chú`; `wm id goc` contains `WM Product ID` but no `variant_id` or `product_slug + sku` exact-match key.
- Selected tab/range/header: none. No tab/range/header was guessed and no source header was renamed. Live Sheet Sync was not started because exact variant matching cannot be proven from this workbook.
- Live batch, two-variant field parity, preview/approval/apply, repeat idempotency, multi-instance, Product Detail/Public API/Cart: BLOCKED by source contract mismatch. No Sheet writeback occurred.
- Transaction rollback: not run against the live Sheet because there was no safe valid batch; existing atomic catalog commit/unit rollback evidence remains PASS from the backend suite.
- Admin QA credentials were generated only in ignored local `.env`; no credential/token/private key was written to the handoff or response.
- Worldmove live QA remains `BLOCKED_CERT_EXPIRED`; TLS was not bypassed. Checkout remains `BLOCKED_EXPECTED` (`PHYSICAL_INVENTORY_NOT_CONFIGURED`). Production remains `NO-GO`.

## 2026-08-05 PR15.8.2.5B.4 Native Sim HICO live QA evidence

- Native parser and contract support were added for the exact `Sim HICO` headers: `SKU SVL`, `SKU ESIM`, `Giá Sim`/newline form, `Giá eSim`/`Giá eSIM`, `wmid_sim`, `wmid_esim`, `APN`, `Quốc gia/ nhà mạng`, `Ghi chú`, `Ngày`, and `Loại data`. Each populated medium is emitted as an independent candidate with `sourceRow`, `sourceMedium`, and `sourceSku`; matching remains normalized SKU plus canonical medium and never uses WMID as an identity key.
- The Sheets-only Admin flow completed with masked evidence: spreadsheet `1jUp...5sUmc`, title `SDL DL.HICO.VN`, exact tab `Sim HICO`, header row `1`, native contract `SIM_HICO_NATIVE`, 42 columns, and bounded range `A1:AP20`. Service-account Viewer credential was accepted by the Admin connection test. No Drive API, Sheet writeback, raw credential, token, or raw row snapshot was used.
- Live preview completed successfully after the native PostgreSQL row-number mapping fix. It read 19 data rows and produced 19 candidates: `esim=19`, `physical_sim=0`; parser error count was zero. The physical side was not emitted because the native `SKU SVL` cells in the bounded sample did not contain a populated SKU.
- Exact matching correctly stopped the batch: `matched=0`, `distinctVariantCount=0`, all 19 candidates were `UNMATCHED_VARIANT`. Approval/apply, repeat idempotency, multi-instance concurrency, and live transaction rollback were not run because the two-distinct-variant guard was not satisfied. No catalog mutation or Sheet writeback occurred. Unit/backend coverage for apply idempotency and atomic rollback remains PASS.
- Product Detail and Public Catalog API smoke returned HTTP 200. Cart/checkout validation returned the expected HTTP 503 `CHECKOUT_NOT_READY`; no physical inventory was fabricated. Worldmove test sync returned HTTP 502 connection failure; TLS verification was left enabled and no bypass was used.
- Automated verification after B.4: backend `208/208` PASS; frontend build and prerender `114` routes PASS; native contract scanner PASS; Sheets no-Drive scanner PASS; Vietnamese encoding PASS; Sheet guide scanner PASS; `git diff --check` PASS. No migration 015 was added and no mixed-hunk commit was created.
- The isolated project `hico-pr15-8-sheet-live` was used for this evidence and must be torn down with `docker compose --profile qa -p hico-pr15-8-sheet-live -f docker-compose.yml -f work/hico-pr15-8-sheet-live.override.yml down -v`. `cuongdesign-*` containers are outside scope. Production remains `NO-GO` pending an owner-reviewed catalog SKU mapping and the existing launch blockers.

## 2026-08-06 PR15.8.2.5B.6 Authorized live identity mapping and closure QA

- Runtime QA stop condition reached before startup: `docker version` returned `BLOCKED_DOCKER_PERMISSION` because the Docker API named pipe was inaccessible. Docker context was `default`, Docker Compose was detected, and `docker compose config --quiet` parsed the compose configuration without starting containers; the Docker warning about the local config file did not grant runtime access.
- No Docker project was started, no migration was applied at runtime, no Admin login was attempted, no Google Sheet was read, no alias was created, and no HICO or `cuongdesign-*` container/volume/network was touched in B.6. No teardown was needed because this task did not start the QA project.
- B.5 offline baseline remains: backend `211/211` PASS, lint/build/prerender PASS, Vietnamese encoding PASS, native Sheet contract scanner PASS, identity scanner PASS. B.6 live evidence remains pending: migration 015 runtime, Admin auth, two alias mappings, re-preview, apply/repeat, alias/batch concurrency, rollback, Product Detail A/B, public leak scan, and cart.
- Offline B.6 checks on 2026-08-06: `security:gate` PASS, `integrity:check` PASS, `public-catalog:validate` PASS with the existing six missing-primary-image findings, `git diff --check` PASS, tracked sensitive filename scan `0`, tracked private-key marker scan `0`. `npm audit --omit=dev` was not completed because the npm advisory endpoint returned an error; this is recorded as an external audit-service blocker, not as a clean audit result.
- Production remains `NO-GO`. Resume B.6 only after Docker API permission is restored; do not bypass Windows security, use another project, or touch `cuongdesign-*` resources.

## 2026-08-05 PR15.8.2.5B.5 Canonical variant identity reconciliation

- Added migration `015_catalog_variant_external_aliases.sql` with uniqueness on namespace, normalized external key, and medium; REVOKED aliases remain as history and remap/revoke operations use optimistic version checks. Exact retries for the same active target are idempotent.
- Repository audit found no reusable external-alias store and no PostgreSQL canonical variant table. Canonical variants remain versioned JSON, so alias targets are validated against the active canonical snapshot in service-level logic; no fake foreign key was added. Provider offer links remain reusable suggestion evidence only.
- Added canonical-first identity resolution: direct Sheet SKU plus medium, then ACTIVE alias plus medium, then unmatched. Direct/alias disagreement returns `IDENTITY_CONFLICT`; WMID is never a runtime variant key and fuzzy matching is absent.
- Added admin-only bounded reconciliation report and explicit confirmation UI/API. The report is safe for admin use and excludes raw Sheet rows, provider tokens, credentials, and private key material. New permissions are `catalog.sheet.reconcile.read` and `catalog.sheet.reconcile.write`.
- Automated evidence after B.5 implementation: backend suite `211/211` PASS, targeted Sheet Sync and alias tests `9/9` PASS, frontend `npm run build` and prerender PASS, lint PASS, identity scanner PASS, native Sheet contract scanner PASS. Live bounded remap QA remains pending.
- Docker was not started for B.5. Production remains `NO-GO`; live preview, mapping of the two owner-confirmed variants, apply/repeat/multi-instance/rollback, Product Detail/Public API/cart verification require an authorized Admin QA session and must be followed by Docker teardown.

## 2026-08-06 PR15.8.2.5B.6 Authorized live identity mapping and closure QA

- Docker context: `desktop-linux`. The only QA Compose project was
  `hico-pr15-8-sheet-identity` from `D:\Hico`, started with
  `docker compose -p hico-pr15-8-sheet-identity up --build -d`. No
  `cuongdesign-*` container, volume, network, or project was touched.
- Runtime startup passed: PostgreSQL became healthy, migration
  `015_catalog_variant_external_aliases.sql` was applied, backend became
  healthy on port `5000`, frontend was reachable on port `5173`, and Mailpit
  became healthy on port `8025`. Admin login passed with the local QA
  bootstrap account; credentials are not recorded here.
- Admin Google Sheet settings used the owner-approved Viewer credential and
  the bounded reference `1jUp…sUmc`, title `SDL DL.HICO.VN`, tab `Sim HICO`,
  range `A1:AP20`, header row `1`, reference-only mode, and approval required.
  Settings save, credential replace, metadata discovery, header discovery,
  range validation, and connection test passed. This run's discovery returned
  38 header columns; the earlier B.4 handoff recorded 42, so that count still
  needs reconciliation before production use.
- Baseline preview read 19 candidates: `eSIM=19`, `physical_sim=0`, with no
  identity matches before alias confirmation. The admin reconciliation report
  then confirmed only the two owner-authorized mappings: `Esim0481 -> var-1032`
  and `Esim0482 -> var-1033`, both in namespace `SIM_HICO_SKU_ESIM`, with
  WMID used only as bounded admin evidence. No raw Sheet row, credential,
  provider token, or private key was written to this handoff.
- Re-preview after alias persistence was idempotent and resolved both target
  rows to their canonical variants. The rows remained `INVALID` because the
  QA runtime has no matching active Worldmove provider-offer snapshot; both
  returned `PROVIDER_NOT_FOUND`. The batch therefore has `0` valid and `19`
  invalid rows. No apply request was sent, because applying invalid rows would
  not be a valid catalog mutation and no provider data was fabricated.
- Stop condition: `BLOCKED_PROVIDER_OFFER`. Apply, repeat apply,
  multi-instance/concurrency, live rollback, Product Detail A/B, public leak
  scan, and cart verification were not run after this blocker. Prior
  Worldmove QA remains `BLOCKED_CERT_EXPIRED`/connection failure with TLS
  verification enabled; no TLS bypass was used. Checkout remains blocked by
  the existing physical-inventory readiness condition.
- Offline verification recorded for this worktree: backend `211/211` tests,
  lint, build, prerender, Sheet identity scanner, native Sheet contract
  scanner, Vietnamese encoding, `security:gate`, `integrity:check`, and
  public catalog validation passed. Public catalog validation still reports
  the existing six missing-primary-image findings. `npm audit --omit=dev`
  remains unresolved because the npm advisory endpoint returned an error.
- Mandatory teardown completed after the blocked QA run with
  `docker compose -p hico-pr15-8-sheet-identity down -v --remove-orphans`.
  Verification: HICO QA `compose ps` has zero containers; `docker compose ls`
  shows only the existing `cuongdesign` project; `cuongdesign-web`,
  `cuongdesign-ai-worker`, and `cuongdesign-db` remain running and unchanged.
  Old HICO images were retained. Production remains `NO-GO` until the
  provider-offer snapshot and all remaining closure checks are completed.

## PR15.8.2.5B.7 Provider offer snapshot reconciliation preflight

- Read-only repository audit: the provider repository reads
  `server/uploads/provider_offers.json`; the HICO Compose backend mounts
  `server/uploads` at `/app/uploads`. The host snapshot file was absent, so
  the previous `PROVIDER_NOT_FOUND` result is caused by a missing repository
  snapshot, not by an incorrect WMID resolver lookup.
- Resolver audit: Sheet Sync resolves an offer only by exact equality of
  `offer.wmproductId` and the normalized Sheet WMID. No price, product name,
  Sheet row number, fuzzy match, or runtime WMID-as-variant-key fallback is
  used. The canonical catalog contains `WM-e-CN-500MB-1D` on `var-1032` and
  `WM-e-CN-500MB-2D` on `var-1033`; both currently have no provider-offer ID.
- Read-only workbook scan used Spreadsheet `SDL DL.HICO.VN`, tab `wm id goc`,
  through the Sheets API with the owner-provided Viewer credential and no
  Drive scope. The scan covered the full used grid, not a guessed row range.
  Exact-match preview found `WM-e-CN-500MB-1D` twice with identical provider
  payloads and found zero occurrences of `WM-e-CN-500MB-2D`. The duplicate
  source occurrences are not silently deduplicated into a persisted snapshot.
- Gate result: `BLOCKED_PROVIDER_SNAPSHOT_SOURCE_INCOMPLETE`. No provider
  snapshot was written, no Sheet writeback was attempted, no Worldmove API
  sync/live QA was claimed, and no Docker project was started. Admin
  confirmation remains required before any approved snapshot persistence; the
  missing exact `WM-e-CN-500MB-2D` source and the duplicate `1D` source policy
  must be resolved first.
- B.6 closure was not rerun because the required two-provider-match gate was
  not satisfied. `cuongdesign-*` was not touched. Production remains `NO-GO`.

## PR15.8.2.5B.7.1 Mirrored provider reference deduplication

- Added the read-only provider reference discovery utility at
  `server/providers/providerReferenceDiscovery.js` and the CLI
  `npm run provider:reference:audit`. It groups by exact normalized WMID and
  compares only a normalized provider payload; source block/row references are
  evidence metadata and never identity keys.
- Identical mirrored payloads now produce one logical candidate with status
  `DUPLICATE_IDENTICAL_COLLAPSED`. Different payloads produce
  `PROVIDER_AMBIGUOUS` with no logical candidate. An absent WMID remains
  `PROVIDER_NOT_FOUND`.
- Read-only audit against `SDL DL.HICO.VN`, tab `wm id goc`, range `A:AZ`
  returned `WM-e-CN-500MB-1D` as `DUPLICATE_IDENTICAL_COLLAPSED` with two
  occurrences and `WM-e-CN-500MB-2D` as `PROVIDER_NOT_FOUND`. The preview
  reported `persisted=false`, `sheetWriteback=false`,
  `worldmoveLiveQa=false`, and `requiresAdminConfirmationBeforePersist=true`.
- No provider snapshot was written. No Product ID, metadata, price, name, or
  row position was inferred for `WM-e-CN-500MB-2D`; it remains blocked until
  the workbook contains an official exact provider row. Admin confirmation is
  still mandatory before any future snapshot persistence.
- Verification: provider reference unit tests `4/4` PASS, `npm run lint`
  PASS, and Vietnamese UTF-8/NFC check PASS. Docker remained OFF and
  `cuongdesign-*` was not touched. B.6 closure remains pending the second
  exact provider match; production remains `NO-GO`.

## 2026-08-08 PR15.8.2.5B.8 Provider fulfillment fallback strategy

- Added migration `016_catalog_variant_fulfillment_bindings.sql`. It keeps
  `CatalogVariant`, `FulfillmentBinding`, and `ProviderOffer` separate,
  enforces one ACTIVE binding per variant/provider, retains REVOKED history,
  and adds versioned Admin mapping events. Migrations `015` and earlier were
  not modified.
- Added server-side fulfillment domain files under
  `server/catalog/fulfillment/`: family compatibility, exact/mapped/next-longer
  resolver, binding repository/service/router, provisioning entitlement
  validation, and margin policy. Resolver order is exact, approved mapped
  fallback, then the smallest strictly longer compatible duration. Shorter,
  fuzzy name/price/row, fake WMID, client provider selection, and ambiguous
  candidates are blocked.
- Worldmove requests now use `providerWmproductId` from the resolved provider
  snapshot. Order item snapshots preserve sold variant/SKU/duration/price/
  currency separately from provider offer ID, actual WMID, provider duration,
  strategy, upgrade days, binding version, and snapshot hash. Public catalog
  serializers are not widened with provider/binding identifiers.
- Added Admin-only fulfillment preview and approve/change/revoke UI/API with
  CSRF, explicit confirmation, optimistic version checks, strategy/warning/
  margin display, and no public exposure. Added backup/restore coverage for
  fulfillment binding tables.
- Verification: root lint PASS, root build/prerender PASS (`114` routes),
  targeted resolver/binding/snapshot/callback tests PASS, full backend suite
  `224` tests with `224` PASS, `security:gate` PASS after the minimal
  `nanoid` lockfile remediation, `integrity:check` PASS, public catalog
  validation PASS, Vietnamese/Sheet contract/identity scanners PASS, and
  `docker compose config --quiet` PASS.
- Isolated runtime QA used only project `hico-pr15-8-sheet-identity`.
  Migration 016 applied and reported current; backend health, frontend,
  Mailpit, Admin login, and authenticated fulfillment preview returned `200`.
  The preview remained read-only because the current provider snapshot lacks
  the explicit metadata needed for a valid mapping; no binding was persisted,
  no Worldmove live QA was claimed, and no Sheet writeback occurred.
- Mandatory teardown completed with
  `docker compose -p hico-pr15-8-sheet-identity down -v --remove-orphans`.
  The project has zero containers and zero volumes afterward; `docker compose
  ls` shows only the pre-existing `cuongdesign` project, whose three
  containers and ports remained unchanged. B.6 closure, Admin mapping
  persistence, and live Worldmove status remain pending complete provider
  metadata. Production remains `NO-GO`.

## 2026-08-10 PR15.8.2.5B.9 Round B provider snapshot and closure QA

- Docker preflight passed with context `desktop-linux`. Only the Compose project
  `hico-pr15-8-sheet-identity` from `D:\Hico` was started. The initial database
  healthcheck needed one retry; migrations `001` through `016` then completed
  with status `current`. Backend health, frontend, Mailpit, and Admin login
  passed.
- The owner-authorized Viewer credential was configured through the encrypted
  Admin Google Sheet settings flow. The integration remained reference-only,
  approval-required, and writeback-disabled. `Sim HICO!A1:AP20` returned 19
  candidates. The two Admin alias writes were authorized and created:
  `Esim0481 -> var-1032` and `Esim0482 -> var-1033`.
- Read-only provider re-audit against `wm id goc` found exact mirror collapses
  for both `WM-e-CN-500MB-1D` and `WM-e-CN-500MB-3D`, each with two identical
  source references. The owner-authorized QA persistence created exactly two
  active logical snapshots with their real provider product IDs and source
  hashes. `WM-e-CN-500MB-2D` was not persisted. The runtime snapshot file was
  removed after teardown and no Sheet writeback or Worldmove live QA occurred.
- The B.8 resolver remained blocked after snapshot persistence. Both target
  variants lack the explicit provider family and still carry legacy
  `MANUAL_PROCESSING`, `supplier=other`, `leSIM=false`, and `needsReview=true`
  metadata. Preview returned `PROVIDER_FAMILY_MISMATCH` for both targets. The
  Sheet preview remained fail-closed with 19 invalid rows: 1D returned
  `PROVIDER_OPERATION_MISMATCH` and 2D remained `PROVIDER_NOT_FOUND` because
  exact 2D is intentionally absent. Apply was not attempted.
- Public catalog leak scan returned zero forbidden provider, admin, credential,
  or secret keys. Checkout health remained HTTP 503 and customer health was not
  production-ready. Product Detail, cart, order snapshot, callback, idempotency,
  concurrency, rollback, and Worldmove live tests were not run after the
  mandatory resolver stop.
- Mandatory teardown completed with
  `docker compose -p hico-pr15-8-sheet-identity down -v --remove-orphans`.
  HICO QA containers and volume are zero afterward; `cuongdesign-*` remained
  unchanged. Evidence is recorded in
  `docs/agent/HICO_PR15_8_2_5B_9_PRODUCTION_READINESS_EVIDENCE.md`.
- Final decision: `BLOCKED`; Production remains `NO-GO`. The next implementation
  must define explicit canonical family metadata and a safe 2D-to-3D fallback
  apply contract before B.6/B.9 closure can resume. No metadata was guessed and
  no fake 2D provider offer was created.
