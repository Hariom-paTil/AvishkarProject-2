/**
 * Normalization Service
 * Converts raw source adapter results into canonical NormalizedInternship data models.
 * Validates fields, calculates completeness scores, and eliminates malformed listings.
 */

const crypto = require("crypto");
const { createNormalizedListing } = require("../types/internshipTypes");
const { stripHtml, normalizeWhitespace } = require("../utils/textCleanup");
const { normalizeSkillList, extractSkillsFromText } = require("../utils/skillNormalization");
const { canonicalizeUrl, isValidUrl } = require("../utils/urlCanonicalizer");
const { parseDate } = require("../utils/dateParser");
const { normalizeLocation } = require("../utils/locationNormalization");

class NormalizationService {
  /**
   * Normalizes a raw listing from any source adapter into standard schema.
   * Rejects malformed or incomplete records.
   * @param {Object} raw
   * @returns {Object|null} Normalized listing or null if invalid
   */
  normalizeListing(raw) {
    if (!raw || typeof raw !== "object") return null;

    // Validate minimum required fields: title, company, valid URL
    const title = normalizeWhitespace(stripHtml(raw.title || ""));
    const company = normalizeWhitespace(stripHtml(raw.company || ""));
    const source = (raw.source || "Unknown").trim();
    const sourceUrl = raw.sourceListingUrl || raw.url || raw.applyUrl || "";

    if (!title || !company || !sourceUrl) {
      return null;
    }

    // Validate application and canonical URL
    const canonicalUrl = canonicalizeUrl(sourceUrl);
    if (!canonicalUrl || !isValidUrl(canonicalUrl)) {
      return null;
    }

    const directApplyUrl = raw.directApplyUrl && isValidUrl(raw.directApplyUrl)
      ? canonicalizeUrl(raw.directApplyUrl)
      : canonicalUrl;

    const externalId = raw.externalId ? String(raw.externalId).trim() : "";
    const cleanDesc = normalizeWhitespace(stripHtml(raw.description || ""));

    // Extract skills from structured fields, fallback to text extraction
    let requiredSkills = [];
    if (Array.isArray(raw.requiredSkills) && raw.requiredSkills.length > 0) {
      requiredSkills = normalizeSkillList(raw.requiredSkills);
    } else {
      requiredSkills = extractSkillsFromText(`${title} ${cleanDesc}`);
    }

    const preferredSkills = Array.isArray(raw.preferredSkills)
      ? normalizeSkillList(raw.preferredSkills)
      : [];

    // Parse location & work mode
    const locInfo = normalizeLocation(raw.location || "");

    // Parse posting date
    const postedDate = parseDate(raw.postedDate || raw.publication_date || raw.createdAt);

    // Compute deterministic internal ID: sha256(canonicalUrl)
    const id = "opp-" + crypto.createHash("sha256").update(canonicalUrl).digest("hex").slice(0, 16);
    const contentHash = crypto.createHash("md5").update(`${title}|${company}|${cleanDesc}`).digest("hex");

    // Completeness score calculation (0 to 100)
    let completeness = 0;
    if (title) completeness += 15;
    if (company) completeness += 15;
    if (cleanDesc.length > 100) completeness += 20;
    else if (cleanDesc.length > 20) completeness += 10;
    if (canonicalUrl) completeness += 15;
    if (requiredSkills.length > 0) completeness += 15;
    if (locInfo.city || locInfo.country) completeness += 10;
    if (raw.stipend || raw.salary) completeness += 5;
    if (postedDate) completeness += 5;

    const normalized = createNormalizedListing({
      id,
      source,
      sourceListingUrl: sourceUrl,
      canonicalUrl,
      directApplyUrl,
      externalId,
      title,
      company,
      companyWebsite: raw.companyWebsite || "",
      description: cleanDesc,
      responsibilities: Array.isArray(raw.responsibilities) ? raw.responsibilities : [],
      qualifications: Array.isArray(raw.qualifications) ? raw.qualifications : [],
      requiredSkills,
      preferredSkills,
      location: locInfo.location,
      city: locInfo.city,
      country: locInfo.country,
      workMode: locInfo.workMode,
      duration: raw.duration || "Duration not specified",
      startDate: raw.startDate || "Flexible / Not specified",
      deadline: raw.deadline || "Open until filled",
      postedDate,
      stipend: raw.stipend || raw.salary || "Unpaid / Not disclosed",
      status: raw.status || "active",
      lastCheckedAt: new Date().toISOString(),
      completenessScore: completeness,
      mergedSources: [source],
      contentHash,
      category: raw.category || this.inferCategory(title)
    });

    return normalized;
  }

  /**
   * Batch normalize listings and filter out nulls/malformed records.
   * @param {Object[]} rawListings
   * @returns {Object[]}
   */
  normalizeBatch(rawListings) {
    if (!Array.isArray(rawListings)) return [];
    const valid = [];
    for (const item of rawListings) {
      const normalized = this.normalizeListing(item);
      if (normalized) valid.push(normalized);
    }
    return valid;
  }

  /**
   * Infers role category from title.
   * @param {string} title
   * @returns {string}
   */
  inferCategory(title = "") {
    const t = title.toLowerCase();
    if (t.includes("front") || t.includes("react") || t.includes("ui") || t.includes("vue")) return "Frontend Development";
    if (t.includes("back") || t.includes("node") || t.includes("api") || t.includes("django") || t.includes("spring")) return "Backend Development";
    if (t.includes("full") || t.includes("stack") || t.includes("mern")) return "Full-Stack Engineering";
    if (t.includes("ai") || t.includes("machine learning") || t.includes("data") || t.includes("ml") || t.includes("nlp")) return "AI & Machine Learning";
    if (t.includes("mobile") || t.includes("android") || t.includes("ios") || t.includes("flutter")) return "Mobile App Development";
    if (t.includes("cloud") || t.includes("devops") || t.includes("infra") || t.includes("sre")) return "Cloud & DevOps";
    return "Software Engineering";
  }
}

module.exports = new NormalizationService();
