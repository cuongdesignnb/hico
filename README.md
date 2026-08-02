# HICO eSIM

## Routing and SEO

The web app uses `BrowserRouter`; public URLs are lowercase, unaccented and
hyphenated. Current canonical examples are `/san-pham/:slug`,
`/diem-den/:slug`, `/khu-vuc/:slug`, `/bai-viet/:slug`, `/gio-hang`, and
`/thanh-toan`. Historical `#/...` URLs are handled once during browser
bootstrap, then replaced with the canonical path.

Set `VITE_PUBLIC_SITE_URL` (frontend) and `PUBLIC_SITE_URL` (backend) to the
production HTTPS origin before deployment. `npm run build` also prerenders
public pages into `dist/`; see `docs/SEO_PRERENDER_RUNBOOK.md` for the publish
workflow and rollback instructions.

## Admin Security

Admin routes use server-side cookie sessions, CSRF protection, and backend RBAC.
Set bootstrap credentials only through environment variables for an empty local
store, then remove them. The current JSON auth repository is development and
single-instance QA only; production admin writes stay disabled until it is
replaced with a shared database/session store. See
`docs/AUTH_SECURITY_ROLLOUT.md`, `docs/ADMIN_PERMISSION_MATRIX.md`, and
`docs/SECRET_ROTATION_RUNBOOK.md`.

## Production Operations

Production auth requires `SESSION_STORE_DRIVER=postgres` with the migration
job completed. Admin writes are allowed only when the runtime production
readiness gate passes every critical dependency, backup, secret-rotation, and
security check. Operational commands live under `server/package.json`:
`db:migrate`, `db:migrate:status`, `backup:create`, `backup:verify`,
`backup:restore`, `integrity:validate`, and `production:validate`.

See `docs/operations/PRODUCTION_LAUNCH_CHECKLIST.md` before a rollout.

HICO là hệ thống bán eSIM, SIM vật lý và thiết bị 4G/5G. Repository gồm frontend React/Vite, backend Express và Worldmove simulator để thử luồng cấp eSIM trên máy local.

## Thành phần

- **Frontend:** React 19, TypeScript, Vite, Lucide.
- **Backend:** Node.js/Express, Axios, CryptoJS, Nodemailer.
- **Lưu dữ liệu demo:** các tệp JSON trong `server/uploads`.
- **Simulator:** mô phỏng Worldmove API và callback cấp eSIM tại cổng `4000`.

## Yêu cầu

- Node.js 20+
- npm
- Docker Desktop (tùy chọn)

## Chạy local

Mở hai cửa sổ Terminal.

**1. Frontend**

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`.

**2. Backend và simulator**

```bash
cd server
npm install
node start.js
```

Các dịch vụ:

| Dịch vụ | Địa chỉ |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend HICO | `http://localhost:5000` |
| Worldmove simulator | `http://localhost:4000` |

Để test hoàn toàn local, vào `/#/admin` → **Cài đặt** và đặt API URL là:

```text
http://localhost:4000
```

## Chạy Docker

```bash
docker compose up --build
```

Frontend chạy ở cổng `5173`. Nginx tự proxy `/api` và `/uploads` tới backend. Dữ liệu upload và JSON được lưu tại `server/uploads`.

## Các lệnh frontend

```bash
npm run dev       # chạy môi trường phát triển
npm run build     # kiểm tra TypeScript và build dist/
npm run lint      # chạy ESLint
npm run preview   # xem bản build local
```

## Route chính

| Route | Chức năng |
|---|---|
| `/#/` | Trang chủ, tìm kiếm, catalogue, giỏ hàng |
| `/#/product/<id>` | Chi tiết eSIM/gói khu vực |
| `/#/dashboard` | Dashboard khách hàng |
| `/#/admin` | Dashboard quản trị |

## Chức năng người dùng

1. Tìm điểm đến hoặc chọn gói eSIM/thiết bị.
2. Chọn dung lượng, thời hạn hoặc biến thể.
3. Thêm sản phẩm vào giỏ hàng.
4. Nhập thông tin thanh toán; SIM vật lý yêu cầu địa chỉ giao hàng.
5. Áp dụng khuyến mãi qua API.
6. Sau khi đặt eSIM, theo dõi QR, LPA, ICCID, APN, PIN/PUK trong Dashboard.

Giỏ hàng và trạng thái đăng nhập demo được lưu trong `localStorage` của trình duyệt.

## Chức năng quản trị

Tại `/#/admin`, có thể quản lý:

- Đơn hàng eSIM và trạng thái cấp phát.
- Điểm đến, gói cước, biến thể, `wmproductId`.
- Thiết bị 4G/5G và tồn kho.
- Khách hàng, mã khuyến mãi, đánh giá và ticket hỗ trợ.
- Bài viết, SEO, tạo nội dung AI hàng loạt.
- Thư viện ảnh và pool QR eSIM thủ công.
- Cấu hình API nhà cung cấp và SMTP.

