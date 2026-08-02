import { Award, Bell, ClipboardList, Cpu, Gauge, LayoutDashboard, Smartphone, UserRound, UsersRound } from 'lucide-react';

export const accountLinks = [
  { to: '/tai-khoan', label: 'Tong quan', icon: LayoutDashboard, end: true },
  { to: '/tai-khoan/don-hang', label: 'Don hang', icon: ClipboardList, end: false },
  { to: '/tai-khoan/thong-tin', label: 'Thong tin tai khoan', icon: UserRound, end: false },
  { to: '/tai-khoan/esim', label: 'eSIM', icon: Smartphone, end: false },
  { to: '/tai-khoan/sim-thiet-bi', label: 'SIM va thiet bi', icon: Cpu, end: false },
  { to: '/tai-khoan/nap-them', label: 'Nap them', icon: Gauge, end: false },
  { to: '/tai-khoan/diem-thuong', label: 'Diem thuong', icon: Award, end: false },
  { to: '/tai-khoan/gioi-thieu', label: 'Gioi thieu', icon: UsersRound, end: false },
  { to: '/tai-khoan/thong-bao', label: 'Thong bao', icon: Bell, end: false },
];
