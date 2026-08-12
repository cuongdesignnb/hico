# HICO — Agent Task: Catalog Performance + SePay Admin Integration

Date: 2026-08-12
Target branch: `codex/hc-catalog-perf-sepay`
Base release SHA: `2caac24ed4f78ecafab0e7c42c9ffd07fb8593f0`
Production verification host: `https://hc.cuongdesign.net`

## 1. Mục tiêu

Triển khai một patch nhỏ, review được, không phá dữ liệu demo và không mở public production checkout, gồm 3 phần:

1. Tối ưu tốc độ tải danh sách sản phẩm ở public site và Admin.
2. Đưa fix giao diện Admin login hiện đang mới tồn tại trên aaPanel về source chính thức.
3. Thêm cấu hình SePay trong Admin theo kiến trúc module riêng, có bảo mật, masking và webhook idempotent; chưa tự động bật thanh toán production khi chưa có owner approval.

Production hiện vẫn **NO-GO**. Patch này không được tự ý chuyển `CUSTOMER_ACCOUNT_MODE=real`, không bypass `PRODUCTION_NOT_READY`, không thay đổi `needsReview`, không gọi Worldmove thật và không phát sinh giao dịch thanh toán thật.

## 2. Bối cảnh runtime đã xác nhận trên aaPanel

Release `2caac24` đã được deploy verification tại `hc.cuongdesign.net` bằng Docker + aaPanel reverse proxy.

Trạng thái đã PASS:

- PostgreSQL migration `001` → `017`: current.
- Backend `NODE_ENV=production`.
- Frontend chỉ publish `127.0.0.1:18080`.
- Backend/PostgreSQL/Mailpit không publish public port.
- HTTPS, reverse proxy, `/api/health`, `/api/health/catalog`: 200.
- Admin login cookie dùng `Secure`.
- Admin write bị chặn đúng bằng `503 PRODUCTION_NOT_READY`.
- Worldmove unsigned webhook trả `401 WEBHOOK_SIGNATURE_INVALID`.
- Worldmove runtime hiện vẫn là simulator `http://localhost:4000`.
- `ADMIN_BOOTSTRAP_PASSWORD` đã được xóa khỏi runtime sau bootstrap.

Không được dùng `docker compose down -v` trên server aaPanel này.

## 3. Vấn đề A — Catalog load chậm

### 3.1 Evidence thực tế

Runtime aaPanel hiện có:

- `server/uploads/catalog_products.json`: khoảng **1.8 MB**.
- `server/uploads/catalog_variants.json`: khoảng **23 MB**.
- Canonical catalog: **93 products / 21,879 variants**.
- `GET /api/catalog/products`: khoảng **333 KB response**, nhưng TTFB đo được khoảng **3.60 giây**.
- `GET /api/health/catalog`: khoảng 2–3 ms.

Điều này cho thấy bottleneck nằm ở đường đọc/project catalog, không phải Nginx/TLS.

### 3.2 Root cause cần kiểm chứng và xử lý

`server/catalog/catalogService.js` hiện gọi `readProducts()` cho mỗi request. `createCanonicalCatalogReader()` lại gọi repository đọc canonical catalog; repository đọc/parse/checksum/validate toàn bộ products + variants JSON. Sau đó service mới attach variants rồi project public/admin.

Public list dù chỉ cần variant summary vẫn phải đi qua toàn bộ 23 MB variants.

Admin `CatalogTab` hiện gọi `GET /api/admin/catalog/products`, tải toàn bộ products + toàn bộ variants rồi filter/search/paginate ở browser. Đây là không phù hợp khi catalog có 21k+ variants.

Homepage cũng có nhiều component cùng fetch catalog độc lập (`Destinations`, `FeaturedPackages`, `Devices`, public pages), có nguy cơ tạo request trùng.

### 3.3 Yêu cầu triển khai

Không rewrite monolith. Tách code theo domain.

Ưu tiên kiến trúc:

