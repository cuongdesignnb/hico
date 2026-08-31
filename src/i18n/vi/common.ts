export const viCommon = {
  account: 'Tài khoản',
  back: 'Quay lại',
  cancel: 'Hủy',
  close: 'Đóng',
  confirm: 'Xác nhận',
  loading: 'Đang tải dữ liệu...',
  retry: 'Thử lại',
  save: 'Lưu thay đổi',
  viewDetails: 'Xem chi tiết',
  noData: 'Chưa có dữ liệu.',
} as const;

export type ViCommonKey = keyof typeof viCommon;
