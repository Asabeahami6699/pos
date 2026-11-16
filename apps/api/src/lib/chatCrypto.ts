import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer {
  const secret = process.env.CHAT_ENCRYPTION_KEY?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProd) {
      throw new Error('CHAT_ENCRYPTION_KEY is required in production');
    }
    // Dev-only fallback — never used when NODE_ENV=production
    return crypto.createHash('sha256').update('pos-inventory-dev-chat-key').digest();
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptChatMessage(plaintext: string): string {
  if (!plaintext) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${encrypted.toString('base64url')}:${tag.toString('base64url')}`;
}

export function decryptChatMessage(stored: string): string {
  if (!stored?.startsWith(PREFIX)) return stored;

  try {
    const payload = stored.slice(PREFIX.length);
    const [ivB64, dataB64, tagB64] = payload.split(':');
    if (!ivB64 || !dataB64 || !tagB64) return stored;

    const iv = Buffer.from(ivB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const decipher = crypto.createDecipheriv(ALGO, getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '[Unable to decrypt message]';
  }
}

export function decryptChatMessages<T extends { body: string }>(messages: T[]): T[] {
  return messages.map((msg) => ({ ...msg, body: decryptChatMessage(msg.body) }));
}
