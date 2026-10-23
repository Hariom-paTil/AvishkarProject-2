# SkillBridge AI — Project Architecture & Developer Guide

> **IMPORTANT NOTICE FOR FUTURE DEVELOPERS:**  
> Please read this document **first** before making any architectural or code changes to SkillBridge AI. After reading this guide, inspect the specific relevant files indicated in each section.

---

## 1. Executive Summary & Purpose

**SkillBridge AI** is an intelligent, engineering-focused career accelerator platform designed for students and early-career software developers. It provides three primary career tools:
1. **Reliable Internship & Early-Career Job Search Pipeline:** Fetches verified, permitted listings directly from real company Applicant Tracking Systems (Greenhouse, Lever, Ashby) and permitted remote feeds, normalizes the data, deduplicates identical openings across sources, applies hard profile eligibility criteria, calculates a transparent multi-factor match score (0–100), and provides fact-based AI match explanations.
2. **Skill Gap Analyzer:** Audits a candidate's technical skills against real-world job roles and outputs an ATS-calibrated competency breakdown, per-skill gap audit, and a 14-day action roadmap.
3. **Interactive Mock Interviewer:** Generates categorized interview questions (Technical, Project-based, Scenario, Behavioral) with real-time scoring, "why asked" evaluation insights, and dynamic question generation.

---

## 2. Main User Flows

1. **Authentication Gate:**
   - Visitors access `/login.html` where secure credentials (configured via `ADMIN_EMAIL` and `ADMIN_PASSWORD`) are verified.
   - Successful authentication issues an `HttpOnly` signed session cookie (`sb_session`).
   - Unauthenticated access to application pages (`/index.html`, `/results.html`) or API routes redirects to `/login.html`.

2. **Internship & Job Search Flow:**
   - User inputs their technical skills, education background, career goals, graduation year/batch, workplace mode (Remote, Hybrid, On-site, Any), and optional location.
   - Alternatively, user uploads a resume image which is parsed using OCR / vision AI to automatically populate profile fields.
   - User submits the search, redirecting to `/results.html?type=internship` (or `job`).
   - The frontend calls `POST /api/internships/search`.
   - The backend runs the multi-source search pipeline, returning verified, deduplicated, and ranked listings.
   - The user interacts with the UI:
     - Real-time text search filter (title, company, skill).
     - Work mode filter (Remote, Hybrid, On-site).
     - Source platform filter (Greenhouse, Lever, Ashby, Remotive, or Saved).
     - Freshness filter (Past 3 days, 7 days, 30 days).
     - Sort order toggle (Best Match, Newest, Data Completeness).
     - Save / Bookmark listings (persisted in local storage and backend `/api/internships/save`).
     - Score breakdown accordion displaying points per factor.
     - Direct "Apply on Platform" link pointing to the authentic company ATS posting.

3. **Skill Gap Analysis Flow:**
   - Candidate inputs target role, seniority, education, and skills.
   - Calls `POST /api/skillgap/analyze`.
   - Displays ATS readiness score, per-skill breakdown, and actionable learning milestones.

4. **Technical Mock Interview Flow:**
   - User selects target role and focus area.
   - Calls `POST /api/interview/generate`.
   - Interactive quiz evaluates candidate answers, displaying "Why asked" insights and evaluating technical depth via `POST /api/interview/evaluate`.

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (HTML5 + Tailwind CSS + Vanilla JS) │
│   - index.html (Form entry, resume dropzone, feature tabs)       │
│   - results.html (Source status bar, filters, rich cards)       │
│   - script.js (Client state, filter engine, API integration)    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP / REST API (Cookies: sb_session)
┌───────────────────────────────▼─────────────────────────────────┐
│                    Backend Server (server.js)                    │
│   - Native Node.js HTTP server (zero heavy frameworks)          │
│   - Timing-safe authentication & session management             │
│   - Request validation (services/validators.js)                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  SkillGapService │  │ InterviewService │  │ InternshipService│
│  & ResumeService │  │ (Mock rounds)    │  │ (Search gateway) │
└──────────────────┘  └──────────────────┘  └─────────┬────────┘
                                                      │
