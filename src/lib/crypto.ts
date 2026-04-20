export const generateSaltHex = () => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const hashPassword = async (password: string, saltHex: string): Promise<string> => {
  const enc = new TextEncoder();
  
  // Fast fail gracefully if crypto not available (should be in all modern browsers but still good to guard)
  if (!window.crypto?.subtle) {
      throw new Error("WebCrypto API is not available");
  }

  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const key = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(key)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const deriveEncryptionKey = async (password: string, salt: Uint8Array) => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

export const encryptData = async (text: string, password: string): Promise<string> => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(password, salt);
  const enc = new TextEncoder();
  
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(text)
  );
  
  const cipherBytes = new Uint8Array(cipherBuffer);
  const packed = new Uint8Array(salt.length + iv.length + cipherBytes.length);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(cipherBytes, salt.length + iv.length);
  
  return 'OFF_ENC::' + btoa(String.fromCharCode(...packed));
};

export const decryptData = async (encryptedData: string, password: string): Promise<string> => {
  if (!encryptedData.startsWith('OFF_ENC::')) {
    throw new Error('Not an encrypted file format');
  }
  
  const base64 = encryptedData.substring(9);
  const packedString = atob(base64);
  const packed = new Uint8Array(packedString.length);
  for (let i = 0; i < packedString.length; i++) {
      packed[i] = packedString.charCodeAt(i);
  }
  
  const salt = packed.slice(0, 16);
  const iv = packed.slice(16, 28);
  const cipherBytes = packed.slice(28);
  
  try {
      const key = await deriveEncryptionKey(password, salt);
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        cipherBytes
      );
      
      const dec = new TextDecoder();
      return dec.decode(decryptedBuffer);
  } catch (err) {
      throw new Error('VERIFICATION_FAILED');
  }
};
