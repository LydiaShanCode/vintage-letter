/** Fixed-window, in-memory limiter. Good enough for a single instance; swap for Redis when scaling out. */
export function rateLimit({ windowMs, max, now = Date.now }) {
  const hits = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const t = now();
    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || t >= entry.resetAt) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (t >= v.resetAt) hits.delete(k);
    }

    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      return res.status(429).json({ error: 'Too many postcards at once. Try again in a few minutes.', code: 'rate_limited' });
    }
    next();
  };
}