┌─────────────────────────────────────────────────────▼───────────┐
│             Internship Search Pipeline (internships/)           │
│                                                                 │
│  User Profile & Query Builder                                   │
│        │                                                        │
│        ▼                                                        │
│  Source Adapters (Parallel execution, strict timeouts)         │
│   ├── GreenhouseAdapter (Public Boards API)                     │
│   ├── LeverAdapter (Public Postings API)                        │
│   ├── AshbyAdapter (Public Job Board API)                       │
│   ├── RemotiveAdapter (Public Remote Jobs API)                  │
│   ├── LinkedInAdapter (Approved Partner API only)               │
│   └── InternshalaAdapter (Approved Partner API only)            │
│        │                                                        │
│        ▼                                                        │
│  Normalization Service (internships/services/normalization.js)  │
│   - Strips HTML & collapses whitespace                          │
│   - Canonicalizes URLs (removes tracking parameters)            │
│   - Normalizes skills via controlled taxonomy                   │
│   - Normalizes location & detects work mode                     │
│   - Rejects malformed records                                   │
│        │                                                        │
│        ▼                                                        │
│  Layered Deduplication Service (deduplicationService.js)        │
│   - Layer 1: Canonical URL exact match                          │
│   - Layer 2: Source + External ID match                         │
│   - Layer 3: Normalized Company + Title + Location match        │
│   - Layer 4: Conservative fuzzy match & metadata merge          │
│        │                                                        │
│        ▼                                                        │
│  Hard Eligibility Filtering (eligibilityService.js)             │
│   - Role type verification (excludes non-intern roles)          │
│   - Excludes closed / expired listings                          │
│   - Remote / workplace preference conflict detection            │
│   - Graduation year & degree requirements verification          │
│   - Uncertainty tracking for unstated requirements              │
│        │                                                        │
│        ▼                                                        │
│  Transparent Weighted Ranking (rankingService.js)               │
│   - 8 configurable scoring factors (Max 100 points)             │
│   - Factual match explanation generation                        │
│        │                                                        │
│        ▼                                                        │
│  AI Match Explanation & Enrichment (aiExplanationService.js)    │
│   - Extracts structured facts with LLM schema validation        │
│   - Content hash caching & deterministic fallback               │
│        │                                                        │
│        ▼                                                        │
│  Data Store & Persistent Cache (internships/storage/dataStore)  │
│   - Indexed cache file (data/internships_cache.json)            │
│   - Saved bookmarks file (data/saved_internships.json)          │
│   - Source statuses (data/source_statuses.json)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Important Folders and Files

