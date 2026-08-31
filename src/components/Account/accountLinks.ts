import { Award, Bell, ClipboardList, Cpu, Gauge, LayoutDashboard, LockKeyhole, MapPin, MessageCircle, Smartphone, UserRound, UsersRound } from 'lucide-react';
import { viAccount } from '../../i18n/vi/account';

export const accountLinks = [
  { to: '/tai-khoan', label: viAccount.overview, icon: LayoutDashboard, end: true },
  { to: '/tai-khoan/don-hang', label: viAccount.orders, icon: ClipboardList, end: false },
  { to: '/tai-khoan/ho-so', label: 'Thông tin tài khoản', icon: UserRound, end: false },
  { to: '/tai-khoan/dia-chi', label: viAccount.addresses, icon: MapPin, end: false },
  { to: '/tai-khoan/bao-mat', label: viAccount.security, icon: LockKeyhole, end: false },
  { to: '/tai-khoan/esim', label: 'eSIM', icon: Smartphone, end: false },
  { to: '/tai-khoan/sim-thiet-bi', label: viAccount.assets, icon: Cpu, end: false },
  { to: '/tai-khoan/nap-them', label: viAccount.topups, icon: Gauge, end: false },
  { to: '/tai-khoan/diem-thuong', label: viAccount.loyalty, icon: Award, end: false },
  { to: '/tai-khoan/gioi-thieu', label: viAccount.referrals, icon: UsersRound, end: false },
  { to: '/tai-khoan/thong-bao', label: viAccount.notifications, icon: Bell, end: false },
  { to: '/tai-khoan/ho-tro', label: viAccount.support, icon: MessageCircle, end: false },
];
