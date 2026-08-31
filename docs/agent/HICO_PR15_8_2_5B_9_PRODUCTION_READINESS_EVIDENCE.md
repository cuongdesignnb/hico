# HICO PR15.8.2.5B.9 Production Readiness Evidence

Date: 2026-08-10
QA mode: Round A discovery closure plus Round B isolated QA
Release SHA: 482ca8b
Branch: codex/pr15.1-customer-identity
Worktree clean: NO

## Final Decision

FINAL DECISION: BLOCKED

PRODUCTION DECISION: NO-GO

The discovery and Round B runs produced useful evidence, but Production
certification cannot pass on this dirty mixed worktree. Round B also stopped at
the resolver and Sheet apply gates because the current canonical targets do not
carry the explicit Worldmove fulfillment family required by B.8.

Critical blockers:

- The worktree contains mixed tracked and untracked changes from multiple PRs.
- `service-account.json` is untracked and was not staged, committed, printed, or
  included in any artifact.
- Provider snapshots are absent from the local repository. The exact Sheet rows
  for 1D and 3D were found, but persistence was deliberately not attempted.
- The Admin confirmation required before persisting provider snapshots was not
  received in this QA round.
- The two target variants returned `PROVIDER_FAMILY_MISMATCH` while the provider
  snapshot repository is empty.
- Customer inventory still reports demo mode and unresolved legacy ownership.
- Full `npm audit` reports frontend and backend advisories.
- Round B resolver and Sheet apply are fail-closed: no catalog mutation or order
  was created from invalid provider evidence.

## Release And Scope Evidence

This was a read-only discovery and runtime QA round. No provider snapshot, catalog
binding, Sheet writeback, Worldmove purchase, or fulfillment mutation was made.

The release candidate requirements were not met:

- exact release SHA on a clean worktree: NOT MET
- scoped release commits: NOT MET
- full critical gate matrix on a clean release candidate: NOT RUN
- production approval: NOT GRANTED

## Google Sheet Read-Only Audit

Source:

- Spreadsheet ID: `1jUp...sUmc`
- Provider tab: `wm id goc`
- Read range: `A1:AZ6340`
- Access path: Google Sheets API values read only
- Drive API: not used
- Sheet writeback: `false`
- Persisted: `false`
- Worldmove live QA: `false`

Provider discovery results:

| WMID | Status | Occurrences | Logical candidate | Source refs |
| --- | --- | ---: | --- | --- |
| `WM-e-CN-500MB-1D` | `DUPLICATE_IDENTICAL_COLLAPSED` | 2 | `LeSIM-wm00830001`, 1 day, ESIM, Mainland China | `O1362`, `B1407` |
| `WM-e-CN-500MB-3D` | `DUPLICATE_IDENTICAL_COLLAPSED` | 2 | `LeSIM-wm00830003`, 3 days, ESIM, Mainland China | `O1363`, `B1408` |
| `WM-e-CN-500MB-2D` | `PROVIDER_NOT_FOUND` | 0 | none | none |

The two mirror blocks for each found WMID have identical normalized payloads and
were collapsed into one logical candidate. No fuzzy match, name match, price
match, row-number match, Product ID inference, or 1D metadata copy was used.

## Runtime And Migration

QA project: `hico-pr15-8-sheet-identity`

- Docker image build: PASS
- database health: PASS after the initial healthcheck wait
- migrations: PASS, `001_admin_users.sql` through
  `016_catalog_variant_fulfillment_bindings.sql`, status `current`
- backend `/api/health`: HTTP 200
- frontend `/`: HTTP 200
- Mailpit health API: HTTP 200
- unauthenticated Admin fulfillment preview: HTTP 401 `AUTH_REQUIRED`
- Admin bootstrap login: HTTP 200
- authenticated fulfillment preview: HTTP 200, 500 bounded items

Target variant preview before any provider persistence:

| Variant | SKU | Resolver code | Binding | Provider offer | Exact | Next longer |
| --- | --- | --- | --- | --- | --- | --- |
| `var-1032` | `8fb3a7ef` | `PROVIDER_FAMILY_MISMATCH` | `UNBOUND` | absent | absent | absent |
| `var-1033` | `cf3b033f` | `PROVIDER_FAMILY_MISMATCH` | `UNBOUND` | absent | absent | absent |

## Offline Gates

Passed in the current worktree:

- `npm run lint`
- `npm run build`
- `npm run prerender`
- `npm --prefix server test`: 224 passed, 0 failed
- `npm run security:gate`
- `npm run integrity:check`
- `npm run check:vietnamese`
- `npm run check:sim-hico-sheet-contract`
- `npm run check:sheet-variant-identity`
- `npm run check:google-sheet-no-drive`
- `npm run audit:product-contract`
- `npm run check:catalog-hardcodes`
- `npm run check:product-hardcodes`
- `npm run check:product-detail-parity`
- `npm run check:admin-media`
- `npm run check:customer-copy`
- `npm run validate:public-products`
- `docker compose -p hico-pr15-8-sheet-identity config --quiet`
- `git diff --check` found no whitespace errors; Git emitted only line-ending warnings

Known non-blocking validation findings that still need release disposition:

- public catalog validation reports six products without a primary image
- media validation reports legacy-local image references and six orphan media assets
- the catalog currently contains only `new_subscription` public products; no top-up
  or device-sale representative product exists in the checked source

## Security, Ownership, And Demo Inventory

The aggregate inventory was safe and did not emit raw values:

- customer mode: `demo`
- customer profiles: 2 demo profiles
- legacy unresolved orders: 5
- ownership classification: all 5 orders remain `LEGACY_UNRESOLVED`
- mock eSIM: 1
- mock manual QR: 2
- persisted fulfillment rows: 0
- persisted inventory rows: 0
- persisted inventory movement rows: 0
- authentication localStorage keys: 0
- unscoped endpoint finding: `GET /api/user/orders`
- hard-coded sensitive values: 0
- raw credential/PII output: 0

This inventory is a Production blocker. No order was auto-linked by email.

## Dependency Audit

The full audit gates did not pass:

- frontend `npm audit`: 1 high `vite` advisory and 1 moderate `esbuild` advisory
- backend `npm --prefix server audit`: 1 high `brace-expansion` advisory
- `npm run security:gate`: PASS for its configured production security scan

The discrepancy is recorded rather than suppressed. Production certification must
resolve or formally disposition the full audit findings on the clean release SHA.

## Worldmove And Fulfillment

- live Worldmove quotation: NOT RUN
- live Worldmove TLS/auth evidence: NOT RUN
- billable purchase: NOT RUN and not authorized
- callback/redeem/idempotency: NOT RUN
- provider snapshot persistence: NOT RUN
- fulfillment binding persistence: NOT RUN
- physical checkout readiness: NOT CERTIFIED
- eSIM checkout independence from physical inventory: NOT CERTIFIED

No TLS bypass, real purchase, or provider data mutation was attempted.

## Concurrency, Rollback, And Customer Ownership

Unit and backend tests passed for resolver, binding repository concurrency, callback
validation, checkout idempotency, customer ownership projections, redaction, and
rollback-related services. End-to-end production certification for these controls
was not run because the release candidate was not clean and provider evidence was
not persisted.

## Docker Teardown

Mandatory teardown completed:

```text
docker compose -p hico-pr15-8-sheet-identity down -v --remove-orphans
```

Post-QA state:

- HICO QA compose: 0 containers
- HICO QA volume: removed
- `cuongdesign-web`: unchanged, port 13000
- `cuongdesign-ai-worker`: unchanged
- `cuongdesign-db`: unchanged, port 5439

## Required Next Actions

1. Create a clean release candidate containing only the intended B.9 scope and
   record its exact SHA.
2. Resolve the demo-mode, ownership, inventory persistence, unscoped endpoint,
   and full dependency-audit blockers.
3. Start the isolated HICO project only for the next QA window.
4. Re-run the read-only 1D/3D audit and show the bounded preview to an authorized
   Admin.
5. Obtain explicit Admin confirmation before persisting the two provider
   snapshots. Persist only the exact, mirror-collapsed candidates and record
   source hashes and provenance.
6. Re-run the B.6 closure and the full B.9 critical matrix, then teardown with
   `down -v --remove-orphans` again.

## Round B Evidence

Owner authorization for the QA persistence step was present in the Round B
instruction. The authorized Admin session was used for login, CSRF-protected
alias writes, and Sheet integration settings. No credential value was printed.

### Admin And Sheet Settings

- Admin login: PASS
- Admin role authorization: PASS for alias, Sheet settings, and fulfillment read
  paths
- Alias `Esim0481 -> var-1032`: created through Admin API, HTTP 201
- Alias `Esim0482 -> var-1033`: created through Admin API, HTTP 201
- Google Sheet credential: stored through Admin settings encryption flow
- Google credential source: owner-provided Viewer service account
- Sheet settings: reference-only, approval required, scheduled sync disabled
- Commercial preview range: `Sim HICO!A1:AP20`
- Connection test: sampled 19 rows, no writeback