| Path | Purpose & Responsibility |
|---|---|
| `server.js` | Main entry point. Native HTTP server, session cookie management, routing for all `/api/*` endpoints, and static asset serving. |
| `script.js` | Frontend application script: form state handling, API calls, dynamic UI rendering, interactive filters, bookmarking, and mock quiz flow. |
| `index.html` | Home page containing hero, internship finder input form, skill gap form, interview launcher, and resume upload dropzone. |
| `results.html` | Analysis results page containing source status transparency dashboard, filter toolbar, opportunity cards, skill gap charts, and interview assessment. |
| `services/validators.js` | Request body validation and sanitization for all endpoints. |
| `services/internshipService.js` | Adapter gateway exposing high-level opportunity search and saved listing operations to `server.js`. |
| `services/aiClient.js` | Groq API wrapper with multi-model fallback, JSON schema extraction, timeouts, and error classification. |
| `services/skillGapService.js` | Evaluates technical deficiencies, ATS readiness benchmark, and 14-day study roadmaps. |
| `services/interviewService.js` | Generates categorized technical questions and evaluates candidate answers. |
| `services/resumeService.js` | OCR and resume parsing using Groq vision / Tesseract. |
| **`internships/`** | **Core modular internship search subsystem.** |
| `internships/types/internshipTypes.js` | Canonical data contract (`NormalizedInternship`), `WorkMode` and `SourceStatus` enums. |
| `internships/types/rankingConfig.js` | Centralized scoring weights and source reliability ratings. |
| `internships/utils/urlCanonicalizer.js` | Removes tracking query parameters, normalizes hostnames, and validates protocol safety. |
| `internships/utils/skillNormalization.js` | Controlled alias dictionary (100+ mappings, e.g., `js` -> `JavaScript`) and regex skill extraction. |
| `internships/utils/dateParser.js` | Parses ISO dates, epoch timestamps, relative strings ("2 days ago"), and computes recency scores. |
| `internships/utils/locationNormalization.js` | Detects work mode (`remote`, `hybrid`, `onsite`, `unknown`) and evaluates candidate preference compatibility. |
| `internships/utils/textCleanup.js` | HTML entity decoding, script/style tag removal, and whitespace collapsing. |
| `internships/adapters/baseAdapter.js` | Abstract adapter interface with safe fetch, timeouts, and standard result contract. |
| `internships/adapters/greenhouseAdapter.js` | Queries permitted public Greenhouse job boards (Cloudflare, GitHub, Stripe, Datadog, Reddit, Figma, GitLab, etc.). |
| `internships/adapters/leverAdapter.js` | Queries permitted public Lever postings (Spotify, Palantir, Automattic, Atlassian, Postman, Sourcegraph). |
| `internships/adapters/ashbyAdapter.js` | Queries permitted public Ashby job boards (Ramp, Retool, Linear, Sentry, OpenAI). |
| `internships/adapters/remotiveAdapter.js` | Queries Remotive remote developer API, filtering for internships/early-career roles. |
| `internships/adapters/linkedInAdapter.js` | Approved Partner API integration only. If unconfigured, cleanly returns `NOT_CONFIGURED`. |
| `internships/adapters/internshalaAdapter.js` | Approved Partner API integration only. If unconfigured, cleanly returns `NOT_CONFIGURED`. |
| `internships/adapters/index.js` | Adapter registry and factory. |
| `internships/services/queryBuilder.js` | Deep Research Query Builder: generates multi-angle query variations (role exact, primary tech skill, skill pairs, workplace preference, graduation year). |
| `internships/services/verificationService.js` | Deep Verification Engine: live HTTP reachability check, spam phrase filtering, closed/expired marker detection, and verification status assignment (`Verified`, `Recently discovered`, `Needs confirmation`). |
| `internships/services/normalizationService.js` | Transforms raw adapter results to standard schema and rejects malformed records. |
| `internships/services/deduplicationService.js` | 4-stage layered deduplication with intelligent metadata merging. |
| `internships/services/eligibilityService.js` | Hard eligibility filtering (mandatory skills, country conflicts, role type, status, location, graduation year, degree level). |
| `internships/services/rankingService.js` | Transparent weighted scoring algorithm prioritizing verified listings and generating honest, evidence-backed match explanations. |
| `internships/services/aiExplanationService.js` | Concise AI explanation enrichment with content-hash caching and deterministic fallback. |
| `internships/services/searchOrchestrator.js` | Coordinates end-to-end search pipeline with caching, concurrency control, verification batching, and 3-section quality tier bucketing. |
| `internships/storage/dataStore.js` | Persistent disk-backed JSON cache and user bookmark store. |
| `tests/internships.test.js` | Unit test suite covering utilities, adapters, normalization, deduplication, eligibility, and ranking. |
| `tests/orchestrator.test.js` | Integration test suite covering parallel source execution, partial failure tolerance, and caching. |
| `tests/verification.test.js` | Verification test suite covering multi-angle query generation, spam/closure detection, hard filters, honest explanations, and quality tier bucketing. |

---

## 5. The Full Internship Search Pipeline

The search system operates as a strict multi-stage deterministic pipeline where **accuracy is prioritized over result quantity**:

