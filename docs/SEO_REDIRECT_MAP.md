# SEO Redirect Map

| Legacy location | Canonical destination | Mechanism |
| --- | --- | --- |
| `#/` | `/` | Browser bootstrap replace |
| `#/dashboard` | `/tai-khoan` | Browser bootstrap replace |
| `#/admin` | `/quan-tri` | Browser bootstrap replace |
| `#/cart` | `/gio-hang` | Browser bootstrap replace |
| `#/checkout` | `/thanh-toan` | Browser bootstrap replace |
| `#/product/:id` | Product operation route | Browser fetch and replace |
| Historical product slug | Current product route | `/api/catalog/products/by-slug/:slug` response with `permanent: true` |

Historical slug records live in `catalog_slug_history.json`. The resolver
follows chains, returns the current product path, and rejects cycles and
unknown slugs with `NOT_FOUND`. Do not add a wildcard server redirect: it
would conceal invalid URLs and allow fake canonical slugs.
