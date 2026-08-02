import assert from 'node:assert/strict';
import test from 'node:test';
import { parseImageUpload } from './uploadValidation.js';

const png = 'data:image/png;base64,iVBORw0KGgo=';

test('accepts a supported image with a matching signature', () => {
  const uploaded = parseImageUpload({ base64Data: png });
  assert.equal(uploaded.type, 'image/png');
  assert.match(uploaded.filename, /^[0-9a-f-]+\.png$/);
});

test('rejects unsupported, spoofed, and oversized image uploads', () => {
  assert.throws(() => parseImageUpload({ base64Data: 'data:image/svg+xml;base64,PHN2Zy8+' }), { code: 'UPLOAD_INVALID_TYPE' });
  assert.throws(() => parseImageUpload({ base64Data: 'data:image/png;base64,PHN2Zy8+' }), { code: 'UPLOAD_INVALID_CONTENT' });
  assert.throws(() => parseImageUpload({ base64Data: png, maxBytes: 1 }), { code: 'UPLOAD_INVALID_CONTENT' });
});
