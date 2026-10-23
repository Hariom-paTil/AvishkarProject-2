/**
 * Ranking Service
 * Deep-verification prioritized multi-factor weighted scoring algorithm for internship recommendations.
 * Produces deterministic, explainable scores from 0 to 100 with full factor breakdown
 * and honest match explanations.
 */

const { RANKING_WEIGHTS, SOURCE_RELIABILITY_SCORES } = require("../types/rankingConfig");
const { calculateRecencyScore, getAgeInDays } = require("../utils/dateParser");
const { checkWorkplaceCompatibility } = require("../utils/locationNormalization");
const { VerificationStatus } = require("../types/internshipTypes");

class RankingService {
  /**
   * Scores and ranks an array of eligible listings against user profile.
   * Priority:
   * 1. Verified and active internship
   * 2. Strong role match
   * 3. High required-skill overlap
   * 4. Matching location or remote preference
   * 5. Explicit eligibility fit
   * 6. Recent listing
   * 7. Complete description and direct application link
   * @param {Object[]} listings
   * @param {Object} profile
   * @returns {Object[]} Ranked listings with score breakdown & explanations
   */
  rankListings(listings, profile = {}) {
    if (!Array.isArray(listings)) return [];

    const scored = listings.map(listing => this.scoreListing(listing, profile));

    // Sort: Verified first, then by total score descending
    scored.sort((a, b) => {
      // Priority 1: Verified status
      const aVerified = a.verificationStatus === VerificationStatus.VERIFIED ? 1 : 0;
      const bVerified = b.verificationStatus === VerificationStatus.VERIFIED ? 1 : 0;
      if (aVerified !== bVerified) {
        return bVerified - aVerified;
      }
      return (b.score || 0) - (a.score || 0);
    });

    return scored;
  }

  /**
   * Alias for rankListings
   */
  rank(listings, profile = {}) {
    return this.rankListings(listings, profile);
  }

