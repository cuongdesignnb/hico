export type GoogleSheetCredentialSource = 'ADMIN_SETTINGS' | 'ENVIRONMENT' | 'NONE';

export interface GoogleSheetSettingsStatus {
  id: string;
  enabled: boolean;
  credentialConfigured: boolean;
  credentialType: 'SERVICE_ACCOUNT';
  credentialFingerprint: string | null;
  credentialMasked: string | null;
  spreadsheetIdMasked: string | null;
  sheetName: string | null;
  range: string | null;
  headerRow: number;
  timezone: string;
  referenceOnly: true;
  requireApproval: true;
  allowClearToken: boolean;
  maxRowsPerBatch: number;
  syncTimeoutSeconds: number;
  scheduleEnabled: false;
  status: 'DISABLED' | 'CONFIGURED' | 'ERROR' | 'REVOKED';
  source: GoogleSheetCredentialSource;
  lastTestStatus: 'NOT_TESTED' | 'SUCCESS' | 'FAILED';
  lastTestErrorCode: string | null;
  lastTestedAt: string | null;
  updatedAt: string | null;
  version: number;
}

export interface GoogleSheetConnectionTestResult {
  status: 'SUCCESS';
  source: GoogleSheetCredentialSource;
  spreadsheetTitle: string | null;
  sheetName: string;
  range: string;
  headerColumns: string[];
  rowsSampled: number;
  checkedAt: string;
  settings: GoogleSheetSettingsStatus;
}

export interface GoogleSheetDiscoveredSheet { sheetId: number; title: string; index: number; sheetType: 'GRID'; rowCount: number; columnCount: number; frozenRowCount: number; frozenColumnCount: number; }
export interface GoogleSheetDiscoveryResult { spreadsheetIdMasked: string | null; title: string | null; locale: string | null; timeZone: string | null; sheets: GoogleSheetDiscoveredSheet[]; }
export interface GoogleSheetHeaderDiscoveryResult { spreadsheetIdMasked: string | null; sheetId: number; sheetTitle: string; headerRow: number; headers: string[]; suggestedRange: string; warnings: Array<{ code: string; headers?: string[] }>; }

export interface GoogleSheetSettingsErrorBody { error?: string; code?: string; }
