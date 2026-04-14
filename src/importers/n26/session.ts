import crypto from 'crypto';
import fs from 'fs/promises';
import { N26Config } from './types';
import { SessionExpiredError } from './errors';

interface EncryptedSession {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export async function saveSession(config: N26Config, storageState: any): Promise<void> {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey(config.sessionSecret);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const jsonStr = JSON.stringify(storageState);
  let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  const envelope: EncryptedSession = {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted,
  };

  await fs.writeFile(config.sessionPath, JSON.stringify(envelope), { mode: 0o600 });
  config.logger?.info(`[n26-importer] Session saved to disk: ${config.sessionPath}`);
}

export async function loadSession(config: N26Config): Promise<any | null> {
  try {
    const content = await fs.readFile(config.sessionPath, 'utf8');
    const envelope: EncryptedSession = JSON.parse(content);

    if (envelope.v !== 1) {
      throw new Error('Unsupported session version');
    }

    const key = getEncryptionKey(config.sessionSecret);
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(envelope.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    config.logger?.info('[n26-importer] Session loaded and decrypted successfully');
    return JSON.parse(decrypted);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      config.logger?.info('[n26-importer] No existing session found');
      return null;
    }
    
    config.logger?.warn(`[n26-importer] Failed to decrypt session: ${error.message}`);
    // Delete corrupted or un-decryptable session
    await clearSession(config).catch(() => {});
    throw new SessionExpiredError('Session decryption failed or file is corrupted. Please log in again.');
  }
}

export async function clearSession(config: N26Config): Promise<void> {
  try {
    await fs.unlink(config.sessionPath);
    config.logger?.info('[n26-importer] Session file cleared');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      config.logger?.warn(`[n26-importer] Failed to clear session file: ${error.message}`);
    }
  }
}
