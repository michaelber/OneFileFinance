import * as jose from 'jose';
import { db } from '../db';
import { decryptData } from '../lib/crypto';
import { differenceInDays, parseISO } from 'date-fns';

export const API_ORIGIN = "https://api.enablebanking.com";
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export async function getEnableBankingCredentials(sessionPassword?: string | null) {
  const appIdObj = await db.settings.get('enableBanking_appId');
  const privateKeyObj = await db.settings.get('enableBanking_privateKey');

  if (!appIdObj?.value || !privateKeyObj?.value) {
    throw new Error('Banking API credentials not configured');
  }

  let privateKey = privateKeyObj.value;
  if (privateKey.startsWith('OFF_ENC::')) {
      if (!sessionPassword) {
          throw new Error('App is locked or password not provided to decrypt private key');
      }
      privateKey = await decryptData(privateKey, sessionPassword);
  }

  return {
    applicationId: appIdObj.value,
    privateKey
  };
}

export async function generateEnableBankingJWT(sessionPassword?: string | null): Promise<string> {
  const { applicationId, privateKey } = await getEnableBankingCredentials(sessionPassword);

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  // Import the PKCS8 PEM private key
  const key = await jose.importPKCS8(privateKey, 'RS256');

  const jwt = await new jose.SignJWT({
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat,
    exp,
  })
    .setProtectedHeader({ alg: 'RS256', kid: applicationId })
    .sign(key);

  return jwt;
}

export async function fetchWithAuth(
  endpoint: string, 
  options: RequestInit = {}, 
  sessionPassword?: string | null
) {
  const jwt = await generateEnableBankingJWT(sessionPassword);
  
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${jwt}`);
  
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
  }

  const plainHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    plainHeaders[key] = value;
  });

  let response;
  try {
    response = await tauriFetch(`${API_ORIGIN}${endpoint}`, {
      ...options,
      headers: plainHeaders
    });
  } catch (e: any) {
    const errorMsg = typeof e === 'string' ? e : e?.message || String(e);
    throw new Error(`Network Error: ${errorMsg}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'No response body');
    throw new Error(`EnableBanking API Error ${response.status}: ${text}`);
  }

  return response.json();
}

export interface ASPSP {
  name: string;
  country: string;
  id?: string;
  logo?: string;
}

export interface ApplicationDetails {
  application_id: string;
  redirect_urls: string[];
}

export async function getApplicationDetails(sessionPassword?: string | null): Promise<ApplicationDetails> {
  return fetchWithAuth('/application', {}, sessionPassword);
}

export async function getASPSPs(sessionPassword?: string | null): Promise<{ aspsps: ASPSP[] }> {
  return fetchWithAuth('/aspsps', {}, sessionPassword);
}

export async function startAuthFlow(
  aspspName: string, 
  aspspCountry: string, 
  redirectUrl: string, 
  sessionPassword?: string | null
): Promise<{ url: string }> {
  // We generate a random UUID for the state
  const state = crypto.randomUUID();
  const valid_until = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days
  
  const body = {
    access: { valid_until },
    aspsp: { name: aspspName, country: aspspCountry },
    state,
    redirect_url: redirectUrl,
    psu_type: "personal",
  };

  return fetchWithAuth('/auth', {
    method: 'POST',
    body: JSON.stringify(body)
  }, sessionPassword);
}

export async function createSession(code: string, sessionPassword?: string | null): Promise<any> {
  return fetchWithAuth('/sessions', {
    method: 'POST',
    body: JSON.stringify({ code })
  }, sessionPassword);
}

export async function getAccounts(sessionPassword?: string | null): Promise<any> {
  // Accounts are usually returned in the session response or retrieved via /accounts
  return fetchWithAuth('/accounts', {}, sessionPassword);
}

export async function getTransactions(
  accountId: string, 
  dateFrom: string, 
  continuationKey?: string, 
  sessionPassword?: string | null
): Promise<{ transactions: any[], continuation_key?: string }> {
  let url = `/accounts/${accountId}/transactions?date_from=${encodeURIComponent(dateFrom)}`;
  if (continuationKey) {
    url += `&continuation_key=${encodeURIComponent(continuationKey)}`;
  }
  
  const headers = {
    'psu-ip-address': '127.0.0.1', // Local app
    'psu-user-agent': navigator.userAgent || 'OneFileFinance',
  };
  
  return fetchWithAuth(url, { headers }, sessionPassword);
}

export interface AnalyzedTransaction {
  status: 'WOULD_INSERT' | 'DUPLICATE';
  duplicateReason?: string;
  mapped: {
    account_id: number;
    date: string;
    description: string;
    amount: number;
    category_id: number | undefined;
    external_id: string | undefined;
    updated_at: number;
  };
  raw: any;
}

