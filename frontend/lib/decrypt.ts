const ALGORITHM = 'AES-GCM';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export async function decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }, encryptionKey: string): Promise<any> {
  try {
    if (!encryptionKey || encryptionKey.length !== 64) {
      throw new Error('Encryption key must be exactly 64 hex characters');
    }
    
    const keyBuffer = hexToBytes(encryptionKey);
    if (keyBuffer.length !== 32) {
      throw new Error('Invalid encryption key format');
    }
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer.buffer as ArrayBuffer,
      { name: ALGORITHM },
      false,
      ['decrypt']
    );
    
    const iv = hexToBytes(encryptedData.iv);
    const encrypted = hexToBytes(encryptedData.encrypted);
    const authTag = hexToBytes(encryptedData.authTag);
    
    const combined = new Uint8Array(encrypted.length + authTag.length);
    combined.set(encrypted);
    combined.set(authTag, encrypted.length);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv.buffer as ArrayBuffer,
        tagLength: 128,
      },
      key,
      combined.buffer as ArrayBuffer
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

