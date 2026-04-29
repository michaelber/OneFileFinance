import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type RecurringTransaction, type Account, type Category } from '../db';
import { format, parseISO, isValid, addMonths, startOfDay, endOfMonth, setDate, isAfter } from 'date-fns';
import { Check, X, Trash2, Tag, Wallet, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { ICON_MAP } from '../constants';
import { formatAmount } from '../lib/formatters';
import { TypeAheadSelect, DateInput, AmountInput, TextInput } from './TransactionTable';

function DayInput({ value, onChange, onKeyDown, onBlur, autoFocus, className }: {
  value: number;
  onChange: (val: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  className?: string;
  key?: string;
}) {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleCommit = (val: string) => {
    const day = val === '' ? 1 : parseInt(val);
    const clampedDay = Math.max(1, Math.min(31, day));
    if (clampedDay !== value) {
      onChange(clampedDay);
    }
  };

  const handleBlur = () => {
    handleCommit(inputValue);
    onBlur?.();
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      handleCommit(inputValue);
    }
    onKeyDown(e);
  };

  return (
    <input
      autoFocus={autoFocus}
      type="text"
      inputMode="numeric"
      className={cn("w-full bg-transparent border-none p-0 text-sm focus:outline-none dark:text-slate-100 text-center", className)}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={handleBlur}
      onKeyDown={handleKeyDownInternal}
    />
  );
}

interface RecurringRowProps {
  t: RecurringTransaction;
  rowIndex: number;
  activeCell: { id: number | 'new'; col: number } | null;
  setActiveCell: (cell: { id: number | 'new'; col: number } | null) => void;
  handleCellClick: (id: number | 'new', col: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, id: number | 'new', col: number) => void;
  handleUpdate: (id: number, field: keyof RecurringTransaction, value: any) => void;
  handleDelete: (id: number) => void;
  deletingId: number | null;
  setDeletingId: (id: number | null) => void;
  compactView: boolean;
  categories: Category[];
  accounts: Account[];
  formatCurrency: (amount: number) => string;
  numberFormat: string;
}

const RecurringRow = React.memo(({
  t,
  rowIndex,
  activeCell,
  setActiveCell,
  handleCellClick,
  handleKeyDown,
  handleUpdate,
  handleDelete,
  deletingId,
  setDeletingId,
  compactView,
  categories,
  accounts,
  formatCurrency,
  numberFormat
}: RecurringRowProps) => {
  const [optimisticT, setOptimisticT] = useState(t);

  useEffect(() => {
    setOptimisticT(t);
  }, [t]);

  const onUpdate = (field: keyof RecurringTransaction, value: any) => {
    setOptimisticT(prev => ({ ...prev, [field]: value }));
    handleUpdate(t.id!, field, value);
  };

  return (
    <tr className={cn(
      "group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors",
      activeCell?.id === t.id && "z-20 relative"
    )}>
      <td className={cn("px-4 text-center", compactView ? "py-1" : "py-2")}>
        <button 
          onClick={() => onUpdate('is_active', !optimisticT.is_active)}
          className={cn(
            "p-1 rounded transition-colors",
            optimisticT.is_active ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-rose-600 bg-rose-50 dark:bg-rose-900/20"
          )}
        >
          {optimisticT.is_active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
      </td>
      <td 
        className={cn(
          "px-4",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 1 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
        )}
        onClick={() => handleCellClick(t.id!, 1)}
      >
        {activeCell?.id === t.id && activeCell?.col === 1 ? (
          <DayInput
            key={`${t.id}-day`}
            autoFocus
            value={optimisticT.day_of_month}
            onChange={(val) => onUpdate('day_of_month', val)}
            onBlur={() => setActiveCell(null)}
            onKeyDown={(e) => handleKeyDown(e, t.id!, 1)}
          />
        ) : (
          <span className="text-sm text-slate-700 dark:text-slate-300 text-center block">{optimisticT.day_of_month}</span>
        )}
      </td>
      <td 
        className={cn(
          "px-4",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 2 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
        )}
        onClick={() => handleCellClick(t.id!, 2)}
      >
        {activeCell?.id === t.id && activeCell?.col === 2 ? (
          <TextInput
            key={`${t.id}-description`}
            autoFocus
            value={optimisticT.description}
            onChange={(val) => onUpdate('description', val)}
            onBlur={() => setActiveCell(null)}
            onKeyDown={(e) => handleKeyDown(e, t.id!, 2)}
          />
        ) : (
          <span className="text-sm text-slate-700 dark:text-slate-300 truncate block">{optimisticT.description}</span>
        )}
      </td>
      <td 
        className={cn(
          "px-4",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 3 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
        )}
        onClick={() => handleCellClick(t.id!, 3)}
      >
      {activeCell?.id === t.id && activeCell?.col === 3 ? (
        <AmountInput
          key={`${t.id}-amount`}
          autoFocus
          value={optimisticT.amount}
          onChange={(val) => onUpdate('amount', val)}
          onKeyDown={(e) => handleKeyDown(e, t.id!, 3)}
          onBlur={() => setActiveCell(null)}
          numberFormat={numberFormat}
          className="text-right"
        />
      ) : (
        <span className={cn(
          "text-sm font-bold text-right block",
          optimisticT.amount < 0 ? "text-rose-600" : "text-emerald-600"
        )}>
          {formatCurrency(optimisticT.amount)}
        </span>
      )}
    </td>
      <td 
        className={cn(
          "px-4",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 4 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
        )}
        onClick={() => handleCellClick(t.id!, 4)}
      >
        {activeCell?.id === t.id && activeCell?.col === 4 ? (
          <TypeAheadSelect
            autoFocus
            options={accounts.map(a => ({ 
              id: a.id!, 
              name: a.name,
              icon: <Wallet className="w-4 h-4" />
            }))}
            value={optimisticT.account_id}
            onChange={(id) => onUpdate('account_id', id)}
            onKeyDown={(e) => handleKeyDown(e, t.id!, 4)}
            onBlur={() => setActiveCell(null)}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Wallet className="w-4 h-4 opacity-50" />
            <span>{accounts.find(a => a.id === optimisticT.account_id)?.name || '-'}</span>
          </div>
        )}
      </td>
      <td 
        className={cn(
          "px-4",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 5 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
        )}
        onClick={() => handleCellClick(t.id!, 5)}
      >
        {activeCell?.id === t.id && activeCell?.col === 5 ? (
          <TypeAheadSelect
            autoFocus
            options={categories.map(c => ({ 
              id: c.id!, 
              name: c.name,
              icon: c.icon ? ICON_MAP[c.icon] : <Tag className="w-4 h-4" />
            }))}
            value={optimisticT.category_id}
            onChange={(id) => onUpdate('category_id', id)}
            onKeyDown={(e) => handleKeyDown(e, t.id!, 5)}
            onBlur={() => setActiveCell(null)}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            {(() => {
              const cat = categories.find(c => c.id === optimisticT.category_id);
              return (
                <>
                  {cat?.icon ? ICON_MAP[cat.icon] : <Tag className="w-4 h-4 opacity-50" />}
                  <span>{cat?.name || '-'}</span>
                </>
              );
            })()}
          </div>
        )}
      </td>
      <td className={cn("px-4", compactView ? "py-1" : "py-2")}>
        <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 opacity-50" />
          {isValid(parseISO(optimisticT.next_execution_date)) ? format(parseISO(optimisticT.next_execution_date), 'dd.MM.yyyy') : '-'}
        </span>
      </td>
      <td className={cn("w-12 px-2 text-center", compactView ? "py-1" : "py-2")}>
        {deletingId === t.id ? (
          <div className="flex items-center justify-center gap-1 animate-fade-in">
            <button 
              onClick={() => handleDelete(t.id!)}
              className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setDeletingId(null)}
              className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setDeletingId(t.id!)}
            className="p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
});

export function RecurringTransactionsTable() {
  const liveRecurring = useLiveQuery(() => 
    db.recurring_transactions.toArray().then(arr => 
      arr.sort((a, b) => {
        if (a.day_of_month !== b.day_of_month) {
          return a.day_of_month - b.day_of_month;
        }
        return a.description.localeCompare(b.description);
      })
    )
  ) || [];

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const homeCurrency = settings?.find(s => s.key === 'homeCurrency')?.value || '€';
  const numberFormat = settings?.find(s => s.key === 'numberFormat')?.value || 'space-comma';
  const compactView = settings?.find(s => s.key === 'compactView')?.value ?? true;

  const [activeCell, setActiveCell] = useState<{ id: number | 'new'; col: number } | null>(null);
  const [focusSource, setFocusSource] = useState<'mouse' | 'keyboard' | null>(null);
  const [displayRecurring, setDisplayRecurring] = useState<RecurringTransaction[]>([]);
  const idToFocusRef = useRef<{ id: number; col: number } | null>(null);
  const prevActiveCellRef = useRef<{ row: number; col: number } | null>(null);

  // Auto-select text when cell becomes active via keyboard
  useEffect(() => {
    if (activeCell && focusSource === 'keyboard') {
      const isSameCell = prevActiveCellRef.current?.id === activeCell.id && 
                         prevActiveCellRef.current?.col === activeCell.col;
      
      if (isSameCell) return;
      
      prevActiveCellRef.current = activeCell;

      // Small delay to ensure the input is rendered and focused
      const timer = setTimeout(() => {
        const activeElement = document.activeElement as HTMLInputElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
          if (activeElement.tagName === 'INPUT') {
            activeElement.select();
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (activeCell && focusSource === 'mouse') {
      prevActiveCellRef.current = activeCell;
    } else if (!activeCell) {
      prevActiveCellRef.current = null;
      setFocusSource(null);
    }
  }, [activeCell, focusSource]);

  useEffect(() => {
    if (!activeCell) {
      setDisplayRecurring(liveRecurring);
    } else {
      // While editing, we want to keep the same order but update the data
      const currentIds = displayRecurring.map(r => r.id);
      const updated = currentIds.map(id => liveRecurring.find(r => r.id === id)).filter(Boolean) as RecurringTransaction[];
      
      if (updated.length !== liveRecurring.length) {
        // If items were added or deleted, we need to sync
        setDisplayRecurring(liveRecurring);
      } else {
        setDisplayRecurring(updated);
      }
    }
  }, [liveRecurring, activeCell]);

  useEffect(() => {
    if (idToFocusRef.current && displayRecurring.length > 0) {
      const index = displayRecurring.findIndex(r => r.id === idToFocusRef.current?.id);
      if (index !== -1) {
        setActiveCell({ row: index, col: idToFocusRef.current.col });
        idToFocusRef.current = null;
      }
    }
  }, [displayRecurring]);

  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const calculateNextExecution = (day: number) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Try this month
    const lastDayThisMonth = endOfMonth(now).getDate();
    const targetDayThisMonth = Math.min(day, lastDayThisMonth);
    const thisMonthDate = new Date(currentYear, currentMonth, targetDayThisMonth);
    
    if (!isAfter(startOfDay(now), startOfDay(thisMonthDate))) {
      return format(thisMonthDate, 'yyyy-MM-dd');
    }
    
    // Try next month
    const nextMonthDate = addMonths(new Date(currentYear, currentMonth, 1), 1);
    const lastDayNextMonth = endOfMonth(nextMonthDate).getDate();
    const targetDayNextMonth = Math.min(day, lastDayNextMonth);
    const finalDate = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), targetDayNextMonth);
    
    return format(finalDate, 'yyyy-MM-dd');
  };

  const [newTemplate, setNewTemplate] = useState<Partial<RecurringTransaction>>({
    description: '',
    amount: 0,
    account_id: undefined,
    category_id: undefined,
    day_of_month: new Date().getDate(),
    next_execution_date: calculateNextExecution(new Date().getDate()),
    is_active: true
  });

  useEffect(() => {
    if (accounts.length > 0 && !newTemplate.account_id) {
      setNewTemplate(prev => ({ ...prev, account_id: accounts[0].id }));
    }
  }, [accounts]);

  const handleUpdate = async (id: number, field: keyof RecurringTransaction, value: any) => {
    // Basic validation for mandatory fields to prevent clearing them
    if (field === 'description' && !value) return;
    if (field === 'account_id' && !value) return;
    if (field === 'category_id' && !value) return;
    if (field === 'day_of_month' && (isNaN(value) || value < 1 || value > 31)) return;

    const updateData: any = { [field]: value, updated_at: Date.now() };
    
    if (field === 'day_of_month') {
      updateData.next_execution_date = calculateNextExecution(value);
    }
    
    await db.recurring_transactions.update(id, updateData);
  };

  const handleDelete = async (id: number) => {
    await db.recurring_transactions.delete(id);
  };

  const handleAdd = async () => {
    if (!newTemplate.description || !newTemplate.amount || !newTemplate.account_id || !newTemplate.category_id || !newTemplate.day_of_month) {
      setError('All fields (Day, Description, Amount, Account, Category) are mandatory');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const id = await db.recurring_transactions.add({
      description: newTemplate.description,
      amount: newTemplate.amount || 0,
      account_id: newTemplate.account_id,
      category_id: newTemplate.category_id,
      day_of_month: newTemplate.day_of_month || 1,
      next_execution_date: newTemplate.next_execution_date || calculateNextExecution(newTemplate.day_of_month || 1),
      is_active: true,
      updated_at: Date.now()
    });

    idToFocusRef.current = { id: id as number, col: 1 };
    setActiveCell(null);

    const defaultDay = new Date().getDate();
    setNewTemplate({
      description: '',
      amount: 0,
      account_id: accounts[0]?.id || 0,
      category_id: undefined,
      day_of_month: defaultDay,
      next_execution_date: calculateNextExecution(defaultDay),
      is_active: true
    });
    setActiveCell(null);
  };

  const handleCellClick = (id: number | 'new', col: number) => {
    if (activeCell?.id === id && activeCell?.col === col) return;
    setFocusSource('mouse');
    setActiveCell({ id, col });
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: number | 'new', colIndex: number) => {
    const target = e.target as HTMLInputElement;
    const rowIndex = id === 'new' ? -1 : displayRecurring.findIndex(t => t.id === id);
    const numCols = 6; // Active, Day, Description, Amount, Account, Category (Next Execution is readonly)
    const numRows = displayRecurring.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusSource('keyboard');
      if (id === 'new') {
        if (numRows > 0) {
          setActiveCell({ id: displayRecurring[0].id!, col: colIndex });
        }
      } else if (rowIndex < numRows - 1) {
        setActiveCell({ id: displayRecurring[rowIndex + 1].id!, col: colIndex });
      } else {
        setActiveCell({ id: 'new', col: colIndex });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusSource('keyboard');
      if (id === 'new') {
        if (numRows > 0) {
          setActiveCell({ id: displayRecurring[numRows - 1].id!, col: colIndex });
        }
      } else if (rowIndex > 0) {
        setActiveCell({ id: displayRecurring[rowIndex - 1].id!, col: colIndex });
      } else {
        setActiveCell({ id: 'new', col: colIndex });
      }
    } else if (e.key === 'ArrowRight') {
      const isSelectLike = colIndex === 4 || colIndex === 5; // Account, Category
      const isAtEnd = target.selectionEnd === (target.value?.length || 0);
      
      if (isSelectLike || isAtEnd || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex < numCols - 1) {
          e.preventDefault();
          setFocusSource('keyboard');
          setActiveCell({ id, col: colIndex + 1 });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const isSelectLike = colIndex === 4 || colIndex === 5; // Account, Category
      const isAtStart = target.selectionStart === 0;

      if (isSelectLike || isAtStart || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex > 0) {
          e.preventDefault();
          setFocusSource('keyboard');
          setActiveCell({ id, col: colIndex - 1 });
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setFocusSource('keyboard');
      if (e.shiftKey) {
        if (colIndex > 1) {
          setActiveCell({ id, col: colIndex - 1 });
        } else if (id !== 'new') {
          if (rowIndex > 0) {
            setActiveCell({ id: displayRecurring[rowIndex - 1].id!, col: numCols - 1 });
          } else {
            setActiveCell({ id: 'new', col: numCols - 1 });
          }
        } else {
          setActiveCell(null);
        }
      } else {
        if (id === 'new') {
          if (colIndex < numCols - 1) {
            setActiveCell({ id: 'new', col: colIndex + 1 });
          } else {
            handleAdd();
          }
        } else {
          if (colIndex < numCols - 1) {
            setActiveCell({ id, col: colIndex + 1 });
          } else if (rowIndex < numRows - 1) {
            setActiveCell({ id: displayRecurring[rowIndex + 1].id!, col: 1 });
          } else {
            setActiveCell(null);
          }
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setFocusSource('keyboard');
      if (id === 'new') {
        if (colIndex < numCols - 1) {
          setActiveCell({ id: 'new', col: colIndex + 1 });
        } else {
          handleAdd();
        }
      } else {
        if (colIndex < numCols - 1) {
          setActiveCell({ id, col: colIndex + 1 });
        } else if (rowIndex < numRows - 1) {
          setActiveCell({ id: displayRecurring[rowIndex + 1].id!, col: 1 });
        } else {
          setActiveCell(null);
        }
      }
    } else if (e.key === 'Escape') {
      setActiveCell(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return formatAmount(amount, homeCurrency, numberFormat);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
      {error && (
        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-900/10 flex items-center justify-center gap-2 text-xs text-rose-500 animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      <div className="overflow-visible">
        <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
          <thead className="bg-slate-50/50 dark:bg-slate-800/30">
            <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <th className={cn("px-4 w-16 text-center", compactView ? "py-1.5" : "py-2")}>Active</th>
              <th className={cn("px-4 w-16 text-center", compactView ? "py-1.5" : "py-2")}>Day</th>
              <th className={cn("px-4", compactView ? "py-1.5" : "py-2")}>Description</th>
              <th className={cn("px-4 w-32", compactView ? "py-1.5" : "py-2")}>Amount</th>
              <th className={cn("px-4 w-48", compactView ? "py-1.5" : "py-2")}>Account</th>
              <th className={cn("px-4 w-48", compactView ? "py-1.5" : "py-2")}>Category</th>
              <th className={cn("px-4 w-40", compactView ? "py-1.5" : "py-2")}>Next Execution</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {/* Existing Templates */}
            {displayRecurring.map((t, rowIndex) => (
              <RecurringRow
                key={t.id}
                t={t}
                rowIndex={rowIndex}
                activeCell={activeCell}
                setActiveCell={setActiveCell}
                handleCellClick={handleCellClick}
                handleKeyDown={handleKeyDown}
                handleUpdate={handleUpdate}
                handleDelete={handleDelete}
                deletingId={deletingId}
                setDeletingId={setDeletingId}
                compactView={compactView}
                categories={categories}
                accounts={accounts}
                formatCurrency={formatCurrency}
                numberFormat={numberFormat}
              />
            ))}

            {/* New Template Row */}
            <tr className={cn(
              "bg-blue-50/30 dark:bg-blue-900/10 group transition-colors",
              activeCell?.id === 'new' && "bg-blue-50/50 dark:bg-blue-900/20 z-20 relative"
            )}>
              <td className={cn("px-4 text-center", compactView ? "py-1" : "py-2")}>
                <button 
                  onClick={() => setNewTemplate(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={cn(
                    "p-1 rounded transition-colors",
                    newTemplate.is_active ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-rose-600 bg-rose-50 dark:bg-rose-900/20"
                  )}
                >
                  {newTemplate.is_active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </button>
              </td>
              <td 
                className={cn(
                  "px-4",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 1 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
                )}
                onClick={() => handleCellClick('new', 1)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 1 ? (
                  <input
                    key="new-day"
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    className="w-full bg-transparent border-none p-0 text-sm focus:outline-none dark:text-slate-100 text-center"
                    value={newTemplate.day_of_month || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      const day = val === '' ? 1 : parseInt(val);
                      const clampedDay = Math.max(1, Math.min(31, day));
                      setNewTemplate(prev => ({ 
                        ...prev, 
                        day_of_month: clampedDay,
                        next_execution_date: calculateNextExecution(clampedDay)
                      }));
                    }}
                    onBlur={() => setActiveCell(null)}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 1)}
                  />
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400 text-center block">{newTemplate.day_of_month || '-'}</span>
                )}
              </td>
              <td 
                className={cn(
                  "px-4",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 2 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
                )}
                onClick={() => handleCellClick('new', 2)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 2 ? (
                  <TextInput
                    key="new-description"
                    autoFocus
                    placeholder="Description"
                    value={newTemplate.description || ''}
                    onChange={(val) => setNewTemplate(prev => ({ ...prev, description: val }))}
                    onBlur={() => setActiveCell(null)}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 2)}
                  />
                ) : (
                  <span className="text-sm text-slate-400 dark:text-slate-500 italic">{newTemplate.description || 'Add description...'}</span>
                )}
              </td>
              <td 
                className={cn(
                  "px-4",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 3 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
                )}
                onClick={() => handleCellClick('new', 3)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 3 ? (
                  <AmountInput
                    key="new-amount"
                    autoFocus
                    value={newTemplate.amount || 0}
                    onChange={(val) => setNewTemplate(prev => ({ ...prev, amount: val }))}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 3)}
                    onBlur={() => setActiveCell(null)}
                    numberFormat={numberFormat}
                    className="text-right"
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-400 dark:text-slate-500 text-right block">{formatCurrency(newTemplate.amount || 0)}</span>
                )}
              </td>
              <td 
                className={cn(
                  "px-4",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 4 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
                )}
                onClick={() => handleCellClick('new', 4)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 4 ? (
                  <TypeAheadSelect
                    key="new-account"
                    autoFocus
                    options={accounts.map(a => ({ 
                      id: a.id!, 
                      name: a.name,
                      icon: <Wallet className="w-4 h-4" />
                    }))}
                    value={newTemplate.account_id}
                    onChange={(id) => setNewTemplate(prev => ({ ...prev, account_id: id }))}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 4)}
                    onBlur={() => setActiveCell(null)}
                  />
                ) : (
                  <span className="text-sm text-slate-400 dark:text-slate-500">{accounts.find(a => a.id === newTemplate.account_id)?.name || 'Select Account'}</span>
                )}
              </td>
              <td 
                className={cn(
                  "px-4",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 5 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
                )}
                onClick={() => handleCellClick('new', 5)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 5 ? (
                  <TypeAheadSelect
                    key="new-category"
                    autoFocus
                    options={categories.map(c => ({ 
                      id: c.id!, 
                      name: c.name,
                      icon: c.icon ? ICON_MAP[c.icon] : <Tag className="w-4 h-4" />
                    }))}
                    value={newTemplate.category_id}
                    onChange={(id) => setNewTemplate(prev => ({ ...prev, category_id: id }))}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 5)}
                    onBlur={() => setActiveCell(null)}
                  />
                ) : (
                  <span className="text-sm text-slate-400 dark:text-slate-500">{categories.find(c => c.id === newTemplate.category_id)?.name || 'Select Category'}</span>
                )}
              </td>
              <td className={cn("px-4", compactView ? "py-1" : "py-2")}>
                <span className="text-sm text-slate-400 dark:text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {isValid(parseISO(newTemplate.next_execution_date || '')) ? format(parseISO(newTemplate.next_execution_date!), 'dd.MM.yyyy') : '-'}
                </span>
              </td>
              <td className={cn("px-2 text-center", compactView ? "py-1" : "py-2")}>
                <button onClick={handleAdd} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                  <Check className="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
