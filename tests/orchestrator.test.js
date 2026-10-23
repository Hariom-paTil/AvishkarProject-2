/**
 * Search Orchestrator and API Integration Tests
 * Tests multi-source parallel execution, partial failures,
 * caching, and response contracts.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const BaseSourceAdapter = require("../internships/adapters/baseAdapter");
const searchOrchestrator = require("../internships/services/searchOrchestrator");
const dataStore = require("../internships/storage/dataStore");
const internshipService = require("../services/internshipService");

class MockWorkingAdapter extends BaseSourceAdapter {
  constructor(name, listings) {
    super(name);
    this.mockListings = listings;
  }
  async search(query) {
    return this.buildResult({
      status: "SUCCESS",
      durationMs: 45,
      listings: this.mockListings
    });
  }
}

class MockFailingAdapter extends BaseSourceAdapter {
  constructor(name) {
    super(name);
  }
  async search() {
    throw new Error("Simulated upstream network failure");
  }
}

describe("Search Orchestrator & API Integration", () => {
  test("aggregates results and tolerates partial source failures", async () => {
    const workingAdapter = new MockWorkingAdapter("GreenhouseMock", [
      {
        title: "Frontend Engineering Intern",
        company: "Stripe",
        source: "Greenhouse",
        url: "https://boards.greenhouse.io/stripe/jobs/881",
        description: "React and TypeScript internship",
        location: "Remote"
      },
      {
        title: "Backend Engineer Intern",
        company: "Cloudflare",
        source: "Greenhouse",
        url: "https://boards.greenhouse.io/cloudflare/jobs/882",
        description: "Node.js and Go internship",
        location: "San Francisco, CA"
      }
    ]);

    const failingAdapter = new MockFailingAdapter("FailingSourceMock");

    // Instantiating with mock adapters
    const { SearchOrchestrator } = require("../internships/services/searchOrchestrator").constructor.name === "SearchOrchestrator"
      ? { SearchOrchestrator: searchOrchestrator.constructor }
      : { SearchOrchestrator: searchOrchestrator.constructor };

    const customOrchestrator = new SearchOrchestrator([workingAdapter, failingAdapter]);

    const response = await customOrchestrator.search({
      type: "internship",
      skills: ["React"],
      workplace: "Any"
    }, { forceLive: true });

    assert.ok(response);
    assert.equal(typeof response.totalCount, "number");
    assert.ok(response.totalCount >= 1);
    assert.equal(response.sourceStatuses.GreenhouseMock.status, "SUCCESS");
    assert.equal(response.sourceStatuses.FailingSourceMock.status, "ERROR");
    assert.equal(response.isCached, false);
    assert.ok(response.searchDurationMs >= 0);
  });

  test("returns cached response on repeated identical query within TTL", async () => {
    const query = {
      type: "internship",
      skills: ["Node.js"],
      goal: "Backend Developer",
      workplace: "Any"
    };

    const first = await searchOrchestrator.search(query, { forceLive: true });
    assert.equal(first.isCached, false);

    const second = await searchOrchestrator.search(query, { forceLive: false });
    assert.equal(second.isCached, true);
    assert.ok(second.cachedAt);
  });

  test("internshipService wraps search results and generates research URLs", async () => {
    const serviceRes = await internshipService.searchOpportunities({
      type: "internship",
      skills: ["React", "TypeScript"],
      goal: "Frontend Intern",
      workplace: "Remote"
    });

    assert.ok(serviceRes);
    assert.ok(Array.isArray(serviceRes.opportunities));
    assert.equal(typeof serviceRes.opportunitiesCount, "number");
    assert.ok(serviceRes.sourceStatuses);

    // Verify search URLs generator
    const urls = internshipService.generateSearchUrls("React Developer", "Remote", "internship");
    assert.ok(urls.linkedIn.includes("linkedin.com"));
    assert.ok(urls.googleJobs.includes("google.com"));
  });

  test("dataStore handles bookmark saving and persistence", () => {
    const testEmail = "testuser@skillbridge.ai";
    const testId = "opp-test-1234";

    // Save listing
    const saveRes = dataStore.toggleSavedInternship(testEmail, testId);
    assert.equal(saveRes.saved, true);

    // Unsave listing
    const unsaveRes = dataStore.toggleSavedInternship(testEmail, testId);
    assert.equal(unsaveRes.saved, false);
  });
});
