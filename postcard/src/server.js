import { openDatabase } from './db.js';
import { createPostcardStore } from './postcards.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const db = openDatabase(process.env.DATABASE_PATH ?? 'data/postcard.db');
const app = createApp({
  store: createPostcardStore(db),
  publicUrl: process.env.PUBLIC_URL?.replace(/\/+$/, '') || undefined,
  trustProxy: process.env.TRUST_PROXY === 'true' ? 1 : false,
});

app.listen(port, () => {
  console.log(`Postcard listening on http://localhost:${port}`);
});
