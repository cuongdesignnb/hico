# Production Launch Report

This file is generated from launch evidence with
`node server/scripts/generateProductionLaunchReport.js`. It must contain
metadata and evidence references only, never raw secrets, private keys, session
tokens, provider credentials, QR/LPA values or unnecessary customer PII.

## Current status

`NO-GO` as of 2026-08-02. The repository has production-like QA evidence, not
production launch evidence. Production writes remain disabled. Generate the
machine-readable report with `npm run production:report` after setting
`PRODUCTION_LAUNCH_REPORT_PATH` to an approved evidence location.

## Required report sections

- Release: commit SHA, immutable image digest, migration, catalog and prerender versions.
- Domain/TLS: domain, certificate metadata, redirect, HSTS, canonical and sitemap.
- Secrets: identifiers, deployed versions, revoked old versions and smoke results.
- Alerts/on-call: event list, external channel, acknowledgement and escalation.
- Backup/restore: off-site ID, encryption/checksum, duration, RPO/RTO and smoke result.
- Canary: phase timestamps, traffic scope, metrics, incidents and decision.
- Rollback: approvers, session behavior, pending orders, integrity and result.
- Launch: Go/No-Go, write-gate event, production smoke and launch status.
- Hypercare: dashboard, staffing, open incidents and remaining risks.

The report must never claim `Production Launched` while any Critical checklist
row is not `PASS`.
