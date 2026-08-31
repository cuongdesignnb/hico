# Media Library Integration Contract

## MediaAsset

Một public image reference dùng `MediaAsset`:

| Field | Contract |
| --- | --- |
| `id` | Stable opaque ID dạng `media_...`; source of truth cho input mới |
| `storagePath` | Relative server storage path, không nhận từ client |
| `publicUrl` | URL public được server tạo |
| `originalName` | Tên gốc để hiển thị, không dùng làm filename lưu trữ |
| `mimeType`, `extension`, `size` | Kết quả server validation |
| `width`, `height` | Optional metadata |
| `altText`, `title` | Metadata hiển thị, có giới hạn độ dài |
| `status` | `ACTIVE` hoặc `ARCHIVED` |
| `createdAt`, `updatedAt`, `createdBy` | Audit metadata |

## API boundary

- `GET /api/admin/media`: list ACTIVE assets, hỗ trợ search và MIME filter.
- `POST /api/admin/media/upload`: upload qua Media Library; client có thể gửi
  transient transport encoding nhưng không được persistence dưới dạng data URL.
- `PATCH /api/admin/media/:id`: cập nhật alt/title.
- `DELETE /api/admin/media/:id`: chỉ xóa asset không được reference; asset legacy
  hoặc asset đang được dùng phải archive/migration review và trả lỗi an toàn.
- Admin auth, RBAC, CSRF, rate limit và audit middleware áp dụng trước các route.

Response lỗi dùng `{ error, code }`, không trả stack trace hoặc filesystem path.
MIME/signature, extension allowlist, kích thước, random filename, `wx` create,
path traversal và overwrite đều được kiểm tra server-side. MIME public hiện gồm
JPEG, PNG, WebP và GIF khi cần.

## Admin form contract

- Product Wizard gửi `primaryMediaId` và `galleryMediaIds`.
- Gallery không nhận duplicate ID và giữ thứ tự khi reorder.
- Device, destination và article form gửi `imageMediaId`.
- Legacy `image`, `gallery` và `images` vẫn được đọc để không làm hỏng dữ liệu
  cũ; chúng không phải field nhập mới.
- RichTextEditor chèn ảnh bằng Media Library callback, không prompt URL ảnh.
- Manual QR là private fulfillment exception, không được dùng cho public media.

## Public serializer and integrity

Public serializer chỉ resolve asset ACTIVE thành `{ id, url, alt, title? }` và
không trả `storagePath`, original upload metadata nhạy cảm hoặc private details.
Reference thiếu, archived, duplicate gallery ID hoặc private path là lỗi review;
catalog write chặn Media ID không tồn tại/đã archive. Xóa asset đang reference
trả conflict và không xóa file.

Không được dùng Media Library cho QR/LPA/PIN/PUK, customer attachment hoặc
fulfillment secret. Public list/detail không expose các field đó.
