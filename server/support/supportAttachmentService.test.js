import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSupportAttachmentService } from './supportAttachmentService.js';

test('support attachment service accepts signed private files and rejects unsafe types', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hico-support-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const repository = { async countAttachments() { return 0; }, async createAttachment(input) { return { id: input.id, ticketId: input.ticketId, originalName: input.originalNameSafe, mimeType: input.mimeType, sizeBytes: input.sizeBytes, checksum: input.checksum, status: input.status }; } };
  const service = createSupportAttachmentService({ repository, storageDirectory: directory, env: { SUPPORT_ATTACHMENT_MALWARE_SCANNER: 'false' } });
  const result = await service.upload({ ticketId: 'ticket-1', uploadedByType: 'CUSTOMER', uploadedById: 'customer-1', fileName: 'proof.png', mimeType: 'image/png', contentBase64: Buffer.from('89504e470d0a1a0a', 'hex').toString('base64') });
  assert.equal(result.risk, 'unscanned');
  assert.equal(result.originalName, 'proof.png');
  await assert.rejects(() => service.upload({ ticketId: 'ticket-1', uploadedByType: 'CUSTOMER', uploadedById: 'customer-1', fileName: '../script.html', mimeType: 'text/html', contentBase64: 'aA==' }), (error) => error.code === 'SUPPORT_ATTACHMENT_INVALID');
});
