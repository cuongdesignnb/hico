const encode = (value) => encodeURIComponent(value);

const attributes = ({ httpOnly = false, maxAgeSeconds, secure }) => [
  'Path=/',
  `Max-Age=${maxAgeSeconds}`,
  'SameSite=Lax',
  ...(httpOnly ? ['HttpOnly'] : []),
  ...(secure ? ['Secure'] : []),
].join('; ');

export const createCustomerAuthCookies = ({ env = process.env } = {}) => {
  const secure = env.NODE_ENV === 'production';
  const sessionTtl = Math.max(60, (Number.parseInt(env.CUSTOMER_AUTH_SESSION_TTL_MINUTES ?? env.AUTH_SESSION_TTL_MINUTES, 10) || 30) * 60);
  return {
    set(res, { token, csrfToken }) {
      res.append('Set-Cookie', `hico_customer_session=${encode(token)}; ${attributes({ httpOnly: true, maxAgeSeconds: sessionTtl, secure })}`);
      res.append('Set-Cookie', `hico_customer_csrf=${encode(csrfToken)}; ${attributes({ maxAgeSeconds: sessionTtl, secure })}`);
    },
    clear(res) {
      res.append('Set-Cookie', `hico_customer_session=; ${attributes({ httpOnly: true, maxAgeSeconds: 0, secure })}`);
      res.append('Set-Cookie', `hico_customer_csrf=; ${attributes({ maxAgeSeconds: 0, secure })}`);
    },
  };
};
