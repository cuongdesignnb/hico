# HICO PR15.7 - Profile, Addresses, Security and Support Handoff

## Starting Point

- Base source commit: `0b8460d` (`feat(customer): add referral rewards and notifications`).
- Migration head: `010_referral_notifications.sql`.
- Backend baseline: `173/173` tests passed; lint, build, prerender, security
  gate, integrity check, inventory, and isolated Docker QA passed.
- Runtime inventory baseline: 5 `LEGACY_UNRESOLVED` orders, 2 demo customer
  profiles, 1 mock eSIM, 2 mock manual QR records, and no persisted
  fulfillment, inventory, or inventory-movement data. Do not auto-link these
  orders by email.
- Docker is off after QA. Only the pre-existing `cuongdesign-*` containers may
  remain running.

## Scope

Implement real customer profile and address ownership flows, security-event
visibility, support handoff, and account export/delete preparation on the
customer identity boundary. Preserve the separate Admin identity domain and
the `hico_customer_session` cookie.

Required outcomes:

- Customer-owned profile and address APIs with validation, CSRF protection,
  owner scoping, audit events, pagination where applicable, and no leakage of
  secrets or unrelated order data.
- Security-event history that is safe to display and never exposes token
  values, passwords, session identifiers, QR/LPA/PIN/PUK data, ICCID, or full
  payment/shipping secrets.
- Support handoff that uses stable customer and order references, preserves
  order ownership checks, and does not create an ownership bypass.
- Export that is asynchronous or bounded, redacted, auditable, and free of
  fulfillment secrets unless a later re-authenticated reveal contract
  explicitly permits the field.
- Delete flow with a 30-day grace period and profile anonymization after the
  grace period. Do not invent legal order or audit retention periods; keep the
  decision as a production blocker until the owner supplies it.

## Constraints

- Do not modify migration `010_referral_notifications.sql`; add a new
  additive migration if schema changes are required.
- Keep referral, notification, loyalty, and order ownership source-of-truth
  boundaries intact.
- Do not assign any of the five legacy unresolved orders to a customer.
- Keep feature flags fail-closed in `.env.example`; do not enable production
  behavior as part of development QA.
- Do not start Docker except for an isolated QA project. Tear it down after QA
  and verify that `cuongdesign-*` containers were not touched.

## Verification Gate

Run and record:

- `npm run lint`
- `npm run build`
- `npm run prerender`
- `npm --prefix server test`
- `npm run security:gate`
- `npm run integrity:check`
- `npm run customer:inventory`
- UTF-8/no-BOM and mojibake checks for changed Markdown and source files
- owner-scope, CSRF, IDOR, redaction, export, delete-grace, and retention
  tests

Production remains `NO-GO` until customer auth, order ownership, profile and
address ownership, support handoff, export/delete behavior, and legal
retention decisions are evidenced end to end.
