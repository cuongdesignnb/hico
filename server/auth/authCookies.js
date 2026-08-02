const encode = (value) => encodeURIComponent(value);

const attributes = ({ httpOnly = false, maxAgeSeconds, secure }) => [
  'Path=/',
  `Max-Age=${maxAgeSeconds}`,
  'SameSite=Lax',
  ...(httpOnly ? ['HttpOnly'] : []),
  ...(secure ? ['Secure'] : []),
].join('; ');

export const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => {
  const [name, ...value] = part.trim().split('=');
  return [name, decodeURIComponent(value.join('='))];
}).filter(([name]) => name));

export const createAuthCookies = ({ env = process.env } = {}) => {
  const secure = env.NODE_ENV === 'production';
  const sessionTtl = Math.max(60, (Number.parseInt(env.AUTH_SESSION_TTL_MINUTES, 10) || 30) * 60);
  return {
    set(res, { token, csrfToken }) {
      res.append('Set-Cookie', `hico_admin_session=${encode(token)}; ${attributes({ httpOnly: true, maxAgeSeconds: sessionTtl, secure })}`);
      res.append('Set-Cookie', `hico_csrf=${encode(csrfToken)}; ${attributes({ maxAgeSeconds: sessionTtl, secure })}`);
    },
    clear(res) {
      res.append('Set-Cookie', `hico_admin_session=; ${attributes({ httpOnly: true, maxAgeSeconds: 0, secure })}`);
      res.append('Set-Cookie', `hico_csrf=; ${attributes({ maxAgeSeconds: 0, secure })}`);
    },
  };
};
