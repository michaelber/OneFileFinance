import { db } from '../db';
import { importInto } from 'dexie-export-import';

export async function generateExportData() {
  const allSettings = await db.settings.toArray();
  const allowedSettingsKeys = ['accentColor', 'topBarColor', 'homeCurrency', 'darkMode', 'compactView', 'numberFormat', 'appPasswordHash', 'appPasswordSalt', 'fileEncryptionEnabled'];
  const allowedSettingsOnly = allSettings.filter(s => allowedSettingsKeys.includes(s.key));

  const data: any = {
    transactions: await db.transactions.toArray(),
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    category_rules: await db.category_rules.toArray(),
    account_types: await db.account_types.toArray(),
    recurring_transactions: await db.recurring_transactions.toArray(),
    settings: allowedSettingsOnly,
    version: 2,
    timestamp: Date.now()
  };

  // Strip $types and empty external_ids
  for (const table of ['transactions', 'accounts', 'categories', 'category_rules', 'account_types', 'recurring_transactions']) {
    if (data[table]) {
      data[table].forEach((item: any) => {
        if (item.$types) delete item.$types;
        if ('external_id' in item) {
          const extId = item.external_id;
          if (!extId || extId === '0' || extId === 0 || extId === 'undef' || extId === 'undefined') {
            delete item.external_id;
          }
        }
      });
    }
  }

  return JSON.stringify(data, null, 2);
}

export async function processImportData(text: string) {
  const data = JSON.parse(text);

  // If this is an old dexie-export-import blob, use importInto
  if (data.formatName === 'dexie') {
    const blob = new Blob([text], { type: 'application/json' });
    await importInto(db, blob, { clearTablesBeforeImport: true });
    return;
  }

  // Otherwise, use our clean array-based importer
  await db.transaction('rw', [db.transactions, db.accounts, db.categories, db.category_rules, db.account_types, db.recurring_transactions, db.settings], async () => {
    await db.transactions.clear();
    await db.accounts.clear();
    await db.categories.clear();
    await db.category_rules.clear();
    await db.account_types.clear();
    await db.recurring_transactions.clear();
    
    // Cleanse imported data
    for (const table of ['transactions', 'accounts', 'categories', 'category_rules', 'account_types', 'recurring_transactions']) {
      if (data[table]) {
        data[table].forEach((item: any) => {
          if (item.$types) delete item.$types;
          if ('external_id' in item) {
            const extId = item.external_id;
            if (!extId || extId === '0' || extId === 0 || extId === 'undef' || extId === 'undefined') {
              delete item.external_id;
            }
          }
        });
      }
    }

    if (data.transactions) await db.transactions.bulkAdd(data.transactions);
    if (data.accounts) await db.accounts.bulkAdd(data.accounts);
    if (data.categories) await db.categories.bulkAdd(data.categories);
    if (data.category_rules) await db.category_rules.bulkAdd(data.category_rules);
    if (data.account_types) await db.account_types.bulkAdd(data.account_types);
    if (data.recurring_transactions) await db.recurring_transactions.bulkAdd(data.recurring_transactions);
    
    if (data.settings && Array.isArray(data.settings)) {
      for (const s of data.settings) {
        // Only accept explicitly allowed settings (UI and security flags)
        const allowedSettingsKeys = ['accentColor', 'topBarColor', 'homeCurrency', 'darkMode', 'compactView', 'numberFormat', 'appPasswordHash', 'appPasswordSalt', 'fileEncryptionEnabled'];
        if (allowedSettingsKeys.includes(s.key)) {
           await db.settings.put({ key: s.key, value: s.value, updated_at: Date.now() });
        }
      }
    }
  });
}
