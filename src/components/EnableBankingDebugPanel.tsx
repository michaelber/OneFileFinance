import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  generateEnableBankingJWT,
  getApplicationDetails,
  getASPSPs,
  getTransactions,
  analyzeBankTransactions,
  type AnalysisResult,
} from '../services/enableBankingService';
import { db } from '../db';
import { ChevronDown, ChevronRight, Copy, Check, Bug, Loader2, Play, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface EnableBankingDebugPanelProps {
  sessionPassword?: string | null;
}

type PanelId = 'jwt' | 'appDetails' | 'aspsps' | 'transactions' | 'dryRunImport';

function JsonViewer({ data }: { data: unknown }) {
  return (
    <pre className="text-xs text-slate-300 bg-slate-900 rounded-lg p-4 overflow-auto max-h-80 font-mono whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function ResultBlock({
  loading,
  error,
  result,
}: {
  loading: boolean;
  error: string | null;
  result: unknown;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Running...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-400 font-mono break-all">
        {error}
      </div>
    );
  }
  if (result !== null && result !== undefined) {
    return <JsonViewer data={result} />;
  }
  return null;
}

function Panel({
  id,
  title,
  description,
  openPanel,
  setOpenPanel,
  children,
}: {
  id: PanelId;
  title: string;
  description: string;
  openPanel: PanelId | null;
  setOpenPanel: (p: PanelId | null) => void;
  children: React.ReactNode;
}) {
  const isOpen = openPanel === id;
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        onClick={() => setOpenPanel(isOpen ? null : id)}
      >
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</div>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>
      {isOpen && <div className="p-4 space-y-3 bg-white dark:bg-slate-900">{children}</div>}
    </div>
  );
}

