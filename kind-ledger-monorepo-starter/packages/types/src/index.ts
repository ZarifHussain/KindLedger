
export type Provider = 'xero' | 'qbo' | 'csv';

export interface ConnectionStatus {
  connected: boolean;
  displayName?: string;
  lastSyncedAt?: string | null;
}
