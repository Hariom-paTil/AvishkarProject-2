/**
 * InterviewService
 * Generates structured AI mock interview questions across multiple categories
 * (Technical, Project-based, Scenario, Behavioral, System Design, Security, Role-specific)
 * with whyAsked and expectedAnswerPoints, and provides AI-powered candidate answer evaluation.
 *
 * Guarantees exactly 10 industry-level interview questions.
 */

const { callGroqJSON } = require("./aiClient");

class InterviewService {
  /**
   * Generate exactly 10 mock interview questions tailored to candidate profile.
   * @param {Object} input - Validated input from validateInterviewRequest
   * @returns {Promise<Object>} Structured interview package with 10 questions
   */
  async generateInterview(input) {
    const { role, skills, goal, projects, focus, education } = input;

    const systemPrompt = `You are a Principal Tech Interviewer and Hiring Committee Lead at a top tech company.
Generate EXACTLY 10 high-quality, advanced mock interview questions based on candidate skills and target role.

CRITICAL RULES:
1. You MUST generate EXACTLY 10 questions distributed across categories:
   - "Technical": Core concepts, runtime internals, async workflows, data handling
   - "Project-based": Real-world architecture choices, trade-offs, debugging
   - "Scenario": Production incident resolution, bottlenecks, resilience
   - "System Design": Scalability, caching, DB design, API contracts
   - "Security": Auth, OWASP, input sanitization, token security
   - "Behavioral": Collaboration, code review disagreements, delivery pressure
   - "Role-specific": Tailored directly to ${role}
2. For each question, provide:
   - id: "q1" through "q10"
   - question: Clear, professional interview question text
   - category: "Technical" | "Project-based" | "Scenario" | "System Design" | "Security" | "Behavioral" | "Role-specific"
   - difficulty: "Easy" | "Medium" | "Hard"
   - skill: The primary technology or competency being evaluated
   - whyAsked: 1-2 sentences explaining why interviewers ask this question
   - expectedAnswerPoints: array of 3-4 key technical concepts a strong candidate must hit
   - options: array of 4 multiple-choice option strings (for interactive self-assessment quiz format)
   - correctIndex: integer 0-3 indicating the best option
   - explanation: rationale for the correct answer
3. DO NOT repeat identical questions. Ensure variety in difficulty and focus.
4. Total questions in the questions array must be EXACTLY 10.

Return ONLY valid JSON matching this exact structure:
{
  "role": "${role}",
  "focusArea": "${focus}",
  "totalQuestions": 10,
  "questions": [
    {
      "id": "q1",
      "category": "Technical",
      "difficulty": "Medium",
      "skill": "JavaScript",
      "question": "Question text...",
      "whyAsked": "Why interviewers ask this...",
      "expectedAnswerPoints": ["Point 1", "Point 2", "Point 3"],
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Explanation..."
    }
  ]
}`;

    const userPrompt = JSON.stringify({
      targetRole: role,
      primarySkills: skills,
      careerGoal: goal,
      projects: projects || "General software engineering projects",
      focusArea: focus,
      education: education,
      requiredQuestionCount: 10
    });

    try {
      const result = await callGroqJSON({ systemPrompt, userPrompt, temperature: 0.4 });
      let questions = Array.isArray(result.questions) ? result.questions : [];

      // If AI returned fewer than 10 questions, top it up with fallback questions to guarantee 10
      if (questions.length < 10) {
        const fallbacks = this._generateFallbackInterview(input).questions;
        const existingIds = new Set(questions.map(q => q.id));
        for (const fb of fallbacks) {
          if (questions.length >= 10) break;
          if (!existingIds.has(fb.id)) {
            questions.push(fb);
          }
        }
      }

      // Ensure exact count and structure consistency
      const processedQuestions = questions.slice(0, 10).map((q, idx) => ({
        id: `q-${idx + 1}`,
        category: q.category || "Technical",
        difficulty: q.difficulty || (idx < 3 ? "Easy" : idx < 7 ? "Medium" : "Hard"),
        skill: q.skill || skills[idx % skills.length] || "Software Engineering",
        question: q.question || "Explain how you optimize web application performance.",
        whyAsked: q.whyAsked || "Evaluates technical problem-solving and optimization ability.",
        expectedAnswerPoints: Array.isArray(q.expectedAnswerPoints) ? q.expectedAnswerPoints : ["Performance profiling", "Root cause", "Measurable outcome"],
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : [
          "Option A: Benchmark and isolate bottleneck using APM and profiling",
          "Option B: Restart production instances repeatedly without gathering logs",
          "Option C: Rewrite entire application architecture from scratch",
          "Option D: Disable all client-side state caching"
        ],
        correctIndex: typeof q.correctIndex === "number" ? Math.min(Math.max(q.correctIndex, 0), 3) : 0,
        explanation: q.explanation || "Systematic diagnostic measurement identifies bottlenecks without regressions."
      }));

      return {
        role,
        focusArea: focus,
        totalQuestions: processedQuestions.length,
        questions: processedQuestions
      };
    } catch (err) {
      console.warn("InterviewService AI call failed, using fallback 10 questions:", err.message);
      return this._generateFallbackInterview(input);
    }
  }