```
User Profile & Filters
       │
       ▼
[Stage 1: Deep Research Query Builder]
       │  Generates multi-angle query variations from profile:
       │  - Angle 1: Exact target role + intern qualifier
       │  - Angle 2: Primary tech skill + target role
       │  - Angle 3: Skill-pair combination
       │  - Angle 4: Workplace preference (e.g. Remote)
       │  - Angle 5: Graduation year / batch qualifier
       ▼
[Stage 2: Source Adapters (Parallel Execution)]
       │  Executes Greenhouse, Lever, Ashby, Remotive, LinkedIn*, Internshala*
       │  - Strict 7-second timeouts per source
       │  - Partial failure tolerance (one failing source does not crash search)
       ▼
[Stage 3: Normalization & Cleaning]
       │  - Strips HTML & collapses whitespace
       │  - Canonicalizes URLs (strips utm_*, ref, tracking IDs)
       │  - Normalizes technical skills using controlled dictionary
       │  - Parses posted dates and detects work mode (remote/hybrid/onsite)
       │  - Rejects malformed results (missing title, company, or application URL)
       ▼
[Stage 4: Layered Deduplication]
       │  Layer 1: Exact canonical application URL match
       │  Layer 2: Exact source + external listing ID match
       │  Layer 3: Exact normalized company + title + location match
       │  Layer 4: Conservative fuzzy match (company, title similarity >= 88%)
       │  -> Merges duplicates prioritizing direct company application pages
       ▼
[Stage 5: Deep Verification Process (verificationService.js)]
       │  - Live HTTP reachability check (HEAD / GET range request)
       │  - Rejects placeholder/spam company names ("Confidential", "Anonymous", etc.)
       │  - Rejects closed/expired listings ("no longer accepting applications", etc.)
       │  - Rejects senior roles masquerading as internships
       │  - Assigns Verification Status:
       │    * Verified: live ATS/career board checked and fully active
       │    * Recently discovered: source exists, active status recently detected
       │    * Needs confirmation: key info (deadline, eligibility, stipend) unstated
       ▼
[Stage 6: Hard Eligibility & Suitability Filtering]
       │  - Excludes roles where mandatory skills are clearly missing
       │  - Excludes explicit onsite country conflicts
       │  - Excludes non-internship / closed / expired listings
       │  - Validates graduation year requirements
       ▼
[Stage 7: Weighted Ranking & Honest Match Explanations]
       │  Priority 1: Verified and active internship (+10 bonus)
       │  Priority 2: Strong role match (avoids keyword stuffing)
       │  Priority 3: Required skill match
       │  Priority 4: Location / remote preference fit
       │  Priority 5: Explicit eligibility fit
       │  Priority 6: Recent listing
       │  Priority 7: Complete description and direct application link
       │  Honest Match Explanation:
       │  "Verified on [source]. Matches your [skills]. [Workplace]. [Missing skills]. [Eligibility notice]."
       ▼
[Stage 8: Quality Tier Bucketing & Threshold Alerting]
       │  Partitions results into 3 transparent UI sections:
       │  1. Best Verified Matches (evidence-backed ATS postings)
       │  2. Other Relevant Opportunities (accessible web & partner discoveries)
       │  3. Needs Confirmation (roles needing manual student verification)
       │  Displays Quality Threshold banner when verified matches are selective.
       ▼
[Stage 9: Caching & API Response]
       │  Persists listings to disk-backed store with short TTL
       │  Returns results, section buckets, quality note, source statuses, duration, and cache status
       ▼
[Stage 10: Dynamic UI Rendering (results.html & script.js)]
       │  Renders 3 distinct verification sections, quality threshold assurance,
       │  verification badges, and interactive filter toolbar
```

---

## 6. Implemented Sources & Permitted Access Policy

### Permitted Public ATS & Feeds (Active by Default)
1. **Greenhouse Public Boards:**
   - **Method:** Direct HTTP calls to `https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true`.
   - **Access:** Completely public API provided by Greenhouse for public job boards.
   - **Included Companies:** Cloudflare, GitHub, Stripe, Datadog, Reddit, Figma, GitLab, Dropbox, Twitch.
