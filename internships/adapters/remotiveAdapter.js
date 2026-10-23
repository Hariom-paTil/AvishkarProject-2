/**
 * Remotive Public Remote Jobs Adapter
 * Connects to Remotive API for remote developer roles and internships.
 */

const BaseSourceAdapter = require("./baseAdapter");
const { SourceStatus } = require("../types/internshipTypes");
const { stripHtml } = require("../utils/textCleanup");

class RemotiveAdapter extends BaseSourceAdapter {
  constructor(options = {}) {
    super("Remotive", {
      ...options,
      enabled: process.env.REMOTIVE_ENABLED !== "false"
    });
  }

  async search(query, options = {}) {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return this.buildResult({
        status: SourceStatus.NOT_CONFIGURED,
        durationMs: 0,
        errorMessage: "Remotive adapter is disabled."
      });
    }

    const { type = "internship", skills = [], goal = "" } = query;
    const isInternship = type !== "job";

    const topSkill = skills[0] || (goal ? goal.split(" ")[0] : "Software");
    const endpoint = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(topSkill)}&limit=25`;

    try {
      const res = await this.safeFetch(endpoint);
      if (!res.ok) {
        return this.buildResult({
          status: SourceStatus.ERROR,
          durationMs: Date.now() - startTime,
          errorMessage: `Remotive API returned HTTP ${res.status}`
        });
      }

      const data = await res.json();
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      const listings = [];

      for (const job of jobs) {
        const title = (job.title || "").trim();
        const titleLower = title.toLowerCase();
        const plainDesc = stripHtml(job.description || "");

        // If searching internship, favor intern/junior keywords
        const isIntern = /intern|internship|entry|junior|apprentice|trainee|associate/i.test(titleLower) ||
                         /intern|entry.level/i.test(job.job_type || "");

        // If user explicitly asks for internship, only include matching roles
        if (isInternship && !isIntern) {
          continue;
        }

        listings.push({
          source: "Remotive",
          sourceListingUrl: job.url,
          canonicalUrl: job.url,
          directApplyUrl: job.url,
          externalId: String(job.id),
          title,
          company: job.company_name || "Remote Tech Team",
          companyWebsite: job.company_logo || "",
          location: job.candidate_required_location || "Worldwide Remote",
          stipend: job.salary || "",
          description: plainDesc,
          postedDate: job.publication_date || null,
          category: job.category || "Software Development",
          raw: job
        });
      }

      return this.buildResult({
        status: SourceStatus.SUCCESS,
        durationMs: Date.now() - startTime,
        listings
      });
    } catch (err) {
      return this.buildResult({
        status: err.name === "TimeoutError" || err.name === "AbortError" ? SourceStatus.TIMEOUT : SourceStatus.ERROR,
        durationMs: Date.now() - startTime,
        errorMessage: `Remotive fetch error: ${err.message}`
      });
    }
  }
}

module.exports = RemotiveAdapter;
