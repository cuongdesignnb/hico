# HICO PR15.8 - Migration, Cutover and Demo Mode Removal

## Release record

- PR15.8 source commit: not committed in this worktree; base HEAD is
  `482ca8baca5332461cf86220c0d27df1778e9b3b`.
- PR15.8 documentation commit: not committed in this worktree.
- Migration head: `012_customer_platform_cutover.sql`
- Baseline before PR15.8: 178 backend tests passed.
- PR15.8 adds four cutover tests; final backend result: 182 tests passed.

## Implementation delivered

- Added `customer_data_quarantine` with safe metadata constraints and unique
  source references.
- Added dry-run/execute migration, migration validation, real-mode verification,
  aggregate validation, and rollback helper scripts.
- Added customer platform health and production readiness checks.
- Real mode stops customer-facing legacy JSON fixture loading.
- `/api/user/*` is disabled with HTTP 410, deprecation, and sunset headers; no
  write redirect is provided.
- Removed the unused legacy `UserDashboard` component and kept the real account
  pages owner-scoped.
- Loyalty and referral remain disabled by explicit flags.
- Expanded backup/restore table coverage for the complete customer platform.
- Added cutover and rollback runbooks plus the stabilization/hypercare handoff.

## Inventory and migration evidence

The read-only inventory and isolated Docker QA preserved these aggregate facts:

| Finding | Count | Treatment |
| --- | ---: | --- |
| Legacy unresolved orders | 5 | `LEGACY_UNRESOLVED`; no email auto-link |
| Demo customer profiles | 2 | Quarantine only; not imported |
| Mock eSIM records | 1 | Quarantine only; not imported |
| Mock manual QR records | 2 | Quarantine only; not imported |
| Persisted fulfillment/inventory records in target | 0 | No synthetic data created |
| Quarantine rows after execute | 10 | Preserved for owner review |
| Loyalty accounts and entries | 0 | Feature disabled |
| Referral relationships/rewards | 0 | Feature disabled |
| Notifications, profiles, addresses, sessions | 0 | Disposable target had no seeded customer |
| Support tickets/messages/attachments | 0 | Disposable target had no seeded customer |

The migration report, validator, and health response emit aggregate values and
safe reason codes only. They do not export email, phone, address, QR, LPA,
PIN, PUK, ICCID, password, token, or provider secret values.

## Isolated Docker QA

The QA project used PostgreSQL, frontend, Mailpit, and two healthy backend
instances. Compose configuration passed. The execute path ran with real mode,
demo fallback disabled, legacy API disabled, customer migration approved,
backup verified, loyalty disabled, and referral disabled.

Verified results:

- migration status current through `012_customer_platform_cutover.sql`;
- migration validation passed, including quarantine metadata checks;
- real-mode verification passed;
- `customer-platform:validate` passed with five unresolved orders and ten
  quarantine rows;
- customer auth, orders, assets, dashboard-source, loyalty, referral,
  notification, profile, and support validators were run; source validators
  pass and database validators require the target connection when run locally;
- backup creation and verification passed;
- restore drill passed with customer tables restored child-first and quarantine
  preserved;
- platform, assets, profile, and support health endpoints returned healthy;
- `/api/user/orders` returned HTTP 410 with
  `LEGACY_CUSTOMER_API_DISABLED`, `Deprecation`, and `Sunset` headers;
- Docker logs showed no customer order fixture loading in real mode;
- During the final outage drill both platform health endpoints returned HTTP
  503 within the bounded timeout. After PostgreSQL recovery and backend
  restart, both instances returned HTTP 200 healthy with ten quarantine rows;
- the isolated project was torn down after QA and no `cuongdesign-*` container
  was changed.

## Browser QA

The rebuilt isolated QA image was checked in the in-app browser at a 1280px
desktop viewport. The disposable QA Customer account is signed in and the
customer auth/account route set renders Vietnamese navigation, empty states,
and status text with no horizontal overflow or console errors. The root page
serves the Vietnamese HICO title and the customer account remains available at
`http://localhost:5173/tai-khoan` for manual inspection. A new reset request
was delivered through Mailpit with the Vietnamese subject `Đặt lại mật khẩu
HICO`. Mobile evidence from the preceding QA pass remains valid for layout
changes; the PR15.8.1 final rebuild itself was rechecked at desktop width.

## Required quality gates

Run and record these commands from a clean reviewed worktree:

```text
npm run lint
npm run build
npm run prerender
npm --prefix server test
npm run security:gate
npm run integrity:check
npm run customer:inventory
npm run customer-platform:validate
docker compose config --quiet
```

Production-only commands must remain fail-closed without their required
database, secret, domain, backup, alert, canary, and approval evidence. A
successful local Docker run is not production evidence.

## Open blockers and handoff

Production remains `NO-GO`. PR14 still lacks real domain/TLS, secret rotation,
external alert delivery, off-site backup/RPO/RTO, canary, rollback approval,
on-call confirmation, and signed Go/No-Go evidence. Customer launch also needs
verified production auth, canonical ownership/guest claim proof, a persisted
owner-scoped dashboard, legal retention/anonymization decisions, and private
flow browser evidence.

Do not enable loyalty or referral redemption in PR15.8. Keep the five legacy
orders unresolved until an explicit owner-reviewed process exists. Follow
`docs/customer/CUSTOMER_PLATFORM_CUTOVER_RUNBOOK.md` and
`docs/customer/CUSTOMER_PLATFORM_ROLLBACK_RUNBOOK.md` for the next change
window.