2. **Lever Public Postings:**
   - **Method:** Direct HTTP calls to `https://api.lever.co/v0/postings/{company}?mode=json`.
   - **Access:** Completely public JSON feed provided by Lever.
   - **Included Companies:** Spotify, Palantir, Automattic, Atlassian, Postman, Sourcegraph.
3. **Ashby Public Boards:**
   - **Method:** Direct HTTP calls to `https://api.ashbyhq.com/posting-api/job-board/{organization}`.
   - **Access:** Public posting endpoint provided by Ashby.
   - **Included Companies:** Ramp, Retool, Linear, Sentry, OpenAI.
4. **Remotive Public Remote API:**
   - **Method:** Direct HTTP calls to `https://remotive.com/api/remote-jobs?search={term}`.
   - **Access:** Free public developer API for remote tech jobs.

### Restricted Sources (Requires Approved Partner Access)
5. **LinkedIn:**
   - **Policy:** Unofficial HTML scraping, guest session parsing, CAPTCHA bypass, and automated logins are **strictly prohibited**.
   - **Adapter Behavior:** When `LINKEDIN_APPROVED_API_ENABLED=false` or `LINKEDIN_API_KEY` is not supplied, the adapter immediately reports:
     `status: "NOT_CONFIGURED"`, `errorMessage: "Requires approved API access (LinkedIn Official Partner API). Unofficial scraping is strictly disabled."`
   - **No Fake Data:** It never invents fake listings or simulates unauthorized search.
6. **Internshala:**
   - **Policy:** Scraping, automated browser bypass of Cloudflare, or unauthorized crawling is **strictly prohibited**.
   - **Adapter Behavior:** When `INTERNSHALA_APPROVED_API_ENABLED=false` or `INTERNSHALA_API_KEY` is missing, it immediately reports:
     `status: "NOT_CONFIGURED"`, `errorMessage: "Requires approved API access (Internshala Partner API). Unofficial scraping is strictly disabled."`

---

## 7. Data Models

### Normalized Internship Object (`internships/types/internshipTypes.js`)
```javascript
{
  id: "opp-3f8a92...",               // Deterministic SHA-256 ID
  source: "Greenhouse",              // Primary source name
  sourceListingUrl: "https://...",   // Original URL
  canonicalUrl: "https://...",       // URL stripped of tracking parameters
  directApplyUrl: "https://...",     // Direct application link
  externalId: "12345",               // Source-specific external ID
  title: "Frontend Engineering Intern",
  company: "Stripe",
  companyWebsite: "https://stripe.com",
  description: "Plain-text cleaned description without HTML tags.",
  responsibilities: [],
  qualifications: [],
  requiredSkills: ["React", "JavaScript", "TypeScript"],
  preferredSkills: ["GraphQL"],
  location: "San Francisco, CA",
  city: "San Francisco",
  country: "United States",
  workMode: "remote",                // "remote" | "hybrid" | "onsite" | "unknown"
  duration: "3 months (Summer 2025)",
  startDate: "June 2025",
  deadline: "Open until filled",
  postedDate: "2026-10-20T10:00:00.000Z",
  postedDateDisplay: "Posted 3 days ago",
  stipend: "$45/hr",
  status: "active",                  // "active" | "closed" | "expired"
  lastCheckedAt: "2026-10-23T10:15:00.000Z",
  completenessScore: 90,             // 0 to 100
  mergedSources: ["Greenhouse", "PartnerFeed"],
  score: 92,                         // Final ranking match score (0 to 100)
  scoreBreakdown: {
    roleRelevance: 28,               // Max 30
    requiredSkills: 22,              // Max 25
    preferredSkills: 8,              // Max 10
    locationRemote: 10,              // Max 10
    eligibility: 10,                 // Max 10
    recency: 8,                      // Max 8
    completeness: 4,                 // Max 4
    sourceReliability: 3             // Max 3
  },
  matchExplanation: "Matches your React and TypeScript skills. Remote role matches your work preference. Recently posted.",
  matchingSkills: ["React", "TypeScript"],
  missingSkills: ["GraphQL"],
  uncertainties: ["Graduation eligibility is not specified."]
}
```

