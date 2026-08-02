import path from 'node:path';
import { readJsonArray, writeJsonArray } from './authPersistence.js';

export const createSessionRepository = ({ uploadsDirectory, filePath = path.join(uploadsDirectory, 'admin_sessions.json') } = {}) => ({
  async findByTokenHash(tokenHash) {
    return (await readJsonArray(filePath)).find((session) => session.tokenHash === tokenHash) ?? null;
  },
  async create(session) {
    const sessions = await readJsonArray(filePath);
    sessions.push(session);
    await writeJsonArray(filePath, sessions);
    return session;
  },
  async update(sessionId, update) {
    const sessions = await readJsonArray(filePath);
    const index = sessions.findIndex((session) => session.id === sessionId);
    if (index < 0) return null;
    sessions[index] = { ...sessions[index], ...update, id: sessions[index].id };
    await writeJsonArray(filePath, sessions);
    return sessions[index];
  },
  async revokeById(sessionId, reason) {
    return this.update(sessionId, { revokedAt: new Date().toISOString(), revokeReason: reason });
  },
  async revokeIfActive(sessionId, reason) {
    const sessions = await readJsonArray(filePath);
    const index = sessions.findIndex((session) => session.id === sessionId && !session.revokedAt);
    if (index < 0) return false;
    sessions[index] = { ...sessions[index], revokedAt: new Date().toISOString(), revokeReason: reason };
    await writeJsonArray(filePath, sessions);
    return true;
  },
  async revokeByUserId(userId, reason) {
    const sessions = await readJsonArray(filePath);
    const now = new Date().toISOString();
    const next = sessions.map((session) => session.userId === userId && !session.revokedAt
      ? { ...session, revokedAt: now, revokeReason: reason }
      : session);
    await writeJsonArray(filePath, next);
  },
  async revokeAll(reason) {
    const sessions = await readJsonArray(filePath);
    const now = new Date().toISOString();
    await writeJsonArray(filePath, sessions.map((session) => !session.revokedAt ? { ...session, revokedAt: now, revokeReason: reason } : session));
  },
});
