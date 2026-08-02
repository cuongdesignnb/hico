import path from 'node:path';
import { atomicWriteJson, readJson, defaultUploadsDirectory } from '../catalog/write/catalogWritePersistence.js';

const createStore = (filePath, ttlMs) => {
  let queue = Promise.resolve();
  const withLock = (operation) => {
    const next = queue.then(operation, operation);
    queue = next.catch(() => undefined);
    return next;
  };
  const read = async () => {
    const rows = await readJson(filePath, []);
    const cutoff = Date.now() - ttlMs;
    return (Array.isArray(rows) ? rows : []).filter((row) => Date.parse(row.createdAt) >= cutoff);
  };
  return {
    async list() { return read(); },
    async has(key) { return withLock(async () => (await read()).some((row) => row.key === key)); },
    async add(key, data = {}) {
      return withLock(async () => {
        const rows = await read();
        const existing = rows.find((row) => row.key === key);
        if (existing) return { ...existing, fresh: false };
        const row = { key, ...data, createdAt: new Date().toISOString() };
        await atomicWriteJson(filePath, [...rows, row]);
        return { ...row, fresh: true };
      });
    },
    async remove(key) {
      return withLock(async () => {
        const rows = await read();
        const next = rows.filter((row) => row.key !== key);
        if (next.length !== rows.length) await atomicWriteJson(filePath, next);
      });
    },
  };
};

export const createWebhookReplayRepository = ({ filePath = path.join(defaultUploadsDirectory, 'webhook_replay.json'), ttlMs = Number(process.env.WEBHOOK_REPLAY_TTL_MS ?? 86400000) } = {}) => createStore(filePath, ttlMs);
export const createWebhookEventRepository = ({ filePath = path.join(defaultUploadsDirectory, 'webhook_events.json'), ttlMs = Number(process.env.WEBHOOK_REPLAY_TTL_MS ?? 86400000) } = {}) => ({
  ...createStore(filePath, ttlMs),
  async list() { return readJson(filePath, []); },
  async get(eventId) {
    const rows = await readJson(filePath, []);
    return (Array.isArray(rows) ? rows : []).find((row) => row.eventId === eventId) ?? null;
  },
  async save(event) {
    const rows = await readJson(filePath, []);
    if (rows.some((row) => row.eventId === event.eventId)) return rows.find((row) => row.eventId === event.eventId);
    const next = [...rows, { ...event, createdAt: event.createdAt ?? new Date().toISOString() }];
    await atomicWriteJson(filePath, next);
    return event;
  },
});