---

## 8. Ranking Algorithm & Scoring Breakdown

Scoring is implemented in `internships/services/rankingService.js` and configured in `internships/types/rankingConfig.js`. It does not rely on random or opaque scores:

| Score Factor | Max Points | Evaluation Behavior |
|---|---|---|
| **Role Relevance** | 30 | Compares candidate's target career goal with listing title and inferred category. Exact keyword token matches receive highest weight. |
| **Required Skills** | 25 | Evaluates overlap between profile skills and listing's required skills. Reward exact skill matches. Missing required skills invoke a -5 penalty. |
| **Preferred Skills** | 10 | Evaluates overlap with optional/preferred skills. Neutral 5 pts when unstated. |
| **Location / Remote Fit** | 10 | Evaluates workplace mode against user preference (`Remote`, `Hybrid`, `Onsite`, `Any`). 10 pts for exact match; 0 pts for strict conflict (e.g. Onsite role when user requires Remote). |
| **Eligibility Fit** | 10 | Evaluates graduation year and degree compatibility. Neutral 8 pts when requirements are unstated. |
| **Listing Recency** | 8 | 8 pts (0–3 days old), 7 pts (4–7 days), 5 pts (8–14 days), 3 pts (15–30 days), 1 pt (31–60 days), 0 pts (> 60 days). |
| **Data Completeness** | 4 | Rewards listings with detailed descriptions, structured qualifications, location, and compensation. |
| **Source Reliability** | 3 | Official public ATS feeds (Greenhouse, Lever, Ashby) receive 3.0 pts; general feeds receive 2.5 pts. |
| **Stale Penalty** | -4 | Deducted if a listing was posted more than 45 days ago. |

---

## 9. API Routes

| Endpoint | Method | Auth Required | Description |
|---|---|---|---|
| `/api/login` | POST | No | Authenticates admin user and sets `sb_session` cookie. |
| `/api/logout` | POST | Yes | Invalidates session cookie and clears server session. |
| `/api/session` | GET | Yes | Verifies current session status and returns user email. |
| `/api/internships/search` | POST | Yes | Executes full internship search pipeline and returns ranked results, source statuses, and execution metadata. |
| `/api/internships/sources` | GET | Yes | Returns current health and configuration status of all adapters. |
| `/api/internships/save` | POST | Yes | Toggles bookmark status for a listing (`{ listingId }`). |
| `/api/internships/saved` | GET | Yes | Retrieves all bookmarked internships for current user. |
| `/api/internships/detail` | GET/POST | Yes | Returns complete normalized listing by ID (`?id=...`). |
| `/api/skillgap/analyze` | POST | Yes | Generates ATS readiness score, per-skill gap audit, and 14-day roadmap. |
| `/api/interview/generate` | POST | Yes | Generates categorized mock interview questions. |
| `/api/interview/evaluate` | POST | Yes | Evaluates candidate answer to an interview question. |
| `/api/resume/parse` | POST | Yes | Parses uploaded resume image/text to extract candidate skills and education. |

---

## 10. Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```bash
# Server & Security
PORT=3000
ADMIN_EMAIL=Admin123@gmail.com
ADMIN_PASSWORD=@2005Admin
SESSION_SECRET=c38e7f12a9d82145e69b0fa312c4b5d6e7f8a90123456789abcdef0123456789

# AI Service (Groq API)
GROQ_API_KEY=your_groq_api_key_here
AI_API_KEY=your_groq_api_key_here
AI_MODEL=openai/gpt-oss-20b

# Permitted Source Adapters (true/false)
GREENHOUSE_ENABLED=true
LEVER_ENABLED=true
ASHBY_ENABLED=true
REMOTIVE_ENABLED=true

# Approved Partner APIs (Require Official Credentials)
LINKEDIN_APPROVED_API_ENABLED=false
LINKEDIN_API_KEY=
LINKEDIN_API_SECRET=
INTERNSHALA_APPROVED_API_ENABLED=false
INTERNSHALA_API_KEY=

