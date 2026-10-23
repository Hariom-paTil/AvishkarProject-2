/**
 * Lever Public Postings Adapter
 * Connects to public Lever postings endpoint for permitted partner tech teams.
 */

const BaseSourceAdapter = require("./baseAdapter");
const { SourceStatus } = require("../types/internshipTypes");
const { stripHtml } = require("../utils/textCleanup");

const DEFAULT_LEVER_COMPANIES = [
  { slug: "spotify", company: "Spotify", website: "https://spotify.com" },
  { slug: "palantir", company: "Palantir", website: "https://palantir.com" },
  { slug: "automattic", company: "Automattic", website: "https://automattic.com" },
  { slug: "atlassian", company: "Atlassian", website: "https://atlassian.com" },
  { slug: "postman", company: "Postman", website: "https://postman.com" },
  { slug: "sourcegraph", company: "Sourcegraph", website: "https://sourcegraph.com" }
];

class LeverAdapter extends BaseSourceAdapter {
  constructor(options = {}) {
    super("Lever", {
      ...options,
      enabled: process.env.LEVER_ENABLED !== "false"
    });
    this.companies = options.companies || DEFAULT_LEVER_COMPANIES;
  }

  isConfigured() {
    return this.enabled && this.companies.length > 0;
  }

  async search(query, options = {}) {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return this.buildResult({
        status: SourceStatus.NOT_CONFIGURED,
        durationMs: 0,
        errorMessage: "Lever adapter is disabled in environment settings."
      });
    }

    const { type = "internship", skills = [], goal = "" } = query;
    const isInternship = type !== "job";

    const searchTerms = [
      ...skills.map(s => s.toLowerCase()),
      ...goal.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    ];

    const matchedListings = [];
    let companyErrors = 0;

    const fetchPromises = this.companies.map(async (company) => {
      try {
        const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company.slug)}?mode=json`;
        const res = await this.safeFetch(url);

        if (!res.ok) {
          companyErrors++;
          return [];
        }

        const postings = await res.json();
        if (!Array.isArray(postings)) return [];

        const results = [];

        for (const post of postings) {
          const title = (post.text || "").trim();
          const titleLower = title.toLowerCase();
          const commitment = (post.categories?.commitment || "").toLowerCase();
          const location = post.categories?.location || "Remote / Various";
          const plainDesc = post.descriptionPlain || stripHtml(post.description || "");
          const descLower = plainDesc.toLowerCase();

          const isIntern = /intern|internship|co-op|coop|student|fellow/i.test(titleLower) ||
                           /intern|internship/i.test(commitment);

          if (isInternship && !isIntern) {
            continue;
          }

          let matchesTerm = searchTerms.length === 0;
          if (!matchesTerm) {
            matchesTerm = searchTerms.some(term => titleLower.includes(term) || descLower.includes(term));
          }

          if (matchesTerm) {
            results.push({
              source: "Lever",
              sourceListingUrl: post.hostedUrl || post.applyUrl,
              canonicalUrl: post.hostedUrl || post.applyUrl,
              directApplyUrl: post.applyUrl || post.hostedUrl,
              externalId: String(post.id),
              title,
              company: company.company,
              companyWebsite: company.website,
              location,
              description: plainDesc,
              postedDate: post.createdAt ? new Date(post.createdAt).toISOString() : null,
              raw: post
            });
          }
        }

        return results;
      } catch (err) {
        companyErrors++;
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
      const status = companyErrors === this.companies.length && this.companies.length > 0
        ? SourceStatus.ERROR
        : (companyErrors > 0 ? SourceStatus.PARTIAL : SourceStatus.SUCCESS);

      return this.buildResult({
        status,
        durationMs,
        listings: matchedListings,
        errorMessage: companyErrors > 0 ? `Lever experienced errors for ${companyErrors} companies.` : null
      });
    } catch (err) {
      return this.buildResult({
        status: SourceStatus.ERROR,
        durationMs: Date.now() - startTime,
        errorMessage: `Lever search error: ${err.message}`
      });
    }
  }
}

module.exports = LeverAdapter;
