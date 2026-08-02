import { createJsonSessionStore } from './jsonSessionStore.js';
import { createPostgresSessionStore } from './postgresSessionStore.js';

export const sessionStoreDriver = (env = process.env) => String(env.SESSION_STORE_DRIVER ?? env.AUTH_STORE ?? 'json').toLowerCase();

export const createSessionStore = ({ env = process.env, uploadsDirectory, pool } = {}) => {
  const driver = sessionStoreDriver(env);
  if (driver === 'json') return { driver, shared: false, repository: createJsonSessionStore({ uploadsDirectory }) };
  if (driver === 'postgres') return { driver, shared: true, repository: createPostgresSessionStore({ pool }) };
  throw Object.assign(new Error('Unsupported session store driver.'), { code: 'SESSION_STORE_DRIVER_INVALID' });
};
