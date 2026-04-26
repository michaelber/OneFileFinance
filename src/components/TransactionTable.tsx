import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction, type Account, type Category } from '../db';
import { format, parseISO, isValid, parse } from 'date-fns';
import { Check, X, Plus, Trash2, Search, Filter, ArrowUpDown, ChevronDown, AlertCircle, Tag, Repeat } from 'lucide-react';
import { cn } from '../lib/utils';
import { ICON_MAP } from '../constants';

import { formatAmount, getDecimalSeparator, parseAmount } from '../lib/formatters';

interface TransactionTableProps {
  accountId?: number;
  homeCurrency: string;
  numberFormat: string;
  accountBalance: number;
  newTransactionIds?: number[];
}

interface TypeAheadSelectProps {
  options: { id: number; name: string; icon?: React.ReactNode }[];
  value?: number;
  onChange: (id: number | undefined) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  key?: string;
}

export function TypeAheadSelect({ options, value, onChange, onKeyDown, onFocus, onBlur, placeholder, className, autoFocus }: TypeAheadSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 240; // max-h-60 is 240px

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setCoords({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: rect.width
        });
      } else {
        setCoords({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    } else {
      setCoords(null);
    }
  }, [isOpen]);

  const selectedOption = options.find(o => o.id === value);
  const displayValue = isOpen ? search : (selectedOption?.name || '');

  const filteredOptions = options.filter(o => 
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (id: number | undefined) => {
    onChange(id);
    setIsOpen(false);
  };

  const handleKeyDownLocal = (e: React.KeyboardEvent) => {
    const maxIndex = search === '' ? filteredOptions.length : filteredOptions.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex(prev => (prev + 1) % (maxIndex + 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + (maxIndex + 1)) % (maxIndex + 1));
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      if (search === '') {
        if (highlightedIndex === 0) {
          handleSelect(undefined);
        } else {
          handleSelect(filteredOptions[highlightedIndex - 1].id);
        }
      } else {
        handleSelect(filteredOptions[highlightedIndex].id);
      }
      // After selection, move to next column
      if (onKeyDown) {
        const simulatedEvent = { 
          ...e, 
          key: 'ArrowRight',
          preventDefault: () => e.preventDefault(),
          stopPropagation: () => e.stopPropagation()
        };
        onKeyDown(simulatedEvent as any);
      }
    } else if (e.key === 'ArrowRight') {
      if (!isOpen) {
        if (onKeyDown) onKeyDown(e);
      }
    } else if (e.key === 'ArrowLeft') {
      if (!isOpen) {
        if (onKeyDown) onKeyDown(e);
      }
    } else if (e.key === 'Tab') {
      if (isOpen && filteredOptions.length > 0) {
        e.preventDefault();
        handleSelect(filteredOptions[0].id);
        // Parent will handle Tab to move next column if we don't prevent default on the original event
        // But we did prevent default above. So we should call parent onKeyDown.
        if (onKeyDown) onKeyDown(e);
      } else if (onKeyDown) {
        onKeyDown(e);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      } else if (onKeyDown) {
        onKeyDown(e);
      }
    } else if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className={cn("relative w-full group/select", className)} ref={containerRef}>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        type="text"
        className="w-full bg-transparent border-none p-0 pr-7 text-sm focus:outline-none dark:text-slate-100"
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          setSearch('');
          setHighlightedIndex(0);
          onFocus?.();
        }}
        onBlur={(e) => {
          // If the focus is moving to something else inside the same select (like the scrollbar), don't close
          if (containerRef.current?.contains(e.relatedTarget as Node)) {
            return;
          }
          setIsOpen(false);
          onBlur?.();
        }}
        onKeyDown={handleKeyDownLocal}
      />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent input blur
          e.stopPropagation();
          if (!isOpen) {
            setSearch('');
            setHighlightedIndex(0);
            updateCoords(); // Calculate immediately before opening
          }
          setIsOpen(!isOpen);
          if (!isOpen) inputRef.current?.focus();
        }}
        className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && coords && createPortal(
        <div 
          className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-[9999] max-h-60 overflow-y-auto py-1"
          style={{ 
            top: coords.top, 
            bottom: coords.bottom,
            left: coords.left, 
            width: Math.max(coords.width, 200) 
          }}
        >
          {search === '' && (
            <div
              className={cn(
                "px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-300",
                highlightedIndex === 0 && "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              )}
              onMouseDown={() => handleSelect(undefined)}
              onMouseEnter={() => setHighlightedIndex(0)}
            >
              {placeholder || 'None'}
            </div>
          )}
          {filteredOptions.map((o, index) => (
            <div
              key={o.id}
              className={cn(
                "px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center gap-2",
                highlightedIndex === (search === '' ? index + 1 : index) && "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              )}
              onMouseDown={() => handleSelect(o.id)}
              onMouseEnter={() => setHighlightedIndex(search === '' ? index + 1 : index)}
            >
              {o.icon}
              <span className="truncate">{o.name}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export function DateInput({ value, onChange, onKeyDown, onFocus, onBlur, autoFocus, className }: { 
  value: string; 
  onChange: (val: string) => void; 
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  className?: string;
  key?: string;
}) {
  const formatToDisplay = (val: string) => isValid(parseISO(val)) ? format(parseISO(val), 'dd.MM.yyyy') : val;
  const [inputValue, setInputValue] = useState(() => formatToDisplay(value));

  useEffect(() => {
    setInputValue(formatToDisplay(value));
  }, [value]);

  const handleCommit = (val: string) => {
    const parsed = parse(val, 'dd.MM.yyyy', new Date());
    if (isValid(parsed)) {
      const newValue = format(parsed, 'yyyy-MM-dd');
      if (newValue !== value) {
        onChange(newValue);
      }
    }
  };

  const handleBlur = () => {
    handleCommit(inputValue);
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      handleCommit(inputValue);
    }
    onKeyDown(e);
  };

  return (
    <input
      autoFocus={autoFocus}
      type="text"
      className={cn("w-full bg-transparent border-none p-0 text-sm focus:outline-none dark:text-slate-100", className)}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onFocus={onFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="dd.mm.yyyy"
    />
  );
}

export function AmountInput({ value, onChange, onKeyDown, onFocus, onBlur, autoFocus, className, numberFormat }: {
  value: number;
  onChange: (val: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  className?: string;
  numberFormat?: string;
  key?: string;
}) {
  const decimalSeparator = getDecimalSeparator(numberFormat || 'default');
  const formatToDisplay = (val: number) => val === 0 ? '' : val.toString().replace('.', decimalSeparator);
  const [inputValue, setInputValue] = useState(() => formatToDisplay(value));

  useEffect(() => {
    setInputValue(formatToDisplay(value));
  }, [value, decimalSeparator]);

  const handleCommit = (val: string) => {
    const parsed = parseAmount(val, numberFormat || 'default');
    if (parsed !== value) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    handleCommit(inputValue);
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      handleCommit(inputValue);
    }
    onKeyDown(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.,-]/g, '');
    const dots = (val.match(/\./g) || []).length;
    const commas = (val.match(/,/g) || []).length;
    if (dots + commas > 1) return;
    setInputValue(val);
  };

  return (
    <input
      autoFocus={autoFocus}
      type="text"
      inputMode="decimal"
      className={cn("w-full bg-transparent border-none p-0 text-sm focus:outline-none font-semibold", className)}
      value={inputValue}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

export function TextInput({ value, onChange, onKeyDown, onBlur, autoFocus, className, placeholder }: {
  value: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  autoFocus?: boolean;
  className?: string;
  placeholder?: string;
  key?: string;
}) {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleCommit = (val: string) => {
    if (val !== value) {
      onChange(val);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    handleCommit(inputValue);
    onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      handleCommit(inputValue);
    }
    onKeyDown(e);
  };

  return (
    <input
      autoFocus={autoFocus}
      type="text"
      className={cn("w-full bg-transparent border-none p-0 text-sm focus:outline-none font-medium dark:text-slate-100", className)}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onBlur={handleBlur}
      onFocus={() => {}}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
    />
  );
}

interface TransactionRowProps {
  t: Transaction;
  rowIndex: number;
  activeCell: { id: number | 'new'; col: number } | null;
  handleCellClick: (id: number | 'new', col: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, id: number | 'new', col: number) => void;
  handleUpdateField: (id: number, field: keyof Transaction, value: any) => void;
  handleDelete: (id: number) => void;
  deletingId: number | null;
  setDeletingId: (id: number | null) => void;
  compactView: boolean;
  categories: Category[] | undefined;
  accounts: Account[] | undefined;
  formatCurrency: (amount: number) => string;
  numberFormat: string;
  isNewTransaction?: boolean;
  isSelected: boolean;
  onSelect: (id: number, shiftKey: boolean, isDrag?: boolean) => void;
  isDragging: boolean;
  onDragStart: () => void;
}

const TransactionRow = React.memo(({
  t,
  rowIndex,
  activeCell,
  handleCellClick,
  handleKeyDown,
  handleUpdateField,
  handleDelete,
  deletingId,
  setDeletingId,
  compactView,
  categories,
  accounts,
  formatCurrency,
  numberFormat,
  isNewTransaction,
  isSelected,
  onSelect,
  isDragging,
  onDragStart
}: TransactionRowProps) => {
  const [optimisticT, setOptimisticT] = useState(t);

  useEffect(() => {
    setOptimisticT(t);
  }, [t]);

  const onUpdate = (field: keyof Transaction, value: any) => {
    setOptimisticT(prev => ({ ...prev, [field]: value }));
    handleUpdateField(t.id!, field, value);
  };

  return (
    <tr 
      className={cn(
        "group hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors",
        activeCell?.id === t.id && "bg-blue-50/10 dark:bg-blue-900/10 z-20 relative",
        isNewTransaction && "bg-emerald-50 dark:bg-emerald-900/20",
        isSelected && "bg-blue-50/30 dark:bg-blue-900/20"
      )}
    >
      <td 
        className={cn("px-4 border-r border-transparent cursor-pointer", compactView ? "py-1" : "py-2")}
        onMouseDown={(e) => {
          if (e.button !== 0) return; // Only left click
          e.preventDefault(); // Prevent text selection
          onSelect(t.id!, e.shiftKey);
          onDragStart();
        }}
        onMouseEnter={() => {
          if (isDragging) {
            onSelect(t.id!, false, true);
          }
        }}
      >
        <input 
          type="checkbox" 
          checked={isSelected} 
          readOnly 
          className="pointer-events-none w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
      {/* Date Cell */}
      <td 
        className={cn(
          "px-4 border-r border-transparent transition-all",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 0 && "ring-2 ring-inset ring-blue-500 z-10"
        )}
        onClick={() => handleCellClick(t.id!, 0)}
      >
        {activeCell?.id === t.id && activeCell?.col === 0 ? (
          <DateInput
            key={`${t.id}-date`}
            autoFocus
            value={optimisticT.date}
            onChange={(val) => onUpdate('date', val)}
            onKeyDown={(e) => handleKeyDown(e, t.id!, 0)}
            onBlur={() => handleCellClick(-2, -2)}
            className="dark:text-slate-100"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {isValid(parseISO(optimisticT.date)) ? format(parseISO(optimisticT.date), 'dd.MM.yyyy') : optimisticT.date}
            </span>
            {optimisticT.external_id?.startsWith('recurring_') && (
              <Repeat className="w-3.5 h-3.5 text-blue-500 shrink-0" title="Created by recurring transaction" />
            )}
          </div>
        )}
      </td>

      {/* Description Cell */}
      <td 
        className={cn(
          "px-4 border-r border-transparent transition-all",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 1 && "ring-2 ring-inset ring-blue-500 z-10"
        )}
        onClick={() => handleCellClick(t.id!, 1)}
      >
        {activeCell?.id === t.id && activeCell?.col === 1 ? (
          <TextInput
            key={`${t.id}-description`}
            autoFocus
            value={optimisticT.description}
            onChange={(val) => onUpdate('description', val)}
            onKeyDown={(e) => handleKeyDown(e, t.id!, 1)}
            onBlur={() => handleCellClick(-2, -2)}
          />
        ) : (
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate block">
            {optimisticT.description || <span className="text-slate-300 dark:text-slate-700 italic">No description</span>}
          </span>
        )}
      </td>

      {/* Amount Cell */}
      <td 
        className={cn(
          "px-4 border-r border-transparent transition-all text-right",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 2 && "ring-2 ring-inset ring-blue-500 z-10"
        )}
        onClick={() => handleCellClick(t.id!, 2)}
      >
        {activeCell?.id === t.id && activeCell?.col === 2 ? (
          <AmountInput
            key={`${t.id}-amount`}
            autoFocus
            value={optimisticT.amount}
            onChange={(val) => onUpdate('amount', val)}
            onKeyDown={(e) => handleKeyDown(e, t.id!, 2)}
            onBlur={() => handleCellClick(-2, -2)}
            numberFormat={numberFormat}
            className={cn(
              "text-right",
              optimisticT.amount < 0 ? "text-rose-600" : optimisticT.amount > 0 ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"
            )}
          />
        ) : (
          <span className={cn(
            "text-sm font-semibold",
            optimisticT.amount < 0 ? "text-rose-600" : optimisticT.amount > 0 ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"
          )}>
            {formatCurrency(optimisticT.amount)}
          </span>
        )}
      </td>

      {/* Category Cell */}
      <td 
        className={cn(
          "px-4 border-r border-transparent transition-all",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 3 && "ring-2 ring-inset ring-blue-500 z-10"
        )}
        onClick={() => handleCellClick(t.id!, 3)}
      >
        {activeCell?.id === t.id && activeCell?.col === 3 ? (
          <TypeAheadSelect
            autoFocus
            options={categories?.map(c => ({ 
              id: c.id!, 
              name: c.name,
              icon: c.icon ? ICON_MAP[c.icon] : <Tag className="w-4 h-4" />
            })) || []}
            value={optimisticT.category_id}
            onChange={(id) => onUpdate('category_id', id)}
            onKeyDown={(e) => handleKeyDown(e, t.id!, 3)}
            onBlur={() => handleCellClick(-2, -2)}
            placeholder="No Category"
            className="dark:text-slate-100"
          />
        ) : (
          <div className="relative group/cell cursor-pointer w-full h-full min-h-[1.25rem] flex items-center gap-2">
            {(() => {
              const cat = categories?.find(c => c.id === optimisticT.category_id);
              return (
                <>
                  <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">
                    {cat?.icon ? ICON_MAP[cat.icon] : <Tag className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 truncate block pr-6">
                    {cat?.name || '-'}
                  </span>
                </>
              );
            })()}
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover/cell:text-slate-400 transition-colors" />
          </div>
        )}
      </td>

      {/* Account Cell */}
      <td 
        className={cn(
          "px-4 border-r border-transparent transition-all",
          compactView ? "py-1" : "py-2",
          activeCell?.id === t.id && activeCell?.col === 4 && "ring-2 ring-inset ring-blue-500 z-10"
        )}
        onClick={() => handleCellClick(t.id!, 4)}
      >
        {activeCell?.id === t.id && activeCell?.col === 4 ? (
          <TypeAheadSelect
            autoFocus
            options={accounts?.map(a => ({ id: a.id!, name: a.name })) || []}
            value={optimisticT.account_id}
            onChange={(id) => onUpdate('account_id', id)}
            onKeyDown={(e) => handleKeyDown(e, t.id!, 4)}
            onBlur={() => handleCellClick(-2, -2)}
            placeholder="Select Account"
            className="dark:text-slate-100"
          />
        ) : (
          <div className="relative group/cell cursor-pointer w-full h-full min-h-[1.25rem]">
            <span className="text-sm text-slate-500 dark:text-slate-400 truncate block pr-8">
              {accounts?.find(a => a.id === optimisticT.account_id)?.name || '-'}
            </span>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover/cell:text-slate-400 transition-colors" />
          </div>
        )}
      </td>

      <td className="px-4 py-1 text-center">
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

export function TransactionTable({ accountId, homeCurrency, numberFormat, accountBalance, newTransactionIds }: TransactionTableProps) {
  const transactions = useLiveQuery(
    () => {
      let query = db.transactions.orderBy('date').reverse();
      if (accountId) {
        return db.transactions.where('account_id').equals(accountId).reverse().sortBy('date');
      }
      return query.toArray();
    },
    [accountId]
  );

  const accounts = useLiveQuery(() => db.accounts.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const categoryRules = useLiveQuery(() => db.category_rules.orderBy('priority').toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray());
  const compactView = settings?.find(s => s.key === 'compactView')?.value ?? true;

  const uncategorizedCount = transactions?.filter(t => !t.category_id).length || 0;

  const [activeCell, setActiveCell] = useState<{ id: number | 'new'; col: number } | null>(null);
  const [focusSource, setFocusSource] = useState<'mouse' | 'keyboard' | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUncategorizedOnly, setShowUncategorizedOnly] = useState(false);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(100);

  useEffect(() => {
    setVisibleCount(100);
  }, [accountId]);

  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    description: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    category_id: undefined,
    account_id: accountId || undefined
  });
  
  const newTransactionRef = useRef(newTransaction);

  const handleNewTransactionChange = (updates: Partial<Transaction>) => {
    const next = { ...newTransactionRef.current, ...updates };
    newTransactionRef.current = next;
    setNewTransaction(next);
  };

  useEffect(() => {
    handleNewTransactionChange({ account_id: accountId || undefined });
  }, [accountId]);
  const tableRef = useRef<HTMLTableElement>(null);

  const columns = ['date', 'description', 'amount', 'category_id', 'account_id'] as const;

  const filteredTransactions = transactions?.filter(t => {
    if (showUncategorizedOnly && t.category_id) return false;
    const descMatch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const categoryName = categories?.find(c => c.id === t.category_id)?.name || '';
    const categoryMatch = categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    return descMatch || categoryMatch;
  }) || [];

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);

  const displayedBalance = (searchQuery || showUncategorizedOnly)
    ? filteredTransactions.reduce((sum, t) => sum + t.amount, 0)
    : accountBalance;

  const formatCurrency = (amount: number) => {
    return formatAmount(amount, homeCurrency, numberFormat);
  };

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSelect = (id: number, shiftKey: boolean, isDrag: boolean = false) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      
      if (shiftKey && lastSelectedId !== null) {
        const currentIndex = filteredTransactions.findIndex(t => t.id === id);
        const lastIndex = filteredTransactions.findIndex(t => t.id === lastSelectedId);
        
        if (currentIndex !== -1 && lastIndex !== -1) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);
          
          for (let i = start; i <= end; i++) {
            next.add(filteredTransactions[i].id!);
          }
        }
      } else if (isDrag) {
        next.add(id);
      } else {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      
      return next;
    });
    
    if (!isDrag) {
      setLastSelectedId(id);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredTransactions.map(t => t.id!)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBatchDelete = async () => {
    setShowBatchDeleteConfirm(true);
  };

  const confirmBatchDelete = async () => {
    await db.transactions.bulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowBatchDeleteConfirm(false);
  };

  const handleBatchUpdateCategory = async (categoryId: number | undefined) => {
    if (categoryId === undefined) return;
    await db.transaction('rw', db.transactions, async () => {
      for (const id of selectedIds) {
        await db.transactions.update(id, { category_id: categoryId, updated_at: Date.now() });
      }
    });
    setSelectedIds(new Set());
  };

  const handleBatchMoveAccount = async (accountId: number | undefined) => {
    if (accountId === undefined) return;
    await db.transaction('rw', db.transactions, async () => {
      for (const id of selectedIds) {
        await db.transactions.update(id, { account_id: accountId, updated_at: Date.now() });
      }
    });
    setSelectedIds(new Set());
  };

  const handleCellClick = (id: number | 'new', colIndex: number) => {
    if (activeCell?.id === id && activeCell?.col === colIndex) return;
    setFocusSource('mouse');
    setActiveCell({ id, col: colIndex });
  };

  const prevActiveCellRef = useRef<{ id: number | 'new'; col: number } | null>(null);

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

  const handleUpdateField = async (id: number, field: keyof Transaction, value: any) => {
    const updates: Partial<Transaction> = {
      [field]: value,
      updated_at: Date.now()
    };

    if (field === 'description') {
      const rules = await db.category_rules.orderBy('priority').toArray();
      for (const rule of rules) {
        if (String(value).toLowerCase().includes(rule.search_value.toLowerCase())) {
          updates.category_id = rule.category_id;
          break;
        }
      }
    }

    await db.transactions.update(id, updates);
  };

  const handleCreateTransaction = async () => {
    const tx = newTransactionRef.current;
    const finalAccountID = tx.account_id || accountId;

    if (!tx.description || !tx.amount || !tx.date || !finalAccountID) {
      setErrorNotification('Description, Amount, Date and Account are mandatory.');
      setTimeout(() => setErrorNotification(null), 3000);
      return;
    }
    
    await db.transactions.add({
      description: tx.description.trim(),
      amount: tx.amount,
      date: tx.date,
      account_id: finalAccountID,
      category_id: tx.category_id,
      updated_at: Date.now()
    } as Transaction);

    const resetTx = {
      description: '',
      amount: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      category_id: undefined,
      account_id: accountId || undefined
    };
    newTransactionRef.current = resetTx;
    setNewTransaction(resetTx);
  };

  const applyAutoCategorization = async (description: string) => {
    if (!description || newTransaction.category_id) return;
    const rules = await db.category_rules.orderBy('priority').toArray();
    const match = rules.find(r => description.toLowerCase().includes(r.search_value.toLowerCase()));
    if (match) {
      setNewTransaction(prev => ({ ...prev, category_id: match.category_id }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: number | 'new', colIndex: number) => {
    const target = e.target as HTMLInputElement;
    const isNewRowFilled = newTransaction.description.trim() !== '' || (newTransaction.amount !== 0 && newTransaction.amount !== undefined);
    const rowIndex = id === 'new' ? -1 : filteredTransactions.findIndex(t => t.id === id);

    // Auto-categorization trigger when leaving description field in new row
    if (id === 'new' && colIndex === 1 && (['Tab', 'Enter', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(e.key))) {
      applyAutoCategorization(newTransaction.description);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (id === 'new' && isNewRowFilled) {
        handleCreateTransaction();
      } else if (id !== 'new') {
        setFocusSource('keyboard');
        if (rowIndex > 0) {
          setActiveCell({ id: filteredTransactions[rowIndex - 1].id!, col: colIndex });
        } else {
          setActiveCell({ id: 'new', col: colIndex });
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (id === 'new') {
        if (isNewRowFilled) {
          e.preventDefault();
          handleCreateTransaction();
          setFocusSource('keyboard');
          setActiveCell({ id: 'new', col: 1 });
        } else if (filteredTransactions.length > 0) {
          e.preventDefault();
          setFocusSource('keyboard');
          setActiveCell({ id: filteredTransactions[0].id!, col: colIndex });
        }
      } else if (rowIndex < filteredTransactions.length - 1) {
        e.preventDefault();
        setFocusSource('keyboard');
        setActiveCell({ id: filteredTransactions[rowIndex + 1].id!, col: colIndex });
      }
    } else if (e.key === 'ArrowLeft') {
      const isSelectLike = columns[colIndex] === 'category_id' || columns[colIndex] === 'account_id';
      const isAtStart = target.selectionStart === 0;
      
      if (isSelectLike || isAtStart || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex > 0) {
          e.preventDefault();
          setFocusSource('keyboard');
          setActiveCell({ id, col: colIndex - 1 });
        } else if (id !== 'new') {
          e.preventDefault();
          setFocusSource('keyboard');
          if (rowIndex > 0) {
            setActiveCell({ id: filteredTransactions[rowIndex - 1].id!, col: columns.length - 1 });
          } else {
            setActiveCell({ id: 'new', col: columns.length - 1 });
          }
        }
      }
    } else if (e.key === 'ArrowRight') {
      const isSelectLike = columns[colIndex] === 'category_id' || columns[colIndex] === 'account_id';
      const isAtEnd = target.selectionEnd === (target.value?.length || 0);

      if (isSelectLike || isAtEnd || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex < columns.length - 1) {
          e.preventDefault();
          setFocusSource('keyboard');
          setActiveCell({ id, col: colIndex + 1 });
        } else if (id !== 'new' && rowIndex < filteredTransactions.length - 1) {
          e.preventDefault();
          setFocusSource('keyboard');
          setActiveCell({ id: filteredTransactions[rowIndex + 1].id!, col: 0 });
        } else if (id === 'new') {
          e.preventDefault();
          setFocusSource('keyboard');
          if (isNewRowFilled) {
            handleCreateTransaction();
            setActiveCell({ id: 'new', col: 1 });
          } else if (filteredTransactions.length > 0) {
            setActiveCell({ id: filteredTransactions[0].id!, col: 0 });
          }
        }
      }
    } else if (e.key === 'Enter') {
      if (id === 'new') {
        handleCreateTransaction();
        setFocusSource('keyboard');
        setActiveCell({ id: 'new', col: 1 });
      } else {
        e.preventDefault();
        setFocusSource('keyboard');
        if (rowIndex < filteredTransactions.length - 1) {
          setActiveCell({ id: filteredTransactions[rowIndex + 1].id!, col: colIndex });
        } else {
          setActiveCell({ id: 'new', col: colIndex });
        }
      }
    } else if (e.key === 'Escape') {
      if (id === 'new') {
        const resetTx = {
          date: format(new Date(), 'yyyy-MM-dd'),
          description: '',
          amount: 0,
          category_id: undefined,
          account_id: accountId || undefined
        };
        newTransactionRef.current = resetTx;
        setNewTransaction(resetTx);
      }
      setActiveCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setFocusSource('keyboard');
      if (e.shiftKey) {
        if (colIndex > 0) {
          setActiveCell({ id, col: colIndex - 1 });
        } else if (id !== 'new') {
          if (rowIndex > 0) {
            setActiveCell({ id: filteredTransactions[rowIndex - 1].id!, col: columns.length - 1 });
          } else {
            setActiveCell({ id: 'new', col: columns.length - 1 });
          }
        }
      } else {
        if (colIndex < columns.length - 1) {
          setActiveCell({ id, col: colIndex + 1 });
        } else if (id === 'new') {
          if (isNewRowFilled) {
            handleCreateTransaction();
            setActiveCell({ id: 'new', col: 1 });
          } else if (filteredTransactions.length > 0) {
            setActiveCell({ id: filteredTransactions[0].id!, col: 0 });
          }
        } else if (rowIndex < filteredTransactions.length - 1) {
          setActiveCell({ id: filteredTransactions[rowIndex + 1].id!, col: 0 });
        }
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await db.transactions.delete(id);
      setDeletingId(null);
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  const handleDescriptionBlur = (e: React.FocusEvent) => {
    // Check if the next focused element is within the table
    const nextTarget = e.relatedTarget as HTMLElement;
    const isInsideTable = tableRef.current?.contains(nextTarget);
    if (!isInsideTable) setActiveCell(null);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Transactions</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to delete {selectedIds.size} selected transactions? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBatchDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300 relative">
        {errorNotification && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-bounce">
            <div className="bg-rose-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold">
              <AlertCircle className="w-4 h-4" />
              {errorNotification}
            </div>
          </div>
        )}
        
        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-4 w-full">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
              {selectedIds.size} selected
            </span>
            <button 
              onClick={handleBatchDelete} 
              className="px-3 py-1.5 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <div className="w-64">
               <TypeAheadSelect 
                 options={categories?.map(c => ({ id: c.id!, name: c.name, icon: ICON_MAP[c.icon] })) || []}
                 placeholder="Batch update category..." 
                 onChange={handleBatchUpdateCategory} 
               />
            </div>
            <div className="w-64">
               <TypeAheadSelect 
                 options={accounts?.map(a => ({ id: a.id!, name: a.name })) || []}
                 placeholder="Move to account..." 
                 onChange={handleBatchMoveAccount} 
               />
            </div>
            <button 
              onClick={() => setSelectedIds(new Set())} 
              className="ml-auto px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-6 flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="text-xs font-medium text-slate-400">
                {filteredTransactions.length} transactions
              </div>
            </div>

            <div className="flex items-center ml-auto">
              {/* Aligned with Amount column (w-32) */}
              <div className="w-32 flex flex-col items-end px-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Balance</span>
                <span className={cn(
                  "text-lg font-bold leading-none",
                  displayedBalance < 0 ? "text-rose-600" : displayedBalance > 0 ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"
                )}>
                  {formatCurrency(displayedBalance)}
                </span>
              </div>

              {/* Aligned with Category column (w-56) */}
              <div className="w-56 flex flex-col items-start px-4">
                {uncategorizedCount > 0 && (
                  <div 
                    className={cn(
                      "animate-pulse flex flex-col items-start cursor-pointer transition-opacity hover:opacity-80",
                      showUncategorizedOnly && "opacity-100 animate-none ring-1 ring-rose-500/50 rounded p-1 -m-1"
                    )}
                    onClick={() => {
                      setShowUncategorizedOnly(!showUncategorizedOnly);
                      if (!showUncategorizedOnly) setSearchQuery(''); // Clear search when filtering uncategorized
                    }}
                    title={showUncategorizedOnly ? "Show all transactions" : "Filter uncategorized"}
                  >
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider leading-none mb-1">Uncategorized</span>
                    <div className="flex items-center gap-1 text-rose-600">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="text-sm font-bold leading-none">{uncategorizedCount}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Spacer for Account (w-40) and Actions (w-16) columns */}
              <div className="w-56"></div>
            </div>
          </>
        )}
      </div>

      <div className="overflow-auto flex-1">
        <table ref={tableRef} className="w-full text-left border-collapse min-w-[800px] table-fixed">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 transition-colors duration-300">
            <tr className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <th className={cn("px-4 w-12", compactView ? "py-1.5" : "py-3")}>
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th className={cn("px-4 w-32", compactView ? "py-1.5" : "py-3")}>Date</th>
              <th className={cn("px-4", compactView ? "py-1.5" : "py-3")}>Description</th>
              <th className={cn("px-4 w-32 text-right", compactView ? "py-1.5" : "py-3")}>Amount</th>
              <th className={cn("px-4 w-56", compactView ? "py-1.5" : "py-3")}>Category</th>
              <th className={cn("px-4 w-40", compactView ? "py-1.5" : "py-3")}>Account</th>
              <th className={cn("px-4 w-16 text-center", compactView ? "py-1.5" : "py-3")}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr className={cn("bg-blue-50/30 dark:bg-blue-900/10", activeCell?.row === -1 && "bg-blue-50/50 dark:bg-blue-900/20")}>
              <td className="px-4"></td>
              <td 
                className={cn(
                  "px-4 border-r border-transparent transition-all",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 0 && "ring-2 ring-inset ring-blue-500 z-10"
                )}
                onClick={() => handleCellClick('new', 0)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 0 ? (
                  <DateInput
                    key="new-date"
                    autoFocus
                    value={newTransaction.date || ''}
                    onChange={(val) => handleNewTransactionChange({ date: val })}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 0)}
                    onBlur={() => setActiveCell(null)}
                    className="dark:text-slate-100"
                  />
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {isValid(parseISO(newTransaction.date)) ? format(parseISO(newTransaction.date), 'dd.MM.yyyy') : 'Select Date'}
                  </span>
                )}
              </td>
              <td 
                className={cn(
                  "px-4 border-r border-transparent transition-all",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 1 && "ring-2 ring-inset ring-blue-500 z-10"
                )}
                onClick={() => handleCellClick('new', 1)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 1 ? (
                  <TextInput
                    key="new-description"
                    autoFocus
                    placeholder="New transaction..."
                    value={newTransaction.description || ''}
                    onChange={(val) => {
                      let category_id = newTransactionRef.current.category_id;
                      if (!category_id && val) {
                        for (const rule of categoryRules) {
                          if (val.toLowerCase().includes(rule.search_value.toLowerCase())) {
                            category_id = rule.category_id;
                            break;
                          }
                        }
                      }
                      handleNewTransactionChange({ description: val, category_id });
                    }}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 1)}
                    onBlur={(e) => handleDescriptionBlur(e)}
                  />
                ) : (
                  <span className={cn(
                    "text-sm font-medium truncate block",
                    !newTransaction.description ? "text-slate-400" : "text-slate-900 dark:text-slate-100"
                  )}>
                    {newTransaction.description || 'New transaction...'}
                  </span>
                )}
              </td>
              <td 
                className={cn(
                  "px-4 border-r border-transparent transition-all text-right",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 2 && "ring-2 ring-inset ring-blue-500 z-10"
                )}
                onClick={() => handleCellClick('new', 2)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 2 ? (
                  <AmountInput
                    key="new-amount"
                    autoFocus
                    value={newTransaction.amount || 0}
                    onChange={(val) => handleNewTransactionChange({ amount: val })}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 2)}
                    onBlur={() => setActiveCell(null)}
                    numberFormat={numberFormat}
                    className={cn(
                      "text-right",
                      (newTransaction.amount || 0) < 0 ? "text-rose-600" : (newTransaction.amount || 0) > 0 ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"
                    )}
                  />
                ) : (
                  <span className={cn(
                    "text-sm font-semibold",
                    (newTransaction.amount || 0) < 0 ? "text-rose-600" : (newTransaction.amount || 0) > 0 ? "text-emerald-600" : "text-slate-400"
                  )}>
                    {newTransaction.amount !== 0 ? formatCurrency(newTransaction.amount) : '0.00'}
                  </span>
                )}
              </td>
              <td 
                className={cn(
                  "px-4 border-r border-transparent transition-all",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 3 && "ring-2 ring-inset ring-blue-500 z-10"
                )}
                onClick={() => handleCellClick('new', 3)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 3 ? (
                  <TypeAheadSelect
                    key="new-category"
                    autoFocus
                    options={categories?.map(c => ({ 
                      id: c.id!, 
                      name: c.name,
                      icon: c.icon ? ICON_MAP[c.icon] : <Tag className="w-4 h-4" />
                    })) || []}
                    value={newTransaction.category_id}
                    onChange={(id) => handleNewTransactionChange({ category_id: id })}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 3)}
                    onBlur={() => setActiveCell(null)}
                    placeholder="No Category"
                    className="dark:text-slate-100"
                  />
                ) : (
                  <div className="relative group/cell cursor-pointer w-full h-full min-h-[1.25rem] flex items-center gap-2">
                    {(() => {
                      const cat = categories?.find(c => c.id === newTransaction.category_id);
                      return (
                        <>
                          <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">
                            {cat?.icon ? ICON_MAP[cat.icon] : <Tag className="w-3.5 h-3.5" />}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400 truncate block pr-6">
                            {cat?.name || 'No Category'}
                          </span>
                        </>
                      );
                    })()}
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover/cell:text-slate-400 transition-colors" />
                  </div>
                )}
              </td>
              <td 
                className={cn(
                  "px-4 border-r border-transparent transition-all",
                  compactView ? "py-1" : "py-2",
                  activeCell?.id === 'new' && activeCell?.col === 4 && "ring-2 ring-inset ring-blue-500 z-10"
                )}
                onClick={() => handleCellClick('new', 4)}
              >
                {activeCell?.id === 'new' && activeCell?.col === 4 ? (
                  <TypeAheadSelect
                    key="new-account"
                    autoFocus
                    options={accounts?.map(a => ({ id: a.id!, name: a.name })) || []}
                    value={newTransaction.account_id}
                    onChange={(id) => handleNewTransactionChange({ account_id: id })}
                    onKeyDown={(e) => handleKeyDown(e, 'new', 4)}
                    onBlur={() => setActiveCell(null)}
                    placeholder="Select Account"
                    className="dark:text-slate-100"
                  />
                ) : (
                  <div className="relative group/cell cursor-pointer w-full h-full min-h-[1.25rem]">
                    <span className="text-sm text-slate-500 dark:text-slate-400 truncate block pr-8">
                      {accounts?.find(a => a.id === newTransaction.account_id)?.name || 'Select Account'}
                    </span>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover/cell:text-slate-400 transition-colors" />
                  </div>
                )}
              </td>
              <td className="px-4 py-1 text-center">
                <button 
                  onClick={handleCreateTransaction}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Add Transaction"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>

            {visibleTransactions.map((t, rowIndex) => (
              <TransactionRow
                key={t.id}
                t={t}
                rowIndex={rowIndex}
                activeCell={activeCell}
                handleCellClick={(row, col) => {
                  if (row === -2) setActiveCell(null);
                  else handleCellClick(row, col);
                }}
                handleKeyDown={handleKeyDown}
                handleUpdateField={handleUpdateField}
                handleDelete={handleDelete}
                deletingId={deletingId}
                setDeletingId={setDeletingId}
                compactView={compactView}
                categories={categories}
                accounts={accounts}
                formatCurrency={formatCurrency}
                numberFormat={numberFormat}
                isNewTransaction={newTransactionIds?.includes(t.id!)}
                isSelected={selectedIds.has(t.id!)}
                onSelect={handleSelect}
                isDragging={isDragging}
                onDragStart={() => setIsDragging(true)}
              />
            ))}
          </tbody>
        </table>
        {visibleCount < filteredTransactions.length && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-center bg-slate-50 dark:bg-slate-900/50 rounded-b-xl">
            <button
              onClick={() => setVisibleCount(prev => prev + 100)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              Load more transactions ({visibleCount} of {filteredTransactions.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