  /**
   * Calculates comprehensive multi-factor score for a single listing.
   * @param {Object} listing
   * @param {Object} profile
   * @returns {Object} Listing enriched with score, breakdown, matching/missing skills, and explanation
   */
  scoreListing(listing, profile = {}) {
    const userSkills = (profile.skills || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
    const userRoleGoal = (profile.goal || "").toLowerCase().trim();
    const userWorkplace = profile.workplace || "Any";

    const titleLower = (listing.title || "").toLowerCase();
    const descLower = (listing.description || "").toLowerCase();
    const categoryLower = (listing.category || "").toLowerCase();

    // 1. Verification Bonus (Priority 1: 0 to 10 bonus points)
    let verificationScore = 0;
    if (listing.verificationStatus === VerificationStatus.VERIFIED) {
      verificationScore = 10;
    } else if (listing.verificationStatus === VerificationStatus.RECENTLY_DISCOVERED) {
      verificationScore = 5;
    } else {
      verificationScore = 2; // Needs confirmation
    }

    // 2. Role Relevance (Priority 2: 0 to 30 pts)
    // Avoid ranking highly only because a single buzzword like "AI" or "Python" appears in title
    let roleScore = 0;
    const isInternshipListing = /intern|internship|co-op|coop|apprentice|student|trainee/i.test(titleLower);

    if (userRoleGoal) {
      const goalTokens = userRoleGoal.split(/\s+/).filter(t => t.length > 2);
      let tokenMatches = 0;
      for (const token of goalTokens) {
        if (titleLower.includes(token)) tokenMatches++;
        else if (categoryLower.includes(token)) tokenMatches += 0.5;
      }
      if (goalTokens.length > 0) {
        const matchRatio = tokenMatches / goalTokens.length;
        roleScore = Math.min(RANKING_WEIGHTS.ROLE_RELEVANCE_MAX, matchRatio * 30);
      }
    } else {
      roleScore = 18;
    }

    // Role fit penalty if title does not clearly confirm internship role
    if (!isInternshipListing && profile.type !== "job") {
      roleScore = Math.max(5, roleScore - 10);
    }

    // 3. Required Skill Overlap (Priority 3: 0 to 25 pts)
    const requiredSkills = listing.requiredSkills || [];
    const matchedSkills = [];
    const missingSkills = [];

    if (requiredSkills.length > 0) {
      for (const reqSkill of requiredSkills) {
        const reqLower = reqSkill.toLowerCase();
        const hasSkill = userSkills.some(us => us === reqLower || reqLower.includes(us) || us.includes(reqLower));
        if (hasSkill) {
          matchedSkills.push(reqSkill);
        } else {
          missingSkills.push(reqSkill);
        }
      }
      const matchRatio = matchedSkills.length / requiredSkills.length;
      var requiredSkillScore = Math.round(matchRatio * RANKING_WEIGHTS.REQUIRED_SKILL_MAX);

      if (missingSkills.length > 2) {
        requiredSkillScore = Math.max(0, requiredSkillScore + RANKING_WEIGHTS.MISSING_REQUIRED_SKILL_PENALTY);
      }
    } else {
      for (const us of userSkills) {
        if (titleLower.includes(us) || descLower.includes(us)) {
          matchedSkills.push(us.charAt(0).toUpperCase() + us.slice(1));
        }
      }
      // Conservative cap when skills were extracted from text
      requiredSkillScore = Math.min(18, matchedSkills.length * 6);
    }

    // 4. Preferred Skill Overlap (0 to 10 pts)
    const preferredSkills = listing.preferredSkills || [];
    let preferredSkillScore = 0;
    const missingPreferred = [];
    if (preferredSkills.length > 0) {
      const matchedPref = [];
      for (const ps of preferredSkills) {
        const psLower = ps.toLowerCase();
        const hasPref = userSkills.some(us => us === psLower || psLower.includes(us));
        if (hasPref) {
          matchedPref.push(ps);
        } else {
          missingPreferred.push(ps);
        }
      }
      preferredSkillScore = Math.min(RANKING_WEIGHTS.PREFERRED_SKILL_MAX, (matchedPref.length / preferredSkills.length) * 10);
    } else {
      preferredSkillScore = 5;
    }

    // 5. Location / Remote Fit (Priority 4: 0 to 10 pts)
    const workplaceFit = checkWorkplaceCompatibility(userWorkplace, listing.workMode);
    const locationScore = workplaceFit.score;

    // 6. Explicit Eligibility Fit (Priority 5: 0 to 10 pts)
    const eligibilityScore = typeof listing.eligibilityScore === "number" ? listing.eligibilityScore : 8;

    // 7. Listing Recency (Priority 6: 0 to 8 pts)
    const recencyScore = calculateRecencyScore(listing.postedDate);

    // 8. Listing Completeness & Direct Apply Link (Priority 7: 0 to 4 pts)
    let completenessScore = Math.min(RANKING_WEIGHTS.COMPLETENESS_MAX, ((listing.completenessScore || 50) / 100) * 4);
    if (listing.directApplyUrl && listing.directApplyUrl.includes(listing.source.toLowerCase())) {
      completenessScore = Math.min(RANKING_WEIGHTS.COMPLETENESS_MAX, completenessScore + 0.5);
    }

    // 9. Source Freshness & Reliability (0 to 3 pts)
    const sourceReliability = SOURCE_RELIABILITY_SCORES[listing.source] || 1.5;

    // Penalties for stale listings (> 45 days)
    let penalties = 0;
    const age = getAgeInDays(listing.postedDate);
    if (age !== null && age > 45) {
      penalties += RANKING_WEIGHTS.STALE_LISTING_PENALTY;
    }

    // Compute raw total and clamp between 20 and 99
    const rawTotal = (
      (verificationScore * 0.7) +
      roleScore +
      requiredSkillScore +
      preferredSkillScore +
      locationScore +
      eligibilityScore +
      recencyScore +
      completenessScore +
      sourceReliability +
      penalties
    );
    const finalScore = Math.min(99, Math.max(20, Math.round(rawTotal)));

    // Generate honest factual explanation
    // Format: "Verified on [source]. Matches your [skills]. [Workplace fit]. [Missing requirements]. [Eligibility notice]."
    const explanationParts = [];

    // Verification prefix
    if (listing.verificationStatus === VerificationStatus.VERIFIED) {
      explanationParts.push(`Verified on the ${listing.company} career page.`);
    } else if (listing.verificationStatus === VerificationStatus.NEEDS_CONFIRMATION) {
      explanationParts.push(`Discovered on ${listing.source}; key details need confirmation.`);
    } else {
      explanationParts.push(`Discovered via ${listing.source}.`);
    }

    // Matched skills
    if (matchedSkills.length > 0) {
      explanationParts.push(`Matches your ${matchedSkills.slice(0, 3).join(", ")} skills.`);
    } else {
      explanationParts.push(`General alignment with software engineering background.`);
    }

    // Workplace fit
    if (workplaceFit.reason) {
      explanationParts.push(workplaceFit.reason);
    }

    // Missing required/preferred skills
    if (missingSkills.length > 0) {
      explanationParts.push(`${missingSkills[0]} is listed as a requirement but is not in your profile.`);
    } else if (missingPreferred.length > 0) {
      explanationParts.push(`${missingPreferred[0]} is listed as a preferred skill but is not in your profile.`);
    }

    // Recency note
    if (age !== null && age <= 7) {
      explanationParts.push("Recently posted.");
    }

    // Eligibility uncertainty
    if (Array.isArray(listing.uncertainties) && listing.uncertainties.length > 0) {
      explanationParts.push(listing.uncertainties[0]);
    } else {
      explanationParts.push("Eligibility terms not fully stated in listing.");
    }

    const explanation = explanationParts.join(" ");

    return {
      ...listing,
      score: finalScore,
      scoreBreakdown: {
        verification: Math.round(verificationScore),
        roleRelevance: Math.round(roleScore),
        requiredSkills: Math.round(requiredSkillScore),
        preferredSkills: Math.round(preferredSkillScore),
        locationRemote: Math.round(locationScore),
        eligibility: Math.round(eligibilityScore),
        recency: Math.round(recencyScore),
        completeness: Math.round(completenessScore),
        sourceReliability: Math.round(sourceReliability)
      },
      matchingSkills: matchedSkills.length > 0 ? matchedSkills : userSkills.slice(0, 3),
      missingSkills: [...missingSkills, ...missingPreferred].slice(0, 3),
      matchExplanation: explanation,
      whyItMatches: explanation
    };
  }
}

module.exports = new RankingService();
