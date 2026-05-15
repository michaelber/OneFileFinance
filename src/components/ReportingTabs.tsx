import React, { useMemo, useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Legend, PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from 'date-fns';
import * as Icons from 'lucide-react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { calculateCapitalGains, calculateAverages } from '../lib/reportingUtils';
import { db } from '../db';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

function TooltipIcon({ text }: { text: string }) {
  return (
    <div className="relative flex items-center group">
      <Icons.HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-500 cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-900 dark:bg-slate-800 text-slate-50 text-xs text-center rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl font-normal pointer-events-none before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-slate-900 dark:before:border-t-slate-800 leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function MetricCard({ title, value, tooltip }: { title: string, value: string, tooltip?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        {tooltip && <TooltipIcon text={tooltip} />}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

export function NetWorthTab({ transactions, metrics, formatRoundedAmount }: any) {
  const cumulativeData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    const monthlyTotals: Record<string, number> = {};
    let minDateStr = '9999-99-99';
    let maxDateStr = '0000-00-00';

    transactions.forEach((t: any) => {
      if (!t.date) return;
      const monthKey = t.date.substring(0, 7);
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + t.amount;
      if (t.date < minDateStr) minDateStr = t.date;
      if (t.date > maxDateStr) maxDateStr = t.date;
    });

    const todayStr = new Date().toISOString().substring(0, 10);
    if (todayStr > maxDateStr) maxDateStr = todayStr;

    const earliest = parseISO(minDateStr);
    const latest = parseISO(maxDateStr);
    
    const months = eachMonthOfInterval({ start: startOfMonth(earliest), end: endOfMonth(latest) });
    
    let runningTotal = 0;
    return months.map(month => {
      const monthKey = format(month, 'yyyy-MM');
      runningTotal += (monthlyTotals[monthKey] || 0);
      return {
        date: format(month, 'MMM yyyy'),
        amount: runningTotal
      };
    });
  }, [transactions]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Net Worth" value={formatRoundedAmount(metrics.netWorth)} />
        <MetricCard title="Net Worth YTD" value={formatRoundedAmount(metrics.netWorthYTD)} />
        <MetricCard title="Net Worth (12M)" value={formatRoundedAmount(metrics.netWorth12M)} />
        <MetricCard 
          title="Financial Freedom" 
          value={metrics.financialFreedomYears !== null ? `${metrics.financialFreedomYears.toFixed(1)} Years` : 'N/A'} 
          tooltip="Estimates how many years you could sustain your current lifestyle without any income. Calculated as: Total Net Worth / Yearly Expenses (based on the last 12 months)"
        />
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mt-8">
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Cumulative Net Worth</h3>
        <div className="h-[400px] w-full min-w-0">
          <ResponsiveContainer width="99%" height={400}>
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => formatRoundedAmount(val)} />
              <Tooltip 
                formatter={(value: number) => formatRoundedAmount(value)}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
              />
              <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

export function SavingsRateTab({ transactions, categories, metrics, formatRoundedAmount, compactView }: any) {
  const [expandedSavingsYears, setExpandedSavingsYears] = useState<Record<string, boolean>>({});

  const incomeExpenseData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    let validTxs = transactions;
    if (categories) {
      const todayStr = new Date().toISOString().split('T')[0];
      const futureExcludedCategoryIds = new Set(
        categories.filter((cat: any) => cat.icon === 'CapitalGains' || cat.icon === 'SeverancePay').map((cat: any) => cat.id)
      );
      const entirelyExcludedCategoryIds = new Set(
        categories.filter((cat: any) => cat.icon === 'OpeningBalance').map((cat: any) => cat.id)
      );
      
      validTxs = transactions.filter((t: any) => {
        if (t.category_id && entirelyExcludedCategoryIds.has(t.category_id)) {
          return false;
        }
        if (t.category_id && futureExcludedCategoryIds.has(t.category_id) && t.date > todayStr) {
          return false;
        }
        return true;
      });
    }

    const yearlyCategoryTotals: Record<number, Record<number, number>> = {};
    const monthlyCategoryTotals: Record<string, Record<number, number>> = {};

    validTxs.forEach((t: any) => {
      if (!t.date) return;
      const year = parseInt(t.date.substring(0, 4), 10);
      const monthKey = t.date.substring(0, 7);
      const catId = t.category_id || 0;
      
      if (!yearlyCategoryTotals[year]) yearlyCategoryTotals[year] = {};
      if (!monthlyCategoryTotals[monthKey]) monthlyCategoryTotals[monthKey] = {};

      yearlyCategoryTotals[year][catId] = (yearlyCategoryTotals[year][catId] || 0) + t.amount;
      monthlyCategoryTotals[monthKey][catId] = (monthlyCategoryTotals[monthKey][catId] || 0) + t.amount;
    });

    const yearlyTotals: Record<number, { income: number, expenses: number }> = {};
    const monthlyTotals: Record<string, { income: number, expenses: number }> = {};

    Object.entries(yearlyCategoryTotals).forEach(([yearStr, cats]) => {
      const year = parseInt(yearStr, 10);
      yearlyTotals[year] = { income: 0, expenses: 0 };
      Object.values(cats).forEach(amount => {
        if (amount > 0) yearlyTotals[year].income += amount;
        else if (amount < 0) yearlyTotals[year].expenses += amount;
      });
    });

    Object.entries(monthlyCategoryTotals).forEach(([monthKey, cats]) => {
      monthlyTotals[monthKey] = { income: 0, expenses: 0 };
      Object.values(cats).forEach(amount => {
        if (amount > 0) monthlyTotals[monthKey].income += amount;
        else if (amount < 0) monthlyTotals[monthKey].expenses += amount;
      });
    });

    const years = Object.keys(yearlyTotals).map(Number).sort((a, b) => b - a);
    const data: any[] = [];

    years.forEach(year => {
      const { income, expenses } = yearlyTotals[year];
      const savingsRate = income > 0 ? ((income + expenses) / income) * 100 : 0;
      
      data.push({
        date: year.toString(),
        isYear: true,
        year,
        income,
        expenses,
        savingsRate: Math.max(0, savingsRate)
      });
      
      if (expandedSavingsYears[year]) {
        for (let month = 0; month < 12; month++) {
          const monthStr = (month + 1).toString().padStart(2, '0');
          const monthKey = `${year}-${monthStr}`;
          const mData = monthlyTotals[monthKey];
          if (!mData) continue;
          
          const { income: mIncome, expenses: mExpenses } = mData;
          const mSavingsRate = mIncome > 0 ? ((mIncome + mExpenses) / mIncome) * 100 : 0;
          
          data.push({
            date: format(new Date(year, month), 'MMM yyyy'),
            isYear: false,
            year,
            income: mIncome,
            expenses: mExpenses,
            savingsRate: Math.max(0, mSavingsRate)
          });
        }
      }
    });
    
    return data;
  }, [transactions, expandedSavingsYears, categories]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Monthly Average" value={formatRoundedAmount(metrics.monthlyAverage)} />
        <MetricCard title="Yearly Average" value={formatRoundedAmount(metrics.yearlyAverage)} />
        <MetricCard 
          title="Savings Rate" 
          value={metrics.savingsRate !== null ? `${(metrics.savingsRate * 100).toFixed(1)}%` : 'N/A'} 
        />
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mt-8">
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
              <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickFormatter={(val) => formatRoundedAmount(val)} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickFormatter={(val) => `${val}%`} />
              <Tooltip 
                formatter={(value: number, name: string) => name === 'Savings Rate' ? `${value.toFixed(1)}%` : formatRoundedAmount(value)}
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

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Yearly Overview</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
              <tr>
                <th className={cn("px-6 font-medium", compactView ? "py-1.5" : "py-3")}>Metric</th>
                {incomeExpenseData.filter((d: any) => d.isYear).map((d: any) => (
                  <th key={d.year} className={cn("px-6 font-medium text-right", compactView ? "py-1.5" : "py-3")}>{d.year}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className={cn("px-6 font-medium text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>Income</td>
                {incomeExpenseData.filter((d: any) => d.isYear).map((d: any) => (
                  <td key={d.year} className={cn("px-6 text-right text-emerald-600 dark:text-emerald-400", compactView ? "py-1" : "py-4")}>
                    {formatRoundedAmount(d.income)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className={cn("px-6 font-medium text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>Expenses</td>
                {incomeExpenseData.filter((d: any) => d.isYear).map((d: any) => (
                  <td key={d.year} className={cn("px-6 text-right text-red-600 dark:text-red-400", compactView ? "py-1" : "py-4")}>
                    {formatRoundedAmount(d.expenses)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className={cn("px-6 font-medium text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>Delta</td>
                {incomeExpenseData.filter((d: any) => d.isYear).map((d: any) => {
                  const delta = d.income + d.expenses;
                  return (
                    <td key={d.year} className={cn("px-6 text-right font-medium", compactView ? "py-1" : "py-4", delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {formatRoundedAmount(delta)}
                    </td>
                  );
                })}
              </tr>
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-slate-50/50 dark:bg-slate-900/50">
                <td className={cn("px-6 font-medium text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>Savings Rate</td>
                {incomeExpenseData.filter((d: any) => d.isYear).map((d: any) => (
                  <td key={d.year} className={cn("px-6 text-right font-medium text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>
                    {d.savingsRate.toFixed(1)}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function AccountsTab({ transactions, accounts, accountTypes, categories, formatRoundedAmount, compactView }: any) {
  const accountDistributionData = useMemo(() => {
    if (!transactions || !accounts) return [];
    
    const balances = accounts
      .filter((acc: any) => !acc.is_archived)
      .map((acc: any) => {
      const balance = transactions
        .filter((t: any) => t.account_id === acc.id)
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      return { name: acc.name, value: Math.max(0, balance), rawBalance: balance };
    }).filter((a: any) => a.rawBalance !== 0 && a.value > 0);
    
    const total = balances.reduce((sum: number, a: any) => sum + a.value, 0);
    const threshold = total * 0.05;
    
    let otherValue = 0;
    const filteredBalances = balances.filter((a: any) => {
      if (a.value < threshold) {
        otherValue += a.value;
        return false;
      }
      return true;
    });
    
    if (otherValue > 0) {
      filteredBalances.push({ name: 'Other', value: otherValue, rawBalance: otherValue });
    }
    
    return filteredBalances.sort((a: any, b: any) => b.value - a.value);
  }, [transactions, accounts]);

  const accountTypeDistributionData = useMemo(() => {
    if (!transactions || !accounts || !accountTypes) return [];
    
    const balancesByType = accountTypes.map((type: any) => {
      const typeAccounts = accounts.filter((a: any) => a.account_type_id === type.id && !a.is_archived).map((a: any) => a.id);
      const balance = transactions
        .filter((t: any) => typeAccounts.includes(t.account_id))
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      return { name: type.name, value: Math.max(0, balance) };
    }).filter((t: any) => t.value > 0);
    
    const total = balancesByType.reduce((sum: number, t: any) => sum + t.value, 0);
    const threshold = total * 0.05;
    
    let otherValue = 0;
    const filteredBalances = balancesByType.filter((t: any) => {
      if (t.value < threshold) {
        otherValue += t.value;
        return false;
      }
      return true;
    });
    
    if (otherValue > 0) {
      filteredBalances.push({ name: 'Other', value: otherValue });
    }
    
    return filteredBalances.sort((a: any, b: any) => b.value - a.value);
  }, [transactions, accounts, accountTypes]);

  const accountTableData = useMemo(() => {
    if (!transactions || !accounts) return { rows: [], total: 0, totalCapitalGains: 0 };
    
    const rows = accounts
      .filter((acc: any) => !acc.is_archived)
      .map((acc: any) => {
      const accTxs = transactions.filter((t: any) => t.account_id === acc.id);
      const amount = accTxs.reduce((sum: number, t: any) => sum + t.amount, 0);
      const capitalGains = calculateCapitalGains(accTxs, categories || []);
      const accType = accountTypes?.find((at: any) => at.id === acc.account_type_id);
      return { id: acc.id, name: acc.name, icon: accType?.icon, amount, capitalGains };
    }).filter((row: any) => row.amount !== 0);
    
    const total = rows.reduce((sum: number, r: any) => sum + r.amount, 0);
    const totalCapitalGains = rows.reduce((sum: number, r: any) => sum + r.capitalGains, 0);
    
    const sortedRows = rows
      .map((r: any) => ({ ...r, percentage: total !== 0 ? (r.amount / total) * 100 : 0 }))
      .sort((a: any, b: any) => b.amount - a.amount);
      
    return { rows: sortedRows, total, totalCapitalGains };
  }, [transactions, accounts, accountTypes, categories]);

  return (
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
              {accountTableData.rows.map((row: any) => {
                const IconComponent = row.icon ? (Icons as any)[row.icon] : null;
                return (
                <tr 
                  key={row.id} 
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <td className={cn("px-6 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2", compactView ? "py-1" : "py-4")}>
                    {IconComponent && <IconComponent className="w-4 h-4 text-slate-500" />}
                    {row.name}
                  </td>
                  <td className={cn("px-6 text-right font-medium", compactView ? "py-1" : "py-4", row.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                    {formatRoundedAmount(row.amount)}
                  </td>
                  <td className={cn("px-6 text-right text-slate-500 dark:text-slate-400", compactView ? "py-1" : "py-4")}>
                    {row.percentage.toFixed(1)}%
                  </td>
                  <td className={cn("px-6 text-right", compactView ? "py-1" : "py-4", row.capitalGains < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                    {formatRoundedAmount(row.capitalGains)}
                  </td>
                </tr>
              )})}
              <tr className="bg-slate-50 dark:bg-slate-950 font-semibold">
                <td className={cn("px-6 text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>Total</td>
                <td className={cn("px-6 text-right", compactView ? "py-1" : "py-4", accountTableData.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {formatRoundedAmount(accountTableData.total)}
                </td>
                <td className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>
                  100.0%
                </td>
                <td className={cn("px-6 text-right", compactView ? "py-1" : "py-4", accountTableData.totalCapitalGains < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {formatRoundedAmount(accountTableData.totalCapitalGains)}
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
                      <tspan x={x} dy="1.2em">{formatRoundedAmount(value)} ({(percent * 100).toFixed(0)}%)</tspan>
                    </text>
                  )}
                  labelLine={true}
                  isAnimationActive={false}
                >
                  {accountDistributionData.map((entry: any, index: number) => (
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
                      <tspan x={x} dy="1.2em">{formatRoundedAmount(value)} ({(percent * 100).toFixed(0)}%)</tspan>
                    </text>
                  )}
                  labelLine={true}
                  isAnimationActive={false}
                >
                  {accountTypeDistributionData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CategoriesTab({ transactions, categories, accounts, formatRoundedAmount, compactView, onCellClick }: any) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});
  const [visibleYearsCount, setVisibleYearsCount] = useState<number | 'All'>(9);
  const [showAverages, setShowAverages] = useState(false);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const toggleYear = (year: number) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  const pivotData = useMemo(() => {
    if (!transactions || !categories) return null;

    const data: Record<string, any> = {};
    const yearsSet = new Set<number>();
    
    transactions.forEach((t: any) => {
      if (!t.date) return;
      const year = parseInt(t.date.substring(0, 4), 10);
      yearsSet.add(year);
    });
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    const months = Array.from({ length: 12 }, (_, i) => i);

    categories.forEach((cat: any) => {
      data[cat.id!] = { name: cat.name, total: 0, years: {}, accounts: {} };
      years.forEach(year => {
        data[cat.id!].years[year] = { total: 0, months: {} };
        months.forEach(month => {
          data[cat.id!].years[year].months[month] = 0;
        });
      });
    });

    data['uncategorized'] = { name: 'Uncategorized', total: 0, years: {}, accounts: {} };
    years.forEach(year => {
      data['uncategorized'].years[year] = { total: 0, months: {} };
      months.forEach(month => {
        data['uncategorized'].years[year].months[month] = 0;
      });
    });

    transactions.forEach((t: any) => {
      if (!t.date) return;
      const year = parseInt(t.date.substring(0, 4), 10);
      const month = parseInt(t.date.substring(5, 7), 10) - 1;
      const catId = t.category_id || 'uncategorized';
      const accId = t.account_id || 'unassigned';

      if (data[catId]) {
        data[catId].total += t.amount;
        data[catId].years[year].total += t.amount;
        data[catId].years[year].months[month] += t.amount;

        if (!data[catId].accounts[accId]) {
          data[catId].accounts[accId] = { total: 0, years: {} };
          years.forEach(y => {
            data[catId].accounts[accId].years[y] = { total: 0, months: {} };
            months.forEach(m => {
              data[catId].accounts[accId].years[y].months[m] = 0;
            });
          });
        }
        
        data[catId].accounts[accId].total += t.amount;
        data[catId].accounts[accId].years[year].total += t.amount;
        data[catId].accounts[accId].years[year].months[month] += t.amount;
      }
    });

    const filteredData = Object.entries(data)
      .filter(([_, catData]) => catData.total !== 0)
      .sort((a: any, b: any) => b[1].total - a[1].total);

    const grandTotal = filteredData.reduce((sum, [_, catData]) => sum + catData.total, 0);
    const yearTotals: Record<number, number> = {};
    const yearMonthTotals: Record<number, Record<number, number>> = {};
    
    years.forEach(year => {
      yearTotals[year] = filteredData.reduce((sum, [_, catData]) => sum + catData.years[year].total, 0);
      yearMonthTotals[year] = {};
      months.forEach(month => {
        yearMonthTotals[year][month] = filteredData.reduce((sum, [_, catData]) => sum + catData.years[year].months[month], 0);
      });
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

    return { years, months, data: filteredData, grandTotal, yearTotals, yearMonthTotals, maxAbsValue };
  }, [transactions, categories]);

  const displayedYears = useMemo(() => {
    if (!pivotData) return [];
    if (visibleYearsCount === 'All') return pivotData.years;
    return pivotData.years.slice(0, visibleYearsCount);
  }, [pivotData, visibleYearsCount]);

  const getBgColor = (amount: number, maxAbs: number) => {
    if (amount === 0) return 'transparent';
    const opacity = maxAbs > 0 ? Math.max(0.05, Math.min(0.6, Math.abs(amount) / maxAbs)) : 0;
    return amount > 0 ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`;
  };

  if (!pivotData) return <div className="p-8">Loading...</div>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Category Breakdown</h3>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={showAverages} onChange={(e) => setShowAverages(e.target.checked)} />
              <div className={cn("block w-10 h-6 rounded-full transition-colors", showAverages ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700', "group-hover:opacity-90")}></div>
              <div className={cn("absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform", showAverages ? 'transform translate-x-4' : '')}></div>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Show averages</span>
          </label>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 dark:text-slate-400">Years to show: {visibleYearsCount}</label>
            <input 
              type="range" 
              min="1" 
              max={pivotData.years.length} 
              value={visibleYearsCount === 'All' ? pivotData.years.length : visibleYearsCount}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val === pivotData.years.length) setVisibleYearsCount('All');
                else setVisibleYearsCount(val);
              }}
              className="w-32"
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
            <tr>
              <th className={cn("px-6 font-medium", compactView ? "py-1.5" : "py-3")}>Category</th>
              <th className={cn("px-6 font-medium text-right", compactView ? "py-1.5" : "py-3")}>Total</th>
              {showAverages && (
                <>
                  <th className={cn("px-6 font-medium text-right border-l-2 border-slate-300 dark:border-slate-700", compactView ? "py-1.5" : "py-3")}>Monthly Avg</th>
                  <th className={cn("px-6 font-medium text-right border-r-2 border-slate-300 dark:border-slate-700", compactView ? "py-1.5" : "py-3")}>Yearly Avg</th>
                </>
              )}
              {displayedYears.map(year => (
                <React.Fragment key={year}>
                  <th 
                    className={cn("px-6 font-medium text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors", compactView ? "py-1.5" : "py-3")}
                    onClick={() => toggleYear(year)}
                  >
                    {year} {expandedYears[year] ? <ChevronDown className="w-3 h-3 inline-block" /> : <ChevronRight className="w-3 h-3 inline-block" />}
                  </th>
                  {expandedYears[year] && pivotData.months.map(month => (
                    <th key={`${year}-${month}`} className={cn("px-4 font-medium text-right text-xs text-slate-400", compactView ? "py-1.5" : "py-3")}>
                      {format(new Date(year, month), 'MMM')}
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {pivotData.data.map(([catId, catData]) => (
              <React.Fragment key={catId}>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td 
                    className={cn("px-6 font-medium text-slate-900 dark:text-slate-100 flex items-center cursor-pointer", compactView ? "py-1" : "py-4")}
                    onClick={() => toggleCategory(catId)}
                  >
                    {expandedCategories[catId] ? <ChevronDown className="w-4 h-4 mr-2 text-slate-400" /> : <ChevronRight className="w-4 h-4 mr-2 text-slate-400" />}
                    {catData.name}
                  </td>
                  <td 
                    className={cn("px-6 text-right font-medium text-slate-900 dark:text-slate-100 cursor-pointer hover:opacity-80", compactView ? "py-1" : "py-4")}
                    style={{ backgroundColor: getBgColor(catData.total, pivotData.maxAbsValue) }}
                    onClick={() => onCellClick?.(catId === 'uncategorized' ? undefined : (catId as string))}
                  >
                    {formatRoundedAmount(catData.total, true)}
                  </td>
                  {showAverages && (() => {
                    const { monthlyAverage, yearlyAverage } = calculateAverages(displayedYears.map(y => ({ year: y, total: catData.years[y].total })));
                    return (
                      <>
                        <td className={cn("px-6 text-right font-medium text-slate-900 dark:text-slate-100 border-l-2 border-slate-300 dark:border-slate-700", compactView ? "py-1" : "py-4")} style={{ backgroundColor: getBgColor(monthlyAverage, pivotData.maxAbsValue/12) }}>
                          {formatRoundedAmount(monthlyAverage, true)}
                        </td>
                        <td className={cn("px-6 text-right font-medium text-slate-900 dark:text-slate-100 border-r-2 border-slate-300 dark:border-slate-700", compactView ? "py-1" : "py-4")} style={{ backgroundColor: getBgColor(yearlyAverage, pivotData.maxAbsValue) }}>
                          {formatRoundedAmount(yearlyAverage, true)}
                        </td>
                      </>
                    );
                  })()}
                  {displayedYears.map(year => (
                    <React.Fragment key={year}>
                      <td 
                        className={cn("px-6 text-right text-slate-900 dark:text-slate-100 cursor-pointer hover:opacity-80", compactView ? "py-1" : "py-4")}
                        style={{ backgroundColor: getBgColor(catData.years[year].total, pivotData.maxAbsValue) }}
                        onClick={() => onCellClick?.(catId === 'uncategorized' ? undefined : (catId as string), year)}
                      >
                        {formatRoundedAmount(catData.years[year].total, true)}
                      </td>
                      {expandedYears[year] && pivotData.months.map(month => (
                        <td 
                          key={`${year}-${month}`}
                          className={cn("px-4 text-right text-xs text-slate-900 dark:text-slate-100 cursor-pointer hover:opacity-80", compactView ? "py-1" : "py-4")}
                          style={{ backgroundColor: getBgColor(catData.years[year].months[month], pivotData.maxAbsValue) }}
                          onClick={() => onCellClick?.(catId === 'uncategorized' ? undefined : (catId as string), year, month)}
                        >
                          {formatRoundedAmount(catData.years[year].months[month], true)}
                        </td>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
                {expandedCategories[catId] && Object.entries(catData.accounts).map(([accountId, accData]: any) => (
                  <tr key={`${catId}-${accountId}`} className="bg-slate-50/30 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className={cn("px-6 pl-12 text-slate-500 dark:text-slate-400 text-sm", compactView ? "py-0.5" : "py-2")}>
                      {accountId === 'unassigned' ? 'Unassigned' : accounts?.find((a: any) => a.id.toString() === accountId)?.name || accountId}
                    </td>
                    <td 
                      className={cn("px-6 text-right font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:opacity-80", compactView ? "py-0.5" : "py-2")}
                      style={{ backgroundColor: getBgColor(accData.total, pivotData.maxAbsValue) }}
                      onClick={() => onCellClick?.(catId === 'uncategorized' ? undefined : (catId as string), undefined, undefined, accountId)}
                    >
                      {formatRoundedAmount(accData.total, true)}
                    </td>
                    {showAverages && (() => {
                      const { monthlyAverage, yearlyAverage } = calculateAverages(displayedYears.map(y => ({ year: y, total: accData.years[y].total })));
                      return (
                        <>
                          <td className={cn("px-6 text-right text-slate-700 dark:text-slate-300 border-l-2 border-slate-300 dark:border-slate-700", compactView ? "py-0.5" : "py-2")} style={{ backgroundColor: getBgColor(monthlyAverage, pivotData.maxAbsValue/12) }}>
                            {formatRoundedAmount(monthlyAverage, true)}
                          </td>
                          <td className={cn("px-6 text-right text-slate-700 dark:text-slate-300 border-r-2 border-slate-300 dark:border-slate-700", compactView ? "py-0.5" : "py-2")} style={{ backgroundColor: getBgColor(yearlyAverage, pivotData.maxAbsValue) }}>
                            {formatRoundedAmount(yearlyAverage, true)}
                          </td>
                        </>
                      );
                    })()}
                    {displayedYears.map(year => (
                      <React.Fragment key={year}>
                        <td 
                          className={cn("px-6 text-right text-slate-700 dark:text-slate-300 cursor-pointer hover:opacity-80", compactView ? "py-0.5" : "py-2")}
                          style={{ backgroundColor: getBgColor(accData.years[year].total, pivotData.maxAbsValue) }}
                          onClick={() => onCellClick?.(catId === 'uncategorized' ? undefined : (catId as string), year, undefined, accountId)}
                        >
                          {formatRoundedAmount(accData.years[year].total, true)}
                        </td>
                        {expandedYears[year] && pivotData.months.map(month => (
                          <td 
                            key={`${year}-${month}`}
                            className={cn("px-4 text-right text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:opacity-80", compactView ? "py-0.5" : "py-2")}
                            style={{ backgroundColor: getBgColor(accData.years[year].months[month], pivotData.maxAbsValue) }}
                            onClick={() => onCellClick?.(catId === 'uncategorized' ? undefined : (catId as string), year, month, accountId)}
                          >
                            {formatRoundedAmount(accData.years[year].months[month], true)}
                          </td>
                        ))}
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr className="bg-slate-50 dark:bg-slate-950 font-semibold">
              <td className={cn("px-6 text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>Total</td>
              <td 
                className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}
                style={{ backgroundColor: getBgColor(pivotData.grandTotal, pivotData.maxAbsValue) }}
              >
                {formatRoundedAmount(pivotData.grandTotal, true)}
              </td>
              {showAverages && (() => {
                const { monthlyAverage, yearlyAverage } = calculateAverages(displayedYears.map(y => ({ year: y, total: pivotData.yearTotals[y] })));
                return (
                  <>
                    <td className={cn("px-6 text-right text-slate-900 dark:text-slate-100 border-l-2 border-slate-300 dark:border-slate-700", compactView ? "py-1" : "py-4")} style={{ backgroundColor: getBgColor(monthlyAverage, pivotData.maxAbsValue/12) }}>
                      {formatRoundedAmount(monthlyAverage, true)}
                    </td>
                    <td className={cn("px-6 text-right text-slate-900 dark:text-slate-100 border-r-2 border-slate-300 dark:border-slate-700", compactView ? "py-1" : "py-4")} style={{ backgroundColor: getBgColor(yearlyAverage, pivotData.maxAbsValue) }}>
                      {formatRoundedAmount(yearlyAverage, true)}
                    </td>
                  </>
                );
              })()}
              {displayedYears.map(year => (
                <React.Fragment key={year}>
                  <td 
                    className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}
                    style={{ backgroundColor: getBgColor(pivotData.yearTotals[year], pivotData.maxAbsValue) }}
                  >
                    {formatRoundedAmount(pivotData.yearTotals[year], true)}
                  </td>
                  {expandedYears[year] && pivotData.months.map(month => (
                    <td 
                      key={`total-${year}-${month}`}
                      className={cn("px-4 text-right text-xs text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}
                      style={{ backgroundColor: getBgColor(pivotData.yearMonthTotals[year][month], pivotData.maxAbsValue) }}
                    >
                      {formatRoundedAmount(pivotData.yearMonthTotals[year][month], true)}
                    </td>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CategoryDetailsTab({ transactions, categories, accounts, formatRoundedAmount, formatExactAmount, compactView, initialFilters }: any) {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialFilters?.categoryId || 'all');
  const [selectedAccount, setSelectedAccount] = useState<string>(initialFilters?.accountId || 'all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.categoryId) setSelectedCategory(initialFilters.categoryId);
      else setSelectedCategory('all');

      if (initialFilters.accountId) setSelectedAccount(initialFilters.accountId.toString());
      else setSelectedAccount('all');

      if (initialFilters.year) {
        if (initialFilters.month !== undefined) {
          const monthStr = (initialFilters.month + 1).toString().padStart(2, '0');
          // Standardize start date to the first date and end date to the maximum logical bounds
          const ymStart = `${initialFilters.year}-${monthStr}-01`;
          
          // Earning last day logically (leap year support handled properly by date manipulation)
          const lastDay = new Date(initialFilters.year, initialFilters.month + 1, 0).getDate();
          const ymEnd = `${initialFilters.year}-${monthStr}-${lastDay.toString().padStart(2, '0')}`;
          
          setStartDate(ymStart);
          setEndDate(ymEnd);
        } else {
          setStartDate(`${initialFilters.year}-01-01`);
          setEndDate(`${initialFilters.year}-12-31`);
        }
      } else {
        setStartDate('');
        setEndDate('');
      }
    }
  }, [initialFilters]);

  const groupedData = useMemo(() => {
    if (!transactions) return [];

    let txs = transactions;
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'uncategorized') {
        txs = txs.filter((t: any) => !t.category_id);
      } else {
        const catIdNum = Number(selectedCategory);
        txs = txs.filter((t: any) => t.category_id === catIdNum);
      }
    }
    
    if (selectedAccount !== 'all') {
      if (selectedAccount === 'unassigned') {
        txs = txs.filter((t: any) => !t.account_id);
      } else {
        const accIdNum = Number(selectedAccount);
        txs = txs.filter((t: any) => t.account_id === accIdNum);
      }
    }

    if (startDate) {
      txs = txs.filter((t: any) => {
        if (!t.date) return false;
        // Compare full date string up to yyyy-mm-dd
        const txDate = t.date.substring(0, 10);
        return txDate >= startDate;
      });
    }

    if (endDate) {
      txs = txs.filter((t: any) => {
        if (!t.date) return false;
        const txDate = t.date.substring(0, 10);
        return txDate <= endDate;
      });
    }
    
    const groups: Record<string, { keyword: string, total: number, transactions: any[] }> = {};
    
    txs.forEach((t: any) => {
      const desc = t.description || '';
      // Find first word, handle special characters gracefully.
      const firstWordRaw = desc.trim().split(/[\s-]+/)[0] || 'Unknown';
      // remove any non-alphanumeric trailing/leading chars for clean grouping if desired, but lowercasing is enough usually
      const keywordLower = firstWordRaw.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
      const groupKey = keywordLower || 'unknown';

      if (!groups[groupKey]) {
        groups[groupKey] = { 
          keyword: firstWordRaw.charAt(0).toUpperCase() + firstWordRaw.slice(1).toLowerCase(), 
          total: 0, 
          transactions: [] 
        };
      }
      groups[groupKey].total += t.amount;
      groups[groupKey].transactions.push(t);
    });

    Object.values(groups).forEach(g => {
      g.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });
    
    return Object.values(groups).sort((a, b) => {
      if (b.transactions.length !== a.transactions.length) {
        return b.transactions.length - a.transactions.length;
      }
      return (b.transactions[0]?.date || '').localeCompare(a.transactions[0]?.date || '');
    });
  }, [transactions, selectedCategory, selectedAccount, startDate, endDate]);

  const toggleGroup = (keyword: string) => {
    setExpandedGroups(prev => ({ ...prev, [keyword]: !prev[keyword] }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6">
      <div className="flex flex-col gap-6 mb-8">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Category Details</h3>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category Filter</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Categories</option>
              <option value="uncategorized">Uncategorized</option>
              {categories?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Account Filter</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Accounts</option>
              <option value="unassigned">Unassigned</option>
              {accounts?.filter((a: any) => !a.is_archived).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-[2] space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date Range Filter</label>
            <div className="flex flex-wrap items-center gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-slate-500">to</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {(startDate || endDate) && (
                <button
                  className="px-3 h-10 rounded-lg text-sm font-medium transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  Clear Range
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
            <tr>
              <th className={cn("px-6 font-medium", compactView ? "py-2" : "py-3")}>Description Group</th>
              <th className={cn("px-6 font-medium text-right", compactView ? "py-2" : "py-3")}>Total Amount</th>
              <th className={cn("px-6 font-medium text-left", compactView ? "py-2" : "py-3")}>Category</th>
              <th className={cn("px-6 font-medium text-left", compactView ? "py-2" : "py-3")}>Account</th>
              <th className={cn("px-6 font-medium text-right", compactView ? "py-2" : "py-3")}>Transactions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {groupedData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                  No transactions found for the selected filters.
                </td>
              </tr>
            ) : (
              groupedData.map(group => group.transactions.length === 1 ? (
                <tr key={group.transactions[0].id || group.keyword} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className={cn("px-6 font-medium text-slate-700 dark:text-slate-300 flex items-center", compactView ? "py-2" : "py-4")}>
                    <span className="text-slate-400 dark:text-slate-500 mr-3 text-xs font-normal">{group.transactions[0].date}</span>
                    {group.transactions[0].description}
                  </td>
                  <td className={cn("px-6 text-right font-medium", compactView ? "py-2" : "py-4", group.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                    {formatExactAmount(group.total)}
                  </td>
                  <td className={cn("px-6 text-slate-500 dark:text-slate-400 text-sm", compactView ? "py-2" : "py-4")}>
                    {categories?.find((c: any) => c.id === group.transactions[0].category_id)?.name || 'Uncategorized'}
                  </td>
                  <td className={cn("px-6 text-slate-500 dark:text-slate-400 text-sm", compactView ? "py-2" : "py-4")}>
                    {accounts?.find((a: any) => a.id === group.transactions[0].account_id)?.name || 'Unassigned'}
                  </td>
                  <td className={cn("px-6 text-right text-slate-400 dark:text-slate-500", compactView ? "py-2" : "py-4")}>
                    1
                  </td>
                </tr>
              ) : (
                <React.Fragment key={group.keyword}>
                  <tr 
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => toggleGroup(group.keyword)}
                  >
                    <td className={cn("px-6 font-medium text-slate-900 dark:text-slate-100 flex items-center", compactView ? "py-2" : "py-4")}>
                      {expandedGroups[group.keyword] ? <ChevronDown className="w-4 h-4 mr-2 text-slate-400" /> : <ChevronRight className="w-4 h-4 mr-2 text-slate-400" />}
                      {group.keyword}
                    </td>
                    <td className={cn("px-6 text-right font-medium", compactView ? "py-2" : "py-4", group.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {formatExactAmount(group.total)}
                    </td>
                    <td className={cn("px-6", compactView ? "py-2" : "py-4")}></td>
                    <td className={cn("px-6", compactView ? "py-2" : "py-4")}></td>
                    <td className={cn("px-6 text-right text-slate-500 dark:text-slate-400", compactView ? "py-2" : "py-4")}>
                      {group.transactions.length}
                    </td>
                  </tr>
                  {expandedGroups[group.keyword] && group.transactions.map((t: any) => (
                    <tr key={t.id} className="bg-slate-50/50 dark:bg-slate-900/30">
                      <td className={cn("px-6 pl-12 text-slate-600 dark:text-slate-300", compactView ? "py-1.5" : "py-2")}>
                        <span className="text-slate-400 dark:text-slate-500 mr-3 text-xs">{t.date}</span>
                        {t.description}
                      </td>
                      <td className={cn("px-6 text-right", compactView ? "py-1.5" : "py-2", t.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {formatExactAmount(t.amount)}
                      </td>
                      <td className={cn("px-6 text-slate-500 dark:text-slate-400 text-sm", compactView ? "py-1.5" : "py-2")}>
                        {categories?.find((c: any) => c.id === t.category_id)?.name || 'Uncategorized'}
                      </td>
                      <td className={cn("px-6 text-slate-500 dark:text-slate-400 text-sm", compactView ? "py-1.5" : "py-2")}>
                        {accounts?.find((a: any) => a.id === t.account_id)?.name || 'Unassigned'}
                      </td>
                      <td className={cn("px-6", compactView ? "py-1.5" : "py-2")}></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
          {groupedData.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-950 font-semibold border-t border-slate-200 dark:border-slate-800">
              <tr>
                <td className={cn("px-6 text-slate-900 dark:text-slate-100", compactView ? "py-2" : "py-4")}>Total</td>
                <td className={cn("px-6 text-right", compactView ? "py-2" : "py-4")}>
                  {formatExactAmount(groupedData.reduce((sum: number, g: any) => sum + g.total, 0))}
                </td>
                <td colSpan={2} className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-2" : "py-4")}></td>
                <td className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-2" : "py-4")}>
                  {groupedData.reduce((sum, g) => sum + g.transactions.length, 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function ForecastTab({ transactions, categories, accounts, accountTypes, metrics, formatRoundedAmount, settings, compactView }: any) {
  const getSetting = (key: string, defaultValue: any) => {
    if (!settings) return defaultValue;
    const s = settings.find((s: any) => s.key === key);
    return s !== undefined ? s.value : defaultValue;
  };

  const [horizonYears, setHorizonYears] = useState(getSetting('forecast_horizonYears', 5));
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [samplingPeriodMonths, setSamplingPeriodMonths] = useState(getSetting('forecast_samplingPeriodMonths', 12));

  const [salaryGrowth, setSalaryGrowth] = useState(getSetting('forecast_salaryGrowth', 2));
  const [inflation, setInflation] = useState(getSetting('forecast_inflation', 2));
  const [realEstateGrowth, setRealEstateGrowth] = useState(getSetting('forecast_realEstateGrowth', 3));
  const [investmentReturn, setInvestmentReturn] = useState(getSetting('forecast_investmentReturn', 5));

  const [incomeJumpEnabled, setIncomeJumpEnabled] = useState(getSetting('forecast_incomeJumpEnabled', false));
  const [incomeJumpPercent, setIncomeJumpPercent] = useState(getSetting('forecast_incomeJumpPercent', 0));
  const [incomeJumpMonthOffset, setIncomeJumpMonthOffset] = useState(getSetting('forecast_incomeJumpMonthOffset', 12));

  const [expenseJumpEnabled, setExpenseJumpEnabled] = useState(getSetting('forecast_expenseJumpEnabled', false));
  const [expenseJumpPercent, setExpenseJumpPercent] = useState(getSetting('forecast_expenseJumpPercent', 0));
  const [expenseJumpMonthOffset, setExpenseJumpMonthOffset] = useState(getSetting('forecast_expenseJumpMonthOffset', 12));

  useEffect(() => {
    const updateSetting = async (key: string, value: any) => {
      await db.settings.put({ key, value, updated_at: Date.now() });
    };
    updateSetting('forecast_horizonYears', horizonYears);
    updateSetting('forecast_samplingPeriodMonths', samplingPeriodMonths);
    updateSetting('forecast_salaryGrowth', salaryGrowth);
    updateSetting('forecast_inflation', inflation);
    updateSetting('forecast_realEstateGrowth', realEstateGrowth);
    updateSetting('forecast_investmentReturn', investmentReturn);
    updateSetting('forecast_incomeJumpEnabled', incomeJumpEnabled);
    updateSetting('forecast_incomeJumpPercent', incomeJumpPercent);
    updateSetting('forecast_incomeJumpMonthOffset', incomeJumpMonthOffset);
    updateSetting('forecast_expenseJumpEnabled', expenseJumpEnabled);
    updateSetting('forecast_expenseJumpPercent', expenseJumpPercent);
    updateSetting('forecast_expenseJumpMonthOffset', expenseJumpMonthOffset);
  }, [horizonYears, samplingPeriodMonths, salaryGrowth, inflation, realEstateGrowth, investmentReturn, incomeJumpEnabled, incomeJumpPercent, incomeJumpMonthOffset, expenseJumpEnabled, expenseJumpPercent, expenseJumpMonthOffset]);

  const toggleYear = (index: string) => {
    setExpandedYears(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const forecastData = useMemo(() => {
    if (!transactions || transactions.length === 0) return null;
    
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const currentMonthStr = format(today, 'yyyy-MM');
    
    const excludedFromForecastCatIds = new Set(categories?.filter((c:any) => ['OpeningBalance', 'SeverancePay', 'CapitalGains'].includes(c.icon)).map((c:any) => c.id) || []);

    const monthlyIncome: Record<string, number> = {};
    const monthlyExpenses: Record<string, number> = {};
    const initialBalances: Record<number, number> = {};
    const monthlyCategoryTotals: Record<string, Record<string, number>> = {};

    transactions.forEach((t:any) => {
      initialBalances[t.account_id] = (initialBalances[t.account_id] || 0) + (t.amount || 0);

      if (t.date > todayStr) return; // exclude future
      if (excludedFromForecastCatIds.has(t.category_id)) return;
      
      const monthKey = t.date.substring(0, 7);
      const catId = t.category_id || 'unassigned';
      
      if (!monthlyCategoryTotals[monthKey]) monthlyCategoryTotals[monthKey] = {};
      monthlyCategoryTotals[monthKey][catId] = (monthlyCategoryTotals[monthKey][catId] || 0) + t.amount;
    });

    Object.entries(monthlyCategoryTotals).forEach(([monthKey, cats]) => {
      Object.values(cats).forEach(amount => {
        if (amount > 0) {
          monthlyIncome[monthKey] = (monthlyIncome[monthKey] || 0) + amount;
        } else if (amount < 0) {
          monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + Math.abs(amount);
        }
      });
    });

    let initialRealEstate = 0;
    let initialInvestments = 0;
    let initialCashAndOther = 0;
    
    accounts?.forEach((acc:any) => {
      const bal = initialBalances[acc.id] || 0;
      const type = accountTypes?.find((t: any) => t.id === acc.account_type_id);
      const icon = type?.icon;
      
      if (icon === 'Home') {
        initialRealEstate += bal;
      } else if (icon === 'TrendingUp' || icon === 'ArrowUpRight') {
        initialInvestments += bal;
      } else {
        initialCashAndOther += bal;
      }
    });

    const startOfData = Array.from(new Set([...Object.keys(monthlyIncome), ...Object.keys(monthlyExpenses)])).sort()[0] || currentMonthStr;
    const monthsToConsider = [];
    for (let i = 0; i < samplingPeriodMonths; i++) {
        const k = format(subMonths(today, i), 'yyyy-MM');
        if (k >= startOfData) {
            monthsToConsider.push(k);
        }
    }
    const divisor = Math.max(1, monthsToConsider.length);
    let totalSampledIncome = 0;
    let totalSampledExpenses = 0;
    monthsToConsider.forEach(k => {
        totalSampledIncome += (monthlyIncome[k] || 0);
        totalSampledExpenses += (monthlyExpenses[k] || 0);
    });
    
    const avgMonthlyIncome = totalSampledIncome / divisor;
    const avgMonthlyExpenses = totalSampledExpenses / divisor;
    const avgMonthlySavings = avgMonthlyIncome - avgMonthlyExpenses;

    let targetDate = today;
    const totalMonthsCount = horizonYears * 12;
    
    let yearlyData: Record<string, any> = {};
    
    let currentIncomeBase = avgMonthlyIncome;
    let currentExpensesBase = avgMonthlyExpenses;
    
    let realEstateBalance = initialRealEstate;
    let investmentBalance = initialInvestments;
    let cashBalance = initialCashAndOther;
    
    let actualAverageIncome = 0;
    let actualAverageExpenses = 0;
    let actualAverageSavings = 0;
    let totalMonthsSimulated = 0;

    for (let i = 1; i <= totalMonthsCount; i++) {
        targetDate = addMonths(today, i);
        const yearStr = format(targetDate, 'yyyy');
        
        if (!yearlyData[yearStr]) {
            yearlyData[yearStr] = {
                year: yearStr,
                yearLabel: yearStr,
                totalIncome: 0,
                totalExpenses: 0,
                totalSavings: 0,
                totalInvestmentReturn: 0,
                totalRealEstateReturn: 0,
                endNetWorth: 0,
                months: []
            };
        }
        
        let activeIncomeMonth = currentIncomeBase;
        if (incomeJumpEnabled && i >= incomeJumpMonthOffset) {
           activeIncomeMonth = currentIncomeBase * (1 + (incomeJumpPercent / 100));
        }

        let activeExpenseMonth = currentExpensesBase;
        if (expenseJumpEnabled && i >= expenseJumpMonthOffset) {
           activeExpenseMonth = currentExpensesBase * (1 + (expenseJumpPercent / 100));
        }

        const monthlySavings = activeIncomeMonth - activeExpenseMonth;

        cashBalance += monthlySavings;

        // Draw down from investments if cash falls below 0
        if (cashBalance < 0 && investmentBalance > 0) {
            const drawAmount = Math.min(Math.abs(cashBalance), investmentBalance);
            investmentBalance -= drawAmount;
            cashBalance += drawAmount;
        }

        // Apply growth for the balances
        const reMonthlyGrowth = (realEstateGrowth / 100) / 12;
        const invMonthlyGrowth = (investmentReturn / 100) / 12;

        const reMonthlyReturn = realEstateBalance * reMonthlyGrowth;
        const invMonthlyReturn = investmentBalance * invMonthlyGrowth;

        realEstateBalance += reMonthlyReturn;
        investmentBalance += invMonthlyReturn;

        let currentNW = realEstateBalance + investmentBalance + cashBalance;

        yearlyData[yearStr].totalIncome += activeIncomeMonth;
        yearlyData[yearStr].totalExpenses += activeExpenseMonth;
        yearlyData[yearStr].totalSavings += monthlySavings;
        yearlyData[yearStr].totalInvestmentReturn += invMonthlyReturn;
        yearlyData[yearStr].totalRealEstateReturn += reMonthlyReturn;
        yearlyData[yearStr].endNetWorth = currentNW;
        
        actualAverageIncome += activeIncomeMonth;
        actualAverageExpenses += activeExpenseMonth;
        actualAverageSavings += monthlySavings;
        totalMonthsSimulated++;
        
        yearlyData[yearStr].months.push({
           monthName: format(targetDate, 'MMM yyyy'),
           income: activeIncomeMonth,
           expenses: activeExpenseMonth,
           savings: monthlySavings,
           investmentReturn: invMonthlyReturn,
           realEstateReturn: reMonthlyReturn,
           endNetWorth: currentNW,
        });

        // Apply macro drivers for the NEXT month's numbers
        currentIncomeBase *= (1 + ((salaryGrowth / 100) / 12));
        currentExpensesBase *= (1 + ((inflation / 100) / 12));
    }
     const yearlyTableData = Object.values(yearlyData).sort((a: any, b: any) => a.year.localeCompare(b.year));
    
    const hasInvestmentReturns = yearlyTableData.some((r: any) => Math.abs(r.totalInvestmentReturn) > 0.01);
    const hasRealEstateReturns = yearlyTableData.some((r: any) => Math.abs(r.totalRealEstateReturn) > 0.01);

    return { 
       yearlyTableData,
       hasInvestmentReturns,
       hasRealEstateReturns,
       avgMonthlyIncome: totalMonthsSimulated > 0 ? actualAverageIncome / totalMonthsSimulated : 0, 
       avgMonthlyExpenses: totalMonthsSimulated > 0 ? actualAverageExpenses / totalMonthsSimulated : 0, 
       avgMonthlySavings: totalMonthsSimulated > 0 ? actualAverageSavings / totalMonthsSimulated : 0
    };
  }, [transactions, categories, metrics, horizonYears, samplingPeriodMonths, salaryGrowth, inflation, realEstateGrowth, investmentReturn, incomeJumpEnabled, incomeJumpPercent, incomeJumpMonthOffset, expenseJumpEnabled, expenseJumpPercent, expenseJumpMonthOffset, accounts]);

  if (!forecastData) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 rounded-t-xl">
             <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Scenario Drivers</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Horizon (Years)
              <TooltipIcon text="The number of years to forecast into the future." />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">1</span>
              <input 
                type="range" 
                min="1" max="30" step="1" 
                value={horizonYears} 
                onChange={(e) => setHorizonYears(parseInt(e.target.value))}
                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-semibold w-6 text-right">{horizonYears}</span>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Sampling (Months)
              <TooltipIcon text="Determines how many previous months are averaged to calculate the base monthly income and expenses for the forecast." />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">1</span>
              <input 
                type="range" 
                min="1" max="60" step="1" 
                value={samplingPeriodMonths} 
                onChange={(e) => setSamplingPeriodMonths(parseInt(e.target.value))}
                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-semibold w-6 text-right">{samplingPeriodMonths}</span>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Salary Growth (%/yr)
            </label>
            <input type="number" step="0.1" value={salaryGrowth} onChange={(e) => setSalaryGrowth(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Inflation/Expenses (%/yr)
            </label>
            <input type="number" step="0.1" value={inflation} onChange={(e) => setInflation(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Real Estate Return (%/yr)
            </label>
            <input type="number" step="0.1" value={realEstateGrowth} onChange={(e) => setRealEstateGrowth(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Investments Return (%/yr)
            </label>
            <input type="number" step="0.1" value={investmentReturn} onChange={(e) => setInvestmentReturn(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input type="checkbox" checked={incomeJumpEnabled} onChange={(e) => setIncomeJumpEnabled(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700" />
            <span className="font-medium text-sm text-slate-900 dark:text-slate-100">Simulate Income Jump</span>
          </label>
          
          {incomeJumpEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pl-6 border-l-2 border-blue-500 dark:border-blue-500/50 ml-1 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Income Jump Percentage (%)</label>
                <div className="flex items-center gap-2">
                  <input type="range" min="-100" max="300" step="5" value={incomeJumpPercent} onChange={(e) => setIncomeJumpPercent(parseInt(e.target.value))} className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  <span className="text-sm font-semibold w-12 text-right">{incomeJumpPercent > 0 ? '+' : ''}{incomeJumpPercent}%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Months until jump occurs</label>
                <input type="number" min="0" value={incomeJumpMonthOffset} onChange={(e) => setIncomeJumpMonthOffset(parseInt(e.target.value) || 0)} className="w-full sm:w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input type="checkbox" checked={expenseJumpEnabled} onChange={(e) => setExpenseJumpEnabled(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700" />
            <span className="font-medium text-sm text-slate-900 dark:text-slate-100">Simulate Expense Jump</span>
          </label>
          
          {expenseJumpEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pl-6 border-l-2 border-blue-500 dark:border-blue-500/50 ml-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expense Jump Percentage (%)</label>
                <div className="flex items-center gap-2">
                  <input type="range" min="-100" max="300" step="5" value={expenseJumpPercent} onChange={(e) => setExpenseJumpPercent(parseInt(e.target.value))} className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  <span className="text-sm font-semibold w-12 text-right">{expenseJumpPercent > 0 ? '+' : ''}{expenseJumpPercent}%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Months until jump occurs</label>
                <input type="number" min="0" value={expenseJumpMonthOffset} onChange={(e) => setExpenseJumpMonthOffset(parseInt(e.target.value) || 0)} className="w-full sm:w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Avg Projected Monthly Income" value={formatRoundedAmount(forecastData.avgMonthlyIncome)} />
        <MetricCard title="Avg Projected Monthly Expense" value={formatRoundedAmount(forecastData.avgMonthlyExpenses)} />
        <MetricCard title="Avg Projected Monthly Savings" value={formatRoundedAmount(forecastData.avgMonthlySavings)} />
      </div>

      <div className="bg-white dark:bg-slate-900 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className={cn("px-6 font-semibold", compactView ? "py-1.5" : "py-4")}>Year</th>
                <th className={cn("px-6 font-semibold text-right", compactView ? "py-1.5" : "py-4")}>Proj. Income</th>
                <th className={cn("px-6 font-semibold text-right", compactView ? "py-1.5" : "py-4")}>Proj. Expenses</th>
                <th className={cn("px-6 font-semibold text-right", compactView ? "py-1.5" : "py-4")}>Proj. Net Savings</th>
                {forecastData.hasInvestmentReturns && <th className={cn("px-6 font-semibold text-right", compactView ? "py-1.5" : "py-4")}>Investment Return</th>}
                {forecastData.hasRealEstateReturns && <th className={cn("px-6 font-semibold text-right", compactView ? "py-1.5" : "py-4")}>Real Estate Return</th>}
                <th className={cn("px-6 font-semibold text-right", compactView ? "py-1.5" : "py-4")}>End of Year Net Worth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
               {forecastData.yearlyTableData.map((row: any) => (
                <React.Fragment key={row.year}>
                  <tr onClick={() => toggleYear(row.year)} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer">
                    <td className={cn("px-6 text-slate-900 dark:text-slate-100 font-medium flex items-center gap-2", compactView ? "py-1.5" : "py-4")}>
                       {expandedYears[row.year] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                       {row.yearLabel}
                    </td>
                    <td className={cn("px-6 text-right text-slate-700 dark:text-slate-300", compactView ? "py-1.5" : "py-4")}>
                      {formatRoundedAmount(row.totalIncome)}
                    </td>
                    <td className={cn("px-6 text-right text-slate-700 dark:text-slate-300", compactView ? "py-1.5" : "py-4")}>
                      {formatRoundedAmount(row.totalExpenses)}
                    </td>
                    <td className={cn("px-6 text-right font-medium", row.totalSavings < 0 ? 'text-red-500' : 'text-emerald-500', compactView ? "py-1.5" : "py-4")}>
                      {formatRoundedAmount(row.totalSavings)}
                    </td>
                    {forecastData.hasInvestmentReturns && (
                      <td className={cn("px-6 text-right text-slate-700 dark:text-slate-300", compactView ? "py-1.5" : "py-4")}>
                        {formatRoundedAmount(row.totalInvestmentReturn)}
                      </td>
                    )}
                    {forecastData.hasRealEstateReturns && (
                      <td className={cn("px-6 text-right text-slate-700 dark:text-slate-300", compactView ? "py-1.5" : "py-4")}>
                        {formatRoundedAmount(row.totalRealEstateReturn)}
                      </td>
                    )}
                    <td className={cn("px-6 text-right text-slate-900 dark:text-slate-100 font-bold", compactView ? "py-1.5" : "py-4")}>
                      {formatRoundedAmount(row.endNetWorth)}
                    </td>
                  </tr>
                   {expandedYears[row.year] && row.months.map((m: any, mIdx: number) => (
                    <tr key={`${row.year}-${mIdx}`} className="bg-slate-50/30 dark:bg-slate-800/10 border-t border-slate-100 dark:border-slate-800">
                      <td className={cn("px-6 pl-12 text-slate-600 dark:text-slate-400 text-xs", compactView ? "py-1" : "py-2")}>
                        {m.monthName}
                      </td>
                      <td className={cn("px-6 text-right text-slate-600 dark:text-slate-400 text-xs", compactView ? "py-1" : "py-2")}>
                        {formatRoundedAmount(m.income)}
                      </td>
                      <td className={cn("px-6 text-right text-slate-600 dark:text-slate-400 text-xs", compactView ? "py-1" : "py-2")}>
                        {formatRoundedAmount(m.expenses)}
                      </td>
                      <td className={cn("px-6 text-right text-xs", m.savings < 0 ? 'text-red-400/80' : 'text-emerald-400/80', compactView ? "py-1" : "py-2")}>
                        {formatRoundedAmount(m.savings)}
                      </td>
                      {forecastData.hasInvestmentReturns && (
                        <td className={cn("px-6 text-right text-slate-600 dark:text-slate-400 text-xs", compactView ? "py-1" : "py-2")}>
                          {formatRoundedAmount(m.investmentReturn)}
                        </td>
                      )}
                      {forecastData.hasRealEstateReturns && (
                        <td className={cn("px-6 text-right text-slate-600 dark:text-slate-400 text-xs", compactView ? "py-1" : "py-2")}>
                          {formatRoundedAmount(m.realEstateReturn)}
                        </td>
                      )}
                      <td className={cn("px-6 text-right text-slate-700 dark:text-slate-300 font-medium text-xs", compactView ? "py-1" : "py-2")}>
                        {formatRoundedAmount(m.endNetWorth)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}