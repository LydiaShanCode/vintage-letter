import { html } from './html.js';
import { LIMITS, THEMES } from './postcards.js';

const THEME_LABELS = { sunset: 'Sunset', ocean: 'Ocean', meadow: 'Meadow', night: 'Night sky' };

const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const formatDate = (ms) => longDate.format(new Date(ms));

function layout({ origin, title, description, path, theme = 'sunset', body, scripts = [] }) {
  const url = `${origin}${path}`;
  const image = `${origin}/static/og-image.png`;
  return html`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#f4ecdf">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Postcard">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="An illustrated postcard with a stamp">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/static/styles.css">
  <script src="/static/boot.js"></script>
</head>
<body class="theme-${theme}">
  <header class="masthead"><a href="/" class="wordmark">Postcard</a></header>
  ${body}
  ${scripts.map((src) => html`<script type="module" src="${src}"></script>`)}
</body>
</html>`.toString();
}

function composeForm({ endpoint, recipientName = '', senderName = '', submitLabel = 'Stamp & send' }) {
  return html`
  <form class="compose" data-compose data-endpoint="${endpoint}" novalidate>
    <div class="field-row">
      <label class="field">
        <span class="field__label">To</span>
        <input name="recipientName" maxlength="${LIMITS.nameLength}" required autocomplete="off" placeholder="Your friend" value="${recipientName}">
      </label>
      <label class="field">
        <span class="field__label">From</span>
        <input name="senderName" maxlength="${LIMITS.nameLength}" required autocomplete="nickname" placeholder="You" value="${senderName}">
      </label>
    </div>

    <label class="field">
      <span class="field__label">Message</span>
      <textarea name="message" rows="6" maxlength="${LIMITS.messageLength}" required placeholder="Wish you were here…"></textarea>
      <small class="field__hint" data-counter>0 / ${LIMITS.messageLength}</small>
    </label>

    <fieldset class="themes">
      <legend class="field__label">Card style</legend>
      ${THEMES.map((theme, i) => html`
      <label class="swatch swatch--${theme}">
        <input type="radio" name="theme" value="${theme}" ${i === 0 ? html`checked` : ''}>
        <span>${THEME_LABELS[theme]}</span>
      </label>`)}
    </fieldset>

    <fieldset class="attachments">
      <legend class="field__label">Add to your postcard</legend>
      <button type="button" class="chip" disabled>Photo <span class="soon">Soon</span></button>
      <button type="button" class="chip" disabled>Video, up to 1 min <span class="soon">Soon</span></button>
    </fieldset>

    <fieldset class="capsule">
      <label class="toggle">
        <input type="checkbox" data-capsule-toggle>
        <span><strong>Time capsule</strong> — keep it sealed until a certain day</span>
      </label>
      <label class="field" data-capsule-field hidden>
        <span class="field__label">Opens on</span>
        <input type="date" name="unlockDate">
      </label>
    </fieldset>

    <p class="form-error" data-error role="alert" hidden></p>
    <button class="button button--primary" type="submit">${submitLabel}</button>
  </form>

  <section class="share" data-share hidden aria-live="polite">
    <h2>Your postcard is ready to send</h2>
    <p class="share__summary" data-share-summary></p>
    <div class="share__link">
      <input readonly data-share-url aria-label="Postcard link">
      <button type="button" class="button" data-copy>Copy</button>
    </div>
    <div class="share__buttons">
      <button type="button" class="button button--primary" data-native-share hidden>Share…</button>
      <a class="button" data-share-sms>Text message</a>
      <a class="button" data-share-messenger hidden>Messenger</a>
      <a class="button" data-share-whatsapp target="_blank" rel="noopener">WhatsApp</a>
    </div>
    <p class="share__track">
      Keep this private link to see when it's opened and read replies:
      <a data-track-link></a>
    </p>
    <button type="button" class="button button--ghost" data-new>Write another</button>
  </section>`;
}

export function homePage({ origin }) {
  return layout({
    origin,
    path: '/',
    title: 'Postcard — send a little something',
    description: 'Write a mini postcard and send it by text, Messenger, or any chat app. Seal it as a time capsule if you like.',
    scripts: ['/static/compose.js'],
    body: html`
  <main class="page">
    <section class="intro">
      <h1>Send a postcard</h1>
      <p>Write a few lines, pick a card, and share the link in any chat. Seal it as a time capsule and it won't open until the day you choose.</p>
    </section>
    ${composeForm({ endpoint: '/api/postcards' })}
    <section class="sent" data-sent hidden>
      <h2>Postcards you've sent</h2>
      <ul data-sent-list></ul>
    </section>
  </main>`,
  });
}