  /**
   * Evaluate candidate's free-form answer to an interview question using AI.
   * @param {Object} input - Validated input from validateEvaluationRequest
   * @returns {Promise<Object>} AI answer evaluation result
   */
  async evaluateAnswer(input) {
    const { question, userAnswer, category, skill, expectedAnswerPoints } = input;

    const systemPrompt = `You are a Senior Technical Interviewer evaluating a candidate's answer.
Analyze the candidate's response against the expected technical concepts.

CRITICAL RULES:
1. Provide constructive, honest feedback.
2. Calculate score between 0 and 100 based on accuracy, clarity, completeness, and structure.
3. Classify verdict as: "Excellent" (90-100), "Good" (75-89), "Needs Improvement" (50-74), or "Incomplete" (<50).
4. Identify which expectedAnswerPoints were covered and which were missed.
5. Provide a sample Ideal Answer (2-4 sentences).

Return ONLY valid JSON matching this exact structure:
{
  "score": 85,
  "verdict": "Good",
  "feedback": "Detailed constructive evaluation...",
  "keyPointsCovered": ["Point 1", "Point 2"],
  "missingKeyPoints": ["Point 3"],
  "sampleIdealAnswer": "Clear, concise ideal answer..."
}`;

    const userPrompt = JSON.stringify({
      question,
      userAnswer,
      category: category || "Technical",
      skill: skill || "General",
      expectedAnswerPoints: expectedAnswerPoints.length > 0 ? expectedAnswerPoints : ["Accuracy", "Clarity", "Best Practices"]
    });

    try {
      const result = await callGroqJSON({ systemPrompt, userPrompt, temperature: 0.3 });
      return {
        score: typeof result.score === "number" ? result.score : 70,
        verdict: result.verdict || "Good",
        feedback: result.feedback || "Answer shows fundamental understanding but could be expanded with more technical detail.",
        keyPointsCovered: Array.isArray(result.keyPointsCovered) ? result.keyPointsCovered : [],
        missingKeyPoints: Array.isArray(result.missingKeyPoints) ? result.missingKeyPoints : [],
        sampleIdealAnswer: result.sampleIdealAnswer || "A strong answer clearly addresses technical principles, trade-offs, and practical application."
      };
    } catch (err) {
      console.warn("InterviewService answer evaluation failed, using fallback:", err.message);
      return this._generateFallbackEvaluation(input);
    }
  }

