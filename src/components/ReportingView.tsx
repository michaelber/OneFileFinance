import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  calculateNetWorth, 
  calculateNetWorthYTD, 
  calculateNetWorth12M, 
  calculateMonthlyAverage, 
  calculateYearlyAverage, 
  calculateSavingsRate, 
  calculateFinancialFreedomYears
} from '../lib/reportingUtils';
import { formatAmount } from '../lib/formatters';
import { NetWorthTab, SavingsRateTab, AccountsTab, CategoriesTab, CategoryDetailsTab } from './ReportingTabs';

export function ReportingView() {
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const accountTypes = useLiveQuery(() => db.account_types.toArray());
  const settings = useLiveQuery(() => db.settings.toArray());

  const homeCurrency = settings?.find(s => s.key === 'homeCurrency')?.value || '€';
  const numberFormat = settings?.find(s => s.key === 'numberFormat')?.value || 'default';
  const compactView = settings?.find(s => s.key === 'compactView')?.value ?? true;

  const [activeTab, setActiveTab] = useState<'netWorth' | 'categories' | 'savingsRate' | 'accounts' | 'categoryDetails'>('netWorth');
  const [initialCategoryDetailsFilter, setInitialCategoryDetailsFilter] = useState<{ categoryId?: string, year?: number, month?: number, accountId?: string } | undefined>();

  const handleCellClick = (categoryId?: string, year?: number, month?: number, accountId?: string) => {
    setInitialCategoryDetailsFilter({ categoryId, year, month, accountId });
    setActiveTab('categoryDetails');
  };

  const formatRoundedAmount = (amount: number, hideZero = false) => {
    if (hideZero && Math.round(amount) === 0) return '';
    return formatAmount(Math.round(amount), homeCurrency, numberFormat, 0);
  };

  const metrics = useMemo(() => {
    if (!transactions) return null;

    return {
      netWorth: calculateNetWorth(transactions),
      netWorthYTD: calculateNetWorthYTD(transactions),
      netWorth12M: calculateNetWorth12M(transactions),
      monthlyAverage: calculateMonthlyAverage(transactions),
      yearlyAverage: calculateYearlyAverage(transactions),
      savingsRate: calculateSavingsRate(transactions, categories),
      financialFreedomYears: calculateFinancialFreedomYears(transactions)
    };
  }, [transactions, categories]);

  if (!metrics) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Reports dashboard</h2>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto">
        <button
          className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === 'netWorth' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('netWorth')}
        >
          Net Worth
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === 'categories' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === 'categoryDetails' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('categoryDetails')}
        >
          Categories details
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === 'savingsRate' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('savingsRate')}
        >
          Savings Rate
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm whitespace-nowrap ${activeTab === 'accounts' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('accounts')}
        >
          Accounts
        </button>
      </div>

      {activeTab === 'netWorth' && (
        <NetWorthTab 
          transactions={transactions} 
          metrics={metrics} 
          formatRoundedAmount={formatRoundedAmount} 
        />
      )}

      {activeTab === 'savingsRate' && (
        <SavingsRateTab 
          transactions={transactions} 
          categories={categories} 
          metrics={metrics} 
          formatRoundedAmount={formatRoundedAmount} 
          compactView={compactView} 
        />
      )}

      {activeTab === 'accounts' && (
        <AccountsTab 
          transactions={transactions} 
          accounts={accounts} 
          accountTypes={accountTypes} 
          categories={categories}
          formatRoundedAmount={formatRoundedAmount} 
          compactView={compactView} 
        />
      )}

      {activeTab === 'categories' && (
        <CategoriesTab 
          transactions={transactions} 
          categories={categories} 
          accounts={accounts}
          formatRoundedAmount={formatRoundedAmount} 
          compactView={compactView} 
          onCellClick={handleCellClick}
        />
      )}

      {activeTab === 'categoryDetails' && (
        <CategoryDetailsTab 
          transactions={transactions} 
          categories={categories} 
          accounts={accounts}
          formatRoundedAmount={formatRoundedAmount} 
          compactView={compactView} 
          initialFilters={initialCategoryDetailsFilter}
        />
      )}
    </div>
  );
}