- `server/catalog/read/` hoặc module tương đương cho cache/projection/list query.
- `src/services/` + `src/hooks/` cho client list/cache state.
- Không nhét thêm logic vào `AdminDashboard.tsx`.

Agent phải:

1. Thêm cache canonical read theo **catalog version/manifest** hoặc cơ chế tương đương an toàn.
   - Không cache mù vô hạn.
   - Cache phải tự invalid khi canonical version thay đổi.
   - Không trả dữ liệu cũ sau catalog commit/rollback.
   - Có test chứng minh repeated read không parse/checksum 23 MB mỗi request.

2. Tạo projection nhẹ cho public product list.
   - Public list không cần full variant arrays.
   - Chỉ trả variant summary cần cho card/filter: ví dụ min price theo currency/medium, variantCount, availability summary, device generation nếu cần.
   - Product detail vẫn load full public variants bằng endpoint detail hiện có.
   - Không làm lộ `providerOfferId`, `wmproductId`, secret, fulfillment internals hoặc admin metadata.

3. Tối ưu Admin catalog list theo server-side pagination/filter/search.
   - Không tải 21,879 variants vào browser chỉ để render 20 products.
   - Có endpoint/list mode typed rõ ràng cho product summary.
   - Search SKU/WMID phải chạy server-side trên canonical data/cache, không cần gửi full variants về client.
   - Product Wizard/edit vẫn dùng endpoint detail để lấy full product + variants khi mở chỉnh sửa.
   - Giữ API cũ tương thích nếu endpoint hiện tại còn consumer khác; nếu thay contract phải cập nhật toàn bộ consumer và test.

4. Dedupe public fetch.
   - Các component cùng cần catalog không được tạo nhiều request giống nhau trong cùng page load.
   - Có thể dùng shared service cache/in-flight promise hoặc hook/context nhỏ.
   - Query có filter khác nhau phải cache theo key và vẫn hỗ trợ AbortSignal hợp lý.

5. Thêm HTTP cache headers/ETag nếu phù hợp, nhưng không coi đây là giải pháp duy nhất.

### 3.4 Acceptance criteria catalog

Bắt buộc benchmark bằng dữ liệu canonical hiện tại hoặc fixture tương đương lớn:

- Warm `GET /api/catalog/products` mục tiêu **< 300 ms** trên aaPanel-equivalent runtime.
- Không còn parse/checksum 23 MB variants trên mỗi public list request.
- Admin first page không transfer toàn bộ 21,879 variants.
- Public product list vẫn đúng currency; không trộn USD/VND.
- Product detail/variant selection vẫn đúng.
- Search/filter/pagination Admin hoạt động desktop/mobile.
- Loading/error/empty state vẫn rõ ràng.

Ghi benchmark trước/sau vào báo cáo task.

## 4. Vấn đề B — Admin login UI chưa được commit

Trên aaPanel đã xác nhận route đúng:

- Admin: `/quan-tri`
- Admin login: `/quan-tri/dang-nhap`

Release hiện tại thiếu CSS riêng cho `LoginPage`, nên form từng hiển thị gần như raw HTML. Server local đã thử patch và `npm run lint` + `npm run build` PASS.

Agent phải đưa fix tương đương vào source:

- Tạo `src/pages/LoginPage.css` hoặc component nhỏ tương đương.
- `LoginPage.tsx` import CSS riêng.
- Class riêng kiểu `admin-auth-page`, `admin-auth-form`; không phụ thuộc `publicPages.css`.
- UI tiếng Việt:
  - `Đăng nhập quản trị`
  - `Mật khẩu`
  - `Đăng nhập`
  - `Đang đăng nhập...`
  - lỗi `Email hoặc mật khẩu không chính xác.`
- Responsive mobile.
- Không thêm inline style mới.
- Không đổi auth flow/cookie/route.

## 5. Vấn đề C — SePay chưa có trong Admin

### 5.1 Hiện trạng

Source hiện **không có SePay integration**.

