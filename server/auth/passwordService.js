import bcrypt from 'bcryptjs';

const MINIMUM_LENGTH = 12;
const rounds = 12;

export const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < MINIMUM_LENGTH) {
    return { valid: false, error: `Password must be at least ${MINIMUM_LENGTH} characters.` };
  }
  return { valid: true };
};

export const hashPassword = async (password) => {
  const validation = validatePassword(password);
  if (!validation.valid) throw new Error(validation.error);
  return bcrypt.hash(password, rounds);
};

export const verifyPassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);
