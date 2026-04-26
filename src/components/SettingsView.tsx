import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db, type Account, type AccountType, type Category, type CategoryRule } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ICON_MAP } from '../constants';
import { 
  Trash2, Archive, Check, X, Wallet, TrendingUp, Home, Briefcase, 
  Download, Upload, Plus, LayoutDashboard, Tag, Zap, Search, 
  HelpCircle, MoreHorizontal, Eye, EyeOff, CreditCard, Banknote,
  PieChart, Coins, Building, Landmark, ChevronUp, ChevronDown, ChevronRight,
  GripVertical, ShoppingBag, Utensils, Car, Heart, Coffee, 
  Smartphone, Music, Plane, Gift, GraduationCap, Shield, Hammer,
  DollarSign, ArrowUpRight, ArrowDownLeft, AlertCircle, Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { hashPassword, generateSaltHex, encryptData, decryptData } from '../lib/crypto';
import { generateExportData, processImportData } from '../lib/backup';
import { saveDatabaseToFile } from '../lib/fileHandling';

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div className="flex items-center justify-center gap-1 animate-fade-in">
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); setIsConfirming(false); }}
          className="p-1 text-rose-600 hover:bg-rose-50 rounded shadow-sm border border-rose-100"
          title="Confirm Delete"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }}
          className="p-1 text-slate-400 hover:bg-slate-100 rounded shadow-sm border border-slate-100"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }}
      className="p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
      title="Delete"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function CustomSelect<T extends string | number>({ 
  value, 
  onChange, 
  options, 
  className,
  onKeyDown,
  variant = 'default'
}: { 
  value: T; 
  onChange: (val: T) => void; 
  options: { value: T; label: string; icon?: React.ReactNode }[];
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  variant?: 'default' | 'table';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedOption = options.find(o => o.value === value);

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 240; // max-h-60 is 240px

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setCoords({
          bottom: window.innerHeight - rect.top,
          left: rect.left,
          width: rect.width
        });
      } else {
        setCoords({
          top: rect.bottom,
          left: rect.left,
          width: rect.width
        });
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  // Handle scroll and resize to keep portal positioned correctly
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        ref={buttonRef}
        autoFocus
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!isOpen && onKeyDown) onKeyDown(e);
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault?.();
            setIsOpen(!isOpen);
          }
          if (e.key === 'Escape' && isOpen) {
            e.preventDefault?.();
            setIsOpen(false);
          }
        }}
        className={cn(
          "w-full flex items-center justify-between gap-2 bg-white dark:bg-slate-800 text-sm focus:outline-none dark:text-slate-100",
          variant === 'table' ? "h-full p-0" : "border rounded-lg px-3 py-2",
          variant === 'table' ? "" : (isOpen ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-accent/20")
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className="truncate">{selectedOption?.label}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-auto animate-fade-in"
            style={{ 
              top: coords.top, 
              bottom: coords.bottom,
              left: coords.left, 
              width: coords.width,
              marginTop: coords.top ? '4px' : undefined,
              marginBottom: coords.bottom ? '4px' : undefined
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                  value === option.value ? "bg-accent/5 text-accent font-medium dark:bg-accent/10" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                )}
              >
                {option.icon}
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function TextInput({ 
  value, 
  onChange, 
  onBlur, 
  onKeyDown, 
  onPaste,
  autoFocus, 
  className,
  inputRef,
  placeholder
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  autoFocus?: boolean;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      if (localValue !== value) {
        onChange(localValue);
      }
    }
    onKeyDown?.(e);
  };

  return (
    <input
      ref={inputRef}
      autoFocus={autoFocus}
      type="text"
      className={className}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
    />
  );
}

function AccountTypeTable() {
  const types = useLiveQuery(() => db.account_types.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray());
  const compactView = settings?.find(s => s.key === 'compactView')?.value ?? true;
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [selectionTrigger, setSelectionTrigger] = useState<'mouse' | 'keyboard' | null>(null);
  const idToFocusRef = useRef<number | null>(null);
  const newRecordIdRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const prevActiveCellRef = useRef<{ row: number; col: number } | null>(null);

  // Auto-select text when cell becomes active via keyboard
  useEffect(() => {
    if (activeCell && selectionTrigger === 'keyboard') {
      const isSameCell = prevActiveCellRef.current?.row === activeCell.row && 
                         prevActiveCellRef.current?.col === activeCell.col;
      
      if (isSameCell) return;
      
      prevActiveCellRef.current = activeCell;

      // Small delay to ensure the input is rendered and focused
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        } else {
          const activeElement = document.activeElement as HTMLInputElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
            if (activeElement.tagName === 'INPUT') {
              activeElement.select();
            }
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (activeCell && selectionTrigger === 'mouse') {
      prevActiveCellRef.current = activeCell;
    } else if (!activeCell) {
      prevActiveCellRef.current = null;
    }
  }, [activeCell, selectionTrigger]);

  useEffect(() => {
    if (idToFocusRef.current && types.length > 0) {
      const index = types.findIndex(t => t.id === idToFocusRef.current);
      if (index !== -1) {
        setActiveCell({ row: index, col: 0 });
        setSelectionTrigger('keyboard');
        idToFocusRef.current = null;
      }
    }
  }, [types]);

  const handleUpdate = async (id: number, field: keyof AccountType, value: any) => {
    setError(null);
    if (field === 'name') {
      const existing = await db.account_types.where('name').equals(value.trim()).first();
      if (existing && existing.id !== id) return; // Prevent duplicate names on edit
    }
    await db.account_types.update(id, { [field]: value, updated_at: Date.now() });
  };

  const handleAdd = async () => {
    setError(null);
    const baseName = 'New Type';
    let name = baseName;
    let counter = 1;
    
    while (await db.account_types.where('name').equals(name).first()) {
      name = `${baseName} ${counter++}`;
    }

    const id = await db.account_types.add({ name, icon: 'Wallet', updated_at: Date.now() });
    newRecordIdRef.current = id as number;
    idToFocusRef.current = id as number;
  };

  const handleDelete = async (id: number) => {
    setError(null);
    const inUse = accounts.some(a => a.account_type_id === id);
    if (inUse) {
      setError('Cannot delete: This type is being used by one or more accounts.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    await db.account_types.delete(id);
  };

  const handleCellClick = (row: number, col: number) => {
    if (activeCell?.row === row && activeCell?.col === col) return;
    newRecordIdRef.current = null;
    setSelectionTrigger('mouse');
    setActiveCell({ row, col });
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'ArrowDown') {
      e.preventDefault?.();
      setSelectionTrigger('keyboard');
      if (rowIndex < types.length - 1) setActiveCell({ row: rowIndex + 1, col: colIndex });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault?.();
      setSelectionTrigger('keyboard');
      if (rowIndex > 0) setActiveCell({ row: rowIndex - 1, col: colIndex });
    } else if (e.key === 'ArrowRight') {
      const isSelectLike = colIndex === 1; // Icon select
      const isAtEnd = target.selectionEnd === (target.value?.length || 0);

      if (isSelectLike || isAtEnd || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex < 1) {
          e.preventDefault?.();
          setSelectionTrigger('keyboard');
          setActiveCell({ row: rowIndex, col: colIndex + 1 });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const isSelectLike = colIndex === 1; // Icon select
      const isAtStart = target.selectionStart === 0;

      if (isSelectLike || isAtStart || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex > 0) {
          e.preventDefault?.();
          setSelectionTrigger('keyboard');
          setActiveCell({ row: rowIndex, col: colIndex - 1 });
        }
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault?.();
      newRecordIdRef.current = null;
      setSelectionTrigger('keyboard');
      if (colIndex < 1) {
        setActiveCell({ row: rowIndex, col: colIndex + 1 });
      } else if (rowIndex < types.length - 1) {
        setActiveCell({ row: rowIndex + 1, col: 0 });
      } else {
        setActiveCell(null);
      }
    } else if (e.key === 'Escape') {
      if (newRecordIdRef.current === types[rowIndex].id) {
        db.account_types.delete(types[rowIndex].id!);
        newRecordIdRef.current = null;
      }
      setActiveCell(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between rounded-t-xl relative">
        {error && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-bounce">
            <div className="bg-rose-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Account Types</h3>
        </div>
        <button 
          onClick={handleAdd} 
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-xs font-bold transition-colors shadow-sm border border-blue-100 dark:border-blue-800/50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Account Type
        </button>
      </div>
      <div className="">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-slate-50/50 dark:bg-slate-800/30">
            <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <th className={cn("px-4", compactView ? "py-1.5" : "py-2")}>Name</th>
              <th className={cn("px-4 w-48", compactView ? "py-1.5" : "py-2")}>Icon</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {types.map((type, rowIndex) => (
              <tr key={type.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                <td 
                  className={cn(
                    "px-4",
                    compactView ? "py-1" : "py-2",
                    activeCell?.row === rowIndex && activeCell?.col === 0 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
                  )}
                  onClick={() => handleCellClick(rowIndex, 0)}
                >
                  {activeCell?.row === rowIndex && activeCell?.col === 0 ? (
                    <TextInput
                      inputRef={inputRef}
                      autoFocus
                      className="w-full bg-transparent border-none p-0 text-sm focus:outline-none dark:text-slate-100"
                      value={type.name}
                      onChange={(val) => handleUpdate(type.id!, 'name', val)}
                      onBlur={() => setActiveCell(null)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                    />
                  ) : (
                    <span className="text-sm text-slate-700 dark:text-slate-300">{type.name}</span>
                  )}
                </td>
                <td 
                  className={cn(
                    "px-4",
                    compactView ? "py-1" : "py-2",
                    activeCell?.row === rowIndex && activeCell?.col === 1 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
                  )}
                  onClick={() => handleCellClick(rowIndex, 1)}
                >
                  {activeCell?.row === rowIndex && activeCell?.col === 1 ? (
                    <CustomSelect
                      value={type.icon || 'Wallet'}
                      onChange={(val) => handleUpdate(type.id!, 'icon', val)}
                      options={Object.keys(ICON_MAP).map(icon => ({
                        value: icon,
                        label: icon,
                        icon: ICON_MAP[icon]
                      }))}
                      className="w-full"
                      variant="table"
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      {type.icon && ICON_MAP[type.icon]}
                      <span>{type.icon}</span>
                    </div>
                  )}
                </td>
                <td className={cn("w-12 px-2 text-center", compactView ? "py-1" : "py-2")}>
                  <DeleteButton onDelete={() => handleDelete(type.id!)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountTable() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const accountTypes = useLiveQuery(() => db.account_types.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray());
  const compactView = settings?.find(s => s.key === 'compactView')?.value || false;
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [selectionTrigger, setSelectionTrigger] = useState<'mouse' | 'keyboard' | null>(null);
  const idToFocusRef = useRef<number | null>(null);
  const newRecordIdRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const prevActiveCellRef = useRef<{ row: number; col: number } | null>(null);

  // Auto-select text when cell becomes active via keyboard
  useEffect(() => {
    if (activeCell && selectionTrigger === 'keyboard') {
      const isSameCell = prevActiveCellRef.current?.row === activeCell.row && 
                         prevActiveCellRef.current?.col === activeCell.col;
      
      if (isSameCell) return;
      
      prevActiveCellRef.current = activeCell;

      // Small delay to ensure the input is rendered and focused
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        } else {
          const activeElement = document.activeElement as HTMLInputElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
            if (activeElement.tagName === 'INPUT') {
              activeElement.select();
            }
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (activeCell && selectionTrigger === 'mouse') {
      prevActiveCellRef.current = activeCell;
    } else if (!activeCell) {
      prevActiveCellRef.current = null;
    }
  }, [activeCell, selectionTrigger]);

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [accounts]);

  useEffect(() => {
    if (idToFocusRef.current && sortedAccounts.length > 0) {
      const index = sortedAccounts.findIndex(a => a.id === idToFocusRef.current);
      if (index !== -1) {
        setActiveCell({ row: index, col: 0 });
        setSelectionTrigger('keyboard');
        idToFocusRef.current = null;
      }
    }
  }, [sortedAccounts]);

  const handleAdd = async () => {
    setError(null);
    const baseName = 'New Account';
    let name = baseName;
    let counter = 1;
    
    while (await db.accounts.where('name').equals(name).first()) {
      name = `${baseName} ${counter++}`;
    }

    const defaultType = accountTypes[0]?.id;
    const maxOrder = accounts.reduce((max, a) => Math.max(max, a.order || 0), -1);

    const id = await db.accounts.add({ 
      name, 
      account_type_id: defaultType || 0,
      is_liquid: true,
      show_in_top_bar: true,
      is_archived: false,
      description: '',
      order: maxOrder + 1,
      updated_at: Date.now() 
    });
    newRecordIdRef.current = id as number;
    idToFocusRef.current = id as number;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sortedAccounts.findIndex(a => a.id === active.id);
      const newIndex = sortedAccounts.findIndex(a => a.id === over.id);
      const newSorted = arrayMove(sortedAccounts, oldIndex, newIndex);

      await db.transaction('rw', db.accounts, async () => {
        for (let i = 0; i < newSorted.length; i++) {
          const acc = newSorted[i] as Account;
          await db.accounts.update(acc.id!, { order: i, updated_at: Date.now() });
        }
      });
    }
  };

  const handleUpdate = async (id: number, field: keyof Account, value: any) => {
    setError(null);
    if (field === 'name') {
      const existing = await db.accounts.where('name').equals(value.trim()).first();
      if (existing && existing.id !== id) return;
    }
    await db.accounts.update(id, { [field]: value, updated_at: Date.now() });
  };

  const handleDelete = async (id: number) => {
    setError(null);
    const transactionCount = await db.transactions.where('account_id').equals(id).count();
    if (transactionCount > 0) {
      setError('Cannot delete: This account has transactions.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    await db.accounts.delete(id);
  };

  const handleCellClick = (row: number, col: number) => {
    if (activeCell?.row === row && activeCell?.col === col) return;
    newRecordIdRef.current = null;
    setSelectionTrigger('mouse');
    setActiveCell({ row, col });
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'ArrowDown') {
      e.preventDefault?.();
      setSelectionTrigger('keyboard');
      if (rowIndex < sortedAccounts.length - 1) setActiveCell({ row: rowIndex + 1, col: colIndex });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault?.();
      setSelectionTrigger('keyboard');
      if (rowIndex > 0) setActiveCell({ row: rowIndex - 1, col: colIndex });
    } else if (e.key === 'ArrowRight') {
      const isSelectLike = colIndex === 1; // Type select
      const isAtEnd = target.selectionEnd === (target.value?.length || 0);

      if (isSelectLike || isAtEnd || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex < 1) {
          e.preventDefault?.();
          setSelectionTrigger('keyboard');
          setActiveCell({ row: rowIndex, col: colIndex + 1 });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const isSelectLike = colIndex === 1; // Type select
      const isAtStart = target.selectionStart === 0;

      if (isSelectLike || isAtStart || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex > 0) {
          e.preventDefault?.();
          setSelectionTrigger('keyboard');
          setActiveCell({ row: rowIndex, col: colIndex - 1 });
        }
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault?.();
      newRecordIdRef.current = null;
      setSelectionTrigger('keyboard');
      if (colIndex < 1) {
        setActiveCell({ row: rowIndex, col: colIndex + 1 });
      } else if (rowIndex < sortedAccounts.length - 1) {
        setActiveCell({ row: rowIndex + 1, col: 0 });
      } else {
        setActiveCell(null);
      }
    } else if (e.key === 'Escape') {
      if (newRecordIdRef.current === sortedAccounts[rowIndex].id) {
        db.accounts.delete(sortedAccounts[rowIndex].id!);
        newRecordIdRef.current = null;
      }
      setActiveCell(null);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length <= 1) return; // Only bulk if multiple lines

    e.preventDefault?.();
    
    let currentOrder = sortedAccounts.length;
    for (const line of lines) {
      const name = line.trim();
      if (!name) continue;
      
      const existing = await db.accounts.where('name').equals(name).first();
      if (!existing) {
        // Find default account type
        const defaultType = await db.account_types.toCollection().first();
        await db.accounts.add({ 
          name, 
          description: '',
          account_type_id: defaultType?.id || 1, 
          order: currentOrder++, 
          is_liquid: true, 
          show_in_top_bar: true, 
          is_archived: false,
          updated_at: Date.now() 
        });
      }
    }
    setActiveCell(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between rounded-t-xl relative">
        {error && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-bounce">
            <div className="bg-rose-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Accounts</h3>
        </div>
        <button 
          onClick={handleAdd} 
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-xs font-bold transition-colors shadow-sm border border-blue-100 dark:border-blue-800/50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Account
        </button>
      </div>
      <div className="">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
            <thead className="bg-slate-50/50 dark:bg-slate-800/30">
              <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className={cn("px-4 w-12 text-center", compactView ? "py-1.5" : "py-2")}></th>
                <th className={cn("px-4", compactView ? "py-1.5" : "py-2")}>Name</th>
                <th className={cn("px-4 w-48", compactView ? "py-1.5" : "py-2")}>Type</th>
                <th className={cn("px-4 w-24 text-center", compactView ? "py-1.5" : "py-2")}>Liquid</th>
                <th className={cn("px-4 w-24 text-center", compactView ? "py-1.5" : "py-2")}>Top Bar</th>
                <th className={cn("px-4 w-24 text-center", compactView ? "py-1.5" : "py-2")}>Archived</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <SortableContext 
                items={sortedAccounts.map(a => (a as Account).id!)}
                strategy={verticalListSortingStrategy}
              >
                {sortedAccounts.map((acc, rowIndex) => (
                  <SortableAccountRow 
                    key={(acc as Account).id} 
                    acc={acc as Account} 
                    rowIndex={rowIndex} 
                    activeCell={activeCell}
                    handleCellClick={handleCellClick}
                    setActiveCell={setActiveCell}
                    handleUpdate={handleUpdate}
                    handleDelete={handleDelete}
                    handleKeyDown={handleKeyDown}
                    accountTypes={accountTypes}
                    compactView={compactView}
                    inputRef={inputRef}
                    handlePaste={handlePaste}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}

const SortableAccountRow: React.FC<{ 
  acc: Account; 
  rowIndex: number; 
  activeCell: { row: number; col: number } | null;
  handleCellClick: (row: number, col: number) => void;
  setActiveCell: (cell: { row: number; col: number } | null) => void;
  handleUpdate: (id: number, field: keyof Account, value: any) => void;
  handleDelete: (id: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => void;
  accountTypes: AccountType[];
  compactView: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  handlePaste: (e: React.ClipboardEvent) => void;
}> = ({ 
  acc, 
  rowIndex, 
  activeCell, 
  handleCellClick,
  setActiveCell, 
  handleUpdate, 
  handleDelete, 
  handleKeyDown,
  accountTypes,
  compactView,
  inputRef,
  handlePaste
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: acc.id! });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <tr 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group hover:bg-slate-50/50 dark:hover:bg-slate-800/20", 
        acc.is_archived && "opacity-50",
        isDragging && "bg-blue-50/50 dark:bg-blue-900/20 z-10 opacity-70"
      )}
    >
      <td className={cn("px-2 text-center cursor-grab active:cursor-grabbing", compactView ? "py-1" : "py-2")} {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
      </td>
      <td 
        className={cn(
          "px-4",
          compactView ? "py-1" : "py-2",
          activeCell?.row === rowIndex && activeCell?.col === 0 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
        )}
        onClick={() => handleCellClick(rowIndex, 0)}
      >
        {activeCell?.row === rowIndex && activeCell?.col === 0 ? (
          <TextInput
            inputRef={inputRef}
            autoFocus
            className="w-full bg-transparent border-none p-0 text-sm focus:outline-none dark:text-slate-100"
            value={acc.name}
            onChange={(val) => handleUpdate(acc.id!, 'name', val)}
            onBlur={() => setActiveCell(null)}
            onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
            onPaste={handlePaste}
          />
        ) : (
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{acc.name}</span>
        )}
      </td>
      <td 
        className={cn(
          "px-4",
          compactView ? "py-1" : "py-2",
          activeCell?.row === rowIndex && activeCell?.col === 1 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
        )}
        onClick={() => handleCellClick(rowIndex, 1)}
      >
        {activeCell?.row === rowIndex && activeCell?.col === 1 ? (
          <CustomSelect
            value={acc.account_type_id}
            onChange={(val) => handleUpdate(acc.id!, 'account_type_id', val)}
            options={accountTypes.map(t => ({
              value: t.id!,
              label: t.name,
              icon: t.icon ? ICON_MAP[t.icon] : <HelpCircle className="w-4 h-4" />
            }))}
            className="w-full"
            variant="table"
            onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            {accountTypes.find(t => t.id === acc.account_type_id)?.icon && 
              ICON_MAP[accountTypes.find(t => t.id === acc.account_type_id)!.icon!]}
            <span>{accountTypes.find(t => t.id === acc.account_type_id)?.name || '-'}</span>
          </div>
        )}
      </td>
      <td className={cn("px-4 text-center", compactView ? "py-1" : "py-2")}>
        <button 
          onClick={() => handleUpdate(acc.id!, 'is_liquid', !acc.is_liquid)}
          className={cn(
            "p-1 rounded transition-colors",
            acc.is_liquid ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400"
          )}
        >
          <Check className={cn("w-4 h-4", !acc.is_liquid && "opacity-0")} />
        </button>
      </td>
      <td className={cn("px-4 text-center", compactView ? "py-1" : "py-2")}>
        <button 
          onClick={() => handleUpdate(acc.id!, 'show_in_top_bar', !acc.show_in_top_bar)}
          className={cn(
            "p-1 rounded transition-colors",
            acc.show_in_top_bar ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400"
          )}
        >
          {acc.show_in_top_bar ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </td>
      <td className={cn("px-4 text-center", compactView ? "py-1" : "py-2")}>
        <button 
          onClick={() => handleUpdate(acc.id!, 'is_archived', !acc.is_archived)}
          className={cn(
            "p-1 rounded transition-colors",
            acc.is_archived ? "text-amber-600 bg-amber-50 dark:bg-amber-900/20" : "text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400"
          )}
        >
          <Archive className="w-4 h-4" />
        </button>
      </td>
      <td className={cn("w-12 px-2 text-center", compactView ? "py-1" : "py-2")}>
        <DeleteButton onDelete={() => handleDelete(acc.id!)} />
      </td>
    </tr>
  );
}

function CategoryTable() {
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray());
  const compactView = settings?.find(s => s.key === 'compactView')?.value || false;
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [selectionTrigger, setSelectionTrigger] = useState<'mouse' | 'keyboard' | null>(null);
  const idToFocusRef = useRef<number | null>(null);
  const newRecordIdRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const prevActiveCellRef = useRef<{ row: number; col: number } | null>(null);

  // Auto-select text when cell becomes active via keyboard
  useEffect(() => {
    if (activeCell && selectionTrigger === 'keyboard') {
      const isSameCell = prevActiveCellRef.current?.row === activeCell.row && 
                         prevActiveCellRef.current?.col === activeCell.col;
      
      if (isSameCell) return;
      
      prevActiveCellRef.current = activeCell;

      // Small delay to ensure the input is rendered and focused
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        } else {
          const activeElement = document.activeElement as HTMLInputElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
            if (activeElement.tagName === 'INPUT') {
              activeElement.select();
            }
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (activeCell && selectionTrigger === 'mouse') {
      prevActiveCellRef.current = activeCell;
    } else if (!activeCell) {
      prevActiveCellRef.current = null;
    }
  }, [activeCell, selectionTrigger]);

  useEffect(() => {
    if (idToFocusRef.current && categories.length > 0) {
      const index = categories.findIndex(c => c.id === idToFocusRef.current);
      if (index !== -1) {
        setActiveCell({ row: index, col: 0 });
        setSelectionTrigger('keyboard');
        idToFocusRef.current = null;
      }
    }
  }, [categories]);

  const handleUpdate = async (id: number, field: keyof Category, value: any) => {
    setError(null);
    if (field === 'name') {
      const existing = await db.categories.where('name').equals(value.trim()).first();
      if (existing && existing.id !== id) return;
    }
    await db.categories.update(id, { [field]: value, updated_at: Date.now() });
  };

  const handleAdd = async () => {
    setError(null);
    const baseName = 'New Category';
    let name = baseName;
    let counter = 1;
    
    while (await db.categories.where('name').equals(name).first()) {
      name = `${baseName} ${counter++}`;
    }
    const id = await db.categories.add({ name, updated_at: Date.now() });
    newRecordIdRef.current = id as number;
    idToFocusRef.current = id as number;
  };

  const handleDelete = async (id: number) => {
    setError(null);
    const transactionCount = await db.transactions.where('category_id').equals(id).count();
    if (transactionCount > 0) {
      setError('Cannot delete: This category is used in transactions.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const ruleCount = await db.category_rules.where('category_id').equals(id).count();
    if (ruleCount > 0) {
      setError('Cannot delete: This category is used in automation rules.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    await db.categories.delete(id);
  };

  const handleCellClick = (row: number, col: number) => {
    if (activeCell?.row === row && activeCell?.col === col) return;
    newRecordIdRef.current = null;
    setSelectionTrigger('mouse');
    setActiveCell({ row, col });
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'ArrowDown') {
      e.preventDefault?.();
      setSelectionTrigger('keyboard');
      if (rowIndex < categories.length - 1) setActiveCell({ row: rowIndex + 1, col: colIndex });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault?.();
      setSelectionTrigger('keyboard');
      if (rowIndex > 0) setActiveCell({ row: rowIndex - 1, col: colIndex });
    } else if (e.key === 'ArrowRight') {
      const isSelectLike = colIndex === 1; // Icon select
      const isAtEnd = target.selectionEnd === (target.value?.length || 0);

      if (isSelectLike || isAtEnd || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex === 0) {
          e.preventDefault?.();
          setSelectionTrigger('keyboard');
          setActiveCell({ row: rowIndex, col: 1 });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const isSelectLike = colIndex === 1; // Icon select
      const isAtStart = target.selectionStart === 0;

      if (isSelectLike || isAtStart || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex === 1) {
          e.preventDefault?.();
          setSelectionTrigger('keyboard');
          setActiveCell({ row: rowIndex, col: 0 });
        }
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault?.();
      newRecordIdRef.current = null;
      setSelectionTrigger('keyboard');
      if (colIndex === 0 && !e.shiftKey) {
        setActiveCell({ row: rowIndex, col: 1 });
      } else if (rowIndex < categories.length - 1) {
        setActiveCell({ row: rowIndex + 1, col: 0 });
      } else {
        setActiveCell(null);
      }
    } else if (e.key === 'Escape') {
      if (newRecordIdRef.current === categories[rowIndex].id) {
        db.categories.delete(categories[rowIndex].id!);
        newRecordIdRef.current = null;
      }
      setActiveCell(null);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length <= 1) return; // Only bulk if multiple lines

    e.preventDefault?.();
    
    for (const line of lines) {
      const name = line.trim();
      if (!name) continue;
      
      const existing = await db.categories.where('name').equals(name).first();
      if (!existing) {
        await db.categories.add({ name, updated_at: Date.now() });
      }
    }
    setActiveCell(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between rounded-t-xl relative">
        {error && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-bounce">
            <div className="bg-rose-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Categories</h3>
        </div>
        <button 
          onClick={handleAdd} 
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-xs font-bold transition-colors shadow-sm border border-blue-100 dark:border-blue-800/50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Category
        </button>
      </div>
      <div className="">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-slate-50/50 dark:bg-slate-800/30">
            <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <th className={cn("px-4", compactView ? "py-1.5" : "py-2")}>Name</th>
              <th className={cn("px-4 w-48", compactView ? "py-1.5" : "py-2")}>Icon</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map((cat, rowIndex) => (
              <tr key={cat.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                <td 
                  className={cn(
                    "px-4",
                    compactView ? "py-1" : "py-2",
                    activeCell?.row === rowIndex && activeCell?.col === 0 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
                  )}
                  onClick={() => handleCellClick(rowIndex, 0)}
                >
                  {activeCell?.row === rowIndex && activeCell?.col === 0 ? (
                    <TextInput
                      inputRef={inputRef}
                      autoFocus
                      className="w-full bg-transparent border-none p-0 text-sm focus:outline-none dark:text-slate-100"
                      value={cat.name}
                      onChange={(val) => handleUpdate(cat.id!, 'name', val)}
                      onBlur={() => setActiveCell(null)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                      onPaste={handlePaste}
                    />
                  ) : (
                    <span className="text-sm text-slate-700 dark:text-slate-300">{cat.name}</span>
                  )}
                </td>
                <td 
                  className={cn(
                    "px-4",
                    compactView ? "py-1" : "py-2",
                    activeCell?.row === rowIndex && activeCell?.col === 1 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500"
                  )}
                  onClick={() => handleCellClick(rowIndex, 1)}
                >
                  {activeCell?.row === rowIndex && activeCell?.col === 1 ? (
                    <CustomSelect
                      value={cat.icon || 'Tag'}
                      onChange={(val) => handleUpdate(cat.id!, 'icon', val)}
                      options={Object.keys(ICON_MAP).map(icon => ({
                        value: icon,
                        label: icon,
                        icon: ICON_MAP[icon]
                      }))}
                      className="w-full"
                      variant="table"
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      {cat.icon && ICON_MAP[cat.icon]}
                      <span>{cat.icon}</span>
                    </div>
                  )}
                </td>
                <td className={cn("w-12 px-2 text-center", compactView ? "py-1" : "py-2")}>
                  <DeleteButton onDelete={() => handleDelete(cat.id!)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 rounded-b-xl text-sm">
        <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">Icons with special functionality</h4>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <li className="flex items-start gap-2">
            <div className="mt-0.5">{ICON_MAP['OpeningBalance']}</div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Opening Balance</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Used for initial account setups. Not calculated as income in reports.</p>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <div className="mt-0.5">{ICON_MAP['SeverancePay']}</div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Severance Pay</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Part of net worth, but not added to income if transactions are in the future.</p>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <div className="mt-0.5">{ICON_MAP['CapitalGains']}</div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Capital Gains</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Capital gains are shown separately in reports.</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

function CategoryRuleTable() {
  const rules = useLiveQuery(() => db.category_rules.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray());
  const compactView = settings?.find(s => s.key === 'compactView')?.value || false;
  const [activeCell, setActiveCell] = useState<{ id: number; col: number } | null>(null);
  const [selectionTrigger, setSelectionTrigger] = useState<'mouse' | 'keyboard' | null>(null);
  const idToFocusRef = useRef<number | null>(null);
  const newRecordIdRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const prevActiveCellRef = useRef<{ id: number; col: number } | null>(null);
  const prevActiveRowIdRef = useRef<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [bulkAddText, setBulkAddText] = useState('');
  const [bulkAddCategory, setBulkAddCategory] = useState<number | ''>('');

  const toggleCategory = (catId: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  // Enforce mandatory fields when leaving a row
  useEffect(() => {
    const currentId = activeCell?.id || null;
    const prevId = prevActiveRowIdRef.current;

    if (prevId !== null && prevId !== currentId) {
      db.category_rules.get(prevId).then(rule => {
        if (rule && (!rule.search_value.trim() || rule.category_id === 0)) {
          // Just mark it as invalid visually, don't delete
        }
      });
    }
    prevActiveRowIdRef.current = currentId;
  }, [activeCell?.id]);

  // Auto-select text when cell becomes active via keyboard
  useEffect(() => {
    if (activeCell && selectionTrigger === 'keyboard') {
      const isSameCell = prevActiveCellRef.current?.id === activeCell.id && 
                         prevActiveCellRef.current?.col === activeCell.col;
      
      if (isSameCell) return;
      
      prevActiveCellRef.current = activeCell;

      // Small delay to ensure the input is rendered and focused
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        } else {
          const activeElement = document.activeElement as HTMLInputElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
            if (activeElement.tagName === 'INPUT') {
              activeElement.select();
            }
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (activeCell && selectionTrigger === 'mouse') {
      prevActiveCellRef.current = activeCell;
    } else if (!activeCell) {
      prevActiveCellRef.current = null;
    }
  }, [activeCell, selectionTrigger]);

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }, [rules]);

  const groupedRules = useMemo(() => {
    const groups: { [key: number]: CategoryRule[] } = {};
    sortedRules.forEach(rule => {
      if (!groups[rule.category_id]) groups[rule.category_id] = [];
      groups[rule.category_id].push(rule);
    });
    return groups;
  }, [sortedRules]);

  const visualRules = useMemo(() => {
    const rulesList: CategoryRule[] = [];
    const allCategories = [...categories, { id: 0, name: 'Uncategorized' }];
    allCategories.forEach((cat) => {
      if (expandedCategories.has(cat.id!)) {
        const catRules = groupedRules[cat.id!] || [];
        rulesList.push(...catRules);
      }
    });
    return rulesList;
  }, [groupedRules, categories, expandedCategories]);

  useEffect(() => {
    if (idToFocusRef.current && visualRules.length > 0) {
      const rule = visualRules.find(r => r.id === idToFocusRef.current);
      if (rule) {
        setActiveCell({ id: rule.id!, col: 0 });
        setSelectionTrigger('keyboard');
        idToFocusRef.current = null;
      }
    }
  }, [visualRules]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeRule = rules.find(r => r.id === active.id);
      if (!activeRule) return;

      if (String(over.id).startsWith('category-')) {
        const targetCategoryId = parseInt(String(over.id).replace('category-', ''), 10);
        if (activeRule.category_id !== targetCategoryId) {
          await db.category_rules.update(activeRule.id!, { 
            category_id: targetCategoryId,
            updated_at: Date.now() 
          });
          setExpandedCategories(prev => new Set(prev).add(targetCategoryId));
        }
        return;
      }

      const globalOldIndex = sortedRules.findIndex(r => r.id === active.id);
      if (globalOldIndex !== -1) {
        let newSorted = [...sortedRules];
        const oldVisualIndex = visualRules.findIndex(r => r.id === active.id);
        const newVisualIndex = visualRules.findIndex(r => r.id === over.id);
        
        newSorted.splice(globalOldIndex, 1);
        
        // Find over.id position in the NEW array
        let insertIndex = newSorted.findIndex(r => r.id === over.id);
        if (oldVisualIndex < newVisualIndex) {
            insertIndex += 1;
        }

        const targetRule = rules.find(r => r.id === over.id);
        let newCategoryId = activeRule.category_id;
        if (targetRule && activeRule.category_id !== targetRule.category_id) {
          newCategoryId = targetRule.category_id;
          setExpandedCategories(prev => new Set(prev).add(targetRule.category_id));
        }

        newSorted.splice(insertIndex, 0, { ...activeRule, category_id: newCategoryId });

        await db.transaction('rw', db.category_rules, async () => {
          for (let i = 0; i < newSorted.length; i++) {
            const rule = newSorted[i] as CategoryRule;
            await db.category_rules.update(rule.id!, { 
              priority: i, 
              category_id: rule.id === activeRule.id ? newCategoryId : rule.category_id,
              updated_at: Date.now() 
            });
          }
        });
      }
    }
  };

  const handleApplyRules = async () => {
    try {
      setError(null);
      setApplySuccess(null);
      const allTransactions = await db.transactions.toArray();
      const uncategorized = allTransactions.filter(t => !t.category_id);
      const allRules = await db.category_rules.orderBy('priority').toArray();
      
      if (uncategorized.length === 0 || allRules.length === 0) {
        setApplySuccess('No uncategorized transactions to match.');
        setTimeout(() => setApplySuccess(null), 3000);
        return;
      }

      let appliedCount = 0;
      await db.transaction('rw', db.transactions, async () => {
        for (const transaction of uncategorized) {
          for (const rule of allRules) {
            if (transaction.description.toLowerCase().includes(rule.search_value.toLowerCase())) {
              await db.transactions.update(transaction.id!, {
                category_id: rule.category_id,
                updated_at: Date.now()
              });
              appliedCount++;
              break;
            }
          }
        }
      });
      setApplySuccess(`Applied rules to ${appliedCount} transactions.`);
      setTimeout(() => setApplySuccess(null), 3000);
    } catch (err) {
      console.error("Failed to apply rules:", err);
      setError("Failed to apply rules.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleUpdate = async (id: number, field: keyof CategoryRule, value: any) => {
    await db.category_rules.update(id, { [field]: value, updated_at: Date.now() });
  };

  const handleAdd = async (categoryId?: number | React.MouseEvent) => {
    setError(null);
    let targetCategoryId = 0;
    if (typeof categoryId === 'number') {
      targetCategoryId = categoryId;
    } else if (activeCell) {
      const activeRule = rules.find(r => r.id === activeCell.id);
      if (activeRule) {
        targetCategoryId = activeRule.category_id;
      }
    } else if (categories.length > 0) {
      targetCategoryId = categories[0].id!;
    }

    const id = await db.category_rules.add({ 
      search_value: '', 
      category_id: targetCategoryId, 
      priority: rules.length, 
      updated_at: Date.now() 
    });
    
    setExpandedCategories(prev => new Set(prev).add(targetCategoryId));
    newRecordIdRef.current = id as number;
    idToFocusRef.current = id as number;
  };

  const handleDelete = async (id: number) => {
    await db.category_rules.delete(id);
  };

  const handleCellClick = (id: number, col: number) => {
    if (activeCell?.id === id && activeCell?.col === col) return;
    newRecordIdRef.current = null;
    setSelectionTrigger('mouse');
    setActiveCell({ id, col });
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: number, colIndex: number) => {
    const target = e.target as HTMLInputElement;
    const currentIndex = visualRules.findIndex(r => r.id === id);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault?.();
      setSelectionTrigger('keyboard');
      if (currentIndex < visualRules.length - 1) setActiveCell({ id: visualRules[currentIndex + 1].id!, col: colIndex });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault?.();
      setSelectionTrigger('keyboard');
      if (currentIndex > 0) setActiveCell({ id: visualRules[currentIndex - 1].id!, col: colIndex });
    } else if (e.key === 'ArrowRight') {
      const isSelectLike = colIndex === 1; // Category select
      const isAtEnd = target.selectionEnd === (target.value?.length || 0);

      if (isSelectLike || isAtEnd || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex < 1) {
          e.preventDefault?.();
          setSelectionTrigger('keyboard');
          setActiveCell({ id, col: colIndex + 1 });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const isSelectLike = colIndex === 1; // Category select
      const isAtStart = target.selectionStart === 0;

      if (isSelectLike || isAtStart || (e.target as HTMLSelectElement).tagName === 'SELECT') {
        if (colIndex > 0) {
          e.preventDefault?.();
          setSelectionTrigger('keyboard');
          setActiveCell({ id, col: colIndex - 1 });
        }
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault?.();
      newRecordIdRef.current = null;
      setSelectionTrigger('keyboard');
      if (colIndex < 1) {
        setActiveCell({ id, col: colIndex + 1 });
      } else if (currentIndex < visualRules.length - 1) {
        setActiveCell({ id: visualRules[currentIndex + 1].id!, col: 0 });
      } else {
        setActiveCell(null);
      }
    } else if (e.key === 'Escape') {
      if (newRecordIdRef.current === id) {
        db.category_rules.delete(id);
        newRecordIdRef.current = null;
      }
      setActiveCell(null);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length <= 1) return; // Only bulk if multiple lines

    e.preventDefault?.();
    
    let currentPriority = rules.length;
    for (const line of lines) {
      const parts = line.split(/\t/);
      const searchValue = parts[0]?.trim();
      const categoryName = parts[1]?.trim();

      if (!searchValue) continue;

      let categoryId: number | undefined;
      if (categoryName) {
        const cat = await db.categories.where('name').equals(categoryName).first();
        categoryId = cat?.id;
      }

      if (!categoryId && categories.length > 0) {
        categoryId = categories[0].id;
      }

      if (categoryId) {
        await db.category_rules.add({
          search_value: searchValue,
          category_id: categoryId,
          priority: currentPriority++,
          updated_at: Date.now()
        });
      }
    }
    setActiveCell(null);
  };

  const handleBulkAdd = async () => {
    setError(null);
    const lines = bulkAddText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if (lines.length === 0) {
      setError('Please enter at least one search value');
      return;
    }
    if (bulkAddCategory === '') {
      setError('Please select a category');
      return;
    }

    try {
      for (const val of lines) {
        await db.category_rules.add({
          search_value: val,
          category_id: Number(bulkAddCategory),
          priority: rules.length,
          updated_at: Date.now()
        });
      }
      setExpandedCategories(prev => new Set(prev).add(Number(bulkAddCategory)));
      setIsBulkAddOpen(false);
      setBulkAddText('');
      setBulkAddCategory('');
    } catch (err: any) {
      setError(err.message || 'Failed to bulk add rules');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
      {isBulkAddOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsBulkAddOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Bulk Add Rules</h2>
              </div>
              <button 
                onClick={() => setIsBulkAddOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category to Assign</label>
                <select
                  value={bulkAddCategory}
                  onChange={(e) => setBulkAddCategory(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3 py-2"
                >
                  <option value="" disabled>Select a category...</option>
                  <option value={0}>Uncategorized</option>
                  {categories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Search Values (One per line)</label>
                <textarea
                  value={bulkAddText}
                  onChange={(e) => setBulkAddText(e.target.value)}
                  placeholder="e.g.&#10;ALDI&#10;Burger King&#10;Netflix..."
                  rows={8}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm p-3 resize-y"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end gap-3 rounded-b-xl shrink-0">
              <button
                onClick={() => setIsBulkAddOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAdd}
                disabled={!bulkAddText.trim() || bulkAddCategory === ''}
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed border-transparent"
              >
                Add Rules
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between rounded-t-xl relative">
        {error && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-bounce">
            <div className="bg-rose-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Auto-Categorization Rules</h3>
        </div>
        <div className="flex items-center gap-2">
          {applySuccess && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md animate-fade-in mr-2">
              {applySuccess}
            </span>
          )}
          <button 
            onClick={handleApplyRules} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg text-xs font-bold transition-colors shadow-sm border border-emerald-100 dark:border-emerald-800/50"
            title="Apply rules to uncategorized transactions"
          >
            <Zap className="w-3.5 h-3.5" />
            Apply rules to uncategorized transactions
          </button>
          <button 
            onClick={() => setIsBulkAddOpen(true)} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-xs font-bold transition-colors shadow-sm border border-blue-100 dark:border-blue-800/50"
          >
            <Plus className="w-3.5 h-3.5" />
            Bulk Add Rules
          </button>
        </div>
      </div>
      <div className="">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-slate-50/50 dark:bg-slate-800/30">
              <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className={cn("px-4 w-12 text-center", compactView ? "py-1.5" : "py-2")}></th>
                <th className={cn("px-4", compactView ? "py-1.5" : "py-2")}>Search Value</th>
                <th className={cn("px-4 w-48", compactView ? "py-1.5" : "py-2")}>Category</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <SortableContext 
                items={visualRules.map(r => (r as CategoryRule).id!)}
                strategy={verticalListSortingStrategy}
              >
                {[...categories, { id: 0, name: 'Uncategorized' }].map((category) => {
                  const catId = category.id!;
                  const catRules = groupedRules[catId] || [];
                  if (catId === 0 && catRules.length === 0) return null; // Don't show Uncategorized if empty
                  
                  const isExpanded = expandedCategories.has(catId);

                  return (
                    <React.Fragment key={catId}>
                      <DroppableCategoryHeader
                        categoryId={catId}
                        categoryName={category.name}
                        ruleCount={catRules.length}
                        isExpanded={isExpanded}
                        onToggle={() => toggleCategory(catId)}
                        onAdd={() => handleAdd(catId)}
                      />
                      {isExpanded && (catRules as CategoryRule[]).map((rule) => {
                        return (
                          <SortableRuleRow 
                            key={rule.id}
                            rule={rule}
                            activeCell={activeCell}
                            handleCellClick={handleCellClick}
                            setActiveCell={setActiveCell}
                            handleUpdate={handleUpdate}
                            handleDelete={handleDelete}
                            handleKeyDown={handleKeyDown}
                            handlePaste={handlePaste}
                            categories={categories}
                            compactView={compactView}
                            inputRef={inputRef}
                          />
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}

const DroppableCategoryHeader: React.FC<{
  categoryId: number;
  categoryName: string;
  ruleCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
}> = ({ categoryId, categoryName, ruleCount, isExpanded, onToggle, onAdd }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `category-${categoryId}`,
  });

  return (
    <tr 
      ref={setNodeRef}
      className={cn(
        "cursor-pointer transition-colors",
        isOver ? "bg-blue-50 dark:bg-blue-900/30" : "bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
      )}
      onClick={onToggle}
    >
      <td colSpan={4} className="px-4 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>{categoryName}</span>
            <span className="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full text-[9px]">
              {ruleCount}
            </span>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="flex items-center gap-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add rule
          </button>
        </div>
      </td>
    </tr>
  );
};

const SortableRuleRow: React.FC<{
  rule: CategoryRule;
  activeCell: { id: number; col: number } | null;
  handleCellClick: (id: number, col: number) => void;
  setActiveCell: (cell: { id: number; col: number } | null) => void;
  handleUpdate: (id: number, field: keyof CategoryRule, value: any) => void;
  handleDelete: (id: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, id: number, colIndex: number) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  categories: Category[];
  compactView: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
}> = ({
  rule,
  activeCell,
  handleCellClick,
  setActiveCell,
  handleUpdate,
  handleDelete,
  handleKeyDown,
  handlePaste,
  categories,
  compactView,
  inputRef
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: rule.id! });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className={cn(
        "group hover:bg-slate-50/50 dark:hover:bg-slate-800/20",
        isDragging && "opacity-70"
      )}
    >
      <td className={cn("w-12 px-2 text-center cursor-grab active:cursor-grabbing", compactView ? "py-1" : "py-2", isDragging && "relative z-50 bg-blue-50 dark:bg-blue-900/40 shadow border-y border-blue-200")} {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
      </td>
      <td 
        className={cn(
          "px-4 text-left w-full",
          compactView ? "py-1" : "py-2",
          activeCell?.id === rule.id && activeCell?.col === 0 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500",
          isDragging && "relative z-50 bg-blue-50 dark:bg-blue-900/40 shadow border-y border-blue-200"
        )}
        onClick={() => handleCellClick(rule.id!, 0)}
      >
        {activeCell?.id === rule.id && activeCell?.col === 0 ? (
          <TextInput
            inputRef={inputRef}
            autoFocus
            className="w-full bg-transparent border-none p-0 text-sm focus:outline-none dark:text-slate-100"
            placeholder="Enter search value..."
            value={rule.search_value}
            onChange={(val) => handleUpdate(rule.id!, 'search_value', val)}
            onBlur={() => setActiveCell(null)}
            onKeyDown={(e) => handleKeyDown(e, rule.id!, 0)}
            onPaste={handlePaste}
          />
        ) : (
          <span className={cn("text-sm truncate block", !rule.search_value.trim() ? "text-red-500 italic" : "text-slate-700 dark:text-slate-300")}>
            {rule.search_value || 'Empty search value'}
          </span>
        )}
      </td>
      <td 
        className={cn(
          "w-48 px-4",
          compactView ? "py-1" : "py-2",
          activeCell?.id === rule.id && activeCell?.col === 1 && "bg-white dark:bg-slate-800 z-10 ring-2 ring-inset ring-blue-500",
          isDragging && "relative z-50 bg-blue-50 dark:bg-blue-900/40 shadow border-y border-blue-200"
        )}
        onClick={() => handleCellClick(rule.id!, 1)}
      >
        {activeCell?.id === rule.id && activeCell?.col === 1 ? (
          <CustomSelect
            value={rule.category_id}
            onChange={(val) => handleUpdate(rule.id!, 'category_id', val)}
            options={[
              { value: 0, label: 'Select category...', icon: <Tag className="w-4 h-4 text-slate-300" /> },
              ...categories.map(c => ({
                value: c.id!,
                label: c.name,
                icon: c.icon ? ICON_MAP[c.icon] : <Tag className="w-4 h-4" />
              }))
            ]}
            className="w-full"
            variant="table"
            onKeyDown={(e) => handleKeyDown(e, rule.id!, 1)}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm truncate">
            {(() => {
              const cat = categories.find(c => c.id === rule.category_id);
              return (
                <>
                  {cat?.icon ? ICON_MAP[cat.icon] : <Tag className={cn("w-4 h-4", rule.category_id === 0 ? "text-red-400" : "text-slate-400")} />}
                  <span className={cn("truncate", rule.category_id === 0 ? "text-red-500 italic" : "text-slate-500 dark:text-slate-400")}>
                    {cat?.name || 'Select category...'}
                  </span>
                </>
              );
            })()}
          </div>
        )}
      </td>
      <td className={cn("w-12 px-2 text-center", compactView ? "py-1" : "py-2", isDragging && "relative z-50 bg-blue-50 dark:bg-blue-900/40 shadow border-y border-blue-200")}>
        <DeleteButton onDelete={() => handleDelete(rule.id!)} />
      </td>
    </tr>
  );
}

export function SettingsView({ 
  currentFilePath, 
  sessionPassword,
  onOpen, 
  onSave, 
  onSaveAs,
  onClearData 
}: { 
  currentFilePath?: string | null, 
  sessionPassword?: string | null,
  onOpen?: () => void, 
  onSave?: () => void, 
  onSaveAs?: () => void,
  onClearData?: () => void 
} = {}) {
  const [activeTab, setActiveTab] = useState<'accounts' | 'categories' | 'automation' | 'ui' | 'data'>('accounts');
  const accountTypes = useLiveQuery(() => db.account_types.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [securitySuccessMessage, setSecuritySuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateSetting = async (key: string, value: any) => {
    await db.settings.put({ key, value, updated_at: Date.now() });
  };

  const accentColor = settings?.find(s => s.key === 'accentColor')?.value || '#2563eb';
  const topBarColor = settings?.find(s => s.key === 'topBarColor')?.value || '#ffffff';
  const homeCurrency = settings?.find(s => s.key === 'homeCurrency')?.value || '€';
  const darkMode = settings?.find(s => s.key === 'darkMode')?.value || false;
  const compactView = settings?.find(s => s.key === 'compactView')?.value || false;
  
  const handleBackup = async () => {
    try {
      let finalString = await generateExportData();
      
      if (isEncryptionEnabled && sessionPassword) {
        finalString = await encryptData(finalString, sessionPassword);
      }
      
      const fileName = `onefilefinance-backup-${format(new Date(), 'yyyy-MM-dd')}.fin`;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: 'OneFileFinance Data',
              accept: { 'application/octet-stream': ['.fin'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(finalString);
          await writable.close();
          await updateSetting('lastBackup', Date.now());
          setSuccessMessage(`Backup exported successfully to ${handle.name}`);
          setTimeout(() => setSuccessMessage(null), 5000);
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          // Fallback to traditional download if File System Access API fails
        }
      }

      const blob = new Blob([finalString], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      await updateSetting('lastBackup', Date.now());
      setSuccessMessage(`Backup exported successfully to your Downloads folder`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Backup failed:', err);
      setError('Failed to export backup');
    }
  };

  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const hasPassword = useMemo(() => !!settings?.find(s => s.key === 'appPasswordHash')?.value, [settings]);
  const isEncryptionEnabled = !!settings?.find(s => s.key === 'fileEncryptionEnabled')?.value;

  const handleSetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 1) {
      setError("Password cannot be empty");
      return;
    }

    try {
      const salt = generateSaltHex();
      const hash = await hashPassword(newPassword, salt);
      
      await db.settings.put({ key: 'appPasswordHash', value: hash, updated_at: Date.now() });
      await db.settings.put({ key: 'appPasswordSalt', value: salt, updated_at: Date.now() });

      try {
        const currentFilePath = settings?.find(s => s.key === 'currentFilePath')?.value;
        if (currentFilePath && (window as any).__TAURI_INTERNALS__) {
          await saveDatabaseToFile(currentFilePath, newPassword);
        }
      } catch (e: any) {
        console.error("Save after password change failed", e);
      }
      
      setSecuritySuccessMessage('Password successfully updated');
      setShowPasswordSetup(false);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSecuritySuccessMessage(null), 5000);
      setTimeout(() => window.location.reload(), 1000); // Reload App
    } catch (err) {
      console.error(err);
      setError('Failed to configure password');
    }
  };

  const handleRemovePassword = async () => {
    await db.settings.delete('appPasswordHash');
    await db.settings.delete('appPasswordSalt');
    await db.settings.put({ key: 'fileEncryptionEnabled', value: false, updated_at: Date.now() });

    try {
      const currentFilePath = settings?.find(s => s.key === 'currentFilePath')?.value;
      if (currentFilePath && (window as any).__TAURI_INTERNALS__) {
        await saveDatabaseToFile(currentFilePath, null);
      }
    } catch (e: any) {
      console.error("Save after password removal failed", e);
    }

    setSecuritySuccessMessage('Password protection removed');
    setTimeout(() => setSecuritySuccessMessage(null), 5000);
    setTimeout(() => window.location.reload(), 1000); // Reload App
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsConfirmingRestore(true);
    // Store the file in a ref to use after confirmation
    restoreFileRef.current = file;
  };

  const executeRestore = async () => {
    const file = restoreFileRef.current;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let text = event.target?.result as string;
        
        if (text.startsWith('OFF_ENC::')) {
          if (!sessionPassword) {
            alert('This file is encrypted. You must unlock the app with the correct password first, or log out and log back in.');
            setIsConfirmingRestore(false);
            return;
          }
          text = await decryptData(text, sessionPassword);
        }

        await processImportData(text);
        
        setIsConfirmingRestore(false);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('Failed to restore data. Invalid file format.');
        setIsConfirmingRestore(false);
      }
    };
    reader.readAsText(file);
  };

  const restoreFileRef = useRef<File | null>(null);

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="flex gap-1 mb-8 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit overflow-x-auto no-scrollbar">
        {[
          { id: 'accounts', label: 'Accounts', icon: Wallet },
          { id: 'categories', label: 'Categories', icon: Tag },
          { id: 'automation', label: 'Automation', icon: Zap },
          { id: 'ui', label: 'UI / Display', icon: Eye },
          { id: 'data', label: 'Data Management', icon: Download },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white dark:bg-slate-800 text-accent shadow-sm" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {activeTab === 'accounts' && (
          <section className="animate-fade-in space-y-8">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-accent" />
                  Manage Accounts
                </h2>
              </div>

              <AccountTable />
            </div>

            <div className="pt-8 border-t border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-6">
                <LayoutDashboard className="w-5 h-5 text-accent" />
                Account Types
              </h2>
              <AccountTypeTable />
            </div>
          </section>
        )}

        {activeTab === 'categories' && (
          <section className="animate-fade-in max-w-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Tag className="w-5 h-5 text-accent" />
              Categories
            </h2>
            <CategoryTable />
          </section>
        )}

        {activeTab === 'automation' && (
          <section className="animate-fade-in">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" />
              Auto-Categorization Rules
            </h2>
            <CategoryRuleTable />
          </section>
        )}

        {activeTab === 'ui' && (
          <section className="animate-fade-in max-w-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
              <Eye className="w-5 h-5 text-accent" />
              UI / Display Settings
            </h2>
            
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="p-6 space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Compact View</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Make transaction view narrower to fit more transactions on screen</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div 
                          onClick={() => updateSetting('compactView', !compactView)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-colors relative",
                            compactView ? "bg-accent" : "bg-slate-300 dark:bg-slate-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                            compactView ? "left-6" : "left-1"
                          )} />
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Home Currency</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">The default currency used for all accounts</p>
                    </div>
                    <select 
                      value={homeCurrency}
                      onChange={(e) => updateSetting('homeCurrency', e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all dark:text-slate-100"
                    >
                      <option value="€">€ (Euro)</option>
                      <option value="$">$ (US Dollar)</option>
                      <option value="£">£ (British Pound)</option>
                      <option value="¥">¥ (Japanese Yen)</option>
                      <option value="CHF">CHF (Swiss Franc)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-8 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Number Format</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">How amounts are displayed</p>
                    </div>
                    <select 
                      value={settings?.find(s => s.key === 'numberFormat')?.value || 'default'}
                      onChange={(e) => updateSetting('numberFormat', e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all dark:text-slate-100"
                    >
                      <option value="default">Default ($1,000.00)</option>
                      <option value="space-comma">Space & Comma (1 000,00 €)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Dark Mode</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Switch between light and dark theme</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div 
                          onClick={() => updateSetting('darkMode', !darkMode)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-colors relative",
                            darkMode ? "bg-accent" : "bg-slate-300 dark:bg-slate-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                            darkMode ? "left-6" : "left-1"
                          )} />
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Accent Color</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Used for buttons, active states, and highlights</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="relative flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <div 
                          className="w-4 h-4 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm" 
                          style={{ backgroundColor: accentColor }}
                        />
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase">{accentColor}</span>
                        <input 
                          type="color" 
                          value={accentColor}
                          onChange={(e) => updateSetting('accentColor', e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                    {['#2563eb', '#3b82f6', '#0ea5e9', '#06b6d4', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#64748b', '#475569', '#0f172a'].map(color => (
                      <button
                        key={color}
                        onClick={() => updateSetting('accentColor', color)}
                        className={cn(
                          "h-8 rounded-lg border-2 transition-all",
                          accentColor.toLowerCase() === color.toLowerCase() ? (darkMode ? "border-white" : "border-slate-900") + " scale-110 shadow-md" : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Top Bar Background</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">The background color of the navigation bar</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="relative flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <div 
                          className="w-4 h-4 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm" 
                          style={{ backgroundColor: topBarColor }}
                        />
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase">{topBarColor}</span>
                        <input 
                          type="color" 
                          value={topBarColor}
                          onChange={(e) => updateSetting('topBarColor', e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                    {(darkMode 
                      ? ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#000000', '#111827', '#1f2937', '#374151', '#4b5563']
                      : ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#fef2f2', '#fff7ed', '#f0fdf4', '#f0f9ff', '#f5f3ff', '#fdf2f8', '#fff1f2', '#fafaf9']
                    ).map(color => (
                      <button
                        key={color}
                        onClick={() => updateSetting('topBarColor', color)}
                        className={cn(
                          "h-8 rounded-lg border-2 transition-all",
                          topBarColor.toLowerCase() === color.toLowerCase() ? (darkMode ? "border-white" : "border-slate-900") + " scale-110 shadow-md" : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'data' && (
          <section className="animate-fade-in max-w-2xl">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Data Management</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Backup and restore your local financial data</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  OneFileFinance stores all your data locally in your browser's IndexedDB. 
                  This ensures your privacy and works offline. However, clearing your browser data 
                  may delete your records. We recommend regular backups into a OneFileFinance (.fin) file.
                </p>
                <div className="flex items-center text-sm">
                  <span className="text-slate-500 dark:text-slate-400 font-medium mr-2">Last Saved:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {settings?.find(s => s.key === 'lastBackup')?.value 
                      ? format(new Date(settings.find(s => s.key === 'lastBackup')?.value as number), 'MMM d, yyyy h:mm a')
                      : 'Never'}
                  </span>
                </div>
                <div className="flex gap-3 mt-4">
                  {(window as any).__TAURI_INTERNALS__ ? (
                    <div className="w-full space-y-4">
                      <div className="flex items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                        <span className="text-sm text-slate-500 mr-2">Current File:</span>
                        <span className="text-sm font-mono text-slate-900 dark:text-slate-100 truncate flex-1">
                          {currentFilePath || 'Unsaved'}
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={onOpen}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                          <Upload className="w-4 h-4" />
                          Open
                        </button>
                        <button 
                          onClick={onSave}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                        >
                          <Download className="w-4 h-4" />
                          Save
                        </button>
                        <button 
                          onClick={onSaveAs}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                          <Download className="w-4 h-4" />
                          Save As
                        </button>
                        <button
                          onClick={() => setIsConfirmingClear(true)}
                          className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors rounded-lg flex-shrink-0"
                          title="Clear All Data"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={handleBackup}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        Export Backup
                      </button>
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm">
                        <Upload className="w-4 h-4" />
                        Import Data
                        <input type="file" accept=".fin,.json" className="hidden" onChange={handleRestore} />
                      </label>
                      <button
                        onClick={() => setIsConfirmingClear(true)}
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors rounded-lg flex-shrink-0 shadow-sm"
                        title="Clear All Data"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
                {successMessage && (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl animate-fade-in">
                    <p className="text-sm text-emerald-800 dark:text-emerald-400 font-medium flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      {successMessage}
                    </p>
                  </div>
                )}
                {isConfirmingRestore && (
                  <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40 rounded-xl animate-fade-in">
                    <p className="text-sm text-rose-800 dark:text-rose-400 font-medium mb-3">
                      Warning: This will overwrite all current data. Are you sure?
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={executeRestore}
                        className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors"
                      >
                        Yes, Overwrite Everything
                      </button>
                      <button 
                        onClick={() => setIsConfirmingRestore(false)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {isConfirmingClear && (
                  <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40 rounded-xl animate-fade-in">
                    <p className="text-sm text-rose-800 dark:text-rose-400 font-medium mb-3">
                      Are you sure you want to clear all data? This action cannot be undone and all data will be lost!
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setIsConfirmingClear(false);
                          if (onClearData) onClearData();
                        }}
                        className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors"
                      >
                        Yes, Clear Everything
                      </button>
                      <button 
                        onClick={() => setIsConfirmingClear(false)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mt-8">
              <div className="p-8 space-y-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Security</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage password protection and encryption</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-100 dark:border-slate-800 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Password Protection</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">Require a password to access this app and optionally encrypt backup files.</p>
                    </div>
                    <div>
                      {!hasPassword ? (
                        <button 
                          onClick={() => { setShowPasswordSetup(true); setError(null); }}
                          className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
                        >
                          Set Password
                        </button>
                      ) : (
                        <button 
                          onClick={handleRemovePassword}
                          className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-sm font-bold rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors whitespace-nowrap"
                        >
                          Remove Password
                        </button>
                      )}
                    </div>
                  </div>

                  {showPasswordSetup && !hasPassword && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50 space-y-4 animate-fade-in">
                      <div className="space-y-4 max-w-sm">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
                          <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                          <input 
                            type="password" 
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                          />
                        </div>
                        {error && (
                          <div className="text-sm font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button 
                            onClick={handleSetPassword}
                            disabled={!newPassword || !confirmPassword}
                            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => { setShowPasswordSetup(false); setNewPassword(''); setConfirmPassword(''); setError(null); }}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {hasPassword && (
                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          Encrypt Backup Files
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Encrypt backups so they cannot be read without your password</p>
                      </div>
                      <div className="flex items-center gap-3 cursor-pointer group">
                        <div 
                          onClick={async () => {
                            const newVal = !isEncryptionEnabled;
                            await updateSetting('fileEncryptionEnabled', newVal);
                            try {
                              const currentFilePath = settings?.find(s => s.key === 'currentFilePath')?.value;
                              if (currentFilePath && (window as any).__TAURI_INTERNALS__) {
                                await saveDatabaseToFile(currentFilePath, sessionPassword);
                              }
                            } catch (e: any) {
                              alert("Could not update file with new encryption setting: " + (e.message || 'unknown error'));
                            }
                          }}
                          className={cn(
                            "w-10 h-5 rounded-full transition-colors relative",
                            isEncryptionEnabled ? "bg-accent" : "bg-slate-300 dark:bg-slate-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow-sm",
                            isEncryptionEnabled ? "translate-x-5" : "translate-x-0"
                          )} />
                        </div>
                      </div>
                    </div>
                  )}

                  {securitySuccessMessage && (
                    <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl animate-fade-in">
                      <p className="text-sm text-emerald-800 dark:text-emerald-400 font-medium flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        {securitySuccessMessage}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