Có endpoint demo legacy:

`POST /api/payment/webhook`

Endpoint này đang nằm trong `server/hicoBackend.js`, nhận dữ liệu client kiểu `productId/qty/email/...` và tự tạo order demo. Đây **không phải production SePay webhook** và không được mở rộng thành production integration bằng cách nhét thêm logic vào đó.

Admin tab `Thanh toán` hiện hiển thị dữ liệu giao dịch/method mang tính demo từ orders, chưa có cấu hình gateway thật.

### 5.2 Nguyên tắc SePay bắt buộc

Trước khi code, Agent phải đọc **official SePay documentation hiện hành** và dùng docs chính thức làm source of truth cho:

- webhook authentication/authorization,
- payload fields,
- transaction ID/reference,
- bank account metadata,
- API/token usage,
- retry behavior.

Không tự phát minh signature scheme nếu SePay không dùng scheme đó.

### 5.3 Kiến trúc yêu cầu

Không mở rộng `hicoBackend.js` hoặc `AdminDashboard.tsx` ngoài việc mount/import module nhỏ.

Backend mới nên tách:

- `server/payments/sepay/sepayRouter.js`
- `server/payments/sepay/sepayService.js`
- `server/payments/sepay/sepaySettingsRepository.js`
- `server/payments/sepay/sepayWebhookService.js`
- validation/types/helper tương ứng.

Frontend mới nên tách:

- `src/services/sepayApi.ts`
- `src/types/sepay.ts`
- `src/components/Admin/Payments/SePaySettingsPanel.tsx`
- CSS riêng.

Nếu cần persistence, thêm migration mới sau `017`, ví dụ `018_...sql`; không sửa migration cũ.

### 5.4 Admin SePay settings

Tối thiểu phải có:

- enabled/disabled,
- account/bank metadata không nhạy cảm theo đúng official docs,
- transaction/order reference prefix nếu business flow cần,
- webhook URL hiển thị read-only,
- credential/token state dạng `configured/not configured`,
- masked credential fingerprint/value,
- connection/test action nếu SePay API chính thức hỗ trợ an toàn,
- updatedAt/updatedBy/version.

Secret/token:

- Không commit vào source/.json seed/log.
- Không trả raw secret về Admin.
- Dùng env hoặc encrypted persistence.
- Nếu lưu encrypted settings, ưu tiên reuse pattern `INTEGRATION_SETTINGS_ENCRYPTION_KEY` đang dùng cho Google Sheet credential.
- Có optimistic version conflict và audit event.

### 5.5 Webhook SePay

Tạo route riêng, ví dụ theo contract chính thức:

`POST /api/webhooks/sepay`

Yêu cầu:

- body limit riêng hợp lý,
- validate auth/signature/header theo official SePay docs,
- validate amount/currency/reference/account trước khi cập nhật payment,
- idempotent theo provider transaction ID/event ID,
- retry không tạo order trùng, không fulfillment hai lần, không gửi email lặp,
- không log raw token/private payload nhạy cảm,
- lỗi trả `{ "error": "..." }` + HTTP status đúng.

Không overload fulfillment order status hiện có. Nếu cần payment status, lưu riêng (`PENDING`, `PAID`, `FAILED`, `REFUNDED` hoặc đúng domain contract mới) và không đổi các fulfillment status bất biến:

`PROVISIONED`, `SHIPPED`, `PENDING_SHIP`, `PENDING_QR_ASSIGN`, `PENDING_CALLBACK`, `CANCELLED`.

### 5.6 Checkout safety

Patch này **không được tự bật live public checkout**.

- `CartDrawer`/public checkout hiện gọi payment demo; không chuyển thẳng sang SePay production nếu chưa có full verified flow.
- Nếu cần nối flow, đặt feature/readiness gate fail-closed.
- Khi SePay chưa configured hoặc production readiness chưa pass, public order/payment write phải bị chặn rõ ràng.
- Không phát sinh giao dịch thật trong test.
- Nếu muốn test live SePay hoặc giao dịch có thể phát sinh tiền, Agent phải dừng và yêu cầu owner phê duyệt trước.

