import { randomUUID } from 'node:crypto';
import { aliasKey, assertAliasInput, normalizeExternalKey } from './variantAliasValidation.js';

const mapAlias = (row) => ({
  id: row.id, namespace: row.namespace, externalKey: row.external_key ?? row.externalKey,
  normalizedExternalKey: row.normalized_external_key ?? row.normalizedExternalKey,
  medium: row.medium, variantId: row.variant_id ?? row.variantId, status: row.status,
  createdBy: row.created_by ?? row.createdBy, createdAt: row.created_at ?? row.createdAt,
  updatedBy: row.updated_by ?? row.updatedBy, updatedAt: row.updated_at ?? row.updatedAt,
  version: row.version,
});

export const createInMemoryVariantAliasRepository = ({ now = () => new Date().toISOString(), idFactory = () => randomUUID() } = {}) => {
  const aliases = new Map();
  const events = [];
  const getByKey = (input) => [...aliases.values()].find((item) => aliasKey(input) === aliasKey(item)) ?? null;
  return {
    async listActive() { return [...aliases.values()].filter((item) => item.status === 'ACTIVE'); },
    async list() { return [...aliases.values()]; },
    async getById(id) { return aliases.get(id) ?? null; },
    async findActive(input) { const alias = getByKey({ ...input, normalizedExternalKey: normalizeExternalKey(input.externalKey ?? input.normalizedExternalKey) }); return alias?.status === 'ACTIVE' ? alias : null; },
    async create(input, actor = {}) {
      const value = assertAliasInput(input);
      const existing = getByKey(value);
      if (existing) { if (existing.status === 'ACTIVE' && existing.variantId === value.variantId) return existing; const error = new Error('External alias already exists.'); error.code = 'EXTERNAL_ALIAS_DUPLICATE'; error.status = 409; throw error; }
      const timestamp = now();
      const alias = { id: idFactory(), ...value, createdBy: actor.id ?? null, createdAt: timestamp, updatedBy: actor.id ?? null, updatedAt: timestamp, version: 1 };
      aliases.set(alias.id, alias); events.push({ type: 'CREATE', aliasId: alias.id, actorId: actor.id ?? null, at: timestamp, version: alias.version }); return alias;
    },
    async update(id, input, actor = {}, expectedVersion) {
      const current = aliases.get(id); if (!current) { const error = new Error('External alias target was not found.'); error.code = 'EXTERNAL_ALIAS_TARGET_NOT_FOUND'; error.status = 404; throw error; }
      if (expectedVersion !== undefined && current.version !== expectedVersion) { const error = new Error('External alias version is stale.'); error.code = 'VERSION_CONFLICT'; error.status = 409; throw error; }
      const value = assertAliasInput({ ...current, ...input });
      const duplicate = getByKey(value); if (duplicate && duplicate.id !== id) { const error = new Error('External alias already exists.'); error.code = 'EXTERNAL_ALIAS_DUPLICATE'; error.status = 409; throw error; }
      const next = { ...current, ...value, updatedBy: actor.id ?? null, updatedAt: now(), version: current.version + 1 };
      aliases.set(id, next); events.push({ type: 'REMAP', aliasId: id, actorId: actor.id ?? null, at: next.updatedAt, version: next.version }); return next;
    },
    async revoke(id, actor = {}, expectedVersion) {
      const current = aliases.get(id); if (!current) { const error = new Error('External alias target was not found.'); error.code = 'EXTERNAL_ALIAS_TARGET_NOT_FOUND'; error.status = 404; throw error; }
      if (expectedVersion !== undefined && current.version !== expectedVersion) { const error = new Error('External alias version is stale.'); error.code = 'VERSION_CONFLICT'; error.status = 409; throw error; }
      const next = { ...current, status: 'REVOKED', updatedBy: actor.id ?? null, updatedAt: now(), version: current.version + 1 };
      aliases.set(id, next); events.push({ type: 'REVOKE', aliasId: id, actorId: actor.id ?? null, at: next.updatedAt, version: next.version }); return next;
    },
    async listEvents(id) { return events.filter((event) => event.aliasId === id); },
  };
};