# Pipeline Performance & Caching
INTERNSHIP_SEARCH_CACHE_TTL_SECONDS=1800
INTERNSHIP_SOURCE_TIMEOUT_MS=7000
INTERNSHIP_SEARCH_MAX_CONCURRENCY=4
```

---

## 11. Setup & Run Instructions

### Prerequisites
- Node.js **v18+** (v20+ recommended). Current environment runs Node v24.
- NPM (or PowerShell with `npm.cmd`).

### Installation & Run
```bash
# 1. Install dependencies
npm install

# 2. Start the server
node server.js
# Or with npm:
npm start

# 3. Open in browser
http://localhost:3000
```
Login using the credentials configured in `.env`:
- **Email:** `Admin123@gmail.com`
- **Password:** `@2005Admin`

---

## 12. Testing Instructions

The project uses Node.js's native test runner (`node --test`), requiring zero external test dependencies:

```bash
# Run all automated tests
npm test
# Or directly via node:
node --test tests/*.test.js

# Run specific test suites
node --test tests/internships.test.js
node --test tests/orchestrator.test.js
node test-results.js
```

All 32 tests execute in under 17 seconds, validating:
- URL canonicalization & parameter stripping
- Skill alias normalization & text extraction
- Date parsing & recency scoring
- Location parsing & workplace compatibility
- Adapter mock parsing, timeout handling, and partner API error rejection
- Normalization schema compliance & malformed record rejection
- 4-stage layered deduplication
- Hard eligibility filtering & uncertainty retention
- Multi-factor ranking calculations & stale listing penalties
- AI fallback when offline
- Parallel source orchestration & partial failure tolerance
- Disk-backed data store persistence and bookmarking

---

## 13. Guide for Future Developers: Where to Make Changes

| If you want to... | Inspect and modify these files: |
|---|---|
| **Add a new company or job board to Greenhouse** | Add board tokens to `DEFAULT_GREENHOUSE_BOARDS` in `internships/adapters/greenhouseAdapter.js`. |
| **Add a new company to Lever** | Add company slugs to `DEFAULT_LEVER_COMPANIES` in `internships/adapters/leverAdapter.js`. |
| **Add a new company to Ashby** | Add organization slugs to `DEFAULT_ASHBY_ORGS` in `internships/adapters/ashbyAdapter.js`. |
| **Add a brand new data source adapter** | Create `internships/adapters/mySourceAdapter.js` extending `BaseSourceAdapter`, then register it in `internships/adapters/index.js`. |
| **Tune ranking weights or score factors** | Modify weights in `internships/types/rankingConfig.js` and algorithm in `internships/services/rankingService.js`. |
| **Add new technical skills to the dictionary** | Add canonical aliases to `SKILL_ALIASES` in `internships/utils/skillNormalization.js`. |
| **Update AI prompts or extraction schemas** | Edit `internships/services/aiExplanationService.js` (for search) or `services/skillGapService.js` (for skill gap). |
| **Modify API routes or authentication** | Edit `server.js` and `services/validators.js`. |
| **Enhance UI cards or filters** | Edit `results.html` (markup/layout) and `script.js` (`renderOpportunitiesList`, `renderSourceStatusBar`). |

---

## 14. Known Limitations & Best Practices

1. **Third-Party Partner APIs:**
   LinkedIn and Internshala require registered enterprise/partner API credentials. SkillBridge intentionally does not scrape or bypass bot protections. They will remain marked as "Requires Approved API Access" in the UI status drawer until partner credentials are provided.
2. **Rate Limits on Free Public Feeds:**
   Greenhouse, Lever, and Ashby public boards have rate limits per IP. The pipeline employs an in-memory & disk-backed cache (`INTERNSHIP_SEARCH_CACHE_TTL_SECONDS=1800`) to avoid redundant requests within 30 minutes.
3. **AI Provider Latency:**
   AI explanation enrichment is limited to the top 6 ranked opportunities per search to keep overall search latency under 2–3 seconds. If Groq API rate limits or latency issues occur, the pipeline automatically falls back to deterministic rule-based explanations.
