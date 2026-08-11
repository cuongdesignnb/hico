import { randomUUID } from 'node:crypto';

const mapProfile = (row) => ({
  id: row.id,
  variantId: row.variant_id ?? row.variantId,
  provider: row.provider,
  regionCode: row.region_code ?? row.regionCode,
  medium: row.medium,
  dataPolicy: row.data_policy ?? row.dataPolicy,
  speedPolicy: row.speed_policy ?? row.speedPolicy,
  networkPolicy: row.network_policy ?? row.networkPolicy ?? null,
  activationPolicy: row.activation_policy ?? row.activationPolicy ?? null,
  resetPolicy: row.reset_policy ?? row.resetPolicy ?? null,
  operationType: row.operation_type ?? row.operationType,
  durationDays: row.duration_days ?? row.durationDays,
  familyKey: row.family_key ?? row.familyKey,
  status: row.status,
  source: row.source,
  createdBy: row.created_by ?? row.createdBy ?? null,
  createdAt: row.created_at ?? row.createdAt,
  updatedBy: row.updated_by ?? row.updatedBy ?? null,
  updatedAt: row.updated_at ?? row.updatedAt,
  version: row.version,
});

const conflictError = () => {
  const error = new Error('An active fulfillment profile already exists for this variant and provider.');
  error.code = 'FAMILY_PROFILE_CONFLICT';
  error.status = 409;
  return error;
};

const notFoundError = (message, code = 'FAMILY_PROFILE_NOT_FOUND', status = 404) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

export const createInMemoryFulfillmentProfileRepository = ({ now = () => new Date().toISOString(), idFactory = () => randomUUID() } = {}) => {
  const profiles = new Map();
  const events = [];
  const activeFor = (variantId, provider) => [...profiles.values()].find((item) => item.status === 'ACTIVE' && item.variantId === variantId && item.provider === provider) ?? null;
  return {
    async listActive(provider = 'WORLDMOVE') { return [...profiles.values()].filter((item) => item.status === 'ACTIVE' && item.provider === provider); },
    async list() { return [...profiles.values()]; },
    async getById(id) { return profiles.get(id) ?? null; },
    async findActiveByVariant(variantId, provider = 'WORLDMOVE') { return activeFor(variantId, provider); },
    async create(input, actor = {}) {
      const existing = activeFor(input.variantId, input.provider);
      if (existing) {
        if (existing.familyKey === input.familyKey && existing.durationDays === input.durationDays) return existing;
        throw conflictError();
      }
      const timestamp = now();
      const profile = { id: idFactory(), ...input, status: 'ACTIVE', version: 1, createdBy: actor.id ?? null, createdAt: timestamp, updatedBy: actor.id ?? null, updatedAt: timestamp };
      profiles.set(profile.id, profile);
      events.push({ profileId: profile.id, eventType: 'CREATE', actorId: actor.id ?? null, version: 1, createdAt: timestamp });
      return profile;
    },
    async update(id, input, actor = {}, expectedVersion) {
      const current = profiles.get(id);
      if (!current) throw notFoundError('Fulfillment profile was not found.');
      if (current.status !== 'ACTIVE') throw notFoundError('Fulfillment profile is no longer active.', 'FAMILY_PROFILE_REVOKED', 409);
      if (expectedVersion !== undefined && current.version !== expectedVersion) throw notFoundError('Fulfillment profile version is stale.', 'VERSION_CONFLICT', 409);
      const existing = activeFor(input.variantId ?? current.variantId, input.provider ?? current.provider);
      if (existing && existing.id !== id) throw conflictError();
      const next = { ...current, ...input, status: 'ACTIVE', version: current.version + 1, updatedBy: actor.id ?? null, updatedAt: now() };
      profiles.set(id, next);
      events.push({ profileId: id, eventType: 'UPDATE', actorId: actor.id ?? null, version: next.version, createdAt: next.updatedAt });
      return next;
    },
    async revoke(id, actor = {}, expectedVersion) {
      const current = profiles.get(id);
      if (!current) throw notFoundError('Fulfillment profile was not found.');
      if (expectedVersion !== undefined && current.version !== expectedVersion) throw notFoundError('Fulfillment profile version is stale.', 'VERSION_CONFLICT', 409);
      const next = { ...current, status: 'REVOKED', version: current.version + 1, updatedBy: actor.id ?? null, updatedAt: now() };
      profiles.set(id, next);
      events.push({ profileId: id, eventType: 'REVOKE', actorId: actor.id ?? null, version: next.version, createdAt: next.updatedAt });
      return next;
    },
    async listEvents(id) { return events.filter((event) => event.profileId === id); },
  };
};

