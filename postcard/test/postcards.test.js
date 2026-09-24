import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, PostcardError } from '../src/postcards.js';
import { makeStore, sample, DAY } from './helpers.js';

const rejects = (fn, props) =>
  assert.throws(fn, (err) => {
    assert.ok(err instanceof PostcardError);
    for (const [k, v] of Object.entries(props)) assert.equal(err[k], v);
    return true;
  });

test('creates a text postcard and shows it to anyone with the link', () => {
  const { store } = makeStore();
  const { postcard, senderKey } = store.create(sample());

  assert.match(postcard.id, /^[0-9A-Za-z]{12}$/);
  assert.match(senderKey, /^[0-9A-Za-z]{24}$/);
  assert.equal(postcard.locked, false);
  assert.equal(postcard.message, 'Wish you were here!');
  assert.deepEqual(postcard.media, []);
  assert.deepEqual(store.view(postcard.id), postcard);
});

test('normalizes whitespace and validates fields', () => {
  const { store } = makeStore();
  const { postcard } = store.create(
    sample({ senderName: '  Sam \n  B ', message: '  hi\r\n\n\n\nthere  ' }),
  );
  assert.equal(postcard.senderName, 'Sam B');
  assert.equal(postcard.message, 'hi\n\nthere');

  rejects(() => store.create(sample({ message: '   ' })), { status: 400, field: 'message' });
  rejects(() => store.create(sample({ senderName: undefined })), { field: 'senderName' });
  rejects(() => store.create(sample({ recipientName: 'x'.repeat(LIMITS.nameLength + 1) })), { field: 'recipientName' });
  rejects(() => store.create(sample({ message: 'x'.repeat(LIMITS.messageLength + 1) })), { field: 'message' });
  rejects(() => store.create(sample({ theme: 'neon' })), { field: 'theme' });
  rejects(() => store.create(sample({ media: [{ kind: 'photo' }] })), { field: 'media' });
});

test('counts message length in characters, not UTF-16 units', () => {
  const { store } = makeStore();
  const emoji = '\u{1F48C}'.repeat(LIMITS.messageLength);
  assert.equal(store.create(sample({ message: emoji })).postcard.message, emoji);
});

test('time capsule hides the message until the unlock time', () => {
  const { store, now } = makeStore();
  const unlockAt = now() + 3 * DAY;
  const { postcard } = store.create(sample({ unlockAt: new Date(unlockAt).toISOString() }));

  assert.equal(postcard.locked, true);
  assert.equal(postcard.unlockAt, unlockAt);
  assert.equal('message' in store.view(postcard.id), false);
  rejects(() => store.markOpened(postcard.id), { status: 403, code: 'locked' });
  rejects(() => store.reply(postcard.id, sample()), { status: 403, code: 'locked' });

  now.advance(3 * DAY);
  const unlocked = store.view(postcard.id);
  assert.equal(unlocked.locked, false);
  assert.equal(unlocked.message, 'Wish you were here!');
});

test('rejects unlock dates in the past, invalid, or too far out', () => {
  const { store, now } = makeStore();
  rejects(() => store.create(sample({ unlockAt: now() - 1 })), { field: 'unlockAt' });
  rejects(() => store.create(sample({ unlockAt: 'next tuesday' })), { field: 'unlockAt' });
  rejects(() => store.create(sample({ unlockAt: now() + 11 * 365 * DAY })), { field: 'unlockAt' });
  assert.equal(store.create(sample({ unlockAt: '' })).postcard.unlockAt, null);
});

test('marks a postcard opened only once', () => {
  const { store, now } = makeStore();
  const { postcard } = store.create(sample());
  const first = store.markOpened(postcard.id).openedAt;
  now.advance(DAY);
  assert.equal(store.markOpened(postcard.id).openedAt, first);
});

test('replies link back to the original and show up for its sender', () => {
  const { store, now } = makeStore();
  const { postcard, senderKey } = store.create(sample());
  const { postcard: reply } = store.reply(
    postcard.id,
    sample({ senderName: 'Alex', recipientName: 'Sam', message: 'Miss you too', unlockAt: now() + DAY }),
  );

  assert.equal(reply.parentId, postcard.id);
  const tracked = store.track(postcard.id, senderKey);
  assert.equal(tracked.message, 'Wish you were here!');
  assert.equal(tracked.replies.length, 1);
  assert.equal(tracked.replies[0].id, reply.id);
  assert.equal(tracked.replies[0].locked, true);
  assert.equal('message' in tracked.replies[0], false);
});

test('caps the number of replies per postcard', () => {
  const { store } = makeStore();
  const { postcard } = store.create(sample());
  for (let i = 0; i < LIMITS.maxRepliesPerPostcard; i++) store.reply(postcard.id, sample());
  rejects(() => store.reply(postcard.id, sample()), { status: 409, code: 'reply_limit' });
});

test('tracking requires the matching sender key', () => {
  const { store } = makeStore();
  const { postcard, senderKey } = store.create(sample());
  const other = store.create(sample());
  rejects(() => store.track(postcard.id, 'wrong'), { status: 404 });
  rejects(() => store.track(postcard.id, undefined), { status: 404 });
  rejects(() => store.track(postcard.id, other.senderKey), { status: 404 });
  assert.equal(store.track(postcard.id, senderKey).id, postcard.id);
});

test('unknown ids are not found', () => {
  const { store } = makeStore();
  assert.equal(store.view('nope'), null);
  rejects(() => store.markOpened('nope'), { status: 404 });
  rejects(() => store.reply('nope', sample()), { status: 404 });
});
