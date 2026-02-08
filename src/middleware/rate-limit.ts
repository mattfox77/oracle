/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints against abuse with sensible defaults.
 *
 * Configure via:
 *   RATE_LIMIT_WINDOW_MS=60000       (window duration, default 1 minute)
 *   RATE_LIMIT_MAX_REQUESTS=60       (max requests per window, default 60)
 */

import rateLimit from 'express-rate-limit';

export function createRateLimiter() {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
  const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60');

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
}
