/**
 * Internshala Approved Partner API Adapter
 * Requires official partner credentials.
 * Unofficial HTML scraping, automated browsing, and anti-bot bypass are strictly disallowed.
 */

const BaseSourceAdapter = require("./baseAdapter");
const { SourceStatus } = require("../types/internshipTypes");

class InternshalaAdapter extends BaseSourceAdapter {
  constructor(options = {}) {
    super("Internshala", options);
    this.apiKey = process.env.INTERNSHALA_API_KEY || "";
    this.approvedEnabled = process.env.INTERNSHALA_APPROVED_API_ENABLED === "true";
  }

  isConfigured() {
    return this.approvedEnabled && Boolean(this.apiKey);
  }

  async search(query, options = {}) {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return this.buildResult({
        status: SourceStatus.NOT_CONFIGURED,
        durationMs: 0,
        listings: [],
        errorMessage: "Requires approved API access (Internshala Partner API). Unofficial scraping is strictly disabled."
      });
    }

    try {
      const endpoint = `https://internshala.com/api/v1/internships?category=${encodeURIComponent(query.skills[0] || "tech")}`;
      const res = await this.safeFetch(endpoint, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        }
      });

      if (!res.ok) {
        return this.buildResult({
          status: SourceStatus.ERROR,
          durationMs: Date.now() - startTime,
          errorMessage: `Internshala Partner API error: HTTP ${res.status}`
        });
      }

      const data = await res.json();
      const items = Array.isArray(data.internships) ? data.internships : [];

      const listings = items.map(item => ({
        source: "Internshala",
        sourceListingUrl: item.url,
        canonicalUrl: item.url,
        directApplyUrl: item.apply_url || item.url,
        externalId: String(item.id),
        title: item.title,
        company: item.company_name,
        location: item.location || "Work from Home",
        stipend: item.stipend || "",
        duration: item.duration || "",
        description: item.description || "",
        postedDate: item.posted_on || null,
        raw: item
      }));

      return this.buildResult({
        status: SourceStatus.SUCCESS,
        durationMs: Date.now() - startTime,
        listings
      });
    } catch (err) {
      return this.buildResult({
        status: SourceStatus.ERROR,
        durationMs: Date.now() - startTime,
        errorMessage: `Internshala API error: ${err.message}`
      });
    }
  }
}

module.exports = InternshalaAdapter;
