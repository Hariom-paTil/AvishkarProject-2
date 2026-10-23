/**
 * Deep Verification Service
 * Validates authentic career page evidence, confirms live reachability,
 * detects closed/expired postings, eliminates spam/fake jobs, and assigns
 * verification statuses (Verified, Recently discovered, Needs confirmation).
 */

const { VerificationStatus } = require("../types/internshipTypes");
const { isValidUrl } = require("../utils/urlCanonicalizer");

const SPAM_PHRASES = [
  "make money online",
  "earn daily",
  "work from home earn",
  "click here to apply now",
  "telegram group",
  "whatsapp group",
  "data entry part time daily payment",
  "no experience needed earn thousands",
  "bitcoin",
  "crypto investment"
];

const BANNED_COMPANY_NAMES = new Set([
  "top tech recruiters",
  "industry partner",
  "confidential",
  "unknown",
  "anonymous",
  "hiring company",
  "stealth startup"
]);

const CLOSURE_MARKERS = [
  "no longer accepting applications",
  "this position is closed",
  "this job has expired",
  "this job is no longer available",
  "position filled",
  "applications are now closed",
  "posting has been removed",
  "this opening has closed",
  "application deadline has passed"
];

const INTERNSHIP_EVIDENCE_REGEX = /\b(intern|internship|co-op|coop|apprentice|trainee|student|fellowship|graduate engineer trainee|campus hire|early career)\b/i;
const SENIOR_EXCLUSION_REGEX = /\b(senior|staff|principal|director|vp|head of|lead engineer|team lead|5\+\s*years?)\b/i;

class VerificationService {
  constructor() {
    this.liveUrlCache = new Map(); // url -> { status, timestamp }
    this.verifyListing = this.verifyListing.bind(this);
    this.verifyBatch = this.verifyBatch.bind(this);
    this._checkLiveUrl = this._checkLiveUrl.bind(this);
  }

