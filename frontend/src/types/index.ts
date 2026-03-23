export enum VaultErrorCode {
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  VAULT_NOT_FOUND = 'VAULT_NOT_FOUND',
  VAULT_CORRUPTED = 'VAULT_CORRUPTED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CATEGORY_IN_USE = 'CATEGORY_IN_USE',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
}

export class VaultError extends Error {
  constructor(
    public code: VaultErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

export interface PasswordItem {
  id: string;
  title: string;
  categoryId?: string;
  username?: string;
  password: string;
  url?: string;
  notes?: string;
  tags?: string[];
  favorite: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Vault {
  version: string;
  items: PasswordItem[];
  categories: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultFile {
  version: string;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface AppConfig {
  autoLockMinutes: number;
  clipboardAutoDeleteSeconds: number;
  keyDerivationAlgorithm: 'pbkdf2' | 'scrypt' | 'argon2id';
  theme: 'light' | 'dark' | 'system';
  language: string;
  lockOnDeactivate: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  autoLockMinutes: 5,
  clipboardAutoDeleteSeconds: 30,
  keyDerivationAlgorithm: 'pbkdf2',
  theme: 'system',
  language: 'ko',
  lockOnDeactivate: false,
};

export type EncryptionAlgorithm = 'aes-256-gcm';
export type KeyDerivationAlgorithm = 'pbkdf2' | 'scrypt';

export interface EncryptedData {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface KeyDerivationOptions {
  algorithm: KeyDerivationAlgorithm;
  salt: string;
  iterations?: number;
  scryptParams?: {
    N: number;
    r: number;
    p: number;
  };
}

export interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 16,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
};

export type BackupProviderType = 'local' | 'google-drive';

export interface BackupProvider {
  type: BackupProviderType;
  authenticate?(): Promise<void>;
  upload?(data: string, filename: string): Promise<void>;
  download?(filename: string): Promise<string>;
}

export type PasswordItemUpdate = Partial<Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'>>;
export type NewPasswordItem = Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'>;
export type NewCategory = Omit<Category, 'id' | 'createdAt'>;
export type VaultState = 'locked' | 'unlocked' | 'creating' | 'error';

export interface SearchResult {
  item: PasswordItem;
  score?: number;
  matches?: Array<{
    key: string;
    value: string;
    indices: [number, number][];
  }>;
}