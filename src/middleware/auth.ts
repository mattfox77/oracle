/**
 * API Key Authentication Middleware
 *
 * Validates requests against configured API keys via the Authorization header
 * (Bearer token) or X-API-Key header. Disabled when no API keys are configured
 * (development default).
 *
 * Configure via:
 *   ORACLE_API_KEYS=key1,key2,key3   (comma-separated list)
 */

import { Request, Response, NextFunction } from 'express';
import { loggers } from 'the-machina';

let apiKeys: Set<string> | null = null;

function getApiKeys(): Set<string> | null {
  if (apiKeys !== null) return apiKeys.size > 0 ? apiKeys : null;

  const raw = process.env.ORACLE_API_KEYS;
  if (!raw || raw.trim().length === 0) {
    apiKeys = new Set();
    return null;
  }

  apiKeys = new Set(
    raw.split(',').map(k => k.trim()).filter(k => k.length > 0)
  );

  loggers.app.info('API key authentication enabled', { keyCount: apiKeys.size });
  return apiKeys.size > 0 ? apiKeys : null;
}

function extractToken(req: Request): string | null {
  // Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  return null;
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const keys = getApiKeys();

  // If no keys configured, auth is disabled (development mode)
  if (!keys) {
    return next();
  }

  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Provide Bearer token or X-API-Key header.' });
    return;
  }

  if (!keys.has(token)) {
    loggers.app.warn('Invalid API key attempt', { ip: req.ip });
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
