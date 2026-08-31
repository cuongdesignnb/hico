# Redesign UI Tab Quản lý Sản phẩm (Admin)

## Context

Tab **Sản phẩm** trong Admin HICO (`/#/quan-tri` → sidebar "Sản phẩm") hiện đang dùng `CatalogTab.tsx` với layout danh sách dạng card. UI hiện tại:

- Tóm tắt 4-cột kiểu bảng (`catalog-summary`)
- Bộ lọc 4 dropdown (`catalog-filters`)
- Bảng sản phẩm đơn giản (`catalog-table`)
- Hàng đợi xử lý (`catalog-queues`)
- Mở `ProductWizard` (modal 5-step) để tạo/sửa

User yêu cầu redesign phần UI này theo mockup tham chiếu với các đặc điểm:

- Layout split-view (table bên trái, detail panel bên phải) - **nhưng chỉ read-only preview** (không thay ProductWizard)
- KPI cards compact
- Filters + chips
- Product detail side panel với tabs (Tổng quan / Biến thể / Fulfillment / Media / SEO)
- Activity feed

**Ràng buộc cứng** (từ task spec):

- **KHÔNG** redesign Sidebar / Header admin shell
- **KHÔNG** thay hash routing / `App.tsx` / `AdminDashboard.tsx` shell
- **KHÔNG** thay đổi logic nghiệp vụ (ProductWizard giữ nguyên)
- **KHÔNG** thay đổi API contract
- **KHÔNG** trộn USD/VND, không base64 image, không mojibake
- **PHẢI** `npm run lint` PASS và `npm run build` PASS

## Approach

### Phạm vi thay đổi

**Files sẽ sửa / tạo mới** (tất cả trong `src/components/Admin/Catalog/`):

| File | Hành động | Mục đích |
|---|---|---|
| `CatalogTab.tsx` | Sửa nặng | Container chính, layout split-view, KPI cards, activity |
| `CatalogTab.css` | Sửa nặng | Style cho layout mới (mở rộng class `catalog-*`) |
| `ProductTable.tsx` | Sửa | Redesign cell layout, columns theo mockup |
| `ProductOverviewPanel.tsx` | Tạo mới | Panel preview chi tiết sản phẩm bên phải |
| `ProductOverviewPanel.css` | Tạo mới | Style panel preview |
| `ProductVariantsPreview.tsx` | Tạo mới | Tab Biến thể trong panel |
| `ProductFulfillmentPreview.tsx` | Tạo mới | Tab Fulfillment (Worldmove/manual QR) |
| `ProductMediaPreview.tsx` | Tạo mới | Tab Media (dùng MediaAssetField có sẵn) |
| `ProductSeoPreview.tsx` | Tạo mới | Tab SEO |
| `ProductStatsCards.tsx` | Tạo mới | 5 KPI cards |
| `ProductFilters.tsx` | Tạo mới | Filters + quick chips |
| `ProductActivityFeed.tsx` | Tạo mới | Activity/audit feed |
| `productLabels.ts` | Tạo mới | Labels tiếng Việt + helpers (currency format, fulfillment labels) |

**Files KHÔNG đụng:**
- `AdminDashboard.tsx` (chỉ giữ nguyên `<CatalogTab />` call hiện tại)
- `AdminDashboard.css`
- `ProductWizard/*` (giữ nguyên 100%)
- Bulk actions (`BulkActionBar`, `BulkPreviewDialog`, `BulkResultDialog`) - giữ nguyên
- Queue components (`NeedsReviewQueue`, `ProviderIssueQueue`, `SkuConflictQueue`, `InventoryWarningQueue`) - giữ nguyên
- Tất cả services & hooks hiện có
- `catalogApi.ts`, `catalogWriteApi.ts`, `catalogBulkApi.ts` - không sửa

