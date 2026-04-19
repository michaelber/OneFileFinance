import { exportDB, importInto } from 'dexie-export-import';
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { db } from '../db';

export async function saveDatabaseToFile(filePath?: string | null): Promise<string | null> {
  let targetPath = filePath as string | undefined;

  // If no path is provided, prompt user to pick a save location
  if (!targetPath) {
    const result = await save({
      filters: [{
        name: 'OneFileFinance',
        extensions: ['fin']
      }]
    });
    if (!result) return null; // user cancelled
    targetPath = result as string;
  }

  // Export DB
  const blob = await exportDB(db, { prettyJson: true });
  const text = await blob.text();

  // Write file explicitly bypassing FS scope
  await invoke('write_file_direct', { path: targetPath, content: text });

  return targetPath;
}

export async function promptSaveAsDatabase(): Promise<string | null> {
  return saveDatabaseToFile(null);
}

export async function openDatabaseFromFile(): Promise<string | null> {
  const selectedPath = await open({
    filters: [{
      name: 'OneFileFinance',
      extensions: ['fin']
    }],
    multiple: false
  });

  if (!selectedPath) return null; // user cancelled

  const targetPath = selectedPath as string;
  const text = await invoke<string>('read_file_direct', { path: targetPath });
  const blob = new Blob([text], { type: 'application/json' });

  // Import directly into our DB, clearing old stores first
  await importInto(db, blob, { clearTablesBeforeImport: true });

  return targetPath;
}
