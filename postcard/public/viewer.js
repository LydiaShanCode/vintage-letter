import { api, formatDates } from './shared.js';

const stage = document.querySelector('[data-viewer]');
formatDates();

function startCountdown(unlockAt) {
  const el = stage.querySelector('[data-countdown]');
  const tick = () => {
    const left = unlockAt - Date.now();
    if (left <= 0) {
      el.textContent = 'Opening…';
      // Small buffer so a slightly-behind client clock doesn't reload into a still-locked page.
      setTimeout(() => location.reload(), 1500);
      return;
    }
    const s = Math.floor(left / 1000);
    const days = Math.floor(s / 86400);
    const parts = [
      days ? `${days}d` : null,
      `${String(Math.floor((s % 86400) / 3600)).padStart(2, '0')}h`,
      `${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`,
      `${String(s % 60).padStart(2, '0')}s`,
    ].filter(Boolean);
    el.textContent = parts.join(' ');
    setTimeout(tick, 1000 - (Date.now() % 1000));
  };
  tick();
}

function setupOpen() {
  const envelope = stage.querySelector('[data-envelope]');
  const inner = stage.querySelector('[data-card-inner]');

  stage.querySelector('[data-open]').addEventListener('click', () => {
    envelope.classList.add('is-opening');
    setTimeout(() => stage.classList.add('is-open'), 450);
    api(`/api/postcards/${stage.dataset.id}/open`, { method: 'POST' }).catch(() => {});
  });

  stage.querySelector('[data-flip]').addEventListener('click', () => {
    inner.classList.toggle('is-flipped');
  });
}

if (stage.dataset.unlockAt) startCountdown(Number(stage.dataset.unlockAt));
else setupOpen();
