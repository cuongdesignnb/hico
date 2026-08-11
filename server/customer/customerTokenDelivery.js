import nodemailer from 'nodemailer';

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const originFor = (env) => {
  try {
    return new URL(env.PUBLIC_SITE_URL).origin;
  } catch {
    return null;
  }
};

export const createCustomerTokenDelivery = ({ env = process.env, transport } = {}) => {
  const origin = originFor(env);
  const configured = Boolean(env.SMTP_HOST && env.SMTP_FROM && origin);
  const smtpTransport = transport ?? (configured ? nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number.parseInt(env.SMTP_PORT, 10) || 587,
    secure: String(env.SMTP_SECURE).toLowerCase() === 'true',
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } } : {}),
  }) : null);

  const send = async ({ email, subject, message, path, token }) => {
    if (!smtpTransport || !origin) return { delivered: false };
    const url = new URL(path, origin);
    url.searchParams.set('token', token);
    await smtpTransport.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject,
      text: `${message}\n\n${url.toString()}`,
      html: `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(url.toString())}">${escapeHtml(url.toString())}</a></p>`,
    });
    return { delivered: true };
  };

  return {
    sendVerification: ({ email, token }) => send({ email, token, subject: 'Xác thực tài khoản HICO', message: 'Hãy mở liên kết để xác thực tài khoản HICO của bạn.', path: '/xac-thuc-email' }),
    sendPasswordReset: ({ email, token }) => send({ email, token, subject: 'Đặt lại mật khẩu HICO', message: 'Hãy mở liên kết để đặt lại mật khẩu HICO của bạn.', path: '/dat-lai-mat-khau' }),
    sendOrderClaim: ({ email, token, orderId }) => send({ email, token, subject: 'Liên kết đơn hàng HICO', message: 'Hãy mở liên kết để xác nhận quyền truy cập đơn hàng HICO của bạn.', path: `/tai-khoan/don-hang/${encodeURIComponent(orderId)}/claim` }),
    sendContactChange: ({ email, token, contactType }) => send({ email, token, subject: `Xác nhận thay đổi ${String(contactType).toLowerCase()} HICO`, message: 'Hãy mở liên kết để xác nhận thay đổi thông tin liên hệ HICO.', path: '/tai-khoan/ho-so/xac-thuc-lien-he' }),
    getHealth: () => ({ configured }),
  };
};
