# HICO PR15.8.2.5B.12A Checkout Readiness Certification

Date: 2026-08-11
Scope: request-scoped checkout readiness by canonical fulfillment medium
Branch: `codex/pr15-8-2-5b11-release`
Source commit: `d57d942`
Base release candidate: `e05cf595d77edb5dfb72eff74cf4c983944c6696`

## Decision

**NO-GO for production.** This change removes the cross-medium physical
inventory dependency from pure eSIM request readiness. It does not certify
canonical product readiness, physical stock, customer real mode, provider live
connectivity, or production checkout.

The global checkout health endpoint remains a platform diagnostic. It continues
to report `PHYSICAL_INVENTORY_NOT_CONFIGURED` while the catalog contains active
physical-stock variants without persisted inventory. Checkout request routes now
evaluate only the capabilities required by the submitted canonical variants.

## Implementation

- Added `server/checkout/checkoutReadiness.js` with canonical classification,
  capability union, provider/manual-QR readiness and typed blocker details.
- Added request readiness to `POST /api/checkout/validate` and
  `POST /api/checkout/orders` through `checkoutRouter.js`.
- Kept the existing global startup validator and `/api/health/checkout`
  behavior unchanged.
- Canonical data, variant status, currency, order snapshots, callback
  entitlement rules and provider live-call behavior were not changed.
- Provider readiness uses the approved fulfillment profile/resolver path even
  when a legacy canonical variant still stores `MANUAL_PROCESSING`.
- Client-supplied medium and provider fields are ignored for classification.

Capability matrix:

| Canonical cart kind | Required capabilities |
| --- | --- |
| `ESIM` | `ESIM_FULFILLMENT`, `PROVIDER_OR_MANUAL_QR` |
| `PHYSICAL_SIM` | `PHYSICAL_INVENTORY`, `SHIPPING` |
| `DEVICE` | `DEVICE_INVENTORY`, `SHIPPING` |
| `TOPUP` | `TOPUP_PROVIDER` |
| Mixed cart | Stable union of all required capabilities |

## Runtime QA

Docker was started only as `hico-pr15-8-sheet-identity`. The QA database reached
migration head `017_catalog_variant_fulfillment_profiles.sql`. The authorized
Admin session recreated the two confirmed aliases and fulfillment profiles in
the disposable database:

- `Esim0481 -> var-1032`
- `Esim0482 -> var-1033`

The ignored provider fixture contained only exact 1D and 3D snapshots. It was
used locally and was not a Worldmove live QA call. Resolver evidence:

| Target | Resolution | Provider duration | Upgrade |
| --- | --- | ---: | ---: |
| `var-1032` | `PROVIDER_EXACT_MATCH` / `EXACT` to `WM-e-CN-500MB-1D` | 1 day | 0 |
| `var-1033` | `PROVIDER_NEXT_LONGER` / `NEXT_LONGER` to `WM-e-CN-500MB-3D` | 3 days | 1 day |

Request matrix:

| Request | HTTP result | Evidence |
| --- | ---: | --- |
| Pure eSIM 1D | 422 after readiness | Readiness passed; canonical validation preserved `VARIANT_NOT_AVAILABLE` because `var-1032` remains `needsReview=true`. |
| Pure eSIM 2D | 422 after readiness | Readiness passed; canonical validation preserved `VARIANT_NOT_AVAILABLE` because `var-1033` remains `needsReview=true`. |
| Pure physical SIM | 503 | `PHYSICAL_INVENTORY_NOT_CONFIGURED` only. |
| eSIM + physical SIM | 503 | Physical blocker only; eSIM capability data is retained. |
| Global checkout health | 503 | Platform diagnostic still reports the physical inventory blocker. |
| Canonical checkout config | 200 | Canonical engine enabled. |

The 422 target result is intentional evidence that B.12A does not bypass
canonical review state. It must be resolved by a separate owner-approved
catalog readiness change; no status or fulfillment field was fabricated here.

## Verification

- Root lint: pass.
- Root build and prerender: pass, 114 routes generated.
- Vietnamese UTF-8/NFC and mojibake scan: pass.
- Backend tests: **240/240 passed**.
- Fulfillment-family, Sim HICO sheet-contract and sheet-identity scanners: pass.
- Catalog, Product Detail, media and public payload scanners: pass.
- Security gate: pass.
- Integrity check: pass.
- `npm audit --omit=dev`: 0 vulnerabilities for root and server.
- Full audit remains non-zero: root has 2 Vite/esbuild advisories requiring a
  breaking upgrade; server has 1 high brace-expansion advisory. No force upgrade
  was applied.
- `docker compose -p hico-pr15-8-sheet-identity config --quiet`: pass.

Existing non-blocking catalog/media findings remain unchanged, including missing
primary images for six legacy public packages, legacy local image references and
six orphan media assets. No source-data repair was performed for B.12A.

## Teardown

After QA, the required command is:

```powershell
docker compose -p hico-pr15-8-sheet-identity down -v --remove-orphans
```

The HICO project must have zero containers and zero volumes afterward. The
`cuongdesign-*` project must remain running and untouched. The ignored `.env`,
canonical runtime files, disposable provider snapshot and generated `dist/`
output are not release artifacts and must not be committed.

Teardown completed after QA. The HICO project has zero containers and zero
volumes; `docker compose ls` shows only the pre-existing `cuongdesign` project,
and `docker ps` shows its three containers unchanged. Release-only `.env`,
canonical runtime copies, provider snapshot, catalog version copy and `dist/`
were removed.

## Remaining blockers

1. Canonical target variants `var-1032` and `var-1033` remain `needsReview=true`
   and are not checkout-ready; B.12A preserves this fail-closed behavior.
2. Physical inventory is not persisted/configured.
3. Customer real-mode and ownership readiness remain outside this PR.
4. Full dependency-audit policy remains unresolved.
5. Production remains **NO-GO** until the above blockers and the broader B.9
   production evidence are explicitly cleared.
