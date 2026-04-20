import React, { useState } from 'react';
import { TopBar } from './components/TopBar';
import { TransactionTable } from './components/TransactionTable';
import { SettingsView } from './components/SettingsView';
import { RecurringTransactionsTable } from './components/RecurringTransactionsTable';
import { ImportView } from './components/ImportView';
import { ReportingView } from './components/ReportingView';
import { LoginScreen } from './components/LoginScreen';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Wallet, PieChart, Save } from 'lucide-react';
import { cn } from './lib/utils';
import { processRecurringTransactions } from './services/recurringService';
import { saveDatabaseToFile, promptSaveAsDatabase, openDatabaseFromFile } from './lib/fileHandling';
import { encryptData } from './lib/crypto';
import { StatusBar } from './components/StatusBar';

export default function App() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'unauthorized' | 'authorized'>('checking');
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);

  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>();
  const [view, setView] = useState<'dashboard' | 'settings' | 'recurring' | 'import' | 'reporting'>('dashboard');
  const [newTransactionIds, setNewTransactionIds] = useState<number[]>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [addedRecurringCount, setAddedRecurringCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const hasProcessedRef = React.useRef(false);

  React.useEffect(() => {
    const checkAuth = async () => {
      const pathObj = await db.settings.get('currentFilePath');
      if (pathObj?.value && (window as any).__TAURI_INTERNALS__) {
        setCurrentFilePath(pathObj.value);
      }

      const hashObj = await db.settings.get('appPasswordHash');
      if (hashObj?.value) {
        setAuthStatus('unauthorized');
      } else {
        setAuthStatus('authorized');
      }
    };
    checkAuth();
  }, []);

  // Tauri shortcuts & tracking & auto-save
  React.useEffect(() => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    
    let isDirty = false;

    const handleChange = () => {
      isDirty = true;
      setSaveStatus('unsaved');
    };

    // Attempt to hook Dexie changes for Auto-Save
    try {
      db.on('changes', handleChange);
    } catch(e) {
      // Fallback if db.on('changes') needs an addon that's misconfigured
      const tables = ['transactions', 'accounts', 'categories', 'category_rules', 'account_types', 'recurring_transactions'];
      tables.forEach(tableName => {
        try {
          db.table(tableName).hook('creating', handleChange);
          db.table(tableName).hook('updating', handleChange);
          db.table(tableName).hook('deleting', handleChange);
        } catch(err) {}
      });
    }
    
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        isDirty = false; // Prevent auto-save from double saving immediately
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    // Auto-save interval (check every 1 minute)
    const interval = setInterval(() => {
      if (isDirty && currentFilePath) {
        isDirty = false;
        handleSave();
      }
    }, 60000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(interval);
      try {
        db.on('changes').unsubscribe(handleChange);
      } catch(e) {
        const tables = ['transactions', 'accounts', 'categories', 'category_rules', 'account_types', 'recurring_transactions'];
        tables.forEach(tableName => {
          try {
            db.table(tableName).hook('creating').unsubscribe(handleChange);
            db.table(tableName).hook('updating').unsubscribe(handleChange);
            db.table(tableName).hook('deleting').unsubscribe(handleChange);
          } catch(err) {}
        });
      }
    };
  }, [currentFilePath, sessionPassword]);

  const handleSave = async () => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    setSaveStatus('saving');
    try {
      const path = await saveDatabaseToFile(currentFilePath, sessionPassword);
      if (path) {
        setCurrentFilePath(path);
        setSaveStatus('saved');
        await db.settings.put({ key: 'currentFilePath', value: path, updated_at: Date.now() });
        await db.settings.put({ key: 'lastBackup', value: Date.now(), updated_at: Date.now() });
      } else {
        setSaveStatus('unsaved');
      }
    } catch(err) {
      console.error("Save failed", err);
      setSaveStatus('unsaved');
    }
  };

  const handleSaveAs = async () => {
    setSaveStatus('saving');
    try {
      const path = await promptSaveAsDatabase(sessionPassword);
      if (path) {
        setCurrentFilePath(path);
        setSaveStatus('saved');
        await db.settings.put({ key: 'currentFilePath', value: path, updated_at: Date.now() });
        await db.settings.put({ key: 'lastBackup', value: Date.now(), updated_at: Date.now() });
      } else {
        setSaveStatus('unsaved');
      }
    } catch(err) {
      console.error("Save failed", err);
      setSaveStatus('unsaved');
    }
  };

  const handleOpen = async () => {
    try {
      const path = await openDatabaseFromFile(sessionPassword);
      if (path) {
        setCurrentFilePath(path);
        await db.settings.put({ key: 'currentFilePath', value: path, updated_at: Date.now() });
        setSaveStatus('saved');
      }
    } catch(err: any) {
      console.error("Open failed", err);
      if (err.message === 'FILE_ENCRYPTED' || err.message === 'VERIFICATION_FAILED') {
          // In a real flow, if currently missing an active session, prompt for pwd
          alert("Could not open file. Password is incorrect or file is encrypted and no password set.");
      } else {
          alert("Failed to open the file due to an error.");
      }
    }
  };

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

      // Ensure appropriate text contrast for the statusbar
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
      };
      const { r, g, b } = hexToRgb(topBarColor);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const textColor = luminance > 0.5 ? '#1e293b' : '#f8fafc';
      
      document.documentElement.style.setProperty('--accent-color', accentColor);
      document.documentElement.style.setProperty('--top-bar-text-color', textColor);
      
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

  // Seed initial data if empty
  React.useEffect(() => {
    if (authStatus !== 'authorized') return;

    const seedData = async () => {
      if (hasProcessedRef.current) return;
      hasProcessedRef.current = true;

      // Process recurring transactions on start
      const ids = await processRecurringTransactions(true);
      if (ids.length > 0) {
        setNewTransactionIds(ids);
        setAddedRecurringCount(ids.length);
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
  }, [authStatus]);

  if (authStatus === 'checking') return null;

  if (authStatus === 'unauthorized') {
    return <LoginScreen onLogin={(pwd) => {
      setSessionPassword(pwd);
      setAuthStatus('authorized');
    }} />;
  }

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
              <SettingsView 
                currentFilePath={currentFilePath}
                sessionPassword={sessionPassword}
                onOpen={handleOpen}
                onSave={handleSave}
                onSaveAs={handleSaveAs}
              />
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
              setImportedCount(importedIds.length);
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

      <StatusBar 
        currentFilePath={currentFilePath}
        saveStatus={saveStatus}
        onSave={handleSave}
        addedRecurringCount={addedRecurringCount}
        importedCount={importedCount}
      />
    </div>
  );
}
