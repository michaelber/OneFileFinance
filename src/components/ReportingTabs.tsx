import React, { useMemo, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Legend, PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { calculateCapitalGains } from '../lib/reportingUtils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

function MetricCard({ title, value }: { title: string, value: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{title}</h3>
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
      const excludedCategoryIds = new Set(
        categories.filter((cat: any) => cat.icon === 'CapitalGains' || cat.icon === 'SeverancePay').map((cat: any) => cat.id)
      );
      validTxs = transactions.filter((t: any) => {
        if (t.category_id && excludedCategoryIds.has(t.category_id) && t.date > todayStr) {
          return false;
        }
        return true;
      });
    }

    const yearlyTotals: Record<number, { income: number, expenses: number }> = {};
    const monthlyTotals: Record<string, { income: number, expenses: number }> = {};

    validTxs.forEach((t: any) => {
      const year = parseInt(t.date.substring(0, 4), 10);
      const monthKey = t.date.substring(0, 7);
      
      if (!yearlyTotals[year]) yearlyTotals[year] = { income: 0, expenses: 0 };
      if (!monthlyTotals[monthKey]) monthlyTotals[monthKey] = { income: 0, expenses: 0 };

      if (t.amount > 0) {
        yearlyTotals[year].income += t.amount;
        monthlyTotals[monthKey].income += t.amount;
      } else if (t.amount < 0) {
        yearlyTotals[year].expenses += t.amount;
        monthlyTotals[monthKey].expenses += t.amount;
      }
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
    const threshold = total * 0.1;
    
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
    const threshold = total * 0.1;
    
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
      return { id: acc.id, name: acc.name, amount, capitalGains };
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
              {accountTableData.rows.map((row: any) => (
                <tr 
                  key={row.id} 
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <td className={cn("px-6 font-medium text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}>
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
              ))}
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

export function CategoriesTab({ transactions, categories, formatRoundedAmount, compactView }: any) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [visibleYearsCount, setVisibleYearsCount] = useState<number | 'All'>(9);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const pivotData = useMemo(() => {
    if (!transactions || !categories) return null;

    const data: Record<string, any> = {};
    const yearsSet = new Set<number>();
    
    transactions.forEach((t: any) => {
      const year = parseInt(t.date.substring(0, 4), 10);
      yearsSet.add(year);
    });
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    const months = Array.from({ length: 12 }, (_, i) => i);

    categories.forEach((cat: any) => {
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

    transactions.forEach((t: any) => {
      const year = parseInt(t.date.substring(0, 4), 10);
      const month = parseInt(t.date.substring(5, 7), 10) - 1;
      const catId = t.category_id || 'uncategorized';

      if (data[catId]) {
        data[catId].total += t.amount;
        data[catId].years[year].total += t.amount;
        data[catId].years[year].months[month] += t.amount;
      }
    });

    const filteredData = Object.entries(data)
      .filter(([_, catData]) => catData.total !== 0)
      .sort((a: any, b: any) => b[1].total - a[1].total);

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
        <div className="flex items-center gap-4">
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
            <tr>
              <th className={cn("px-6 font-medium", compactView ? "py-1.5" : "py-3")}>Category</th>
              <th className={cn("px-6 font-medium text-right", compactView ? "py-1.5" : "py-3")}>Total</th>
              {displayedYears.map(year => (
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
                    {formatRoundedAmount(catData.total, true)}
                  </td>
                  {displayedYears.map(year => (
                    <td 
                      key={year} 
                      className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}
                      style={{ backgroundColor: getBgColor(catData.years[year].total, pivotData.maxAbsValue) }}
                    >
                      {formatRoundedAmount(catData.years[year].total, true)}
                    </td>
                  ))}
                </tr>
                {expandedCategories[catId] && displayedYears.map(year => (
                  pivotData.months.map(month => {
                    const amount = catData.years[year].months[month];
                    if (amount === 0) return null;
                    return (
                      <tr key={`${catId}-${year}-${month}`} className="bg-slate-50/50 dark:bg-slate-900/50">
                        <td className={cn("px-6 pl-12 text-slate-500 dark:text-slate-400 text-xs", compactView ? "py-0.5" : "py-2")}>
                          {format(new Date(year, month), 'MMMM yyyy')}
                        </td>
                        <td className={cn("px-6 text-right", compactView ? "py-0.5" : "py-2")}></td>
                        {displayedYears.map(y => (
                          <td 
                            key={y} 
                            className={cn("px-6 text-right text-xs text-slate-900 dark:text-slate-100", compactView ? "py-0.5" : "py-2")}
                            style={y === year ? { backgroundColor: getBgColor(amount, pivotData.maxAbsValue) } : {}}
                          >
                            {y === year ? formatRoundedAmount(amount, true) : '-'}
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
                {formatRoundedAmount(pivotData.grandTotal, true)}
              </td>
              {displayedYears.map(year => (
                <td 
                  key={year} 
                  className={cn("px-6 text-right text-slate-900 dark:text-slate-100", compactView ? "py-1" : "py-4")}
                  style={{ backgroundColor: getBgColor(pivotData.yearTotals[year], pivotData.maxAbsValue) }}
                >
                  {formatRoundedAmount(pivotData.yearTotals[year], true)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
