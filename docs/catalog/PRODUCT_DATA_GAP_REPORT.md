# Product Data Gap Report

## Snapshot

The current canonical snapshot contains 93 products and 21,879 variants. After publish/readiness filtering, 37 products and 9,775 variants are public. The current snapshot has 0 public `device_sale` products and 0 public `topup` products.

Six public products have no primary image. Legacy products also have limited gallery, FAQ and typed device content. These are observed gaps from the canonical snapshot, not values to be invented in Product Detail.

## By product type

| Type | Current public data | Gap | Owner/action |
| --- | --- | --- | --- |
| Philippines eSIM | Published products and public variants exist | Extended network/install content is sparse in legacy rows | Admin catalog enrichment |
| Physical SIM | Contract and shipping flag are supported | No verified persisted physical inventory | Fulfillment/inventory owner |
| Top-up | Contract is supported | No published canonical top-up product | Catalog owner must create and publish canonical data |
| 4G device | Safe specification schema is supported | No canonical public device product | Catalog/device owner |
| 5G device | Safe specification schema is supported | No canonical public device product | Catalog/device owner |
| Media | Primary and gallery contract exists | Six public products lack primary media; legacy gallery coverage is incomplete | Admin media review |
| FAQ | FAQ rows are accepted and serialized safely | Current legacy products do not consistently provide FAQ rows | Content owner |

## Root causes

- The legacy catalog was primarily destination/package data and predates the product-level content schema.
- Device and top-up products were not present in the canonical migration snapshot.
- Physical fulfillment requires a real inventory source; a UI fallback would hide an operational blocker.
- Product Detail previously had hardcoded fallback paths. PR15.8.2.2 removes those sources and leaves explicit empty/data-gap states.

## Required follow-up

1. Admin fills canonical product, variant, media and FAQ fields through the Product Wizard.
2. Fulfillment owner provisions and verifies physical inventory before physical checkout is enabled.
3. Device and top-up owners publish canonical products with safe specifications and prices.
4. Re-run contract audit, public payload validation, Product Detail parity and checkout round-trip tests.

No fallback product, price, stock, image, SKU, network or device specification is approved by this report. Production remains `NO-GO` until the operational and launch blockers are closed.
