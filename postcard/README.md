# Postcard

Mini digital postcards you send to friends as a link, in iMessage/SMS, Facebook Messenger, WhatsApp, Instagram DMs, or any chat app. The link unfurls into a postcard preview. Tapping it opens an envelope with your message inside.

- **Text postcards** (MVP): pick a card style, write up to 500 characters, share the link.
- **Time capsules**: seal a postcard until a certain day. Before then the recipient sees a sealed envelope with a countdown. The message is never sent to their device early.
- **Send one back**: once a postcard is opened, the recipient can reply with a postcard of their own, which can also be a time capsule.
- **Private tracking link**: the sender gets a private link that shows whether the postcard was opened and lists replies. It is also remembered on the sender's device.
- **Photos and videos (max 1 min)**: planned, not built yet. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#photos-and-videos).

## Running it

Requires Node.js 22.13 or newer. It uses the built-in `node:sqlite`, so there are no native dependencies.

```bash
npm install
npm run dev      # http://localhost:3000, restarts on change
npm test
npm start        # production
```

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `data/postcard.db` | SQLite file. Put it on a persistent volume. |
| `PUBLIC_URL` | derived from request | Absolute origin used in share links and link-preview tags, e.g. `https://postcard.example` |
| `TRUST_PROXY` | `false` | Set `true` behind a load balancer so rate limiting sees real client IPs |

Link previews only work when the app is reachable on a public HTTPS URL, because the messaging apps' crawlers fetch the page themselves. To test previews from a laptop, use a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and set `PUBLIC_URL` to the tunnel URL.

## How sharing works

Each postcard gets an unguessable URL like `/p/Xk3v9QpL2aRt`. The server renders `og:*` and `twitter:*` meta tags into that page so link previews show "A postcard from Sam" (or "A sealed postcard from Sam" for time capsules) with the preview image. Previews never include the message itself, so the surprise is kept, and sealed content can't leak through a preview.

After creating a postcard, the share panel offers:

- the native share sheet (`navigator.share`) on phones, which covers SMS, Messenger, WhatsApp, Instagram, and more
- direct **Text message** (`sms:`), **Messenger** (`fb-messenger://`, mobile only) and **WhatsApp** (`wa.me`) links
- copy link

## Project layout

```
src/
  server.js      entry point (env config)
  app.js         Express routes: pages + JSON API, security headers
  postcards.js   domain logic: validation, time-capsule locking, replies, tracking
  db.js          SQLite connection + migrations
  views.js       server-rendered HTML (with link-preview meta tags)
  html.js        auto-escaping html`` template tag
  ids.js         random ids / sender keys
  rateLimit.js   in-memory write rate limiter
public/          client JS (vanilla ES modules), CSS, preview image
assets/          source SVG for the preview image
test/            node:test suites (domain + HTTP)
docs/            architecture and the photo/video plan
```

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/postcards` | `{ senderName, recipientName, message, theme?, unlockAt? }` → `201 { postcard, url, trackUrl }` |
| `GET` | `/api/postcards/:id` | Public view. `message` is omitted while `locked` |
| `POST` | `/api/postcards/:id/open` | Records first open. `403` while sealed |
| `POST` | `/api/postcards/:id/replies` | Same body as create. `403` while sealed, `409` after 10 replies |
| `GET` | `/api/postcards/:id/track` | Header `X-Sender-Key`. Returns status, the sender's own message, and replies |

`theme` is one of `sunset`, `ocean`, `meadow`, `night`. `unlockAt` is an ISO timestamp or epoch ms, must be in the future, and can be at most 10 years out. The web client sends local midnight of the chosen day in the sender's timezone.

## Moving this into its own repository

This project was started as a self-contained `postcard/` folder. To give it a standalone repo with its history:

```bash
git subtree split --prefix=postcard -b postcard-standalone
git push git@github.com:<you>/postcard.git postcard-standalone:main
```
