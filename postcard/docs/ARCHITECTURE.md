# Postcard architecture

## Principles

1. **The link is the product.** No app install and no recipient account. Everything must work from a link tapped inside a messaging app's in-app browser (iOS/Android webviews, Messenger's browser).
2. **The server decides what is sealed.** Time-capsule content is never sent to a client before `unlock_at`. That covers HTML, API responses, link previews, and (later) media URLs. The client countdown is only cosmetic.
3. **Link possession is access.** Postcard ids are 12 random base62 characters (about 71 bits), so they can't be guessed. The sender's tracking key is separate (24 characters, stored as a SHA-256 hash) and travels in the URL fragment, so it never reaches server logs or `Referer` headers.

## Components

```
Browser (in-app webview)                    Node / Express                   Storage
────────────────────────                    ──────────────                   ───────
GET /p/:id  ──────────────────────────────▶ views.postcardPage ──┐
  (crawler: reads og:* tags)                                     ├─ postcards.js ── SQLite
POST /api/postcards, /replies, /open ─────▶ app.js JSON API ─────┘   (lock logic)
GET /api/postcards/:id/track (X-Sender-Key)
                                                                  (planned) object storage + media worker
```

- `postcards.js` owns every rule: validation, `publicView()` (the single place that strips locked content), reply limits, and tracking-key checks. Routes stay thin.
- Pages are server-rendered so link-preview crawlers, which don't run JS, get real `og:` tags. Client JS only adds interactions: the envelope animation, countdown, share sheet, and form submission.
- A strict CSP (`script-src 'self'`, no inline scripts) plus the auto-escaping `html` template keep user text inert.

## Data model

```sql
postcards (
  id              TEXT PRIMARY KEY,          -- public, unguessable
  parent_id       TEXT REFERENCES postcards, -- set when this is a reply ("send one back")
  sender_name     TEXT, recipient_name TEXT,
  message         TEXT,                      -- ≤ 500 chars; caption once media exists
  theme           TEXT,                      -- sunset | ocean | meadow | night
  unlock_at       INTEGER NULL,              -- epoch ms; NULL = open immediately
  created_at      INTEGER, opened_at INTEGER NULL,
  sender_key_hash TEXT                       -- sha256 of the private tracking key
)
```

Replies are ordinary postcards with a `parent_id`, so a back-and-forth forms a chain, and every reply can be its own time capsule. Each postcard accepts at most 10 replies, since a link dropped in a group chat may get several.

### Time capsule semantics

- The sender picks a **day**. The client converts it to the sender's local midnight and sends that instant, and the server stores UTC ms. A recipient in another timezone may see it open at a different local hour. That is deliberate: the sender chose the day.
- `locked = unlock_at != null && now < unlock_at`, evaluated on every request. There's no job to "unlock" things.
- When the countdown reaches zero the page reloads, and the server then includes the message.

## Photos and videos

The MVP rejects `media` in the create payload with a friendly error, and the UI shows disabled "Photo" / "Video, up to 1 min" buttons. The API already returns `media: []` on unlocked postcards so clients can adopt it without a breaking change. The postcard **front** face, currently a themed "Greetings" illustration, is where a photo or video will go. The back keeps the message.

### Limits

| | Photo | Video |
| --- | --- | --- |
| Per postcard | up to 4 | 1 (no photos alongside it) |
| Upload size | ≤ 15 MB | ≤ 150 MB |
| Duration | n/a | ≤ 60 s (checked on the server) |
| Delivered as | JPEG/WebP, longest edge 2048 px plus a 400 px thumbnail | H.264/AAC MP4, 720p, plus a poster JPEG |

### Schema addition

```sql
media (
  id           TEXT PRIMARY KEY,
  postcard_id  TEXT NULL REFERENCES postcards(id),  -- NULL until attached on create
  upload_token_hash TEXT NOT NULL,                  -- ties an upload to the browser that made it
  kind         TEXT NOT NULL,                       -- photo | video
  status       TEXT NOT NULL,                       -- pending | processing | ready | failed
  original_key TEXT, display_key TEXT, poster_key TEXT,
  mime TEXT, bytes INTEGER, width INTEGER, height INTEGER, duration_ms INTEGER,
  position     INTEGER, created_at INTEGER
)
```

### Upload flow

1. **Pick or capture** with `<input type="file" accept="image/*">` or `accept="video/*" capture`. Before uploading, the client:
   - photos: downscales with a canvas and re-encodes to JPEG. This also **strips EXIF/GPS**, which matters for privacy.
   - videos: reads `duration` from a `<video>` element's metadata and rejects anything over 60 s right away, so nobody waits through a doomed upload.
2. `POST /api/uploads { kind, mime, bytes }` returns `{ mediaId, uploadUrl, uploadToken }`, where `uploadUrl` is a short-lived presigned `PUT` to object storage (S3 / R2 / GCS) with the content type and length pinned.
3. The browser `PUT`s the file directly to storage, so large files never pass through the Node process, then calls `POST /api/uploads/:id/complete`.
4. A **media worker** (a queue job) probes the file with `ffprobe` and treats that as authoritative: real duration ≤ 60.5 s, real codec and dimensions. It then transcodes with `ffmpeg` (video to 720p MP4 plus poster, photo to a metadata-free display and thumbnail) and sets `status = ready` or `failed`.
5. The composer polls `GET /api/uploads/:id` for status and shows progress. `POST /api/postcards { ..., media: [mediaId…] }` succeeds only if each id is `ready`, unattached, and matches the caller's `uploadToken`.
6. Unattached uploads are garbage-collected after 24 h.

### Serving media without leaking time capsules

- The bucket is **private**. `publicView()` adds `media: [{ kind, url, posterUrl, width, height, durationMs }]` only when the postcard is unlocked, with **signed URLs that expire in about 1 hour**. Sealed postcards return nothing, so there's no URL to find early.
- Link previews stay generic (the shared preview image). A later option is a per-postcard `og:image` rendered from a **blurred** thumbnail for unlocked photo postcards.
- Videos play inline (`playsinline muted` autoplay with tap to unmute), because in-app browsers block autoplay with sound.

### Abuse and cost

- Per-IP and per-upload-token rate limits on `/api/uploads`, plus caps on total bytes per day.
- A "Report this postcard" link and an admin takedown that deletes storage objects. If this ever becomes public beyond friends, add hash-matching (e.g. PhotoDNA) on ingest.
- Retention: keep originals only until transcoding finishes. Display renditions live as long as the postcard.

## Other planned work

- "Remind me" on sealed postcards: an `.ics` calendar download for the unlock day, needing no account.
- Optional sender notifications (email or web push) when a postcard is opened or replied to.
- Swap the in-memory rate limiter and SQLite for Redis and Postgres when running more than one instance. `postcards.js` only depends on a `db.prepare` interface, which keeps that change contained.
