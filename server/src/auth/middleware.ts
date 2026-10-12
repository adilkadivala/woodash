import type { Request, Response, NextFunction } from 'express';
import { parseCookie } from 'cookie';
import { verifySession } from './sessions.js';
import { verifyApiKey } from './apiKeys.js';
import type { Principal } from './principal.js';

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

/**
 * Require a valid session cookie ('sid').
 */
export async function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    const cookies = parseCookie(req.headers.cookie || '');
    const sid = cookies.sid;

    if (!sid) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing session cookie' } });
      return;
    }

    const session = await verifySession(sid);
    if (!session) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired session' } });
      return;
    }

    req.principal = {
      userId: session.userId,
      role: session.role as 'admin' | 'member',
      via: 'session',
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require a valid API key via Authorization Bearer header.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid Authorization header' } });
      return;
    }

    const token = authHeader.substring(7);
    const apiKey = await verifyApiKey(token);

    if (!apiKey) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid or revoked API key' } });
      return;
    }

    req.principal = {
      userId: apiKey.userId,
      role: apiKey.role as 'admin' | 'member',
      via: 'apikey',
      apiKeyId: apiKey.keyId,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require authentication, trying session first, then API key.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Try session cookie first
    const cookies = parseCookie(req.headers.cookie || '');
    const sid = cookies.sid;

    if (sid) {
      const session = await verifySession(sid);
      if (session) {
        req.principal = {
          userId: session.userId,
          role: session.role as 'admin' | 'member',
          via: 'session',
        };
        return next();
      }
    }

    // Try API key
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const apiKey = await verifyApiKey(token);
      if (apiKey) {
        req.principal = {
          userId: apiKey.userId,
          role: apiKey.role as 'admin' | 'member',
          via: 'apikey',
          apiKeyId: apiKey.keyId,
        };
        return next();
      }
    }

    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  } catch (error) {
    next(error);
  }
}

/**
 * Require a specific role. Must be used after an authentication middleware.
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.principal) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    if (req.principal.role !== role) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: `Role '${role}' required` } });
      return;
    }

    next();
  };
}
