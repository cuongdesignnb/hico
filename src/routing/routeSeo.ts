const privatePrefixes = ['/tai-khoan', '/quan-tri', '/gio-hang', '/thanh-toan', '/404'];

export const isIndexableRoute = (pathname: string): boolean => !privatePrefixes.some(
  (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
);
