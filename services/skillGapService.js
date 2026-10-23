/**
 * SkillGapService
 * Performs detailed skill gap analysis between candidate background and target role requirements.
 * Returns structured per-skill breakdowns, readiness metrics, and practice project roadmaps.
 */

const { callGroqJSON } = require("./aiClient");

class SkillGapService {
  /**
   * Run skill gap analysis for candidate profile against target role.
   * @param {Object} input - Validated input from validateSkillGapRequest
   * @returns {Promise<Object>} Structured skill gap analysis result
   */
  async analyzeGap(input) {
    const { role, seniority, education, goal, skills, projects } = input;

    const systemPrompt = `You are a Senior Technical Architect and Hiring Manager performing a rigorous Skill Gap Analysis.
Analyze the candidate's skills and projects against standard industry requirements for the target role.

CRITICAL RULES:
1. Provide a detailed, per-skill structured assessment. Do NOT return an unformatted markdown text block.
2. Evaluate overall match percentage (0 to 100).
3. Classify candidate's existing and missing skills in skillAnalysis:
   - status: "Proficient" (strong), "Developing" (partial), or "Missing" (lacking)
   - currentLevel: candidate's estimated current level ("None", "Beginner", "Intermediate", "Advanced")
   - requiredLevel: target level needed for role ("Beginner", "Intermediate", "Advanced", "Expert")
   - priority: "Critical", "High", "Medium", or "Low"
   - reason: why this skill matters for the role
   - recommendedAction: specific learning step or resource topic
4. Create a 3 to 5 step sequential learningRoadmap:
   - order: step number (1, 2, 3...)
   - skill: target skill to acquire/master
   - reason: why to focus on this step now
   - practiceProject: practical project idea demonstrating mastery
5. Identify top strengths (array of strings) and criticalGaps (array of strings).

Return ONLY valid JSON matching this exact structure:
{
  "targetRole": "${role}",
  "seniority": "${seniority}",
  "overallMatchPercentage": 75,
  "summary": "1-2 sentence executive assessment of candidate readiness",
  "strengths": ["Strength 1", "Strength 2"],
  "criticalGaps": ["Gap 1", "Gap 2"],
  "skillAnalysis": [
    {
      "skill": "Skill Name",
      "status": "Proficient",
      "currentLevel": "Intermediate",
      "requiredLevel": "Advanced",
      "priority": "High",
      "reason": "Why it matters...",
      "recommendedAction": "Actionable learning step..."
    }
  ],
  "learningRoadmap": [
    {
      "order": 1,
      "skill": "Skill Name",
      "reason": "Why learn this...",
      "practiceProject": "Hands-on project description..."
    }
  ]
}`;

    const userPrompt = JSON.stringify({
      targetRole: `${seniority} ${role}`,
      careerGoal: goal,
      education: education || "Tech Background",
      candidateSkills: skills.length > 0 ? skills : ["General Software Engineering"],
      candidateProjects: projects || "None specified"
    });

    try {
      const result = await callGroqJSON({ systemPrompt, userPrompt, temperature: 0.3 });

      // Sanitize and structure result
      return {
        targetRole: result.targetRole || `${seniority} ${role}`,
        seniority: result.seniority || seniority,
        overallMatchPercentage: typeof result.overallMatchPercentage === "number" ? result.overallMatchPercentage : 75,
        summary: result.summary || "Skill gap assessment generated successfully.",
        strengths: Array.isArray(result.strengths) ? result.strengths : skills.slice(0, 3),
        criticalGaps: Array.isArray(result.criticalGaps) ? result.criticalGaps : ["System Design", "Cloud Infrastructure"],
        skillAnalysis: Array.isArray(result.skillAnalysis) ? result.skillAnalysis : [],
        learningRoadmap: Array.isArray(result.learningRoadmap) ? result.learningRoadmap : []
      };
    } catch (err) {
      console.warn("SkillGapService AI call failed, using intelligent fallback:", err.message);
      return this._generateFallbackAnalysis(input);
    }
  }

  /**
   * Fallback skill gap generator if AI service is unavailable.
   * @private
   */
  _generateFallbackAnalysis(input) {
    const { role, seniority, skills } = input;
    const normalizedSkills = skills.map(s => s.toLowerCase());

    const defaultSkillsForRole = [
      { name: "Core Programming", req: "Advanced", check: s => s.includes("javascript") || s.includes("python") || s.includes("java") || s.includes("c++") },
      { name: "Framework Mastery", req: "Intermediate", check: s => s.includes("react") || s.includes("node") || s.includes("express") || s.includes("django") || s.includes("spring") },
      { name: "Database & Storage", req: "Intermediate", check: s => s.includes("sql") || s.includes("mongo") || s.includes("postgres") || s.includes("redis") },
      { name: "Version Control & Git", req: "Intermediate", check: s => s.includes("git") || s.includes("github") },
      { name: "System Design & Architecture", req: "Intermediate", check: s => s.includes("system design") || s.includes("microservices") },
      { name: "Testing & CI/CD", req: "Intermediate", check: s => s.includes("jest") || s.includes("docker") || s.includes("ci/cd") }
    ];

    const skillAnalysis = [];
    const strengths = [];
    const criticalGaps = [];

    defaultSkillsForRole.forEach(item => {
      const hasSkill = normalizedSkills.some(item.check);
      if (hasSkill) {
        strengths.push(item.name);
        skillAnalysis.push({
          skill: item.name,
          status: "Proficient",
          currentLevel: "Intermediate",
          requiredLevel: item.req,
          priority: "Low",
          reason: `Core component of modern ${role} development.`,
          recommendedAction: "Deepen expertise through production projects."
        });
      } else {
        criticalGaps.push(item.name);
        skillAnalysis.push({
          skill: item.name,
          status: "Missing",
          currentLevel: "None",
          requiredLevel: item.req,
          priority: "High",
          reason: `Required for ${seniority} level ${role} positions.`,
          recommendedAction: `Complete dedicated practical tutorials and build a demo feature covering ${item.name}.`
        });
      }
    });

    const overallMatch = Math.round((strengths.length / defaultSkillsForRole.length) * 100);

    return {
      targetRole: `${seniority} ${role}`,
      seniority,
      overallMatchPercentage: overallMatch,
      summary: `Evaluated candidate against core requirements for ${seniority} ${role}. Found ${strengths.length} strengths and ${criticalGaps.length} critical growth areas.`,
      strengths,
      criticalGaps,
      skillAnalysis,
      learningRoadmap: [
        {
          order: 1,
          skill: criticalGaps[0] || "Advanced API Development",
          reason: "Highest impact skill needed to achieve job readiness.",
          practiceProject: "Build a production-ready REST API with authentication, rate limiting, and automated tests."
        },
        {
          order: 2,
          skill: criticalGaps[1] || "Database Optimization",
          reason: "Essential for scaling backend applications.",
          practiceProject: "Design a database schema with index tuning, caching layer (Redis), and query benchmark script."
        },
        {
          order: 3,
          skill: "System Design Fundamentals",
          reason: "Prepares candidate for technical interview rounds.",
          practiceProject: "Draft architectural diagrams and design docs for a real-time messaging or notification system."
        }
      ]
    };
  }
}

module.exports = new SkillGapService();
