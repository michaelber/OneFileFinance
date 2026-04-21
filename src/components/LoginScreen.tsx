import React, { useState } from 'react';
import { db } from '../db';
import { hashPassword } from '../lib/crypto';
import { Lock, AlertCircle, File, FolderOpen } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (password: string) => void;
  currentFilePath?: string | null;
  pendingFilePath?: string | null;
  onOpenFile?: (password: string, onStartLoading?: () => void) => Promise<void>;
  onUnlockPending?: (password: string) => Promise<void>;
}

export function LoginScreen({ onLogin, currentFilePath, pendingFilePath, onOpenFile, onUnlockPending }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (pendingFilePath && onUnlockPending) {
         try {
            await onUnlockPending(password);
         } catch(err: any) {
            setError(err.message === 'VERIFICATION_FAILED' ? 'Incorrect password for this file' : 'Failed to decrypt file');
         }
         setLoading(false);
         return;
      }

      const hashObj = await db.settings.get('appPasswordHash');
      const saltObj = await db.settings.get('appPasswordSalt');

      if (hashObj && saltObj) {
        const attemptHash = await hashPassword(password, saltObj.value);
        if (attemptHash === hashObj.value) {
          onLogin(password);
        } else {
          setError('Incorrect password');
        }
      } else {
        // Fallback if settings are messed up but screen still rendered
        onLogin(password);
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during verification');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 antialiased transition-colors duration-300">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 transform transition-all">
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/favicon.svg" 
            alt="OneFileFinance Logo" 
            className="w-16 h-16 mb-4 drop-shadow-sm"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">OneFileFinance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
            {pendingFilePath ? `Enter password to decrypt the selected file` : `This app is password protected`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Password
            </label>
            <input
              type="password"
              autoFocus
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 rounded-xl flex items-start gap-2 text-rose-600 dark:text-rose-400 mt-4 animate-fade-in">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center shadow-sm disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>

        {currentFilePath && (
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4 text-slate-500 dark:text-slate-400">
              <File className="w-4 h-4" />
              <div className="text-xs truncate" title={currentFilePath}>
                {/* Keep path mostly hidden unless hovered, or just show last part */}
                <span className="font-semibold">Linked File:</span> {currentFilePath.split(/[\\/]/).pop()}
              </div>
            </div>
            
            {(window as any).__TAURI_INTERNALS__ && onOpenFile && (
              <button
                type="button"
                onClick={async () => {
                  await onOpenFile(password, () => setLoading(true));
                  setLoading(false);
                }}
                className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Open different file...
              </button>
            )}
          </div>
        )}
        
        {!currentFilePath && !pendingFilePath && (window as any).__TAURI_INTERNALS__ && onOpenFile && (
          <div className="mt-6">
            <button
              type="button"
              onClick={async () => {
                await onOpenFile(password, () => setLoading(true));
                setLoading(false);
              }}
              className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Open existing file...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
