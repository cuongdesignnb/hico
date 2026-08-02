import path from 'node:path';
import { readJsonArray, writeJsonArray } from './authPersistence.js';

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

export const createUserRepository = ({ uploadsDirectory, filePath = path.join(uploadsDirectory, 'admin_users.json') } = {}) => ({
  async list() { return readJsonArray(filePath); },
  async findByEmail(email) {
    return (await readJsonArray(filePath)).find((user) => user.email === normalizeEmail(email)) ?? null;
  },
  async findById(id) {
    return (await readJsonArray(filePath)).find((user) => user.id === id) ?? null;
  },
  async create(user) {
    const users = await readJsonArray(filePath);
    if (users.some((item) => item.email === user.email)) throw new Error('Admin email already exists.');
    users.push(user);
    await writeJsonArray(filePath, users);
    return user;
  },
  async update(userId, update) {
    const users = await readJsonArray(filePath);
    const index = users.findIndex((user) => user.id === userId);
    if (index < 0) return null;
    users[index] = { ...users[index], ...update, id: users[index].id, email: users[index].email };
    await writeJsonArray(filePath, users);
    return users[index];
  },
});

export { normalizeEmail };
