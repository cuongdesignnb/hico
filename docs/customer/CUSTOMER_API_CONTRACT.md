# HICO Customer API Contract

## Contract status

`/api/customer/*` is reserved and frozen as the customer namespace. PR15.0
does not expose these endpoints. PR15.1 onward may implement only this contract
or an explicitly versioned compatible extension.

Every customer request uses the customer session boundary. An admin session, role
string, client-provided customer ID, email, ICCID, or order ID is never
authorization evidence.

## Common rules

| Concern | Contract |
| --- | --- |
| Authentication | Cookie `hico_customer_session`; distinct from admin cookies. |
| CSRF | Required for customer state changes and sensitive reveals. |
| Pagination | Cursor format `?cursor=<opaque>&limit=20`; limit 1-100; return `items` and `page.nextCursor`. |
| Success | `{ "data": ..., "meta": { ... } }`. |
| Error | `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`. |
| Caching | Authenticated and sensitive responses use `Cache-Control: no-store`. |
| Logging | Redact PII and QR/LPA/PIN/PUK before logs, traces, metrics, and errors. |

## Customer authentication routes

| Method and route | Purpose | Access and result |
| --- | --- | --- |
| `POST /api/customer/auth/register` | Create unverified account | Public/rate-limited; initiates verification. |
| `POST /api/customer/auth/verify-email` | Consume verification token | Public one-time token; activates verified access. |
| `POST /api/customer/auth/login` | Create customer session | Verified account only; sets customer cookie. |
| `POST /api/customer/auth/logout` | Revoke current session | Customer session and CSRF required. |
| `POST /api/customer/auth/password-reset/request` | Request reset link | Generic acceptance to avoid enumeration. |
| `POST /api/customer/auth/password-reset/confirm` | Consume reset token | Public one-time token. |
| `POST /api/customer/auth/reauth` | Refresh recent-auth proof | Customer session and CSRF required. |

Unverified sessions are limited to verification flows. `/dang-nhap` is customer
login; `/quan-tri/dang-nhap` is admin login.

## Order and claim routes

| Method and route | Purpose | Required behavior |
| --- | --- | --- |
| `GET /api/customer/orders` | List caller-owned orders | Customer session; cursor-paginated summary, no sensitive fulfillment data. |
| `GET /api/customer/orders/:orderId` | Read caller-owned order | Customer session; non-owner returns `404 ORDER_NOT_FOUND`. |
| `POST /api/customer/orders/:orderId/claim` | Request guest claim email | Rate-limited public input; always generic `202 CLAIM_REQUEST_ACCEPTED`. |
| `POST /api/customer/order-claims/consume` | Consume signed one-time link | Customer session and transaction-safe consumption. |

`GET /api/checkout/orders/:orderId` is not part of this contract. Fulfillment
retry belongs to an explicit-permission Admin API, not public checkout/customer
callers.

## Profile, dashboard, assets, and privacy routes

| Method and route | Purpose | Required behavior |
| --- | --- | --- |
| `GET /api/customer/me` | Customer profile and verification state | Customer session; no admin fields. |
| `PATCH /api/customer/me` | Update allowed profile data | Customer session and CSRF. |
| `GET /api/customer/dashboard` | Owner-scoped summary | Customer session; persisted data only, no demo values. |
| `GET /api/customer/assets` | List caller-owned assets | Customer session; no QR/LPA/PIN/PUK. |
| `POST /api/customer/assets/:assetId/reveal` | Reveal sensitive asset | Owner, CSRF, re-auth within 10 minutes, no-store, audit. |
| `GET /api/customer/loyalty` | Read ledger-derived loyalty state | Customer session; no redemption in v1. |
| `POST /api/customer/export` | Start account export | Customer session, CSRF, asynchronous audited delivery. |
| `POST /api/customer/delete-request` | Start account deletion grace period | Customer session, CSRF, recent re-auth. |

## Error codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid input. |
| 401 | `CUSTOMER_AUTH_REQUIRED` | Missing, invalid, expired, or wrong-domain customer session. |
| 403 | `CSRF_REQUIRED` | Missing/invalid CSRF proof. |
| 403 | `RECENT_REAUTH_REQUIRED` | Sensitive action needs re-auth within 10 minutes. |
| 404 | `ORDER_NOT_FOUND` | Order does not exist for this caller or is not owned by this caller. |
| 404 | `ASSET_NOT_FOUND` | Asset does not exist for this caller or is not owned by this caller. |
| 409 | `CLAIM_ALREADY_CONSUMED` | Valid claim token was consumed. |
| 410 | `CLAIM_EXPIRED` | Valid claim token expired. |
| 429 | `RATE_LIMITED` | Request, claim, or reset limit exceeded. |
| 500 | `INTERNAL_ERROR` | Server failure with request ID and no sensitive detail. |

## Legacy compatibility and deprecation

`/api/user/*` becomes an authenticated customer compatibility adapter in
PR15.3. It requires a customer session, applies identical ownership filtering,
and returns:

```http
Deprecation: true
Sunset: <approved UTC date>
Link: </api/customer/...>; rel="successor-version"
```

The adapter does not redirect writes or accept client-provided ownership hints.
It is not an authorization bypass.
