import express from 'express';
import { fileURLToPath } from 'node:url';
import { PostcardError } from './postcards.js';
import { rateLimit } from './rateLimit.js';
import { homePage, replyPage, postcardPage, trackPage, notFoundPage } from './views.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function createApp({ store, publicUrl, trustProxy = false, rateLimitMax = 30, now = Date.now }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  const originOf = (req) => publicUrl ?? `${req.protocol}://${req.get('host')}`;
  const linksFor = (req, postcard, senderKey) => {
    const origin = originOf(req);
    return {
      url: `${origin}/p/${postcard.id}`,
      trackUrl: `${origin}/s/${postcard.id}#${senderKey}`,
    };
  };

  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });

  app.use('/static', express.static(PUBLIC_DIR, { maxAge: '1h' }));
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use(express.json({ limit: '16kb' }));
  const writeLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: rateLimitMax, now });

  api.post('/postcards', writeLimit, (req, res) => {
    const { postcard, senderKey } = store.create(req.body);
    res.status(201).json({ postcard, ...linksFor(req, postcard, senderKey) });
  });

  api.get('/postcards/:id', (req, res) => {
    const view = store.view(req.params.id);
    if (!view) throw new PostcardError(404, 'not_found', 'That postcard could not be found.');
    res.set('Cache-Control', 'no-store').json({ postcard: view });
  });

  api.post('/postcards/:id/open', (req, res) => {
    res.json({ postcard: store.markOpened(req.params.id) });
  });

  api.post('/postcards/:id/replies', writeLimit, (req, res) => {
    const { postcard, senderKey } = store.reply(req.params.id, req.body);
    res.status(201).json({ postcard, ...linksFor(req, postcard, senderKey) });
  });

  // The sender key travels in a header (read from the URL fragment client-side) so it never lands in access logs.
  api.get('/postcards/:id/track', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ postcard: store.track(req.params.id, req.get('x-sender-key')) });
  });

  api.use((req, res) => res.status(404).json({ error: 'Not found.', code: 'not_found' }));
  app.use('/api', api);

  const sendPage = (res, markup, status = 200) =>
    res.status(status).set('Cache-Control', 'no-store').type('html').send(markup);

  app.get('/', (req, res) => sendPage(res, homePage({ origin: originOf(req) })));

  app.get('/p/:id', (req, res) => {
    const view = store.view(req.params.id);
    if (!view) return sendPage(res, notFoundPage({ origin: originOf(req), path: req.path }), 404);
    sendPage(res, postcardPage({ origin: originOf(req), view, isReply: Boolean(view.parentId) }));
  });

  app.get('/p/:id/reply', (req, res) => {
    const view = store.view(req.params.id);
    if (!view) return sendPage(res, notFoundPage({ origin: originOf(req), path: req.path }), 404);
    if (view.locked) return res.redirect(303, `/p/${view.id}`);
    sendPage(res, replyPage({ origin: originOf(req), parent: view }));
  });

  app.get('/s/:id', (req, res) => sendPage(res, trackPage({ origin: originOf(req), id: req.params.id })));

  app.use((req, res) => sendPage(res, notFoundPage({ origin: originOf(req), path: req.path }), 404));

  // Express identifies error handlers by their four-argument signature.
  app.use((err, req, res, _next) => {
    if (err instanceof PostcardError) {
      return res.status(err.status).json({ error: err.message, code: err.code, field: err.field });
    }
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
      return res.status(400).json({ error: 'Invalid request body.', code: 'invalid' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.', code: 'internal' });
  });

  return app;
}
