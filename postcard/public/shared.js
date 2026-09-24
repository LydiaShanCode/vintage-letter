const SENT_KEY = 'postcard:sent';

export function formatDates(root = document) {
  const formats = {
    long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
    short: { year: 'numeric', month: 'short', day: 'numeric' },
  };
  for (const el of root.querySelectorAll('time[data-format]')) {
    const date = new Date(el.getAttribute('datetime'));
    if (!Number.isNaN(date.getTime())) el.textContent = date.toLocaleDateString(undefined, formats[el.dataset.format]);
  }
}

export const formatDay = (ms) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Please try again.');
    err.field = data.field;
    err.status = res.status;
    throw err;
  }
  return data;
}

export function loadSent() {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY)) || [];
  } catch {
    return [];
  }
}

export function rememberSent(entry) {
  try {
    const sent = loadSent().filter((e) => e.id !== entry.id);
    localStorage.setItem(SENT_KEY, JSON.stringify([entry, ...sent].slice(0, 50)));
  } catch {
    // Private browsing or storage full: the share panel still shows the tracking link.
  }
}
