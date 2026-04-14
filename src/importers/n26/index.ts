import { chromium } from 'playwright';
import { N26Config, ImportOptions, ImportResult, Transaction } from './types';
import { loadSession, clearSession as clearSessionImpl } from './session';
import { performLoginIfNeeded, checkSessionValid } from './auth';
import { captureTransactions } from './interceptor';
import { transformTransaction } from './transform';
import { N26ImportError } from './errors';

export * from './types';
export * from './errors';

const defaultLogger = {
  debug: (msg: string, ...args: unknown[]) => console.debug(msg, ...args),
  info: (msg: string, ...args: unknown[]) => console.info(msg, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(msg, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(msg, ...args),
};

export async function importN26Transactions(
  config: N26Config,
  options?: ImportOptions
): Promise<ImportResult> {
  const logger = config.logger || defaultLogger;
  const configWithLogger = { ...config, logger };
  const opts = options || {};

  let browser;
  try {
    const storageState = await loadSession(configWithLogger);
    
    browser = await chromium.launch({ 
      headless: storageState ? true : !(opts.headedOnFirstLogin ?? false) 
    });

    const context = await browser.newContext(storageState ? { storageState } : undefined);
    const page = await context.newPage();

    const requiredLogin = await performLoginIfNeeded(page, context, configWithLogger, opts);
    
    const rawTransactions = await captureTransactions(page, configWithLogger, opts);
    
    let transactions: Transaction[] = rawTransactions.map(transformTransaction);

    if (opts.from) {
      const fromTime = new Date(opts.from).getTime();
      transactions = transactions.filter(tx => new Date(tx.date).getTime() >= fromTime);
    }
    if (opts.to) {
      const toTime = new Date(opts.to).getTime();
      transactions = transactions.filter(tx => new Date(tx.date).getTime() <= toTime);
    }

    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    logger.info(`[n26-importer] Successfully imported ${transactions.length} transactions.`);

    return {
      transactions,
      syncedAt: new Date().toISOString(),
      requiredLogin,
    };
  } catch (error: any) {
    logger.error(`[n26-importer] Import failed: ${error.message}`);
    if (error.name === 'N26AuthError' || error.name === 'MFATimeoutError' || error.name === 'SessionExpiredError' || error.name === 'NoTransactionsFoundError') {
      throw error;
    }
    throw new N26ImportError(`N26 import failed: ${error.message}`, { cause: error });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function isSessionValid(config: N26Config): Promise<boolean> {
  const configWithLogger = { ...config, logger: config.logger || defaultLogger };
  return checkSessionValid(configWithLogger);
}

export async function clearSession(config: N26Config): Promise<void> {
  const configWithLogger = { ...config, logger: config.logger || defaultLogger };
  return clearSessionImpl(configWithLogger);
}
