/**
 * Internship Search Orchestrator
 * Coordinates the full search pipeline:
 * Query builder -> Source adapters -> Validation -> Normalization ->
 * Deduplication -> Eligibility filtering -> Scoring & Ranking -> AI Explanation -> API Response
 */

const { getDefaultAdapters } = require("../adapters");
const normalizationService = require("./normalizationService");
const deduplicationService = require("./deduplicationService");
const eligibilityService = require("./eligibilityService");
const rankingService = require("./rankingService");
const aiExplanationService = require("./aiExplanationService");
const dataStore = require("../storage/dataStore");

class SearchOrchestrator {
  constructor(adapters = null) {
    this.adapters = adapters || getDefaultAdapters();
    this.cacheTtlMs = Number(process.env.INTERNSHIP_SEARCH_CACHE_TTL_SECONDS || 1800) * 1000;
    this.searchCache = new Map(); // queryHash -> { timestamp, response }
  }

  /**
   * Executes the full internship search pipeline.
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

    // 2. Query configured adapters in parallel with timeout safety
    const sourceStatuses = {};
    const rawListings = [];

    const adapterPromises = this.adapters.map(async (adapter) => {
      try {
        const result = await adapter.search(query, options);
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

    // 3. Normalization & validation
    const normalizedListings = normalizationService.normalizeBatch(rawListings);

    // 4. Layered Deduplication
    const deduplicatedListings = deduplicationService.deduplicate(normalizedListings);

    // 5. Hard Eligibility Filtering
    const eligibleListings = eligibilityService.filterAndEnrich(deduplicatedListings, query);

    // 6. Transparent Multi-Factor Weighted Scoring and Ranking
    const rankedListings = rankingService.rankListings(eligibleListings, query);

    // 7. AI Match Explanation & Structured Insight Enrichment (top 6 results)
    const enrichedListings = await aiExplanationService.enrichBatch(rankedListings, query, 6);

    // 8. Persist to data store cache
    dataStore.saveBatch(enrichedListings);

    // 9. Pagination handling
    const page = Math.max(1, parseInt(options.page || 1, 10));
    const pageSize = Math.max(1, Math.min(50, parseInt(options.pageSize || 24, 10)));
    const totalCount = enrichedListings.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const paginatedListings = enrichedListings.slice((page - 1) * pageSize, page * pageSize);

    const pipelineDuration = Date.now() - pipelineStartTime;

    const response = {
      query: {
        type: query.type || "internship",
        skills: query.skills || [],
        goal: query.goal || "",
        workplace: query.workplace || "Any",
        education: query.education || "",
        batch: query.batch || "Current Student"
      },
      results: paginatedListings,
      totalCount,
      page,
      pageSize,
      totalPages,
      sourceStatuses,
      searchedAt: new Date().toISOString(),
      searchDurationMs: pipelineDuration,
      isCached: false,
      summary: `Discovered ${totalCount} verified roles matching your profile.`
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
      query.batch || ""
    ].join("|").toLowerCase();
    return key;
  }
}

// Export singleton orchestrator
const searchOrchestrator = new SearchOrchestrator();
module.exports = searchOrchestrator;
