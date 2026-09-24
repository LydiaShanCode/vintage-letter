import { api, formatDay } from './shared.js';

const root = document.querySelector('[data-track]');
const title = root.querySelector('[data-track-title]');
const status = root.querySelector('[data-track-status]');
const key = decodeURIComponent(location.hash.slice(1));

function statusText(p) {
  if (p.locked) return `Sealed as a time capsule until ${formatDay(p.unlockAt)}.`;
  if (p.openedAt) return `Opened on ${formatDay(p.openedAt)}.`;
  return 'Delivered, not opened yet.';
}

function replyItem(reply) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = `/p/${reply.id}`;
  a.textContent = `${reply.senderName} sent one back`;
  const meta = document.createElement('span');
  meta.className = 'muted';
  meta.textContent = reply.locked ? ` · sealed until ${formatDay(reply.unlockAt)}` : ` · ${formatDay(reply.createdAt)}`;
  li.append(a, meta);
  return li;
}

async function load() {
  if (!key) {
    title.textContent = 'Missing tracking key';
    status.textContent = 'Use the full private link you got when you sent the postcard.';
    return;
  }
  try {
    const { postcard } = await api(`/api/postcards/${root.dataset.id}/track`, { headers: { 'X-Sender-Key': key } });
    title.textContent = `Your postcard to ${postcard.recipientName}`;
    status.textContent = statusText(postcard);

    const quote = root.querySelector('[data-track-message]');
    quote.textContent = postcard.message;
    quote.hidden = false;

    const view = root.querySelector('[data-track-view]');
    view.href = `/p/${postcard.id}`;
    view.hidden = false;

    if (postcard.replies.length) {
      root.querySelector('[data-track-reply-list]').replaceChildren(...postcard.replies.map(replyItem));
      root.querySelector('[data-track-replies]').hidden = false;
    }
  } catch {
    title.textContent = 'Postcard not found';
    status.textContent = 'This tracking link is not valid.';
  }
}

load();