export const createVariantAliasRepository = ({ pool, now = () => new Date().toISOString(), idFactory = () => randomUUID() } = {}) => {
  if (!pool) return createInMemoryVariantAliasRepository({ now, idFactory });
  return {
    async listActive() { const result = await pool.query("SELECT * FROM catalog_variant_external_aliases WHERE status = 'ACTIVE' ORDER BY created_at"); return result.rows.map(mapAlias); },
    async list() { const result = await pool.query('SELECT * FROM catalog_variant_external_aliases ORDER BY created_at'); return result.rows.map(mapAlias); },
    async getById(id) { const result = await pool.query('SELECT * FROM catalog_variant_external_aliases WHERE id = $1', [id]); return result.rows[0] ? mapAlias(result.rows[0]) : null; },
    async findActive(input) { const key = normalizeExternalKey(input.externalKey ?? input.normalizedExternalKey); const result = await pool.query("SELECT * FROM catalog_variant_external_aliases WHERE namespace=$1 AND normalized_external_key=$2 AND medium=$3 AND status='ACTIVE'", [input.namespace, key, input.medium]); return result.rows[0] ? mapAlias(result.rows[0]) : null; },
    async create(input, actor = {}) {
      const value = assertAliasInput(input); const id = idFactory();
      try {
        const result = await pool.query(`INSERT INTO catalog_variant_external_aliases (id,namespace,external_key,normalized_external_key,medium,variant_id,status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$7) RETURNING *`, [id, value.namespace, value.externalKey, value.normalizedExternalKey, value.medium, value.variantId, actor.id ?? null]); return mapAlias(result.rows[0]);
      } catch (error) {
        if (error?.code === '23505') {
          const existing = await pool.query("SELECT * FROM catalog_variant_external_aliases WHERE namespace=$1 AND normalized_external_key=$2 AND medium=$3", [value.namespace, value.normalizedExternalKey, value.medium]);
          if (existing.rows[0]?.status === 'ACTIVE' && existing.rows[0].variant_id === value.variantId) return mapAlias(existing.rows[0]);
          error.code = 'EXTERNAL_ALIAS_DUPLICATE'; error.status = 409;
        }
        throw error;
      }
    },
    async update(id, input, actor = {}, expectedVersion) {
      const value = assertAliasInput(input); const result = await pool.query(`UPDATE catalog_variant_external_aliases SET namespace=$2,external_key=$3,normalized_external_key=$4,medium=$5,variant_id=$6,updated_by=$7,updated_at=NOW(),version=version+1 WHERE id=$1 AND status='ACTIVE' AND ($8::integer IS NULL OR version=$8) RETURNING *`, [id, value.namespace, value.externalKey, value.normalizedExternalKey, value.medium, value.variantId, actor.id ?? null, expectedVersion ?? null]);
      if (!result.rows[0]) { const current = await this.getById(id); const error = new Error(current ? 'External alias version is stale.' : 'External alias target was not found.'); error.code = current ? 'VERSION_CONFLICT' : 'EXTERNAL_ALIAS_TARGET_NOT_FOUND'; error.status = current ? 409 : 404; throw error; } return mapAlias(result.rows[0]);
    },
    async revoke(id, actor = {}, expectedVersion) { const result = await pool.query(`UPDATE catalog_variant_external_aliases SET status='REVOKED',updated_by=$2,updated_at=NOW(),version=version+1 WHERE id=$1 AND ($3::integer IS NULL OR version=$3) RETURNING *`, [id, actor.id ?? null, expectedVersion ?? null]); if (!result.rows[0]) { const current = await this.getById(id); const error = new Error(current ? 'External alias version is stale.' : 'External alias target was not found.'); error.code = current ? 'VERSION_CONFLICT' : 'EXTERNAL_ALIAS_TARGET_NOT_FOUND'; error.status = current ? 409 : 404; throw error; } return mapAlias(result.rows[0]); },
    async listEvents() { return []; },
  };
};
