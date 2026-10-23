/**
 * Greenhouse Public Job Boards Adapter
 * Connects directly to permitted public Greenhouse Boards API
 * without scraping or authentication barriers.
 */

const BaseSourceAdapter = require("./baseAdapter");
const { SourceStatus } = require("../types/internshipTypes");
const { stripHtml } = require("../utils/textCleanup");

const DEFAULT_GREENHOUSE_BOARDS = [
  { token: "cloudflare", company: "Cloudflare", website: "https://cloudflare.com" },
  { token: "github", company: "GitHub", website: "https://github.com" },
  { token: "stripe", company: "Stripe", website: "https://stripe.com" },
  { token: "datadog", company: "Datadog", website: "https://datadoghq.com" },
  { token: "reddit", company: "Reddit", website: "https://reddit.com" },
  { token: "figma", company: "Figma", website: "https://figma.com" },
  { token: "gitlab", company: "GitLab", website: "https://gitlab.com" },
  { token: "dropbox", company: "Dropbox", website: "https://dropbox.com" },
  { token: "twitch", company: "Twitch", website: "https://twitch.tv" }
];

class GreenhouseAdapter extends BaseSourceAdapter {
  constructor(options = {}) {
    super("Greenhouse", {
      ...options,
      enabled: process.env.GREENHOUSE_ENABLED !== "false"
    });
    this.boards = options.boards || DEFAULT_GREENHOUSE_BOARDS;
  }

  isConfigured() {
    return this.enabled && this.boards.length > 0;
  }

  async search(query, options = {}) {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return this.buildResult({
        status: SourceStatus.NOT_CONFIGURED,
        durationMs: 0,
        errorMessage: "Greenhouse adapter is disabled in environment settings."
      });
    }

    const { type = "internship", skills = [], goal = "" } = query;
    const isInternship = type !== "job";

    const searchTerms = [
      ...skills.map(s => s.toLowerCase()),
      ...goal.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    ];

    const matchedListings = [];
    let boardErrors = 0;

    // Concurrently fetch company job boards
    const fetchPromises = this.boards.map(async (board) => {
      try {
        const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}/jobs?content=true`;
        const res = await this.safeFetch(url);

        if (!res.ok) {
          boardErrors++;
          return [];
        }

        const data = await res.json();
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const results = [];

        for (const job of jobs) {
          const title = (job.title || "").trim();
          const titleLower = title.toLowerCase();
          const cleanDesc = stripHtml(job.content || "");
          const descLower = cleanDesc.toLowerCase();

          // Role type filter
          const isInternPosting = /intern|internship|co-op|coop|apprentice|fellow|student|university|graduate/i.test(titleLower);

          if (isInternship && !isInternPosting) {
            // If searching internships, skip non-intern listings
            continue;
          }

          // Term relevance filter
          let matchesTerm = searchTerms.length === 0;
          if (!matchesTerm) {
            matchesTerm = searchTerms.some(term => titleLower.includes(term) || descLower.includes(term));
          }

          if (matchesTerm) {
            results.push({
              source: "Greenhouse",
              sourceListingUrl: job.absolute_url,
              canonicalUrl: job.absolute_url,
              directApplyUrl: job.absolute_url,
              externalId: String(job.id),
              title,
              company: board.company,
              companyWebsite: board.website,
              location: job.location?.name || "Multiple Locations / Remote",
              description: cleanDesc,
              postedDate: job.updated_at || null,
              raw: job
            });
          }
        }

        return results;
      } catch (err) {
        boardErrors++;
        return [];
      }
    });

    try {
      const settled = await Promise.allSettled(fetchPromises);
      for (const res of settled) {
        if (res.status === "fulfilled" && Array.isArray(res.value)) {
          matchedListings.push(...res.value);
        }
      }

      const durationMs = Date.now() - startTime;
      const status = boardErrors === this.boards.length && this.boards.length > 0
        ? SourceStatus.ERROR
        : (boardErrors > 0 ? SourceStatus.PARTIAL : SourceStatus.SUCCESS);

      return this.buildResult({
        status,
        durationMs,
        listings: matchedListings,
        errorMessage: boardErrors > 0 ? `Greenhouse experienced errors on ${boardErrors} company boards.` : null
      });
    } catch (err) {
      return this.buildResult({
        status: SourceStatus.ERROR,
        durationMs: Date.now() - startTime,
        errorMessage: `Greenhouse search error: ${err.message}`
      });
    }
  }
}

module.exports = GreenhouseAdapter;
