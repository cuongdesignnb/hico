# HICO Catalog Performance + SePay Implementation Report

Ngày: 2026-08-12
Branch: `codex/hc-catalog-perf-sepay`
Base release: `2caac24ed4f78ecafab0e7c42c9ffd07fb8593f0`

## Mục tiêu đã hoàn thành

- Catalog canonical được cache theo manifest version; commit và rollback invalidate cache.
- Public catalog giữ server-side filter/pagination, có summary `priceSummary`, availability và `deviceGeneration`; detail vẫn trả full variants.
- Admin catalog dùng server-side pagination/search/filter và chỉ nhận variant summary.
- Public catalog request có shared in-flight/TTL cache, AbortSignal của component không hủy request dùng chung.
- Admin login có stylesheet riêng, responsive và tiếng Việt; không đổi auth API, route hoặc cookie/session.
- SePay được tách module riêng, có migration, Admin Settings, HMAC webhook, exact reference matching, manual review và idempotency.

Production vẫn **NO-GO**. Patch không bật customer real mode, public live checkout, Worldmove live hoặc giao dịch SePay thật.

## Files và contract

Catalog:

- `server/catalog/read/catalogReadCache.js`: version cache dùng chung theo uploads directory.
- `server/catalog/catalogService.js`, `catalogRouter.js`: projection và pagination server-side.
- `src/services/publicCatalogApi.ts`: shared query-key cache TTL 30 giây.
- `src/components/Admin/Catalog/CatalogTab.tsx`: Admin list query server-side.
- `src/types/catalog.ts`, `src/types/publicCatalog.ts`, serializer: typed summary contract.

SePay:

- `server/payments/sepay/`: credential crypto, settings repository/service, payment repository, webhook validation/service/router.
- `server/migrations/018_sepay_payment_integration.sql`: settings, transactions, webhook events, order payment columns và permission seed.
- `src/types/sepay.ts`, `src/services/sepayApi.ts`, `src/components/Admin/Payments/SePaySettingsPanel.*`: Admin UI.

Endpoints:

- `GET/PUT /api/admin/payments/settings`
- `PUT /api/admin/payments/settings/credential` với Admin re-auth + CSRF
- `GET /api/admin/payments/transactions`
- `POST /api/webhooks/sepay` với raw JSON body

Migration thêm `payments.settings.read`, `payments.settings.write`, `payments.transactions.read`; không sửa migration `001` đến `017`. Không thêm SePay secret vào `.env.example`, source hoặc seed. Runtime chỉ cần `INTEGRATION_SETTINGS_ENCRYPTION_KEY` đã có trong contract hiện tại.

## SePay source of truth

- [SePay Webhooks integration](https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook): payload, transaction ID, amount VND, retry và acknowledgement `200/201` với `{"success": true}`.
- [SePay webhook authentication](https://developer.sepay.vn/en/sepay-webhooks/xac-thuc): HMAC-SHA256 trên `timestamp.raw_body`, `X-SePay-Signature`, `X-SePay-Timestamp`, tolerance 300 giây.
- [SePay security](https://developer.sepay.vn/en/sepay-webhooks/bao-mat): HTTPS, HMAC, replay protection, account/amount/reference validation.
- [SePay test mode](https://developer.sepay.vn/en/sepay-webhooks/test-mode/so-sanh-voi-live): test mode không dùng tiền thật.

## Performance

Runtime evidence trước patch từ task:

```text
GET /api/catalog/products: ~333 KB, TTFB ~3.60 s
GET /api/health/catalog: ~2-3 ms
catalog: 93 products, 21,879 variants
catalog files: ~1.8 MB products, ~23 MB variants
```

Benchmark tái lập được sau patch với fixture 93 products/21,879 variants:

```text
catalog:benchmark
products: 93
variants: 21879
cold service projection: 4.22 ms
warm 20 admin list calls: 16.87 ms
average warm admin list: 0.84 ms
```

HTTP local benchmark với canonical fixture 93 products/21,879 variants và Admin session QA:

```text
GET /api/catalog/products?page=1&pageSize=20
status: 200
cold: 42.90 ms
warm #1: 27.83 ms
warm #2: 31.55 ms
response bytes: 294,313

GET /api/admin/catalog/products?page=1&pageSize=20
status: 200
cold: 12.50 ms
warm #1: 17.80 ms
warm #2: 7.27 ms
response bytes: 68,393
```

Admin response chỉ gửi summaries đại diện và `variantIds`, không gửi full 21.879 variant records; Product Wizard vẫn gọi detail endpoint để lấy full variants.

Đây là benchmark service với fixture tổng hợp, không phải claim về TTFB production. HTTP bytes/TTFB production cần đo lại sau khi owner deploy branch vào staging; Docker/production không được bật trong patch này.

## Tests

```text
npm run lint: PASS
npx tsc -b --pretty false: PASS
cd server && npm test: 247/247 PASS
npm run prerender: PASS (114 routes)
quality gates: PASS (security, integrity, encoding, Sheet contract, product contract/parity, admin media)
docker compose config --quiet: PASS with process-only placeholders; Docker smoke: NOT RUN
npm run build: PASS (`tsc`, Vite và prerender 114 routes với fixture canonical tạm trong worktree cô lập)
```

## Security

- Không commit secret; raw secret không được trả về response hoặc ghi log.
- SePay secret được mã hóa AES-256-GCM bằng `INTEGRATION_SETTINGS_ENCRYPTION_KEY`, chỉ trả masked/fingerprint.
- Webhook fail-closed nếu chưa configured, bắt buộc raw body, HMAC, timestamp và constant-time compare.
- Provider transaction ID unique; webhook retry trả `success: true, idempotent: true` và không lặp side effect.
- Reference/order lookup exact; sai account, amount, currency, status hoặc reference chỉ vào `MANUAL_REVIEW`, không mark PAID.
- Webhook không gọi fulfillment, không gửi email và không đổi fulfillment status.
- Public checkout và production readiness không bị mở.

## Rủi ro còn lại

- Production NO-GO; cần staging deployment để đo HTTP cold/warm/bytes và chạy migration `018`.
- Worldmove vẫn là simulator; Customer real mode chưa bật.
- Chưa có live SePay transaction và không được thực hiện trong automated QA.
- Prerender cần canonical runtime snapshot hiện hữu ở môi trường deploy.

## Git

Commit và remote HEAD sẽ được ghi bổ sung sau khi full test/QA và push branch hoàn tất.
