import { fileURLToPath } from 'node:url';
import { createPostgresPool } from '../database/postgresPool.js';
import { createSessionService } from '../auth/sessionService.js';
import { createPostgresCustomerRepository } from '../customer/customerRepository.js';
import { createPostgresCustomerSessionRepository } from '../customer/customerSessionRepository.js';
import { createCustomerAuthReadiness } from '../customer/customerAuthReadiness.js';
import { createCustomerTokenDelivery } from '../customer/customerTokenDelivery.js';

export const validateCustomerAuth = async ({ env = process.env } = {}) => {
  let pool;
  try {
    pool = env.DATABASE_URL ? createPostgresPool({ env }) : null;
    const customerRepository = pool ? createPostgresCustomerRepository({ pool }) : null;
    const customerSessionRepository = pool ? createPostgresCustomerSessionRepository({ pool }) : null;
    const sessionService = customerSessionRepository ? createSessionService({
      sessionRepository: customerSessionRepository,
      sessionSecret: env.CUSTOMER_SESSION_SECRET ?? env.SESSION_SECRET ?? '',
      csrfSecret: env.CUSTOMER_CSRF_SECRET ?? env.CSRF_SECRET ?? '',
      env,
    }) : null;
    const readiness = await createCustomerAuthReadiness({
      env,
      pool,
      customerRepository,
      customerSessionRepository,
      sessionService,
      tokenDelivery: createCustomerTokenDelivery({ env }),
    }).evaluate();
    return readiness;
  } finally {
    await pool?.end();
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateCustomerAuth();
  console.log(JSON.stringify(result));
  if (result.status !== 'healthy') process.exitCode = 1;
}
