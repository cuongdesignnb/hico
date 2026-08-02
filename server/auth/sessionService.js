import { createHmac, randomBytes, randomUUID } from 'node:crypto';

const hashValue = (value, secret) => createHmac('sha256', secret).update(value).digest('hex');
const minutes = (value, fallback) => Math.max(1, Number.parseInt(value, 10) || fallback);

export const createSessionService = ({
  sessionRepository,
  sessionSecret = '',
  csrfSecret = sessionSecret,
  env = process.env,
  now = () => new Date(),
} = {}) => {
  const sessionTtlMinutes = minutes(env.AUTH_SESSION_TTL_MINUTES, 30);
  const absoluteTtlMinutes = minutes(env.AUTH_ABSOLUTE_TTL_MINUTES, 480);
  const previousSessionSecrets = String(env.SESSION_SECRET_PREVIOUS ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const previousCsrfSecrets = String(env.CSRF_SECRET_PREVIOUS ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const tokenHash = (token) => hashValue(token, sessionSecret);
  const csrfHash = (token) => hashValue(token, csrfSecret);
  const tokenHashCandidates = (token) => [sessionSecret, ...previousSessionSecrets].filter(Boolean).map((secret) => hashValue(token, secret));
  const csrfHashCandidates = (token) => [csrfSecret, ...previousCsrfSecrets].filter(Boolean).map((secret) => hashValue(token, secret));

  const create = async (userId) => {
    const issuedAt = now();
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const session = {
      id: randomUUID(),
      userId,
      tokenHash: tokenHash(token),
      csrfTokenHash: csrfHash(csrfToken),
      createdAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + sessionTtlMinutes * 60_000).toISOString(),
      absoluteExpiresAt: new Date(issuedAt.getTime() + absoluteTtlMinutes * 60_000).toISOString(),
      lastSeenAt: issuedAt.toISOString(),
      revokedAt: null,
    };
    await sessionRepository.create(session);
    return { session, token, csrfToken };
  };

  const validate = async (token) => {
    if (!token) return { status: 'missing' };
    let session = null;
    for (const candidate of tokenHashCandidates(token)) {
      session = await sessionRepository.findByTokenHash(candidate);
      if (session) break;
    }
    if (!session) return { status: 'missing' };
    const timestamp = now().getTime();
    if (session.revokedAt) return { status: 'revoked', session };
    if (Date.parse(session.expiresAt) <= timestamp || Date.parse(session.absoluteExpiresAt) <= timestamp) {
      await sessionRepository.revokeById(session.id, 'expired');
      return { status: 'expired', session };
    }
    await sessionRepository.update(session.id, { lastSeenAt: now().toISOString() });
    return { status: 'active', session };
  };

  return {
    create,
    validate,
    async rotate(session) {
      const revoked = sessionRepository.revokeIfActive
        ? await sessionRepository.revokeIfActive(session.id, 'rotated')
        : true;
      if (!revoked) return null;
      return create(session.userId);
    },
    async revoke(session, reason = 'logout') { await sessionRepository.revokeById(session.id, reason); },
    async revokeAll(userId, reason = 'revoke_all') { await sessionRepository.revokeByUserId(userId, reason); },
    async revokeEverySession(reason = 'global_revoke') { await sessionRepository.revokeAll(reason); },
    validCsrf(session, csrfToken) { return Boolean(csrfToken) && csrfHashCandidates(csrfToken).includes(session.csrfTokenHash); },
    sessionIdHash(session) { return hashValue(session.id, sessionSecret).slice(0, 16); },
    keyRotation: () => ({ active: Boolean(sessionSecret && csrfSecret), previousKeysConfigured: previousSessionSecrets.length > 0 || previousCsrfSecrets.length > 0 }),
  };
};