## Luồng eSIM

### eSIM API / leSIM

1. Khách thanh toán.
2. Backend tạo đơn và gọi API nhà cung cấp.
3. Đơn chuyển sang `PENDING_CALLBACK`.
4. Nhà cung cấp callback ICCID và redemption code.
5. Backend gọi redeem để nhận QR/LPA.
6. Callback redeem cập nhật QR, PIN/PUK và APN.
7. Callback kích hoạt chuyển eSIM thành **Đang hoạt động**.

### eSIM thủ công

Admin tải QR vào kho theo biến thể. Khi có đơn, hệ thống tự lấy QR chưa gán. Nếu kho hết QR, đơn có trạng thái `PENDING_QR_ASSIGN`.

### SIM vật lý

Đơn có trạng thái `PENDING_SHIP`, kèm thông tin giao hàng để Admin xử lý.

## API quan trọng

| API | Mục đích |
|---|---|
| `GET /api/admin/destinations` | Điểm đến |
| `GET /api/admin/packages` | Gói cước |
| `GET /api/admin/devices` | Thiết bị |
| `GET /api/admin/providers/worldmove/offers` | Danh sách offer Worldmove đã đồng bộ |
| `GET /api/admin/providers/worldmove/offers/:id` | Chi tiết một offer Worldmove |
| `POST /api/admin/providers/worldmove/sync` | Đồng bộ quotation Worldmove thủ công |
| `POST /api/admin/catalog/reconciliation/run` | Đối chiếu Catalog với Worldmove theo `wmproductId` |
| `GET /api/admin/catalog/reconciliation/summary` | Tổng hợp kết quả reconciliation |
| `GET /api/admin/catalog/reconciliation/items` | Hàng đợi reconciliation có lọc và phân trang |
| `PUT /api/admin/catalog/reconciliation/items/:variantId` | Xác nhận resolution hoặc tạm bỏ qua |
| `POST /api/admin/catalog/migration/validate` | Dry-run và kiểm tra parity canonical catalog |
| `POST /api/admin/catalog/migration/run` | Ghi canonical catalog sau khi validation đạt |
| `GET /api/admin/catalog/migration/status` | Trạng thái version canonical hiện hành |
| `GET /api/admin/catalog/migration/reports/:migrationId` | Parity report của một migration |
| `GET /api/admin/catalog/source-status` | Nguồn đọc legacy/canonical và trạng thái khóa ghi |
| `GET /api/health/live` | Liveness không phụ thuộc catalog |
| `GET /api/health/ready` | Readiness có kiểm tra canonical catalog |
| `GET /api/health/catalog` | Metadata an toàn về health/version catalog |
| `GET /api/checkout/config` | Engine checkout hiện tại, không chứa secret |
| `POST /api/checkout/validate` | Kiểm tra cart canonical mà không tạo order hoặc gọi provider |
| `POST /api/checkout/orders` | Tạo order canonical bằng `variantId` và idempotency key |
| `GET /api/checkout/orders/:orderId` | Đọc order canonical và fulfillment snapshot |
| `POST /api/checkout/orders/:orderId/retry-fulfillment` | Retry fulfillment theo policy |
| `POST /api/webhooks/worldmove/events` | Callback Worldmove HMAC có timestamp và replay protection |
| `POST /api/admin/catalog/legacy-parity/run` | Đối chiếu output legacy adapter với JSON gốc |
| `POST /api/admin/catalog/products` | Tạo canonical product ở trạng thái draft |
| `GET/PUT/DELETE /api/admin/catalog/products/:productId` | Đọc, cập nhật hoặc hard-delete product |
| `POST /api/admin/catalog/products/:productId/archive` | Archive product |
| `POST /api/admin/catalog/products/:productId/restore` | Restore product về draft |
| `POST /api/admin/catalog/products/:productId/variants` | Tạo canonical variant inactive |
| `GET/PUT/DELETE /api/admin/catalog/products/:productId/variants/:variantId` | Đọc, cập nhật hoặc hard-delete variant |
| `POST /api/admin/catalog/products/:productId/variants/:variantId/archive` | Archive variant |
| `POST /api/admin/catalog/products/:productId/variants/:variantId/restore` | Restore variant về inactive |
| `POST /api/admin/catalog/products/:productId/publish-readiness` | Kiểm tra khả năng publish product |
| `POST /api/admin/catalog/variants/:variantId/publish-readiness` | Kiểm tra khả năng publish variant |
| `GET /api/admin/catalog/versions` | Danh sách canonical version |
| `POST /api/admin/catalog/versions/:versionId/rollback` | Tạo version mới từ một version cũ |
| `GET /api/admin/catalog/audit` | Audit log canonical write |
| `GET /api/promos/validate/:code` | Kiểm tra mã giảm giá |
| `POST /api/payment/webhook` | Tạo đơn thanh toán demo |
| `GET /api/user/orders` | Đơn hàng khách |
| `GET /api/user/esim/:iccid` | Dữ liệu eSIM |
| `POST /api/admin/media/upload` | Upload ảnh |

