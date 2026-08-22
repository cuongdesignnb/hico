import { randomUUID } from 'node:crypto';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson, defaultUploadsDirectory, readJson } from '../write/catalogWritePersistence.js';
import { publicBatch, publicRow } from './sheetSyncTypes.js';

const parseJson = (value, fallback) => typeof value === 'string' ? JSON.parse(value) : value ?? fallback;
const mapBatch = (row) => {
  const summary = parseJson(row.summary, {});
  return {
  id: row.id, sourceHash: row.source_hash, spreadsheetId: row.spreadsheet_id, sheetTab: row.sheet_tab, sheetRange: row.sheet_range,
  status: row.status, createdBy: row.created_by, createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  validatedAt: row.validated_at?.toISOString?.() ?? row.validated_at, appliedAt: row.applied_at?.toISOString?.() ?? row.applied_at,
  rejectedAt: row.rejected_at?.toISOString?.() ?? row.rejected_at, rejectedBy: row.rejected_by, catalogVersionId: row.catalog_version_id,
  approvedBy: row.approved_by,
  summary, headerRow: Number(summary.headerRow ?? 1), mode: row.mode ?? 'legacy', fieldMapping: parseJson(row.field_mapping, null), priceMapping: parseJson(row.price_mapping, null), headerHash: row.header_hash ?? null, providerSnapshotHash: row.provider_snapshot_hash ?? null,
  };
};
const mapRow = (row) => ({
  id: row.id, batchId: row.batch_id, sheetRowNumber: row.sheet_row_number, rowHash: row.row_hash, variantId: row.variant_id,
  status: row.status, normalizedData: parseJson(row.normalized_data, {}), raw: parseJson(row.raw_data, {}), diff: parseJson(row.diff, {}),
  errors: parseJson(row.errors, []), appliedFields: parseJson(row.applied_fields, []),
  createdAt: row.created_at?.toISOString?.() ?? row.created_at, appliedAt: row.applied_at?.toISOString?.() ?? row.applied_at,
});

const emptyFileState = () => ({ version: 1, batches: {}, rows: {} });

export class CatalogPreviewStorageError extends Error {
  constructor(message, { code = 'INTEGRATION_STORAGE_UNAVAILABLE', status = 503 } = {}) {
    super(message);
    this.name = 'CatalogPreviewStorageError';
    this.code = code;
    this.status = status;
  }
}

const assertFileState = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (value.batches !== undefined && (typeof value.batches !== 'object' || Array.isArray(value.batches)))
    || (value.rows !== undefined && (typeof value.rows !== 'object' || Array.isArray(value.rows)))
    || Object.values(value.rows ?? {}).some((batchRows) => !Array.isArray(batchRows))) {
    throw new CatalogPreviewStorageError('Catalog preview storage is invalid.', { code: 'INTEGRATION_STORAGE_INVALID' });
  }
  return {
    version: Number(value.version ?? 1),
    batches: value.batches ?? {},
    rows: value.rows ?? {},
  };
};

