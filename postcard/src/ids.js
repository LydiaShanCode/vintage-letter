import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// Largest multiple of 62 below 256; bytes at or above it are rejected to avoid modulo bias.
const UNBIASED_LIMIT = 248;

export function randomId(length) {
  let out = '';
  while (out.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte < UNBIASED_LIMIT && out.length < length) out += ALPHABET[byte % 62];
    }
  }
  return out;
}

export function hashKey(key) {
  return createHash('sha256').update(key).digest('hex');
}

export function keyMatches(key, expectedHash) {
  if (typeof key !== 'string' || !key) return false;
  const actual = Buffer.from(hashKey(key), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
