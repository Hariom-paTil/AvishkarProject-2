/**
 * Ashby Public Job Boards Adapter
 * Connects to Ashby posting API for permitted organizations.
 */

const BaseSourceAdapter = require("./baseAdapter");
const { SourceStatus } = require("../types/internshipTypes");

const DEFAULT_ASHBY_ORGS = [
  { org: "ramp", company: "Ramp", website: "https://ramp.com" },
  { org: "retool", company: "Retool", website: "https://retool.com" },
  { org: "linear", company: "Linear", website: "https://linear.app" },
  { org: "sentry", company: "Sentry", website: "https://sentry.io" },
  { org: "openai", company: "OpenAI", website: "https://openai.com" }
];

class AshbyAdapter extends BaseSourceAdapter {
  constructor(options = {}) {
    super("Ashby", {
      ...options,
      enabled: process.env.ASHBY_ENABLED !== "false"
    });
    this.organizations = options.organizations || DEFAULT_ASHBY_ORGS;
  }

  isConfigured() {
    return this.enabled && this.organizations.length > 0;
  }

  async search(query, options = {}) {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return this.buildResult({
        status: SourceStatus.NOT_CONFIGURED,
        durationMs: 0,
        errorMessage: "Ashby adapter is disabled in environment settings."
      });
    }

    const { type = "internship", skills = [], goal = "" } = query;
    const isInternship = type !== "job";

    const searchTerms = [
      ...skills.map(s => s.toLowerCase()),
      ...goal.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    ];

    const matchedListings = [];
    let orgErrors = 0;

    const fetchPromises = this.organizations.map(async (org) => {
      try {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org.org)}`;
        const res = await this.safeFetch(url);

        if (!res.ok) {
          orgErrors++;
          return [];
        }

        const data = await res.json();
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const results = [];

        for (const job of jobs) {
          const title = (job.title || "").trim();
          const titleLower = title.toLowerCase();
          const empType = (job.employmentType || "").toLowerCase();
          const location = job.location || "Remote / Office";

          const isIntern = /intern|internship|co-op|coop|student/i.test(titleLower) ||
                           /intern/i.test(empType);

          if (isInternship && !isIntern) {
            continue;
          }

          let matchesTerm = searchTerms.length === 0;
          if (!matchesTerm) {
            matchesTerm = searchTerms.some(term => titleLower.includes(term));
          }

          if (matchesTerm) {
            results.push({
              source: "Ashby",
              sourceListingUrl: job.jobUrl,
              canonicalUrl: job.jobUrl,
              directApplyUrl: job.jobUrl,
              externalId: String(job.id),
              title,
              company: org.company,
              companyWebsite: org.website,
              location,
              description: `${title} at ${org.company}. Department: ${job.department || "Engineering"}.`,
              postedDate: job.publishedAt || null,
              raw: job
            });
          }
        }

        return results;
      } catch (err) {
        orgErrors++;
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
      const status = orgErrors === this.organizations.length && this.organizations.length > 0
        ? SourceStatus.ERROR
        : (orgErrors > 0 ? SourceStatus.PARTIAL : SourceStatus.SUCCESS);

      return this.buildResult({
        status,
        durationMs,
        listings: matchedListings,
        errorMessage: orgErrors > 0 ? `Ashby experienced errors for ${orgErrors} organizations.` : null
      });
    } catch (err) {
      return this.buildResult({
        status: SourceStatus.ERROR,
        durationMs: Date.now() - startTime,
        errorMessage: `Ashby search error: ${err.message}`
      });
    }
  }
}

module.exports = AshbyAdapter;
