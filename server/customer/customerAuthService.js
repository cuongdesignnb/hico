import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { hashPassword, validatePassword, verifyPassword } from '../auth/passwordService.js';
import { normalizeEmail } from '../auth/userRepository.js';

const tokenHash = (token, secret) => createHmac('sha256', secret).update(token).digest('hex');
const minutes = (value, fallback) => Math.max(1, Number.parseInt(value, 10) || fallback);
const normalizePhone = (phone) => {
  if (typeof phone !== 'string') return null;
  const normalized = phone.replace(/[\s().-]/g, '');
  return normalized || null;
};
const publicCustomer = (customer) => ({
  id: customer.id,
  email: customer.email,
  displayName: customer.profile?.displayName ?? '',
  phone: customer.profile?.phone ?? null,
  emailVerified: Boolean(customer.emailVerifiedAt),
  status: customer.status,
});

const codedError = (code, message) => Object.assign(new Error(message), { code });

export const createCustomerAuthService = ({
  customerRepository,
  customerSessionRepository,
  sessionService,
  tokenDelivery = {},
  env = process.env,
  now = () => new Date(),
  securityAudit = () => {},
} = {}) => {
  const maxFailedLogins = Math.max(1, Number.parseInt(env.CUSTOMER_AUTH_MAX_FAILED_LOGINS ?? env.AUTH_MAX_FAILED_LOGINS, 10) || 5);
  const lockMinutes = minutes(env.CUSTOMER_AUTH_LOCK_MINUTES ?? env.AUTH_LOCK_MINUTES, 15);
  const tokenSecret = env.CUSTOMER_TOKEN_SECRET ?? env.CUSTOMER_SESSION_SECRET ?? env.SESSION_SECRET ?? '';
  const verificationMinutes = minutes(env.CUSTOMER_EMAIL_VERIFICATION_TTL_MINUTES, 60);
  const resetMinutes = minutes(env.CUSTOMER_PASSWORD_RESET_TTL_MINUTES, 30);

  const audit = async (eventType, customerId, requestId) => {
    securityAudit({ event: eventType.toLowerCase(), actorId: customerId, requestId });
    await customerRepository.createSecurityEvent?.({
      id: randomUUID(),
      customerId,
      eventType,
      requestId,
      metadata: {},
      createdAt: now().toISOString(),
    });
  };

  const issueToken = async (table, customerId, ttlMinutes) => {
    const createdAt = now();
    const token = randomBytes(32).toString('base64url');
    await customerRepository.revokeActiveTokens(table, customerId);
    await customerRepository.createToken(table, {
      id: randomUUID(),
      customerId,
      tokenHash: tokenHash(token, tokenSecret),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + ttlMinutes * 60_000).toISOString(),
    });
    return token;
  };

  return {
    publicCustomer,
    async register({ email, password, displayName, phone, requestId }) {
      const normalizedEmail = normalizeEmail(email);
      const passwordValidation = validatePassword(password);
      if (!normalizedEmail || !passwordValidation.valid || !String(displayName ?? '').trim()) {
        throw codedError('VALIDATION_ERROR', passwordValidation.valid ? 'Invalid registration input.' : passwordValidation.error);
      }
      if (await customerRepository.findByEmail(normalizedEmail)) {
        throw codedError('CUSTOMER_ALREADY_EXISTS', 'A customer account already exists.');
      }

      const timestamp = now().toISOString();
      const customer = await customerRepository.create({
        customer: {
          id: randomUUID(),
          email: normalizedEmail,
          passwordHash: await hashPassword(password),
          status: 'pending_verification',
          emailVerifiedAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          passwordChangedAt: timestamp,
          credentialVersion: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        profile: {
          displayName: String(displayName).trim().slice(0, 160),
          phone: normalizePhone(phone),
        },
      });
      const verificationToken = await issueToken('customer_email_verifications', customer.id, verificationMinutes);
      await tokenDelivery.sendVerification?.({ email: customer.email, displayName: customer.profile.displayName, token: verificationToken });
      await audit('CUSTOMER_REGISTER', customer.id, requestId);
      return { customer: publicCustomer(customer), verificationToken };
    },
    async login({ email, password, requestId }) {
      const customer = await customerRepository.findByEmail(normalizeEmail(email));
      const timestamp = now();
      const invalid = async () => {
        if (customer) {
          const failedLoginCount = Number(customer.failedLoginCount || 0) + 1;
          const lockedUntil = failedLoginCount >= maxFailedLogins
            ? new Date(timestamp.getTime() + lockMinutes * 60_000).toISOString()
            : null;
          await customerRepository.update(customer.id, {
            failedLoginCount,
            lockedUntil,
            status: lockedUntil ? 'locked' : customer.status,
            updatedAt: timestamp.toISOString(),
          });
        }
        await audit('CUSTOMER_LOGIN_FAILURE', customer?.id, requestId);
        return null;
      };

      if (!customer || customer.status !== 'active' || !customer.emailVerifiedAt) return invalid();
      if (customer.lockedUntil && Date.parse(customer.lockedUntil) > timestamp.getTime()) return invalid();
      if (!await verifyPassword(String(password ?? ''), customer.passwordHash)) return invalid();

      const activeCustomer = await customerRepository.update(customer.id, {
        status: 'active',
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: timestamp.toISOString(),
      });
      const credentials = await sessionService.create(activeCustomer.id);
      await audit('CUSTOMER_LOGIN_SUCCESS', activeCustomer.id, requestId);
      return { customer: publicCustomer(activeCustomer), credentials };
    },
    async authenticate(token, requestId) {
      const validation = await sessionService.validate(token);
      if (validation.status !== 'active') return validation;
      const customer = await customerRepository.findById(validation.session.userId);
      if (!customer || customer.status !== 'active' || !customer.emailVerifiedAt) {
        await sessionService.revoke(validation.session, 'customer_not_active');
        return { status: 'revoked' };
      }
      return { status: 'active', session: validation.session, customer: publicCustomer(customer), rawCustomer: customer, requestId };
    },
    async refresh(session, customerId, requestId) {
      const credentials = await sessionService.rotate(session);
      if (!credentials) {
        await audit('CUSTOMER_REFRESH_REPLAYED', customerId, requestId);
        return null;
      }
      await audit('CUSTOMER_REFRESH_ROTATED', customerId, requestId);
      return credentials;
    },
    async logout(session, customerId, requestId) {
      await sessionService.revoke(session, 'logout');
      await audit('CUSTOMER_LOGOUT', customerId, requestId);
    },
    async listSessions(customerId) {
      const sessions = await customerSessionRepository.listByUserId(customerId);
      return sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
      }));
    },
    async revokeSession(sessionId, customerId, requestId) {
      const session = await customerSessionRepository.revokeOwnedSession(sessionId, customerId, 'customer_session_revoked');
      if (!session) return null;
      await audit('CUSTOMER_SESSION_REVOKED', customerId, requestId);
      return session;
    },
    async logoutAll(customerId, requestId) {
      await sessionService.revokeAll(customerId, 'customer_logout_all');
      await audit('CUSTOMER_LOGOUT_ALL', customerId, requestId);
    },
    async requestPasswordReset({ email, requestId }) {
      const customer = await customerRepository.findByEmail(normalizeEmail(email));
      if (!customer || customer.status === 'disabled') {
        await audit('CUSTOMER_PASSWORD_RESET_REQUESTED', undefined, requestId);
        return { accepted: true };
      }
      const token = await issueToken('customer_password_resets', customer.id, resetMinutes);
      await tokenDelivery.sendPasswordReset?.({ email: customer.email, displayName: customer.profile.displayName, token });
      await audit('CUSTOMER_PASSWORD_RESET_REQUESTED', customer.id, requestId);
      return { accepted: true };
    },
    async resetPassword({ token, password, requestId }) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) throw codedError('VALIDATION_ERROR', passwordValidation.error);
      const hash = tokenHash(String(token ?? ''), tokenSecret);
      const timestamp = now().toISOString();
      const customerId = await customerRepository.consumeToken('customer_password_resets', hash, timestamp);
      if (!customerId) {
        const state = await customerRepository.tokenState('customer_password_resets', hash, timestamp);
        throw codedError(state === 'expired' ? 'PASSWORD_RESET_TOKEN_EXPIRED' : 'PASSWORD_RESET_TOKEN_INVALID', 'Password reset token is invalid or expired.');
      }
      await customerRepository.update(customerId, {
        passwordHash: await hashPassword(password),
        passwordChangedAt: timestamp,
        credentialVersion: 2,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: timestamp,
      });
      await sessionService.revokeAll(customerId, 'password_reset');
      await audit('CUSTOMER_PASSWORD_RESET_COMPLETED', customerId, requestId);
    },
    async verifyEmail({ token, requestId }) {
      const hash = tokenHash(String(token ?? ''), tokenSecret);
      const timestamp = now().toISOString();
      const customerId = await customerRepository.consumeToken('customer_email_verifications', hash, timestamp);
      if (!customerId) {
        const state = await customerRepository.tokenState('customer_email_verifications', hash, timestamp);
        throw codedError(state === 'expired' ? 'VERIFICATION_TOKEN_EXPIRED' : 'VERIFICATION_TOKEN_INVALID', 'Verification token is invalid or expired.');
      }
      const customer = await customerRepository.update(customerId, {
        status: 'active',
        emailVerifiedAt: timestamp,
        updatedAt: timestamp,
      });
      await audit('CUSTOMER_EMAIL_VERIFIED', customerId, requestId);
      return publicCustomer(customer);
    },
  };
};
