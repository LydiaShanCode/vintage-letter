import './style.css';
import { PAGES } from './content.js';

const BASE_SPEED = 22;
const SPEED_VARIANCE = 14;
const PAUSE_AFTER = { '.': 280, '!': 280, '?': 280, ',': 120, ';': 160, ':': 160, '\n': 220 };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const bookEl = document.getElementById('book');
const playBtn = document.getElementById('play');
const pauseBtn = document.getElementById('pause');
const restartBtn = document.getElementById('restart');

const leafCount = PAGES.length / 2;
let spread = 0;
let flipping = false;
let playing = true;
let writeToken = 0;
let didDrag = false;
let spreadComplete = false;

function leafEls() {
  return [...bookEl.querySelectorAll('.leaf')];
}

function buildBook() {
  const spine = document.createElement('div');
  spine.className = 'spine';
  bookEl.appendChild(spine);

  for (let i = 0; i < leafCount; i += 1) {
    const leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.dataset.leaf = String(i);
    leaf.style.zIndex = String(leafCount - i);

    const front = renderPage(PAGES[i * 2], 'front');
    const back = renderPage(PAGES[i * 2 + 1], 'back');
    leaf.append(front, back);
    bookEl.appendChild(leaf);
  }
}

function renderPage(page, face) {
  const pageEl = document.createElement('article');
  pageEl.className = `page ${face}`;
  pageEl.dataset.page = String(page.id);

  const inner = document.createElement('div');
  inner.className = 'page-inner';

  page.photos.forEach((photo) => {
    const frame = document.createElement('div');
    frame.className = photo.rotate ? 'photo is-rotated' : 'photo';
    frame.style.left = photo.left;
    frame.style.top = photo.top;
    frame.style.width = photo.width;
    frame.style.height = photo.height;
    frame.style.opacity = String(photo.opacity ?? 1);

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = '';
    img.draggable = false;
    frame.appendChild(img);
    inner.appendChild(frame);
  });

  if (page.tab) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    inner.appendChild(tab);
  }

  const tracing = document.createElement('div');
  tracing.className = `tracing ${page.tracing === 'full' ? 'is-full' : 'is-sheet'}`;
  tracing.addEventListener('click', (event) => {
    event.stopPropagation();
    if (didDrag) return;
    tracing.classList.toggle('is-lifted');
  });

  const letter = document.createElement('div');
  letter.className = 'letter';
  letter.dataset.fullText = page.text;
  tracing.appendChild(letter);
  inner.appendChild(tracing);
  pageEl.appendChild(inner);
  return pageEl;
}

function visiblePages() {
  if (spread === 0) return [PAGES[0]];
  if (spread === leafCount) return [PAGES[PAGES.length - 1]];
  return [PAGES[spread * 2 - 1], PAGES[spread * 2]];
}

