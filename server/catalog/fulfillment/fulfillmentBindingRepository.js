import { randomUUID } from 'node:crypto';

const mapBinding = (row) => ({
  id: row.id,
  variantId: row.variant_id ?? row.variantId,
  provider: row.provider,
  strategy: row.strategy,
  providerOfferId: row.provider_offer_id ?? row.providerOfferId,
  familyKey: row.family_key ?? row.familyKey,
  requestedDays: row.requested_days ?? row.requestedDays,
  providerDays: row.provider_days ?? row.providerDays,
  upgradeDays: row.upgrade_days ?? row.upgradeDays,
  status: row.status,
  providerSnapshotHash: row.provider_snapshot_hash ?? row.providerSnapshotHash ?? null,
  version: row.version,
  createdBy: row.created_by ?? row.createdBy ?? null,
  createdAt: row.created_at ?? row.createdAt,
  updatedBy: row.updated_by ?? row.updatedBy ?? null,
  updatedAt: row.updated_at ?? row.updatedAt,
});

const validationError = (message, code = 'FULFILLMENT_BINDING_INVALID', status = 422) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const assertInput = (input) => {
  if (!input?.variantId || input.provider !== 'WORLDMOVE' || input.strategy !== 'MAPPED_FALLBACK') {
    throw validationError('Fulfillment binding has invalid identity or strategy.');
  }
  if (!input.providerOfferId || !input.familyKey) throw validationError('Fulfillment binding is missing provider evidence.');
  if (!Number.isInteger(input.requestedDays) || input.requestedDays <= 0) throw validationError('Fulfillment binding has invalid requested duration.');
  if (!Number.isInteger(input.providerDays) || input.providerDays < input.requestedDays) throw validationError('Fulfillment binding cannot use a shorter provider duration.');
  if (input.upgradeDays !== input.providerDays - input.requestedDays) throw validationError('Fulfillment binding upgrade duration is invalid.');
  return input;
};

export const createInMemoryFulfillmentBindingRepository = ({ now = () => new Date().toISOString(), idFactory = () => randomUUID() } = {}) => {
  const bindings = new Map();
  const events = [];
  const activeFor = (variantId, provider) => [...bindings.values()].find((item) => item.status === 'ACTIVE' && item.variantId === variantId && item.provider === provider) ?? null;
  const conflict = () => validationError('An active fulfillment binding already exists for this variant and provider.', 'FULFILLMENT_BINDING_CONFLICT', 409);
  return {
    async listActive(provider = 'WORLDMOVE') { return [...bindings.values()].filter((item) => item.status === 'ACTIVE' && item.provider === provider); },
    async list() { return [...bindings.values()]; },
    async getById(id) { return bindings.get(id) ?? null; },
    async findActiveByVariant(variantId, provider = 'WORLDMOVE') { return activeFor(variantId, provider); },
    async create(input, actor = {}) {
      const value = assertInput(input);
      const existing = activeFor(value.variantId, value.provider);
      if (existing) {
        if (existing.providerOfferId === value.providerOfferId && existing.familyKey === value.familyKey && existing.providerDays === value.providerDays) return existing;
        throw conflict();
      }
      const timestamp = now();
      const binding = { id: idFactory(), ...value, status: 'ACTIVE', providerSnapshotHash: value.providerSnapshotHash ?? null, version: 1, createdBy: actor.id ?? null, createdAt: timestamp, updatedBy: actor.id ?? null, updatedAt: timestamp };
      bindings.set(binding.id, binding);
      events.push({ bindingId: binding.id, eventType: 'CREATE', actorId: actor.id ?? null, version: binding.version, createdAt: timestamp });
      return binding;
    },
    async update(id, input, actor = {}, expectedVersion) {
      const current = bindings.get(id);
      if (!current) throw validationError('Fulfillment binding was not found.', 'FULFILLMENT_BINDING_NOT_FOUND', 404);
      if (current.status !== 'ACTIVE') throw validationError('Fulfillment binding is no longer active.', 'FULFILLMENT_BINDING_REVOKED', 409);
      if (expectedVersion !== undefined && current.version !== expectedVersion) throw validationError('Fulfillment binding version is stale.', 'VERSION_CONFLICT', 409);
      const value = assertInput({ ...current, ...input });
      const existing = activeFor(value.variantId, value.provider);
      if (existing && existing.id !== id) throw conflict();
      const next = { ...current, ...value, status: 'ACTIVE', updatedBy: actor.id ?? null, updatedAt: now(), version: current.version + 1 };
      bindings.set(id, next);
      events.push({ bindingId: id, eventType: 'REMAP', actorId: actor.id ?? null, version: next.version, createdAt: next.updatedAt });
      return next;
    },
    async revoke(id, actor = {}, expectedVersion) {
      const current = bindings.get(id);
      if (!current) throw validationError('Fulfillment binding was not found.', 'FULFILLMENT_BINDING_NOT_FOUND', 404);
      if (expectedVersion !== undefined && current.version !== expectedVersion) throw validationError('Fulfillment binding version is stale.', 'VERSION_CONFLICT', 409);
      const next = { ...current, status: 'REVOKED', updatedBy: actor.id ?? null, updatedAt: now(), version: current.version + 1 };
      bindings.set(id, next);
      events.push({ bindingId: id, eventType: 'REVOKE', actorId: actor.id ?? null, version: next.version, createdAt: next.updatedAt });
      return next;
    },
    async listEvents(id) { return events.filter((event) => event.bindingId === id); },
  };
};

