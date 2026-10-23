/**
 * URL Canonicalization and Validation Utilities
 * Strips tracking parameters, normalizes scheme/host, and ensures URL safety.
 */

const TRACKING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "ref",
  "ref_src",
  "ref_page",
  "referrer",
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "trk",
  "trackingid",
  "tracking_id",
  "originalsubdomain",
  "gh_src",
  "_gl",
  "_ga",
  "mc_cid",
  "mc_eid",
  "source",
  "si",
  "spm",
  "igshid",
  "origin"
]);

/**
 * Validates whether a URL is syntactically valid and uses a safe protocol (http/https).
 * @param {string} rawUrl
 * @returns {boolean}
 */
function isValidUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return false;
  const trimmed = rawUrl.trim();

  // Reject malicious schemes immediately
  if (/^(javascript|data|file|vbscript):/i.test(trimmed)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Canonicalizes a URL by stripping tracking parameters, normalizing host,
 * and standardizing path trailing slashes.
 * @param {string} rawUrl
 * @returns {string} Canonical URL or empty string if invalid
 */
function canonicalizeUrl(rawUrl) {
  if (!isValidUrl(rawUrl)) return "";

  try {
    const parsed = new URL(rawUrl.trim());

    // Normalize protocol and hostname
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Strip default ports
    if ((parsed.protocol === "http:" && parsed.port === "80") ||
        (parsed.protocol === "https:" && parsed.port === "443")) {
      parsed.port = "";
    }

    // Strip tracking parameters
    const keysToDelete = [];
    parsed.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      if (TRACKING_QUERY_PARAMS.has(lowerKey) || lowerKey.startsWith("utm_")) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    // Sort remaining parameters for deterministic output
    parsed.searchParams.sort();

    // Normalize path (collapse duplicate slashes, remove trailing slash unless root)
    let pathname = parsed.pathname.replace(/\/+/g, "/");
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;

    // Strip hash fragment for canonical application deduplication
    parsed.hash = "";

    return parsed.toString();
  } catch {
    return "";
  }
}

module.exports = {
  isValidUrl,
  canonicalizeUrl
};
