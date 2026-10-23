/**
 * Deep Research Query Builder
 * Generates multi-angle, structured query variations from student profiles
 * covering target roles, specific skills, workplace preferences, and graduation years.
 */

const { normalizeSkillList } = require("../utils/skillNormalization");

class QueryBuilder {
  /**
   * Generates a comprehensive set of search variations from candidate profile.
   * @param {Object} profile
   * @returns {Object} Structured query plan with multi-angle variations
   */
  buildResearchPlan(profile = {}) {
    const type = profile.type === "job" ? "job" : "internship";
    const isInternship = type !== "job";

    const rawSkills = normalizeSkillList(profile.skills || []);
    const primarySkill = rawSkills[0] || "Software Engineering";
    const secondarySkill = rawSkills[1] || "";
    const tertiarySkill = rawSkills[2] || "";

    const goal = (profile.goal || "").trim();
    const workplace = profile.workplace || "Any";
    const graduationYear = this._extractYear(profile.graduationYear || profile.batch);
    const location = (profile.location || "").trim();
    const education = (profile.education || "").trim();

    // Determine target role title
    let targetRole = goal;
    if (!targetRole) {
      targetRole = `${primarySkill} ${isInternship ? "Intern" : "Developer"}`;
    }

    // Role qualifier
    const internQualifier = isInternship ? "Internship" : "Developer";

    // Build multi-angle query variations
    const queryVariations = [];

    // Variation 1: Exact target role + intern qualifier
    queryVariations.push({
      angle: "role_exact",
      text: `${targetRole} ${isInternship && !/intern/i.test(targetRole) ? "Intern" : ""}`.trim(),
      weight: 1.0
    });

    // Variation 2: Primary tech skill + target role
    if (primarySkill && !targetRole.toLowerCase().includes(primarySkill.toLowerCase())) {
      queryVariations.push({
        angle: "primary_skill_role",
        text: `${primarySkill} ${targetRole}`.trim(),
        weight: 0.9
      });
    }

    // Variation 3: Core skills pair + internship
    if (primarySkill && secondarySkill) {
      queryVariations.push({
        angle: "skill_pair",
        text: `${primarySkill} ${secondarySkill} ${internQualifier}`.trim(),
        weight: 0.85
      });
    }

    // Variation 4: Workplace preference + role (e.g. Remote Frontend Intern)
    if (workplace && workplace !== "Any") {
      queryVariations.push({
        angle: "workplace_role",
        text: `${workplace} ${targetRole} ${isInternship && !/intern/i.test(targetRole) ? "Intern" : ""}`.trim(),
        weight: 0.8
      });
    }

    // Variation 5: Graduation year / Student specific query
    if (graduationYear && isInternship) {
      queryVariations.push({
        angle: "grad_year",
        text: `${primarySkill} Summer ${graduationYear} Intern`.trim(),
        weight: 0.75
      });
    }

    // Variation 6: Location specific query
    if (location && workplace !== "Remote") {
      queryVariations.push({
        angle: "location_role",
        text: `${targetRole} ${location}`.trim(),
        weight: 0.75
      });
    }

    // Filter tokens for fast matching
    const searchTokens = new Set([
      ...rawSkills.map(s => s.toLowerCase()),
      ...targetRole.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    ]);

    return {
      type,
      isInternship,
      targetRole,
      primarySkill,
      secondarySkill,
      tertiarySkill,
      allSkills: rawSkills,
      workplace,
      location,
      graduationYear,
      education,
      queryVariations,
      searchTokens: Array.from(searchTokens),
      category: this._inferCategory(targetRole || primarySkill)
    };
  }

  _extractYear(input) {
    if (!input) return null;
    const match = String(input).match(/\b(20\d{2})\b/);
    return match ? parseInt(match[1], 10) : null;
  }

  _inferCategory(text = "") {
    const t = text.toLowerCase();
    if (t.includes("front") || t.includes("react") || t.includes("ui") || t.includes("vue")) return "Frontend Development";
    if (t.includes("back") || t.includes("node") || t.includes("api") || t.includes("django") || t.includes("spring")) return "Backend Development";
    if (t.includes("full") || t.includes("stack") || t.includes("mern")) return "Full-Stack Engineering";
    if (t.includes("ai") || t.includes("machine learning") || t.includes("data") || t.includes("ml")) return "AI & Machine Learning";
    if (t.includes("mobile") || t.includes("android") || t.includes("ios") || t.includes("flutter")) return "Mobile App Development";
    if (t.includes("cloud") || t.includes("devops") || t.includes("infra")) return "Cloud & DevOps";
    return "Software Engineering";
  }
}

module.exports = new QueryBuilder();