function letterElFor(pageId) {
  return bookEl.querySelector(`.page[data-page="${pageId}"] .letter`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitIfPaused(token) {
  while (!playing && token === writeToken) {
    await sleep(40);
  }
}

async function writeText(letter, text, token) {
  const cursor = document.createElement('span');
  cursor.className = 'writing-cursor';

  if (reduceMotion) {
    letter.textContent = text;
    return;
  }

  for (let i = 0; i < text.length; i += 1) {
    if (token !== writeToken) return;
    await waitIfPaused(token);
    if (token !== writeToken) return;
    const char = text[i];
    letter.appendChild(document.createTextNode(char));
    letter.appendChild(cursor);
    let delay = BASE_SPEED + (Math.random() - 0.5) * SPEED_VARIANCE;
    if (PAUSE_AFTER[char]) delay += PAUSE_AFTER[char];
    if (Math.random() < 0.04) delay += Math.random() * 180;
    await sleep(delay);
  }

  cursor.remove();
}

async function writeSpread() {
  const token = ++writeToken;
  spreadComplete = false;
  const pages = visiblePages();

  pages.forEach((page) => {
    const letter = letterElFor(page.id);
    if (letter) letter.replaceChildren();
  });

  for (const page of pages) {
    if (token !== writeToken) return;
    const letter = letterElFor(page.id);
    if (!letter) continue;
    await writeText(letter, page.text, token);
    await sleep(token === writeToken ? 180 : 0);
  }

  if (token !== writeToken) return;
  spreadComplete = true;
  if (!playing || spread >= leafCount) return;
  await sleep(1100);
  if (token === writeToken && playing) turn(1);
}

function syncLeafStack() {
  leafEls().forEach((leaf, index) => {
    const flipped = leaf.classList.contains('flipped');
    if (leaf.classList.contains('is-turning') || leaf.classList.contains('is-dragging')) return;
    leaf.style.zIndex = String(flipped ? index + 1 : leafCount - index);
  });
}

function applySpread() {
  bookEl.dataset.spread = String(spread);
  bookEl.classList.toggle('is-open', spread > 0 && spread < leafCount);
}

function turn(direction) {
  const nextSpread = spread + direction;
  if (flipping || nextSpread < 0 || nextSpread > leafCount) return false;

  flipping = true;
  writeToken += 1;

  const leafIndex = direction > 0 ? spread : nextSpread;
  const leaf = bookEl.querySelector(`.leaf[data-leaf="${leafIndex}"]`);
  leaf.style.transform = '';
  leaf.classList.add('is-turning');
  leaf.classList.toggle('flipped', direction > 0);

  spread = nextSpread;
  applySpread();

  window.setTimeout(() => {
    leaf.classList.remove('is-turning');
    syncLeafStack();
    flipping = false;
    writeSpread();
  }, reduceMotion ? 0 : 700);

  return true;
}

function setPlaying(next) {
  playing = next;
  playBtn.setAttribute('aria-pressed', String(playing));
  pauseBtn.setAttribute('aria-pressed', String(!playing));
  if (playing && spreadComplete && !flipping && spread < leafCount) {
    turn(1);
  }
}

function restart() {
  spreadComplete = false;
  writeToken += 1;
  flipping = false;
  didDrag = false;
  setPlaying(true);

  leafEls().forEach((leaf, index) => {
    leaf.classList.remove('flipped', 'is-turning', 'is-dragging');
    leaf.style.transform = '';
    leaf.style.zIndex = String(leafCount - index);
  });

  bookEl.querySelectorAll('.letter').forEach((node) => node.replaceChildren());
  bookEl.querySelectorAll('.tracing.is-lifted').forEach((node) => {
    node.classList.remove('is-lifted');
  });

  spread = 0;
  applySpread();
  writeSpread();
}

function setupDrag() {
  let drag = null;

  const pageWidth = () => bookEl.getBoundingClientRect().width / 2;

  function targetLeaf(direction) {
    const index = direction > 0 ? spread : spread - 1;
    if (index < 0 || index >= leafCount) return null;
    return bookEl.querySelector(`.leaf[data-leaf="${index}"]`);
  }

  function follow(leaf, direction, dx) {
    const ratio = Math.max(0, Math.min(1, Math.abs(dx) / pageWidth()));
    const angle = direction > 0 ? -180 * ratio : -180 + 180 * ratio;
    leaf.style.transform = `rotateY(${angle}deg)`;
    return ratio;
  }

  function finish(leaf, direction, ratio) {
    leaf.classList.remove('is-dragging');
    leaf.style.transform = '';
    bookEl.classList.remove('is-dragging');

    if (ratio > 0.28) {
      turn(direction);
    } else {
      syncLeafStack();
      writeSpread();
    }
  }

  bookEl.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (flipping) return;
    didDrag = false;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      direction: 0,
      leaf: null,
    };
    bookEl.setPointerCapture(event.pointerId);
  });

  bookEl.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;

    if (!drag.direction && Math.abs(dx) > 14) {
      drag.direction = dx < 0 ? 1 : -1;
      drag.leaf = targetLeaf(drag.direction);
      if (!drag.leaf) {
        drag = null;
        return;
      }
      didDrag = true;
      setPlaying(false);
      writeToken += 1;
      drag.leaf.classList.add('is-dragging');
      bookEl.classList.add('is-dragging');
    }

    if (!drag.direction || !drag.leaf) return;
    event.preventDefault();
    follow(drag.leaf, drag.direction, dx);
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const current = drag;
    drag = null;

    if (!current.leaf || !current.direction) return;
    const dx = event.clientX - current.x;
    const ratio = Math.max(0, Math.min(1, Math.abs(dx) / pageWidth()));
    finish(current.leaf, current.direction, current.direction > 0 ? (dx < 0 ? ratio : 0) : (dx > 0 ? ratio : 0));
  }

  bookEl.addEventListener('pointerup', endDrag);
  bookEl.addEventListener('pointercancel', endDrag);
}

function onKey(event) {
  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    setPlaying(!playing);
    return;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    setPlaying(false);
    turn(1);
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    setPlaying(false);
    turn(-1);
  }
}

buildBook();
setupDrag();
applySpread();
setPlaying(true);

playBtn.addEventListener('click', () => setPlaying(true));
pauseBtn.addEventListener('click', () => setPlaying(false));
restartBtn.addEventListener('click', restart);
document.addEventListener('keydown', onKey);

writeSpread();
