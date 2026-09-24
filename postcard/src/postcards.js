import { randomId, hashKey, keyMatches } from './ids.js';

export const LIMITS = {
  nameLength: 40,
  messageLength: 500,
  maxUnlockYears: 10,
  maxRepliesPerPostcard: 10,
};

export const THEMES = ['sunset', 'ocean', 'meadow', 'night'];

const ID_LENGTH = 12;
const SENDER_KEY_LENGTH = 24;
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export class PostcardError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

const invalid = (field, message) => new PostcardError(400, 'invalid', message, field);
const notFound = () => new PostcardError(404, 'not_found', 'That postcard could not be found.');

const charCount = (s) => [...s].length;

function cleanText(value, field, label, max, { multiline = false } = {}) {
  if (typeof value !== 'string') throw invalid(field, `${label} is required.`);
  let text = value.replace(/\r\n?/g, '\n');
  text = multiline ? text.replace(/\n{3,}/g, '\n\n') : text.replace(/\s+/g, ' ');
  text = text.trim();
  if (!text) throw invalid(field, `${label} is required.`);
  if (charCount(text) > max) throw invalid(field, `${label} must be ${max} characters or fewer.`);
  return text;
}

function parseUnlockAt(value, now) {
  if (value === undefined || value === null || value === '') return null;
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) throw invalid('unlockAt', 'The unlock date is not a valid date.');
  if (ms <= now) throw invalid('unlockAt', 'The unlock date must be in the future.');
  if (ms > now + LIMITS.maxUnlockYears * YEAR_MS) {
    throw invalid('unlockAt', `Time capsules can be sealed for at most ${LIMITS.maxUnlockYears} years.`);
  }
  return Math.floor(ms);
}

export function validatePostcardInput(input, now) {
  if (!input || typeof input !== 'object') throw invalid(null, 'Expected a postcard.');
  if (Array.isArray(input.media) && input.media.length > 0) {
    throw invalid('media', 'Photos and videos are coming soon — text only for now.');
  }
  const theme = input.theme ?? THEMES[0];
  if (!THEMES.includes(theme)) throw invalid('theme', 'Unknown card style.');

  return {
    senderName: cleanText(input.senderName, 'senderName', 'Your name', LIMITS.nameLength),
    recipientName: cleanText(input.recipientName, 'recipientName', "Your friend's name", LIMITS.nameLength),
    message: cleanText(input.message, 'message', 'A message', LIMITS.messageLength, { multiline: true }),
    theme,
    unlockAt: parseUnlockAt(input.unlockAt, now),
  };
}

export function createPostcardStore(db, { now = Date.now } = {}) {
  const insertStmt = db.prepare(`
    INSERT INTO postcards
      (id, parent_id, sender_name, recipient_name, message, theme, unlock_at, created_at, sender_key_hash)
    VALUES
      (:id, :parentId, :senderName, :recipientName, :message, :theme, :unlockAt, :createdAt, :senderKeyHash)
  `);
  const getStmt = db.prepare('SELECT * FROM postcards WHERE id = :id');
  const markOpenedStmt = db.prepare(
    'UPDATE postcards SET opened_at = :openedAt WHERE id = :id AND opened_at IS NULL',
  );
  const repliesStmt = db.prepare(
    'SELECT * FROM postcards WHERE parent_id = :id ORDER BY created_at ASC',
  );
  const replyCountStmt = db.prepare('SELECT COUNT(*) AS n FROM postcards WHERE parent_id = :id');

  const isLocked = (row) => row.unlock_at !== null && now() < row.unlock_at;

  function getRow(id) {
    if (typeof id !== 'string' || id.length > 64) return null;
    return getStmt.get({ id }) ?? null;
  }

  function requireRow(id) {
    const row = getRow(id);
    if (!row) throw notFound();
    return row;
  }

  function summary(row) {
    return {
      id: row.id,
      parentId: row.parent_id,
      senderName: row.sender_name,
      recipientName: row.recipient_name,
      theme: row.theme,
      unlockAt: row.unlock_at,
      createdAt: row.created_at,
      openedAt: row.opened_at,
      locked: isLocked(row),
    };
  }

  // Locked postcards never expose their message; this is the only place that decides that.
  function publicView(row) {
    const view = summary(row);
    if (!view.locked) {
      view.message = row.message;
      view.media = [];
    }
    return view;
  }

  function insert(fields, parentId = null) {
    const id = randomId(ID_LENGTH);
    const senderKey = randomId(SENDER_KEY_LENGTH);
    insertStmt.run({
      id,
      parentId,
      ...fields,
      createdAt: now(),
      senderKeyHash: hashKey(senderKey),
    });
    return { postcard: publicView(getStmt.get({ id })), senderKey };
  }

  return {
    create(input) {
      return insert(validatePostcardInput(input, now()));
    },

    view(id) {
      const row = getRow(id);
      return row ? publicView(row) : null;
    },

    markOpened(id) {
      const row = requireRow(id);
      if (isLocked(row)) {
        throw new PostcardError(403, 'locked', 'This postcard is still sealed.');
      }
      markOpenedStmt.run({ id, openedAt: now() });
      return publicView(getStmt.get({ id }));
    },

    reply(parentId, input) {
      const parent = requireRow(parentId);
      if (isLocked(parent)) {
        throw new PostcardError(403, 'locked', 'You can reply once the postcard has been opened.');
      }
      if (replyCountStmt.get({ id: parentId }).n >= LIMITS.maxRepliesPerPostcard) {
        throw new PostcardError(409, 'reply_limit', 'This postcard has already received the maximum number of replies.');
      }
      return insert(validatePostcardInput(input, now()), parentId);
    },

    // Everything the original sender may see: their own message plus who replied.
    // Reply contents stay behind the reply's own link (and its own time capsule).
    track(id, senderKey) {
      const row = getRow(id);
      if (!row || !keyMatches(senderKey, row.sender_key_hash)) throw notFound();
      return {
        ...summary(row),
        message: row.message,
        replies: repliesStmt.all({ id }).map(summary),
      };
    },

    // Also keeps `db` reachable: node:sqlite finalizes statements once their database is garbage-collected.
    close() {
      db.close();
    },
  };
}
