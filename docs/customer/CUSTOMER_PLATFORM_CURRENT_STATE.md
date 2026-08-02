# HICO Customer Platform - Current State Inventory

## Scope and evidence

This document records the repository snapshot inspected on 2026-08-02 for PR15.0.
It is discovery only and authorizes no runtime, auth, migration, or production change.

Source files are UTF-8. Previously observed mojibake came from terminal display
decoding; do not bulk-convert source encodings.

Run `npm run customer:inventory` to recreate the safe report. It reads source
and JSON fixtures only. It never writes data or prints identifiers, ICCIDs, or
fulfillment secrets.

## Persisted data snapshot

| Dataset | Current store | Count/state | Customer-platform meaning |
| --- | --- | --- | --- |
| Legacy orders | `server/uploads/orders.json` | 5 records | All lack `customerId`; classify every record `LEGACY_UNRESOLVED`. |
| Legacy customer profiles | `server/uploads/customers.json` | 2 demo records | Demo data only; not an identity/session store. |
| Legacy eSIMs | `server/uploads/esims.json` | 1 mock record | Fulfillment-style mock data; not owner-scoped. |
| Manual QR pool | `server/uploads/manual_qrs.json` | 2 mock records | Catalog pool, not a customer-owned asset store. |
| Fulfillments | `server/uploads/fulfillments.json` | File absent | No persisted fulfillment projection. |
| Inventory | `server/uploads/inventory.json` | File absent | No persisted inventory projection. |
| Inventory movements | `server/uploads/inventory_movements.json` | File absent | No persisted inventory movement ledger. |

The two demo profile emails may resemble contacts in legacy orders. That is not
ownership evidence. PR15.0 and later imports must never auto-assign an order
by email match.

## Route and API inventory

| Surface | Current behavior | Finding | Target PR |
| --- | --- | --- | --- |
| `/tai-khoan` | Renders `PrivateAccount` | Not backed by customer authentication. | PR15.1 |
| `/quan-tri` | Admin-protected route | Separate admin identity protection exists. | Keep separate |
| `/api/auth/*` | Admin authentication | Uses admin primitives and cookies. | Keep admin-only |
| `GET /api/user/orders` | Returns order data | No customer session ownership scope. | PR15.3 adapter |
| `GET /api/user/esim/:iccid` | Retrieves by client ICCID | IDOR risk; no owner scope. | PR15.3 replacement |
| `POST /api/user/topup` | Mutates by client ICCID | No customer session ownership scope. | PR15.3 replacement |
| `GET /api/checkout/orders/:orderId` | Reads by public ID | Outside frozen customer contract. | Remove PR15.2/15.3 |
| `POST /api/checkout/orders/:orderId/retry-fulfillment` | Retries fulfillment by public ID | Must become permissioned Admin API. | PR15.2/15.3 |

`server/fulfillment/fulfillmentRouter.js` also has an unscoped `/user/orders`
route. A mounted router may shadow a later legacy route in `server/hicoBackend.js`;
both remain an exposure until the compatibility adapter is complete.

## Frontend mock and browser storage inventory

`src/components/UserDashboard/UserDashboard.tsx` contains mock profile, eSIM,
loyalty, referral, notification, cart-count, and QR display states. It calls
legacy `/api/user/*`; it is not a real customer dashboard.

The only located browser persistence in `src/context/AppContext.tsx` is
`localStorage` key `hico_cart`. No customer password, session, login token, or
ownership assertion is persisted in browser storage. In-memory flags are not auth.

## Dependencies and ownership classification

| Concern | Current dependency | PR15.0 conclusion |
| --- | --- | --- |
| Admin sessions | PostgreSQL-backed admin primitives | Reuse foundations only; do not share identity tables/cookies. |
| Checkout | Canonical router plus JSON adapter | Preserve public IDs; move canonical orders to PostgreSQL in PR15.2. |
| Fulfillment | Services/repositories with mock/legacy JSON | Callbacks update fulfillment/status only, never ownership. |
| Catalog | Canonical catalog work | Loyalty uses positive eligible canonical VND items only. |
| Customer dashboard | Static/mock React component | Block production until PR15.3 uses persisted owner-scoped data. |

| Classification | Definition | Current count |
| --- | --- | --- |
| `OWNED` | Explicit valid `customerId` ownership. | 0 |
| `GUEST_UNCLAIMED` | Explicit claim workflow but no owner. | 0 |
| `MANUAL_REVIEW` | Explicit operator migration decision. | 0 |
| `LEGACY_UNRESOLVED` | No explicit ownership evidence. | 5 |

Email similarity, browser state, callback metadata, ICCID, or QR allocation
never changes `LEGACY_UNRESOLVED` to `OWNED`.

## Production conclusion

Production remains `NO-GO`. Verified customer authentication, provable order
ownership, and a non-mock owner-scoped dashboard are Critical blockers for
PR15.1 through PR15.3.
