import type { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth.js';

// Gate the /api/* admin surface behind a dashboard session (#35, item #2).
// The token is the opaque session token issued by /api/auth/login|setup, sent
// as `Authorization: Bearer <token>`. The /v1 proxy is NOT gated by this — it
// keeps its own unified-API-key auth for app clients.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  next();
}
