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
import { TrendingUp, TrendingDown, Wallet, PieChart, Save, Check, FolderOpen } from 'lucide-react';
import { cn } from './lib/utils';
import { processRecurringTransactions } from './services/recurringService';
import { saveDatabaseToFile, promptSaveAsDatabase, openDatabaseFromFile, openDatabaseFromPath, pickDatabaseFile, getCliArgs } from './lib/fileHandling';
import { encryptData } from './lib/crypto';
import { StatusBar } from './components/StatusBar';
import { seedBlankData, seedSampleData } from './lib/seedData';

export default function App() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'unauthorized' | 'authorized'>('checking');
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);

  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>();
  const [view, setView] = useState<'dashboard' | 'settings' | 'recurring' | 'import' | 'reporting'>('dashboard');
  const [newTransactionIds, setNewTransactionIds] = useState<number[]>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [addedRecurringCount, setAddedRecurringCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [draggedFile, setDraggedFile] = useState<File | null>(null);
  const hasProcessedRef = React.useRef(false);

  React.useEffect(() => {
    const checkAuth = async () => {
      let activePath = null;
      let loadFromCli = false;

      if ((window as any).__TAURI_INTERNALS__) {
        const args = await getCliArgs();
        const finFile = args.find(a => a.toLowerCase().endsWith('.fin'));
        
        if (finFile) {
           activePath = finFile;
           loadFromCli = true;
           setCurrentFilePath(activePath);
           await db.settings.put({ key: 'currentFilePath', value: activePath, updated_at: Date.now() });
        } else {
           const pathObj = await db.settings.get('currentFilePath');
           if (pathObj?.value) {
             activePath = pathObj.value;
             setCurrentFilePath(activePath);
           }
        }
      }

      if (loadFromCli && activePath) {
        try {
          await openDatabaseFromPath(activePath, null);
          const hashObj = await db.settings.get('appPasswordHash');
          if (hashObj?.value) {
            setAuthStatus('unauthorized');
          } else {
            setAuthStatus('authorized');
          }
          return;
        } catch (e: any) {
          if (e.message === 'FILE_ENCRYPTED') {
            setPendingFilePath(activePath);
            setAuthStatus('unauthorized');
            return;
          }
          console.error("Failed to open file from CLI", e);
          alert("Failed to open file: " + e.message);
        }
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

  // Tauri shortcuts & tracking & auto-save & drag-drop
  React.useEffect(() => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    
    let isDirty = false;
    let unlistenDragDrop: (() => void) | undefined;

    const handleChange = () => {
      isDirty = true;
      setSaveStatus('unsaved');
    };

    const setupDragDrop = async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const { readFile } = await import('@tauri-apps/plugin-fs');
        
        unlistenDragDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
          if (event.payload.type === 'drop') {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              const filePath = paths[0];
              const ext = filePath.split('.').pop()?.toLowerCase();
              if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') {
                try {
                  const bytes = await readFile(filePath);
                  const fileName = filePath.split(/[\\/]/).pop() || `import.${ext}`;
                  const mimeType = ext === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                  const file = new File([bytes], fileName, { type: mimeType });
                  
                  setDraggedFile(file);
                  setView('import');
                } catch (err) {
                  console.error("Failed to read dropped file:", err);
                  alert("Could not read the dropped file.");
                }
              }
            }
          }
        });
      } catch(err) {
        console.error("Failed to setup drag-drop:", err);
      }
    };
    
    setupDragDrop();

    // Attempt to hook Dexie changes for Auto-Save
    try {
      (db as any).on('changes', handleChange);
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
        handleSave(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    // Auto-save interval (check every 1 minute)
    const interval = setInterval(() => {
      if (isDirty && currentFilePath) {
        isDirty = false;
        handleSave(true);
      }
    }, 60000);

    return () => {
      if (unlistenDragDrop) unlistenDragDrop();
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

  const handleSave = async (isAutoSave = false) => {
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
    } catch(err: any) {
      console.error("Save failed", err);
      if (!isAutoSave) {
        alert("Could not save the file: " + (err.message || 'unknown error'));
      }
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
    } catch(err: any) {
      console.error("Save failed", err);
      alert("Could not save the file: " + (err.message || 'unknown error'));
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
        const hashObj = await db.settings.get('appPasswordHash');
        if (!hashObj?.value) {
            setSessionPassword(null);
            setAuthStatus('authorized');
        } else {
            const saltObj = await db.settings.get('appPasswordSalt');
            if (saltObj?.value && sessionPassword) {
                const { hashPassword } = await import('./lib/crypto');
                const hash = await hashPassword(sessionPassword, saltObj.value as string);
                if (hash === hashObj.value) {
                    setAuthStatus('authorized');
                } else {
                    setAuthStatus('unauthorized');
                    setSessionPassword(null);
                }
            } else {
                setAuthStatus('unauthorized');
                setSessionPassword(null);
            }
        }
      }
    } catch(err: any) {
      console.error("Open failed", err);
      if ((err.message === 'FILE_ENCRYPTED' || err.message === 'VERIFICATION_FAILED') && err.path) {
          // Link it and jump to login screen
          setPendingFilePath(err.path);
          setAuthStatus('unauthorized');
      } else {
          alert("Failed to open the file due to an error.");
      }
    }
  };

  const handleClearData = async () => {
    try {
      await Promise.all([
        db.transactions.clear(),
        db.accounts.clear(),
        db.categories.clear(),
        db.category_rules.clear(),
        db.account_types.clear(),
        db.settings.clear(),
        db.recurring_transactions.clear()
      ]);
      window.location.reload();
    } catch(err: any) {
      console.error("Clear data failed", err);
      alert("Could not clear data: " + (err.message || 'unknown error'));
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
  const numberFormat = settings?.find(s => s.key === 'numberFormat')?.value || 'space-comma';

  // Apply UI settings
  React.useEffect(() => {
    if (settings) {
      const accentColor = settings.find(s => s.key === 'accentColor')?.value || '#2563eb';
      const topBarColor = settings.find(s => s.key === 'topBarColor')?.value || '#f8fafc';
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

  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if we need onboarding
  React.useEffect(() => {
    if (authStatus !== 'authorized') return;

    const checkOnboarding = async () => {
      const accountCount = await db.accounts.count();
      if (accountCount === 0) {
        setShowOnboarding(true);
      } else {
        // Process recurring transactions
        if (!hasProcessedRef.current) {
          hasProcessedRef.current = true;
          const ids = await processRecurringTransactions(true);
          if (ids.length > 0) {
            setNewTransactionIds(ids);
            setAddedRecurringCount(ids.length);
          }
        }
      }
    };
    checkOnboarding();
  }, [authStatus]);

  if (authStatus === 'checking') return null;

  if (authStatus === 'unauthorized') {
    return <LoginScreen 
      onLogin={(pwd) => {
        setSessionPassword(pwd);
        setAuthStatus('authorized');
      }} 
      currentFilePath={currentFilePath}
      pendingFilePath={pendingFilePath}
      onUnlockPending={async (pwd) => {
         if (!pendingFilePath) return;
         try {
             const path = await openDatabaseFromPath(pendingFilePath, pwd);
             setCurrentFilePath(path);
             await db.settings.put({ key: 'currentFilePath', value: path, updated_at: Date.now() });
             setSaveStatus('saved');
             
             const hashObj = await db.settings.get('appPasswordHash');
             if (!hashObj?.value) {
                 setSessionPassword(null);
                 setPendingFilePath(null);
                 setAuthStatus('authorized');
             } else {
                 const saltObj = await db.settings.get('appPasswordSalt');
                 if (saltObj?.value) {
                     const { hashPassword } = await import('./lib/crypto');
                     const hash = await hashPassword(pwd, saltObj.value as string);
                     if (hash !== hashObj.value) {
                         throw new Error('VERIFICATION_FAILED');
                     }
                 }
                 setSessionPassword(pwd);
                 setPendingFilePath(null);
                 setAuthStatus('authorized');
             }
         } catch (e) {
             throw e; // LoginScreen will catch and display error
         }
      }}
      onOpenFile={async (password, onStartLoading) => {
        try {
          const path = await pickDatabaseFile();
          if (!path) return;
          
          if (onStartLoading) onStartLoading();
          
          const openedPath = await openDatabaseFromPath(path, password);
          if (openedPath) {
            setCurrentFilePath(openedPath);
            await db.settings.put({ key: 'currentFilePath', value: openedPath, updated_at: Date.now() });
            setSaveStatus('saved');
            // Check auth again because the restored file might have a new password hash
            const hashObj = await db.settings.get('appPasswordHash');
            if (!hashObj?.value) {
                // if it has no password, let them right in
                setSessionPassword(null);
                setAuthStatus('authorized');
            } else {
                const saltObj = await db.settings.get('appPasswordSalt');
                if (saltObj?.value) {
                    const { hashPassword } = await import('./lib/crypto');
                    const hash = await hashPassword(password, saltObj.value as string);
                    if (hash === hashObj.value) {
                        setSessionPassword(password);
                        setAuthStatus('authorized');
                    } else {
                        setSessionPassword(null);
                        // The file successfully imported, but incorrect password entered. Let them to login screen
                        setAuthStatus('unauthorized');
                    }
                } else {
                    setSessionPassword(null);
                    setAuthStatus('unauthorized');
                }
            }
          }
        } catch(err: any) {
          console.error("Open failed", err);
          if ((err.message === 'FILE_ENCRYPTED' || err.message === 'VERIFICATION_FAILED') && err.path) {
              setPendingFilePath(err.path);
              setAuthStatus('unauthorized');
          } else {
              alert("Failed to open the file due to an error.");
          }
        }
      }}
    />;
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
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {showOnboarding && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full p-10 border border-slate-200 dark:border-slate-800 animate-fade-in">
              <div className="text-center mb-10 flex flex-col items-center">
                <img src="favicon.svg" alt="OneFileFinance Logo" className="w-20 h-20 mb-6 drop-shadow-md" />
                <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">Welcome to OneFileFinance</h2>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mx-auto">How would you like to start your financial journey?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={async () => {
                    await seedBlankData();
                    setShowOnboarding(false);
                  }}
                  className="group flex flex-col items-center text-center p-6 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200"
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                    <Check className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Blank Slate</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Start fresh with just a few basic account types and essential categories.</p>
                </button>

                <button
                  onClick={async () => {
                    await seedSampleData();
                    setShowOnboarding(false);
                  }}
                  className="group flex flex-col items-center text-center p-6 bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-200"
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                    <PieChart className="w-6 h-6 text-slate-400 group-hover:text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Sample Data</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Load comprehensive sample data with 3 years of generated transactions.</p>
                </button>
              </div>

              {(window as any).__TAURI_INTERNALS__ && (
                <div className="mt-8 text-center border-t border-slate-200 dark:border-slate-800 pt-6">
                  <button
                    onClick={async () => {
                      try {
                        const path = await openDatabaseFromFile(sessionPassword);
                        if (path) {
                          setCurrentFilePath(path);
                          await db.settings.put({ key: 'currentFilePath', value: path, updated_at: Date.now() });
                          setSaveStatus('saved');
                          setShowOnboarding(false);
                          
                          const hashObj = await db.settings.get('appPasswordHash');
                          if (hashObj?.value) {
                              setAuthStatus('unauthorized');
                              setSessionPassword(null);
                          }
                        }
                      } catch (e: any) {
                          if (e.message === 'FILE_ENCRYPTED') {
                              setPendingFilePath(e.path);
                              setAuthStatus('unauthorized');
                              setShowOnboarding(false); // They will go to Login Screen and returning sets auth
                          } else {
                              console.error(e);
                              alert("Error opening file: " + e.message);
                          }
                      }
                    }}
                    className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-medium transition-colors inline-flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Open existing .fin file
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
                onClearData={handleClearData}
              />
            </div>
          </div>
        )}

        {view === 'import' && (
          <ImportView 
            onBack={() => {
              setView('dashboard');
              setDraggedFile(null);
            }} 
            initialAccountId={selectedAccountId}
            initialFile={draggedFile}
            onImportComplete={(accountId, importedIds) => {
              setSelectedAccountId(accountId);
              setNewTransactionIds(importedIds);
              setImportedCount(importedIds.length);
              setDraggedFile(null);
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
