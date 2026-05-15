import { db } from '../db';


export async function seedBlankData() {
  await db.account_types.bulkAdd([
    { id: 1, name: 'Cash', icon: 'Wallet', updated_at: Date.now() },
    { id: 2, name: 'Stocks', icon: 'TrendingUp', updated_at: Date.now() },
    { id: 3, name: 'Real Estate', icon: 'Home', updated_at: Date.now() },
    { id: 4, name: 'Crypto', icon: 'Coins', updated_at: Date.now() },
    { id: 5, name: 'Fixed Deposit', icon: 'ArrowUpRight', updated_at: Date.now() },
    { id: 6, name: 'Accounts Receivable', icon: 'Hammer', updated_at: Date.now() }
  ]);

  await db.accounts.bulkAdd([
    { id: 1, name: 'Cash', account_type_id: 1, is_liquid: true, is_archived: false, show_in_top_bar: true, description: 'Primary bank account', order: 3, updated_at: Date.now() },
    { id: 4, name: 'Bank Account', account_type_id: 1, is_liquid: true, show_in_top_bar: true, is_archived: false, description: '', order: 0, updated_at: Date.now() },
    { id: 13, name: 'Savings Account', account_type_id: 5, order: 2, is_liquid: false, show_in_top_bar: true, is_archived: false, description: '', updated_at: Date.now() },
    { id: 14, name: 'Crypto Exchange', account_type_id: 4, order: 4, is_liquid: false, show_in_top_bar: false, is_archived: false, description: '', updated_at: Date.now() },
    { id: 16, name: 'Stock Portfolio', account_type_id: 2, order: 1, is_liquid: false, show_in_top_bar: true, is_archived: false, description: '', updated_at: Date.now() },
    { id: 17, name: 'Real Estate', account_type_id: 3, order: 6, is_liquid: false, show_in_top_bar: false, is_archived: false, description: '', updated_at: Date.now() },
    { id: 18, name: 'Accounts Receivable', account_type_id: 6, order: 7, is_liquid: false, show_in_top_bar: false, is_archived: false, description: '', updated_at: Date.now() }
  ]);

  await db.categories.bulkAdd([
    { id: 1, name: 'Salary', icon: 'Briefcase', updated_at: Date.now() },
    { id: 2, name: 'Housing', icon: 'Home', updated_at: Date.now() },
    { id: 3, name: 'Groceries', icon: 'ShoppingBag', updated_at: Date.now() },
    { id: 4, name: 'Transportation', icon: 'Train', updated_at: Date.now() },
    { id: 5, name: 'Leisure', icon: 'Heart', updated_at: Date.now() },
  ]);
}

