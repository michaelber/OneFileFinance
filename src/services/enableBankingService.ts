import * as jose from 'jose';
import { db } from '../db';
import { decryptData } from '../lib/crypto';

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
