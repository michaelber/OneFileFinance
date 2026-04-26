import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Account, type AccountType } from '../db';
import { 
  ChevronDown,
  LayoutDashboard,
  Settings,
  MoreHorizontal,
  HelpCircle,
  Calendar,
  Upload,
  BarChart3
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ICON_MAP } from '../constants';

interface TopBarProps {
  selectedAccountId?: number;
  onSelectAccount: (id?: number) => void;
  onSettingsClick: () => void;
  onRecurringClick: () => void;
  onImportClick: () => void;
  onReportingClick: () => void;
  activeView: 'dashboard' | 'settings' | 'recurring' | 'import' | 'reporting';
}

function AccountIcon({ typeId, types }: { typeId: number, types: AccountType[] }) {
  const type = types.find(t => t.id === typeId);
  if (!type || !type.icon || !ICON_MAP[type.icon]) {
    return <HelpCircle className="w-4 h-4" />;
  }
  return ICON_MAP[type.icon];
}

export function TopBar({ selectedAccountId, onSelectAccount, onSettingsClick, onRecurringClick, onImportClick, onReportingClick, activeView }: TopBarProps) {
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const accountTypes = useLiveQuery(() => db.account_types.toArray()) || [];
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const activeAccounts = accounts?.filter(a => !a.is_archived).sort((a, b) => (a.order || 0) - (b.order || 0)) || [];
  const topBarAccounts = activeAccounts.filter(a => a.show_in_top_bar);
  const moreAccounts = activeAccounts.filter(a => !a.show_in_top_bar);

  return (
    <div className="h-16 bg-topbar border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-2 mr-8">
        <img src="favicon.svg" alt="OneFileFinance Logo" className="w-8 h-8" />
        <span className="text-slate-900 dark:text-slate-100 font-bold text-lg tracking-tight hidden sm:block">OneFileFinance</span>
      </div>

      <div className="flex-1 flex items-center gap-1 min-w-0 h-full overflow-visible">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 h-full overflow-y-visible">
          <button
            onClick={() => onSelectAccount(undefined)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              (!selectedAccountId && activeView === 'dashboard')
                ? "bg-accent text-white shadow-md shadow-accent/20" 
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            All
          </button>

          {topBarAccounts.map(account => (
            <button
              key={account.id}
              onClick={() => onSelectAccount(account.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                (selectedAccountId === account.id && activeView === 'dashboard')
                  ? "bg-accent text-white shadow-md shadow-accent/20" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <AccountIcon typeId={account.account_type_id} types={accountTypes} />
              {account.name}
            </button>
          ))}
        </div>

        {moreAccounts.length > 0 && (
          <div className="relative ml-1">
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                (moreAccounts.some(a => a.id === selectedAccountId) && activeView === 'dashboard')
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <MoreHorizontal className="w-4 h-4" />
              More
              <ChevronDown className={cn("w-3 h-3 transition-transform", isMoreOpen && "rotate-180")} />
            </button>

            {isMoreOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsMoreOpen(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-2 overflow-hidden">
                  {moreAccounts.map(account => (
                    <button
                      key={account.id}
                      onClick={() => {
                        onSelectAccount(account.id);
                        setIsMoreOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-left transition-colors",
                        (selectedAccountId === account.id && activeView === 'dashboard')
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" 
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <span className="text-slate-400">
                        <AccountIcon typeId={account.account_type_id} types={accountTypes} />
                      </span>
                      {account.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 ml-4">
        <button 
          onClick={onReportingClick}
          className={cn(
            "p-2 rounded-full transition-all",
            activeView === 'reporting' 
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
          title="Reports"
        >
          <BarChart3 className="w-5 h-5" />
        </button>
        <button 
          onClick={onImportClick}
          className={cn(
            "p-2 rounded-full transition-all",
            activeView === 'import' 
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
          title="Import Transactions"
        >
          <Upload className="w-5 h-5" />
        </button>
        <button 
          onClick={onRecurringClick}
          className={cn(
            "p-2 rounded-full transition-all",
            activeView === 'recurring' 
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
          title="Recurring Transactions"
        >
          <Calendar className="w-5 h-5" />
        </button>
        <button 
          onClick={onSettingsClick}
          className={cn(
            "p-2 rounded-full transition-all",
            activeView === 'settings' 
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
