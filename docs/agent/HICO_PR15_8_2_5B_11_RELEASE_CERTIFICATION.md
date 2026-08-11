# HICO PR15.8.2.5B.11 Release Certification

## Certification status

**NO-GO for production.** This release candidate is a clean, isolated certification
candidate for the catalog and customer-platform dependency chain. No new runtime
feature was added in B.11. The runtime source SHA certified below is
`17f610bc88328fd3ec907a967fde13fcccd0d34d`.

Production is blocked by the existing readiness conditions listed in this document;
the QA fixture and Docker project are not production data.

## Provenance and scope

- Branch: `codex/pr15-8-2-5b11-release` in `D:\Hico-release`.
- Source/runtime SHA: `17f610bc88328fd3ec907a967fde13fcccd0d34d`.
- Release commits: `77374c4` security cleanup, `7198232` platform dependency chain,
  `17f610b` catalog/fulfillment closure documentation.
- Tracked provider runtime credential was removed from the release branch and its
  path is ignored. Service-account files, `.env`, dumps, Docker volumes, Mailpit
  data and runtime JSON are excluded from commits.
- Main worktree `D:\Hico` and `cuongdesign-*` containers were not modified.

## Dependency-chain evidence

The release branch includes the reviewed chain in dependency order:

1. Secure Admin Google Sheet settings and encrypted credential metadata.
2. Native `Sim HICO` parser, aliases and reference-only Sheet discovery.
3. Exact provider-reference discovery, mirrored-row deduplication and resolver.
4. Snapshot-backed fulfillment profiles, fallback family rules and checkout/order
   snapshot logic.
5. Admin catalog UI, public catalog projection, customer platform and scanners.

Fresh Docker PostgreSQL applied exactly migrations `001` through `017`, including
`013_catalog_sheet_sync.sql`, `014_catalog_sheet_integration_settings.sql`,
`015_catalog_variant_external_aliases.sql`, `016_catalog_variant_fulfillment_bindings.sql`
and `017_catalog_variant_fulfillment_profiles.sql`; migration status was `current`
with no pending migrations.

## Static gates

Passed on the release source:

- `npm install`, `npm run lint`, `npm run build`, `npm run prerender` (114 routes).
- Vietnamese UTF-8/NFC and mojibake scan, Sheet contract scans, fulfillment-family
  contract scan, Google Sheet no-Drive scan, customer-copy scan and security gate.
- Backend `npm test`: **231/231 passed**.
- `npm run integrity:check`: pass with no blockers or warnings.
- `npm run public-catalog:validate`: 93 products, 21,879 variants, 37 public
  products, 6,887 public variants; no forbidden keys, unpublished variants or
  invalid media.
- Admin-to-public contract, public payload, Product Detail hardcode/parity and
  Admin media-input scanners: pass.
- Customer inventory and dashboard scanners: aggregate-only report, no raw
  sensitive values; dashboard owner-scope check: pass.
- `docker compose -p hico-pr15-8-sheet-identity config --quiet`: pass.

Production dependency audit results:

- `npm audit --omit=dev` for root and server: 0 vulnerabilities.
- Full root audit remains unresolved with 2 advisories (moderate/high dependency
  chain); server full audit remains unresolved with 1 high advisory. Automatic
  force-upgrade was not applied because it requires a breaking Vite upgrade.

## Runtime QA evidence

Docker was started only as `hico-pr15-8-sheet-identity` with backend, PostgreSQL,
frontend and Mailpit. Backend/frontend health and Admin login passed. The Admin
Google Sheet settings response remained masked; no credential value was returned.
The read-only connection test identified workbook `SDL DL.HICO.VN`, tab `Sim HICO`
and succeeded without Sheet writeback.

Provider reference discovery used the authorized Viewer credential and the
`wm id goc` tab in read-only mode:

- `WM-e-CN-500MB-1D`: `DUPLICATE_IDENTICAL_COLLAPSED`, two identical payloads,
  source references `B1407` and `O1362`, one logical candidate.
- `WM-e-CN-500MB-2D`: `PROVIDER_NOT_FOUND`; no snapshot was created or inferred.
- `persisted: false`, `sheetWriteback: false`, `worldmoveLiveQa: false`.

The local QA-only provider fixture contained exact 1D and 3D reference snapshots
only and was not committed. It was used solely to exercise resolver behavior:

- `var-1032`: `PROVIDER_EXACT_MATCH`, provider duration 1 day, upgrade 0.
- `var-1033`: `PROVIDER_NEXT_LONGER`, provider duration 3 days, upgrade 1.

Admin persistence and Sheet workflow on the fresh DB passed for the two explicitly
confirmed targets:

- Aliases: `Esim0481 -> var-1032`, `Esim0482 -> var-1033`.
- Active fulfillment profiles: two, with canonical Worldmove CN/eSIM family data.
- Sheet preview: 4,670 rows, 2 valid target rows and 4,668 invalid rows.
- Apply: both target rows applied; repeating the same apply was idempotent.

Public Product Detail and cart UI smoke passed with no browser console errors. The
public API payload excluded provider identifiers, fulfillment bindings, Sheet row
references, provider hashes and secret fields. A pure eSIM checkout request reached
the canonical gate but was correctly rejected with `CHECKOUT_NOT_READY` because
`PHYSICAL_INVENTORY_NOT_CONFIGURED`; no fake physical inventory was added.

## Customer platform and quarantine

The read-only inventory report recorded:

- 5 legacy orders classified `LEGACY_UNRESOLVED`; no email auto-linking.
- 2 demo customer profiles, 1 mock eSIM and 2 mock manual QR records.
- 0 persisted fulfillment, inventory or inventory-movement records in the legacy
  source datasets.
- No raw PII, QR/LPA/PIN/PUK or credential values in the report.

Customer migration table validation passed, and `/api/user/orders` is disabled with
the compatibility shutdown response. Real-mode verification remains blocked because
the QA environment is `CUSTOMER_ACCOUNT_MODE=demo` and customer profile, support,
asset and notification readiness flags are disabled. This is an intentional
fail-closed result, not a production cutover.

## Blockers and residual warnings

Critical production blockers:

1. Full dependency audit advisories remain unresolved.
2. Canonical checkout is not ready until physical inventory is configured.
3. Customer real-mode, asset, profile, support and notification readiness is not
   enabled and must not be fabricated in B.11.

Non-blocking evidence warnings retained for follow-up:

- Catalog health reports 2,719 duplicate legacy SKU values requiring review.
- Media audit reports legacy local image fields and six orphan media records, while
  missing/private/broken media checks remain clear.
- The current public catalog has no published `topup` or `device_sale` products;
  the contract reports this as an absence and does not generate fallback data.

## Teardown requirement

After QA, the release project must be stopped with:

```powershell
docker compose -p hico-pr15-8-sheet-identity down -v --remove-orphans
```

Final evidence must show an empty release worktree, no HICO project containers and
the existing `cuongdesign-*` project still running unchanged. Docker is not a
production certification artifact and must remain off after handoff.
