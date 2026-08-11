# Product Detail Hardcode Inventory

## Reviewed surface

The guard scans:

- `src/pages/ProductDetailPage.tsx`
- `src/components/ProductDetail/`
- `src/adapters/`
- `src/hooks/catalog/`
- `src/services/publicCatalogApi.ts`
- `src/utils/productMedia.ts`

## Forbidden sources

The following are blocked in the Product Detail surface:

- `COUNTRIES`, `COUNTRY_FACTORS`, `DATA_OPTIONS`, `DURATIONS`
- `FALLBACK_PACKAGES_MAP`, `getFallbackKey`, `jp-esim`
- direct `/api/admin/destinations` or `/api/admin/packages` calls
- Japan-specific media fallback such as `dest_japan.png`
- product, device or variant fallback maps

The existing `check:product-detail-parity` and new `check:product-hardcodes` gates scan the source independently. The public catalog hardcode gate also scans the adapter and public catalog paths.

## Allowed neutral behavior

`src/utils/productMedia.ts` contains category-neutral placeholder media for an eSIM, physical SIM, device and top-up category. These assets are not product data and are used only when canonical media is absent. They do not contain a destination, SKU, price, duration or device model. The data-gap report records every missing primary image so Admin can resolve it.

Generic copy such as “content is being updated” is allowed only as an empty-state presentation. It must never fabricate a product name, package, price, network, stock value or technical specification.

## Field source map

| UI area | Source |
| --- | --- |
| Route and SEO | Public product API by canonical slug |
| Product name, description and guide | Public product payload |
| Primary image and gallery | Public media allowlist |
| Package selector and price | Public variants, selected by `variantId` |
| Device specifications | Public device specification allowlist |
| Installation, compatibility and FAQ | Public content fields |
| Cart and checkout | Selected canonical product and variant snapshot; checkout revalidates price and fulfillment |

No raw QR, LPA, PIN, PUK, redemption code or provider secret is present in the Product Detail contract.

## Current result

The scanner is expected to return zero findings. It is intentionally a source gate, not a runtime payload dump. A finding blocks QA handoff until the source is changed to use canonical public data or an explicitly neutral empty state.