const assertBatchPayload = (batch, batchRows) => {
  if (!batch || typeof batch.id !== 'string' || !batch.id.trim() || !Array.isArray(batchRows)
    || batchRows.some((row) => !row || typeof row.id !== 'string' || !row.id.trim() || row.batchId && row.batchId !== batch.id)) {
    throw new CatalogPreviewStorageError('Catalog preview batch payload is invalid.', { code: 'INTEGRATION_STORAGE_INVALID' });
  }
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const withFileLock = async (filePath, callback, { timeoutMs = 10_000, staleLockMs = 15 * 60_000 } = {}) => {
  const lockPath = `${filePath}.lock`;
  await mkdir(path.dirname(filePath), { recursive: true });
  const startedAt = Date.now();
  let handle;
  while (!handle) {
    try {
      handle = await open(lockPath, 'wx');
    } catch (error) {
      if (error?.code !== 'EEXIST') throw new CatalogPreviewStorageError('Catalog preview storage is busy or unavailable.');
      const lockStats = await stat(lockPath).catch(() => null);
      if (lockStats && Date.now() - lockStats.mtimeMs >= staleLockMs) {
        await rm(lockPath, { force: true }).catch(() => undefined);
        continue;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new CatalogPreviewStorageError('Catalog preview storage is busy or unavailable.');
      }
      await sleep(10);
    }
  }
  try {
    return await callback();
  } finally {
    await handle.close().catch(() => undefined);
    await rm(lockPath, { force: true }).catch(() => undefined);
  }
};

const createFileSheetSyncRepository = ({ storageFile }) => {
  const readState = async () => {
    try {
      return assertFileState(await readJson(storageFile, emptyFileState()));
    } catch (error) {
      if (error instanceof CatalogPreviewStorageError) throw error;
      throw new CatalogPreviewStorageError('Catalog preview storage is invalid.');
    }
  };
  const mutate = (callback) => withFileLock(storageFile, async () => {
    const state = await readState();
    const result = await callback(state);
    await atomicWriteJson(storageFile, assertFileState(state));
    return result;
  });
  const pageRows = (state, batchId, { page = 1, pageSize = 100 } = {}) => {
    const all = state.rows[batchId] ?? [];
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 100));
    const offset = (safePage - 1) * safePageSize;
    return { items: all.slice(offset, offset + safePageSize), page: safePage, pageSize: safePageSize, total: all.length };
  };
  return {
    storage: 'file',
    async findBySourceHash(sourceHash) { const state = await readState(); return Object.values(state.batches).find((batch) => batch.sourceHash === sourceHash) ?? null; },
    async createBatch(batch, batchRows) {
      assertBatchPayload(batch, batchRows);
      return mutate((state) => {
        state.batches[batch.id] = batch;
        state.rows[batch.id] = batchRows;
        return batch;
      });
    },
    async getBatch(id) { const state = await readState(); return state.batches[id] ?? null; },
    async listRows(batchId) { const state = await readState(); return state.rows[batchId] ?? []; },
    async listRowsPage(batchId, options) { const state = await readState(); return pageRows(state, batchId, options); },
    async listBatches({ limit = 100 } = {}) {
      const state = await readState();
      return Object.values(state.batches).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
    },
    async getRow(id) {
      const state = await readState();
      for (const [batchId, batchRows] of Object.entries(state.rows)) {
        const row = batchRows.find((item) => item.id === id);
        if (row) return { ...row, sheetName: state.batches[batchId]?.sheetTab ?? null };
      }
      return null;
    },
    async updateBatch(id, changes) {
      return mutate((state) => {
        const current = state.batches[id];
        if (!current) return null;
        const next = { ...current, ...changes };
        state.batches[id] = next;
        return next;
      });
    },
    async claimForApply(id, actorId) {
      return mutate((state) => {
        const current = state.batches[id];
        if (!current || current.status !== 'READY_FOR_REVIEW') return null;
        const next = { ...current, status: 'APPLYING', approvedBy: actorId ?? null, applyCommandId: id, applyStartedAt: new Date().toISOString() };
        state.batches[id] = next;
        return next;
      });
    },
    async updateRows(batchId, updates) {
      return mutate((state) => {
        const next = (state.rows[batchId] ?? []).map((row) => ({ ...row, ...(updates[row.id] ?? {}) }));
        state.rows[batchId] = next;
        return next;
      });
    },
  };
};

