# Admin -> Canonical -> Public -> Product Detail Contract Matrix

## Scope

PR15.8.2.2 audits the same product through four boundaries:

1. Admin Product Wizard writes only fields accepted by canonical validation.
2. Canonical JSON is the source of truth for product and variant data.
3. The public API uses `toPublicProduct` and `toPublicVariant`, a single allowlist serializer.
4. Product Detail consumes the typed `PublicProduct` adapter and sends the selected canonical variant to cart and checkout.

The audit is read-only. It does not rewrite catalog data, create runtime fixtures, or infer missing products.

## Matrix

| Contract area | Admin write | Canonical persistence | Public API | Product Detail / checkout | Status |
| --- | --- | --- | --- | --- | --- |
| Product identity | `id`, `slug`, `name`, `operation` | Product record | Same safe fields | Route uses `slug`; snapshot keeps product identity | Complete |
| Coverage | `coverageType`, `coverageIds` | Product record | Allowlisted arrays | Display and SEO use canonical coverage | Complete |
| Product media | Primary image and local gallery | Normalized `/images/` or `/uploads/` media | `primaryImage`, `images`, `gallery` | Gallery and selected image use public payload | Complete, legacy gaps remain |
| Product content | Description, guide, public labels, FAQ | Length-limited strings and FAQ rows | Public content allowlist | Typed adapter maps installation, compatibility, FAQ | Complete for persisted fields |
| Variant identity | `id`, `sku`, `productId` | Variant record with uniqueness checks | Same safe identity | Selected `variantId` is sent to cart | Complete |
| Variant price | Price, compare-at price, currency | Canonical numeric values | Public price fields | Checkout revalidates canonical price | Complete |
| eSIM | Data, duration, medium, activation/install content | Variant record | Public eSIM fields only | No QR/LPA/PIN/PUK in list/detail payload | Complete |
| Physical SIM | Shipping flag, SIM size, delivery note | Variant record | Shipping metadata only | Physical stock remains a launch dependency | Contract complete, data gap |
| Top-up | Operation and package fields | Variant record | Public top-up fields only | No public top-up product currently published | Contract complete, data gap |
| Device | Safe device specification allowlist | Product or variant specification object | Safe specification fields only | Product Detail reads typed device data | Contract complete, data gap |
| Visibility | Active/draft/archive status | Canonical status and readiness flags | Published products and public variants only | Unpublished rows cannot be selected | Complete |
| Provider data | Never accepted as public content | May remain internal canonical metadata | Explicitly excluded | Never enters cart UI | Complete |

## Public allowlist

The serializer does not spread canonical product or variant objects. It explicitly selects public identity, merchandising, media, content, availability, price and safe device fields. Provider offer IDs, provider product IDs, tokens, secrets, raw inventory movements, reconciliation/audit data, QR/LPA/PIN/PUK and redemption codes are excluded recursively by the validation gate.

`shippingRequired` is derived from the canonical variant and is true for physical SIM variants. It is not a substitute for physical inventory or fulfillment readiness.

## Validation commands

```text
npm run audit:product-contract
npm run validate:public-products
npm run check:product-hardcodes
```

The commands print aggregate results only. Reports are not written to `server/uploads` or committed as fixtures.

## Decision

The contract is frozen for PR15.8.2.2. Missing device, top-up, media and physical-inventory data is a data/readiness gap, not permission to add a UI fallback. Production remains `NO-GO`.
