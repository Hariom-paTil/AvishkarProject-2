/**
 * Verification & Deep Research Test Suite
 * Validates:
 * 1. Multi-angle query generation (queryBuilder)
 * 2. Deep verification process (spam rejection, closure detection, status assignment)
 * 3. Mandatory skill & location hard filters (eligibilityService)
 * 4. Transparent, honest match explanations (rankingService)
 * 5. Quality tier bucketing & threshold alerts (searchOrchestrator)
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const queryBuilder = require("../internships/services/queryBuilder");
const verificationService = require("../internships/services/verificationService");
const eligibilityService = require("../internships/services/eligibilityService");
const rankingService = require("../internships/services/rankingService");
const searchOrchestrator = require("../internships/services/searchOrchestrator");
const { createNormalizedListing, VerificationStatus } = require("../internships/types/internshipTypes");

describe("1. Deep Research Query Generation (queryBuilder)", () => {
  it("generates varied search queries based on target role, skills, location, and graduation year", () => {
    const profile = {
      type: "internship",
      goal: "Frontend Developer",
      skills: ["React", "TypeScript", "Tailwind CSS"],
      workplace: "Remote",
      location: "India",
      graduationYear: "2026",
      education: "B.Tech Computer Science"
    };

    const plan = queryBuilder.buildResearchPlan(profile);
    assert.ok(plan, "Must generate research plan");
    assert.ok(Array.isArray(plan.queryVariations), "Must have query variations array");
    assert.ok(plan.queryVariations.length >= 3, `Expected at least 3 query variations, got ${plan.queryVariations.length}`);

    // Check variations cover role, skills, remote, and graduation
    const queryTexts = plan.queryVariations.map(q => q.text.toLowerCase());
    assert.ok(queryTexts.some(t => t.includes("frontend developer")));
    assert.ok(queryTexts.some(t => t.includes("react")));
    assert.ok(queryTexts.some(t => t.includes("remote")));
    assert.ok(queryTexts.some(t => t.includes("2026") || t.includes("intern")));
  });

  it("extracts graduation year and infers category accurately", () => {
    const plan = queryBuilder.buildResearchPlan({
      goal: "Full Stack Engineer",
      skills: ["React", "Node.js"],
      batch: "Class of 2026"
    });

    assert.strictEqual(plan.graduationYear, 2026);
    assert.strictEqual(plan.category, "Full-Stack Engineering");
  });
});

describe("2. Deep Verification Process (verificationService)", () => {
  it("rejects listings with placeholder/spam company names", async () => {
    const spamListing = createNormalizedListing({
      title: "Software Engineering Intern",
      company: "Confidential Company",
      sourceListingUrl: "https://example.com/job1",
      directApplyUrl: "https://example.com/apply1"
    });

    const res = await verificationService.verifyListing(spamListing, { checkLiveUrl: false });
    assert.strictEqual(res.valid, false);
    assert.ok(res.rejectionReason.includes("placeholder company"));
  });

  it("rejects listings with closed or expired markers", async () => {
    const closedListing = createNormalizedListing({
      title: "Backend Intern (Closed - No Longer Accepting Applications)",
      company: "Acme Corp",
      sourceListingUrl: "https://example.com/job2",
      directApplyUrl: "https://example.com/apply2"
    });

    const res = await verificationService.verifyListing(closedListing, { checkLiveUrl: false });
    assert.strictEqual(res.valid, false);
    assert.ok(res.rejectionReason.includes("closure marker"));
  });

  it("rejects non-internship senior roles masquerading as internships", async () => {
    const seniorJob = createNormalizedListing({
      title: "Senior Lead Staff Architect - Intern Mentor",
      company: "Tech Giant",
      sourceListingUrl: "https://example.com/job3",
      directApplyUrl: "https://example.com/apply3"
    });

    const res = await verificationService.verifyListing(seniorJob, { checkLiveUrl: false });
    assert.strictEqual(res.valid, false);
    assert.ok(res.rejectionReason.includes("senior position"));
  });

  it("assigns VERIFIED to genuine company board listing with complete details", async () => {
    const genuineListing = createNormalizedListing({
      title: "Software Engineer Intern - Summer 2026",
      company: "Stripe",
      source: "Greenhouse",
      sourceListingUrl: "https://boards.greenhouse.io/stripe/jobs/12345",
      directApplyUrl: "https://boards.greenhouse.io/stripe/jobs/12345#apply",
      postedDate: "2026-03-01T10:00:00.000Z",
      stipend: "$45/hr",
      deadline: "2026-05-01",
      startDate: "June 2026",
      duration: "12 weeks"
    });

    const verified = await verificationService.verifyListing(genuineListing, { checkLiveUrl: false });
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.verificationStatus, VerificationStatus.VERIFIED);
    assert.strictEqual(verified.isVerified, true);
  });

  it("assigns NEEDS_CONFIRMATION when important information like deadline or stipend is missing", async () => {
    const partialListing = createNormalizedListing({
      title: "Web Developer Intern",
      company: "Startup Co",
      source: "Greenhouse",
      sourceListingUrl: "https://boards.greenhouse.io/startup/jobs/99",
      directApplyUrl: "https://boards.greenhouse.io/startup/jobs/99",
      postedDate: "2026-03-01T10:00:00.000Z",
      stipend: "Not disclosed",
      deadline: "Open until filled"
    });

    const verified = await verificationService.verifyListing(partialListing, { isLiveActive: false });
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.verificationStatus, VerificationStatus.NEEDS_CONFIRMATION);
  });
});

describe("3. Hard Eligibility & Matching Constraints (eligibilityService)", () => {
  it("rejects listing when candidate lacks all mandatory skills", () => {
    const listing = createNormalizedListing({
      title: "iOS Intern",
      company: "Mobile Labs",
      requiredSkills: ["Swift", "Objective-C", "iOS SDK"],
      sourceListingUrl: "https://example.com/ios",
      directApplyUrl: "https://example.com/ios"
    });

    const userProfile = {
      skills: ["React", "Node.js", "Python"],
      workplace: "Any"
    };

    const result = eligibilityService.checkEligibility(listing, userProfile);
    assert.strictEqual(result.eligible, false);
    assert.ok(result.rejectionReason.includes("Mandatory skills missing"));
  });

  it("rejects explicit onsite country conflict", () => {
    const listing = createNormalizedListing({
      title: "Robotics Intern",
      company: "Munich Robotics",
      workMode: "onsite",
      location: "Munich, Germany",
      country: "Germany",
      sourceListingUrl: "https://example.com/robotics",
      directApplyUrl: "https://example.com/robotics"
    });

    const userProfile = {
      skills: ["Robotics", "Python"],
      workplace: "Onsite",
      location: "Bengaluru, India"
    };

    const result = eligibilityService.checkEligibility(listing, userProfile);
    assert.strictEqual(result.eligible, false);
    assert.ok(result.rejectionReason.includes("Location conflict"));
  });
});

describe("4. Honest Match Explanations & Ranking Priorities (rankingService)", () => {
  it("never outputs 'perfect match' and transparently states missing requirements and uncertainties", () => {
    const listing = createNormalizedListing({
      title: "Frontend Engineer Intern",
      company: "Figma",
      source: "Greenhouse",
      verificationStatus: VerificationStatus.VERIFIED,
      isVerified: true,
      workMode: "remote",
      requiredSkills: ["React", "TypeScript", "CSS"],
      preferredSkills: ["GraphQL", "Rust"],
      sourceListingUrl: "https://boards.greenhouse.io/figma/jobs/999",
      directApplyUrl: "https://boards.greenhouse.io/figma/jobs/999"
    });

    const userProfile = {
      role: "Frontend Engineer",
      skills: ["React", "TypeScript", "Tailwind CSS"],
      workplace: "Remote"
    };

    const ranked = rankingService.rank([listing], userProfile);
    const top = ranked[0];

    assert.ok(top);
    assert.ok(!top.matchExplanation.toLowerCase().includes("perfect match"), "Must not claim perfect match");
    assert.ok(top.matchExplanation.includes("Verified on the Figma career page"));
    assert.ok(top.matchExplanation.includes("React"));
    assert.ok(top.matchExplanation.includes("GraphQL") || top.missingSkills.includes("GraphQL"));
    assert.strictEqual(top.verificationStatus, VerificationStatus.VERIFIED);
  });
});

describe("5. Quality Tier Bucketing & Threshold Alert (searchOrchestrator)", () => {
  it("buckets results into Best Verified, Other Relevant, and Needs Confirmation sections", async () => {
    const profile = {
      type: "internship",
      goal: "Software Engineering Intern",
      skills: ["JavaScript", "Python"],
      workplace: "Remote"
    };

    const result = await searchOrchestrator.search(profile, { bypassCache: true });

    assert.ok(result.sections, "Must contain sections object");
    assert.ok(Array.isArray(result.sections.bestVerified), "bestVerified must be array");
    assert.ok(Array.isArray(result.sections.otherRelevant), "otherRelevant must be array");
    assert.ok(Array.isArray(result.sections.needsConfirmation), "needsConfirmation must be array");

    assert.strictEqual(
      result.results.length,
      result.sections.bestVerified.length + result.sections.otherRelevant.length + result.sections.needsConfirmation.length,
      "Sum of section counts should equal total results"
    );

    // If verified count is limited, a qualityNote should be present
    if (result.sections.bestVerified.length <= 3) {
      assert.ok(typeof result.qualityNote === "string" && result.qualityNote.length > 0);
    }
  });
});