### Layout mới của CatalogTab

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: breadcrumb "Trang chủ / Sản phẩm"  + actions           │
│   [+ Thêm sản phẩm] [Nhập dữ liệu] [Xuất Excel] [Đồng bộ]     │
├─────────────────────────────────────────────────────────────────┤
│ Title "Quản lý sản phẩm" + subtitle                             │
├─────────────────────────────────────────────────────────────────┤
│ [Filters row] [Search bar] [Quick chips: eSIM/SIM/Thiết bị]    │
├─────────────────────────────────────────────────────────────────┤
│ 5 KPI Cards: Tổng SP | Đang bán | Cần review | Đồng bộ | QR    │
├─────────────────────┬───────────────────────────────────────────┤
│                     │                                           │
│  Product Table      │  Product Overview Panel                    │
│  (scrollable)       │  (sticky right column, 30%)                │
│                     │                                           │
│                     │  Tabs: Tổng quan | Biến thể | Fulfillment│
│                     │        | Media | SEO                      │
│                     │                                           │
│                     │  [Thông tin cơ bản]                        │
│                     │  [Giá bán theo variant]                    │
│                     │  [Provider/Fulfillment]                    │
│                     │  [Trạng thái phát hành]                    │
│                     │  [Activity gần đây]                        │
├─────────────────────┴───────────────────────────────────────────┤
│ Bulk action bar (existing)                                      │
│ Queues section (existing - SKU conflict, needs review, ...)     │
└─────────────────────────────────────────────────────────────────┘
```

### Cấu trúc responsive

- **Desktop (>=1100px)**: 2 cột - Table 65% / Panel 35%
- **Tablet (700-1100px)**: Stack - Table full width, Panel collapse thành modal khi click row
- **Mobile (<700px)**: Stack tương tự tablet, table thành card list

### KPI Cards

Sử dụng data đã có từ `products` state (computed client-side từ `getAdminCatalogProducts`):

| Card | Nguồn dữ liệu | Icon |
|---|---|---|
| Tổng sản phẩm | `products.length` | Package icon, cam |
| Đang bán | `products.filter(p => p.status === 'active').length` | CheckCircle, xanh |
| Cần review | variants có `needsReview === true` | AlertTriangle, vàng |
| Đồng bộ provider | % variants có `providerOfferId` hoặc `wmproductId` | Link, xanh dương |
| Tồn kho / QR pool | Tổng stock HICO_MANUAL_QR + sum variants có stock | Boxes, tím |

Mỗi card: icon tròn + label + value lớn + sub-text (ví dụ "↑ 12.5% so với tháng trước" - hiển thị nếu có data, nếu không thì "Tổng sản phẩm").

**Lưu ý**: KPI "Đồng bộ provider" tính client-side từ data đã fetch (đáp ứng yêu cầu "không fetch 20k+ records"). Nếu `products.length` quá nhỏ (dưới 500) thì tính trực tiếp, nếu dataset lớn sẽ thêm aggregate API sau (note lại trong Risks).

### Filters & Quick chips

- **Search bar** giữ nguyên vị trí, đặt riêng với filters (search theo name, id, sku, wmproductId, providerOfferId - đã có trong logic `filteredProducts`)
- **4 dropdown filters**: Nghiệp vụ / Hình thức / Nguồn cấp / Vùng phủ (giữ nguyên logic)
- **Quick chips** dưới filters: `eSIM` | `SIM vật lý` | `Thiết bị` | `Đang bán` | `Bản nháp` | `Cần review`
  - Chip active: nền `var(--hico-orange-soft)` + border cam
  - Chip "Cần review" tô vàng nhạt khi active
  - Bổ sung filter `status` và `needsReview` vào `BulkFilter` để dùng cho selection

### Product Table redesign

Columns mới (giữ tương thích với mockup nhưng thêm fields quan trọng):

| Column | Nội dung |
|---|---|
| Checkbox | Bulk select |
| Sản phẩm | thumbnail + name + secondary metadata (id/sku) + warning badge (nếu có review) |
| Loại | operation label (eSIM/SIM/Thiết bị) với chip theo `medium` |
| Danh mục | coverage label + countries (nếu có) |
| Giá | lowest variant price + currency riêng biệt (không gộp USD+VND) |
| Tiền tệ | Currency badge (USD/VND) |
| Trạng thái | Status chip: `Đang bán` (green) / `Bản nháp` (yellow) / `Lưu trữ` (gray) |
| Provider | Supplier label với dot màu |
| Tồn kho / QR | Hiển thị theo fulfillment: Worldmove → "Provider", Manual QR → "X QR", Physical/Device → stock |
| Hành động | Edit button (mở wizard) + Quick view (mở panel) |

**Format giá đúng cách** (không trộn USD/VND):

```ts
const formatVariantPrice = (price: number, currency: 'VND' | 'USD') => {
  return new Intl.NumberFormat('vi-VN', { currency, maximumFractionDigits: 0 }).format(price);
};
// → "6.90 USD", "220.000 VND"
```

### Product Overview Panel (right column)

- Sticky bên phải trên desktop
- Hiển thị khi click row, **KHÔNG navigate route**
- Highlight row được chọn bằng background `var(--hico-orange-soft)` + border-left cam
- Close button (X) ở góc trên phải
- Panel header: Product name + status badge + Edit button (mở wizard)

**Tabs trong panel** (read-only preview):

1. **Tổng quan**: Thông tin cơ bản (name, slug, operation, coverage, network), Giá bán (lowest + range), Trạng thái
2. **Biến thể**: Sub-table với columns: Thời hạn | Dung lượng | Giá | SKU | Provider | Trạng thái
3. **Fulfillment**: Provider + fulfillmentMethod (label thân thiện: "Worldmove — Order → Callback → Redeem"), wmproductId, providerOfferId, leSIM, requiresExistingSim, shippingRequired
4. **Media**: Primary image + gallery thumbnails (read-only, hiển thị image URLs)
5. **SEO**: SEO title / description / keywords / slug

**Không có tab nào cho phép edit inline** - chỉ có 1 nút "Sửa" ở header panel để mở wizard. Điều này giữ nguyên logic publish readiness, dirty state, idempotency hiện có.

### Activity Feed

Hiển thị ngay dưới table:

- Tổng hợp từ `useCatalogQueues()`:
  - Số SKU conflict → click mở `SkuConflictQueue`
  - Số needsReview → click mở `NeedsReviewQueue`
  - Số provider issues → click mở `ProviderIssueQueue`
  - Số inventory warnings → click mở `InventoryWarningQueue`
- Format: icon + text + thời gian relative ("2 phút trước")
- Đặt cuối panel overview để tiện theo dõi

### Bulk Actions (giữ nguyên)

- `BulkActionBar`, `BulkSelectionSummary`, `BulkPreviewDialog`, `BulkResultDialog` - không đụng
- Bulk filter mở rộng thêm `status: 'draft' | 'active' | 'archived'` để quick chips hoạt động với bulk
- Checkbox column giữ nguyên

### Implementation steps

**Bước 1**: Tạo `productLabels.ts` chứa các helper labels tiếng Việt + currency formatter + fulfillment method labels.

**Bước 2**: Tạo `ProductStatsCards.tsx` + style - 5 KPI cards.

**Bước 3**: Tạo `ProductFilters.tsx` - filters + search + quick chips, encapsulate logic filter hiện tại.

**Bước 4**: Redesign `ProductTable.tsx` - thêm columns mới, redesign cells.

**Bước 5**: Tạo `ProductOverviewPanel.tsx` + 4 tab components (`ProductVariantsPreview`, `ProductFulfillmentPreview`, `ProductMediaPreview`, `ProductSeoPreview`).

**Bước 6**: Redesign `CatalogTab.tsx`:
- Thay layout từ single-column sang 2-column (table + panel)
- Tích hợp stats cards, filters mới, overview panel
- Giữ nguyên bulk actions bar, queues section, product wizard
- Giữ nguyên loading/error/empty states

**Bước 7**: Update `CatalogTab.css`:
- Layout grid 2 cột
- KPI card grid
- Filter row + chips
- Status chips (success/warning/danger variants)
- Quick chip styles
- Responsive breakpoints (@media 1100px, 700px)

**Bước 8**: Verify với `npm run lint` và `npm run build`.

### Critical files to reference

- `src/components/Admin/Catalog/CatalogTab.tsx` - container hiện tại
- `src/components/Admin/Catalog/ProductTable.tsx` - table hiện tại
- `src/components/Admin/Catalog/CatalogTab.css` - styles hiện tại
- `src/types/catalog.ts` - types chính (CatalogProductRecord, CatalogVariant, FulfillmentMethod)
- `src/types/catalogBulk.ts` - BulkFilter (sẽ thêm status field)
- `src/services/catalogApi.ts` - `getAdminCatalogProducts` (read-only)
- `src/hooks/catalog/useCatalogQueues.ts` - activity data source
- `src/components/Admin/Catalog/ProductWizard/ProductWizard.tsx` - giữ nguyên 100%
- `src/components/Admin/AdminDashboard.css` - biến `--admin-primary`, `--admin-bg-card`, etc.

### Verification

**Build & lint**:
```bash
cd D:/Hico
npm run lint
npm run build
```

Cả hai phải PASS với 0 errors.

**Manual QA flow**:
1. Mở `/#/quan-tri` → click "Sản phẩm" trong sidebar → xem layout mới
2. KPI cards hiển thị đúng số liệu
3. Search filter hoạt động (tìm theo name, sku, wmproductId)
4. 4 dropdown filters hoạt động
5. Quick chips: click "Đang bán" → filter chỉ hiển thị active products
6. Click row → panel overview mở bên phải với row highlight
7. Switch tabs trong panel: Tổng quan / Biến thể / Fulfillment / Media / SEO
8. Click "Sửa" trong panel header → ProductWizard mở (giữ nguyên behavior)
9. Bulk select products → bulk action bar hiện ra
10. Mở queue section → click các tab SKU/review/provider/inventory

