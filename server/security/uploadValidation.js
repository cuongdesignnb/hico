import { randomUUID } from 'node:crypto';
import path from 'node:path';

const types = {
  'image/jpeg': { extension: '.jpg', signature: (buffer) => buffer.subarray(0, 3).toString('hex') === 'ffd8ff' },
  'image/png': { extension: '.png', signature: (buffer) => buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' },
  'image/webp': { extension: '.webp', signature: (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP' },
};

export const parseImageUpload = ({ base64Data, maxBytes = 5 * 1024 * 1024 }) => {
  const matched = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(base64Data ?? ''));
  if (!matched) throw Object.assign(new Error('Only supported image data URIs are accepted.'), { code: 'UPLOAD_INVALID_TYPE' });
  const type = matched[1];
  const buffer = Buffer.from(matched[2], 'base64');
  if (!buffer.length || buffer.length > maxBytes || !types[type].signature(buffer)) throw Object.assign(new Error('Image content is invalid or too large.'), { code: 'UPLOAD_INVALID_CONTENT' });
  return { buffer, type, filename: `${randomUUID()}${types[type].extension}` };
};

export const safeUploadPath = (uploadsDirectory, filename) => {
  const resolved = path.resolve(uploadsDirectory, filename);
  const root = path.resolve(uploadsDirectory);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('Unsafe upload path.');
  return resolved;
};
