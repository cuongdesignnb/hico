import { redact } from './redaction.js';

export const createLogger = ({ sink = console, now = () => new Date() } = {}) => {
  const normalize = (event) => {
    if (typeof event !== 'string') return event;
    try { return JSON.parse(event); } catch { return { message: event }; }
  };
  const write = (level, event) => sink[level]?.(JSON.stringify(redact({ ...normalize(event), timestamp: now().toISOString() }))) ?? sink.log?.(JSON.stringify(redact({ ...normalize(event), timestamp: now().toISOString() })));
  return { info: (event) => write('info', event), warn: (event) => write('warn', event), error: (event) => write('error', event) };
};