**Visual checks**:
- Không có mojibake (kiểm tra text tiếng Việt hiển thị đúng)
- Currency hiển thị đúng format (220.000 VND, 6.90 USD - KHÔNG gộp)
- Status badges màu đúng (Đang bán xanh, Bản nháp vàng, Lưu trữ xám)
- Responsive: trên 1100px hiển thị 2 cột, dưới 700px stack vertical
- Sidebar KHÔNG thay đổi (kiểm tra width, màu, menu)
- Header admin KHÔNG thay đổi

**Routes khác không bị ảnh hưởng**:
- Vào `/quan-tri` → click "Tổng quan" → overview dashboard hiển thị bình thường
- Vào `/quan-tri` → click "Đơn hàng" → orders hiển thị bình thường
- Vào `/quan-tri` → click "Bài viết" → articles hiển thị bình thường

### Risks / Remaining

- **Performance**: Nếu `products.length` lớn (>5000), việc tính KPI client-side có thể chậm. Hiện tại dùng `useMemo` nên OK. Nếu cần, có thể thêm aggregate API sau.
- **Activity feed real-time**: Hiện dùng data từ `useCatalogQueues` (fetch lúc mount). Không có websocket. Đây là limitation của codebase hiện tại, không phải vấn đề của redesign.
- **Media preview**: Hiển thị gallery thumbnails read-only. Không cho edit inline trong panel (vì ProductWizard xử lý media upload với validation).
- **Provider config secret**: Không hiển thị trong panel preview. Nếu user cần xem, dùng ProviderCatalogTab riêng.
- **Fulfillment method labels**: Sẽ dùng label thân thiện (ví dụ "Worldmove — Order → Callback → Redeem") + hiển thị technical key trong secondary text. Mapping cụ thể:

