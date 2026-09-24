import { openDatabase } from '../src/db.js';
import { createPostcardStore } from '../src/postcards.js';
import { createApp } from '../src/app.js';

export const DAY = 24 * 60 * 60 * 1000;

export function fakeClock(start = Date.UTC(2026, 8, 24, 12)) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => {
    t += ms;
  };
  return now;
}

export function makeStore(now = fakeClock()) {
  return { store: createPostcardStore(openDatabase(':memory:'), { now }), now };
}

export async function startServer({ rateLimitMax } = {}) {
  const { store, now } = makeStore();
  const app = createApp({ store, now, rateLimitMax });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const request = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      redirect: 'manual',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, headers: res.headers, text, json };
  };

  return { base, now, request, close: () => new Promise((r) => server.close(r)) };
}

export const sample = (overrides = {}) => ({
  senderName: 'Sam',
  recipientName: 'Alex',
  message: 'Wish you were here!',
  theme: 'ocean',
  ...overrides,
});