export function replyPage({ origin, parent }) {
  return layout({
    origin,
    path: `/p/${parent.id}/reply`,
    theme: parent.theme,
    title: `Reply to ${parent.senderName}`,
    description: `Send a postcard back to ${parent.senderName}.`,
    scripts: ['/static/compose.js'],
    body: html`
  <main class="page">
    <section class="intro">
      <p class="eyebrow">In return</p>
      <h1>Send one back to ${parent.senderName}</h1>
      <p><a href="/p/${parent.id}">Read their postcard again</a></p>
    </section>
    ${composeForm({
      endpoint: `/api/postcards/${parent.id}/replies`,
      recipientName: parent.senderName,
      senderName: parent.recipientName,
      submitLabel: 'Stamp & send it back',
    })}
  </main>`,
  });
}

function postcardFace(view) {
  return html`
  <article class="postcard" data-card>
    <div class="postcard__inner" data-card-inner>
      <div class="postcard__face postcard__back">
        <div class="postcard__message">${view.message}</div>
        <div class="postcard__address">
          <div class="stamp" aria-hidden="true"><span>Postcard</span></div>
          <div class="postmark" aria-hidden="true">
            <time datetime="${new Date(view.createdAt).toISOString()}" data-format="short">${formatDate(view.createdAt)}</time>
          </div>
          <p class="address-line"><span>To</span> ${view.recipientName}</p>
          <p class="address-line"><span>From</span> ${view.senderName}</p>
        </div>
      </div>
      <div class="postcard__face postcard__front" aria-hidden="true">
        <p class="greetings">Greetings<br><small>from ${view.senderName}</small></p>
      </div>
    </div>
  </article>`;
}

export function postcardPage({ origin, view, isReply }) {
  const title = view.locked
    ? `A sealed postcard from ${view.senderName}`
    : `${isReply ? 'A postcard back' : 'A postcard'} from ${view.senderName}`;
  const description = view.locked
    ? `A time capsule for ${view.recipientName}. It opens on ${formatDate(view.unlockAt)}.`
    : `${view.senderName} sent ${view.recipientName} a little something. Tap to open it.`;

  const body = view.locked
    ? html`
  <main class="stage" data-viewer data-id="${view.id}" data-unlock-at="${view.unlockAt}">
    <p class="eyebrow">A time capsule for ${view.recipientName}</p>
    <div class="envelope envelope--sealed" aria-hidden="true">
      <div class="envelope__flap"></div>
      <div class="seal"></div>
    </div>
    <h1>Sealed until <time datetime="${new Date(view.unlockAt).toISOString()}" data-format="long">${formatDate(view.unlockAt)}</time></h1>
    <p class="countdown" data-countdown aria-live="off"></p>
    <p class="muted">From ${view.senderName}. Come back then and it will open.</p>
  </main>`
    : html`
  <main class="stage" data-viewer data-id="${view.id}">
    <p class="eyebrow">${isReply ? 'A postcard back' : 'A postcard'} for ${view.recipientName}</p>
    <div class="envelope" data-envelope>
      <div class="envelope__flap"></div>
      <button type="button" class="envelope__open" data-open>Tap to open</button>
    </div>
    ${postcardFace(view)}
    <div class="actions" data-actions>
      <button type="button" class="button" data-flip>Flip it over</button>
      <a class="button button--primary" href="/p/${view.id}/reply">Send one back</a>
    </div>
  </main>`;

  return layout({
    origin,
    path: `/p/${view.id}`,
    theme: view.theme,
    title,
    description,
    body,
    scripts: ['/static/viewer.js'],
  });
}

export function trackPage({ origin, id }) {
  return layout({
    origin,
    path: `/s/${id}`,
    title: 'Your sent postcard',
    description: 'Check whether your postcard has been opened.',
    scripts: ['/static/track.js'],
    body: html`
  <main class="page" data-track data-id="${id}">
    <section class="intro">
      <p class="eyebrow">Sent postcard</p>
      <h1 data-track-title>Checking the mailbox…</h1>
      <p data-track-status></p>
    </section>
    <blockquote class="quote" data-track-message hidden></blockquote>
    <p><a class="button" data-track-view hidden>View postcard</a></p>
    <section class="sent" data-track-replies hidden>
      <h2>Replies</h2>
      <ul data-track-reply-list></ul>
    </section>
  </main>`,
  });
}

export function notFoundPage({ origin, path }) {
  return layout({
    origin,
    path,
    title: 'Postcard not found',
    description: 'This postcard may have been lost in the mail.',
    body: html`
  <main class="page">
    <section class="intro">
      <h1>Lost in the mail</h1>
      <p>We couldn't find that postcard. Double-check the link, or <a href="/">send one of your own</a>.</p>
    </section>
  </main>`,
  });
}
