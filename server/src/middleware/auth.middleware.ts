import { Request, Response, NextFunction } from 'express';

// Auth middleware stubs — replace with real JWT verification when auth is implemented

export function requireAuth(_req: Request, _res: Response, next: NextFunction): void {
  // TODO: verify JWT, attach req.user
  next();
}

export function optionalAuth(_req: Request, _res: Response, next: NextFunction): void {
  // TODO: decode JWT if present, attach req.user
  next();
}
