import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const definitions = {
  'image/jpeg': { extension: '.jpg', signature: (buffer) => buffer.subarray(0, 3).toString('hex') === 'ffd8ff' },
  'image/png': { extension: '.png', signature: (buffer) => buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' },
  'image/webp': { extension: '.webp', signature: (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP' },
  'application/pdf': { extension: '.pdf', signature: (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-' },
};
const invalid = (code, message) => Object.assign(new Error(message), { code });

export const createSupportAttachmentService = ({ repository, storageDirectory, env = process.env, now = () => new Date() } = {}) => {
  const maxBytes = Math.min(5 * 1024 * 1024, Math.max(1, Number.parseInt(env.SUPPORT_ATTACHMENT_MAX_BYTES, 10) || 5 * 1024 * 1024));
  const maxPerTicket = Math.min(10, Math.max(1, Number.parseInt(env.SUPPORT_ATTACHMENT_MAX_PER_TICKET, 10) || 5));
  const scannerConfigured = String(env.SUPPORT_ATTACHMENT_MALWARE_SCANNER ?? '').toLowerCase() === 'true';
  const upload = async ({ ticketId, uploadedByType, uploadedById, fileName, mimeType, contentBase64 }) => {
    const definition = definitions[String(mimeType ?? '').toLowerCase()];
    if (!definition || typeof fileName !== 'string' || /[\\/\0]/.test(fileName) || /\.(?:html?|js|exe|zip|rar|svg)$/i.test(fileName)) throw invalid('SUPPORT_ATTACHMENT_INVALID', 'Attachment type is not allowed.');
    const safeName = path.basename(fileName).replace(/[^A-Za-z0-9._-]/g, '_').slice(-160) || `attachment${definition.extension}`;
    const raw = String(contentBase64 ?? '').replace(/^data:[^;]+;base64,/, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(raw)) throw invalid('SUPPORT_ATTACHMENT_INVALID', 'Attachment content is invalid.');
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.length || buffer.length > maxBytes || !definition.signature(buffer)) throw invalid(buffer.length > maxBytes ? 'SUPPORT_ATTACHMENT_TOO_LARGE' : 'SUPPORT_ATTACHMENT_INVALID', 'Attachment content is invalid or too large.');
    const existing = await repository.countAttachments?.(ticketId);
    if (Number(existing ?? 0) >= maxPerTicket) throw invalid('SUPPORT_ATTACHMENT_TOO_LARGE', 'Attachment limit reached.');
    const id = randomUUID();
    const storageKey = `support/${id}${definition.extension}`;
    const root = path.resolve(storageDirectory);
    const target = path.resolve(root, storageKey);
    if (!target.startsWith(`${root}${path.sep}`)) throw invalid('SUPPORT_ATTACHMENT_INVALID', 'Attachment path is invalid.');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer, { flag: 'wx' });
    const attachment = await repository.createAttachment({ id, ticketId, uploadedByType, uploadedById, storageKey, originalNameSafe: safeName, mimeType, sizeBytes: buffer.length, checksum: createHash('sha256').update(buffer).digest('hex'), status: 'AVAILABLE', createdAt: now().toISOString() });
    return { ...attachment, scanner: scannerConfigured ? 'configured' : 'not_configured', risk: scannerConfigured ? null : 'unscanned' };
  };
  const read = async (attachment) => {
    if (!attachment?.storageKey || attachment.status !== 'AVAILABLE') throw invalid('SUPPORT_ATTACHMENT_FORBIDDEN', 'Attachment is unavailable.');
    const root = path.resolve(storageDirectory); const target = path.resolve(root, attachment.storageKey);
    if (!target.startsWith(`${root}${path.sep}`)) throw invalid('SUPPORT_ATTACHMENT_FORBIDDEN', 'Attachment is unavailable.');
    try { return { buffer: await fs.readFile(target), mimeType: attachment.mimeType, name: attachment.originalName }; }
    catch { throw invalid('SUPPORT_ATTACHMENT_FORBIDDEN', 'Attachment is unavailable.'); }
  };
  return { maxBytes, maxPerTicket, scannerConfigured, upload, read, health: async () => ({ status: 'healthy', storage: 'private', scanner: scannerConfigured ? 'configured' : 'not_configured', uploadAllowlist: Object.keys(definitions) }) };
};

export { definitions };
