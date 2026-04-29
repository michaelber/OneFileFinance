import React, { useState, useRef, useMemo, useEffect } from 'react';
import { db, type Transaction, type Account } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Upload, FileText, Check, AlertCircle, ChevronRight, ChevronDown, Save, X, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parse, isValid, format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { parseAmount } from '../lib/formatters';

interface ImportViewProps {
  onBack: () => void;
  initialAccountId?: number;
  onImportComplete?: (accountId: number | undefined, importedIds: number[]) => void;
}

type Step = 'upload' | 'mapping' | 'preview';

interface ParsedData {
  headers: string[];
  rows: any[][];
}

interface FieldMapping {
  date: string;
  amount: string;
  description: string[];
  externalId: string;
  account: string;
  category: string;
}

interface ProcessedRow {
  original: any[];
  parsed?: Partial<Transaction>;
  status: 'valid' | 'invalid' | 'duplicate';
  errors: string[];
}

export function ImportView({ onBack, initialAccountId, onImportComplete }: ImportViewProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>(initialAccountId || '');
  
  const [mapping, setMapping] = useState<FieldMapping>({
    date: '',
    amount: '',
    description: [],
    externalId: '',
    account: '',
    category: ''
  });

  const [isDescOpen, setIsDescOpen] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (descRef.current && !descRef.current.contains(event.target as Node)) {
        setIsDescOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'invalid' | 'duplicate'>('all');

  const accounts = useLiveQuery(() => db.accounts.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const categoryRules = useLiveQuery(() => db.category_rules.toArray());
  const settings = useLiveQuery(() => db.settings.toArray());
  
  const numberFormat = settings?.find(s => s.key === 'numberFormat')?.value || 'space-comma';

  // Load saved mapping
  useEffect(() => {
    if (selectedAccountId) {
      const savedMapping = settings?.find(s => s.key === `importMapping_${selectedAccountId}`)?.value;
      if (savedMapping) {
        // Ensure description is an array for backwards compatibility
        if (typeof savedMapping.description === 'string') {
          savedMapping.description = savedMapping.description ? [savedMapping.description] : [];
        }
        setMapping({
          ...savedMapping,
          account: savedMapping.account || '',
          category: savedMapping.category || ''
        });
      } else {
        setMapping({
          date: '',
          amount: '',
          description: [],
          externalId: '',
          account: '',
          category: ''
        });
      }
    }
  }, [settings, selectedAccountId]);

  // Clean loaded mapping against actual file headers
  useEffect(() => {
    if (parsedData && mapping) {
      const headers = parsedData.headers;
      let hasChanges = false;
      const newMapping = { ...mapping };

      if (newMapping.date && !headers.includes(newMapping.date)) {
        newMapping.date = '';
        hasChanges = true;
      }
      if (newMapping.amount && !headers.includes(newMapping.amount)) {
        newMapping.amount = '';
        hasChanges = true;
      }
      if (newMapping.externalId && !headers.includes(newMapping.externalId)) {
        newMapping.externalId = '';
        hasChanges = true;
      }
      if (newMapping.account && !headers.includes(newMapping.account)) {
        newMapping.account = '';
        hasChanges = true;
      }
      if (newMapping.category && !headers.includes(newMapping.category)) {
        newMapping.category = '';
        hasChanges = true;
      }
      if (Array.isArray(newMapping.description)) {
        const validDescriptions = newMapping.description.filter(d => headers.includes(d));
        if (validDescriptions.length !== newMapping.description.length) {
          newMapping.description = validDescriptions;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        setMapping(newMapping);
      }
    }
  }, [parsedData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);

    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const isExcel = file.name.toLowerCase().match(/\.(xlsx|xls)$/);

    if (isCSV) {
      Papa.parse(file, {
        preview: 50, // Only preview first 50 rows initially
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as string[][];
          if (data.length > 0) {
            const newParsedData = {
              headers: data[0],
              rows: data.slice(1)
            };
            setParsedData(newParsedData);
            
            if (mapping.date && mapping.amount && Array.isArray(mapping.description) && mapping.description.length > 0 && 
                newParsedData.headers.includes(mapping.date) && 
                newParsedData.headers.includes(mapping.amount) && 
                mapping.description.every(d => newParsedData.headers.includes(d))) {
              processData(newParsedData, file);
            } else {
              setStep('mapping');
            }
          }
        }
      });
    } else if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (json.length > 0) {
          const newParsedData = {
            headers: json[0].map(String),
            rows: json.slice(1, 51) // Preview first 50
          };
          setParsedData(newParsedData);
          
          if (mapping.date && mapping.amount && Array.isArray(mapping.description) && mapping.description.length > 0 && 
              newParsedData.headers.includes(mapping.date) && 
              newParsedData.headers.includes(mapping.amount) && 
              mapping.description.every(d => newParsedData.headers.includes(d))) {
            processData(newParsedData, file);
          } else {
            setStep('mapping');
          }
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleMappingChange = (field: keyof FieldMapping, value: string | string[]) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    
    // Handle Excel serial dates
    if (!isNaN(Number(dateStr)) && Number(dateStr) > 20000) {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + Number(dateStr) * 86400000);
      if (isValid(d)) return format(d, 'yyyy-MM-dd');
    }

    // Try standard ISO
    let d = parseISO(dateStr);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
    
    // Try some common formats
    const formats = ['dd.MM.yyyy', 'MM/dd/yyyy', 'yyyy/MM/dd', 'dd-MM-yyyy', 'dd/MM/yyyy'];
    for (const fmt of formats) {
      d = parse(dateStr, fmt, new Date());
      if (isValid(d)) return format(d, 'yyyy-MM-dd');
    }
    return null;
  };

  const processData = async (currentParsedData = parsedData, currentFile = file) => {
    if (!currentParsedData || !currentFile) return;

    // Automatically save mapping when proceeding
    if (selectedAccountId) {
      await db.settings.put({ key: `importMapping_${selectedAccountId}`, value: mapping, updated_at: Date.now() });
    }

    // We need to parse the full file now, not just the preview
    let fullRows: any[][] = [];
    
    if (currentFile.name.toLowerCase().endsWith('.csv')) {
      const text = await currentFile.text();
      const results = Papa.parse(text, { skipEmptyLines: true });
      fullRows = (results.data as string[][]).slice(1);
    } else if (currentFile.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
      const data = await currentFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      fullRows = (XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]).slice(1);
    }

    const existingTransactions = selectedAccountId ? await db.transactions.where('account_id').equals(Number(selectedAccountId)).toArray() : await db.transactions.toArray();
    const allAccounts = await db.accounts.toArray();
    const allCategories = await db.categories.toArray();
    const categoryRules = await db.category_rules.orderBy('priority').toArray();
    
    const dateIdx = currentParsedData.headers.indexOf(mapping.date);
    const amountIdx = currentParsedData.headers.indexOf(mapping.amount);
    const descArray = Array.isArray(mapping.description) ? mapping.description : [mapping.description].filter(Boolean);
    const descIndices = descArray.map(d => currentParsedData.headers.indexOf(d as string)).filter(idx => idx !== -1);
    const extIdIdx = mapping.externalId ? currentParsedData.headers.indexOf(mapping.externalId) : -1;
    const accountIdx = mapping.account ? currentParsedData.headers.indexOf(mapping.account) : -1;
    const categoryIdx = mapping.category ? currentParsedData.headers.indexOf(mapping.category) : -1;

    const processed: ProcessedRow[] = fullRows.map(row => {
      const errors: string[] = [];
      const dateStr = row[dateIdx]?.toString() || '';
      const amountStr = row[amountIdx]?.toString() || '';
      const descStr = descIndices.map(idx => row[idx]?.toString() || '').join(' ').trim();
      const extIdStr = extIdIdx >= 0 ? row[extIdIdx]?.toString() : undefined;
      const accountStr = accountIdx >= 0 ? row[accountIdx]?.toString().trim() : undefined;
      const categoryStr = categoryIdx >= 0 ? row[categoryIdx]?.toString().trim() : undefined;

      const parsedDate = parseDate(dateStr);
      if (!parsedDate) errors.push('Invalid or missing date');

      const parsedAmt = parseAmount(amountStr, numberFormat);
      if (isNaN(parsedAmt) || parsedAmt === 0 || amountStr.trim() === '') errors.push('Invalid or missing amount');

      if (!descStr.trim()) errors.push('Missing description');

      let rowAccountId = selectedAccountId ? Number(selectedAccountId) : undefined;
      if (accountStr) {
        const matchedAccount = allAccounts.find(a => a.name.toLowerCase() === accountStr.toLowerCase());
        if (matchedAccount) {
          rowAccountId = matchedAccount.id;
        } else if (!selectedAccountId) {
          errors.push(`Account '${accountStr}' not found`);
        }
      } else if (!selectedAccountId) {
        errors.push('Missing account');
      }

      if (errors.length > 0) {
        return { original: row, status: 'invalid', errors };
      }

      // Auto-categorization
      let categoryId: number | undefined;
      if (categoryStr) {
        const matchedCategory = allCategories.find(c => c.name.toLowerCase() === categoryStr.toLowerCase());
        if (matchedCategory) {
          categoryId = matchedCategory.id;
        }
      }
      
      if (!categoryId && categoryRules) {
        const match = categoryRules.find(r => descStr.toLowerCase().includes(r.search_value.toLowerCase()));
        if (match) categoryId = match.category_id;
      }

      const parsedTx: Partial<Transaction> = {
        date: parsedDate!,
        amount: parsedAmt,
        description: descStr.trim(),
        account_id: rowAccountId!,
        category_id: categoryId,
        external_id: extIdStr?.trim() || undefined,
        updated_at: Date.now()
      };

      // Deduplication
      let isDuplicate = false;
      if (parsedTx.external_id) {
        isDuplicate = existingTransactions.some(t => t.external_id === parsedTx.external_id && t.account_id === parsedTx.account_id);
      } else {
        isDuplicate = existingTransactions.some(t => {
          if (t.account_id !== parsedTx.account_id) return false;
          if (t.amount !== parsedTx.amount) return false;
          if (t.description.trim().toLowerCase() !== parsedTx.description!.toLowerCase()) return false;
          
          const daysDiff = Math.abs(differenceInDays(parseISO(t.date), parseISO(parsedTx.date!)));
          return daysDiff <= 3;
        });
      }

      return {
        original: row,
        parsed: parsedTx,
        status: isDuplicate ? 'duplicate' : 'valid',
        errors: isDuplicate ? ['Duplicate transaction'] : []
      };
    });

    setProcessedRows(processed);
    
    const allValid = processed.every(r => r.status === 'valid');
    if (allValid && processed.length > 0) {
      executeImport(processed);
    } else {
      setStep('preview');
    }
  };

  const executeImport = async (rowsToProcess: ProcessedRow[] = processedRows) => {
    const validRows = rowsToProcess.filter(r => r.status === 'valid' && r.parsed);
    
    try {
      const importedIds: number[] = [];
      await db.transaction('rw', db.transactions, async () => {
        for (const row of validRows) {
          const id = await db.transactions.add(row.parsed as Transaction);
          importedIds.push(id as number);
        }
      });
      
      if (onImportComplete) {
        onImportComplete(selectedAccountId ? Number(selectedAccountId) : undefined, importedIds);
      }
    } catch (error) {
      console.error("Import failed:", error);
      alert("Import failed. Please check the console for details.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Import Transactions</h2>
          </div>
          <button 
            onClick={onBack}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Back to Transactions
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
          <span className={cn(step === 'upload' && "text-blue-600 dark:text-blue-400")}>1. Upload</span>
          <ChevronRight className="w-4 h-4" />
          <span className={cn(step === 'mapping' && "text-blue-600 dark:text-blue-400")}>2. Map Fields</span>
          <ChevronRight className="w-4 h-4" />
          <span className={cn(step === 'preview' && "text-blue-600 dark:text-blue-400")}>3. Preview</span>
        </div>

        {step === 'upload' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Target Account (Optional if mapped from file)
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              >
                <option value="">Select an account (Optional)...</option>
                {accounts?.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative">
              <input 
                type="file" 
                accept=".csv,.xlsx,.xls" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-900 dark:text-slate-100 font-medium mb-1">
                Click or drag file to upload
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Supports CSV and XLSX</p>
            </div>
          </div>
        )}

        {step === 'mapping' && parsedData && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Map Columns</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-2">Required Fields</h4>
                  {Object.entries({
                    date: 'Date',
                    amount: 'Amount',
                    description: 'Description',
                    ...(selectedAccountId ? {} : { account: 'Account' }),
                  }).map(([fieldKey, label]) => (
                    <div key={fieldKey}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {label}
                      </label>
                      {fieldKey === 'description' ? (
                        <div className="relative" ref={descRef}>
                          <div 
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 cursor-pointer flex justify-between items-center min-h-[38px]"
                            onClick={() => setIsDescOpen(!isDescOpen)}
                          >
                            <span className="truncate pr-4">
                              {mapping.description.length > 0 ? mapping.description.join(', ') : '-- Select Columns --'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          </div>
                          
                          {isDescOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-60 overflow-auto">
                              {parsedData.headers.map((h, i) => (
                                <label key={i} className="flex items-center px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={mapping.description.includes(h)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        handleMappingChange('description', [...mapping.description, h]);
                                      } else {
                                        handleMappingChange('description', mapping.description.filter(d => d !== h));
                                      }
                                    }}
                                    className="mr-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                  />
                                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{h}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <select
                          value={mapping[fieldKey as keyof FieldMapping] as string}
                          onChange={(e) => handleMappingChange(fieldKey as keyof FieldMapping, e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                        >
                          <option value="">-- Select Column --</option>
                          {parsedData.headers.map((h, i) => (
                            <option key={i} value={h}>{h}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-6">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-2">Optional Fields</h4>
                  {Object.entries({
                    category: 'Category',
                    externalId: 'Transaction Reference'
                  }).map(([fieldKey, label]) => (
                    <div key={fieldKey}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {label}
                      </label>
                      <select
                        value={mapping[fieldKey as keyof FieldMapping] as string}
                        onChange={(e) => handleMappingChange(fieldKey as keyof FieldMapping, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                      >
                        <option value="">-- Select Column --</option>
                        {parsedData.headers.map((h, i) => (
                          <option key={i} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => processData()}
                  disabled={!mapping.date || !mapping.amount || mapping.description.length === 0 || (!selectedAccountId && !mapping.account)}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Preview Import
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Data Preview (First 50 rows)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                    <tr>
                      {parsedData.headers.map((h, i) => (
                        <th key={i} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {parsedData.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {parsedData.headers.map((_, j) => (
                          <td key={j} className="px-4 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {row[j]?.toString()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <button 
                onClick={() => setFilterStatus('all')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all",
                  filterStatus === 'all' 
                    ? "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-sm ring-1 ring-slate-300 dark:ring-slate-600" 
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100"
                )}
              >
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Rows</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{processedRows.length}</div>
              </button>
              <button 
                onClick={() => setFilterStatus('valid')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all",
                  filterStatus === 'valid'
                    ? "bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 shadow-sm ring-1 ring-emerald-300 dark:ring-emerald-700"
                    : "bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30 hover:border-emerald-300 dark:hover:border-emerald-700 opacity-70 hover:opacity-100"
                )}
              >
                <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">Valid (To Import)</div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {processedRows.filter(r => r.status === 'valid').length}
                </div>
              </button>
              <button 
                onClick={() => setFilterStatus('duplicate')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all",
                  filterStatus === 'duplicate'
                    ? "bg-amber-50 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 shadow-sm ring-1 ring-amber-300 dark:ring-amber-700"
                    : "bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30 hover:border-amber-300 dark:hover:border-amber-700 opacity-70 hover:opacity-100"
                )}
              >
                <div className="text-sm text-amber-600 dark:text-amber-400 mb-1">Duplicates (Skipped)</div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {processedRows.filter(r => r.status === 'duplicate').length}
                </div>
              </button>
              <button 
                onClick={() => setFilterStatus('invalid')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all",
                  filterStatus === 'invalid'
                    ? "bg-rose-50 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700 shadow-sm ring-1 ring-rose-300 dark:ring-rose-700"
                    : "bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/30 hover:border-rose-300 dark:hover:border-rose-700 opacity-70 hover:opacity-100"
                )}
              >
                <div className="text-sm text-rose-600 dark:text-rose-400 mb-1">Invalid (Rejected)</div>
                <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">
                  {processedRows.filter(r => r.status === 'invalid').length}
                </div>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Validation Results</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep('mapping')}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Edit field mapping
                  </button>
                  <button
                    onClick={() => executeImport()}
                    disabled={processedRows.filter(r => r.status === 'valid').length === 0}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Execute Import
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 font-medium">Account</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {processedRows
                      .filter(r => filterStatus === 'all' || r.status === filterStatus)
                      .slice(0, 100)
                      .map((row, i) => (
                      <tr key={i} className={cn(
                        "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                        row.status === 'duplicate' && "bg-amber-50/50 dark:bg-amber-900/10",
                        row.status === 'invalid' && "bg-rose-50/50 dark:bg-rose-900/10"
                      )}>
                        <td className="px-4 py-2">
                          {row.status === 'valid' && <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Valid</span>}
                          {row.status === 'duplicate' && <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Duplicate</span>}
                          {row.status === 'invalid' && <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">Invalid</span>}
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{row.parsed?.date || row.original[parsedData!.headers.indexOf(mapping.date)]}</td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{row.parsed?.amount || row.original[parsedData!.headers.indexOf(mapping.amount)]}</td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300 truncate max-w-xs">{row.parsed?.description || row.original[parsedData!.headers.indexOf(mapping.description[0])]}</td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300 truncate max-w-xs">{row.parsed?.account_id ? accounts?.find(a => a.id === row.parsed?.account_id)?.name : (mapping.account ? row.original[parsedData!.headers.indexOf(mapping.account)] : '')}</td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300 truncate max-w-xs">{row.parsed?.category_id ? categories?.find(c => c.id === row.parsed?.category_id)?.name : (mapping.category ? row.original[parsedData!.headers.indexOf(mapping.category)] : '')}</td>
                        <td className="px-4 py-2 text-rose-600 dark:text-rose-400 text-xs">{row.errors.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {processedRows.length > 100 && (
                  <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                    Showing first 100 rows
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