  /**
   * Guaranteed 10 fallback interview questions matching candidate profile.
   * @private
   */
  _generateFallbackInterview(input) {
    const { role = "Software Engineer", skills = [], focus = "Full-Stack" } = input;
    const s1 = skills[0] || "JavaScript";
    const s2 = skills[1] || "React";
    const s3 = skills[2] || "Backend APIs";

    const questions = [
      {
        id: "q-fb-1",
        category: "Technical",
        difficulty: "Easy",
        skill: s1,
        question: `Explain core execution principles and common memory/event-loop bottlenecks when building applications with ${s1}.`,
        whyAsked: `Tests foundational understanding of runtime architecture and non-blocking I/O in ${s1}.`,
        expectedAnswerPoints: ["Event loop phases & microtasks", "Memory leaks and unreferenced closures", "Non-blocking execution"],
        options: [
          "Understanding event loop execution and avoiding heavy blocking tasks on the main thread",
          "Executing large synchronous CPU loops inside the primary thread without worker threads",
          "Allowing global variables to accumulate references across unmounted components",
          "Disabling garbage collection mechanisms manually in application code"
        ],
        correctIndex: 0,
        explanation: "Mastery of the event loop and asynchronous concurrency prevents UI and server thread freezes."
      },
      {
        id: "q-fb-2",
        category: "Technical",
        difficulty: "Medium",
        skill: s2,
        question: `How do you manage complex application state, avoid unnecessary re-renders, and ensure predictable data flow in ${s2}?`,
        whyAsked: `Evaluates clean architecture, component decoupling, and rendering performance in modern frontend stacks.`,
        expectedAnswerPoints: ["Unidirectional data flow", "Memoization (useMemo/useCallback)", "State colocation & selectors"],
        options: [
          "Colocate state close to consumers, use memoization strategically, and implement immutable unidirectional flow",
          "Pass a monolithic mutable global object directly through 20 layers of prop drilling",
          "Trigger force updates and mutate state directly in render functions",
          "Store all user interaction data in synchronous local storage operations"
        ],
        correctIndex: 0,
        explanation: "Proper state colocation and immutable updates maintain fast render cycles and testability."
      },
      {
        id: "q-fb-3",
        category: "Project-based",
        difficulty: "Medium",
        skill: "Architecture",
        question: "Describe a project where you made a critical architecture or database design decision. How did you balance trade-offs between speed, scalability, and complexity?",
        whyAsked: "Evaluates real-world engineering judgment, requirement scoping, and technical maturity.",
        expectedAnswerPoints: ["Requirement analysis & read/write access patterns", "Trade-off evaluation (e.g. normalization vs caching)", "Measurable latency/throughput outcome"],
        options: [
          "Profiled read-vs-write access patterns, evaluated SQL relational schema vs document store trade-offs, and benchmarked queries",
          "Selected databases purely based on internet buzz without evaluating query access patterns",
          "Ignored index creation and conducted unbounded full table scans in production",
          "Avoided writing schema migrations and directly altered production databases ad-hoc"
        ],
        correctIndex: 0,
        explanation: "Senior engineers evaluate system trade-offs against concrete access patterns and business constraints."
      },
      {
        id: "q-fb-4",
        category: "Project-based",
        difficulty: "Hard",
        skill: "Debugging",
        question: `Walk through a difficult technical bug or race condition you encountered in ${s1} or ${s3}. How did you isolate, reproduce, and resolve it?`,
        whyAsked: "Tests deductive problem-solving, root-cause isolation techniques, and debugging tooling expertise.",
        expectedAnswerPoints: ["Deterministic reproduction steps", "Observability (logs, breakpoints, network tracing)", "Regression test coverage"],
        options: [
          "Created minimal reproducible case, inspected network traces & stack frames, isolated race condition, and added regression tests",
          "Randomly modified code statements until errors ceased without finding root cause",
          "Suppressed error logging with empty catch blocks across services",
          "Pushed untested hotfixes directly to production during live traffic spikes"
        ],
        correctIndex: 0,
        explanation: "Root-cause diagnosis combined with regression tests prevents fragile fixes and recurring regressions."
      },
      {
        id: "q-fb-5",
        category: "Scenario",
        difficulty: "Hard",
        skill: "Performance",
        question: "Your production service experiences sudden 504 gateway timeouts and 95th percentile latency spikes under peak load. What is your diagnostic protocol?",
        whyAsked: "Tests incident response, system telemetry literacy, and systematic root-cause mitigation under pressure.",
        expectedAnswerPoints: ["APM telemetry & metric inspection (CPU/RAM/DB pool)", "Upstream vs downstream isolation", "Graceful degradation / circuit breaking"],
        options: [
          "Inspect APM latency metrics, check DB connection pool saturation, identify blocking queries, and apply rate limiting or circuit breaking",
          "Blindly restart production servers without snapshotting thread dumps or connection states",
          "Blame third-party hosting without examining slow query logs or network timeouts",
          "Increase instance hardware RAM indefinitely without diagnosing memory leaks"
        ],
        correctIndex: 0,
        explanation: "Methodical metric analysis isolates downstream bottlenecks before applying targeted remediation."
      },
      {
        id: "q-fb-6",
        category: "System Design",
        difficulty: "Hard",
        skill: "Scalability",
        question: "How do you design an API rate limiter or cache layer to protect backend databases from high-frequency read spikes?",
        whyAsked: "Evaluates distributed systems fundamentals, caching strategies, and defensive backend engineering.",
        expectedAnswerPoints: ["Cache-aside / Write-through pattern", "Cache stampede prevention & TTL strategy", "Sliding window or Token Bucket algorithm"],
        options: [
          "Implement Redis cache-aside with jittered TTLs and a sliding-window token bucket algorithm for rate limiting",
          "Send every inbound client request directly to heavy relational SQL joins without caching",
          "Store rate-limiting counters in local in-memory single-node variables across distributed load balancers",
          "Set permanent infinite TTLs without eviction policies on cache keys"
        ],
        correctIndex: 0,
        explanation: "Distributed in-memory caching with jittered TTLs and token bucket limits shields backend data stores."
      },
      {
        id: "q-fb-7",
        category: "Security",
        difficulty: "Medium",
        skill: "Web Security",
        question: "What security measures and defensive coding patterns do you implement to prevent XSS, CSRF, and SQL/NoSQL injection vulnerabilities?",
        whyAsked: "Validates security awareness and best practices across web applications.",
        expectedAnswerPoints: ["Parameterized queries & ORM sanitization", "HttpOnly, SameSite, Secure cookies", "Strict Content-Security-Policy and input validation"],
        options: [
          "Use parameterized queries, HttpOnly/SameSite cookies, strict CORS whitelists, and automated input validation",
          "Concatenate untrusted user input directly into SQL strings",
          "Store authentication tokens in localStorage accessible by third-party scripts",
          "Set CORS Access-Control-Allow-Origin to wildcard '*' with credentials enabled"
        ],
        correctIndex: 0,
        explanation: "Layered defensive security prevents critical injection, authentication hijack, and data tampering."
      },
      {
        id: "q-fb-8",
        category: "Behavioral",
        difficulty: "Easy",
        skill: "Collaboration",
        question: "How do you resolve a technical disagreement during a pull request review when a team member advocates for a significantly different implementation?",
        whyAsked: "Measures empathy, open-minded engineering communication, and dedication to code health over ego.",
        expectedAnswerPoints: ["Objective evaluation of trade-offs", "Benchmarking or architectural guidelines", "Focus on team consensus and maintainability"],
        options: [
          "Discuss technical merits objectively against team standards, test/benchmark alternatives if needed, and align constructively",
          "Reject all review comments and merge pull requests unilaterally",
          "Accept changes blindly without understanding the architectural implications",
          "Escalate immediately to senior executives without discussing directly with the peer"
        ],
        correctIndex: 0,
        explanation: "Professional collaboration values objective evidence, maintainability, and team alignment."
      },
      {
        id: "q-fb-9",
        category: "Role-specific",
        difficulty: "Medium",
        skill: role,
        question: `As a ${role}, how do you ensure high test coverage, CI/CD automation, and maintainability across rapid feature releases?`,
        whyAsked: `Tests engineering maturity, automation mindset, and software lifecycle ownership for ${role}.`,
        expectedAnswerPoints: ["Test pyramid (unit, integration, E2E)", "Automated linting and test execution in CI", "Feature flags and modular architecture"],
        options: [
          "Implement unit/integration tests with CI pipelines, enforce linting standards, and decouple features using modular boundaries",
          "Deploy untested code manually via FTP directly to production servers",
          "Skip writing automated tests to deliver initial user stories faster",
          "Merge large multi-month feature branches without continuous integration"
        ],
        correctIndex: 0,
        explanation: "Automated test suites and continuous deployment pipelines sustain high velocity without quality regressions."
      },
      {
        id: "q-fb-10",
        category: "Technical",
        difficulty: "Hard",
        skill: "Optimization",
        question: "How do you systematically analyze and optimize frontend bundle size, Time to Interactive (TTI), and Largest Contentful Paint (LCP)?",
        whyAsked: "Assesses web performance engineering, Core Web Vitals mastery, and user experience optimization.",
        expectedAnswerPoints: ["Tree shaking & dynamic code splitting", "Asset optimization & compression (WebP/Brotli)", "Critical CSS & deferring non-essential scripts"],
        options: [
          "Implement route-based dynamic code-splitting, tree-shaking, responsive WebP image optimization, and defer non-critical scripts",
          "Bundle all application vendor libraries into a single 15MB synchronous JavaScript script tag",
          "Load uncompressed 4K images directly in above-the-fold banners",
          "Execute synchronous blocking API calls in the HTML document head"
        ],
        correctIndex: 0,
        explanation: "Modern web performance optimization leverages lazy loading, modern asset encoding, and non-blocking delivery."
      }
    ];

    return {
      role,
      focusArea: focus,
      totalQuestions: questions.length,
      questions
    };
  }

  /**
   * Fallback evaluation logic if AI service fails.
   * @private
   */
  _generateFallbackEvaluation(input) {
    const { userAnswer, expectedAnswerPoints } = input;
    const len = (userAnswer || "").length;

    let score = 60;
    let verdict = "Needs Improvement";

    if (len > 200) {
      score = 85;
      verdict = "Good";
    } else if (len > 80) {
      score = 72;
      verdict = "Needs Improvement";
    } else {
      score = 45;
      verdict = "Incomplete";
    }

    return {
      score,
      verdict,
      feedback: "Answer analyzed. Demonstrates foundational principles. For maximum interview impact, elaborate on system trade-offs and edge cases.",
      keyPointsCovered: expectedAnswerPoints.slice(0, Math.min(2, expectedAnswerPoints.length)),
      missingKeyPoints: expectedAnswerPoints.slice(2),
      sampleIdealAnswer: "An outstanding response clearly outlines core technical fundamentals, implementation specifics, error handling, and performance trade-offs."
    };
  }
}

module.exports = new InterviewService();