export interface AnalysisResult {
  total: number;
  would_insert: number;
  duplicates: number;
  results: AnalyzedTransaction[];
}

/**
 * Maps raw EnableBanking API transactions and checks each one against existing
 * DB transactions for duplicates. Does NOT write to the database.
 * Used by syncBankTransactions (for the actual sync) and the debug dry-run panel.
 */
export async function analyzeBankTransactions(
  rawTransactions: any[],
  accountId?: number
): Promise<AnalysisResult> {
  const existingTransactions = typeof accountId === 'number'
    ? await db.transactions.where('account_id').equals(accountId).toArray()
    : await db.transactions.toArray();
  const categoryRules = await db.category_rules.orderBy('priority').toArray();

  const categorize = (desc: string): number | undefined => {
    if (!desc) return undefined;
    const match = categoryRules.find(r => desc.toLowerCase().includes(r.search_value.toLowerCase()));
    return match ? match.category_id : undefined;
  };

  const results: AnalyzedTransaction[] = [];

  for (const t of rawTransactions) {
    const rawAmount = parseFloat(t.transaction_amount?.amount ?? '0');
    const amount = t.credit_debit_indicator === 'CRDT' ? Math.abs(rawAmount) : -Math.abs(rawAmount);
    const date = t.booking_date || t.value_date || new Date().toISOString().split('T')[0];

    // Counterpart name: creditor for outgoing, debtor for incoming
    const counterpartObj = amount < 0 ? t.creditor : t.debtor;
    let counterpart = counterpartObj?.name || t.creditor?.name || t.debtor?.name || '';

    let remittance = '';
    if (Array.isArray(t.remittance_information)) {
      remittance = t.remittance_information.join(' ');
    } else if (typeof t.remittance_information === 'string') {
      remittance = t.remittance_information;
    }

    const description = [counterpart, remittance].filter(Boolean).join(' - ') || 'Unknown';
    const extId: string | undefined = t.transaction_id || t.entry_reference || undefined;

    // Dedup: prefer external_id match, fall back to fuzzy (amount + description + ±3 days)
    let isDuplicate = false;
    let duplicateReason: string | undefined;

    if (extId) {
      const match = existingTransactions.find(tx => tx.external_id === extId);
      if (match) {
        isDuplicate = true;
        duplicateReason = `external_id match (db id=${match.id})`;
      }
    }

    if (!isDuplicate) {
      const match = existingTransactions.find(tx => {
        if (tx.amount !== amount) return false;
        if ((tx.description || '').trim().toLowerCase() !== description.trim().toLowerCase()) return false;
        try {
          return Math.abs(differenceInDays(parseISO(tx.date), parseISO(date))) <= 3;
        } catch {
          return false;
        }
      });
      if (match) {
        isDuplicate = true;
        duplicateReason = `fuzzy match (db id=${match.id})`;
      }
    }

    results.push({
      status: isDuplicate ? 'DUPLICATE' : 'WOULD_INSERT',
      duplicateReason,
      mapped: {
        account_id: accountId,
        date,
        description,
        amount,
        category_id: categorize(description),
        external_id: extId,
        updated_at: Date.now(),
      },
      raw: t,
    });
  }

  return {
    total: results.length,
    would_insert: results.filter(r => r.status === 'WOULD_INSERT').length,
    duplicates: results.filter(r => r.status === 'DUPLICATE').length,
    results,
  };
}

/**
 * Fetches transactions for a linked bank account, deduplicates against existing
 * DB transactions, auto-categorizes, and bulk-inserts new ones.
 * Returns the IDs of newly inserted transactions.
 */
export async function syncBankTransactions(
  accountId: number,
  ebAccountUid: string,
  dateFrom: string,
  sessionPassword?: string | null
): Promise<number[]> {
  // 1. Fetch all pages of transactions
  let allTransactions: any[] = [];
  let continuationKey: string | undefined;
  do {
    const txData = await getTransactions(ebAccountUid, dateFrom, continuationKey, sessionPassword);
    if (txData.transactions) allTransactions.push(...txData.transactions);
    continuationKey = txData.continuation_key;
  } while (continuationKey);

  // 2. Analyze (map + dedup + categorize) without writing to DB
  const { results } = await analyzeBankTransactions(allTransactions, accountId);

  // 3. Bulk insert the non-duplicate records
  const importedIds: number[] = [];
  await db.transaction('rw', db.transactions, async () => {
    for (const r of results) {
      if (r.status === 'WOULD_INSERT') {
        const id = await db.transactions.add(r.mapped);
        importedIds.push(id as number);
      }
    }
  });

  return importedIds;
}
