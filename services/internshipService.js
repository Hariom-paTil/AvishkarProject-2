/**
 * InternshipService
 * High-reliability adapter and pipeline gateway connecting the application
 * to the modular deep-research and verification search orchestrator.
 */

const searchOrchestrator = require("../internships/services/searchOrchestrator");
const dataStore = require("../internships/storage/dataStore");
const { formatDisplayDate } = require("../internships/utils/dateParser");

class InternshipService {
  /**
   * Search for opportunities across all configured permitted sources.
   * @param {Object} input - Validated input from validateInternshipRequest
   * @returns {Promise<Object>} Aggregated opportunity recommendations
   */
  async searchOpportunities(input) {
    const {
      type = "internship",
      education = "",
      skills = [],
      goal = "",
      workplace = "Any",
      batch = "Current Student",
      graduationYear = "",
      location = "",
      workAuthorization = "",
      page = 1,
      pageSize = 24,
      forceLive = false
    } = input;

    const query = {
      type,
      education,
      skills,
      goal,
      workplace,
      batch,
      graduationYear,
      location,
      workAuthorization
    };

    // Execute full deep-research pipeline through the search orchestrator
    const searchResult = await searchOrchestrator.search(query, {
      page,
      pageSize,
      forceLive
    });

    const formatItem = (opp, idx) => {
      const searchUrls = this.generateSearchUrls(opp.title, opp.location || workplace, type);
      const displayDate = formatDisplayDate(opp.postedDate);

      return {
        id: opp.id || `opp-${idx + 1}`,
        title: opp.title,
        company: opp.company,
        companyWebsite: opp.companyWebsite || "",
        source: opp.source,
        platformBadge: opp.source,
        location: opp.location,
        city: opp.city || "",
        country: opp.country || "",
        workMode: opp.workMode,
        stipend: opp.stipend || "Unpaid / Not disclosed",
        duration: opp.duration || "Duration not specified",
        startDate: opp.startDate || "Flexible / Not specified",
        deadline: opp.deadline || "Open until filled",
        applyUrl: opp.directApplyUrl || opp.canonicalUrl || opp.sourceListingUrl,
        canonicalUrl: opp.canonicalUrl,
        type: type === "job" ? "Full-Time Job" : "Internship",
        category: opp.category,
        workplacePreference: workplace,
        matchPercentage: opp.score || 85,
        relevanceScore: Number(((opp.score || 85) / 10).toFixed(1)),
        scoreBreakdown: opp.scoreBreakdown,
        relevanceExplanation: opp.matchExplanation || opp.whyItMatches || "Strong alignment with candidate background.",
        whyItMatches: opp.whyItMatches || opp.matchExplanation,
        matchingSkills: opp.matchingSkills || [],
        missingSkills: opp.missingSkills || [],
        uncertainties: opp.uncertainties || [],
        postedDate: opp.postedDate,
        postedDateDisplay: displayDate,
        completenessScore: opp.completenessScore,
        mergedSources: opp.mergedSources || [opp.source],
        confidence: (opp.score || 85) >= 80 ? "High" : "Medium",

        // Verification metadata
        verificationStatus: opp.verificationStatus || "Recently discovered",
        isVerified: Boolean(opp.isVerified),
        verificationDetails: opp.verificationDetails || [],
        verifiedAt: opp.verifiedAt || null,
        qualityTier: opp.qualityTier || "otherRelevant",

        searchKeywords: opp.title,
        searchUrls
      };
    };

    // Format unified list and specific quality tier sections
    const formattedOpportunities = (searchResult.results || []).map(formatItem);

    const sections = {
      bestVerified: (searchResult.sections?.bestVerified || []).map(formatItem),
      otherRelevant: (searchResult.sections?.otherRelevant || []).map(formatItem),
      needsConfirmation: (searchResult.sections?.needsConfirmation || []).map(formatItem)
    };

    return {
      type,
      profile: { education, skills, goal, workplace, batch, graduationYear, location },
      searchSummary: searchResult.summary || `Found ${searchResult.totalCount} verified roles.`,
      qualityNote: searchResult.qualityNote || null,
      opportunitiesCount: searchResult.totalCount,
      totalCount: searchResult.totalCount,
      counts: searchResult.counts || {
        total: searchResult.totalCount,
        bestVerified: sections.bestVerified.length,
        otherRelevant: sections.otherRelevant.length,
        needsConfirmation: sections.needsConfirmation.length
      },
      page: searchResult.page,
      pageSize: searchResult.pageSize,
      totalPages: searchResult.totalPages,
      opportunities: formattedOpportunities,
      sections,
      sourceStatuses: searchResult.sourceStatuses,
      searchedAt: searchResult.searchedAt,
      searchDurationMs: searchResult.searchDurationMs,
      isCached: Boolean(searchResult.isCached),
      cachedAt: searchResult.cachedAt || null
    };
  }

  /**
   * Returns current health and configuration state of all sources.
   * @returns {Object}
   */
  getSourceStatuses() {
    return dataStore.getSourceStatuses();
  }

  /**
   * Retrieve a specific listing by ID from persistent store.
   * @param {string} id
   * @returns {Object|null}
   */
  getListingById(id) {
    return dataStore.getListing(id);
  }

  /**
   * Bookmark or unbookmark an internship for a user.
   * @param {string} userEmail
   * @param {string} listingId
   * @returns {{ saved: boolean }}
   */
  toggleSaveInternship(userEmail, listingId) {
    return dataStore.toggleSavedInternship(userEmail, listingId);
  }

  /**
   * Get all saved internships for a user.
   * @param {string} userEmail
   * @returns {Object[]}
   */
  getSavedInternships(userEmail) {
    return dataStore.getSavedInternships(userEmail);
  }

  /**
   * Generate verified research platform URLs for user cross-referencing.
   * @param {string} query
   * @param {string} workplace
   * @param {string} type - "internship" or "job"
   * @returns {Object} Map of platform names to search URLs
   */
  generateSearchUrls(query, workplace = "Any", type = "internship") {
    const term = `${query} ${type === "internship" ? "internship" : ""}`.trim();
    const encodedTerm = encodeURIComponent(term);
    const location = workplace === "Remote" ? "Remote" : "India";
    const encodedLoc = encodeURIComponent(location);
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return {
      linkedIn: `https://www.linkedin.com/jobs/search/?keywords=${encodedTerm}&location=${encodedLoc}${type === "internship" ? "&f_JT=I" : ""}`,
      internshala: `https://internshala.com/internships/${slug}-internship/`,
      indeed: `https://www.indeed.com/jobs?q=${encodedTerm}&l=${encodedLoc}`,
      unstop: `https://unstop.com/internships?keyword=${encodedTerm}`,
      glassdoor: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodedTerm}`,
      remotive: `https://remotive.com/remote-jobs?search=${encodeURIComponent(query)}`,
      googleJobs: `https://www.google.com/search?q=${encodedTerm}+internships`
    };
  }
}

module.exports = new InternshipService();
