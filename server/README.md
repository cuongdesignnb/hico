# HICO eSIM: Hướng dẫn chạy thử nghiệm Backend & Trình giả lập API Worldmove

Thư mục này chứa hai dịch vụ backend Node.js (Express) giả lập quy trình đặt hàng, kích hoạt, quy đổi mã (Redeem), và đồng bộ dung lượng sử dụng thời gian thực theo đúng tài liệu kỹ thuật **Worldmove Shipping System API v2.0.1**.

---

## 1. Yêu cầu hệ thống
*   Đã cài đặt **Node.js** (Phiên bản v16 trở lên).

---

## 2. Hướng dẫn khởi chạy nhanh

Hãy mở hai cửa sổ dòng lệnh riêng biệt trong thư mục `server` để khởi chạy hai dịch vụ:

### Cửa sổ 1: Khởi chạy Trình giả lập Worldmove (Port 4000)
Cung cấp các API gốc của nhà mạng đối tác (Quotation, Buy eSIM, Redemption, queryUsage).
```bash
cd server
npm run start:wm
```

### Cửa sổ 2: Khởi chạy HICO Backend (Port 5000)
Xử lý cổng thanh toán, nhận Callback từ Worldmove và cung cấp API đồng bộ hóa dữ liệu cho Frontend PWA.
```bash
cd server
npm run start:hico
```

---

## 3. Quy trình kiểm thử kết nối tự động trên Giao diện (PWA)

1.  Khởi động Frontend dev server ở thư mục gốc:
    ```bash
    npm run dev
    ```
2.  Mở trình duyệt truy cập: `http://localhost:5173/#/dashboard`
3.  **Kiểm tra Trạng thái Kết nối**:
    *   Ngay dưới dòng chữ chào mừng *"Xin chào, Sơn 👋"*, bạn sẽ thấy nhãn trạng thái chuyển sang:
        `● Kết nối Backend (Worldmove LIVE)` (màu xanh lá).
    *   Nếu tắt Server, nhãn sẽ tự chuyển sang `● Chế độ Demo (Offline)` (màu xám).
4.  **Kiểm tra tính năng Đồng bộ dung lượng thời gian thực (Real-time Usage Poll)**:
    *   Cứ mỗi 5 giây, Frontend sẽ tự động truy vấn dung lượng eSIM từ HICO Backend (HICO Backend lại gọi sang Worldmove để lấy dữ liệu thực tế).
    *   Trình giả lập Worldmove sẽ tự động cộng ngẫu nhiên từ `100MB - 300MB` mỗi lần truy cập để mô phỏng người dùng đang truy cập Internet ngoài đời. Bạn sẽ thấy thanh tiến trình dung lượng dữ liệu trên màn hình tự động tăng dần một cách trực quan!
5.  **Kiểm tra tính năng Nạp tiền / Gia hạn (Top-up)**:
    *   Nhấp vào nút **Nạp thêm** hoặc **Gia hạn** trên thẻ eSIM đang dùng.
    *   Frontend sẽ gửi yêu cầu `POST` nạp thêm qua HICO Backend. Hệ thống sẽ cộng thêm `5GB` vào tổng dung lượng hiện tại và đặt lại (reset) bộ đếm lưu lượng đã dùng về `0`. Bạn sẽ thấy các số liệu trên màn hình lập tức thay đổi đồng bộ.
