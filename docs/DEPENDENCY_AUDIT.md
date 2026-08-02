# Dependency Audit Status

## Backend

`cd server && npm audit --omit=dev` reports zero production vulnerabilities.
The direct backend dependencies were updated and the `body-parser` transitive
dependency is constrained through `overrides`.

## Frontend

HICO uses the latest published `react-router-dom` release available from the
configured registry (`7.18.2`). On 2026-08-01, npm audit reports an advisory
whose fixed range starts at `8.3.0`, but that version is not published and npm
returns `ETARGET` for it. The application uses BrowserRouter only and does not
enable React Router RSC or action routes implicated by the advisory. Track the
next published fixed release and upgrade immediately when it exists.

Development-only Vite/esbuild findings are excluded from the production audit.
Upgrade Vite as a separate compatibility change when its next supported major
version is scheduled.
