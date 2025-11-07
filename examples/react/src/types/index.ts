export interface Event {
  timestamp: string;
  name: string;
  data: any;
}

export interface AccountInfo {
  address: string;
  network: string;
  walletName: string;
}

export type Theme = 'dark' | 'light' | 'purple';

export interface ThemeColors {
  '--xc-background-color': string;
  '--xc-background-secondary': string;
  '--xc-background-tertiary': string;
  '--xc-text-color': string;
  '--xc-text-muted-color': string;
  '--xc-primary-color': string;
}

export interface StatusMessage {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface TransactionFormData {
  destination: string;
  amount: string;
}

export interface MessageFormData {
  message: string;
}
