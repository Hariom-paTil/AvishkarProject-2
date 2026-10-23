/**
 * Shared Input Validators
 * Reusable validation logic for all three services.
 */

/**
 * Validate and normalize a comma-separated skill string into an array.
 * @param {string|string[]} skills
 * @returns {string[]}
 */
function normalizeSkills(skills) {
  if (Array.isArray(skills)) {
    return skills.map(s => String(s).trim()).filter(Boolean);
  }
  if (typeof skills === "string") {
    return skills.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Sanitize a string input: trim, collapse whitespace, limit length.
 * @param {*} value
 * @param {number} [maxLen=500]
 * @returns {string}
 */
function sanitizeString(value, maxLen = 500) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

/**
 * Validate internship/job search request body.
 * @param {Object} body
 * @returns {{ valid: boolean, errors: string[], data: Object }}
 */
function validateInternshipRequest(body) {
  const errors = [];
  const data = {};

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Invalid request body."], data: {} };
  }

  data.type = (body.type === "job") ? "job" : "internship";
  data.education = sanitizeString(body.education, 200);
  data.skills = normalizeSkills(body.skills);
  data.goal = sanitizeString(body.goal, 500);
  data.workplace = ["Remote", "Hybrid", "On-site", "Any"].includes(body.workplace) ? body.workplace : "Any";
  data.batch = sanitizeString(body.batch, 100) || "Current Student";
  data.graduationYear = sanitizeString(body.graduationYear, 20);
  data.location = sanitizeString(body.location, 200);
  data.workAuthorization = sanitizeString(body.workAuthorization, 200);
  data.minStipend = typeof body.minStipend === "number" ? body.minStipend : 0;
  data.page = Math.max(1, parseInt(body.page || 1, 10));
  data.pageSize = Math.max(1, Math.min(50, parseInt(body.pageSize || 24, 10)));
  data.forceLive = Boolean(body.forceLive);

  if (data.skills.length === 0 && !data.education && !data.goal) {
    errors.push("Please provide at least your skills, target goal, or education.");
  }

  return { valid: errors.length === 0, errors, data };
}

/**
 * Validate skill gap analysis request body.
 * @param {Object} body
 * @returns {{ valid: boolean, errors: string[], data: Object }}
 */
function validateSkillGapRequest(body) {
  const errors = [];
  const data = {};

  data.role = sanitizeString(body.role, 200) || "Full-Stack Engineer";
  data.seniority = sanitizeString(body.seniority, 100) || "Entry-Level";
  data.education = sanitizeString(body.education, 200);
  data.goal = sanitizeString(body.goal, 500);
  data.skills = normalizeSkills(body.skills);
  data.projects = sanitizeString(body.projects, 1000);

  if (data.skills.length === 0 && !data.education) {
    errors.push("Please provide at least your current skills or education.");
  }

  return { valid: errors.length === 0, errors, data };
}

/**
 * Validate interview generation request body.
 * @param {Object} body
 * @returns {{ valid: boolean, errors: string[], data: Object }}
 */
function validateInterviewRequest(body) {
  const errors = [];
  const data = {};

  data.role = sanitizeString(body.role, 200) || "Full-Stack Engineer";
  data.skills = normalizeSkills(body.skills);
  data.goal = sanitizeString(body.goal, 500);
  data.projects = sanitizeString(body.projects, 1000);
  data.focus = sanitizeString(body.focus, 100) || "Full-Stack";
  data.education = sanitizeString(body.education, 200);

  if (data.skills.length === 0) {
    errors.push("Please provide at least one skill for interview generation.");
  }

  return { valid: errors.length === 0, errors, data };
}

/**
 * Validate interview answer evaluation request body.
 * @param {Object} body
 * @returns {{ valid: boolean, errors: string[], data: Object }}
 */
function validateEvaluationRequest(body) {
  const errors = [];
  const data = {};

  data.question = sanitizeString(body.question, 1000);
  data.userAnswer = sanitizeString(body.userAnswer, 2000);
  data.category = sanitizeString(body.category, 100);
  data.skill = sanitizeString(body.skill, 100);
  data.expectedAnswerPoints = Array.isArray(body.expectedAnswerPoints)
    ? body.expectedAnswerPoints.map(p => sanitizeString(p, 300)).filter(Boolean)
    : [];

  if (!data.question) {
    errors.push("Question text is required for evaluation.");
  }
  if (!data.userAnswer) {
    errors.push("User answer is required for evaluation.");
  }

  return { valid: errors.length === 0, errors, data };
}

module.exports = {
  normalizeSkills,
  sanitizeString,
  validateInternshipRequest,
  validateSkillGapRequest,
  validateInterviewRequest,
  validateEvaluationRequest
};