export function EnableBankingDebugPanel({ sessionPassword }: EnableBankingDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);

  // JWT
  const [jwtLoading, setJwtLoading] = useState(false);
  const [jwtResult, setJwtResult] = useState<string | null>(null);
  const [jwtError, setJwtError] = useState<string | null>(null);
  const [jwtCopied, setJwtCopied] = useState(false);

  // App Details
  const [appDetailsLoading, setAppDetailsLoading] = useState(false);
  const [appDetailsResult, setAppDetailsResult] = useState<unknown>(null);
  const [appDetailsError, setAppDetailsError] = useState<string | null>(null);

  // ASPSPs
  const [aspspsLoading, setAspspsLoading] = useState(false);
  const [aspspsResult, setAspspsResult] = useState<unknown>(null);
  const [aspspsError, setAspspsError] = useState<string | null>(null);

  // Transactions
  const linkedAccounts = useLiveQuery(
    () => db.accounts.filter(a => !!a.eb_account_id).toArray(),
    []
  ) ?? [];
  const [txSelectedAccountId, setTxSelectedAccountId] = useState<number | ''>('');
  const [txDateFrom, setTxDateFrom] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [txLoading, setTxLoading] = useState(false);
  const [txResult, setTxResult] = useState<unknown>(null);
  const [txError, setTxError] = useState<string | null>(null);


  // Dry-run import
  const [dryRunPayload, setDryRunPayload] = useState('');
  const [dryRunAccountId, setDryRunAccountId] = useState<number | ''>('');
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<AnalysisResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);

  // --- Actions ---

  const runJwt = async () => {
    setJwtLoading(true);
    setJwtResult(null);
    setJwtError(null);
    try {
      const token = await generateEnableBankingJWT(sessionPassword);
      setJwtResult(token);
    } catch (e: any) {
      setJwtError(e.message || String(e));
    } finally {
      setJwtLoading(false);
    }
  };

  const copyJwt = async () => {
    if (!jwtResult) return;
    await navigator.clipboard.writeText(jwtResult);
    setJwtCopied(true);
    setTimeout(() => setJwtCopied(false), 2000);
  };

  const runAppDetails = async () => {
    setAppDetailsLoading(true);
    setAppDetailsResult(null);
    setAppDetailsError(null);
    try {
      const res = await getApplicationDetails(sessionPassword);
      setAppDetailsResult(res);
    } catch (e: any) {
      setAppDetailsError(e.message || String(e));
    } finally {
      setAppDetailsLoading(false);
    }
  };

  const runAspsps = async () => {
    setAspspsLoading(true);
    setAspspsResult(null);
    setAspspsError(null);
    try {
      const res = await getASPSPs(sessionPassword);
      setAspspsResult(res);
    } catch (e: any) {
      setAspspsError(e.message || String(e));
    } finally {
      setAspspsLoading(false);
    }
  };

  const runTransactions = async () => {
    if (!txSelectedAccountId) {
      setTxError('Please select an account');
      return;
    }
    const account = linkedAccounts.find(a => a.id === txSelectedAccountId);
    if (!account?.eb_account_id) {
      setTxError('Selected account has no linked bank UID');
      return;
    }
    setTxLoading(true);
    setTxResult(null);
    setTxError(null);
    try {
      const res = await getTransactions(account.eb_account_id, txDateFrom, undefined, sessionPassword);
      setTxResult(res);
    } catch (e: any) {
      setTxError(e.message || String(e));
    } finally {
      setTxLoading(false);
    }
  };

  const runDryImport = async () => {
    setDryRunLoading(true);
    setDryRunResult(null);
    setDryRunError(null);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(dryRunPayload);
      } catch {
        throw new Error('Invalid JSON payload');
      }

      const rawTransactions: any[] = parsed.transactions || (Array.isArray(parsed) ? parsed : [parsed]);
      const accountId = dryRunAccountId ? dryRunAccountId : undefined;

      const result = await analyzeBankTransactions(rawTransactions, accountId);
      setDryRunResult(result);
    } catch (e: any) {
      setDryRunError(e.message || String(e));
    } finally {
      setDryRunLoading(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
      {/* Top-level toggle header */}
      <button
        className="w-full flex items-center justify-between group"
        onClick={() => setIsExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-500" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            API Debug Panel
          </h4>
        </div>
        {isExpanded
          ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
          : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
        }
      </button>

      {isExpanded && (
        <div className="space-y-2 mt-4">

          {/* 1. JWT */}
          <Panel
            id="jwt"
            title="1. Generate JWT"
            description="Generate and inspect the signed JWT used for API auth"
            openPanel={openPanel}
            setOpenPanel={setOpenPanel}
          >
            <button
              onClick={runJwt}
              disabled={jwtLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {jwtLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Generate JWT
            </button>
            {jwtResult && (
              <div className="space-y-2">
                <div className="relative">
                  <pre className="text-xs text-slate-300 bg-slate-900 rounded-lg p-4 overflow-auto max-h-28 font-mono break-all whitespace-pre-wrap">
                    {jwtResult}
                  </pre>
                  <button
                    onClick={copyJwt}
                    className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                    title="Copy JWT"
                  >
                    {jwtCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Paste into{' '}
                  <a href="https://jwt.io" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                    jwt.io
                  </a>{' '}
                  to inspect the payload and verify the signature.
                </p>
              </div>
            )}
            {jwtError && <ResultBlock loading={false} error={jwtError} result={null} />}
          </Panel>

          {/* 2. Application Details */}
          <Panel
            id="appDetails"
            title="2. GET /application"
            description="Fetch your app details and configured redirect URLs"
            openPanel={openPanel}
            setOpenPanel={setOpenPanel}
          >
            <button
              onClick={runAppDetails}
              disabled={appDetailsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {appDetailsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Fetch Application Details
            </button>
            <ResultBlock loading={appDetailsLoading} error={appDetailsError} result={appDetailsResult} />
          </Panel>

          {/* 3. ASPSPs */}
          <Panel
            id="aspsps"
            title="3. GET /aspsps"
            description="List all supported banks (ASPSPs)"
            openPanel={openPanel}
            setOpenPanel={setOpenPanel}
          >
            <button
              onClick={runAspsps}
              disabled={aspspsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {aspspsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Fetch Banks
            </button>
            <ResultBlock loading={aspspsLoading} error={aspspsError} result={aspspsResult} />
          </Panel>

          {/* 4. Transactions */}
          <Panel
            id="transactions"
            title="4. GET /accounts/{uid}/transactions"
            description="Fetch raw transactions for a linked bank account UID"
            openPanel={openPanel}
            setOpenPanel={setOpenPanel}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Account <span className="text-rose-500">*</span>
                </label>
                {linkedAccounts.length === 0 ? (
                  <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                    No linked bank accounts found. Use the{' '}
                    <span className="font-semibold">Connect Bank Account</span>{' '}
                    wizard (dashboard → Sync Bank) to link an account first.
                  </div>
                ) : (
                  <select
                    value={txSelectedAccountId}
                    onChange={e => setTxSelectedAccountId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="">— Select account —</option>
                    {linkedAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.eb_account_id ? ` (${a.eb_account_id.substring(0, 8)}…)` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={txDateFrom}
                  onChange={e => setTxDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
            </div>
            <button
              onClick={runTransactions}
              disabled={txLoading || !txSelectedAccountId || linkedAccounts.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {txLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Fetch Transactions
            </button>
            <ResultBlock loading={txLoading} error={txError} result={txResult} />
          </Panel>

          {/* 5. Dry-Run Import */}
          <Panel
            id="dryRunImport"
            title="5. Dry-Run Import"
            description="Paste a raw API response and see what would be inserted vs. skipped — without writing to DB"
            openPanel={openPanel}
            setOpenPanel={setOpenPanel}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Target Account (optional — used for duplicate check)
                </label>
                <select
                  value={dryRunAccountId}
                  onChange={e => setDryRunAccountId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="">— Check against all transactions —</option>
                  {linkedAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.eb_account_id?.substring(0, 8)}…)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Paste API Response JSON
                </label>
                <textarea
                  value={dryRunPayload}
                  onChange={e => setDryRunPayload(e.target.value)}
                  rows={8}
                  placeholder={'{\n  "transactions": [...]\n}'}
                  className="w-full px-3 py-2 bg-slate-900 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500/20 outline-none resize-y"
                />
              </div>
              <button
                onClick={runDryImport}
                disabled={dryRunLoading || !dryRunPayload.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {dryRunLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Dry-Run (no DB write)
              </button>
              {dryRunResult && (
                <div className="space-y-2">
                  <div className="flex gap-3 text-sm font-semibold">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300">
                      Total: {dryRunResult.total}
                    </span>
                    <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded text-emerald-700 dark:text-emerald-400">
                      ✓ Insert: {dryRunResult.would_insert}
                    </span>
                    <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded text-amber-700 dark:text-amber-400">
                      ⚠ Skip: {dryRunResult.duplicates}
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg max-h-[400px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                          <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                          <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">Description</th>
                          <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {dryRunResult.results.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-3 py-2">
                              {r.status === 'WOULD_INSERT' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                  <Check className="w-3 h-3" /> Insert
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium cursor-help" title={r.duplicateReason}>
                                  <AlertCircle className="w-3 h-3" /> Skip
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.mapped.date}</td>
                            <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{r.mapped.description}</td>
                            <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${r.mapped.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                              {r.mapped.amount > 0 ? '+' : ''}{r.mapped.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {dryRunError && <ResultBlock loading={false} error={dryRunError} result={null} />}
            </div>
          </Panel>

        </div>
      )}
    </div>
  );
}
