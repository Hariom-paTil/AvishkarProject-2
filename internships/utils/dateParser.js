/**
 * Date Parsing and Recency Calculation Utilities
 * Parses various date formats, relative date strings, and computes recency scores.
 */

/**
 * Parses a date value into an ISO string or null.
 * Accepts ISO string, Date object, Unix timestamp (sec or ms), or relative phrase.
 * @param {string|number|Date} input
 * @returns {string|null} ISO 8601 string or null if unparseable
 */
function parseDate(input) {
  if (!input) return null;

  if (input instanceof Date && !isNaN(input.getTime())) {
    return input.toISOString();
  }

  if (typeof input === "number") {
    // Check if seconds or milliseconds
    const ms = input < 1e11 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof input !== "string") return null;
  const str = input.trim();
  if (!str) return null;

  // Check if string is purely numeric timestamp
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    const ms = num < 1e11 ? num * 1000 : num;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Check relative phrases like "3 days ago", "yesterday", "2 hours ago"
  const relativeMatch = str.match(/(\d+)\s+(hour|day|week|month|year)s?\s+ago/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const now = new Date();
    if (unit === "hour") now.setHours(now.getHours() - amount);
    else if (unit === "day") now.setDate(now.getDate() - amount);
    else if (unit === "week") now.setDate(now.getDate() - amount * 7);
    else if (unit === "month") now.setMonth(now.getMonth() - amount);
    else if (unit === "year") now.setFullYear(now.getFullYear() - amount);
    return now.toISOString();
  }

  if (/^today|just now|moments ago/i.test(str)) {
    return new Date().toISOString();
  }

  if (/^yesterday/i.test(str)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }

  // Attempt direct Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

/**
 * Calculates age of a posting in days.
 * @param {string|null} isoDate
 * @returns {number|null} Number of days or null if date is unknown
 */
function getAgeInDays(isoDate) {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (isNaN(parsed.getTime())) return null;

  const diffMs = Math.max(0, Date.now() - parsed.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates a recency score from 0 to 8 points based on posting age.
 * @param {string|null} isoDate
 * @returns {number} Score between 0 and 8
 */
function calculateRecencyScore(isoDate) {
  const age = getAgeInDays(isoDate);
  if (age === null) return 2; // Neutral default for unspecified dates

  if (age <= 3) return 8;
  if (age <= 7) return 7;
  if (age <= 14) return 5;
  if (age <= 30) return 3;
  if (age <= 60) return 1;
  return 0; // Stale (> 60 days)
}

/**
 * Formats a date into a clean human-readable relative or calendar string.
 * @param {string|null} isoDate
 * @returns {string} Formatted label (e.g. "Posted 2 days ago")
 */
function formatDisplayDate(isoDate) {
  if (!isoDate) return "Date not provided";
  const age = getAgeInDays(isoDate);
  if (age === null) return "Date not provided";

  if (age === 0) return "Posted today";
  if (age === 1) return "Posted yesterday";
  if (age < 7) return `Posted ${age} days ago`;
  if (age < 30) return `Posted ${Math.floor(age / 7)} week${Math.floor(age / 7) > 1 ? "s" : ""} ago`;

  try {
    const d = new Date(isoDate);
    return `Posted ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  } catch {
    return "Date not provided";
  }
}

module.exports = {
  parseDate,
  getAgeInDays,
  calculateRecencyScore,
  formatDisplayDate
};
