// Auth middleware stubs — replace with real JWT verification when auth is implemented

export function requireAuth(_req, _res, next) {
  // TODO: verify JWT, attach req.user
  next();
}

export function optionalAuth(_req, _res, next) {
  // TODO: decode JWT if present, attach req.user
  next();
}
