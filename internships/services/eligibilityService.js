/**
 * Eligibility Service
 * Evaluates candidate profile attributes against listing requirements.
 * Applies hard filters and flags uncertainties without rejecting listings
 * with unstated details.
 */

const { checkWorkplaceCompatibility } = require("../utils/locationNormalization");

class EligibilityService {
  /**
   * Evaluates listing eligibility against user profile.
   * @param {Object} listing - Normalized listing
   * @param {Object} profile - User profile and search filters
   * @returns {{
   *   eligible: boolean,
   *   rejectionReason: string|null,
   *   uncertainties: string[],
   *   score: number
   * }}
   */
  checkEligibility(listing, profile = {}) {
    const uncertainties = [];
    let eligibilityScore = 10; // Max 10 points

    // 1. Filter out closed or expired listings
    if (listing.status === "closed" || listing.status === "expired") {
      return {
        eligible: false,
        rejectionReason: "Listing is closed or expired.",
        uncertainties,
        score: 0
      };
    }

    const {
      type = "internship",
      workplace = "Any",
      graduationYear = "",
      batch = "",
      education = "",
      workAuthorization = "",
      startDate = ""
    } = profile;

    // 2. Role Type Fit: If user requested internship, verify listing is internship/co-op
    const isInternship = type !== "job";
    const titleLower = (listing.title || "").toLowerCase();
    const descLower = (listing.description || "").toLowerCase();

    if (isInternship) {
      const hasInternTerms = /intern|internship|co-op|coop|apprentice|fellow|student|university/i.test(titleLower);
      const isSenior = /\b(senior|staff|principal|director|lead)\b/i.test(titleLower);
      if (isSenior) {
        return {
          eligible: false,
          rejectionReason: "Role is a senior position, not an internship.",
          uncertainties,
          score: 0
        };
      }
      if (!hasInternTerms) {
        // Not explicitly labeled as intern in title, check description
        if (!/intern|internship|university student|co-op/i.test(descLower)) {
          uncertainties.push("Role title does not explicitly mention internship.");
          eligibilityScore -= 2;
        }
      }
    }

    // 3. Workplace & Remote Compatibility
    const workplaceFit = checkWorkplaceCompatibility(workplace, listing.workMode);
    if (!workplaceFit.compatible) {
      return {
        eligible: false,
        rejectionReason: workplaceFit.reason,
        uncertainties,
        score: 0
      };
    }

    // 4. Graduation Year Requirements Check
    const candidateGradYear = this._extractGraduationYear(graduationYear || batch);
    if (candidateGradYear) {
      const gradYearReqMatch = descLower.match(/graduat(?:ing|ion)\s+(?:in\s+)?(20\d\d)/i) ||
                               descLower.match(/class\s+of\s+(20\d\d)/i);
      if (gradYearReqMatch) {
        const requiredYear = parseInt(gradYearReqMatch[1], 10);
        if (Math.abs(candidateGradYear - requiredYear) > 1) {
          return {
            eligible: false,
            rejectionReason: `Requires graduation year ${requiredYear}, candidate graduating ${candidateGradYear}.`,
            uncertainties,
            score: 0
          };
        }
      } else {
        uncertainties.push("Graduation eligibility is not specified.");
      }
    } else {
      uncertainties.push("Graduation year not provided in user profile.");
    }

    // 5. Education Level Check
    if (education) {
      const reqPhD = /ph\.?d|doctorate/i.test(descLower) && !/bachelor|master/i.test(descLower);
      const userPhD = /ph\.?d|doctorate/i.test(education);
      if (reqPhD && !userPhD) {
        return {
          eligible: false,
          rejectionReason: "Role specifically requires PhD or doctorate degree.",
          uncertainties,
          score: 0
        };
      }
    } else {
      uncertainties.push("Degree requirements were not listed.");
    }

    // 6. Work Authorization Check
    if (workAuthorization) {
      const requiresSecurityClearance = /security clearance|us citizen only|top secret/i.test(descLower);
      const hasClearance = /citizen|cleared/i.test(workAuthorization);
      if (requiresSecurityClearance && !hasClearance) {
        return {
          eligible: false,
          rejectionReason: "Role requires special citizenship or security clearance.",
          uncertainties,
          score: 0
        };
      }
    } else {
      uncertainties.push("Work authorization requirements are not specified.");
    }

    // 7. Start date check (if available)
    if (startDate && listing.startDate && listing.startDate !== "Flexible / Not specified") {
      // If listing has strict start date in the past
      const listDate = new Date(listing.startDate);
      const userDate = new Date(startDate);
      if (!isNaN(listDate.getTime()) && !isNaN(userDate.getTime())) {
        if (userDate > listDate) {
          uncertainties.push(`Candidate availability (${startDate}) is after stated start date.`);
          eligibilityScore -= 2;
        }
      }
    }

    return {
      eligible: true,
      rejectionReason: null,
      uncertainties,
      score: Math.max(eligibilityScore, 4)
    };
  }

  /**
   * Filters an array of listings to only eligible ones and attaches eligibility notes.
   * @param {Object[]} listings
   * @param {Object} profile
   * @returns {Object[]}
   */
  filterAndEnrich(listings, profile = {}) {
    if (!Array.isArray(listings)) return [];

    const passed = [];
    for (const item of listings) {
      const evaluation = this.checkEligibility(item, profile);
      if (evaluation.eligible) {
        item.uncertainties = evaluation.uncertainties;
        item.eligibilityScore = evaluation.score;
        passed.push(item);
      }
    }
    return passed;
  }

  _extractGraduationYear(text = "") {
    if (!text) return null;
    const match = String(text).match(/\b(20\d{2})\b/);
    return match ? parseInt(match[1], 10) : null;
  }
}

module.exports = new EligibilityService();