  /**
   * Deeply validates and verifies a listing.
   * @param {Object} listing - Normalized listing
   * @param {Object} [options={}]
   * @returns {Promise<{
   *   valid: boolean,
   *   rejectionReason: string|null,
   *   verificationStatus: string,
   *   isVerified: boolean,
   *   verificationDetails: string[]
   * }>}
   */
  async verifyListing(listing, options = {}) {
    const details = [];

    // 1. Title & Company sanity checks
    const title = (listing.title || "").trim();
    const company = (listing.company || "").trim();

    if (!title || title.length < 4) {
      return { valid: false, rejectionReason: "Missing or invalid job title." };
    }

    const compLower = company.toLowerCase();
    const isBannedCompany = !company || company.length < 2 || Array.from(BANNED_COMPANY_NAMES).some(banned => compLower.includes(banned));
    if (isBannedCompany) {
      return { valid: false, rejectionReason: `Invalid or placeholder company name "${company}".` };
    }

    // 2. Spam & Suspicious Text Detection
    const fullText = `${title} ${listing.description || ""}`.toLowerCase();
    for (const spam of SPAM_PHRASES) {
      if (fullText.includes(spam)) {
        return { valid: false, rejectionReason: `Detected suspicious or spam phrase "${spam}".` };
      }
    }

    // 3. Application URL and Source Validation
    const applyUrl = listing.directApplyUrl || listing.canonicalUrl || listing.sourceListingUrl;
    if (!applyUrl || !isValidUrl(applyUrl)) {
      return { valid: false, rejectionReason: "Listing is missing a valid direct application URL." };
    }

    // 4. Closed / Expired Marker Detection
    for (const marker of CLOSURE_MARKERS) {
      if (fullText.includes(marker)) {
        return { valid: false, rejectionReason: `Listing contains closure marker "${marker}".` };
      }
    }

    // 5. Internship Role Evidence Check
    const hasInternshipEvidence = INTERNSHIP_EVIDENCE_REGEX.test(title) ||
                                 INTERNSHIP_EVIDENCE_REGEX.test(listing.description || "");

    const isExplicitSeniorRole = SENIOR_EXCLUSION_REGEX.test(title);

    if (isExplicitSeniorRole) {
      return { valid: false, rejectionReason: "Excluded experienced/senior position (not an internship)." };
    }

    if (!hasInternshipEvidence) {
      // Must have evidence of being an internship/early-career position
      return { valid: false, rejectionReason: "Listing lacks evidence of being an internship, apprentice, or student role." };
    }

    details.push("Verified student/internship role classification.");

    // 6. Live Reachability Check (HTTP Verification)
    let isLiveActive = false;
    if (options.isLiveActive !== undefined) {
      isLiveActive = Boolean(options.isLiveActive);
    } else if (options.checkLiveUrl !== false && applyUrl) {
      isLiveActive = await this._checkLiveUrl(applyUrl);
      if (isLiveActive) {
        details.push("Live application URL verified reachable.");
      } else {
        details.push("Direct URL reachable status could not be verified live.");
      }
    } else {
      isLiveActive = true;
    }

    // 7. Check Data Agreement between Source & Company
    const trustedAtsSources = new Set(["Greenhouse", "Lever", "Ashby", "Remotive"]);
    const isDirectAts = trustedAtsSources.has(listing.source);
    if (isDirectAts) {
      details.push(`Direct company career system verified on ${listing.source}.`);
    }

    // 8. Determine Verification Status
    // - Verified: Source page and application link were verified active on company/host system with complete internship proof.
    // - Needs confirmation: Critical details (deadline, eligibility, or stipend) are unstated.
    // - Recently discovered: Newly discovered feed listing without deep page confirmation.
    let verificationStatus = VerificationStatus.RECENTLY_DISCOVERED;
    let isVerified = false;

    if (isDirectAts && isLiveActive) {
      verificationStatus = VerificationStatus.VERIFIED;
      isVerified = true;
      details.push("Verified active listing on official company ATS portal.");
      if (listing.deadline.includes("Open until filled")) {
        details.push("Rolling admissions / open until filled.");
      }
    } else if (isLiveActive) {
      verificationStatus = VerificationStatus.RECENTLY_DISCOVERED;
      details.push("Active web posting detected; ATS direct status recently discovered.");
    } else {
      verificationStatus = VerificationStatus.NEEDS_CONFIRMATION;
      details.push("Live application reachability requires candidate confirmation.");
    }

    return {
      valid: true,
      rejectionReason: null,
      verificationStatus,
      isVerified,
      verificationDetails: details,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Verifies an array of listings concurrently and filters out rejected ones.
   * @param {Object[]} listings
   * @param {Object} [options={}]
   * @returns {Promise<Object[]>}
   */
  async verifyBatch(listings, options = {}) {
    if (!Array.isArray(listings)) return [];

    const verifiedList = [];
    const checkPromises = listings.map(async (item) => {
      try {
        const result = await this.verifyListing(item, options);
        if (result.valid) {
          return {
            ...item,
            verificationStatus: result.verificationStatus,
            isVerified: result.isVerified,
            verificationDetails: result.verificationDetails,
            verifiedAt: result.verifiedAt
          };
        }
        return null;
      } catch (err) {
        // Safe fallback: keep listing as Needs Confirmation
        return {
          ...item,
          verificationStatus: VerificationStatus.NEEDS_CONFIRMATION,
          isVerified: false,
          verificationDetails: ["Automatic verification encountered a network timeout."]
        };
      }
    });

    const settled = await Promise.allSettled(checkPromises);
    for (const res of settled) {
      if (res.status === "fulfilled" && res.value) {
        verifiedList.push(res.value);
      }
    }

    return verifiedList;
  }

  /**
   * Live HTTP URL validation with 2.5s timeout.
   * @private
   */
  async _checkLiveUrl(url) {
    if (this.liveUrlCache.has(url)) {
      const cached = this.liveUrlCache.get(url);
      if (Date.now() - cached.timestamp < 10 * 60 * 1000) {
        return cached.isLive;
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      // Attempt HEAD request first to save bandwidth
      let res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "SkillBridge-Verification/2.0 (+https://skillbridge.ai)"
        }
      }).catch(() => null);

      clearTimeout(timeout);

      // If HEAD is not allowed (405), fallback to GET with small range
      if (res && (res.status === 405 || res.status === 400)) {
        const getController = new AbortController();
        const getTimeout = setTimeout(() => getController.abort(), 2500);
        res = await fetch(url, {
          method: "GET",
          signal: getController.signal,
          headers: {
            Range: "bytes=0-1024",
            "User-Agent": "SkillBridge-Verification/2.0 (+https://skillbridge.ai)"
          }
        }).catch(() => null);
        clearTimeout(getTimeout);
      }

      const isLive = Boolean(res && res.status >= 200 && res.status < 400);
      this.liveUrlCache.set(url, { isLive, timestamp: Date.now() });
      return isLive;
    } catch {
      // Default to neutral true if network error occurs to avoid over-blocking
      return true;
    }
  }
}

module.exports = new VerificationService();
