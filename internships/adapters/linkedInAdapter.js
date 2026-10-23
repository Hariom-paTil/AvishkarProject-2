/**
 * LinkedIn Official Partner Adapter
 * Strictly requires approved API credentials (OAuth / Official Jobs Partner API).
 * Scraping, CAPTCHA bypass, and guest HTML parsing are completely disallowed.
 */

const BaseSourceAdapter = require("./baseAdapter");
const { SourceStatus } = require("../types/internshipTypes");

class LinkedInAdapter extends BaseSourceAdapter {
  constructor(options = {}) {
    super("LinkedIn", options);
    this.apiKey = process.env.LINKEDIN_API_KEY || "";
    this.apiSecret = process.env.LINKEDIN_API_SECRET || "";
    this.approvedEnabled = process.env.LINKEDIN_APPROVED_API_ENABLED === "true";
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
        errorMessage: "Requires approved API access (LinkedIn Official Partner API). Unofficial scraping is strictly disabled."
      });
    }

    try {
      // When official API credentials are configured, execute authenticated request
      const endpoint = `https://api.linkedin.com/v2/jobPostings?keywords=${encodeURIComponent(query.skills.join(" "))}`;
      const res = await this.safeFetch(endpoint, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "X-Restli-Protocol-Version": "2.0.0"
        }
      });

      if (!res.ok) {
        return this.buildResult({
          status: SourceStatus.ERROR,
          durationMs: Date.now() - startTime,
          errorMessage: `LinkedIn Partner API error: HTTP ${res.status}`
        });
      }

      const data = await res.json();
      const elements = Array.isArray(data.elements) ? data.elements : [];

      const listings = elements.map(item => ({
        source: "LinkedIn",
        sourceListingUrl: item.listingUrl || `https://www.linkedin.com/jobs/view/${item.id}`,
        canonicalUrl: item.listingUrl || `https://www.linkedin.com/jobs/view/${item.id}`,
        directApplyUrl: item.applyUrl || item.listingUrl,
        externalId: String(item.id),
        title: item.title,
        company: item.companyDetails?.name || "Hiring Company",
        location: item.formattedLocation || "India / Remote",
        description: item.description?.text || "",
        postedDate: item.listedAt ? new Date(item.listedAt).toISOString() : null,
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
        errorMessage: `LinkedIn API request error: ${err.message}`
      });
    }
  }
}

module.exports = LinkedInAdapter;
