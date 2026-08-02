# HICO Loyalty Business Decisions

## Frozen v1 decisions

| Topic | Decision |
| --- | --- |
| Earning rate | 1 point per 10,000 VND eligible fulfilled item subtotal, using `floor`. |
| Eligible currency | VND only. |
| Eligible price | Positive-price canonical items only. |
| Exclusions | Excluded or reversed items earn no points. |
| eSIM/top-up earn trigger | `PROVISIONED`. |
| Physical SIM/device earn trigger | `SHIPPED`. |
| Cap and expiry | No earning cap and no point expiry in v1. |
| Redemption | Not available in v1. |
| Membership tiers | Not available in v1. |
| Reversal | Append-only `REVERSE` from a valid cancellation/refund event. |
| Referral | 50 points to each party after referee's first qualifying order; idempotent and reversible. |

## Earning formula

```text
points = floor(eligible_item_subtotal_vnd / 10000)
```

The eligible subtotal uses immutable canonical item quantity and price snapshots
after the required fulfillment milestone. A worker uses an idempotency key based
on qualifying item/event and must not re-award points after retries, duplicate
callbacks, or repeated status processing.

## Event and reversal rules

Append `EARN` only at `PROVISIONED` for eSIM/top-up or `SHIPPED` for
physical SIM/device. The item must be canonical, positive-price, VND, and not
excluded or already reversed.

A valid cancellation/refund appends `REVERSE` linked to the original earning
entry. No ledger row is edited or deleted to change a balance.

## Referral rules

A referee applies attribution before their first qualifying order. Once that
order reaches its earning milestone, append 50 points for referrer and referee.
The event is unique per qualifying order/referral relationship and links to any
valid reversal event.

Referral is never a login, identity, ownership, claim, or support authorization
mechanism.

## Explicit non-decisions

Redemption value, tiers, expiry, caps, phone identity, manual balance edits, and
retroactive email-based legacy order assignment are outside v1. A product owner
must approve a new decision before any of those boundaries change.
