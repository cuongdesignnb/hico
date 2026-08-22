import { fork as defaultFork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const PREVIEW_JOB_MODES = Object.freeze(['legacy', 'quick', 'full']);
export const PREVIEW_JOB_STATUSES = Object.freeze(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);
export const PREVIEW_JOB_STAGES = Object.freeze([
  'STARTING', 'READING_SHEET', 'LOADING_CATALOG', 'LOADING_PROVIDER', 'PARSING',
  'BUILDING_CANDIDATE', 'VALIDATING', 'PERSISTING', 'COMPLETED',
]);

const workerFile = fileURLToPath(new URL('./catalogPreviewJobWorker.js', import.meta.url));
const terminalStatuses = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);
const safeErrorCodes = new Set([
  'CATALOG_PREVIEW_FAILED', 'CATALOG_PREVIEW_TIMED_OUT', 'CATALOG_PREVIEW_CANCELLED',
  'CATALOG_PREVIEW_WORKER_FAILED', 'CATALOG_PREVIEW_WORKER_START_FAILED', 'CATALOG_PREVIEW_SHUTDOWN',
  'SHEET_SOURCE_TAB_INVALID', 'SHEET_RANGE_INCOMPLETE', 'SHEET_HEADER_REQUIRED', 'SHEET_HEADER_CHANGED',
  'FULL_SYNC_EMPTY_CANDIDATE', 'FULL_SYNC_GROUPING_FAILED', 'FULL_SYNC_SOURCE_EMPTY', 'FULL_SYNC_INVALID_ROWS',
  'PROVIDER_SNAPSHOT_CHANGED',
]);

export class CatalogPreviewJobError extends Error {
  constructor(message, { code = 'CATALOG_PREVIEW_JOB_FAILED', status = 400, details } = {}) {
    super(message);
    this.name = 'CatalogPreviewJobError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const safeError = (error, fallbackCode = 'CATALOG_PREVIEW_WORKER_FAILED') => ({
  errorCode: typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : fallbackCode,
  errorMessage: safeErrorCodes.has(error?.code) && typeof error?.message === 'string' && error.message.length <= 240
    ? error.message
    : 'Không thể hoàn tất preview catalog.',
});

const publicJob = (job) => ({
  id: job.id,
  mode: job.mode,
  status: job.status,
  stage: job.stage,
  actorId: job.actorId,
  batchId: job.batchId ?? null,
  batch: job.batch ?? null,
  errorCode: job.errorCode ?? null,
  errorMessage: job.errorMessage ?? null,
  createdAt: job.createdAt,
  startedAt: job.startedAt ?? null,
  finishedAt: job.finishedAt ?? null,
  expiresAt: job.expiresAt ?? null,
});

const assertMode = (mode) => {
  if (!PREVIEW_JOB_MODES.includes(mode)) throw new CatalogPreviewJobError('Preview mode không hợp lệ.', { code: 'CATALOG_PREVIEW_MODE_INVALID', status: 422 });
};

