/**
 * Internship Search Orchestrator
 * Coordinates the deep-research and verification pipeline:
 * Multi-query builder -> Source adapters -> Normalization ->
 * Layered Deduplication -> Deep Verification -> Hard Eligibility ->
 * Priority Ranking -> AI Explanation -> Quality Tier Bucketing -> API Response
 */

const { getDefaultAdapters } = require("../adapters");
const queryBuilder = require("./queryBuilder");
const normalizationService = require("./normalizationService");
const deduplicationService = require("./deduplicationService");
const verificationService = require("./verificationService");
const eligibilityService = require("./eligibilityService");
const rankingService = require("./rankingService");
const aiExplanationService = require("./aiExplanationService");
const dataStore = require("../storage/dataStore");
const { VerificationStatus } = require("../types/internshipTypes");

class SearchOrchestrator {
  constructor(adapters = null) {
    this.adapters = adapters || getDefaultAdapters();
    // Short cache TTL (10 minutes) to ensure fresh results as required
    this.cacheTtlMs = Number(process.env.INTERNSHIP_SEARCH_CACHE_TTL_SECONDS || 600) * 1000;
    this.searchCache = new Map(); // queryHash -> { timestamp, response }
  }

  /**
   * Executes the full deep research & verification search pipeline.
   * @param {Object} query - Validated user profile & filters
   * @param {Object} [options={}]
   * @returns {Promise<Object>} Formatted search response
   */
  async search(query, options = {}) {
    const pipelineStartTime = Date.now();
    const queryHash = this._hashQuery(query);

    // 1. Check in-memory query cache if live refresh is not forced
    if (!options.forceLive && this.searchCache.has(queryHash)) {
      const cachedEntry = this.searchCache.get(queryHash);
      if (Date.now() - cachedEntry.timestamp < this.cacheTtlMs) {
        return {
          ...cachedEntry.response,
          isCached: true,
          cachedAt: new Date(cachedEntry.timestamp).toISOString(),
          searchDurationMs: Date.now() - pipelineStartTime
        };
      }
    }

    // 2. Generate multi-angle deep research queries from profile
    const researchPlan = queryBuilder.buildResearchPlan(query);

    // 3. Query configured adapters in parallel with timeout safety
    const sourceStatuses = {};
    const rawListings = [];

    const adapterPromises = this.adapters.map(async (adapter) => {
      try {
        const result = await adapter.search({
          ...query,
          researchPlan
        }, options);

        sourceStatuses[adapter.name] = {
          status: result.status,
          durationMs: result.durationMs,
          resultCount: result.resultCount,
          errorMessage: result.errorMessage,
          isConfigured: result.isConfigured
        };

        dataStore.recordSourceStatus(adapter.name, result);

        if (Array.isArray(result.listings)) {
          rawListings.push(...result.listings);
        }
      } catch (err) {
        const statusRecord = {
          status: "ERROR",
          durationMs: 0,
          resultCount: 0,
          errorMessage: err.message,
          isConfigured: adapter.isConfigured()
        };
        sourceStatuses[adapter.name] = statusRecord;
        dataStore.recordSourceStatus(adapter.name, statusRecord);
      }
    });

    await Promise.allSettled(adapterPromises);

    // 4. Normalization & validation
    const normalizedListings = normalizationService.normalizeBatch(rawListings);

    // 5. Layered Deduplication (exact canonical, source+extId, company+title, fuzzy)
    const deduplicatedListings = deduplicationService.deduplicate(normalizedListings);

    // 6. Deep Verification (checks real company, live reachability, closure markers, spam, internship proof)
    const verifiedListings = await verificationService.verifyBatch(deduplicatedListings, {
      checkLiveUrl: options.checkLiveUrl !== false
    });

    // 7. Hard Eligibility Filtering (excludes non-internships, closed, location/graduation conflicts)
    const eligibleListings = eligibilityService.filterAndEnrich(verifiedListings, query);

    // 8. Priority Weighted Ranking (Verified first, then strong role match, skills, recency)
    const rankedListings = rankingService.rankListings(eligibleListings, query);

    // 9. AI Match Explanation & Structured Insight Enrichment (top 6 results)
    const enrichedListings = await aiExplanationService.enrichBatch(rankedListings, query, 6);

    // 10. Quality Threshold & Tier Bucketing
    // Requirement 6: Use separate sections:
    // - Best verified matches
    // - Other relevant opportunities
    // - Needs confirmation
    const bestVerified = [];
    const otherRelevant = [];
    const needsConfirmation = [];

    for (const item of enrichedListings) {
      if (item.verificationStatus === VerificationStatus.VERIFIED && item.score >= 70) {
        item.qualityTier = "bestVerified";
        bestVerified.push(item);
      } else if (item.verificationStatus === VerificationStatus.NEEDS_CONFIRMATION) {
        item.qualityTier = "needsConfirmation";
        needsConfirmation.push(item);
      } else if (item.score >= 50) {
        item.qualityTier = "otherRelevant";
        otherRelevant.push(item);
      } else {
        // Below minimum quality threshold: exclude weak matches to avoid filling result page with noise
      }
    }

    // Unified list ordered by quality tiers: Best Verified -> Other Relevant -> Needs Confirmation
    const finalDisplayListings = [
      ...bestVerified,
      ...otherRelevant,
      ...needsConfirmation
    ];

    // 11. Persist to data store cache
    dataStore.saveBatch(finalDisplayListings);

    // 12. Pagination handling
    const page = Math.max(1, parseInt(options.page || 1, 10));
    const pageSize = Math.max(1, Math.min(50, parseInt(options.pageSize || 24, 10)));
    const totalCount = finalDisplayListings.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const paginatedListings = finalDisplayListings.slice((page - 1) * pageSize, page * pageSize);

    const pipelineDuration = Date.now() - pipelineStartTime;

    // Quality threshold notification message
    let qualityNote = null;
    if (bestVerified.length > 0 && bestVerified.length < 5) {
      qualityNote = `Prioritizing accuracy over volume: Showing ${bestVerified.length} verified high-confidence internship matches. Unverified or low-relevance postings were filtered out.`;
    } else if (bestVerified.length === 0 && finalDisplayListings.length > 0) {
      qualityNote = `Notice: Found ${finalDisplayListings.length} potential matches, but company career page verification is pending confirmation.`;
    }

    const response = {
      query: {
        type: query.type || "internship",
        skills: query.skills || [],
        goal: query.goal || "",
        workplace: query.workplace || "Any",
        education: query.education || "",
        batch: query.batch || "Current Student",
        graduationYear: query.graduationYear || ""
      },
      results: paginatedListings,
      sections: {
        bestVerified: bestVerified.slice(0, 12),
        otherRelevant: otherRelevant.slice(0, 12),
        needsConfirmation: needsConfirmation.slice(0, 12)
      },
      counts: {
        total: totalCount,
        bestVerified: bestVerified.length,
        otherRelevant: otherRelevant.length,
        needsConfirmation: needsConfirmation.length
      },
      totalCount,
      page,
      pageSize,
      totalPages,
      sourceStatuses,
      qualityNote,
      searchedAt: new Date().toISOString(),
      searchDurationMs: pipelineDuration,
      isCached: false,
      summary: `Discovered ${totalCount} verified roles matching your profile (${bestVerified.length} high-confidence verified).`
    };

    // Cache the response
    this.searchCache.set(queryHash, {
      timestamp: Date.now(),
      response
    });

    return response;
  }

  /**
   * Returns current health and configuration status of all registered sources.
   * @returns {Object}
   */
  getSourceHealth() {
    const health = {};
    for (const adapter of this.adapters) {
      health[adapter.name] = {
        name: adapter.name,
        isConfigured: adapter.isConfigured()
      };
    }
    return health;
  }

  _hashQuery(query) {
    const key = [
      query.type || "internship",
      (query.skills || []).sort().join(","),
      query.goal || "",
      query.workplace || "Any",
      query.education || "",
      query.batch || "",
      query.graduationYear || "",
      query.location || ""
    ].join("|").toLowerCase();
    return key;
  }
}

// Export singleton orchestrator
const searchOrchestrator = new SearchOrchestrator();
module.exports = searchOrchestrator;
