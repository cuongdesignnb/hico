# HICO PR15.8 - Migration Cutover and Demo Mode Removal Handoff

## Starting point

- PR15.7 source commit: `1eeddb2`.
- PR15.7 docs/completion commit: the commit with message
  `docs(customer): record PR15.7 completion and PR15.8 handoff`.
- Migration head: `011_customer_profile_security_support.sql`.
- Backend test baseline: 178 tests pass at PR15.7 completion.

## Runtime evidence required

Run migration status and all customer validators against the isolated QA
database. Record aggregate counts only: 5 `LEGACY_UNRESOLVED` orders, 2 demo
profiles until an approved cleanup plan exists, 1 mock eSIM, 2 mock manual QR
records, and no persisted fulfillment/inventory/inventory-movement data in the
legacy snapshot. Record that email auto-link count is zero.

PR15.8 must verify the migration head, source/target aggregate parity, public
order IDs and six statuses, customer ownership predicates, guest claim replay,
profile/address ownership, cross-instance session revocation, support ticket
IDOR, admin permission/audit, private attachment paths, upload allowlist,
notification dedupe, restart recovery, and outage/recovery behavior.

## Required gates

Run `npm run lint`, `npm run build`, `npm run prerender`, backend tests,
`npm run security:gate`, `npm run integrity:check`, `npm run migration:status`,
`npm run production:validate`, all customer validators, `npm audit`, and
`docker compose config --quiet`. Use isolated QA Docker volumes only, then
tear them down and verify that no `cuongdesign-*` container changed.

Browser QA must cover a desktop viewport and 390px mobile viewport with no
horizontal overflow, console errors, public attachment URL, secret asset value,
or mojibake. Do not prerender or index private account routes.

## Open blockers

Production remains `NO-GO` until customer auth, order ownership, the real
non-mock dashboard, profile/support runtime evidence, full migration proof,
legal retention/anonymization decisions, and production approval evidence are
complete. Full export/delete, refunds, live chat, CRM, wallet, and production
launch are outside PR15.7 and must not be silently introduced here.
