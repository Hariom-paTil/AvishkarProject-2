/**
 * Internship Types and Standard Schema Definitions
 * Provides standard data contracts for search queries, normalized listings,
 * source adapters, and scoring breakdowns.
 */

/**
 * Standard Work Mode enum
 */
const WorkMode = Object.freeze({
  REMOTE: "remote",
  HYBRID: "hybrid",
  ONSITE: "onsite",
  UNKNOWN: "unknown"
});

/**
 * Source Status enum
 */
const SourceStatus = Object.freeze({
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  ERROR: "ERROR",
  TIMEOUT: "TIMEOUT",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  RATE_LIMITED: "RATE_LIMITED"
});

/**
 * Creates an empty/default normalized listing adhering to the standard schema
 * @param {Partial<NormalizedInternship>} data
 * @returns {NormalizedInternship}
 */
function createNormalizedListing(data = {}) {
  return {
    id: data.id || "",
    source: data.source || "Unknown",
    sourceListingUrl: data.sourceListingUrl || "",
    canonicalUrl: data.canonicalUrl || "",
    directApplyUrl: data.directApplyUrl || data.sourceListingUrl || "",
    externalId: data.externalId ? String(data.externalId) : "",
    title: data.title || "",
    company: data.company || "",
    companyWebsite: data.companyWebsite || "",
    description: data.description || "",
    responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : [],
    qualifications: Array.isArray(data.qualifications) ? data.qualifications : [],
    requiredSkills: Array.isArray(data.requiredSkills) ? data.requiredSkills : [],
    preferredSkills: Array.isArray(data.preferredSkills) ? data.preferredSkills : [],
    location: data.location || "Location not specified",
    city: data.city || "",
    country: data.country || "",
    workMode: Object.values(WorkMode).includes(data.workMode) ? data.workMode : WorkMode.UNKNOWN,
    duration: data.duration || "Duration not specified",
    startDate: data.startDate || "Flexible / Not specified",
    deadline: data.deadline || "Open until filled",
    postedDate: data.postedDate || null,
    stipend: data.stipend || "Unpaid / Not disclosed",
    status: data.status || "active",
    lastCheckedAt: data.lastCheckedAt || new Date().toISOString(),
    completenessScore: typeof data.completenessScore === "number" ? data.completenessScore : 0,
    mergedSources: Array.isArray(data.mergedSources) ? data.mergedSources : [data.source || "Unknown"],
    contentHash: data.contentHash || "",
    category: data.category || "Software Engineering",
    // Score & match enrichment properties
    score: typeof data.score === "number" ? data.score : 0,
    scoreBreakdown: data.scoreBreakdown || null,
    matchExplanation: data.matchExplanation || "",
    matchingSkills: Array.isArray(data.matchingSkills) ? data.matchingSkills : [],
    missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
    uncertainties: Array.isArray(data.uncertainties) ? data.uncertainties : []
  };
}

module.exports = {
  WorkMode,
  SourceStatus,
  createNormalizedListing
};
