import Dexie, { type Table } from 'dexie';

export interface AccountType {
  id?: number;
  name: string;
  icon?: string; // Lucide icon name
  updated_at: number;
}

export interface Transaction {
  id?: number;
  description: string;
  amount: number;
  date: string; // ISO string
  account_id: number;
  category_id?: number;
  external_id?: string;
  updated_at: number;
}

export interface Account {
  id?: number;
  name: string;
  is_liquid: boolean;
  description: string;
  card_number?: string;
  is_archived: boolean;
  show_in_top_bar: boolean;
  account_type_id: number;
  order?: number;
  updated_at: number;
}

export interface Category {
  id?: number;
  name: string;
  icon?: string; // Lucide icon name
  updated_at: number;
}

export interface CategoryRule {
  id?: number;
  search_value: string;
  category_id: number;
  priority: number;
  updated_at: number;
}

export interface Setting {
  key: string;
  value: any;
  updated_at: number;
}

export interface RecurringTransaction {
  id?: number;
  description: string;
  amount: number;
  account_id: number;
  category_id?: number;
  day_of_month: number;
  next_execution_date: string; // ISO string (YYYY-MM-DD)
  is_active: boolean;
  updated_at: number;
}

export class OneFileFinanceDB extends Dexie {
  transactions!: Table<Transaction>;
  accounts!: Table<Account>;
  categories!: Table<Category>;
  category_rules!: Table<CategoryRule>;
  account_types!: Table<AccountType>;
  settings!: Table<Setting>;
  recurring_transactions!: Table<RecurringTransaction>;

  constructor() {
    super('OneFileFinanceDB');
    this.version(7).stores({
      transactions: '++id, description, date, account_id, category_id, &external_id, updated_at',
      accounts: '++id, name, account_type_id, is_archived, show_in_top_bar, order, updated_at',
      categories: '++id, name, updated_at',
      category_rules: '++id, search_value, category_id, priority, updated_at',
      account_types: '++id, name, updated_at',
      settings: 'key, updated_at',
      recurring_transactions: '++id, description, account_id, category_id, is_active, updated_at'
    });
  }
}

export const db = new OneFileFinanceDB();
