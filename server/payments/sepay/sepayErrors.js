export class SePaySettingsError extends Error {
  constructor(message, { code = 'SEPAY_SETTINGS_INVALID', status = 422, details } = {}) {
    super(message);
    this.name = 'SePaySettingsError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
