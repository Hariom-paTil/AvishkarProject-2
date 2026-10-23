/**
 * Location Normalization Utilities
 * Normalizes location strings, detects work mode (remote, hybrid, onsite),
 * and checks location compatibility against user preferences.
 */

const { WorkMode } = require("../types/internshipTypes");

/**
 * Detects the work mode from location and description text.
 * @param {string} locationText
 * @param {string} [descriptionText=""]
 * @returns {string} One of WorkMode (remote, hybrid, onsite, unknown)
 */
function detectWorkMode(locationText = "", descriptionText = "") {
  const combined = `${locationText} ${descriptionText}`.toLowerCase();

  // Explicit Remote check
  if (
    combined.includes("remote") ||
    combined.includes("work from home") ||
    combined.includes("wfh") ||
    combined.includes("virtual") ||
    combined.includes("anywhere") ||
    combined.includes("telecommute")
  ) {
    if (combined.includes("hybrid")) {
      return WorkMode.HYBRID;
    }
    return WorkMode.REMOTE;
  }

  // Explicit Hybrid check
  if (combined.includes("hybrid") || combined.includes("partially remote")) {
    return WorkMode.HYBRID;
  }

  // Explicit Onsite check
  if (
    combined.includes("on-site") ||
    combined.includes("onsite") ||
    combined.includes("in-person") ||
    combined.includes("in office")
  ) {
    return WorkMode.ONSITE;
  }

  // If a location is provided (e.g., "San Francisco, CA" or "Bengaluru, India"), assume onsite
  if (locationText && locationText.trim().length > 2 && !/not specified|unknown|any/i.test(locationText)) {
    return WorkMode.ONSITE;
  }

  return WorkMode.UNKNOWN;
}

/**
 * Cleans and standardizes raw location string into structured parts.
 * @param {string} rawLocation
 * @returns {{ location: string, city: string, country: string, workMode: string }}
 */
function normalizeLocation(rawLocation = "") {
  if (typeof rawLocation !== "string" || !rawLocation.trim()) {
    return {
      location: "Location not specified",
      city: "",
      country: "",
      workMode: WorkMode.UNKNOWN
    };
  }

  const clean = rawLocation
    .replace(/[;|\/]+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  const workMode = detectWorkMode(clean);

  // Parse comma separated components
  const parts = clean.split(",").map(p => p.trim()).filter(Boolean);
  let city = "";
  let country = "";

  if (parts.length === 1) {
    city = parts[0];
  } else if (parts.length === 2) {
    city = parts[0];
    country = parts[1];
  } else if (parts.length >= 3) {
    city = parts[0];
    country = parts[parts.length - 1];
  }

  // Standardize common country names
  const lowerCountry = country.toLowerCase();
  if (lowerCountry === "usa" || lowerCountry === "us" || lowerCountry === "united states of america") {
    country = "United States";
  } else if (lowerCountry === "uk" || lowerCountry === "united kingdom") {
    country = "United Kingdom";
  } else if (lowerCountry === "in" || lowerCountry === "ind") {
    country = "India";
  }

  return {
    location: clean,
    city,
    country,
    workMode
  };
}

/**
 * Checks fit between user's workplace preference and listing's work mode.
 * @param {string} userPref - "Remote", "Hybrid", "On-site", "Any"
 * @param {string} listingMode - WorkMode enum
 * @returns {{ compatible: boolean, score: number, reason: string }}
 */
function checkWorkplaceCompatibility(userPref = "Any", listingMode = WorkMode.UNKNOWN) {
  const pref = (userPref || "Any").toLowerCase().replace(/[^a-z]/g, "");
  const mode = (listingMode || WorkMode.UNKNOWN).toLowerCase();

  // User has no preference
  if (pref === "any" || !pref) {
    return {
      compatible: true,
      score: 10,
      reason: "Matches your open workplace preference."
    };
  }

  if (pref === "remote") {
    if (mode === WorkMode.REMOTE) {
      return {
        compatible: true,
        score: 10,
        reason: "Fully remote position matches your remote preference."
      };
    }
    if (mode === WorkMode.HYBRID) {
      return {
        compatible: true,
        score: 6,
        reason: "Hybrid position with remote flexibility."
      };
    }
    if (mode === WorkMode.UNKNOWN) {
      return {
        compatible: true,
        score: 5,
        reason: "Workplace mode not explicitly specified."
      };
    }
    // Strict onsite when user specifically requested remote
    return {
      compatible: false,
      score: 0,
      reason: "Onsite requirement conflicts with remote preference."
    };
  }

  if (pref === "hybrid") {
    if (mode === WorkMode.HYBRID || mode === WorkMode.REMOTE) {
      return {
        compatible: true,
        score: 10,
        reason: "Matches your flexible/hybrid preference."
      };
    }
    return {
      compatible: true,
      score: 5,
      reason: "Onsite role, partial fit for hybrid preference."
    };
  }

  if (pref === "onsite") {
    if (mode === WorkMode.ONSITE || mode === WorkMode.HYBRID) {
      return {
        compatible: true,
        score: 10,
        reason: "In-office/onsite presence aligns with your preference."
      };
    }
    return {
      compatible: true,
      score: 6,
      reason: "Remote role available."
    };
  }

  return {
    compatible: true,
    score: 8,
    reason: "Workplace mode aligns reasonably well."
  };
}

module.exports = {
  detectWorkMode,
  normalizeLocation,
  checkWorkplaceCompatibility
};
