# Worldmove Webhook Security

Canonical callback dùng raw JSON body. Signature là HMAC-SHA256 trên chuỗi `timestamp.rawBody`, gửi qua `X-Worldmove-Signature` dưới dạng `sha256=<hex>` và timestamp qua `X-Worldmove-Timestamp`.

Server kiểm tra secret từ `WORLDMOVE_WEBHOOK_SECRET`, replay window từ `WORLDMOVE_WEBHOOK_TOLERANCE_SECONDS`, event ID, payload hash và provider order reference. So sánh signature bằng constant-time compare. Body tối đa 256 KB và rate limit cục bộ theo IP.

Event đã xử lý được dedupe qua `webhook_replay.json` và `webhook_events.json`. Callback lặp lại trả HTTP 200 ổn định, không provision, gửi email hoặc ghi side effect lần hai. Signature sai/trễ trả 401; local failure retryable trả 503; không trả stack trace hay secret/provider token.