export const createInMemorySheetSyncRepository = () => {
  const batches = new Map(); const rows = new Map();
  const pageRows = (batchId, { page = 1, pageSize = 100 } = {}) => {
    const all = rows.get(batchId) ?? [];
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 100));
    const offset = (safePage - 1) * safePageSize;
    return { items: all.slice(offset, offset + safePageSize), page: safePage, pageSize: safePageSize, total: all.length };
  };
  return {
    async findBySourceHash(sourceHash) { return [...batches.values()].find((batch) => batch.sourceHash === sourceHash) ?? null; },
    async createBatch(batch, batchRows) { batches.set(batch.id, batch); rows.set(batch.id, batchRows); return batch; },
    async getBatch(id) { return batches.get(id) ?? null; },
    async listRows(batchId) { return rows.get(batchId) ?? []; },
    async listRowsPage(batchId, options) { return pageRows(batchId, options); },
    async listBatches({ limit = 100 } = {}) { return [...batches.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit); },
    async getRow(id) { for (const [batchId, batchRows] of rows.entries()) { const row = batchRows.find((item) => item.id === id); if (row) return { ...row, sheetName: batches.get(batchId)?.sheetTab ?? null }; } return null; },
    async updateBatch(id, changes) { const next = { ...batches.get(id), ...changes }; batches.set(id, next); return next; },
    async claimForApply(id, actorId) {
      const current = batches.get(id);
      if (!current || current.status !== 'READY_FOR_REVIEW') return null;
      const next = { ...current, status: 'APPLYING', approvedBy: actorId ?? null, applyCommandId: id, applyStartedAt: new Date().toISOString() };
      batches.set(id, next); return next;
    },
    async updateRows(batchId, updates) { const next = (rows.get(batchId) ?? []).map((row) => ({ ...row, ...(updates[row.id] ?? {}) })); rows.set(batchId, next); return next; },
  };
};

export const defaultSheetSyncStorageFile = path.join(defaultUploadsDirectory, 'catalog_sheet_sync.json');

export const assertPostgresSheetSyncStorage = async ({ pool } = {}) => {
  if (!pool) throw new CatalogPreviewStorageError('PostgreSQL preview storage is unavailable.');
  try {
    const result = await pool.query(`SELECT
      to_regclass('public.catalog_sheet_sync_batches') AS batches_table,
      to_regclass('public.catalog_sheet_sync_rows') AS rows_table`);
    const row = result.rows[0] ?? {};
    if (!row.batches_table || !row.rows_table) throw new CatalogPreviewStorageError('Catalog preview tables are not available.', { code: 'INTEGRATION_STORAGE_UNAVAILABLE' });
  } catch (error) {
    if (error instanceof CatalogPreviewStorageError) throw error;
    throw new CatalogPreviewStorageError('Catalog preview PostgreSQL storage is unavailable.');
  }
};

