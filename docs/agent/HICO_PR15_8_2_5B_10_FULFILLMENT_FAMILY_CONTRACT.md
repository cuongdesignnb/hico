# HICO PR15.8.2.5B.10 Fulfillment Family Contract

Date: 2026-08-10
Scope: structured provider fulfillment-family contract and bounded entitlement backfill
QA project: `hico-pr15-8-sheet-identity`
Migration head: `017_catalog_variant_fulfillment_profiles.sql`
Worktree: mixed and uncommitted; no release SHA created

## Scope And Decisions

- Reused and extended `server/catalog/fulfillment/providerOfferFamily.js` as the
  single family normalizer and key builder.
- Added a versioned PostgreSQL profile store and append-only profile events in
  migration `017_catalog_variant_fulfillment_profiles.sql`.
- Kept legacy `variant.fulfillmentMethod` unchanged. No bulk conversion of
  `MANUAL_PROCESSING` variants was performed.
- The family key uses structured provider, region, medium, data policy, speed
  policy, and operation type. Network, activation, and reset policy are optional
  compatibility fields.
- Duration, price, WMID, provider display name, row number, and a caller-supplied
  family key are never family identity inputs.
- Profile create, update, and revoke require explicit Admin confirmation,
  optimistic version checks, and audit events.

## Bounded Backfill

Only the two approved canonical variants were used:

| Variant | Catalog duration | Profile | Provider resolution | Provider WMID |
| --- | ---: | --- | --- | --- |
| `var-1032` | 1 day | active Worldmove eSIM family | `PROVIDER_EXACT_MATCH` / `EXACT` | `WM-e-CN-500MB-1D` |
| `var-1033` | 2 days | active Worldmove eSIM family | `PROVIDER_NEXT_LONGER` / `NEXT_LONGER` | `WM-e-CN-500MB-3D` |

The QA provider reference contained exactly the 1D and 3D logical candidates.
No 2D provider record, Product ID, metadata copy, fuzzy match, price match, or
row-number inference was created. The local provider snapshot was a disposable
QA fixture and was removed after teardown. This was not Worldmove live QA.

## Sheet Integration

The authorized Admin session used the existing read-only Google Sheets reference
flow. Sheet writeback remained disabled.

- Preview: 19 candidates, 2 valid target rows, 17 invalid non-target rows.
- `Esim0481` resolved exactly to `var-1032`.
- `Esim0482` resolved exactly to `var-1033`; fulfillment resolution selected the
  shortest compatible longer 3D provider offer.
- Admin apply: `APPLIED`; both target rows updated only the selected price, APN,
  and network fields. Provider WMID persistence used the actual matched provider
  offer; no synthetic 2D offer was written.
- The catalog JSON and generated QA catalog version were restored/removed after
  the test. No Sheet writeback occurred.

## Implementation Inventory

- Structured family normalizer and resolver guardrails:
  `server/catalog/fulfillment/providerOfferFamily.js`,
  `server/catalog/fulfillment/providerOfferResolver.js`.
- Profile validation, repository, service, and Admin router under
  `server/catalog/fulfillment/`.
- Binding, checkout, Sheet preview, and Sheet apply integration updated to use
  active profiles and fail closed on missing or conflicting family metadata.
- Admin UI: `src/components/Admin/Providers/FulfillmentFamilyProfile.tsx` and
  the Provider Catalog fulfillment view.
- Contract scanner: `scripts/check-fulfillment-family-contract.mjs`.
- Focused unit coverage for family normalization, profile persistence,
  confirmation/version conflicts, exact/next-longer resolution, and no-fake-2D
  behavior.

## Verification

- `npm --prefix server test`: 231 passed, 0 failed.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run prerender`: PASS.
- `npm run check:fulfillment-family-contract`: PASS.
- `npm run check:vietnamese`: PASS.
- `npm run check:sim-hico-sheet-contract`: PASS.
- `npm run check:sheet-variant-identity`: PASS.
- `npm run security:gate`: PASS.
- `npm run integrity:check`: PASS.
- `npm run public-catalog:validate`: PASS with the existing missing-primary-image
  findings; no source repair was attempted.
- `npm audit --omit=dev` and `npm --prefix server audit --omit=dev`: 0
  vulnerabilities in the host worktree audit.
- `docker compose -p hico-pr15-8-sheet-identity config --quiet`: PASS.
- `git diff --check`: no whitespace errors; line-ending warnings only.

## Docker And Cleanup

The isolated project was rebuilt and used for the Admin/profile/Sheet QA only.
The required teardown completed:

```text
docker compose -p hico-pr15-8-sheet-identity down -v --remove-orphans
```

Post-QA verification:

- HICO QA project: 0 containers and 0 volumes.
- `cuongdesign-web`, `cuongdesign-ai-worker`, and `cuongdesign-db`: still
  running and unchanged.
- Catalog JSON hashes match the pre-QA backup.
- Disposable provider snapshot, generated catalog version, Mailpit data, and QA
  backup directory were removed.

## Release Decision

Production remains `NO-GO`. This evidence does not certify Worldmove live
connectivity, purchase, fulfillment, physical inventory, customer ownership,
or the full B.9 production matrix. The worktree contains mixed changes from
multiple PRs and no clean scoped B.10 release SHA or commit was created.
