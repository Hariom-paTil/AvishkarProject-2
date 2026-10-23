/**
 * Text Cleanup Utilities
 * Strips HTML tags, decodes entities, collapses whitespace,
 * and validates content safety.
 */

const HTML_ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&copy;": "©",
  "&reg;": "®",
  "&ndash;": "-",
  "&mdash;": "—",
  "&bull;": "•",
  "&middot;": "·"
};

/**
 * Strips HTML tags safely and decodes standard HTML entities.
 * @param {string} input - Raw HTML or string
 * @returns {string} Clean plain text
 */
function stripHtml(input) {
  if (typeof input !== "string" || !input) return "";

  // Remove <script> and <style> blocks completely
  let text = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");

  // Convert break and paragraph tags to newlines
  text = text.replace(/<(?:br|\/p|\/li|\/tr|hr)\s*\/?>/gi, "\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode standard named entities
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    text = text.split(entity).join(replacement);
  }

  // Decode numeric entities (&#123; and &#x1f;)
  text = text.replace(/&#(\d+);/g, (_, dec) => {
    try {
      return String.fromCharCode(parseInt(dec, 10));
    } catch {
      return "";
    }
  });
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return "";
    }
  });

  return normalizeWhitespace(text);
}

/**
 * Normalizes excessive whitespace and collapses spaces.
 * Preserves simple line breaks where appropriate.
 * @param {string} text
 * @returns {string}
 */
function normalizeWhitespace(text) {
  if (typeof text !== "string" || !text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Truncate text to a maximum length with ellipsis.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function truncateText(text, maxLen = 300) {
  if (!text || text.length <= maxLen) return text || "";
  return text.slice(0, maxLen).trim() + "...";
}

module.exports = {
  stripHtml,
  normalizeWhitespace,
  truncateText
};
