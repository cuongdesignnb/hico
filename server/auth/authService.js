import { randomUUID } from 'node:crypto';
import { hashPassword, validatePassword, verifyPassword } from './passwordService.js';
import { normalizeEmail } from './userRepository.js';
import { permissionsForRoles } from '../security/permissions.js';

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  roles: user.roles,
  permissions: permissionsForRoles(user.roles),
});

export const createAuthService = ({ userRepository, sessionService, env = process.env, now = () => new Date(), securityAudit = () => {} } = {}) => {
  const maxFailedLogins = Math.max(1, Number.parseInt(env.AUTH_MAX_FAILED_LOGINS, 10) || 5);
  const lockMinutes = Math.max(1, Number.parseInt(env.AUTH_LOCK_MINUTES, 10) || 15);

  const ensureBootstrap = async () => {
    const users = await userRepository.list();
    if (users.length > 0) return false;
    const email = normalizeEmail(env.ADMIN_BOOTSTRAP_EMAIL);
    const password = env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!email || !validatePassword(password).valid) return false;
    const timestamp = now().toISOString();
    const bootstrapUser = {
      id: randomUUID(),
      email,
      displayName: env.ADMIN_BOOTSTRAP_DISPLAY_NAME || 'Bootstrap Administrator',
      passwordHash: await hashPassword(password),
      roles: ['super_admin'],
      status: 'active',
      failedLoginCount: 0,
      lockedUntil: null,
      passwordChangedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const created = userRepository.createIfEmpty
      ? await userRepository.createIfEmpty(bootstrapUser)
      : await userRepository.create(bootstrapUser);
    if (!created) return false;
    securityAudit({ event: 'auth_bootstrap_created' });
    return true;
  };

  return {
    ensureBootstrap,
    publicUser,
    async login({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const user = await userRepository.findByEmail(normalizedEmail);
      const timestamp = now();
      const invalid = async () => {
        if (user) {
          const failedLoginCount = Number(user.failedLoginCount || 0) + 1;
          const lockedUntil = failedLoginCount >= maxFailedLogins
            ? new Date(timestamp.getTime() + lockMinutes * 60_000).toISOString()
            : null;
          await userRepository.update(user.id, { failedLoginCount, lockedUntil, status: lockedUntil ? 'locked' : user.status, updatedAt: timestamp.toISOString() });
        }
        securityAudit({ event: 'auth_login_failed', emailHash: normalizedEmail ? 'present' : 'missing' });
        return null;
      };
      if (!user || user.status === 'disabled') return invalid();
      if (user.status === 'locked' && user.lockedUntil && Date.parse(user.lockedUntil) > timestamp.getTime()) return invalid();
      if (!await verifyPassword(String(password ?? ''), user.passwordHash)) return invalid();
      const activeUser = await userRepository.update(user.id, { status: 'active', failedLoginCount: 0, lockedUntil: null, updatedAt: timestamp.toISOString() });
      const credentials = await sessionService.create(activeUser.id);
      securityAudit({ event: 'auth_login_success', actorId: activeUser.id });
      return { user: publicUser(activeUser), credentials };
    },
    async authenticate(token) {
      const validation = await sessionService.validate(token);
      if (validation.status !== 'active') return validation;
      const user = await userRepository.findById(validation.session.userId);
      if (!user || user.status !== 'active') {
        await sessionService.revoke(validation.session, 'user_not_active');
        return { status: 'revoked' };
      }
      return { status: 'active', session: validation.session, user: publicUser(user), rawUser: user };
    },
    async changePassword(rawUser, currentPassword, nextPassword) {
      if (!await verifyPassword(String(currentPassword ?? ''), rawUser.passwordHash)) return false;
      const passwordHash = await hashPassword(nextPassword);
      await userRepository.update(rawUser.id, { passwordHash, passwordChangedAt: now().toISOString(), updatedAt: now().toISOString() });
      await sessionService.revokeAll(rawUser.id, 'password_changed');
      securityAudit({ event: 'auth_password_changed', actorId: rawUser.id });
      return true;
    },
  };
};
