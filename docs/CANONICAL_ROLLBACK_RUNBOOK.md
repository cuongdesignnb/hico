# HICO Canonical Rollback Runbook

## Decision

Ưu tiên rollback canonical version khi reader còn hoạt động nhưng dữ liệu version hiện tại sai. Chỉ rollback source sang legacy khi canonical reader/startup không hoạt động.

## Canonical version rollback

1. Freeze Admin catalog writes và ghi lại current version.
2. Chọn previous good version từ `GET /api/admin/catalog/versions`.
3. Tạo rollback version mới bằng API hiện có, không trỏ pointer ngược trực tiếp:

```powershell
$body = @{ idempotencyKey = "rollback-<incident-id>"; catalogVersionId = "<current-version>" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/admin/catalog/versions/<good-version>/rollback" -ContentType 'application/json' -Body $body
```

4. Kiểm tra `/api/health/catalog`, product list/detail và smoke writes.
5. Mở writes sau khi xác nhận version mới và audit.

## Source rollback sang legacy

Khi canonical không thể boot/serve:

1. Đặt `CATALOG_READ_SOURCE=legacy`.
2. Giữ `CATALOG_CANONICAL_FALLBACK=false`.
3. Restart backend.
4. Kiểm tra `/api/health/live`, `/api/health/ready`, `/api/admin/destinations`, `/api/admin/packages` và source status.
5. Giữ Product Wizard, bulk và publish ở read-only; canonical writes phải bị khóa, không mở legacy writes tùy tiện.

Legacy source rollback không đồng bộ các canonical writes mới. Không dual-write và không sửa nhanh JSON legacy để bù dữ liệu.

## Switch back canonical

1. Xác định canonical version tốt hoặc replay command có kiểm soát từ audit/incident.
2. Chạy backup verify và cutover validator.
3. Đặt `CATALOG_READ_SOURCE=canonical`.
4. Restart backend.
5. Kiểm tra live/ready/catalog health, parity, Product Wizard, bulk, publish, queues và restart persistence.

## Data risk note

Rollback source chỉ đổi nguồn đọc; nó không hoàn tác canonical writes. Canonical version rollback luôn tạo version mới và audit. Giữ backup, audit, idempotency metadata và incident notes cho đến khi release được đóng.
