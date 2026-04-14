import React, { useState } from 'react';
import { TopBar } from './components/TopBar';
import { TransactionTable } from './components/TransactionTable';
import { SettingsView } from './components/SettingsView';
import { RecurringTransactionsTable } from './components/RecurringTransactionsTable';
import { ImportView } from './components/ImportView';
import { ReportingView } from './components/ReportingView';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Wallet, PieChart } from 'lucide-react';
import { cn } from './lib/utils';
import { processRecurringTransactions } from './services/recurringService';

export default function App() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>();
  const [view, setView] = useState<'dashboard' | 'settings' | 'recurring' | 'import' | 'reporting'>('dashboard');
  const [newTransactionIds, setNewTransactionIds] = useState<number[]>([]);

  React.useEffect(() => {
    if (view !== 'dashboard') {
      setNewTransactionIds([]);
    }
  }, [view]);

  const accounts = useLiveQuery(() => db.accounts.toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const settings = useLiveQuery(() => db.settings.toArray());
  const homeCurrency = settings?.find(s => s.key === 'homeCurrency')?.value || '€';
  const numberFormat = settings?.find(s => s.key === 'numberFormat')?.value || 'default';

  // Apply UI settings
  React.useEffect(() => {
    if (settings) {
      const accentColor = settings.find(s => s.key === 'accentColor')?.value || '#2563eb';
      const topBarColor = settings.find(s => s.key === 'topBarColor')?.value || '#ffffff';
      const darkMode = settings.find(s => s.key === 'darkMode')?.value || false;
      
      document.documentElement.style.setProperty('--accent-color', accentColor);
      
      if (darkMode) {
        document.documentElement.classList.add('dark');
        // In dark mode, we might want to override the top bar color if it's too light
        // or just let the user set it. The requirement says "darker colors in dark mode"
        document.documentElement.style.setProperty('--top-bar-color', topBarColor);
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.setProperty('--top-bar-color', topBarColor);
      }
    }
  }, [settings]);

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);

  const accountBalance = transactions
    ?.filter(t => !selectedAccountId || t.account_id === selectedAccountId)
    .reduce((acc, t) => acc + t.amount, 0) || 0;


  const handleSelectAccount = (id?: number) => {
    setSelectedAccountId(id);
    setView('dashboard');
  };

  const hasProcessedRef = React.useRef(false);

  // Ctrl+S to save to linked file
  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        
        try {
          const data = {
            transactions: await db.transactions.toArray(),
            accounts: await db.accounts.toArray(),
            categories: await db.categories.toArray(),
            category_rules: await db.category_rules.toArray(),
            account_types: await db.account_types.toArray(),
            settings: await db.settings.toArray(),
            recurring_transactions: await db.recurring_transactions.toArray(),
            version: 2,
            timestamp: Date.now()
          };
          
          const jsonString = JSON.stringify(data, null, 2);
          
          let fileHandleSetting = await db.settings.get('linkedFileHandle');
          let fileHandle = fileHandleSetting?.value;

          if (!fileHandle) {
            if (!('showSaveFilePicker' in window)) {
              // Fallback for browsers without File System Access API
              const blob = new Blob([jsonString], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `onefilefinance-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
              a.click();
              URL.revokeObjectURL(url);
              return;
            }

            fileHandle = await (window as any).showSaveFilePicker({
              suggestedName: `onefilefinance-backup-${format(new Date(), 'yyyy-MM-dd')}.json`,
              types: [{
                description: 'JSON File',
                accept: { 'application/json': ['.json'] },
              }],
            });
            await db.settings.put({ key: 'linkedFileHandle', value: fileHandle, updated_at: Date.now() });
          }

          if (fileHandle) {
            // Verify permission
            if (await fileHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
              if (await fileHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
                throw new Error('Permission denied');
              }
            }

            const writable = await fileHandle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            console.log('Saved to linked file successfully');
          }
        } catch (error) {
          console.error('Failed to save to linked file:', error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Seed initial data if empty
  React.useEffect(() => {
    const seedData = async () => {
      if (hasProcessedRef.current) return;
      hasProcessedRef.current = true;

      // Process recurring transactions on start
      const ids = await processRecurringTransactions(true);
      if (ids.length > 0) {
        setNewTransactionIds(ids);
      }

      const typeCount = await db.account_types.count();
      let cashTypeId: number;
      let stocksTypeId: number;

      if (typeCount === 0) {
        cashTypeId = await db.account_types.add({ name: 'Cash', icon: 'Wallet', updated_at: Date.now() }) as number;
        stocksTypeId = await db.account_types.add({ name: 'Stocks', icon: 'TrendingUp', updated_at: Date.now() }) as number;
        await db.account_types.add({ name: 'Real estate', icon: 'Home', updated_at: Date.now() });
        await db.account_types.add({ name: 'Venture capital', icon: 'Briefcase', updated_at: Date.now() });
      } else {
        const types = await db.account_types.toArray();
        cashTypeId = types.find(t => t.name === 'Cash')?.id || types[0].id!;
        stocksTypeId = types.find(t => t.name === 'Stocks')?.id || types[0].id!;
      }

      const accountCount = await db.accounts.count();
      if (accountCount === 0) {
        const cashId = await db.accounts.add({
          name: 'Main Checking',
          account_type_id: cashTypeId,
          is_liquid: true,
          is_archived: false,
          show_in_top_bar: true,
          description: 'Primary bank account',
          updated_at: Date.now()
        });

        const stocksId = await db.accounts.add({
          name: 'Investment Portfolio',
          account_type_id: stocksTypeId,
          is_liquid: false,
          is_archived: false,
          show_in_top_bar: true,
          description: 'Stock market investments',
          updated_at: Date.now()
        });

        const foodCatId = await db.categories.add({ name: 'Food & Dining', updated_at: Date.now() });
        const transportCatId = await db.categories.add({ name: 'Transportation', updated_at: Date.now() });
        const salaryCatId = await db.categories.add({ name: 'Salary', updated_at: Date.now() });
      }
    };
    seedData();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      <TopBar 
        selectedAccountId={selectedAccountId} 
        onSelectAccount={handleSelectAccount} 
        onSettingsClick={() => setView('settings')}
        onRecurringClick={() => setView('recurring')}
        onImportClick={() => setView('import')}
        onReportingClick={() => setView('reporting')}
        activeView={view}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {view === 'dashboard' && (
          <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full">
            <TransactionTable 
              accountId={selectedAccountId} 
              homeCurrency={homeCurrency} 
              numberFormat={numberFormat}
              accountBalance={accountBalance}
              newTransactionIds={newTransactionIds}
            />
          </div>
        )}

        {view === 'recurring' && (
          <div className="flex-1 overflow-y-auto p-8">
            <header className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Recurring Transactions</h2>
              </div>
              <button 
                onClick={() => setView('dashboard')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Back to Transactions
              </button>
            </header>
            <div className="max-w-7xl mx-auto">
              <RecurringTransactionsTable />
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="flex-1 overflow-y-auto">
            <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20 transition-colors duration-300">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Settings</h2>
              </div>
              <button 
                onClick={() => setView('dashboard')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Back to Transactions
              </button>
            </header>
            <div className="max-w-7xl mx-auto">
              <SettingsView />
            </div>
          </div>
        )}

        {view === 'import' && (
          <ImportView 
            onBack={() => setView('dashboard')} 
            initialAccountId={selectedAccountId}
            onImportComplete={(accountId, importedIds) => {
              setSelectedAccountId(accountId);
              setNewTransactionIds(importedIds);
              setView('dashboard');
            }}
          />
        )}

        {view === 'reporting' && (
          <div className="flex-1 overflow-y-auto">
            <ReportingView />
          </div>
        )}
      </main>
    </div>
  );
}
