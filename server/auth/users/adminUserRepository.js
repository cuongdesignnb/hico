import { createJsonAdminUserRepository } from './jsonAdminUserRepository.js';
import { createPostgresAdminUserRepository } from './postgresAdminUserRepository.js';
import { sessionStoreDriver } from '../session/sessionStore.js';

export const createAdminUserRepository = ({ env = process.env, uploadsDirectory, pool } = {}) => {
  const driver = sessionStoreDriver(env);
  if (driver === 'json') return { driver, shared: false, repository: createJsonAdminUserRepository({ uploadsDirectory }) };
  if (driver === 'postgres') return { driver, shared: true, repository: createPostgresAdminUserRepository({ pool }) };
  throw Object.assign(new Error('Unsupported user repository driver.'), { code: 'ADMIN_USER_STORE_DRIVER_INVALID' });
};
