import { randomUUID } from 'node:crypto';
import { publicBatch, publicRow } from './sheetSyncTypes.js';

const parseJson = (value, fallback) => typeof value === 'string' ? JSON.parse(value) : value ?? fallback;
const mapBatch = (row) => ({
  id: row.id, sourceHash: row.source_hash, spreadsheetId: row.spreadsheet_id, sheetTab: row.sheet_tab, sheetRange: row.sheet_range,
  status: row.status, createdBy: row.created_by, createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  validatedAt: row.validated_at?.toISOString?.() ?? row.validated_at, appliedAt: row.applied_at?.toISOString?.() ?? row.applied_at,
  rejectedAt: row.rejected_at?.toISOString?.() ?? row.rejected_at, rejectedBy: row.rejected_by, catalogVersionId: row.catalog_version_id,
  approvedBy: row.approved_by,
  summary: parseJson(row.summary, {}),
});
const mapRow = (row) => ({
  id: row.id, batchId: row.batch_id, sheetRowNumber: row.sheet_row_number, rowHash: row.row_hash, variantId: row.variant_id,
  status: row.status, normalizedData: parseJson(row.normalized_data, {}), raw: parseJson(row.raw_data, {}), diff: parseJson(row.diff, {}),
  errors: parseJson(row.errors, []), appliedFields: parseJson(row.applied_fields, []),
  createdAt: row.created_at?.toISOString?.() ?? row.created_at, appliedAt: row.applied_at?.toISOString?.() ?? row.applied_at,
});

export const createInMemorySheetSyncRepository = () => {
  const batches = new Map(); const rows = new Map();
  return {
    async findBySourceHash(sourceHash) { return [...batches.values()].find((batch) => batch.sourceHash === sourceHash) ?? null; },
    async createBatch(batch, batchRows) { batches.set(batch.id, batch); rows.set(batch.id, batchRows); return batch; },
    async getBatch(id) { return batches.get(id) ?? null; },
    async listRows(batchId) { return rows.get(batchId) ?? []; },
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

export const createSheetSyncRepository = ({ pool = null, idFactory = () => randomUUID() } = {}) => {
  if (!pool) return createInMemorySheetSyncRepository();
  return {
    async findBySourceHash(sourceHash) {
      const result = await pool.query('SELECT * FROM catalog_sheet_sync_batches WHERE source_hash = $1', [sourceHash]);
      return result.rows[0] ? mapBatch(result.rows[0]) : null;
    },
    async createBatch(batch, batchRows) {
      const client = await pool.connect();
      await client.query('BEGIN');
      try {
        await client.query(`INSERT INTO catalog_sheet_sync_batches (id, source_hash, spreadsheet_id, sheet_tab, sheet_range, status, created_by, created_at, validated_at, catalog_version_id, summary)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [batch.id, batch.sourceHash, batch.spreadsheetId, batch.sheetTab, batch.sheetRange, batch.status, batch.createdBy ?? null, batch.createdAt, batch.validatedAt ?? null, batch.catalogVersionId ?? null, JSON.stringify(batch.summary ?? {})]);
        for (const row of batchRows) await client.query(`INSERT INTO catalog_sheet_sync_rows (id,batch_id,sheet_row_number,row_hash,variant_id,status,normalized_data,raw_data,diff,errors,applied_fields,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [row.id, batch.id, row.sheetRowNumber, row.rowHash, row.variantId ?? null, row.status, JSON.stringify(row.normalizedData ?? {}), JSON.stringify(row.raw ?? {}), JSON.stringify(row.diff ?? {}), JSON.stringify(row.errors ?? []), JSON.stringify(row.appliedFields ?? []), row.createdAt]);
        await client.query('COMMIT'); return batch;
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async getBatch(id) { const result = await pool.query('SELECT * FROM catalog_sheet_sync_batches WHERE id = $1', [id]); return result.rows[0] ? mapBatch(result.rows[0]) : null; },
    async listRows(batchId) { const result = await pool.query('SELECT * FROM catalog_sheet_sync_rows WHERE batch_id = $1 ORDER BY sheet_row_number', [batchId]); return result.rows.map(mapRow); },
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
