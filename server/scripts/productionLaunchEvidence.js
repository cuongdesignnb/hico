import fs from 'node:fs/promises';

export const launchEvidencePath = (env, name) => env[name] || null;

export const readJsonEvidence = async (filePath) => {
  if (!filePath) return null;
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
};

export const requiredEvidence = async ({ env, pathEnv, name, expectedStatus = 'verified' }) => {
  const filePath = launchEvidencePath(env, pathEnv);
  const evidence = await readJsonEvidence(filePath);
  if (!filePath) return { name, status: 'blocked', reason: `${pathEnv}_REQUIRED` };
  if (!evidence) return { name, status: 'blocked', reason: `${pathEnv}_INVALID` };
  if (evidence.status !== expectedStatus) return { name, status: 'blocked', reason: `${name}_NOT_${expectedStatus.toUpperCase()}` };
  return { name, status: 'verified', evidence };
};

export const safeTimestamp = (value) => {
  const timestamp = Date.parse(value ?? '');
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
};

export const configuredSecret = (value) => typeof value === 'string'
  && value.trim().length >= 24
  && !/replace-with|changeme|example|correcthorse|demo|default/i.test(value);

export const safeEvidenceSummary = (evidence = {}) => ({
  status: evidence.status ?? 'unknown',
  owner: evidence.owner ?? null,
  approver: evidence.approver ?? null,
  verifiedAt: safeTimestamp(evidence.verifiedAt ?? evidence.timestamp ?? evidence.completedAt ?? evidence.approvedAt),
  reference: evidence.reference ?? evidence.evidenceId ?? null,
});