export async function seedSampleData() {
  await db.account_types.bulkAdd([
    { id: 1, name: 'Cash', icon: 'Wallet', updated_at: Date.now() },
    { id: 2, name: 'Stocks', icon: 'TrendingUp', updated_at: Date.now() },
    { id: 3, name: 'Real Estate', icon: 'Home', updated_at: Date.now() },
    { id: 4, name: 'Crypto', icon: 'Coins', updated_at: Date.now() },
    { id: 5, name: 'Fixed Deposit', icon: 'ArrowUpRight', updated_at: Date.now() },
    { id: 6, name: 'Accounts Receivable', icon: 'Hammer', updated_at: Date.now() }
  ]);

  await db.accounts.bulkAdd([
    { id: 1, name: 'Cash', account_type_id: 1, is_liquid: true, is_archived: false, show_in_top_bar: true, description: 'Primary bank account', order: 3, updated_at: Date.now() },
    { id: 4, name: 'Bank Account', account_type_id: 1, is_liquid: true, show_in_top_bar: true, is_archived: false, description: '', order: 0, updated_at: Date.now() },
    { id: 13, name: 'Savings Account', account_type_id: 5, order: 2, is_liquid: false, show_in_top_bar: true, is_archived: false, description: '', updated_at: Date.now() },
    { id: 14, name: 'Crypto Exchange', account_type_id: 4, order: 4, is_liquid: false, show_in_top_bar: false, is_archived: false, description: '', updated_at: Date.now() },
    { id: 16, name: 'Stock Portfolio', account_type_id: 2, order: 1, is_liquid: false, show_in_top_bar: true, is_archived: false, description: '', updated_at: Date.now() },
    { id: 17, name: 'Real Estate', account_type_id: 3, order: 6, is_liquid: false, show_in_top_bar: false, is_archived: false, description: '', updated_at: Date.now() },
    { id: 18, name: 'Accounts Receivable', account_type_id: 6, order: 7, is_liquid: false, show_in_top_bar: false, is_archived: false, description: '', updated_at: Date.now() }
  ]);

  await db.categories.bulkAdd([
    { id: 5, name: 'Asset Purchase', icon: 'Home', updated_at: Date.now() },
    { id: 6, name: 'Daily Expenses', icon: 'Banknote', updated_at: Date.now() },
    { id: 7, name: 'Gambling', icon: 'Zap', updated_at: Date.now() },
    { id: 8, name: 'Project/Contract', icon: 'Briefcase', updated_at: Date.now() },
    { id: 9, name: 'Gifts', icon: 'Gift', updated_at: Date.now() },
    { id: 11, name: 'Capital Gains', icon: 'CapitalGains', updated_at: Date.now() },
    { id: 12, name: 'Mobile Phone', icon: 'Smartphone', updated_at: Date.now() },
    { id: 14, name: 'IT Services', icon: 'Briefcase', updated_at: Date.now() },
    { id: 15, name: 'Asset Sale', icon: 'Hammer', updated_at: Date.now() },
    { id: 17, name: 'Bonus/Credit', icon: 'CreditCard', updated_at: Date.now() },
    { id: 18, name: 'Taxes/Revenue', icon: 'ArrowDownLeft', updated_at: Date.now() },
    { id: 19, name: 'Sports/Fitness', icon: 'Heart', updated_at: Date.now() },
    { id: 20, name: 'Software', icon: 'Laptop', updated_at: Date.now() },
    { id: 21, name: 'Public Transport', icon: 'Train', updated_at: Date.now() },
    { id: 22, name: 'Salary', icon: 'Briefcase', updated_at: Date.now() },
    { id: 23, name: 'Vacation', icon: 'Plane', updated_at: Date.now() },
    { id: 24, name: 'Clothing', icon: 'ShoppingBag', updated_at: Date.now() },
    { id: 25, name: 'Concert Tickets', icon: 'Music', updated_at: Date.now() },
    { id: 26, name: 'Apartment/Housing', icon: 'Home', updated_at: Date.now() },
    { id: 27, name: 'Going Out', icon: 'Wallet', updated_at: Date.now() },
    { id: 28, name: 'Books/Audiobooks', icon: 'Music', updated_at: Date.now() },
    { id: 29, name: 'Expenses', icon: 'ArrowDownLeft', updated_at: Date.now() },
    { id: 30, name: 'Health', icon: 'Heart', updated_at: Date.now() },
    { id: 32, name: 'Scholarship', icon: 'Wallet', updated_at: Date.now() },
    { id: 33, name: 'Insurance', icon: 'Building', updated_at: Date.now() },
    { id: 35, name: 'Music Streaming', icon: 'Music', updated_at: Date.now() },
    { id: 36, name: 'Opening Balance', icon: 'OpeningBalance', updated_at: Date.now() },
    { id: 37, name: 'Account Transfer', icon: 'Tag', updated_at: Date.now() },
    { id: 38, name: 'Depreciation', icon: 'ArrowDownLeft', updated_at: Date.now() },
    { id: 39, name: 'Real Estate Exp.', icon: 'Home', updated_at: Date.now() },
    { id: 40, name: 'Severance Pay', icon: 'SeverancePay', updated_at: Date.now() }
  ]);

  // Generate dynamic full data
  const { transactions } = generateTransactions();
  await db.transactions.bulkAdd(transactions);
}

