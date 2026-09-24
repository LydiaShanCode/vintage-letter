import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, sample, DAY } from './helpers.js';

let server;
before(async () => {
  server = await startServer();
});
after(() => server.close());

const create = (body = sample()) => server.request('/api/postcards', { method: 'POST', body });

test('POST /api/postcards returns share and private tracking links', async () => {
  const res = await create();
  assert.equal(res.status, 201);
  const { postcard, url, trackUrl } = res.json;
  assert.equal(url, `${server.base}/p/${postcard.id}`);
  assert.match(trackUrl, new RegExp(`^${server.base}/s/${postcard.id}#[0-9A-Za-z]{24}$`));
});

test('validation errors come back as 400 with the offending field', async () => {
  const res = await create(sample({ message: '' }));
  assert.equal(res.status, 400);
  assert.equal(res.json.field, 'message');

  const bad = await server.request('/api/postcards', { method: 'POST', body: '{nope' });
  assert.equal(bad.status, 400);
});

test('postcard page has link-preview tags and escapes user content', async () => {
  const { json } = await create(sample({ senderName: '<b>Sam</b>', message: '<script>alert(1)</script>' }));
  const page = await server.request(`/p/${json.postcard.id}`);

  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(page.text, /<meta property="og:title" content="A postcard from &lt;b&gt;Sam&lt;\/b&gt;">/);
  assert.match(page.text, new RegExp(`<meta property="og:image" content="${server.base}/static/og-image.png">`));
  assert.match(page.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(page.text, /<script>alert/);
  assert.doesNotMatch(page.text, /og:description" content="[^"]*alert/);
});

test('sealed postcard never leaks its message over HTTP', async () => {
  const unlockAt = server.now() + 2 * DAY;
  const { json } = await create(sample({ message: 'top secret birthday note', unlockAt }));
  const { id } = json.postcard;

  const page = await server.request(`/p/${id}`);
  assert.equal(page.status, 200);
  assert.doesNotMatch(page.text, /top secret/);
  assert.match(page.text, /og:title" content="A sealed postcard from Sam"/);
  assert.match(page.text, new RegExp(`data-unlock-at="${unlockAt}"`));

  const apiView = await server.request(`/api/postcards/${id}`);
  assert.equal(apiView.json.postcard.locked, true);
  assert.equal(apiView.json.postcard.message, undefined);

  assert.equal((await server.request(`/api/postcards/${id}/open`, { method: 'POST' })).status, 403);
  assert.equal((await server.request(`/api/postcards/${id}/replies`, { method: 'POST', body: sample() })).status, 403);

  const replyPage = await server.request(`/p/${id}/reply`);
  assert.equal(replyPage.status, 303);
  assert.equal(replyPage.headers.get('location'), `/p/${id}`);

  server.now.advance(2 * DAY);
  assert.match((await server.request(`/p/${id}`)).text, /top secret birthday note/);
});

test('open, reply, and track round trip', async () => {
  const { json: original } = await create();
  const id = original.postcard.id;
  const key = original.trackUrl.split('#')[1];

  const opened = await server.request(`/api/postcards/${id}/open`, { method: 'POST' });
  assert.equal(opened.status, 200);
  assert.ok(opened.json.postcard.openedAt);

  const replyForm = await server.request(`/p/${id}/reply`);
  assert.match(replyForm.text, /Send one back to Sam/);
  assert.match(replyForm.text, /name="recipientName"[^>]*value="Sam"/);

  const reply = await server.request(`/api/postcards/${id}/replies`, {
    method: 'POST',
    body: sample({ senderName: 'Alex', recipientName: 'Sam', message: 'Back at you' }),
  });
  assert.equal(reply.status, 201);
  assert.equal(reply.json.postcard.parentId, id);

  const replyView = await server.request(`/p/${reply.json.postcard.id}`);
  assert.match(replyView.text, /A postcard back from Alex/);

  const tracked = await server.request(`/api/postcards/${id}/track`, { headers: { 'x-sender-key': key } });
  assert.equal(tracked.status, 200);
  assert.ok(tracked.json.postcard.openedAt);
  assert.deepEqual(tracked.json.postcard.replies.map((r) => r.id), [reply.json.postcard.id]);

  const denied = await server.request(`/api/postcards/${id}/track`, { headers: { 'x-sender-key': 'nope' } });
  assert.equal(denied.status, 404);
});

test('unknown postcards render a 404 page', async () => {
  const page = await server.request('/p/doesnotexist');
  assert.equal(page.status, 404);
  assert.match(page.text, /Lost in the mail/);
  assert.equal((await server.request('/api/postcards/doesnotexist')).status, 404);
});

test('rate limits postcard creation per client', async () => {
  const limited = await startServer({ rateLimitMax: 2 });
  try {
    const post = () => limited.request('/api/postcards', { method: 'POST', body: sample() });
    assert.equal((await post()).status, 201);
    assert.equal((await post()).status, 201);
    const res = await post();
    assert.equal(res.status, 429);
    assert.ok(res.headers.get('retry-after'));
  } finally {
    await limited.close();
  }
});
