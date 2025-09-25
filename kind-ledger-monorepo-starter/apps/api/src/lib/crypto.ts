
import crypto from 'crypto';
const key = (process.env.APP_ENCRYPTION_KEY || 'dev-only-32bytes-key-dev-only-32by').slice(0,32);
const ivLen = 12;
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(ivLen);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, ivLen);
  const tag = raw.subarray(ivLen, ivLen+16);
  const enc = raw.subarray(ivLen+16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}
