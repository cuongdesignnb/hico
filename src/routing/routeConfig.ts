export const publicRoutePaths = {
  home: '/',
  products: '/san-pham',
  destinations: '/diem-den',
  articles: '/bai-viet',
  cart: '/gio-hang',
  checkout: '/thanh-toan',
} as const;

export const privateRoutePaths = {
  account: '/tai-khoan',
  admin: '/quan-tri',
} as const;
