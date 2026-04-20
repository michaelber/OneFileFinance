import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { db } from '../db';
import { encryptData, decryptData } from './crypto';
import { generateExportData, processImportData } from './backup';

export async function saveDatabaseToFile(filePath?: string | null, sessionPassword?: string | null): Promise<string | null> {
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
  let text = await generateExportData();

  const encryptEnabled = await db.settings.get('fileEncryptionEnabled').then(r => r?.value);
  if (encryptEnabled && sessionPassword) {
      text = await encryptData(text, sessionPassword);
  }

  // Write file explicitly bypassing FS scope
  await invoke('write_file_direct', { path: targetPath, content: text });

  return targetPath;
}

export async function promptSaveAsDatabase(sessionPassword?: string | null): Promise<string | null> {
  return saveDatabaseToFile(null, sessionPassword);
}

export async function openDatabaseFromFile(sessionPassword?: string | null): Promise<string | null> {
  const selectedPath = await open({
    filters: [{
      name: 'OneFileFinance',
      extensions: ['fin']
    }],
    multiple: false
  });

  if (!selectedPath) return null; // user cancelled

  const targetPath = selectedPath as string;
  let text = await invoke<string>('read_file_direct', { path: targetPath });
  
  if (text.startsWith('OFF_ENC::')) {
      if (!sessionPassword) {
          throw new Error('FILE_ENCRYPTED'); // Frontend will need to catch this or it fails gracefully
      }
      text = await decryptData(text, sessionPassword);
  }

  // Import using shared backend logic
  await processImportData(text);

  return targetPath;
}