export const createSheetSyncRepository = ({ pool = null, storageFile = defaultSheetSyncStorageFile, idFactory = () => randomUUID() } = {}) => {
  if (!pool) return createFileSheetSyncRepository({ storageFile });
  return {
    async findBySourceHash(sourceHash) {
      const result = await pool.query('SELECT * FROM catalog_sheet_sync_batches WHERE source_hash = $1', [sourceHash]);
      return result.rows[0] ? mapBatch(result.rows[0]) : null;
    },
    async createBatch(batch, batchRows) {
      const client = await pool.connect();
      await client.query('BEGIN');
      try {
        await client.query(`INSERT INTO catalog_sheet_sync_batches (id, source_hash, spreadsheet_id, sheet_tab, sheet_range, status, created_by, created_at, validated_at, catalog_version_id, summary, mode, field_mapping, price_mapping, header_hash, provider_snapshot_hash)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16)`, [batch.id, batch.sourceHash, batch.spreadsheetId, batch.sheetTab, batch.sheetRange, batch.status, batch.createdBy ?? null, batch.createdAt, batch.validatedAt ?? null, batch.catalogVersionId ?? null, JSON.stringify(batch.summary ?? {}), batch.mode ?? 'legacy', JSON.stringify(batch.fieldMapping ?? null), JSON.stringify(batch.priceMapping ?? null), batch.headerHash ?? null, batch.providerSnapshotHash ?? null]);
        for (const row of batchRows) await client.query(`INSERT INTO catalog_sheet_sync_rows (id,batch_id,sheet_row_number,row_hash,variant_id,status,normalized_data,raw_data,diff,errors,applied_fields,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [row.id, batch.id, row.sheetRowNumber, row.rowHash, row.variantId ?? null, row.status, JSON.stringify(row.normalizedData ?? {}), JSON.stringify(row.raw ?? {}), JSON.stringify(row.diff ?? {}), JSON.stringify(row.errors ?? []), JSON.stringify(row.appliedFields ?? []), row.createdAt]);
        await client.query('COMMIT'); return batch;
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async getBatch(id) { const result = await pool.query('SELECT * FROM catalog_sheet_sync_batches WHERE id = $1', [id]); return result.rows[0] ? mapBatch(result.rows[0]) : null; },
    async listRows(batchId) { const result = await pool.query('SELECT * FROM catalog_sheet_sync_rows WHERE batch_id = $1 ORDER BY sheet_row_number', [batchId]); return result.rows.map(mapRow); },
    async listRowsPage(batchId, { page = 1, pageSize = 100 } = {}) {
      const safePage = Math.max(1, Number(page) || 1);
      const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 100));
      const offset = (safePage - 1) * safePageSize;
      const result = await pool.query('SELECT r.*, COUNT(*) OVER()::int AS total_count FROM catalog_sheet_sync_rows r WHERE r.batch_id = $1 ORDER BY r.sheet_row_number LIMIT $2 OFFSET $3', [batchId, safePageSize, offset]);
      return { items: result.rows.map(mapRow), page: safePage, pageSize: safePageSize, total: result.rows[0]?.total_count ?? 0 };
    },
    async listBatches({ limit = 100 } = {}) { const result = await pool.query('SELECT * FROM catalog_sheet_sync_batches ORDER BY created_at DESC LIMIT $1', [limit]); return result.rows.map(mapBatch); },
    async getRow(id) { const result = await pool.query('SELECT r.*, b.sheet_tab FROM catalog_sheet_sync_rows r JOIN catalog_sheet_sync_batches b ON b.id = r.batch_id WHERE r.id = $1', [id]); return result.rows[0] ? { ...mapRow(result.rows[0]), sheetName: result.rows[0].sheet_tab } : null; },
    async updateBatch(id, changes) {
      const result = await pool.query(`UPDATE catalog_sheet_sync_batches SET status=$2, summary=$3, applied_at=$4, rejected_at=$5, rejected_by=$6, approved_by=COALESCE($7, approved_by), apply_command_id=COALESCE($8, apply_command_id), apply_started_at=COALESCE($9, apply_started_at), catalog_version_id=COALESCE($10, catalog_version_id), updated_at=NOW() WHERE id=$1 RETURNING *`, [id, changes.status, JSON.stringify(changes.summary ?? {}), changes.appliedAt ?? null, changes.rejectedAt ?? null, changes.rejectedBy ?? null, changes.approvedBy ?? null, changes.applyCommandId ?? null, changes.applyStartedAt ?? null, changes.catalogVersionId ?? null]);
      return mapBatch(result.rows[0]);
    },
    async claimForApply(id, actorId) {
      const result = await pool.query(`UPDATE catalog_sheet_sync_batches SET status='APPLYING', approved_by=$2, apply_command_id=$1, apply_started_at=NOW(), updated_at=NOW() WHERE id=$1 AND status='READY_FOR_REVIEW' RETURNING *`, [id, actorId ?? null]);
      return result.rows[0] ? mapBatch(result.rows[0]) : null;
    },
    async updateRows(batchId, updates) {
      for (const [id, change] of Object.entries(updates)) await pool.query('UPDATE catalog_sheet_sync_rows SET status=$3, applied_fields=$4, applied_at=$5 WHERE batch_id=$1 AND id=$2', [batchId, id, change.status, JSON.stringify(change.appliedFields ?? []), change.appliedAt ?? null]);
      return this.listRows(batchId);
    },
  };
};

export { publicBatch, publicRow };
