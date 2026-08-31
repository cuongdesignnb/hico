# Media Reference Migration Report

## Decision

PR15.8.2.3 chuẩn hóa input và contract, không chạy bulk rewrite dữ liệu runtime.
Legacy local URL được giữ read compatibility để Product Detail và catalog cũ
không bị trắng ảnh trong lúc owner review. Không auto-delete orphan file và
không tạo fixture/backup/runtime artifact trong source.

## Reproducible report

```text
npm run check:admin-media
npm run media:audit
npm run media:validate
```

Hai script server dùng cùng schema:

```json
{
  "entitiesChecked": 0,
  "mediaAssetsChecked": 0,
  "rawImageUrlFields": [],
  "externalImageUrls": [],
  "dataUrls": [],
  "missingAssets": [],
  "brokenReferences": [],
  "orphanAssets": [],
  "duplicateReferences": [],
  "privateAssetsExposed": [],
  "unsupportedMimeTypes": [],
  "success": false
}
```

Giá trị `0` và mảng rỗng trong ví dụ chỉ là schema, không phải snapshot giả.

## Current snapshot

- 146 ACTIVE/public-compatible media assets được kiểm tra.
- 22,139 entity rows được kiểm tra từ canonical catalog và legacy JSON sources.
- Legacy local image fields được phân loại `rawImageUrlFields` để migration sau;
  raw value không được in ra.
- 6 orphan assets được ghi nhận để owner quyết định; không có thao tác xóa.
- Không có missing Media ID, archived reference, duplicate gallery ID, external
  image URL, data URL persisted hoặc private asset exposed trong snapshot.

## Migration classification

| Classification | Hành động |
| --- | --- |
| Media ID trỏ ACTIVE asset | Giữ nguyên, public serializer resolve URL |
| Legacy local `/images/` hoặc `/uploads/` | Read compatibility; tạo Media ID trong migration có approval |
| External image URL | Block publish sau khi owner thay bằng MediaAsset |
| Data URL | Reject persistence; import qua Media Library nếu là ảnh hợp lệ |
| Missing/archived Media ID | Block write, sửa reference hoặc chọn asset ACTIVE |
| Duplicate gallery ID | Block write, giữ một reference theo thứ tự owner xác nhận |
| Orphan asset | Review-only; không tự xóa |
| Private attachment/fulfillment file | Không migrate vào public Media Library |

## Rollout and rollback

1. Chụp report read-only ở staging và production-like, lưu aggregate evidence ở
   hệ thống vận hành ngoài repository.
2. Owner map legacy local fields sang Media ID, kiểm tra public URL, alt/title và
   reference integrity.
3. Chạy validator; chỉ sau khi pass mới bật form write canonical.
4. Rollback bằng adapter đọc legacy URL và tắt Media ID write path; không xóa
   asset file hoặc tự sửa source data.

Production vẫn `NO-GO` cho đến khi media integrity, customer ownership và các
Critical launch controls có evidence production được phê duyệt.
