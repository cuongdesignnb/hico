# Vietnamese UI Style Guide

## Voice and capitalization

- Use clear, concise Vietnamese and sentence case. Only proper nouns and
  product names use title capitalization.
- Prefer “Đăng nhập”, “Tạo tài khoản”, “Đơn hàng”, “Thông báo”, and “Hỗ trợ”.
- Use a full stop for complete status or helper sentences; omit it for short
  button labels and navigation labels.
- Keep action labels specific: “Lưu thay đổi”, “Gửi yêu cầu”, “Thử lại”,
  “Xác nhận và hiển thị”.

## Technical glossary

Keep these product and technical terms stable: eSIM, SIM, ICCID, PIN, PUK,
APN, QR, LPA, OTP, email, API, CSRF, and IDOR. Explain a term in nearby helper
copy when a customer needs context; never translate an enum, API path, SKU, or
identifier.

## Customer data

Do not add accents to customer-entered names, addresses, ticket subjects, or
messages. Preserve the stored value and render it as supplied. NFC
normalization applies to newly validated UI text boundaries only, not to a
bulk rewrite of existing data.

## Typography and accessibility

Use the shared Vietnamese-capable font tokens, inherited by controls. Keep
line-height generous enough for diacritics, avoid negative letter spacing, and
test long labels at 390px width. Status color is supplemental; status labels
must remain visible to screen readers.
