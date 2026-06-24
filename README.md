# HICO eSIM

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
| `GET /api/promos/validate/:code` | Kiểm tra mã giảm giá |
| `POST /api/payment/webhook` | Tạo đơn thanh toán demo |
| `GET /api/user/orders` | Đơn hàng khách |
| `GET /api/user/esim/:iccid` | Dữ liệu eSIM |
| `POST /api/admin/media/upload` | Upload ảnh |

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
