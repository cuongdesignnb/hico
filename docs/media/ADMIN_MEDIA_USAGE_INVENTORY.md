# Admin Media Usage Inventory

## Scope

Inventory này mô tả các module Admin thực sự tồn tại trong source hiện tại.
Scanner chỉ đọc source và không ghi report runtime, không in PII, secret hoặc
nội dung file ảnh.

| Module | Trạng thái | Cách chọn ảnh | Ghi chú |
| --- | --- | --- | --- |
| Canonical Product Wizard, bước thông tin chung | Đã chuẩn hóa | `MediaAssetField`, `MediaGalleryField` | Gửi `primaryMediaId` và `galleryMediaIds`; field URL cũ chỉ đọc để tương thích |
| Thiết bị | Đã chuẩn hóa | `MediaAssetField` | `imageMediaId` là input mới; `image` là legacy read compatibility |
| Điểm đến/package legacy | Đã chuẩn hóa | `MediaAssetField` | Adapter server resolve Media ID thành public URL cũ khi cần |
| Bài viết/CMS | Đã chuẩn hóa | `MediaAssetField` | AI image được import vào Media Library trước khi lưu |
| RichTextEditor | Đã chuẩn hóa | callback mở Media Library | Không còn prompt nhập image URL; link text vẫn được hỗ trợ |
| Media Library | Được phép upload | `MediaLibraryPicker` và tab thư viện | Đây là public image uploader duy nhất trong Admin |
| Manual QR fulfillment | Ngoại lệ private | uploader riêng | Không phải public media; bị scanner allowlist theo exact path và không được public serializer expose |
| Promo, branding, favicon, settings image | Không tìm thấy module thực tế | Không áp dụng | Không tạo field giả hoặc migration giả |
| Customer support attachment | Ngoài scope Admin media | Private attachment flow riêng | Không được nhập vào Media Library public |

## Static checks

Chạy `npm run check:admin-media` để kiểm tra exact-path allowlist. Gate fail khi
phát hiện image URL input, free-text image URL field, data URL read ngoài Media
Library, upload trực tiếp ngoài Media Library/private QR exception hoặc hardcoded
external product image.

## Current inventory snapshot

Snapshot từ `npm run media:validate` / `npm run media:audit`:

- `entitiesChecked`: 22,139.
- `mediaAssetsChecked`: 146.
- Legacy local image fields vẫn tồn tại trong dữ liệu read compatibility; chúng
  không phải input mới và không được tự động rewrite trong PR này.
- Không phát hiện external image URL, persisted data URL, private asset exposure,
  missing asset, archived reference, duplicate gallery reference hoặc unsupported
  MIME trong snapshot.
- 6 asset không có reference hiện tại được ghi nhận là `orphanAssets`; đây là
  danh sách review-only. Không xóa file tự động.

## Ownership and privacy

Media Library chỉ chứa public image asset. QR/LPA/PIN/PUK, support attachment,
fulfillment artifact và các private file không thuộc inventory public này.
Report chỉ chứa loại finding, source/path tổng quát và Media ID; không xuất tên
khách hàng, email, token hoặc nội dung nhạy cảm.
