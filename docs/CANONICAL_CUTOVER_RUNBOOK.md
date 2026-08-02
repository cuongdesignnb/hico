# HICO Canonical Cutover Runbook

## Ownership

- Release owner: người được chỉ định trong ticket/release window.
- Rollback owner: cùng release owner hoặc người được bàn giao trực tiếp.
- Data owner: Admin catalog owner xác nhận freeze và parity.

PR9 không tự thực hiện production cutover. Runbook này mô tả thao tác có kiểm soát.

## Prerequisites

- Freeze Product Wizard, bulk và publish writes.
- Xác nhận không có bulk command đang chạy.
- Xác nhận `CATALOG_READ_SOURCE=canonical` và `CATALOG_CANONICAL_FALLBACK=false`.
- Xác nhận Docker/host có đủ disk cho backup.
- Có release owner, rollback owner và cửa sổ monitoring.

## Pre-cutover

```powershell
cd D:\Hico\server
npm run catalog:backup
npm run catalog:backup:verify
npm run catalog:cutover:validate
cd ..
npm run lint
npm run build
cd server
npm test
```

Expected:

- Backup verify trả `verified: true` và `restoreDrill: passed`.
- Cutover report trả `ready: true`.
- Startup validator checksum và reference checks pass.
- Legacy files vẫn tồn tại và parity không có blocker.

## Cutover

1. Đặt `CATALOG_READ_SOURCE=canonical` trong deployment environment.
2. Giữ `CATALOG_CANONICAL_FALLBACK=false`.
3. Restart backend.
4. Kiểm tra:

```powershell
curl http://localhost:5000/api/health/live
curl http://localhost:5000/api/health/ready
curl http://localhost:5000/api/health/catalog
```

5. Smoke catalog list/detail, Product Wizard read/write, bulk preview, publish/unpublish, queues, legacy adapter, cart, dashboard và checkout.
6. Mở lại Admin writes sau khi smoke pass.

## Canary and monitoring

Triển khai theo thứ tự local → Docker → staging → canary → full production khi hạ tầng hỗ trợ. Theo dõi API 5xx, product 404, health failures, checksum failures, version conflicts, canonical write failures, stale bulk preview, parity và provider/reconciliation queues.

Rollback threshold đề xuất: bất kỳ checksum/startup failure nào, catalog 5xx/404 tăng bất thường, hoặc canonical write làm sai dữ liệu đều dừng mở rộng canary và chuyển sang rollback runbook.

## Post-cutover

- Kiểm tra lại health sau restart backend/container.
- Ghi version ID, counts, startup duration, load duration và memory nếu đo được.
- Lưu report/backup reference trong incident hoặc release ticket.
- Không xóa `destinations.json`, `packages.json` hoặc `server/catalog/legacy/`.

## Incident notes template

```text
Window:
Release owner:
Rollback owner:
Canonical version:
Observed health:
First failing endpoint:
Data impact:
Action taken:
Backup reference:
Next verification:
```
