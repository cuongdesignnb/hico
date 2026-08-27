# HICO eSIM core rebuild: source contract

## Scope

This phase separates three fulfillment families:

- Worldmove eSIM, matched by an exact WMID;
- HICO manual QR eSIM, stored in private storage;
- HICO physical SIM, fulfilled from HICO stock.

Top-up and Worldmove physical fulfillment remain readable only for historical data. They are not accepted for new catalog writes or new checkout flows.

No production catalog write, Sheet write-back, Docker startup, or Worldmove live call is part of this phase.

## eSIM source

The new eSIM reference source is the `SimHICO` tab in the `SDL DL.HICO.VN` workbook. Production wiring reuses the existing Admin Google Sheet Settings and its encrypted service-account credential. The configured reference must use:

```text
tab: SimHICO
range: A1:AT18315 (or a bounded equivalent range)
mode: read-only, Admin approval required
```

The parser identifies this profile by the `wm sim` and `wm esim` headers at columns X and Y. It does not use the legacy `HICO GỐC` parser as a fallback.

| Column | Live header | Canonical meaning | Rule |
| --- | --- | --- | --- |
| A | Loại SIM | source medium | only `eSIM` is accepted by the eSIM pipeline |
| B | BẢNG GIÁ SIM DU LỊCH... | product name | NFC-normalized text |
| C | Ngày | duration / trip-day option | daily duration; total-package trip options |
| D | Loại data | data policy | `Chia ngày` -> `daily`; `Gói tổng` -> `total` |
| E | Giá Sim | physical SIM retail reference | ignored by the eSIM pipeline |
| F | Giá eSim | canonical selling price | VND; used by public price and checkout |
| G-J | wholesale / CTV prices | internal price references | ignored; never public by default |
| K | APN | APN hint | copied to the draft variant when present |
| L | Quốc gia/ nhà mạng | coverage and network metadata | split at the explicit `:` only; no country inference |
| M | Ghi chú | public note | copied when present |
| N | mốc thời gian reset | activation/reset policy | copied as activation policy |
| O | Bán sỉ | availability text | ignored; not inventory |
| P | Được huỷ gói | cancellation policy | only deterministic yes/no values are accepted |
| Q-R | SKU SVL / SKU ESIM | internal source SKU | identity evidence only; not public |
| S-T | vốn sim / vốn eSim | cost | ignored; never public |
| U-W | Worldmove names/codes | provider reference metadata | not used as identity |
| X | wmid_sim | physical provider reference | ignored by the eSIM pipeline |
| Y | wmid_esim | Worldmove eSIM identity | exact-match provider snapshot |
| Z-AT | formulas and derived fields | auxiliary sheet data | outside the eSIM source contract |

For example, the live rows `WM-e-CN-500MB-1D` and `WM-e-CN-500MB-2D` use price from F and WMID from Y. The parser must never substitute E for an eSIM row, and must not copy provider cost into `variant.price`.

## Package semantics

For `Chia ngày`, the product name supplies the daily data label and column C supplies the variant duration. For `Gói tổng`, the product name supplies the real package duration and total data label; column C is retained as `tripDayOptions` so a customer can search by trip length.

The parser only extracts data size and speed with deterministic patterns. If the source is not unambiguous, the row remains blocked rather than being silently rewritten.

## Provider matching

Provider matching is exact after NFC normalization and case normalization of WMID. A match is eligible only when the provider snapshot is active, `providerProductType` is `0`, and `leSIM` is boolean. Missing or ambiguous offers remain blocked as `PROVIDER_NOT_FOUND` or `PROVIDER_AMBIGUOUS`.

Preview exposes hashes and safe row metadata. Apply requires an explicit Admin confirmation, a fresh catalog version, unchanged source/header/provider hashes, and creates draft products with inactive variants. There is no fuzzy match by name, price, row number, or internal SKU.

## Current configuration status

The isolated development worktree does not contain live Sheet credentials or a database-backed Admin Settings record. The optional env fallback uses:

```text
ESIM_SHEET_ID
ESIM_SHEET_TAB
ESIM_SHEET_RANGE
GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON
```

Without Admin Settings or the env fallback, the audit endpoint returns `ESIM_SHEET_NOT_CONFIGURED`. A configured connection using any tab other than `SimHICO` returns `ESIM_SHEET_TAB_INVALID`. These are intentional runtime-environment results, not a reason to copy credentials or production data into the repository.

## Dependency and safety map

- Source: `server/catalog/esimSheet/`
- Catalog: canonical read repository, versioned commit, audit, and write validation
- Provider: active provider snapshot repository, exact WMID lookup
- Checkout: canonical price and fulfillment validation
- Worldmove: eSIM-only active methods for new data
- Manual QR: private metadata/image repository and Admin assignment endpoint
- Physical SIM: HICO stock fulfillment with inventory readiness checks
- Customer projection: exposes safe assets without provider secrets

The public/customer surface must not expose WMID, provider cost, internal SKU, QR/LPA/PIN/PUK, or raw Sheet cells. Historical catalog rows remain readable through compatibility paths, but new writes use only the three active fulfillment families above.
