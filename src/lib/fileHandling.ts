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
  if (encryptEnabled) {
      if (!sessionPassword) {
          throw new Error("Cannot save file: Encryption is enabled but session password is missing.");
      }
      text = await encryptData(text, sessionPassword);
  }

  // Write file explicitly bypassing FS scope
  await invoke('write_file_direct', { path: targetPath, content: text });

  return targetPath;
}

export async function promptSaveAsDatabase(sessionPassword?: string | null): Promise<string | null> {
  return saveDatabaseToFile(null, sessionPassword);
}

export async function pickDatabaseFile(): Promise<string | null> {
  const selectedPath = await open({
    filters: [{
      name: 'OneFileFinance',
      extensions: ['fin']
    }],
    multiple: false
  });

  if (!selectedPath) return null;
  return selectedPath as string;
}

export async function openDatabaseFromFile(sessionPassword?: string | null): Promise<string | null> {
  const selectedPath = await pickDatabaseFile();

  if (!selectedPath) return null; // user cancelled

  return await openDatabaseFromPath(selectedPath, sessionPassword);
}

export async function openDatabaseFromPath(targetPath: string, sessionPassword?: string | null): Promise<string> {
  let text = await invoke<string>('read_file_direct', { path: targetPath });
  
  if (text.startsWith('OFF_ENC::')) {
      if (!sessionPassword) {
          const err: any = new Error('FILE_ENCRYPTED');
          err.path = targetPath;
          throw err;
      }
      try {
        text = await decryptData(text, sessionPassword);
      } catch (e: any) {
        if (e.message === 'VERIFICATION_FAILED') {
          e.path = targetPath;
        }
        throw e;
      }
  }

  // Import using shared backend logic
  await processImportData(text);

  return targetPath;
}
