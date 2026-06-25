import type { Request, Response, NextFunction } from "express";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function normalizeHost(value: string) {
  const host = value.trim().toLowerCase().replace(/^\[(.*)](?::\d+)?$/, "$1");
  const hasSinglePortSeparator = host.indexOf(":") === host.lastIndexOf(":");

  return hasSinglePortSeparator ? host.replace(/:\d+$/, "") : host;
}

function getCanonicalUrl() {
  const rawUrl = process.env.PUBLIC_SITE_URL || process.env.CANONICAL_URL || "";
  if (!rawUrl.trim()) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;

  try {
    return new URL(withProtocol);
  } catch {
    throw new Error(
      "PUBLIC_SITE_URL must be a valid URL, for example: https://example.com",
    );
  }
}

export function redirectToCanonicalDomain(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const canonicalUrl = getCanonicalUrl();

  if (!canonicalUrl) {
    return next();
  }

  const currentHost = normalizeHost(req.hostname || req.headers.host || "");
  const canonicalHost = normalizeHost(canonicalUrl.hostname);

  if (
    !currentHost ||
    currentHost === canonicalHost ||
    LOOPBACK_HOSTS.has(currentHost)
  ) {
    return next();
  }

  canonicalUrl.pathname = req.path;
  canonicalUrl.search = req.url.includes("?")
    ? req.url.slice(req.url.indexOf("?"))
    : "";
  canonicalUrl.hash = "";

  return res.redirect(301, canonicalUrl.toString());
}
