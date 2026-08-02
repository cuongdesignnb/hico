import { requestJson } from './catalogWriteApi';
import type {
  BulkEntityType,
  BulkExecuteResponse,
  BulkOperation,
  BulkPreviewResponse,
  BulkSelection,
} from '../types/catalogBulk';

export const previewBulk = (body: {
  idempotencyKey: string;
  catalogVersionId: string;
  entityType: BulkEntityType;
  selection: BulkSelection;
  operation: BulkOperation;
}) => requestJson<BulkPreviewResponse>('/api/admin/catalog/bulk/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const executeBulk = (body: {
  idempotencyKey: string;
  previewId: string;
  catalogVersionId: string;
  selectionHash: string;
  confirm: true;
}) => requestJson<BulkExecuteResponse>('/api/admin/catalog/bulk/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