### Cấu hình Worldmove

Đặt thông tin nhà cung cấp trong `.env`, không ghi credential thật vào source:

```dotenv
WORLDMOVE_MERCHANT_ID=replace-with-merchant-id
WORLDMOVE_DEPT_ID=replace-with-department-id
WORLDMOVE_TOKEN=replace-with-provider-token
WORLDMOVE_API_URL=https://provider.example.com
```

Checkout canonical được bật riêng bằng feature flag, không tự động bật theo `CATALOG_READ_SOURCE`:

```dotenv
CHECKOUT_ENGINE=legacy
WORLDMOVE_WEBHOOK_SECRET=
WORLDMOVE_WEBHOOK_TOLERANCE_SECONDS=300
PROVIDER_REQUEST_TIMEOUT_MS=15000
CHECKOUT_IDEMPOTENCY_TTL_MS=86400000
WEBHOOK_REPLAY_TTL_MS=86400000
```

Khi `CHECKOUT_ENGINE=legacy`, checkout mới dùng flow legacy. Order canonical đã tạo vẫn đọc snapshot và tiếp tục fulfillment qua webhook canonical; đổi flag không chuyển order đang xử lý sang flow khác.

Canonical checkout không nhận giá, currency, `simType`, `leSIM` hoặc fulfillment metadata từ frontend. Client chỉ gửi `variantId`, quantity, customer, shipping/top-up và idempotency key. Server tải lại catalog, kiểm tra currency, publish readiness và provider mapping trước khi ghi order.

Callback canonical dùng `POST /api/webhooks/worldmove/events` với raw body, `X-Worldmove-Timestamp`, `X-Worldmove-Signature` và `eventId`. Invalid signature trả 401; event đã xử lý trả 200 ổn định; lỗi tạm thời trả 503. QR và inventory movement được ghi atomic với idempotency key riêng.

Danh mục offer được lưu UTF-8 tại `server/uploads/provider_offers.json`. Mỗi lần đồng bộ ghi qua tệp tạm, `fsync` rồi đổi tên nguyên tử; offer biến mất ở lần đồng bộ sau được giữ lại với `active: false`.

Kết quả reconciliation được lưu riêng tại `server/uploads/catalog_reconciliation.json` bằng cùng cơ chế atomic write. Engine chỉ exact-match `CatalogVariant.wmproductId` với `ProviderOffer.wmproductId`; tên, slug, SKU, giá và vùng phủ không được dùng để tự xác nhận. Resolution Admin đã xác nhận được giữ nguyên khi chạy lại và chỉ tạo cảnh báo nếu provider drift. PR này chưa thay đổi checkout hoặc fulfillment runtime.

### Canonical catalog

Canonical là nguồn đọc mặc định. Legacy vẫn được giữ nguyên để rollback có chủ đích:

```dotenv
CATALOG_READ_SOURCE=canonical
CATALOG_CANONICAL_FALLBACK=false
CATALOG_STARTUP_VALIDATION=true
CATALOG_HEALTH_CACHE_TTL_MS=30000
CATALOG_REQUIRE_HEALTHY_ON_WRITE=true
```

Startup validator kiểm tra pointer, manifest, schema, files, checksum, ID, slug và quan hệ product/variant. Khi canonical không hợp lệ, process vẫn khởi động để trả liveness/health nhưng catalog reads, writes, bulk, publish và queues trả `503 CATALOG_NOT_READY`; không dùng mirror và không fallback âm thầm.

Migration không gọi Worldmove và không sửa `destinations.json`, `packages.json` hoặc kho manual QR:

```bash
cd server
npm run catalog:migrate:validate
npm run catalog:migrate
npm run catalog:smoke
npm run catalog:legacy-smoke
```

Mỗi snapshot nằm trong `server/uploads/catalog_versions/<migrationId>/`. Reader tải đồng thời products/variants qua con trỏ nguyên tử `server/uploads/catalog_current.json`; hai file `catalog_products.json` và `catalog_variants.json` là mirror tương thích, không phải transaction pointer. Report được ghi trong `server/uploads/migration_reports/`.

Đổi rõ `CATALOG_READ_SOURCE=legacy` để rollback source. Lỗi canonical không tự fallback trừ khi đặt rõ `CATALOG_CANONICAL_FALLBACK=true`; mặc định route guard vẫn chặn catalog khi canonical unhealthy. Các API migration/source-status/health vẫn hoạt động để phục vụ kiểm tra và rollback.

