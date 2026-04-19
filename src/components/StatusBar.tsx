import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatusBarProps {
  currentFilePath: string | null;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  onSave: () => void;
  addedRecurringCount: number;
  importedCount: number;
}

export function StatusBar({ currentFilePath, saveStatus, onSave, addedRecurringCount, importedCount }: StatusBarProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (addedRecurringCount > 0) {
      setStatusMessage(`Added ${addedRecurringCount} recurring transaction${addedRecurringCount > 1 ? 's' : ''}`);
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [addedRecurringCount]);

  useEffect(() => {
    if (importedCount > 0) {
      setStatusMessage(`Imported ${importedCount} transaction${importedCount > 1 ? 's' : ''}`);
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [importedCount]);

  return (
    <footer 
      className="h-8 border-t border-slate-200 dark:border-slate-800/50 text-xs flex items-center px-4 shrink-0 transition-colors z-50 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]"
      style={{ 
        backgroundColor: 'var(--top-bar-color)',
        color: 'var(--top-bar-text-color, inherit)'
      }}
    >
      {/* Left side: Save button and File Info. Only show if Tauri */}
      <div className="flex items-center flex-1">
        {(window as any).__TAURI_INTERNALS__ && (
          <>
            <button 
              onClick={onSave}
              title="Save (Ctrl+S)"
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity mr-4 font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {saveStatus === 'saving' ? 'Saving...' : 
                 saveStatus === 'saved' ? 'Saved' : 'Save'}
              </span>
            </button>
            <div className="truncate opacity-80" style={{ maxWidth: '400px' }}>
              {currentFilePath ? (
                <span className="font-mono">{currentFilePath}</span>
              ) : (
                <span className="italic">Unsaved file</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right side: Temporary Action Messages */}
      {statusMessage && (
        <div className="flex items-center font-bold animate-fade-in opacity-90">
          {statusMessage}
        </div>
      )}
    </footer>
  );
}