export const createCatalogPreviewJobManager = ({
  workerPath = workerFile,
  fork = defaultFork,
  now = () => new Date(),
  idFactory = () => randomUUID(),
  deadlineMs = 8 * 60_000,
  terminateGraceMs = 3_000,
  terminalTtlMs = 20 * 60_000,
} = {}) => {
  const jobs = new Map();
  let activeJobId = null;
  let stopped = false;

  const cleanup = (job) => {
    if (!jobs.has(job.id)) return;
    jobs.delete(job.id);
  };

  const scheduleCleanup = (job) => {
    if (job.cleanupTimer) clearTimeout(job.cleanupTimer);
    job.cleanupTimer = setTimeout(() => cleanup(job), terminalTtlMs);
    job.cleanupTimer.unref?.();
  };

  const clearRuntimeTimers = (job) => {
    if (job.deadlineTimer) clearTimeout(job.deadlineTimer);
    if (job.killTimer) clearTimeout(job.killTimer);
    job.deadlineTimer = null;
    job.killTimer = null;
  };

  const finalize = (job, status, changes = {}) => {
    if (terminalStatuses.has(job.status)) return;
    clearRuntimeTimers(job);
    job.status = status;
    Object.assign(job, changes);
    job.finishedAt = now().toISOString();
    job.expiresAt = new Date(now().getTime() + terminalTtlMs).toISOString();
    if (activeJobId === job.id) activeJobId = null;
    scheduleCleanup(job);
  };

  const terminate = (job, { status, errorCode, errorMessage }) => {
    if (terminalStatuses.has(job.status)) return;
    const child = job.child;
    finalize(job, status, { errorCode: errorCode ?? null, errorMessage: errorMessage ?? null });
    if (!child || child.killed) return;
    try { child.disconnect?.(); } catch { /* child may already be disconnected */ }
    try { child.kill('SIGTERM'); } catch { /* child may already have exited */ }
    job.killTimer = setTimeout(() => {
      if (!child.killed) {
        try { child.kill('SIGKILL'); } catch { /* child may already have exited */ }
      }
    }, terminateGraceMs);
    job.killTimer.unref?.();
  };

  const attachChild = (job, child) => {
    job.child = child;
    child.on('message', (message) => {
      if (!message || message.jobId !== job.id || terminalStatuses.has(job.status)) return;
      if (message.type === 'STAGE' && PREVIEW_JOB_STAGES.includes(message.stage)) {
        job.stage = message.stage;
        return;
      }
      if (message.type === 'RESULT') {
        finalize(job, 'SUCCEEDED', {
          stage: 'COMPLETED',
          batchId: message.batch?.id ?? message.batchId ?? null,
          batch: message.batch ?? null,
        });
        return;
      }
      if (message.type === 'ERROR') {
        finalize(job, 'FAILED', { ...safeError(message, 'CATALOG_PREVIEW_FAILED') });
      }
    });
    child.on('error', (error) => {
      if (!terminalStatuses.has(job.status)) finalize(job, 'FAILED', safeError(error));
    });
    child.on('exit', (code, signal) => {
      if (terminalStatuses.has(job.status)) return;
      finalize(job, 'FAILED', {
        errorCode: 'CATALOG_PREVIEW_WORKER_FAILED',
        errorMessage: `Preview worker stopped unexpectedly${signal ? ` (${signal})` : ` (exit ${code ?? 'unknown'})`}.`,
      });
    });
  };

  const start = ({ mode = 'legacy', actor = {} } = {}) => {
    assertMode(mode);
    if (stopped) throw new CatalogPreviewJobError('Preview job manager đã dừng.', { code: 'CATALOG_PREVIEW_MANAGER_STOPPED', status: 503 });
    if (activeJobId) throw new CatalogPreviewJobError('Một preview catalog khác đang chạy.', { code: 'CATALOG_PREVIEW_IN_PROGRESS', status: 409, details: { jobId: activeJobId } });
    const createdAt = now().toISOString();
    const job = {
      id: idFactory(), mode, status: 'QUEUED', stage: 'STARTING',
      actorId: actor.id ?? null, actorEmail: actor.email ?? null,
      createdAt, expiresAt: new Date(now().getTime() + terminalTtlMs).toISOString(),
    };
    jobs.set(job.id, job);
    activeJobId = job.id;
    try {
      const child = fork(workerPath, [], { env: { ...process.env }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      attachChild(job, child);
      job.status = 'RUNNING';
      job.startedAt = now().toISOString();
      job.deadlineTimer = setTimeout(() => terminate(job, { status: 'TIMED_OUT', errorCode: 'CATALOG_PREVIEW_TIMED_OUT', errorMessage: 'Preview catalog đã vượt quá thời gian cho phép.' }), deadlineMs);
      job.deadlineTimer.unref?.();
      child.send({ type: 'START', jobId: job.id, mode, actorId: job.actorId, actorEmail: job.actorEmail });
    } catch (error) {
      finalize(job, 'FAILED', safeError(error, 'CATALOG_PREVIEW_WORKER_START_FAILED'));
    }
    return publicJob(job);
  };

  const get = (id) => {
    const job = jobs.get(id);
    if (!job) throw new CatalogPreviewJobError('Không tìm thấy preview job hoặc job đã hết hạn.', { code: 'CATALOG_PREVIEW_JOB_NOT_FOUND', status: 404 });
    return publicJob(job);
  };

  const cancel = (id) => {
    const job = jobs.get(id);
    if (!job) throw new CatalogPreviewJobError('Không tìm thấy preview job hoặc job đã hết hạn.', { code: 'CATALOG_PREVIEW_JOB_NOT_FOUND', status: 404 });
    if (terminalStatuses.has(job.status)) return publicJob(job);
    terminate(job, { status: 'CANCELLED', errorCode: 'CATALOG_PREVIEW_CANCELLED', errorMessage: 'Preview đã được Admin hủy.' });
    return publicJob(job);
  };

  const shutdown = async () => {
    stopped = true;
    const active = [...jobs.values()].filter((job) => !terminalStatuses.has(job.status));
    active.forEach((job) => terminate(job, { status: 'CANCELLED', errorCode: 'CATALOG_PREVIEW_SHUTDOWN', errorMessage: 'Preview bị dừng khi backend shutdown.' }));
    await Promise.all(active.map((job) => new Promise((resolve) => {
      if (!job.child || job.child.exitCode !== null) return resolve();
      const timer = setTimeout(resolve, terminateGraceMs + 250);
      timer.unref?.();
      job.child.once('exit', () => { clearTimeout(timer); resolve(); });
    })));
  };

  return {
    start,
    get,
    cancel,
    shutdown,
    active: () => activeJobId ? get(activeJobId) : null,
    inspect: () => [...jobs.values()].map(publicJob),
  };
};

export { publicJob };
