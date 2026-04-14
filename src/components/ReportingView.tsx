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
  calculateFinancialFreedomYears,
  calculateCumulativeSum,
  calculateCapitalGains
} from '../lib/reportingUtils';
import { formatAmount } from '../lib/formatters';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Legend, PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, min, max, getYear, getMonth } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

export function ReportingView() {
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const accountTypes = useLiveQuery(() => db.account_types.toArray());
  const settings = useLiveQuery(() => db.settings.toArray());

  const homeCurrency = settings?.find(s => s.key === 'homeCurrency')?.value || '€';
  const numberFormat = settings?.find(s => s.key === 'numberFormat')?.value || 'default';
  const compactView = settings?.find(s => s.key === 'compactView')?.value ?? true;

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'netWorth' | 'categories' | 'savingsRate' | 'accounts'>('netWorth');
  const [expandedSavingsYears, setExpandedSavingsYears] = useState<Record<string, boolean>>({});

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const metrics = useMemo(() => {
    if (!transactions) return null;

    return {
      netWorth: calculateNetWorth(transactions),
      netWorthYTD: calculateNetWorthYTD(transactions),
      netWorth12M: calculateNetWorth12M(transactions),
      monthlyAverage: calculateMonthlyAverage(transactions),
      yearlyAverage: calculateYearlyAverage(transactions),
      savingsRate: calculateSavingsRate(transactions),
      financialFreedomYears: calculateFinancialFreedomYears(transactions)
    };
  }, [transactions]);

  const cumulativeData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    const dates = transactions.map(t => parseISO(t.date));
    const earliest = min(dates);
    const latest = max([new Date(), ...dates]);
    
    const months = eachMonthOfInterval({ start: startOfMonth(earliest), end: endOfMonth(latest) });
    
    return months.map(month => {
      const endOfThisMonth = endOfMonth(month);
      return {
        date: format(month, 'MMM yyyy'),
        amount: calculateCumulativeSum(transactions, endOfThisMonth)
      };
    });
  }, [transactions]);

  const incomeExpenseData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    const years = Array.from(new Set(transactions.map(t => getYear(parseISO(t.date))))).sort((a, b) => b - a);
    
    const data: any[] = [];
    
    const calculateNetCategoryTotals = (txs: typeof transactions) => {
      const categoryTotals = txs.reduce((acc, t) => {
        const catId = t.category_id || 0;
        acc[catId] = (acc[catId] || 0) + t.amount;
        return acc;
      }, {} as Record<number, number>);
      
      let income = 0;
      let expenses = 0;
      Object.values(categoryTotals).forEach(total => {
        if (total > 0) income += total;
        else if (total < 0) expenses += total;
      });
      return { income, expenses };
    };

    years.forEach(year => {
      const yearTxs = transactions.filter(t => getYear(parseISO(t.date)) === year);
      const { income, expenses } = calculateNetCategoryTotals(yearTxs);
      const savingsRate = income > 0 ? ((income + expenses) / income) * 100 : 0; // expenses is negative
      
      data.push({
        date: year.toString(),
        isYear: true,
        year,
        income,
        expenses,
        savingsRate: Math.max(0, savingsRate)
      });
      
      if (expandedSavingsYears[year]) {
        const months = Array.from({ length: 12 }, (_, i) => i);
        months.forEach(month => {
          const monthTxs = yearTxs.filter(t => getMonth(parseISO(t.date)) === month);
          if (monthTxs.length === 0) return;
          
          const { income: mIncome, expenses: mExpenses } = calculateNetCategoryTotals(monthTxs);
          const mSavingsRate = mIncome > 0 ? ((mIncome + mExpenses) / mIncome) * 100 : 0;
          
          data.push({
            date: format(new Date(year, month), 'MMM yyyy'),
            isYear: false,
            year,
            income: mIncome,
            expenses: mExpenses,
            savingsRate: Math.max(0, mSavingsRate)
          });
        });
      }
    });
    
    return data;
  }, [transactions, expandedSavingsYears]);

  const accountDistributionData = useMemo(() => {
    if (!transactions || !accounts) return [];
    
    const balances = accounts
      .filter(acc => !acc.is_archived)
      .map(acc => {
      const balance = transactions
        .filter(t => t.account_id === acc.id)
        .reduce((sum, t) => sum + t.amount, 0);
      return { name: acc.name, value: Math.max(0, balance), rawBalance: balance };
    }).filter(a => a.rawBalance !== 0 && a.value > 0);
    
    return balances.sort((a, b) => b.value - a.value);
  }, [transactions, accounts]);

  const accountTypeDistributionData = useMemo(() => {
    if (!transactions || !accounts || !accountTypes) return [];
    
    const balancesByType = accountTypes.map(type => {
      const typeAccounts = accounts.filter(a => a.account_type_id === type.id && !a.is_archived).map(a => a.id);
      const balance = transactions
        .filter(t => typeAccounts.includes(t.account_id))
        .reduce((sum, t) => sum + t.amount, 0);
      return { name: type.name, value: Math.max(0, balance) };
    }).filter(t => t.value > 0);
    
    return balancesByType.sort((a, b) => b.value - a.value);
  }, [transactions, accounts, accountTypes]);

  const accountTableData = useMemo(() => {
    if (!transactions || !accounts || !categories) return { rows: [], total: 0, totalCapitalGains: 0 };
    
    const rows = accounts
      .filter(acc => !acc.is_archived)
      .map(acc => {
      const accTxs = transactions.filter(t => t.account_id === acc.id);
      const amount = accTxs.reduce((sum, t) => sum + t.amount, 0);
      const capitalGains = calculateCapitalGains(accTxs, categories);
      return { id: acc.id, name: acc.name, amount, capitalGains };
    }).filter(row => row.amount !== 0);
    
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    const totalCapitalGains = rows.reduce((sum, r) => sum + r.capitalGains, 0);
    
    const sortedRows = rows
      .map(r => ({ ...r, percentage: total !== 0 ? (r.amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
      
    return { rows: sortedRows, total, totalCapitalGains };
  }, [transactions, accounts, categories]);

  const pivotData = useMemo(() => {
    if (!transactions || !categories) return null;

    const years = Array.from(new Set(transactions.map(t => getYear(parseISO(t.date))))).sort((a, b) => b - a);
    const months = Array.from({ length: 12 }, (_, i) => i); // 0-11

    const data: Record<string, any> = {};
    
    categories.forEach(cat => {
      data[cat.id!] = { name: cat.name, total: 0, years: {} };
      years.forEach(year => {
        data[cat.id!].years[year] = { total: 0, months: {} };
        months.forEach(month => {
          data[cat.id!].years[year].months[month] = 0;
        });
      });
    });

    data['uncategorized'] = { name: 'Uncategorized', total: 0, years: {} };
    years.forEach(year => {
      data['uncategorized'].years[year] = { total: 0, months: {} };
      months.forEach(month => {
        data['uncategorized'].years[year].months[month] = 0;
      });
    });

    transactions.forEach(t => {
      const date = parseISO(t.date);
      const year = getYear(date);
      const month = getMonth(date);
      const catId = t.category_id || 'uncategorized';

      if (data[catId]) {
        data[catId].total += t.amount;
        data[catId].years[year].total += t.amount;
        data[catId].years[year].months[month] += t.amount;
      }
    });

    // Filter out empty categories
    const filteredData = Object.entries(data)
      .filter(([_, catData]) => catData.total !== 0)
      .sort((a, b) => b[1].total - a[1].total); // Sort by total amount descending

    const grandTotal = filteredData.reduce((sum, [_, catData]) => sum + catData.total, 0);
    const yearTotals: Record<number, number> = {};
    years.forEach(year => {
      yearTotals[year] = filteredData.reduce((sum, [_, catData]) => sum + catData.years[year].total, 0);
    });

    let maxAbsValue = Math.abs(grandTotal);
    filteredData.forEach(([_, catData]) => {
      maxAbsValue = Math.max(maxAbsValue, Math.abs(catData.total));
      years.forEach(year => {
        maxAbsValue = Math.max(maxAbsValue, Math.abs(catData.years[year].total));
        months.forEach(month => {
          maxAbsValue = Math.max(maxAbsValue, Math.abs(catData.years[year].months[month]));
        });
      });
    });

    return { years, months, data: filteredData, grandTotal, yearTotals, maxAbsValue };
  }, [transactions, categories]);

  const getBgColor = (amount: number, maxAbs: number) => {
    if (amount === 0) return 'transparent';
    const opacity = maxAbs > 0 ? Math.max(0.05, Math.min(0.6, Math.abs(amount) / maxAbs)) : 0;
    return amount > 0 ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`;
  };

  if (!metrics || !pivotData) return <div className="p-8">Loading...</div>;

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
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Net Worth" value={formatAmount(metrics.netWorth, homeCurrency, numberFormat)} />
            <MetricCard title="Net Worth YTD" value={formatAmount(metrics.netWorthYTD, homeCurrency, numberFormat)} />
            <MetricCard title="Net Worth (12M)" value={formatAmount(metrics.netWorth12M, homeCurrency, numberFormat)} />
            <MetricCard 
              title="Financial Freedom" 
              value={metrics.financialFreedomYears !== null ? `${metrics.financialFreedomYears.toFixed(1)} Years` : 'N/A'} 
            />
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Cumulative Net Worth</h3>
            <div className="h-[400px] w-full min-w-0">
              <ResponsiveContainer width="99%" height={400}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => formatAmount(val, homeCurrency, numberFormat)} />
                  <Tooltip 
                    formatter={(value: number) => formatAmount(value, homeCurrency, numberFormat)}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {activeTab === 'savingsRate' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard title="Monthly Average" value={formatAmount(metrics.monthlyAverage, homeCurrency, numberFormat)} />
            <MetricCard title="Yearly Average" value={formatAmount(metrics.yearlyAverage, homeCurrency, numberFormat)} />
            <MetricCard 
              title="Savings Rate" 
              value={metrics.savingsRate !== null ? `${(metrics.savingsRate * 100).toFixed(1)}%` : 'N/A'} 
            />
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-semibold mb-1 text-slate-900 dark:text-slate-100">Income vs Expenses</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Click on a year to drill down to monthly data</p>
            <div className="h-[400px] w-full min-w-0">
              <ResponsiveContainer width="99%" height={400}>
                <ComposedChart 
                  data={incomeExpenseData}
                  stackOffset="sign"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickFormatter={(val) => formatAmount(val, homeCurrency, numberFormat)} />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    formatter={(value: number, name: string) => name === 'Savings Rate' ? `${value.toFixed(1)}%` : formatAmount(value, homeCurrency, numberFormat)}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  />
                  <Legend />
                  <Bar 
                    yAxisId="left" 
                    dataKey="income" 
                    stackId="a" 
                    fill="#10b981" 
                    name="Income" 
                    cursor="pointer" 
                    onClick={(data: any) => {
                      if (data && data.isYear) {
                        setExpandedSavingsYears(prev => ({ ...prev, [data.year]: !prev[data.year] }));
                      }
                    }}
                  />
                  <Bar 
                    yAxisId="left" 
                    dataKey="expenses" 
                    stackId="a" 
                    fill="#ef4444" 
                    name="Expenses" 
                    cursor="pointer" 
                    onClick={(data: any) => {
                      if (data && data.isYear) {
                        setExpandedSavingsYears(prev => ({ ...prev, [data.year]: !prev[data.year] }));
                      }
                    }}
                  />
                  <Line yAxisId="right" type="monotone" dataKey="savingsRate" stroke="#f59e0b" name="Savings Rate" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {activeTab === 'accounts' && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Accounts Overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className={cn("px-6 font-medium", compactView ? "py-1.5" : "py-3")}>Account</th>
                    <th className={cn("px-6 font-medium text-right", compactView ? "py-1.5" : "py-3")}>Amount</th>
                    <th className={cn("px-6 font-medium text-right", compactView ? "py-1.5" : "py-3")}>% of Total</th>
                    <th className={cn("px-6 font-medium text-right", compactView ? "py-1.5" : "py-3")}>Thereof Capital gains</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {accountTableData.rows.map(row => (
                    <tr 
                      key={row.id} 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className={cn("px-6 font-medium text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>
                        {row.name}
                      </td>
                      <td className={cn("px-6 text-right font-medium", compactView ? "py-1" : "py-4", row.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {formatAmount(row.amount, homeCurrency, numberFormat)}
                      </td>
                      <td className={cn("px-6 text-right text-slate-500 dark:text-slate-400", compactView ? "py-1" : "py-4")}>
                        {row.percentage.toFixed(1)}%
                      </td>
                      <td className={cn("px-6 text-right", compactView ? "py-1" : "py-4", row.capitalGains < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {formatAmount(row.capitalGains, homeCurrency, numberFormat)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 dark:bg-slate-950 font-semibold">
                    <td className={cn("px-6 text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>Total</td>
                    <td className={cn("px-6 text-right", compactView ? "py-1" : "py-4", accountTableData.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {formatAmount(accountTableData.total, homeCurrency, numberFormat)}
                    </td>
                    <td className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>
                      100.0%
                    </td>
                    <td className={cn("px-6 text-right", compactView ? "py-1" : "py-4", accountTableData.totalCapitalGains < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {formatAmount(accountTableData.totalCapitalGains, homeCurrency, numberFormat)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Account Distribution</h3>
              <div className="h-[400px] w-full min-w-0">
                <ResponsiveContainer width="99%" height={400}>
                  <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                    <Pie
                      data={accountDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value, percent, x, y, textAnchor }) => (
                        <text x={x} y={y} fill="#64748b" textAnchor={textAnchor} dominantBaseline="central" fontSize={12}>
                          <tspan x={x} dy="-0.5em">{name}</tspan>
                          <tspan x={x} dy="1.2em">{formatAmount(value, homeCurrency, numberFormat)} ({(percent * 100).toFixed(0)}%)</tspan>
                        </text>
                      )}
                      labelLine={true}
                      isAnimationActive={false}
                    >
                      {accountDistributionData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Asset Allocation</h3>
              <div className="h-[400px] w-full min-w-0">
                <ResponsiveContainer width="99%" height={400}>
                  <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                    <Pie
                      data={accountTypeDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value, percent, x, y, textAnchor }) => (
                        <text x={x} y={y} fill="#64748b" textAnchor={textAnchor} dominantBaseline="central" fontSize={12}>
                          <tspan x={x} dy="-0.5em">{name}</tspan>
                          <tspan x={x} dy="1.2em">{formatAmount(value, homeCurrency, numberFormat)} ({(percent * 100).toFixed(0)}%)</tspan>
                        </text>
                      )}
                      labelLine={true}
                      isAnimationActive={false}
                    >
                      {accountTypeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Category Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className={cn("px-6 font-medium", compactView ? "py-1.5" : "py-3")}>Category</th>
                  <th className={cn("px-6 font-medium text-right", compactView ? "py-1.5" : "py-3")}>Total</th>
                  {pivotData.years.map(year => (
                    <th key={year} className={cn("px-6 font-medium text-right", compactView ? "py-1.5" : "py-3")}>{year}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pivotData.data.map(([catId, catData]) => (
                  <React.Fragment key={catId}>
                    <tr 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => toggleCategory(catId)}
                    >
                      <td className={cn("px-6 font-medium text-slate-900 dark:text-slate-100 flex items-center", compactView ? "py-1" : "py-4")}>
                        {expandedCategories[catId] ? <ChevronDown className="w-4 h-4 mr-2 text-slate-400" /> : <ChevronRight className="w-4 h-4 mr-2 text-slate-400" />}
                        {catData.name}
                      </td>
                      <td 
                        className={cn("px-6 text-right font-medium text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}
                        style={{ backgroundColor: getBgColor(catData.total, pivotData.maxAbsValue) }}
                      >
                        {formatAmount(catData.total, homeCurrency, numberFormat)}
                      </td>
                      {pivotData.years.map(year => (
                        <td 
                          key={year} 
                          className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}
                          style={{ backgroundColor: getBgColor(catData.years[year].total, pivotData.maxAbsValue) }}
                        >
                          {formatAmount(catData.years[year].total, homeCurrency, numberFormat)}
                        </td>
                      ))}
                    </tr>
                    {expandedCategories[catId] && pivotData.years.map(year => (
                      pivotData.months.map(month => {
                        const amount = catData.years[year].months[month];
                        if (amount === 0) return null;
                        return (
                          <tr key={`${catId}-${year}-${month}`} className="bg-slate-50/50 dark:bg-slate-900/50">
                            <td className={cn("px-6 pl-12 text-slate-500 dark:text-slate-400 text-xs", compactView ? "py-0.5" : "py-2")}>
                              {format(new Date(year, month), 'MMMM yyyy')}
                            </td>
                            <td className={cn("px-6 text-right", compactView ? "py-0.5" : "py-2")}></td>
                            {pivotData.years.map(y => (
                              <td 
                                key={y} 
                                className={cn("px-6 text-right text-xs text-slate-900 dark:text-slate-100", compactView ? "py-0.5" : "py-2")}
                                style={y === year ? { backgroundColor: getBgColor(amount, pivotData.maxAbsValue) } : {}}
                              >
                                {y === year ? formatAmount(amount, homeCurrency, numberFormat) : '-'}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    ))}
                  </React.Fragment>
                ))}
                <tr className="bg-slate-50 dark:bg-slate-950 font-semibold">
                  <td className={cn("px-6 text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>Total</td>
                  <td 
                    className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}
                    style={{ backgroundColor: getBgColor(pivotData.grandTotal, pivotData.maxAbsValue) }}
                  >
                    {formatAmount(pivotData.grandTotal, homeCurrency, numberFormat)}
                  </td>
                  {pivotData.years.map(year => (
                    <td 
                      key={year} 
                      className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}
                      style={{ backgroundColor: getBgColor(pivotData.yearTotals[year], pivotData.maxAbsValue) }}
                    >
                      {formatAmount(pivotData.yearTotals[year], homeCurrency, numberFormat)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string, value: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{title}</h3>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
