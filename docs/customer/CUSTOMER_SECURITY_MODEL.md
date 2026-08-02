# HICO Customer Security Model

## Identity and session boundary

Customer and Admin are independent identity domains. Customer auth uses
`customers` and related customer tables, `hico_customer_session`, and its own
CSRF boundary. Admin tables, cookies, routes, and authorization stay unchanged.
Concurrent admin/customer sessions are allowed but never transfer access.

Customer email is normalized, unique, and verified before normal account use.
Phone is optional, non-unique, and unavailable for v1 login, recovery, or claim.
Unverified accounts are restricted to verification flows.

## Ownership and IDOR controls

Every customer order, asset, profile, export, loyalty, address, and reveal
query derives identity from the validated customer session. The server never
uses client-provided `customerId`, email, ICCID, order ID, or asset ID as
authorization evidence.

Resources outside caller ownership return `404 ORDER_NOT_FOUND` or
`404 ASSET_NOT_FOUND`, preventing existence disclosure. List queries apply an
ownership predicate at the data access boundary.

## Checkout and guest claim

Authenticated checkout derives ownership from session. Guest checkout stores
contact/shipping snapshots without owner. Claim requests return generic `202`.
Claim tokens are cryptographically random, stored as hashes, single-use,
expiring, rate-limited, and consumed transactionally with ownership audit.

Provider callbacks and fulfillment retries can update fulfillment/status only;
they cannot create, replace, or infer ownership.

## Sensitive fulfillment reveal

QR/LPA/PIN/PUK are excluded from list and dashboard APIs. Reveal requires:

1. Valid customer session.
2. Explicit resource ownership.
3. Valid customer CSRF proof.
4. Recent re-auth no older than 10 minutes.
5. Redacted security audit event.
6. `Cache-Control: no-store`.

Sensitive values cannot enter logs, traces, client analytics, exception messages,
browser storage, or aggregate metrics.

## PII, audit, and privacy

Store only necessary profile/contact data. Preserve immutable order snapshots
for legal/commercial continuity and separate mutable profiles. Security,
ownership, and reveal events are append-only with redacted email, address,
tokens, QR/LPA/PIN/PUK, and provider payloads.

Account export is authorized and audited. Delete requests have a 30-day grace
period before profile anonymization. Legal order/audit retention is undecided,
is a PR15.7 production blocker, and must be decided by legal/business owners.

## Threat control matrix

| Threat | Required control | Production proof |
| --- | --- | --- |
| Admin/customer confusion | Separate tables, cookies, routes, middleware, tests | Neither session accesses the other domain. |
| Order or asset IDOR | Owner predicates and non-enumerating 404 | Cross-account read/list/reveal/write tests. |
| Email/order enumeration | Generic claim/reset acceptance and rate limits | Timing/status regression tests. |
| Claim replay/race | Hashed expiring single-use transactional token | Replay and concurrent claim tests. |
| Sensitive leakage | Reveal service, re-auth, CSRF, no-store, audit | Response/log/cache fixture tests. |
| Mock dashboard leak | Persisted owner-scoped queries | No mock profile/loyalty/asset values in bundle. |
| PII observability leak | Central redaction/restricted audit metadata | Fixtures contain no raw values. |

Do not enable customer traffic while `/api/user/*` is unscoped, public checkout
order lookup remains, or the dashboard is mock-driven.
