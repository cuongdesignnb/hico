import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { normalizeEmail } from '../auth/userRepository.js';

const codeError = (code, message) => Object.assign(new Error(message), { code });
const trim = (value, max = 255) => String(value ?? '').trim().slice(0, max);
const normalizePhone = (value) => {
  const normalized = String(value ?? '').replace(/[\s().-]/g, '');
  return /^\+?[0-9]{7,20}$/.test(normalized) ? normalized : null;
};
const hashToken = (token, secret) => createHmac('sha256', secret).update(token).digest('hex');
const safeText = (value, max) => {
  const result = trim(value, max);
  return result && !/[<>]/.test(result) ? result : null;
};
const publicProfile = (profile) => profile && ({
  customerId: profile.customerId,
  email: profile.email,
  emailVerified: Boolean(profile.emailVerifiedAt),
  phone: profile.phone,
  phoneVerified: Boolean(profile.phoneVerifiedAt),
  displayName: profile.displayName,
  locale: profile.locale,
  timezone: profile.timezone,
  avatarUrl: profile.avatarUrl,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

export const createCustomerProfileService = ({
  repository,
  customerRepository,
  customerSessionRepository,
  tokenDelivery = {},
  notificationEventProcessor = null,
  env = process.env,
  securityAudit = () => {},
  now = () => new Date(),
} = {}) => {
  const enabled = String(env.CUSTOMER_PROFILE_ENABLED ?? '').toLowerCase() === 'true';
  const tokenSecret = env.CUSTOMER_TOKEN_SECRET ?? env.CUSTOMER_SESSION_SECRET ?? env.SESSION_SECRET ?? '';
  const ttlMinutes = Math.max(5, Number.parseInt(env.CUSTOMER_CONTACT_CHANGE_TTL_MINUTES, 10) || 30);
  const requireReady = () => { if (!enabled) throw codeError('PROFILE_NOT_READY', 'Customer profile is unavailable.'); };
  const audit = async (eventType, customerId, requestId, metadata = {}) => {
    securityAudit({ event: eventType.toLowerCase(), actorId: customerId, requestId });
    await customerRepository?.createSecurityEvent?.({ id: randomUUID(), customerId, eventType, requestId, metadata, createdAt: now().toISOString() });
  };
  const notify = async (event) => { try { await notificationEventProcessor?.emit?.(event); } catch { /* notification failure must not change the account mutation */ } };

  return {
    enabled,
    contactChangeOwnerScoped: true,
    addressOwnerScoped: true,
    demoImportBlocked: true,
    async get(customerId) { requireReady(); const profile = await repository.getProfile(customerId); if (!profile) throw codeError('PROFILE_NOT_FOUND', 'Customer profile was not found.'); return publicProfile(profile); },
    async update(customerId, input, requestId) {
      requireReady();
      const updates = {};
      if (Object.hasOwn(input, 'displayName')) {
        const value = safeText(input.displayName, 160);
        if (!value) throw codeError('PROFILE_UPDATE_INVALID', 'Display name is invalid.');
        updates.displayName = value;
      }
      for (const key of ['locale', 'timezone']) if (Object.hasOwn(input, key)) {
        const value = safeText(input[key], 80);
        if (!value) throw codeError('PROFILE_UPDATE_INVALID', `${key} is invalid.`);
        updates[key] = value;
      }
      if (Object.hasOwn(input, 'avatarUrl')) {
        const value = input.avatarUrl == null || input.avatarUrl === '' ? null : safeText(input.avatarUrl, 500);
        if (input.avatarUrl && (!value || !value.startsWith('/'))) throw codeError('PROFILE_UPDATE_INVALID', 'Avatar URL is invalid.');
        updates.avatarUrl = value;
      }
      if (!Object.keys(updates).length) throw codeError('PROFILE_UPDATE_INVALID', 'No editable profile fields were provided.');
      const profile = await repository.updateProfile(customerId, updates);
      if (!profile) throw codeError('PROFILE_NOT_FOUND', 'Customer profile was not found.');
      await audit('SECURITY_PROFILE_CHANGED', customerId, requestId, { fields: Object.keys(updates) });
      await notify({ customerId, type: 'SECURITY_PROFILE_CHANGED', entityType: 'CUSTOMER_PROFILE', entityId: customerId, eventVersion: profile.updatedAt, actionPath: '/tai-khoan/ho-so' });
      return publicProfile(profile);
    },
    async requestContactChange({ customerId, contactType, value, requestId }) {
      requireReady();
      const normalizedType = String(contactType ?? '').toUpperCase();
      if (normalizedType === 'PHONE') throw codeError('CONTACT_CHANGE_NOT_READY', 'Phone verification is unavailable until an SMS provider is configured.');
      if (normalizedType !== 'EMAIL') throw codeError('CONTACT_CHANGE_NOT_READY', 'Contact verification is unavailable.');
      const normalized = normalizeEmail(value);
      if (!normalized) throw codeError('CONTACT_CHANGE_NOT_READY', 'A valid email address is required.');
      const current = await repository.getProfile(customerId);
      if (!current) throw codeError('PROFILE_NOT_FOUND', 'Customer profile was not found.');
      if (normalized === current.email || await customerRepository.findByEmail(normalized)) throw codeError('CONTACT_ALREADY_IN_USE', 'This email address is already in use.');
      if (!tokenSecret) throw codeError('CONTACT_CHANGE_NOT_READY', 'Contact verification is unavailable.');
      const timestamp = now();
      const token = randomBytes(32).toString('base64url');
      await repository.createContactChange({ customerId, contactType: normalizedType, newValueNormalized: normalized, tokenHash: hashToken(token, tokenSecret), expiresAt: new Date(timestamp.getTime() + ttlMinutes * 60_000).toISOString(), createdAt: timestamp.toISOString() });
      await tokenDelivery.sendContactChange?.({ email: normalized, token, contactType: normalizedType });
      await audit('CUSTOMER_CONTACT_CHANGE_REQUESTED', customerId, requestId, { contactType: normalizedType });
      return { accepted: true };
    },
    async confirmContactChange({ token, requestId }) {
      requireReady();
      if (!tokenSecret || !token) throw codeError('CONTACT_CHANGE_TOKEN_INVALID', 'Contact change token is invalid.');
      const result = await repository.consumeContactChange(hashToken(String(token), tokenSecret), now().toISOString());
      if (!result) throw codeError('CONTACT_CHANGE_TOKEN_INVALID', 'Contact change token is invalid.');
      if (result.invalid) throw codeError(result.state === 'EXPIRED' ? 'CONTACT_CHANGE_TOKEN_EXPIRED' : result.state === 'CONTACT_ALREADY_IN_USE' ? 'CONTACT_ALREADY_IN_USE' : 'CONTACT_CHANGE_TOKEN_INVALID', 'Contact change token is invalid or expired.');
      if (customerSessionRepository?.revokeOtherSessions) await customerSessionRepository.revokeOtherSessions(result.customerId, '', 'contact_changed');
      await audit('CUSTOMER_CONTACT_CHANGED', result.customerId, requestId, { contactType: result.contactType });
      await notify({ customerId: result.customerId, type: 'SECURITY_PROFILE_CHANGED', entityType: 'CUSTOMER_PROFILE', entityId: result.customerId, eventVersion: result.contactType, actionPath: '/tai-khoan/ho-so' });
      return { confirmed: true };
    },
    async listAddresses(customerId) { requireReady(); return repository.listAddresses(customerId); },
    async createAddress(customerId, input) { requireReady(); return repository.createAddress(customerId, validateAddress(input)); },
    async updateAddress(customerId, id, input) { requireReady(); const result = await repository.updateAddress(customerId, id, validateAddress(input, true)); if (!result) throw codeError('ADDRESS_NOT_FOUND', 'Address was not found.'); return result; },
    async setDefaultAddress(customerId, id) { requireReady(); const result = await repository.setDefaultAddress(customerId, id); if (!result) throw codeError('ADDRESS_NOT_FOUND', 'Address was not found.'); return result; },
    async deleteAddress(customerId, id) { requireReady(); const result = await repository.deleteAddress(customerId, id); if (!result) throw codeError('ADDRESS_NOT_FOUND', 'Address was not found.'); return result; },
    async listSecurityEvents(customerId, query) { requireReady(); return repository.listSecurityEvents(customerId, query); },
    async recordSecurityEvent({ customerId, eventType, notificationType, requestId, actionPath = '/tai-khoan/bao-mat' }) {
      requireReady();
      await audit(eventType, customerId, requestId);
      await notify({ customerId, type: notificationType, entityType: 'CUSTOMER_SECURITY', entityId: customerId, eventVersion: now().toISOString(), actionPath });
    },
    async health() { if (!enabled) return { status: 'disabled', enabled: false }; return { ...(await repository.health()), enabled: true }; },
  };
};

const validateAddress = (input = {}, partial = false) => {
  const fields = {
    recipientName: 'recipientName', phone: 'phone', addressLine1: 'addressLine1', addressLine2: 'addressLine2', ward: 'ward', district: 'district', city: 'city', countryCode: 'countryCode', postalCode: 'postalCode',
  };
  const result = {};
  for (const [key, source] of Object.entries(fields)) if (!partial || Object.hasOwn(input, source)) {
    const value = input[source] == null ? null : safeText(input[source], key === 'addressLine1' ? 250 : 120);
    if (!partial && ['recipientName', 'addressLine1', 'city'].includes(key) && !value) throw codeError('ADDRESS_VALIDATION_FAILED', 'Required address fields are invalid.');
    if (value === null && !['addressLine2', 'ward', 'district', 'postalCode', 'phone'].includes(key)) throw codeError('ADDRESS_VALIDATION_FAILED', 'Address fields are invalid.');
    if (key === 'phone' && value && !normalizePhone(value)) throw codeError('ADDRESS_VALIDATION_FAILED', 'Address phone is invalid.');
    result[key] = key === 'phone' && value ? normalizePhone(value) : value;
  }
  if (Object.hasOwn(input, 'isDefault')) result.isDefault = Boolean(input.isDefault);
  if (result.countryCode && !/^[A-Z]{2}$/.test(result.countryCode.toUpperCase())) throw codeError('ADDRESS_VALIDATION_FAILED', 'Country code is invalid.');
  if (result.countryCode) result.countryCode = result.countryCode.toUpperCase();
  return result;
};

export { publicProfile, normalizePhone, validateAddress };