### Provider Snapshot Persistence

The exact read-only provider candidates were re-audited immediately before the
QA persistence step. Both candidates were `DUPLICATE_IDENTICAL_COLLAPSED` with
two mirror references and identical normalized payloads.

During the isolated QA run only, two logical snapshots were persisted after the
owner-authorized confirmation:

| WMID | Provider product ID | Duration | Status | Mirror refs |
| --- | --- | ---: | --- | --- |
| `WM-e-CN-500MB-1D` | `LeSIM-wm00830001` | 1 | ACTIVE | `O1362`, `B1407` |
| `WM-e-CN-500MB-3D` | `LeSIM-wm00830003` | 3 | ACTIVE | `O1363`, `B1408` |

The local repository contained exactly two active offers and no 2D offer. The
snapshot file was removed after teardown; no runtime JSON artifact remains in the
worktree. Sheet writeback remained `false` and Worldmove live QA remained
`false`.

### Resolver And Sheet Apply Stop Condition

After provider snapshot persistence, the Admin fulfillment preview still returned
the following results:

| Variant | Expected | Actual | Result |
| --- | --- | --- | --- |
| `var-1032` / `Esim0481` | `EXACT` to 1D | `PROVIDER_FAMILY_MISMATCH` | BLOCKED |
| `var-1033` / `Esim0482` | `NEXT_LONGER` to 3D | `PROVIDER_FAMILY_MISMATCH` | BLOCKED |

The canonical variants currently have `supplier=other`,
`fulfillmentMethod=MANUAL_PROCESSING`, `leSIM=false`, `needsReview=true`, and no
explicit compatibility family. The provider snapshot is exact, but these legacy
canonical fields are insufficient for the B.8 family gate. No family metadata was
invented from price, name, row number, or a fake 2D offer.

The bounded Sheet preview was also fail-closed:

- total candidates: 19
- valid: 0
- invalid: 19
- `Esim0481`: `PROVIDER_OPERATION_MISMATCH`
- `Esim0482`: `PROVIDER_NOT_FOUND` because exact 2D is intentionally absent
- apply: NOT RUN
- partial update: 0

This is a B.8 integration gap: Sheet apply currently requires the legacy variant
fulfillment method to already match the provider offer and does not resolve a
2D catalog entitlement through the approved 3D next-longer strategy. It must be
fixed with an explicit canonical contract before another persistence attempt.

### Public And Health Checks

- Public catalog API: HTTP 200 for 37 public items
- Public provider leak scan: 0 forbidden provider/admin/credential keys
- `/api/health/security`: HTTP 200
- `/api/health/checkout`: HTTP 503 `CHECKOUT_NOT_READY`
- customer auth/platform/dashboard/assets health: HTTP 503, not production-ready
- Product Detail, cart, order snapshot, callback, repeat apply, concurrency, and
  rollback closure: NOT RUN after the mandatory resolver stop
- Worldmove live quotation/purchase: NOT RUN; no TLS bypass

### Round B Teardown

The mandatory command completed:

```text
docker compose -p hico-pr15-8-sheet-identity down -v --remove-orphans
```

After teardown, HICO QA has zero containers and zero volumes. The only remaining
Compose project is `cuongdesign`, with its three containers and ports unchanged.

## B.10 Fulfillment Family Contract Addendum

The earlier B.9 section records the stop condition before the structured family
profile existed. B.10 added migration `017_catalog_variant_fulfillment_profiles.sql`
and a reusable structured family contract while preserving legacy
`MANUAL_PROCESSING` values. The B.10 evidence is recorded separately in
`docs/agent/HICO_PR15_8_2_5B_10_FULFILLMENT_FAMILY_CONTRACT.md`.

In the isolated QA project, an authorized Admin confirmed two bounded profiles:
`var-1032` resolved `EXACT` to the exact 1D provider reference and `var-1033`
resolved `NEXT_LONGER` to the shortest compatible 3D provider reference. The
provider reference contained no 2D candidate, and no 2D snapshot was fabricated.
Sheet preview produced 19 candidates with 2 valid targets; Admin apply completed
for those targets without Sheet writeback. The disposable snapshot, PostgreSQL
volume, generated catalog version, and restored catalog artifacts were removed
after QA. This was provider reference QA, not Worldmove live QA.

The release decision remains `NO-GO`: the worktree is still mixed and
uncommitted, and full B.9 production readiness, customer ownership, inventory,
checkout, and live provider evidence remain outside this bounded B.10 result.
