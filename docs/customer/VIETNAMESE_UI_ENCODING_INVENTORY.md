# Vietnamese UI Encoding Inventory

## Scope

This inventory covers Customer authentication and account routes under
`src/pages/customerAuth`, `src/pages/account`, and `src/components/Account`,
plus the HTML shell, server customer email delivery, docs, and Nginx response
configuration. Technical identifiers, URL slugs, API paths, enum values, order
IDs, SKU values, and user-entered data are not translated or normalized for
display by this change.

## Findings and treatment

| Category | Finding | Treatment |
| --- | --- | --- |
| No-diacritic UI | Auth, account navigation, status badges, empty/error states, asset, loyalty, referral, notification, profile, security, address, and support copy | Replaced with reviewed Vietnamese copy using NFC UTF-8 source files |
| Mojibake | No actual mojibake marker found by the UTF-8/NFC scanner in the required roots | Guarded by `npm run check:vietnamese`; console-only display artifacts were not re-encoded |
| U+FFFD | None found | Scanner fails if introduced |
| Font glyph issue | Vietnamese font was loaded but was not the first UI family | Be Vietnam Pro is now the first UI family with Inter and system fallbacks |
| HTTP encoding | HTML had UTF-8 meta but no explicit Nginx charset directive | Nginx declares UTF-8 for text responses; JSON remains API-compatible |
| Valid user data | Customer names, addresses, subjects, ticket bodies, and other input may contain arbitrary Unicode | No auto-accenting or broad data rewrite |
| Technical strings | API paths, enum/status values, error codes, IDs, SKU, ICCID, LPA, PIN, PUK, APN, and QR fields | Preserved; only customer-facing labels use typed helpers |
| URL/slug | Existing Vietnamese-less slugs remain unchanged | No route or canonical URL changes |

## Snapshot

- Required source files are read as UTF-8 with no unexpected BOM.
- Source is checked for NFC normalization and known mojibake markers.
- Customer UI copy is checked separately so technical strings are not treated
  as prose.
- The scanner intentionally does not read `node_modules`, build output,
  coverage, backups, or runtime uploads.
