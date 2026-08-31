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

## Referral and notification boundaries

Referral code creation and application use the authenticated customer session,
not an email, phone, order number, or client-supplied customer ID. A customer
cannot apply their own code. Same verified email or phone is treated as an
anti-abuse conflict and enters manual review without automatic reward. No IP,
device, fingerprint, shipping, or payment matching is performed in v1.

Qualification requires an owned referee order and the canonical fulfillment
milestone for its item. Legacy unresolved, guest-unclaimed, cancelled, and
manual-review orders are excluded. The referrer/referee relationship is locked
in a transaction; the ledger entry and `referral_rewards` reference are created
with stable idempotency keys. Cancellation/refund appends a reversal and never
edits the original reward.

Notification list, unread count, mark-read, and read-all queries all carry the
customer ID derived from the session at the repository boundary. A notification
from another customer returns `404 NOTIFICATION_NOT_OWNED`. Writes require the
customer CSRF token. Dedupe keys make duplicate fulfillment callbacks safe, and
notification delivery failure cannot fail the order transaction. Database rows
are the source of truth; client storage and hardcoded badges are not used.

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

Account export and delete are not implemented by PR15.7. The target contract is
an authorized/audited export and a delete request with a 30-day grace period
before profile anonymization. Legal order/audit retention is undecided, is a
PR15.7 production blocker, and must be decided by legal/business owners.

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

## Profile, session, and support controls

Profile writes use a strict allowlist and never accept customer id, email,
verification state, role, or timestamps. Email changes use a hashed, expiring,
single-use record and revoke the customer's other sessions after transactional
confirmation. Phone changes remain fail-closed until a real SMS provider is
configured. Password changes verify the current password, update the
credential version, revoke other sessions, and create a security event.

Addresses are locked through the customer row during default changes. A partial
unique index also enforces one default address per customer under concurrency.
Every address query includes the customer id; an address from another customer
is indistinguishable from a missing address.

Support ticket, message, and attachment queries derive customer ownership from
the session. Optional order and asset references are accepted only after an
owner-scoped lookup. Admin notes have `INTERNAL` visibility and are excluded
from customer detail responses. Attachments use a random private storage key,
safe basename, MIME allowlist and content signature, checksum, no public
static route, and no malware-scanning claim when the scanner is absent.
Download responses are authenticated and no-store.

## PR15.8 real-mode boundary

The cutover requires `CUSTOMER_ACCOUNT_MODE=real`,
`CUSTOMER_DEMO_FALLBACK_ENABLED=false`, and
`LEGACY_CUSTOMER_API_ENABLED=false`. The backend does not load customer-facing
legacy JSON fixtures in real mode. `/api/user/*` is a 410 deprecation boundary;
it cannot transfer authority or redirect writes.

Customer platform health and migration reports contain only statuses, counts,
safe references, and blocker codes. Quarantine metadata is constrained at the
database layer to reject PII, secrets, QR/LPA/PIN/PUK, ICCID, and token fields.
Sensitive reveal responses remain owner-scoped, CSRF-protected, audited,
re-authenticated when required, and `Cache-Control: no-store`.
