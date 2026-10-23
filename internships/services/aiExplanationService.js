/**
 * AI Explanation and Enrichment Service
 * Uses LLM to extract structured insights and generate natural match summaries
 * from verified listing text, with deterministic fallback and hash caching.
 */

const { callGroqJSON } = require("../../services/aiClient");

class AIExplanationService {
  constructor() {
    this.cache = new Map(); // `${listingId}:${contentHash}` -> result
  }

  /**
   * Enriches a ranked listing with concise AI match explanations.
   * Gracefully falls back to deterministic analysis on any failure.
   * @param {Object} listing - Scored and normalized listing
   * @param {Object} profile - Minimal user profile
   * @returns {Promise<Object>} Enriched listing
   */
  async enrichListing(listing, profile = {}) {
    const cacheKey = `${listing.id}:${listing.contentHash || "v1"}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return this._applyAiResult(listing, cached);
    }

    // If Groq API key is missing, return deterministic explanation directly
    if (!process.env.GROQ_API_KEY) {
      return listing;
    }

    try {
      const systemPrompt = `You are an Objective Career Match Analyst.
Your task is to analyze a candidate profile against a real verified internship listing.
Rules:
1. Base your output ONLY on facts directly stated in the listing. Do not invent or assume details.
2. If details (like stipend, duration, or eligibility) are not mentioned, report them as uncertain or not specified.
3. Return valid JSON only with this schema:
{
  "extractedSkills": ["Skill 1", "Skill 2"],
  "roleCategory": "Frontend Development",
  "matchStrength": "High",
  "matchingReasons": ["Specific reason citing candidate skill and job requirement"],
  "missingRequirements": ["Specific required skill or experience missing in profile"],
  "uncertainties": ["Eligibility or details not specified in the listing"]
}`;

      // Minimal safe payload (no PII, no secrets)
      const userPayload = {
        candidate: {
          skills: (profile.skills || []).slice(0, 6),
          goal: profile.goal || "",
          education: profile.education || "",
          workplacePreference: profile.workplace || "Any"
        },
        listing: {
          title: listing.title,
          company: listing.company,
          location: listing.location,
          workMode: listing.workMode,
          requiredSkills: listing.requiredSkills,
          descriptionSnippet: (listing.description || "").slice(0, 1000)
        }
      };

      const aiResponse = await callGroqJSON({
        systemPrompt,
        userPrompt: JSON.stringify(userPayload),
        temperature: 0.2
      });

      const validated = this._validateAiOutput(aiResponse);
      if (validated) {
        this.cache.set(cacheKey, validated);
        return this._applyAiResult(listing, validated);
      }
    } catch (err) {
      // Deterministic fallback: silent continue without breaking search
    }

    return listing;
  }

  /**
   * Enriches an array of listings concurrently up to a safe batch size.
   * @param {Object[]} listings
   * @param {Object} profile
   * @param {number} [limit=5] - Only enrich the top N ranked listings to conserve tokens/latency
   * @returns {Promise<Object[]>}
   */
  async enrichBatch(listings, profile = {}, limit = 5) {
    if (!Array.isArray(listings)) return [];

    const enriched = [...listings];
    const targetSlice = enriched.slice(0, limit);

    await Promise.allSettled(
      targetSlice.map(async (item, idx) => {
        enriched[idx] = await this.enrichListing(item, profile);
      })
    );

    return enriched;
  }

  /**
   * Validates structure and types of AI JSON output.
   * @private
   */
  _validateAiOutput(raw) {
    if (!raw || typeof raw !== "object") return null;

    return {
      extractedSkills: Array.isArray(raw.extractedSkills)
        ? raw.extractedSkills.map(s => String(s).trim()).filter(Boolean)
        : [],
      roleCategory: typeof raw.roleCategory === "string" ? raw.roleCategory.trim() : "",
      matchStrength: ["High", "Medium", "Low"].includes(raw.matchStrength) ? raw.matchStrength : "Medium",
      matchingReasons: Array.isArray(raw.matchingReasons)
        ? raw.matchingReasons.map(r => String(r).trim()).filter(Boolean)
        : [],
      missingRequirements: Array.isArray(raw.missingRequirements)
        ? raw.missingRequirements.map(m => String(m).trim()).filter(Boolean)
        : [],
      uncertainties: Array.isArray(raw.uncertainties)
        ? raw.uncertainties.map(u => String(u).trim()).filter(Boolean)
        : []
    };
  }

  /**
   * Applies validated AI results to listing object.
   * @private
   */
  _applyAiResult(listing, aiData) {
    const updated = { ...listing };

    if (aiData.matchingReasons.length > 0) {
      updated.aiMatchExplanation = aiData.matchingReasons.join(" ");
      // Combine with deterministic explanation if distinct
      if (!updated.matchExplanation.includes(aiData.matchingReasons[0])) {
        updated.matchExplanation = `${updated.matchExplanation} ${aiData.matchingReasons[0]}`.trim();
        updated.whyItMatches = updated.matchExplanation;
      }
    }

    if (aiData.missingRequirements.length > 0) {
      const mergedMissing = new Set([...(updated.missingSkills || []), ...aiData.missingRequirements]);
      updated.missingSkills = Array.from(mergedMissing).slice(0, 3);
    }

    if (aiData.uncertainties.length > 0) {
      const mergedUncertain = new Set([...(updated.uncertainties || []), ...aiData.uncertainties]);
      updated.uncertainties = Array.from(mergedUncertain);
    }

    return updated;
  }
}

module.exports = new AIExplanationService();
