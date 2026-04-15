import { Transaction, Category, Account, AccountType } from '../db';
import { differenceInMonths, parseISO, min, max, startOfYear, subDays, startOfMonth, subMonths, endOfMonth } from 'date-fns';

export const calculateCumulativeSum = (transactions: Transaction[], date: Date): number => {
  return transactions
    .filter(t => parseISO(t.date) <= date)
    .reduce((sum, t) => sum + t.amount, 0);
};

export const calculateMonthsSinceInception = (transactions: Transaction[]): number => {
  if (transactions.length === 0) return 0;
  
  const dates = transactions.map(t => parseISO(t.date));
  const earliest = min(dates);
  const latest = min([new Date(), max(dates)]);
  
  return differenceInMonths(latest, earliest) + 1;
};

export const calculateMonthlyAverage = (transactions: Transaction[]): number => {
  const months = calculateMonthsSinceInception(transactions);
  if (months === 0) return 0;
  
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  return total / months;
};

export const calculateYearlyAverage = (transactions: Transaction[]): number => {
  return calculateMonthlyAverage(transactions) * 12;
};

export const calculateExpenses = (transactions: Transaction[]): number => {
  const categoryTotals = transactions.reduce((acc, t) => {
    const catId = t.category_id || 0;
    acc[catId] = (acc[catId] || 0) + t.amount;
    return acc;
  }, {} as Record<number, number>);

  return Object.values(categoryTotals)
    .filter(total => total < 0)
    .reduce((sum, total) => sum + total, 0);
};

export const calculateIncome = (transactions: Transaction[], accounts?: Account[], accountTypes?: AccountType[]): number => {
  let validTransactions = transactions;
  
  if (accounts && accountTypes) {
    const todayStr = new Date().toISOString().split('T')[0];
    const excludedAccountIds = new Set(
      accounts.filter(acc => {
        const type = accountTypes.find(t => t.id === acc.account_type_id);
        return type && (type.icon === 'CapitalGains' || type.icon === 'SeverancePay');
      }).map(acc => acc.id)
    );

    validTransactions = transactions.filter(t => {
      if (excludedAccountIds.has(t.account_id) && t.date > todayStr) {
        return false;
      }
      return true;
    });
  }

  const categoryTotals = validTransactions.reduce((acc, t) => {
    const catId = t.category_id || 0;
    acc[catId] = (acc[catId] || 0) + t.amount;
    return acc;
  }, {} as Record<number, number>);

  return Object.values(categoryTotals)
    .filter(total => total > 0)
    .reduce((sum, total) => sum + total, 0);
};

export const calculateSavingsRate = (transactions: Transaction[], accounts?: Account[], accountTypes?: AccountType[]): number | null => {
  const expenses = calculateExpenses(transactions);
  const income = calculateIncome(transactions, accounts, accountTypes);
  
  if (expenses === 0 || income === 0) return null;
  
  return 1 - (-expenses / income);
};

export const calculateCapitalGains = (transactions: Transaction[], accounts: Account[], accountTypes: AccountType[]): number => {
  const capitalGainsAccountIds = new Set(
    accounts.filter(acc => {
      const type = accountTypes.find(t => t.id === acc.account_type_id);
      return type && type.icon === 'CapitalGains';
    }).map(acc => acc.id)
  );
  
  return transactions
    .filter(t => capitalGainsAccountIds.has(t.account_id))
    .reduce((sum, t) => sum + t.amount, 0);
};

export const calculateNetWorth = (transactions: Transaction[]): number => {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
};

export const calculateNetWorthYTD = (transactions: Transaction[]): number => {
  const startOfCurrentYear = startOfYear(new Date());
  const today = new Date();
  
  return transactions
    .filter(t => {
      const date = parseISO(t.date);
      return date >= startOfCurrentYear && date <= today;
    })
    .reduce((sum, t) => sum + t.amount, 0);
};

export const calculateNetWorth12M = (transactions: Transaction[]): number => {
  const oneYearAgo = subDays(new Date(), 365);
  
  return transactions
    .filter(t => parseISO(t.date) >= oneYearAgo)
    .reduce((sum, t) => sum + t.amount, 0);
};

export const calculateFinancialFreedomYears = (transactions: Transaction[]): number | null => {
  const today = new Date();
  const end = endOfMonth(subMonths(today, 1));
  const start = startOfMonth(subMonths(today, 13));
  
  const last12MonthsTxs = transactions.filter(t => {
    const date = parseISO(t.date);
    return date >= start && date <= end;
  });

  const categoryTotals = last12MonthsTxs.reduce((acc, t) => {
    const catId = t.category_id || 0;
    acc[catId] = (acc[catId] || 0) + t.amount;
    return acc;
  }, {} as Record<number, number>);

  const expensesLast12FullMonths = Object.values(categoryTotals)
    .filter(total => total < 0)
    .reduce((sum, total) => sum + total, 0);
    
  if (expensesLast12FullMonths === 0) return null;
  
  const netWorth = calculateNetWorth(transactions);
  return netWorth / (-expensesLast12FullMonths);
};
