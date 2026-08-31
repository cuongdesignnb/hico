export interface LegacyVariant {
  id: string;
  sku?: string;
  dataLimit?: string;
  duration?: string;
  price: number;
  compareAtPrice?: number | null;
  wmproductId?: string;
  simType?: string;
  leSIM?: boolean | null;
}

export interface LegacyProduct {
  id: string;
  name: string;
  flag?: string;
  region?: string;
  network?: string;
  image?: string;
  imageMediaId?: string | null;
  price?: number;
  compareAtPrice?: number;
  guide?: string;
  description?: string;
  iconType?: 'region' | 'global';
  variants?: LegacyVariant[];
  images?: { id: number; url: string; title: string }[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface UserOrderItem {
  productName?: string;
  iccid?: string;
}

export interface UserOrder {
  orderId?: string;
  status?: string;
  simType?: string;
  createdAt?: string;
  items?: UserOrderItem[];
}

export interface EsimData {
  iccid: string;
  rcode: string;
  status: string;
  productName: string;
  network: string;
  usedData: number;
  totalData: number;
  expiry: string;
  device: string;
  qrcode: string;
  qrcodeContent: string;
  pin1: string;
  puk1: string;
  apnExplain: string;
}

export interface ProductReview {
  id: string | number;
  rating: number;
  createdAt: string;
  userName: string;
  userEmail?: string;
  content: string;
  images?: string[];
  productName?: string;
  productId?: string;
  userPhone?: string;
  status?: string;
}

export interface AdminShippingAddress {
  name?: string;
  phone?: string;
  address?: string;
  ward?: string;
  district?: string;
  city?: string;
}

export interface AdminOrderItem {
  iccid?: string;
  redemptionCode?: string;
  qrcode?: string;
  productName?: string;
}

export interface AdminOrder {
  orderId: string;
  email?: string;
  status?: string;
  simType?: string;
  shippingAddress?: AdminShippingAddress;
  items?: AdminOrderItem[];
  wmproductId?: string;
  productId?: string;
  qty?: number;
  createdAt?: string;
  trackingCode?: string;
}

export interface AdminCatalogItem extends LegacyProduct {
  sku?: string;
  coverage?: string;
  bestSeller?: boolean;
  featured?: boolean;
  category?: string;
  specs?: string;
  badge?: string;
  leSIM?: boolean;
  wmproductId?: string;
  dataLimit?: string;
  duration?: string;
  stock: number;
}

export interface AdminArticle {
  id: string;
  title?: string;
  image?: string;
  imageMediaId?: string | null;
  date?: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  status?: string;
  scheduledDate?: string;
}

export interface AdminCustomer {
  email: string;
  name?: string;
  phone?: string;
  status?: string;
  createdAt?: string;
}

export interface AdminPromo {
  code: string;
  discount?: string;
  description?: string;
  expiry?: string;
  status?: string;
}

export interface AdminTicketMessage {
  sender?: string;
  time?: string;
  text?: string;
}

export interface AdminTicket {
  ticketCode: string;
  title?: string;
  customer?: string;
  status?: string;
  messages?: AdminTicketMessage[];
  updateTime?: string;
}

export interface AdminUser {
  email: string;
  role: string;
  status: string;
  avatar: string;
  lastLogin: string;
}

export interface AdminMediaFile {
  id?: string;
  name?: string;
  url: string;
  filename: string;
  type?: string;
  size: number;
  date: string;
}

export interface ManualQr {
  id?: string;
  variantId?: string;
  assignedOrderId?: string;
  filename?: string;
  url?: string;
}