function generateTransactions() {
  const transactions: any[] = [];
  const now = new Date();
  
  // Start 3 years ago
  const startDate = new Date(now.getFullYear() - 3, now.getMonth(), 1);
  let currentDate = new Date(startDate);
  
  let id = 1;

  while (currentDate <= now) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const getDayStr = (day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Monthly Salary
    transactions.push({ id: id++, description: "Monthly Salary", amount: 5500, date: getDayStr(1), account_id: 4, category_id: 22, updated_at: Date.now() });
    
    // Apartment Rent
    transactions.push({ id: id++, description: "Apartment Rent", amount: -1600, date: getDayStr(2), account_id: 4, category_id: 26, updated_at: Date.now() });

    // Electric & Water (random amount)
    transactions.push({ id: id++, description: "Electric & Water", amount: -(100 + Math.random() * 50), date: getDayStr(Math.floor(Math.random() * 20) + 1), account_id: 4, category_id: 26, updated_at: Date.now() });

    // Internet Provider
    transactions.push({ id: id++, description: "Internet Provider", amount: -70, date: getDayStr(15), account_id: 4, category_id: 20, updated_at: Date.now() });

    // Supermarket (Weekly)
    for (let i = 0; i < 4; i++) {
        const randDay = Math.floor(Math.random() * 7) + 1 + (i * 7);
        if (randDay <= 28) {
            transactions.push({ id: id++, description: "Supermarket", amount: -(60 + Math.random() * 60), date: getDayStr(randDay), account_id: 4, category_id: 6, updated_at: Date.now() });
        }
    }

    // Gas Station
    transactions.push({ id: id++, description: "Gas Station", amount: -(40 + Math.random() * 30), date: getDayStr(Math.floor(Math.random() * 20) + 1), account_id: 4, category_id: 21, updated_at: Date.now() });

    // Restaurants / Bars
    transactions.push({ id: id++, description: "Burger Joint", amount: -(20 + Math.random() * 30), date: getDayStr(Math.floor(Math.random() * 28) + 1), account_id: 4, category_id: 27, updated_at: Date.now() });
    transactions.push({ id: id++, description: "Local Restaurant", amount: -(40 + Math.random() * 40), date: getDayStr(Math.floor(Math.random() * 28) + 1), account_id: 4, category_id: 27, updated_at: Date.now() });

    // Streaming Services
    transactions.push({ id: id++, description: "Streaming Services", amount: -25.98, date: getDayStr(12), account_id: 4, category_id: 35, updated_at: Date.now() });

    // Transfer to Savings
    transactions.push({ id: id++, description: "Transfer to Savings", amount: -1200, date: getDayStr(5), account_id: 4, category_id: 37, updated_at: Date.now() });
    transactions.push({ id: id++, description: "Deposit from Checking", amount: 1200, date: getDayStr(5), account_id: 13, category_id: 37, updated_at: Date.now() });

    // Transfer to Brokerage
    transactions.push({ id: id++, description: "Transfer to Brokerage", amount: -1600, date: getDayStr(15), account_id: 4, category_id: 37, updated_at: Date.now() });
    transactions.push({ id: id++, description: "Transfer from Checking", amount: 1600, date: getDayStr(15), account_id: 16, category_id: 37, updated_at: Date.now() });

    // Yearly Portfolio Revaluation
    if (month === 12) {
      transactions.push({ id: id++, description: "Portfolio Revaluation", amount: 3500 + Math.floor(Math.random() * 4000), date: getDayStr(31), account_id: 16, category_id: 11, updated_at: Date.now() });
    }

    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // Filter out any dates that are actually in the future (e.g. later this month)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  return { transactions: transactions.filter(t => t.date <= todayStr) };
}
