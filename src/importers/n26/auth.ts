import { chromium, BrowserContext, Page } from 'playwright';
import { N26Config, ImportOptions } from './types';
import { loadSession, saveSession } from './session';
import { MFATimeoutError, N26AuthError } from './errors';

export async function performLoginIfNeeded(
  page: Page,
  context: BrowserContext,
  config: N26Config,
  options: ImportOptions
): Promise<boolean> {
  config.logger?.info('[n26-importer] Navigating to N26 transactions page...');
  await page.goto('https://app.n26.com/transactions', { waitUntil: 'networkidle' });

  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    config.logger?.info('[n26-importer] Session is valid, skipped login.');
    return false; // No login required
  }

  config.logger?.info('[n26-importer] Login required. Proceeding with authentication...');
  
  try {
    await page.locator('input[name="email"]').fill(config.email);
    
    const nextButton = page.locator('button[type="submit"], button:has-text("Next"), button:has-text("Continue")').first();
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }
    
    await page.locator('input[name="password"]').waitFor({ state: 'visible' });
    await page.locator('input[name="password"]').fill(config.password);
    
    const loginButton = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Login")').first();
    await loginButton.click();
  } catch (err: any) {
    throw new N26AuthError(`Failed to fill login form: ${err.message}`);
  }

  const mfaTimeoutMs = options.mfaTimeoutMs ?? 90_000;
  config.logger?.info(`[n26-importer] MFA wait started (timeout: ${mfaTimeoutMs / 1000} seconds). Please approve on your phone.`);
  
  const startTime = Date.now();
  let mfaApproved = false;

  while (Date.now() - startTime < mfaTimeoutMs) {
    await page.waitForTimeout(2000);
    const url = page.url();
    if (!url.includes('/login')) {
      mfaApproved = true;
      break;
    }
  }

  if (!mfaApproved) {
    throw new MFATimeoutError('MFA approval timed out. User did not approve push in time.');
  }

  config.logger?.info('[n26-importer] MFA approved successfully.');

  const storageState = await context.storageState();
  await saveSession(config, storageState);

  return true; // Login was required
}

export async function checkSessionValid(config: N26Config): Promise<boolean> {
  const storageState = await loadSession(config);
  if (!storageState) return false;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await page.goto('https://app.n26.com/feed/transactions/', { waitUntil: 'networkidle' });
    const url = page.url();
    return !url.includes('/login');
  } catch (err) {
    return false;
  } finally {
    await browser.close();
  }
}
