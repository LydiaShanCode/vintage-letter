import { api, formatDay, loadSent, rememberSent } from './shared.js';

const form = document.querySelector('[data-compose]');
const share = document.querySelector('[data-share]');
const errorEl = form.querySelector('[data-error]');
const message = form.elements.message;
const counter = form.querySelector('[data-counter]');
const capsuleToggle = form.querySelector('[data-capsule-toggle]');
const capsuleField = form.querySelector('[data-capsule-field]');
const dateInput = form.elements.unlockDate;
const submitButton = form.querySelector('button[type="submit"]');

const toDateInputValue = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function updateCounter() {
  counter.textContent = `${[...message.value].length} / ${message.maxLength}`;
}

function setThemePreview() {
  const theme = form.elements.theme.value;
  document.body.className = document.body.className.replace(/theme-\S+/, `theme-${theme}`);
}

function showError(text, field) {
  errorEl.textContent = text;
  errorEl.hidden = false;
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  const input = field === 'unlockAt' ? dateInput : field && form.elements[field];
  if (input instanceof HTMLElement) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
}

// A "day" is interpreted in the sender's timezone: the capsule opens at their local midnight.
function unlockAtFromDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

function collect() {
  const data = {
    recipientName: form.elements.recipientName.value,
    senderName: form.elements.senderName.value,
    message: message.value,
    theme: form.elements.theme.value,
  };
  if (!data.recipientName.trim()) throw Object.assign(new Error("Who's it for?"), { field: 'recipientName' });
  if (!data.senderName.trim()) throw Object.assign(new Error('Sign your name.'), { field: 'senderName' });
  if (!data.message.trim()) throw Object.assign(new Error('Write a little something.'), { field: 'message' });
  if (capsuleToggle.checked) {
    if (!dateInput.value) throw Object.assign(new Error('Pick the day it should open.'), { field: 'unlockAt' });
    data.unlockAt = unlockAtFromDate(dateInput.value);
  }
  return data;
}

function showShare({ postcard, url, trackUrl }) {
  const text = `${postcard.senderName} sent you a postcard`;
  const full = `${text}: ${url}`;

  share.querySelector('[data-share-summary]').textContent = postcard.unlockAt
    ? `Sealed as a time capsule for ${postcard.recipientName} until ${formatDay(postcard.unlockAt)}.`
    : `Send this link to ${postcard.recipientName}.`;
  share.querySelector('[data-share-url]').value = url;
  share.querySelector('[data-share-sms]').href = `sms:?&body=${encodeURIComponent(full)}`;
  share.querySelector('[data-share-whatsapp]').href = `https://wa.me/?text=${encodeURIComponent(full)}`;

  const messenger = share.querySelector('[data-share-messenger]');
  if (matchMedia('(pointer: coarse)').matches) {
    messenger.href = `fb-messenger://share/?link=${encodeURIComponent(url)}`;
    messenger.hidden = false;
  }

  const nativeShare = share.querySelector('[data-native-share]');
  if (navigator.share) {
    nativeShare.hidden = false;
    nativeShare.onclick = () => navigator.share({ title: text, text, url }).catch(() => {});
  }

  const track = share.querySelector('[data-track-link]');
  track.href = trackUrl;
  track.textContent = 'Track this postcard';

  form.hidden = true;
  share.hidden = false;
  share.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSent() {
  const section = document.querySelector('[data-sent]');
  if (!section) return;
  const sent = loadSent();
  const list = section.querySelector('[data-sent-list]');
  list.replaceChildren(
    ...sent.map((entry) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = entry.trackUrl;
      a.textContent = `To ${entry.recipientName}`;
      const meta = document.createElement('span');
      meta.className = 'muted';
      meta.textContent = entry.unlockAt
        ? ` · opens ${formatDay(entry.unlockAt)}`
        : ` · sent ${formatDay(entry.createdAt)}`;
      li.append(a, meta);
      return li;
    }),
  );
  section.hidden = sent.length === 0;
}

message.addEventListener('input', updateCounter);
form.addEventListener('change', (e) => {
  if (e.target.name === 'theme') setThemePreview();
});

capsuleToggle.addEventListener('change', () => {
  capsuleField.hidden = !capsuleToggle.checked;
  if (capsuleToggle.checked) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const max = new Date();
    max.setFullYear(max.getFullYear() + 10);
    dateInput.min = toDateInputValue(tomorrow);
    dateInput.max = toDateInputValue(max);
    if (!dateInput.value) dateInput.value = dateInput.min;
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  let body;
  try {
    body = collect();
  } catch (err) {
    return showError(err.message, err.field);
  }

  submitButton.disabled = true;
  try {
    const result = await api(form.dataset.endpoint, { method: 'POST', body });
    rememberSent({
      id: result.postcard.id,
      trackUrl: result.trackUrl,
      recipientName: result.postcard.recipientName,
      createdAt: result.postcard.createdAt,
      unlockAt: result.postcard.unlockAt,
    });
    showShare(result);
    renderSent();
  } catch (err) {
    showError(err.message, err.field);
  } finally {
    submitButton.disabled = false;
  }
});

share.querySelector('[data-copy]').addEventListener('click', async (e) => {
  const input = share.querySelector('[data-share-url]');
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand('copy');
  }
  e.target.textContent = 'Copied';
  setTimeout(() => (e.target.textContent = 'Copy'), 1500);
});

share.querySelector('[data-new]').addEventListener('click', () => {
  if (form.dataset.endpoint !== '/api/postcards') return location.assign('/');
  form.reset();
  capsuleField.hidden = true;
  updateCounter();
  setThemePreview();
  share.hidden = true;
  form.hidden = false;
});

updateCounter();
renderSent();
