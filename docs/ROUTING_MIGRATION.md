# Routing Migration

## Canonical public routes

| Purpose | Route |
| --- | --- |
| Home | `/` |
| Catalog | `/san-pham` |
| Subscription product | `/san-pham/:slug` |
| Destination | `/diem-den/:slug` |
| Region | `/khu-vuc/:slug` |
| Top-up | `/nap-them/:slug` |
| Device | `/thiet-bi/:slug` |
| Articles | `/bai-viet` and `/bai-viet/:slug` |
| Cart and checkout | `/gio-hang` and `/thanh-toan` |
| Existing account and admin | `/tai-khoan` and `/quan-tri` |

Only one `BrowserRouter` is mounted in `src/main.tsx`. Product links are based
on canonical catalog operation: subscription, top-up, and device products use
their corresponding route families.

## Hash compatibility

The startup redirect handles `#/`, `#/dashboard`, `#/admin`, `#/cart`, and
`#/checkout`. `#/product/:id` fetches the existing public product and replaces
the address with its canonical slug. Invalid or unknown hash routes use
`/404`. A server cannot issue an HTTP 301 for the fragment because browsers do
not send fragments in HTTP requests.

## Direct loads

Nginx first serves prerendered `route.html` snapshots and otherwise falls back
to `index.html`. Therefore refreshing a public BrowserRouter URL does not
produce an Nginx 404.
