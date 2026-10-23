/**
 * Ranking Service
 * Transparent multi-factor weighted scoring algorithm for internship recommendations.
 * Produces deterministic, explainable scores from 0 to 100 with full factor breakdown.
 */

const { RANKING_WEIGHTS, SOURCE_RELIABILITY_SCORES } = require("../types/rankingConfig");
const { calculateRecencyScore, getAgeInDays } = require("../utils/dateParser");
const { checkWorkplaceCompatibility } = require("../utils/locationNormalization");

class RankingService {
  /**
   * Scores and ranks an array of eligible listings against user profile.
   * @param {Object[]} listings
   * @param {Object} profile
   * @returns {Object[]} Ranked listings with score breakdown & explanations
   */
  rankListings(listings, profile = {}) {
    if (!Array.isArray(listings)) return [];

    const scored = listings.map(listing => this.scoreListing(listing, profile));

    // Sort descending by total score
    scored.sort((a, b) => (b.score || 0) - (a.score || 0));

    return scored;
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

    // 1. Role Relevance (0 to 30 pts)
    let roleScore = 0;
    if (userRoleGoal) {
      const goalTokens = userRoleGoal.split(/\s+/).filter(t => t.length > 2);
      let tokenMatches = 0;
      for (const token of goalTokens) {
        if (titleLower.includes(token)) tokenMatches++;
        else if (categoryLower.includes(token)) tokenMatches += 0.5;
      }
      if (goalTokens.length > 0) {
        roleScore = Math.min(RANKING_WEIGHTS.ROLE_RELEVANCE_MAX, (tokenMatches / goalTokens.length) * 30);
      }
    } else {
      // Default baseline for general tech roles
      roleScore = 18;
    }

    // 2. Required Skill Overlap (0 to 25 pts)
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

      // Penalty for missing explicit required skills
      if (missingSkills.length > 2) {
        requiredSkillScore = Math.max(0, requiredSkillScore + RANKING_WEIGHTS.MISSING_REQUIRED_SKILL_PENALTY);
      }
    } else {
      // If listing didn't specify required skills, check text for user skills
      for (const us of userSkills) {
        if (titleLower.includes(us) || descLower.includes(us)) {
          matchedSkills.push(us.charAt(0).toUpperCase() + us.slice(1));
        }
      }
      requiredSkillScore = Math.min(RANKING_WEIGHTS.REQUIRED_SKILL_MAX, matchedSkills.length * 7);
    }

    // 3. Preferred Skill Overlap (0 to 10 pts)
    const preferredSkills = listing.preferredSkills || [];
    let preferredSkillScore = 0;
    if (preferredSkills.length > 0) {
      const matchedPref = preferredSkills.filter(ps =>
        userSkills.some(us => us === ps.toLowerCase() || ps.toLowerCase().includes(us))
      );
      preferredSkillScore = Math.min(RANKING_WEIGHTS.PREFERRED_SKILL_MAX, (matchedPref.length / preferredSkills.length) * 10);
    } else {
      preferredSkillScore = 5; // Neutral
    }

    // 4. Location / Remote Fit (0 to 10 pts)
    const workplaceFit = checkWorkplaceCompatibility(userWorkplace, listing.workMode);
    const locationScore = workplaceFit.score;

    // 5. Eligibility Fit (0 to 10 pts)
    const eligibilityScore = typeof listing.eligibilityScore === "number" ? listing.eligibilityScore : 8;

    // 6. Listing Recency (0 to 8 pts)
    const recencyScore = calculateRecencyScore(listing.postedDate);

    // 7. Listing Completeness (0 to 4 pts)
    const completenessScore = Math.min(RANKING_WEIGHTS.COMPLETENESS_MAX, ((listing.completenessScore || 50) / 100) * 4);

    // 8. Source Freshness & Reliability (0 to 3 pts)
    const sourceReliability = SOURCE_RELIABILITY_SCORES[listing.source] || 1.5;

    // Stale penalty
    let penalties = 0;
    const age = getAgeInDays(listing.postedDate);
    if (age !== null && age > 45) {
      penalties += RANKING_WEIGHTS.STALE_LISTING_PENALTY;
    }

    // Total score calculation (clamped between 15 and 99)
    const rawTotal = (
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

    // Generate clear, deterministic, factual explanation
    const explanationParts = [];
    if (matchedSkills.length > 0) {
      explanationParts.push(`Matches your ${matchedSkills.slice(0, 3).join(", ")} skills.`);
    } else {
      explanationParts.push("Matches software development engineering profile.");
    }

    if (workplaceFit.reason) {
      explanationParts.push(workplaceFit.reason);
    }

    if (age !== null && age <= 7) {
      explanationParts.push("Recently posted.");
    }

    if (missingSkills.length > 0) {
      explanationParts.push(`${missingSkills[0]} is required but not listed in your profile.`);
    }

    if (Array.isArray(listing.uncertainties) && listing.uncertainties.length > 0) {
      explanationParts.push(listing.uncertainties[0]);
    }

    const explanation = explanationParts.join(" ");

    return {
      ...listing,
      score: finalScore,
      scoreBreakdown: {
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
      missingSkills: missingSkills.slice(0, 3),
      matchExplanation: explanation,
      whyItMatches: explanation
    };
  }
}

module.exports = new RankingService();
