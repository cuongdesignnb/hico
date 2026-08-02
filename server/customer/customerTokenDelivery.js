import nodemailer from 'nodemailer';

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

  const send = async ({ email, subject, path, token }) => {
    if (!smtpTransport || !origin) return { delivered: false };
    const url = new URL(path, origin);
    url.searchParams.set('token', token);
    await smtpTransport.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject,
      text: url.toString(),
    });
    return { delivered: true };
  };

  return {
    sendVerification: ({ email, token }) => send({ email, token, subject: 'Verify your HICO account', path: '/xac-thuc-email' }),
    sendPasswordReset: ({ email, token }) => send({ email, token, subject: 'Reset your HICO password', path: '/dat-lai-mat-khau' }),
    getHealth: () => ({ configured }),
  };
};
