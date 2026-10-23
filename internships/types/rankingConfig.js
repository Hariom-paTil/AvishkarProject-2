/**
 * Ranking Configuration
 * Centralized scoring weights and thresholds for internship ranking.
 * Easily tunable without modifying core ranking logic.
 */

const RANKING_WEIGHTS = {
  // Maximum points for each factor (Total = 100 points)
  ROLE_RELEVANCE_MAX: 30,
  REQUIRED_SKILL_MAX: 25,
  PREFERRED_SKILL_MAX: 10,
  LOCATION_REMOTE_MAX: 10,
  ELIGIBILITY_FIT_MAX: 10,
  RECENCY_MAX: 8,
  COMPLETENESS_MAX: 4,
  SOURCE_RELIABILITY_MAX: 3,

  // Penalty weights
  MISSING_REQUIRED_SKILL_PENALTY: -5,
  STALE_LISTING_PENALTY: -4,
  INCOMPLETE_PENALTY: -2
};

const SOURCE_RELIABILITY_SCORES = {
  Greenhouse: 3.0,
  Lever: 3.0,
  Ashby: 3.0,
  Remotive: 2.5,
  LinkedIn: 2.8,
  Internshala: 2.5,
  Unknown: 1.0
};

module.exports = {
  RANKING_WEIGHTS,
  SOURCE_RELIABILITY_SCORES
};
