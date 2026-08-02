import { ClipboardList, LayoutDashboard, UserRound } from 'lucide-react';

export const accountLinks = [
  { to: '/tai-khoan', label: 'Tong quan', icon: LayoutDashboard, end: true },
  { to: '/tai-khoan/don-hang', label: 'Don hang', icon: ClipboardList, end: false },
  { to: '/tai-khoan/thong-tin', label: 'Thong tin tai khoan', icon: UserRound, end: false },
];
