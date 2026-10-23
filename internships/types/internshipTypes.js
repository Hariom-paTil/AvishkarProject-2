/**
 * Internship Types and Standard Schema Definitions
 * Provides standard data contracts for search queries, normalized listings,
 * source adapters, verification statuses, and scoring breakdowns.
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
 * Verification Status enum
 * Verified: Source page and application link were verified active on company/host system.
 * Recently discovered: Source exists, but active status or full details could not be completely confirmed.
 * Needs confirmation: Important details (deadline, eligibility, availability) are missing or require confirmation.
 */
const VerificationStatus = Object.freeze({
  VERIFIED: "Verified",
  RECENTLY_DISCOVERED: "Recently discovered",
  NEEDS_CONFIRMATION: "Needs confirmation"
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

    // Verification properties
    verificationStatus: Object.values(VerificationStatus).includes(data.verificationStatus)
      ? data.verificationStatus
      : VerificationStatus.RECENTLY_DISCOVERED,
    isVerified: Boolean(data.isVerified),
    verificationDetails: Array.isArray(data.verificationDetails) ? data.verificationDetails : [],
    verifiedAt: data.verifiedAt || null,
    qualityTier: data.qualityTier || "otherRelevant", // "bestVerified" | "otherRelevant" | "needsConfirmation"

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
  VerificationStatus,
  createNormalizedListing
};