export const createFulfillmentBindingRepository = ({ pool, now = () => new Date().toISOString(), idFactory = () => randomUUID() } = {}) => {
  if (!pool) return createInMemoryFulfillmentBindingRepository({ now, idFactory });
  return {
    async listActive(provider = 'WORLDMOVE') { const result = await pool.query("SELECT * FROM catalog_variant_fulfillment_bindings WHERE provider=$1 AND status='ACTIVE' ORDER BY created_at", [provider]); return result.rows.map(mapBinding); },
    async list() { const result = await pool.query('SELECT * FROM catalog_variant_fulfillment_bindings ORDER BY created_at'); return result.rows.map(mapBinding); },
    async getById(id) { const result = await pool.query('SELECT * FROM catalog_variant_fulfillment_bindings WHERE id=$1', [id]); return result.rows[0] ? mapBinding(result.rows[0]) : null; },
    async findActiveByVariant(variantId, provider = 'WORLDMOVE') { const result = await pool.query("SELECT * FROM catalog_variant_fulfillment_bindings WHERE variant_id=$1 AND provider=$2 AND status='ACTIVE'", [variantId, provider]); return result.rows[0] ? mapBinding(result.rows[0]) : null; },
    async create(input, actor = {}) {
      const value = assertInput(input); const id = idFactory();
      try {
        const result = await pool.query(`INSERT INTO catalog_variant_fulfillment_bindings (id,variant_id,provider,strategy,provider_offer_id,family_key,requested_days,provider_days,upgrade_days,status,provider_snapshot_hash,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',$10,$11,$11) RETURNING *`, [id, value.variantId, value.provider, value.strategy, value.providerOfferId, value.familyKey, value.requestedDays, value.providerDays, value.upgradeDays, value.providerSnapshotHash ?? null, actor.id ?? null]);
        return mapBinding(result.rows[0]);
      } catch (error) {
        if (error?.code === '23505') {
          const existing = await this.findActiveByVariant(value.variantId, value.provider);
          if (existing && existing.providerOfferId === value.providerOfferId && existing.familyKey === value.familyKey && existing.providerDays === value.providerDays) return existing;
          throw validationError('An active fulfillment binding already exists for this variant and provider.', 'FULFILLMENT_BINDING_CONFLICT', 409);
        }
        throw error;
      }
    },
    async update(id, input, actor = {}, expectedVersion) {
      const value = assertInput(input);
      const result = await pool.query(`UPDATE catalog_variant_fulfillment_bindings SET provider=$2,strategy=$3,provider_offer_id=$4,family_key=$5,requested_days=$6,provider_days=$7,upgrade_days=$8,provider_snapshot_hash=$9,updated_by=$10,updated_at=NOW(),version=version+1 WHERE id=$1 AND status='ACTIVE' AND ($11::integer IS NULL OR version=$11) RETURNING *`, [id, value.provider, value.strategy, value.providerOfferId, value.familyKey, value.requestedDays, value.providerDays, value.upgradeDays, value.providerSnapshotHash ?? null, actor.id ?? null, expectedVersion ?? null]);
      if (!result.rows[0]) { const current = await this.getById(id); throw validationError(current ? 'Fulfillment binding version is stale.' : 'Fulfillment binding was not found.', current ? 'VERSION_CONFLICT' : 'FULFILLMENT_BINDING_NOT_FOUND', current ? 409 : 404); }
      return mapBinding(result.rows[0]);
    },
    async revoke(id, actor = {}, expectedVersion) {
      const result = await pool.query(`UPDATE catalog_variant_fulfillment_bindings SET status='REVOKED',updated_by=$2,updated_at=NOW(),version=version+1 WHERE id=$1 AND ($3::integer IS NULL OR version=$3) RETURNING *`, [id, actor.id ?? null, expectedVersion ?? null]);
      if (!result.rows[0]) { const current = await this.getById(id); throw validationError(current ? 'Fulfillment binding version is stale.' : 'Fulfillment binding was not found.', current ? 'VERSION_CONFLICT' : 'FULFILLMENT_BINDING_NOT_FOUND', current ? 409 : 404); }
      return mapBinding(result.rows[0]);
    },
    async listEvents() { return []; },
  };
};