## 6. Security và compatibility

Bắt buộc giữ:

- Relative `/api/...` URLs; không hard-code `localhost:5000` trong frontend.
- Không secret trong source, JSON seed, response hoặc log.
- Admin API vẫn phải auth + CSRF + permission.
- HTML content sanitize như hiện tại.
- Không làm public payload lộ provider/payment internals.
- Không đổi field/status/route/schema tùy tiện.
- Không trộn tiền tệ.
- Upload/security behavior không bị regress.

Nếu thêm permission mới, seed permission trong migration mới và gán role có chủ đích.

## 7. Test bắt buộc

Trước khi commit:

```bash
npm ci
npm run lint
npm run build

cd server
npm ci
npm test
```

Ngoài ra chạy targeted tests mới cho:

- canonical read cache invalidation,
- public list projection,
- Admin pagination/search,
- repeated request không reread/reparse catalog,
- SePay settings mask/encryption/version conflict,
- invalid webhook auth,
- duplicate webhook idempotency,
- amount/reference mismatch fail-closed,
- no duplicate order/fulfillment side effect.

Nếu backend thay đổi, khởi động server/Docker isolated QA và smoke test endpoint liên quan.

Không dùng production credential thật trong automated test.

## 8. Performance verification

Agent phải ghi lại ít nhất:

```text
GET /api/catalog/products
cold: ... ms
warm #1: ... ms
warm #2: ... ms
response bytes: ...
```

Và Admin summary endpoint tương ứng.

Nếu warm vẫn > 500 ms, chưa coi task catalog hoàn thành.

## 9. Files cần tránh phình thêm

Không thêm logic lớn vào:

- `src/components/Admin/AdminDashboard.tsx`
- `src/components/ProductDetail/ProductDetail.tsx`
- `src/components/UserDashboard.tsx`
- `server/hicoBackend.js`

Chỉ mount router/component/import tối thiểu ở các file này.

## 10. Commit strategy

Ưu tiên 2–3 commit nhỏ:

1. `fix(admin): style production login page`
2. `perf(catalog): cache and paginate catalog reads`
3. `feat(payments): add guarded SePay admin integration`

Nếu SePay scope quá lớn, được tách commit nhưng vẫn cùng branch.

Sau khi toàn bộ lint/build/tests PASS:

```bash
git status --short
git diff --check
git push origin codex/hc-catalog-perf-sepay
```

Không merge `main` và không deploy production tự động.

## 11. Definition of Done report

Agent phải báo rõ:

- acceptance criteria nào đã đạt,
- files sửa và lý do,
- API/schema/env mới,
- migration mới nếu có,
- benchmark trước/sau,
- test/lint/build + số test pass,
- SePay official docs đã dùng làm contract,
- secret handling/masking,
- những gì vẫn NO-GO,
- exact commit SHA cuối và branch đã push.

## 12. aaPanel deploy sau khi Agent hoàn tất

Owner chỉ nên cần một cụm deploy ngắn. Ví dụ sau khi Agent push xong:

```bash
cd /www/dk_project/hico-hc
git fetch origin
git checkout codex/hc-catalog-perf-sepay
git pull --ff-only
npm ci
npm run lint
npm run build
docker compose -f docker-compose.yml -f compose.hc.yml up -d --build
```

Nếu có migration `018+`, phải chạy migration job trước backend hoặc giữ Compose dependency `migrate -> backend` đúng như hiện tại.

Sau deploy smoke test:

- `/`
- `/san-pham`
- `/diem-den`
- `/quan-tri/dang-nhap`
- `/api/health`
- `/api/health/catalog`
- production readiness vẫn fail-closed nếu các blocker production chưa được giải quyết.

Không `down -v`. Không `docker system prune`. Không đụng project Docker khác trên server.
