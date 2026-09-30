import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getASPSPs, startAuthFlow, syncBankTransactions, type ASPSP } from '../services/enableBankingService';
import { Landmark, ArrowLeft, Loader2, AlertCircle, Check, Search, ChevronDown } from 'lucide-react';
import { db } from '../db';

interface EnableBankingSetupProps {
  onBack: () => void;
  onGoToSettings: () => void;
  sessionPassword?: string | null;
  onImportComplete?: (accountId: number | undefined, importedIds: number[]) => void;
}

export function EnableBankingSetup({ onBack, onGoToSettings, sessionPassword, accountId, onImportComplete }: EnableBankingSetupProps & { accountId?: number | null }) {
  const [aspsps, setAspsps] = useState<ASPSP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedAspsp, setSelectedAspsp] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const groupedASPSPs = useMemo(() => {
    const filtered = aspsps.filter(a => 
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.country.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const groups: Record<string, ASPSP[]> = {};
    for (const bank of filtered) {
      if (!groups[bank.country]) groups[bank.country] = [];
      groups[bank.country].push(bank);
    }
    
    return Object.keys(groups).sort().map(country => ({
      country,
      banks: groups[country]
    }));
  }, [aspsps, searchTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadASPSPs() {
      try {
        setLoading(true);
        const res = await getASPSPs(sessionPassword);
        setAspsps(res.aspsps || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load banks');
      } finally {
        setLoading(false);
      }
    }
    loadASPSPs();
  }, [sessionPassword]);

  const handleStartAuth = async () => {
    if (!selectedAspsp) return;
    try {
      setLoading(true);
      setError(null);
      
      const aspsp = aspsps.find(a => a.name === selectedAspsp);
      if (!aspsp) return;

      const { getApplicationDetails, createSession } = await import('../services/enableBankingService');
      const appDetails = await getApplicationDetails(sessionPassword);
      const redirectUrl = appDetails.redirect_urls[0];
      
      if (!redirectUrl) {
        throw new Error('No redirect URL configured in EnableBanking portal');
      }

      const { url } = await startAuthFlow(aspsp.name, aspsp.country, redirectUrl, sessionPassword);
      
      if (!(window as any).__TAURI_INTERNALS__) {
        window.open(url, '_blank', 'width=800,height=800');
      } else {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_auth_window', { url });
      }

      // Listen for the OAuth redirect code
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<string>('enablebanking-redirect', async (event) => {
        unlisten();
        const urlStr = event.payload;
        try {
          const urlObj = new URL(urlStr);
          const code = urlObj.searchParams.get('code');
          const errParam = urlObj.searchParams.get('error');

          if (errParam) {
            setError(`Authentication error: ${errParam}`);
            setLoading(false);
            return;
          }
          
          if (code) {
            const sessionData = await createSession(code, sessionPassword);
            console.log('Session created!', sessionData);
            
            const bankAccounts = sessionData.accounts || [];
            let importedIds: number[] = [];

            if (accountId && bankAccounts.length > 0) {
              const ba = bankAccounts[0];

              // Link the account in DB
              await db.accounts.update(accountId, { eb_account_id: ba.uid });

              // Determine date range: start from latest existing tx or 90 days ago
              const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              const txs = await db.transactions.where('account_id').equals(accountId).sortBy('date');
              const validTxs = txs.filter(t => typeof t.date === 'string' && t.date.match(/^\d{4}-\d{2}-\d{2}/));
              const dateFrom = validTxs.length > 0 ? validTxs[validTxs.length - 1].date.substring(0, 10) : ninetyDaysAgo;

              importedIds = await syncBankTransactions(accountId, ba.uid, dateFrom, sessionPassword);
            }
            
            if (onImportComplete) {
              onImportComplete(accountId ? accountId : undefined, importedIds);
            } else {
              onBack();
            }
          } else {
            setError('No authorization code received.');
            setLoading(false);
          }
        } catch (e: any) {
          setError(e.message || 'Failed to exchange code for session');
          setLoading(false);
        }
      });
      
    } catch (err: any) {
      setError(err.message || 'Failed to start auth flow');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <header className="max-w-3xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Connect Bank Account</h2>
            <p className="text-slate-500 dark:text-slate-400">Securely link your bank to import transactions.</p>
          </div>
        </div>
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </header>

      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        {loading && aspsps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Connecting to EnableBanking...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 rounded-xl text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-rose-900 dark:text-rose-100 mb-1">Connection Failed</h3>
            <p className="text-sm text-rose-700 dark:text-rose-300 mb-4">{error}</p>
            <button 
              onClick={onGoToSettings}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-bold rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-colors"
            >
              Check Settings
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Select your Bank
              </label>
              <div className="relative" ref={dropdownRef}>
                <div 
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium cursor-pointer"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span className={selectedAspsp ? "text-slate-900 dark:text-white" : "text-slate-500"}>
                    {selectedAspsp ? aspsps.find(a => a.name === selectedAspsp)?.name || selectedAspsp : "-- Select a Bank --"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
                
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-[400px]">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search banks by name or country..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-4">
                      {groupedASPSPs.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">No banks found.</div>
                      ) : (
                        groupedASPSPs.map(group => (
                          <div key={group.country} className="space-y-1">
                            <div className="px-3 py-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky top-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm z-10 rounded">
                              {group.country}
                            </div>
                            {group.banks.map(bank => (
                              <div
                                key={`${bank.name}-${bank.country}`}
                                onClick={() => {
                                  setSelectedAspsp(bank.name);
                                  setIsDropdownOpen(false);
                                  setSearchTerm('');
                                }}
                                className={`px-4 py-2.5 text-sm cursor-pointer rounded-lg flex items-center justify-between transition-colors ${
                                  selectedAspsp === bank.name 
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium' 
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {bank.name}
                                {selectedAspsp === bank.name && <Check className="w-4 h-4" />}
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={handleStartAuth}
              disabled={!selectedAspsp || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Landmark className="w-5 h-5" />}
              Connect {selectedAspsp || 'Bank'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