```
WORLDMOVE_ESIM_REDEEM → "Worldmove — Redeem"
WORLDMOVE_ESIM_ORDER_THEN_REDEEM → "Worldmove — Order → Redeem"
WORLDMOVE_PHYSICAL_ORDER → "Worldmove — Physical Order"
WORLDMOVE_TOPUP → "Worldmove — Top-up"
HICO_MANUAL_QR → "HICO — Manual QR"
HICO_PHYSICAL_STOCK → "HICO — Physical Stock"
EXTERNAL_PROVIDER_API → "External API"
MANUAL_PROCESSING → "Manual Processing"
```

### Acceptance criteria

✅ Layout split-view (table + detail panel) trên desktop
✅ 5 KPI cards với data từ products đã fetch
✅ Filters + quick chips hoạt động
✅ Product detail panel với 5 tabs (read-only)
✅ Currency hiển thị đúng format USD/VND riêng
✅ Status badges với màu rõ ràng
✅ Sidebar KHÔNG thay đổi
✅ Header admin KHÔNG thay đổi
✅ ProductWizard vẫn hoạt động bình thường
✅ Bulk actions vẫn hoạt động
✅ Queues section vẫn hoạt động
✅ Loading/error/empty states đầy đủ
✅ Tiếng Việt Unicode đúng, không mojibake
✅ `npm run lint` PASS
✅ `npm run build` PASS
✅ Routes khác KHÔNG bị ảnh hưởng

### Definition of Done

Sau khi hoàn thành:

**Files changed**:
- Modified: `src/components/Admin/Catalog/CatalogTab.tsx`, `src/components/Admin/Catalog/ProductTable.tsx`, `src/components/Admin/Catalog/CatalogTab.css`
- Created: `src/components/Admin/Catalog/ProductStatsCards.tsx`, `ProductFilters.tsx`, `ProductOverviewPanel.tsx`, `ProductVariantsPreview.tsx`, `ProductFulfillmentPreview.tsx`, `ProductMediaPreview.tsx`, `ProductSeoPreview.tsx`, `ProductActivityFeed.tsx`, `productLabels.ts`, `ProductOverviewPanel.css`

**UI changes**:
- Layout split-view thay cho single-column
- KPI cards theo mockup
- Filters + chips UI mới
- Detail panel với 5 tabs
- Status badges với màu đúng chuẩn
- Activity feed section

**Functional changes**:
- Giữ nguyên: search, filters, pagination, edit (wizard), bulk actions, queues
- Bổ sung: filter theo status, quick chips, click row mở preview panel
- Thêm fields mới: Currency column, Tồn kho/QR column, Loại column

**API/schema**:
- No API contract changes
- No schema changes
- Không đổi services/hooks

**Tests**:
- `npm run lint` — PASS
- `npm run build` — PASS