import { Page, Response } from 'playwright';
import { N26Config, ImportOptions, N26RawTransaction } from './types';
import { NoTransactionsFoundError } from './errors';

function isTransactionResponse(url: string): boolean {
  return (
    url.includes("api.n26.com") &&
    (url.includes("/transactions") || url.includes("/smrt/transactions"))
  ) || (
    url.includes("n26.com") &&
    url.includes("transactions")
  );
}

export async function captureTransactions(
  page: Page,
  config: N26Config,
  options: ImportOptions
): Promise<N26RawTransaction[]> {
  const interceptedUrls: string[] = [];
  const rawTransactions = new Map<string, N26RawTransaction>();

  page.on('response', async (response: Response) => {
    const url = response.url();
    if (isTransactionResponse(url)) {
      interceptedUrls.push(url);
      config.logger?.debug(`[n26-importer] Intercepted transaction response: ${url}`);
      try {
        const json = await response.json();
        let items: any[] = [];
        if (Array.isArray(json)) {
          items = json;
        } else if (json && Array.isArray(json.data)) {
          items = json.data;
        } else if (json && Array.isArray(json.transactions)) {
          items = json.transactions;
        } else if (json && Array.isArray(json.items)) {
          items = json.items;
        }

        for (const item of items) {
          if (item && item.id) {
            rawTransactions.set(item.id, item as N26RawTransaction);
          }
        }
      } catch (err) {
        config.logger?.debug(`[n26-importer] Failed to parse response from ${url}`);
      }
    }
  });

  config.logger?.info('[n26-importer] Navigating to feed to capture transactions...');
  await page.goto('https://app.n26.com/feed/transactions/', { waitUntil: 'networkidle', timeout: 30000 });

  let clicks = 0;
  const maxClicks = 20;

  while (clicks < maxClicks) {
    const currentTxs = Array.from(rawTransactions.values());
    
    if (options.from) {
      const fromTime = new Date(options.from).getTime();
      let oldestTime = Infinity;
      for (const tx of currentTxs) {
        if (tx.visibleTS < oldestTime) {
          oldestTime = tx.visibleTS;
        }
      }

      if (oldestTime < fromTime && currentTxs.length > 0) {
        config.logger?.info('[n26-importer] Reached transactions older than "from" date. Stopping pagination.');
        break;
      }
    } else if (clicks >= 1) {
      config.logger?.info('[n26-importer] No "from" date specified. Stopping after 1 pagination click.');
      break;
    }

    const loadMoreBtn = page.getByText('Mehr laden', { exact: false });
    const fallbackBtn = page.locator('button:has-text("Mehr laden")');
    
    let btnToClick = null;
    if (await loadMoreBtn.count() > 0 && await loadMoreBtn.first().isVisible()) {
      btnToClick = loadMoreBtn.first();
    } else if (await fallbackBtn.count() > 0 && await fallbackBtn.first().isVisible()) {
      btnToClick = fallbackBtn.first();
    }

    if (btnToClick) {
      config.logger?.info(`[n26-importer] Clicking "Mehr laden" (Click ${clicks + 1}/${maxClicks})`);
      await btnToClick.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      clicks++;
    } else {
      config.logger?.info('[n26-importer] "Mehr laden" button not found or not visible. All history loaded.');
      break;
    }
  }

  if (rawTransactions.size === 0) {
    throw new NoTransactionsFoundError(
      `No transactions captured. Intercepted URLs: \n${interceptedUrls.join('\n') || 'None'}`
    );
  }

  config.logger?.info(`[n26-importer] Captured ${rawTransactions.size} raw transactions after deduplication.`);
  return Array.from(rawTransactions.values());
}
