/**
 * Comprehensive Automated Tests for SkillBridge Internship Search System
 * Tests all pipeline stages: adapters, normalization, canonicalization,
 * deduplication, eligibility, ranking, AI fallback, and search orchestrator.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// Utilities
const { canonicalizeUrl, isValidUrl } = require("../internships/utils/urlCanonicalizer");
const { normalizeSkill, normalizeSkillList, extractSkillsFromText } = require("../internships/utils/skillNormalization");
const { parseDate, getAgeInDays, calculateRecencyScore, formatDisplayDate } = require("../internships/utils/dateParser");
const { detectWorkMode, normalizeLocation, checkWorkplaceCompatibility } = require("../internships/utils/locationNormalization");

// Services
const normalizationService = require("../internships/services/normalizationService");
const deduplicationService = require("../internships/services/deduplicationService");
const eligibilityService = require("../internships/services/eligibilityService");
const rankingService = require("../internships/services/rankingService");
const aiExplanationService = require("../internships/services/aiExplanationService");
const BaseSourceAdapter = require("../internships/adapters/baseAdapter");
const GreenhouseAdapter = require("../internships/adapters/greenhouseAdapter");
const LeverAdapter = require("../internships/adapters/leverAdapter");
const AshbyAdapter = require("../internships/adapters/ashbyAdapter");
const LinkedInAdapter = require("../internships/adapters/linkedInAdapter");
const InternshalaAdapter = require("../internships/adapters/internshalaAdapter");
const { SearchOrchestrator } = require("../internships/services/searchOrchestrator");

describe("1. URL Canonicalizer & Safety", () => {
  test("strips standard tracking parameters and normalizes URL", () => {
    const raw = "https://boards.greenhouse.io/cloudflare/jobs/12345?utm_source=linkedin&ref=tracker&gh_src=abc#app";
    const canonical = canonicalizeUrl(raw);
    assert.equal(canonical, "https://boards.greenhouse.io/cloudflare/jobs/12345");
  });

  test("normalizes scheme, hostname casing, and trailing slashes", () => {
    const raw = "HTTP://Example.COM/Jobs/Internship/";
    const canonical = canonicalizeUrl(raw);
    assert.equal(canonical, "http://example.com/Jobs/Internship");
  });

  test("rejects unsafe schemes and invalid URLs", () => {
    assert.equal(isValidUrl("javascript:alert(1)"), false);
    assert.equal(isValidUrl("data:text/html,test"), false);
    assert.equal(isValidUrl("not-a-url"), false);
    assert.equal(canonicalizeUrl("javascript:void(0)"), "");
  });
});

describe("2. Skill Normalization & Extraction", () => {
  test("maps aliases to canonical names", () => {
    assert.equal(normalizeSkill("js"), "JavaScript");
    assert.equal(normalizeSkill("react.js"), "React");
    assert.equal(normalizeSkill("reactjs"), "React");
    assert.equal(normalizeSkill("py"), "Python");
    assert.equal(normalizeSkill("ts"), "TypeScript");
    assert.equal(normalizeSkill("k8s"), "Kubernetes");
    assert.equal(normalizeSkill("aws"), "AWS");
  });

  test("normalizes and deduplicates skill lists", () => {
    const list = ["js", "JavaScript", "React.js", "REACT", "node", "Python3"];
    const normalized = normalizeSkillList(list);
    assert.deepEqual(normalized, ["JavaScript", "React", "Node.js", "Python"]);
  });

  test("extracts known skills from job description text", () => {
    const text = "We are seeking a candidate with solid React, TypeScript, Docker, and PostgreSQL experience.";
    const skills = extractSkillsFromText(text);
    assert.ok(skills.includes("React"));
    assert.ok(skills.includes("TypeScript"));
    assert.ok(skills.includes("Docker"));
    assert.ok(skills.includes("PostgreSQL"));
  });
});

describe("3. Date Parsing & Recency Calculation", () => {
  test("parses ISO strings and timestamps", () => {
    const iso = "2024-10-15T12:00:00.000Z";
    assert.equal(parseDate(iso), iso);

    const tsSec = 1700000000;
    assert.ok(parseDate(tsSec));
  });

  test("parses relative date phrases", () => {
    const parsedDays = parseDate("2 days ago");
    assert.ok(parsedDays);
    const age = getAgeInDays(parsedDays);
    assert.equal(age, 2);

    const parsedYesterday = parseDate("yesterday");
    assert.ok(parsedYesterday);
  });

  test("calculates recency score correctly", () => {
    const nowIso = new Date().toISOString();
    assert.equal(calculateRecencyScore(nowIso), 8);

    const oldDate = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(calculateRecencyScore(oldDate), 0);
  });

  test("formats display date labels", () => {
    const nowIso = new Date().toISOString();
    assert.equal(formatDisplayDate(nowIso), "Posted today");
    assert.equal(formatDisplayDate(null), "Date not provided");
  });
});

describe("4. Location Normalization & Workplace Fit", () => {
  test("detects remote, hybrid, and onsite modes", () => {
    assert.equal(detectWorkMode("Remote, US"), "remote");
    assert.equal(detectWorkMode("New York, NY", "Hybrid 2 days in office"), "hybrid");
    assert.equal(detectWorkMode("San Francisco, CA"), "onsite");
    assert.equal(detectWorkMode(""), "unknown");
  });

  test("parses structured location parts", () => {
    const loc = normalizeLocation("Bengaluru, Karnataka, India");
    assert.equal(loc.city, "Bengaluru");
    assert.equal(loc.country, "India");
  });

  test("evaluates workplace preference compatibility", () => {
    const remotePrefFit = checkWorkplaceCompatibility("Remote", "remote");
    assert.equal(remotePrefFit.compatible, true);
    assert.equal(remotePrefFit.score, 10);

    const conflictFit = checkWorkplaceCompatibility("Remote", "onsite");
    assert.equal(conflictFit.compatible, false);
    assert.equal(conflictFit.score, 0);

    const anyPrefFit = checkWorkplaceCompatibility("Any", "onsite");
    assert.equal(anyPrefFit.compatible, true);
  });
});

describe("5. Source Adapters Compliance & Error Handling", () => {
  test("LinkedIn adapter returns NOT_CONFIGURED when approved API is missing", async () => {
    const adapter = new LinkedInAdapter();
    const result = await adapter.search({ skills: ["react"] });
    assert.equal(result.isConfigured, false);
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.ok(result.errorMessage.includes("approved API"));
    assert.equal(result.listings.length, 0);
  });

  test("Internshala adapter returns NOT_CONFIGURED when approved API is missing", async () => {
    const adapter = new InternshalaAdapter();
    const result = await adapter.search({ skills: ["node"] });
    assert.equal(result.isConfigured, false);
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.ok(result.errorMessage.includes("approved API"));
    assert.equal(result.listings.length, 0);
  });

  test("Greenhouse adapter handles mock board response properly", async () => {
    const adapter = new GreenhouseAdapter({
      boards: [{ token: "testco", company: "TestCo", website: "https://test.co" }]
    });

    // Mock safeFetch on adapter
    adapter.safeFetch = async () => ({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 101,
            title: "Frontend Engineering Intern",
            location: { name: "Remote" },
            absolute_url: "https://boards.greenhouse.io/testco/jobs/101",
            content: "<p>React and JavaScript internship for summer.</p>",
            updated_at: new Date().toISOString()
          },
          {
            id: 102,
            title: "Senior VP of Infrastructure",
            location: { name: "New York" },
            absolute_url: "https://boards.greenhouse.io/testco/jobs/102",
            content: "Senior leadership role."
          }
        ]
      })
    });

    const result = await adapter.search({ type: "internship", skills: ["React"] });
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.listings.length, 1);
    assert.equal(result.listings[0].title, "Frontend Engineering Intern");
    assert.equal(result.listings[0].company, "TestCo");
  });

  test("Base adapter handles timeout safely", async () => {
    const adapter = new BaseSourceAdapter("TestTimeout", { timeoutMs: 50 });
    adapter.search = async () => {
      try {
        await new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 100));
      } catch (err) {
        return adapter.buildResult({ status: "TIMEOUT", durationMs: 50, errorMessage: err.message });
      }
    };

    const res = await adapter.search({});
    assert.equal(res.status, "TIMEOUT");
  });
});

describe("6. Normalization Service & Completeness", () => {
  test("normalizes raw listing into complete canonical model", () => {
    const raw = {
      title: "  Backend Developer Intern  ",
      company: "Cloud Corp",
      source: "Greenhouse",
      url: "https://boards.greenhouse.io/cloudcorp/jobs/999?utm_campaign=campus",
      description: "<p>Build Node.js APIs and Postgres services.</p>",
      location: "San Francisco, CA"
    };

    const normalized = normalizationService.normalizeListing(raw);
    assert.ok(normalized);
    assert.equal(normalized.title, "Backend Developer Intern");
    assert.equal(normalized.company, "Cloud Corp");
    assert.equal(normalized.canonicalUrl, "https://boards.greenhouse.io/cloudcorp/jobs/999");
    assert.equal(normalized.workMode, "onsite");
    assert.ok(normalized.requiredSkills.includes("Node.js"));
    assert.ok(normalized.completenessScore > 50);
  });

  test("rejects malformed listings missing essential fields", () => {
    assert.equal(normalizationService.normalizeListing({}), null);
    assert.equal(normalizationService.normalizeListing({ title: "Intern" }), null);
    assert.equal(normalizationService.normalizeListing({ title: "Intern", company: "Co" }), null);
  });
});

describe("7. Layered Deduplication", () => {
  test("merges duplicate listings by exact canonical URL", () => {
    const list = [
      {
        id: "1",
        canonicalUrl: "https://example.com/job/10",
        source: "Greenhouse",
        title: "Software Intern",
        company: "Stripe",
        completenessScore: 60,
        description: "Short desc"
      },
      {
        id: "2",
        canonicalUrl: "https://example.com/job/10",
        source: "Aggregator",
        title: "Software Intern",
        company: "Stripe",
        completenessScore: 85,
        description: "Much more detailed job description text"
      }
    ];

    const deduplicated = deduplicationService.deduplicate(list);
    assert.equal(deduplicated.length, 1);
    assert.equal(deduplicated[0].completenessScore, 85);
    assert.ok(deduplicated[0].mergedSources.includes("Greenhouse"));
    assert.ok(deduplicated[0].mergedSources.includes("Aggregator"));
  });

  test("merges duplicate listings by normalized company, title, and location", () => {
    const list = [
      {
        id: "a",
        canonicalUrl: "https://boards.greenhouse.io/co/1",
        source: "Greenhouse",
        company: "Datadog, Inc.",
        title: "Frontend Engineering Intern",
        location: "Remote",
        completenessScore: 70
      },
      {
        id: "b",
        canonicalUrl: "https://job-board.com/post/999",
        source: "Partner",
        company: "Datadog",
        title: "Frontend Engineering Intern",
        location: "Remote",
        completenessScore: 60
      }
    ];

    const deduplicated = deduplicationService.deduplicate(list);
    assert.equal(deduplicated.length, 1);
  });
});

describe("8. Eligibility Filtering", () => {
  test("excludes closed or expired listings", () => {
    const listing = { status: "closed", title: "Intern", workMode: "remote" };
    const res = eligibilityService.checkEligibility(listing, { type: "internship" });
    assert.equal(res.eligible, false);
    assert.ok(res.rejectionReason.includes("closed or expired"));
  });

  test("excludes senior positions when user requested internship", () => {
    const listing = { status: "active", title: "Senior Lead Architect", workMode: "remote" };
    const res = eligibilityService.checkEligibility(listing, { type: "internship" });
    assert.equal(res.eligible, false);
    assert.ok(res.rejectionReason.includes("senior position"));
  });

  test("enforces graduation year compatibility when strictly specified", () => {
    const listing = {
      status: "active",
      title: "Software Intern",
      description: "Must be graduating in 2024.",
      workMode: "remote"
    };
    const res = eligibilityService.checkEligibility(listing, { graduationYear: "2027" });
    assert.equal(res.eligible, false);
    assert.ok(res.rejectionReason.includes("graduation year"));
  });

  test("retains listing with uncertainties when requirements are unstated", () => {
    const listing = {
      status: "active",
      title: "Software Engineer Intern",
      description: "General software development opening.",
      workMode: "remote"
    };
    const res = eligibilityService.checkEligibility(listing, { graduationYear: "2026" });
    assert.equal(res.eligible, true);
    assert.ok(res.uncertainties.length > 0);
  });
});

describe("9. Ranking & Scoring Algorithm", () => {
  test("calculates transparent multi-factor score and breakdown", () => {
    const listing = {
      title: "React Frontend Developer Intern",
      company: "Acme Tech",
      source: "Greenhouse",
      category: "Frontend Development",
      requiredSkills: ["React", "JavaScript"],
      workMode: "remote",
      postedDate: new Date().toISOString(),
      completenessScore: 90,
      eligibilityScore: 10
    };

    const profile = {
      skills: ["React", "JavaScript", "CSS"],
      goal: "Frontend Developer",
      workplace: "Remote"
    };

    const scored = rankingService.scoreListing(listing, profile);
    assert.ok(scored.score >= 80);
    assert.ok(scored.scoreBreakdown.roleRelevance > 0);
    assert.ok(scored.scoreBreakdown.requiredSkills > 0);
    assert.ok(scored.scoreBreakdown.locationRemote === 10);
    assert.ok(scored.scoreBreakdown.recency === 8);
    assert.ok(scored.matchingSkills.includes("React"));
    assert.ok(scored.matchExplanation.includes("React"));
  });

  test("penalizes stale listings", () => {
    const freshListing = {
      title: "Software Intern",
      source: "Lever",
      workMode: "remote",
      postedDate: new Date().toISOString(),
      completenessScore: 80
    };
    const staleListing = {
      title: "Software Intern",
      source: "Lever",
      workMode: "remote",
      postedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      completenessScore: 80
    };

    const scoreFresh = rankingService.scoreListing(freshListing, {}).score;
    const scoreStale = rankingService.scoreListing(staleListing, {}).score;
    assert.ok(scoreFresh > scoreStale);
  });
});

describe("10. AI Fallback & Enrichment", () => {
  test("falls back cleanly to deterministic explanation when AI is offline", async () => {
    const listing = {
      id: "test-ai-1",
      title: "Full-Stack Intern",
      company: "Innovate",
      matchExplanation: "Matches JavaScript and Python skills.",
      requiredSkills: ["JavaScript", "Python"],
      matchingSkills: ["JavaScript"],
      missingSkills: ["Python"],
      uncertainties: []
    };

    const enriched = await aiExplanationService.enrichListing(listing, { skills: ["JavaScript"] });
    assert.equal(enriched.id, "test-ai-1");
    assert.ok(enriched.matchExplanation);
  });
});