export const createFulfillmentProfileRepository = ({ pool, now = () => new Date().toISOString(), idFactory = () => randomUUID() } = {}) => {
  if (!pool) return createInMemoryFulfillmentProfileRepository({ now, idFactory });
  return {
    async listActive(provider = 'WORLDMOVE') { const result = await pool.query("SELECT * FROM catalog_variant_fulfillment_profiles WHERE provider=$1 AND status='ACTIVE' ORDER BY created_at", [provider]); return result.rows.map(mapProfile); },
    async list() { const result = await pool.query('SELECT * FROM catalog_variant_fulfillment_profiles ORDER BY created_at'); return result.rows.map(mapProfile); },
    async getById(id) { const result = await pool.query('SELECT * FROM catalog_variant_fulfillment_profiles WHERE id=$1', [id]); return result.rows[0] ? mapProfile(result.rows[0]) : null; },
    async findActiveByVariant(variantId, provider = 'WORLDMOVE') { const result = await pool.query("SELECT * FROM catalog_variant_fulfillment_profiles WHERE variant_id=$1 AND provider=$2 AND status='ACTIVE'", [variantId, provider]); return result.rows[0] ? mapProfile(result.rows[0]) : null; },
    async create(input, actor = {}) {
      const id = idFactory();
      try {
        const result = await pool.query(`INSERT INTO catalog_variant_fulfillment_profiles (id,variant_id,provider,region_code,medium,data_policy,speed_policy,network_policy,activation_policy,reset_policy,operation_type,duration_days,family_key,status,source,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ACTIVE',$14,$15,$15) RETURNING *`, [id, input.variantId, input.provider, input.regionCode, input.medium, input.dataPolicy, input.speedPolicy, input.networkPolicy, input.activationPolicy, input.resetPolicy, input.operationType, input.durationDays, input.familyKey, input.source, actor.id ?? null]);
        return mapProfile(result.rows[0]);
      } catch (error) {
        if (error?.code === '23505') {
          const existing = await this.findActiveByVariant(input.variantId, input.provider);
          if (existing && existing.familyKey === input.familyKey && existing.durationDays === input.durationDays) return existing;
          throw conflictError();
        }
        throw error;
      }
    },
    async update(id, input, actor = {}, expectedVersion) {
      const result = await pool.query(`UPDATE catalog_variant_fulfillment_profiles SET region_code=$2,medium=$3,data_policy=$4,speed_policy=$5,network_policy=$6,activation_policy=$7,reset_policy=$8,operation_type=$9,duration_days=$10,family_key=$11,source=$12,updated_by=$13,updated_at=NOW(),version=version+1 WHERE id=$1 AND status='ACTIVE' AND ($14::integer IS NULL OR version=$14) RETURNING *`, [id, input.regionCode, input.medium, input.dataPolicy, input.speedPolicy, input.networkPolicy, input.activationPolicy, input.resetPolicy, input.operationType, input.durationDays, input.familyKey, input.source, actor.id ?? null, expectedVersion ?? null]);
      if (!result.rows[0]) { const current = await this.getById(id); throw notFoundError(current ? 'Fulfillment profile version is stale.' : 'Fulfillment profile was not found.', current ? 'VERSION_CONFLICT' : 'FAMILY_PROFILE_NOT_FOUND', current ? 409 : 404); }
      return mapProfile(result.rows[0]);
    },
    async revoke(id, actor = {}, expectedVersion) {
      const result = await pool.query(`UPDATE catalog_variant_fulfillment_profiles SET status='REVOKED',updated_by=$2,updated_at=NOW(),version=version+1 WHERE id=$1 AND status='ACTIVE' AND ($3::integer IS NULL OR version=$3) RETURNING *`, [id, actor.id ?? null, expectedVersion ?? null]);
      if (!result.rows[0]) { const current = await this.getById(id); throw notFoundError(current ? 'Fulfillment profile version is stale.' : 'Fulfillment profile was not found.', current ? 'VERSION_CONFLICT' : 'FAMILY_PROFILE_NOT_FOUND', current ? 409 : 404); }
      return mapProfile(result.rows[0]);
    },
    async listEvents(id) { const result = await pool.query('SELECT profile_id AS "profileId",event_type AS "eventType",actor_id AS "actorId",version,created_at AS "createdAt" FROM catalog_variant_fulfillment_profile_events WHERE profile_id=$1 ORDER BY created_at', [id]); return result.rows; },
  };
};
