import { RequestHandler } from "express";
import { config } from "../lib/env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseTrustedOrigins(): string[] {
  // Use centralized config.trustedOrigins (TRUSTED_ORIGINS ?? FRONTEND_URL) but normalize to origin
  return config.trustedOrigins
    .map((o) => {
      try {
        return new URL(o).origin;
      } catch {
        return o;
      }
    });
}

function getRequestOrigin(req: { headers: Record<string, unknown> }): string | null {
  const origin = req.headers.origin as string | undefined;
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }
  // Fallback to Referer for form submissions / same-document navigations
  const referer = req.headers.referer as string | undefined;
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * CSRF guard for cookie-authenticated mutations.
 *
 * - Skips safe methods (GET/HEAD/OPTIONS)
 * - Skips requests without cookies (no session to hijack)
 * - Requires Origin or Referer to match TRUSTED_ORIGINS / FRONTEND_URL
 *
 * This complements better-auth's built-in CSRF for /api/auth/* which is
 * not applied to custom /api/v1/* routes that use requireAuth directly.
 */
export const csrfGuard: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // No cookies = no session to hijack (API-key / public endpoints)
  const hasCookie = Boolean(req.headers.cookie);
  if (!hasCookie) {
    next();
    return;
  }

  const trustedOrigins = parseTrustedOrigins();
  const requestOrigin = getRequestOrigin(req as unknown as { headers: Record<string, unknown> });

  if (!requestOrigin) {
    res.status(403).json({
      success: false,
      message: "CSRF validation failed: missing Origin/Referer",
    });
    return;
  }

  if (!trustedOrigins.includes(requestOrigin)) {
    res.status(403).json({
      success: false,
      message: "CSRF validation failed: untrusted origin",
    });
    return;
  }

  next();
};