Health endpoints:

```bash
curl http://localhost:5000/api/health/live
curl http://localhost:5000/api/health/ready
curl http://localhost:5000/api/health/catalog
```

Backup và cutover validation không ghi secret vào backup/report:

```bash
cd server
npm run catalog:backup
npm run catalog:backup:verify
npm run catalog:cutover:validate
```

Backup được ghi vào `server/backups/catalog-cutover/`, report vào `server/uploads/cutover_reports/`; cả hai đều bị loại khỏi Git. Chi tiết quy trình nằm trong [docs/CANONICAL_CUTOVER_RUNBOOK.md](docs/CANONICAL_CUTOVER_RUNBOOK.md) và [docs/CANONICAL_ROLLBACK_RUNBOOK.md](docs/CANONICAL_ROLLBACK_RUNBOOK.md).

### Legacy compatibility adapter

Hai API Admin cũ `GET /api/admin/destinations` và `GET /api/admin/packages` đọc trực tiếp JSON legacy khi `CATALOG_READ_SOURCE=legacy`. Khi chuyển sang `canonical`, chúng chiếu snapshot canonical về đúng contract cũ, bao gồm ID, thứ tự package/variant, SKU trùng, giá, `wmproductId`, SEO và loại SIM.

Ở chế độ canonical, toàn bộ `POST`, `PUT`, `DELETE` trên destinations và packages trả `409`; giao diện Admin hiển thị trạng thái chỉ đọc và khóa các nút chỉnh sửa. Không có dual-write. Rollback bằng cách đặt lại `CATALOG_READ_SOURCE=legacy`, sau đó khởi động lại backend.

Parity report của adapter được ghi nguyên tử tại `server/uploads/migration_reports/legacy_adapter_parity_<timestamp>.json`. Smoke test tự chuyển legacy → canonical → legacy, xác nhận khóa ghi và hoàn nguyên chính xác dữ liệu kiểm thử.

### Canonical write foundation

Canonical write chỉ hoạt động khi `CATALOG_READ_SOURCE=canonical`. Mọi write cần `idempotencyKey` và `catalogVersionId`; update/archive/restore/delete cần thêm entity `version`. Product mới luôn là `draft`, variant mới luôn `active=false`. Legacy JSON không được ghi và các legacy write vẫn trả `409`.

Mỗi command thành công tạo một thư mục version mới, xác minh checksum rồi đổi `catalog_current.json` nguyên tử. Manifest lưu parent version, command type và command ID. Mirror products/variants không phải transaction source; lỗi mirror không hủy business commit đã thành công.

Runtime write metadata được lưu nguyên tử và bị loại khỏi Git:

- `server/uploads/catalog_idempotency.json`: retry cùng key/payload trả response cũ; payload khác trả `409`. TTL mặc định 24 giờ, cấu hình bằng `CATALOG_IDEMPOTENCY_TTL_HOURS`.
- `server/uploads/catalog_audit.json`: action, entity/version và danh sách field thay đổi; không lưu secret hoặc QR/LPA.
- `server/uploads/catalog_slug_history.json`: lịch sử đổi slug, chưa thực hiện redirect.

Legacy duplicate SKU được giữ nguyên, đánh dấu `skuConflict` cùng `legacyDuplicateGroupId` ổn định và bị chặn publish. SKU/slug mới phải unique. Hard delete chỉ dành cho draft/inactive chưa có reference; trường hợp có reference phải archive. Rollback luôn tạo version mới và audit, không trỏ pointer ngược trực tiếp.

```bash
cd server
npm run catalog:write-smoke
```

Các API `/api/admin/*` hiện chưa có auth/role middleware production. Phải bổ sung xác thực thật, rotate credential Worldmove cũ và đặt secret ngoài source trước khi triển khai.

## Kiểm tra nhanh

```bash
npm run lint
npm run build
```

Sau đó kiểm tra: tìm kiếm quốc gia, thêm giỏ hàng, áp dụng mã khuyến mãi, đặt eSIM bằng simulator, nhận callback, xem QR trong Dashboard và thử upload ảnh trong Admin.

## Lưu ý trước production

- Thêm đăng nhập, phân quyền và bảo vệ toàn bộ route/API quản trị.
- Không lưu API key, token hoặc mật khẩu SMTP trong source code hay API response; dùng biến môi trường/secret manager.
- Thay dữ liệu JSON bằng database và bổ sung backup, audit log.
- Tích hợp payment gateway thật, xác thực webhook và idempotency.
- Sanitize HTML bài viết trước khi render.
- Giới hạn upload, kiểm tra MIME/kích thước tệp, rate limit API và siết CORS.
- Chỉ dùng Worldmove simulator cho local/staging; thay callback URL và cấu hình bằng biến môi trường khi triển khai.
