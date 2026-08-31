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

## Referral and notification routes

| Method and route | Purpose | Required behavior |
| --- | --- | --- |
| `GET /api/customer/referrals` | Read own code and relationship summary | Customer session, private no-store, no reward value when disabled/not ready. |
| `GET /api/customer/referrals/code` | Read or create own active code | Customer session, race-safe generation, code is not PII-derived. |
| `POST /api/customer/referrals/apply` | Apply an active referral code | Customer session and CSRF; rate limited; accepted request is generic `202`; suspicious matches become `MANUAL_REVIEW`. |
| `GET /api/customer/referrals/history` | Read own referral history | Customer session, bounded `page` and `pageSize`, no other customer identifiers. |
| `GET /api/customer/notifications` | List own notifications | Customer session, private no-store, page/pageSize bounded, no sensitive fulfillment values. |
| `GET /api/customer/notifications/unread-count` | Read server unread count | Customer session, database count only; no client fallback count. |
| `POST /api/customer/notifications/:id/read` | Mark one own notification read | Customer session and CSRF; non-owner is `404 NOTIFICATION_NOT_OWNED`. |
| `POST /api/customer/notifications/read-all` | Mark own unread notifications read | Customer session and CSRF; idempotent. |

Referral rewards are issued only after the referee's first owned qualifying
fulfillment milestone and are written through the loyalty ledger. Duplicate
callbacks and retries return the existing idempotent result. Cancellation or
valid refund events append ledger reversals. Guest, unresolved, cancelled, and
manual-review orders do not qualify.

The optional Admin review surface is permissioned separately:
`GET /api/admin/referrals`, `GET /api/admin/referrals/:id`, and POST review or
reject actions. Admin review records a reason and actor audit; it never mutates
a customer balance directly.

## PR15.7 error codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 404 | `PROFILE_NOT_FOUND` | Profile is not available to this customer. |
| 400 | `PROFILE_UPDATE_INVALID` | Protected or invalid profile field was submitted. |
| 503 | `CONTACT_CHANGE_NOT_READY` | A real contact delivery provider is not configured. |
| 400 | `CONTACT_CHANGE_TOKEN_INVALID` | Contact token is invalid or already consumed. |
| 410 | `CONTACT_CHANGE_TOKEN_EXPIRED` | Contact token has expired. |
| 409 | `CONTACT_ALREADY_IN_USE` | Requested email is already used by another account. |
| 404 | `ADDRESS_NOT_FOUND` | Address is not owned by this customer. |
| 503 | `SUPPORT_NOT_READY` | Support feature is disabled or persistence is not healthy. |
| 404 | `SUPPORT_TICKET_NOT_FOUND` | Ticket is not owned by this customer or does not exist. |
| 409 | `SUPPORT_TICKET_CLOSED` | Closed tickets cannot receive messages. |
| 400 | `SUPPORT_ATTACHMENT_INVALID` | Attachment type, path, content, or signature is invalid. |
| 413 | `SUPPORT_ATTACHMENT_TOO_LARGE` | Attachment size or per-ticket limit was exceeded. |
| 404 | `SUPPORT_ATTACHMENT_FORBIDDEN` | Attachment is not available to this caller. |

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
| 400 | `REFERRAL_CODE_INVALID` | Referral code or filter is invalid. |
| 409 | `REFERRAL_ALREADY_APPLIED` | Referee already has an active relationship. |
| 409 | `REFERRAL_SELF_REFERRAL` | Referrer and referee are the same customer. |
| 404 | `NOTIFICATION_NOT_OWNED` | Notification is not owned by this customer. |
| 503 | `REFERRAL_NOT_READY` | Referral feature is enabled but its rule or persistence is not healthy. |
| 503 | `NOTIFICATIONS_NOT_READY` | Notification feature is enabled but persistence is not healthy. |
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

## PR15.7 profile, security, and support routes

PR15.7 adds the following additive routes. They are disabled unless the
corresponding fail-closed feature flag is explicitly enabled in an isolated
QA or approved environment: `CUSTOMER_PROFILE_ENABLED` and
`CUSTOMER_SUPPORT_ENABLED`.

| Method and route | Purpose | Required behavior |
| --- | --- | --- |
| `GET /api/customer/profile` | Read mutable profile | Owner session, private no-store, display fields only. |
| `PUT /api/customer/profile` | Update profile | CSRF; only display fields; identity fields are rejected. |
| `POST /api/customer/profile/email/change/request` | Start email change | CSRF, hashed expiring token, duplicate-safe verification email. |
| `POST /api/customer/profile/email/change/confirm` | Consume email change | One-time token, transactional promotion, session revocation, security event. |
| `POST /api/customer/profile/phone/change/request` | Start phone change | CSRF; returns `CONTACT_CHANGE_NOT_READY` until a real SMS provider exists. |
| `GET/POST /api/customer/addresses` | List/create addresses | Owner predicate, CSRF for writes, maximum 20, one default per customer. |
| `PUT/DELETE /api/customer/addresses/:addressId` | Update/delete address | CSRF and owner predicate; non-owner is `404 ADDRESS_NOT_FOUND`. |
| `POST /api/customer/addresses/:addressId/default` | Select default | CSRF and transaction-safe owner lock. |
| `POST /api/customer/security/password/change` | Change password | CSRF, current password, revoke other sessions, audit. |
| `GET /api/customer/security/events` | Read security history | Owner-scoped, redacted type/request id only, bounded page pagination. |
| `GET/POST /api/customer/tickets` | List/create tickets | Owner-derived customer id, safe subject/body and optional owned links. |
| `GET /api/customer/tickets/:ticketId` | Read ticket thread | Non-owner returns `404 SUPPORT_TICKET_NOT_FOUND`; internal notes are hidden. |
| `POST /api/customer/tickets/:ticketId/messages` | Add customer reply | CSRF, owner check, closed tickets rejected. |
| `POST /api/customer/tickets/:ticketId/close` | Close own ticket | CSRF, owner check, notification and audit. |
| `POST /api/customer/tickets/:ticketId/attachments` | Upload attachment | CSRF, private random key, JPEG/PNG/WEBP/PDF only, max 5 MiB. |

Customer support links an order or asset only after an owner-scoped repository
lookup. Lists never include QR, LPA, PIN, PUK, ICCID, or raw storage keys.
Attachment downloads are authenticated `private, no-store` responses; there is
no public `/uploads` attachment route. When a malware scanner is absent, the
upload audit records an unscanned risk and does not claim that scanning ran.

Admin support routes are under `/api/admin/support/tickets` and use the
existing admin session, CSRF, permission middleware, real actor id, and write
audit. Read, reply, assign, and status operations map to separate support
permissions. Status changes require a reason. Internal notes have separate
visibility and are never returned to customers.

## PR15.8 legacy cutover behavior

The customer compatibility surface is now `/api/customer/*`. Requests to
`/api/user/*` return HTTP 410 with this safe body:

```json
{"error":"API cũ đã ngừng hỗ trợ.","code":"LEGACY_CUSTOMER_API_DISABLED"}
```

They include `Deprecation: true` and a `Sunset` header. The legacy path does
not redirect writes or expose a fallback response. Legacy fulfillment handlers
are outside the customer contract and are not public customer APIs.

`GET /api/health/customer-platform` returns a no-store readiness document with
mode, migration, dependency, flag, and blocker status. It contains aggregate
counts only. A healthy response requires real mode, current migration head
`012_customer_platform_cutover.sql`, disabled demo fallback, disabled legacy
API, and a healthy quarantine table.
