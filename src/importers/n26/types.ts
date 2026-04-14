export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

export interface N26Config {
  email: string;
  password: string;
  /** Absolute path for storing the encrypted session file */
  sessionPath: string;
  /** 
   * Passphrase used to encrypt the session file at rest.
   * Security Note:
   * - sessionSecret never leaves the host machine — it is only used to encrypt/decrypt the local session file.
   * - The session file contains authentication cookies equivalent to a logged-in session. Treat it with the same care as a password. Recommend storing it inside the app's data directory with restrictive file permissions (chmod 600).
   * - This module transmits credentials to https://app.n26.com over TLS. It does not send them to any third party.
   */
  sessionSecret: string;
  logger?: Logger;
}

export interface ImportOptions {
  /** ISO date string. Defaults to 30 days ago. */
  from?: string;
  /** ISO date string. Defaults to now. */
  to?: string;
  /** How long to wait for the user to approve MFA push, in ms. Default: 90_000 */
  mfaTimeoutMs?: number;
  /** If true, show the browser window during login. Default: false */
  headedOnFirstLogin?: boolean;
}

export interface ImportResult {
  transactions: Transaction[];
  /** ISO timestamp of this sync */
  syncedAt: string;
  /** True if a new MFA login was required during this run */
  requiredLogin: boolean;
}

export type TransactionType =
  | "card_payment"
  | "bank_transfer"
  | "direct_debit"
  | "atm"
  | "internal_transfer"
  | "unknown";

/** Canonical transaction — matches the host app's existing schema */
export interface Transaction {
  id: string;
  date: string;           // ISO 8601 date
  amount: number;         // negative = debit, positive = credit
  currency: string;       // ISO 4217
  merchantName: string | null;
  category: string | null;
  type: TransactionType;
  reference: string | null;
  balance: number | null;
  raw: Record<string, unknown>; // original N26 payload, for future-proofing
}

export interface N26RawTransaction {
  id: string;
  amount: number;
  currencyCode: string;
  visibleTS: number;           // Unix ms timestamp
  merchantName?: string;
  category?: string;
  type: string;                // e.g. "PT", "CT", "DT", "AA"
  partnerName?: string;
  referenceText?: string;
  linkId?: string;
  [key: string]: unknown;
}
