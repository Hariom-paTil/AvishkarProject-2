/**
 * SkillBridge AI host server
 * - Login required before any app page
 * - Groq API key stays on the server
 * - Exposes dedicated service endpoints for Internship, SkillGap, and Interview
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

// Import domain services and validators
const internshipService = require("./services/internshipService");
const skillGapService = require("./services/skillGapService");
const interviewService = require("./services/interviewService");
const resumeService = require("./services/resumeService");
const {
  validateInternshipRequest,
  validateSkillGapRequest,
  validateInterviewRequest,
  validateEvaluationRequest
} = require("./services/validators");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);

loadDotEnv();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "Admin123@gmail.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "@2005Admin";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const sessions = new Map();
const PUBLIC_PATHS = new Set(["/login.html", "/login", "/api/login"]);
const PUBLIC_FILES = new Set(["/style.css"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, Buffer.alloc(left.length));
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

function getSession(req) {
  const token = parseCookies(req).sb_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(token).digest("hex");
  const signed = `${token}.${hmac}`;
  sessions.set(signed, { email: ADMIN_EMAIL, expiresAt: Date.now() + SESSION_TTL_MS });
  return signed;
}

function cookieHeader(token, clear) {
  const parts = [
    `sb_session=${clear ? "" : encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax"
  ];
  if (clear) parts.push("Max-Age=0");
  else parts.push(`Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  if (process.env.COOKIE_SECURE === "1") parts.push("Secure");
  return parts.join("; ");
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data, extraHeaders = {}) {
  send(res, status, JSON.stringify(data), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 10_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({ _raw: raw });
      }
    });
    req.on("error", reject);
  });
}

function isPublic(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_FILES.has(pathname)) return true;
  return false;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    send(res, 200, data, { "Content-Type": type, "Cache-Control": "no-store" });
  });
}

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(ROOT, clean);
  if (!full.startsWith(ROOT)) return null;
  return full;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const session = getSession(req);

    // Login endpoint
    if (req.method === "POST" && pathname === "/api/login") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const emailOk = safeEqual(email, ADMIN_EMAIL);
      const passOk = safeEqual(password, ADMIN_PASSWORD);
      if (!emailOk || !passOk) {
        sendJson(res, 401, { ok: false, success: false, error: "Invalid email or password." });
        return;
      }
      const token = createSession();
      sendJson(res, 200, { ok: true, success: true }, { "Set-Cookie": cookieHeader(token, false) });
      return;
    }

    // Logout endpoint
    if (req.method === "POST" && pathname === "/api/logout") {
      const token = parseCookies(req).sb_session;
      if (token) sessions.delete(token);
      sendJson(res, 200, { ok: true, success: true }, { "Set-Cookie": cookieHeader("", true) });
      return;
    }

    // Session check endpoint
    if (req.method === "GET" && pathname === "/api/session") {
      if (!session) {
        sendJson(res, 401, { ok: false, success: false, error: "Not logged in." });
        return;
      }
      sendJson(res, 200, { ok: true, success: true, email: session.email });
      return;
    }

    // Require authentication for non-public routes
    if (!session && !isPublic(pathname)) {
      if (pathname.startsWith("/api/")) {
        sendJson(res, 401, { ok: false, success: false, error: "Login required." });
        return;
      }
      res.writeHead(302, { Location: "/login.html" });
      res.end();
      return;
    }

    // Redirect logged-in users away from login page
    if (session && (pathname === "/login.html" || pathname === "/login") && req.method === "GET") {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    // ==================== FEATURE 1: INTERNSHIP SERVICE ====================
    if (req.method === "POST" && pathname === "/api/internships/search") {
      const body = await readBody(req);
      const { valid, errors, data } = validateInternshipRequest(body);
      if (!valid) {
        sendJson(res, 400, { ok: false, success: false, errors });
        return;
      }

      try {
        const result = await internshipService.searchOpportunities(data);
        sendJson(res, 200, { ok: true, success: true, data: result });
      } catch (err) {
        console.error("Error in /api/internships/search:", err);
        sendJson(res, 500, { ok: false, success: false, error: err.message || "Failed to search opportunities." });
      }
      return;
    }

    // Get source health and status
    if (req.method === "GET" && pathname === "/api/internships/sources") {
      try {
        const statuses = internshipService.getSourceStatuses();
        sendJson(res, 200, { ok: true, success: true, data: statuses });
      } catch (err) {
        sendJson(res, 500, { ok: false, success: false, error: "Failed to fetch source statuses." });
      }
      return;
    }

    // Bookmark / Save internship
    if (req.method === "POST" && pathname === "/api/internships/save") {
      const body = await readBody(req);
      const listingId = String(body.listingId || "").trim();
      if (!listingId) {
        sendJson(res, 400, { ok: false, success: false, error: "listingId is required." });
        return;
      }
      try {
        const result = internshipService.toggleSaveInternship(session ? session.email : "guest", listingId);
        sendJson(res, 200, { ok: true, success: true, saved: result.saved, listingId });
      } catch (err) {
        sendJson(res, 500, { ok: false, success: false, error: "Failed to save internship." });
      }
      return;
    }

    // Get all saved internships
    if (req.method === "GET" && pathname === "/api/internships/saved") {
      try {
        const saved = internshipService.getSavedInternships(session ? session.email : "guest");
        sendJson(res, 200, { ok: true, success: true, data: saved });
      } catch (err) {
        sendJson(res, 500, { ok: false, success: false, error: "Failed to fetch saved internships." });
      }
      return;
    }

    // Get listing detail by ID
    if ((req.method === "GET" || req.method === "POST") && pathname === "/api/internships/detail") {
      const id = req.method === "GET"
        ? (url.searchParams.get("id") || "")
        : (await readBody(req)).id || "";
      if (!id) {
        sendJson(res, 400, { ok: false, success: false, error: "Missing listing ID." });
        return;
      }
      const listing = internshipService.getListingById(id);
      if (!listing) {
        sendJson(res, 404, { ok: false, success: false, error: "Listing not found." });
        return;
      }
      sendJson(res, 200, { ok: true, success: true, data: listing });
      return;
    }

    // ==================== FEATURE 1B: RESUME PARSER SERVICE ====================
    if (req.method === "POST" && pathname === "/api/resume/parse") {
      const body = await readBody(req);
      const image = body.image || body.resume || "";
      const mimeType = body.mimeType || "image/png";
      const text = body.text || "";

      if (!image && !text) {
        sendJson(res, 400, { ok: false, success: false, error: "Please upload a resume image or file." });
        return;
      }

      try {
        const result = await resumeService.parseResume({ image, mimeType, text });
        sendJson(res, 200, { ok: true, success: true, data: result });
      } catch (err) {
        console.error("Error in /api/resume/parse:", err);
        sendJson(res, 500, { ok: false, success: false, error: err.message || "Failed to parse resume." });
      }
      return;
    }

    // ==================== FEATURE 2: SKILL GAP SERVICE ====================
    if (req.method === "POST" && pathname === "/api/skillgap/analyze") {
      const body = await readBody(req);
      const { valid, errors, data } = validateSkillGapRequest(body);
      if (!valid) {
        sendJson(res, 400, { ok: false, success: false, errors });
        return;
      }

      try {
        const result = await skillGapService.analyzeGap(data);
        sendJson(res, 200, { ok: true, success: true, data: result });
      } catch (err) {
        console.error("Error in /api/skillgap/analyze:", err);
        sendJson(res, 500, { ok: false, success: false, error: err.message || "Failed to analyze skill gap." });
      }
      return;
    }

    // ==================== FEATURE 3: INTERVIEW SERVICE ====================
    if (req.method === "POST" && pathname === "/api/interview/generate") {
      const body = await readBody(req);
      const { valid, errors, data } = validateInterviewRequest(body);
      if (!valid) {
        sendJson(res, 400, { ok: false, success: false, errors });
        return;
      }

      try {
        const result = await interviewService.generateInterview(data);
        sendJson(res, 200, { ok: true, success: true, data: result });
      } catch (err) {
        console.error("Error in /api/interview/generate:", err);
        sendJson(res, 500, { ok: false, success: false, error: err.message || "Failed to generate interview." });
      }
      return;
    }

    if (req.method === "POST" && pathname === "/api/interview/evaluate") {
      const body = await readBody(req);
      const { valid, errors, data } = validateEvaluationRequest(body);
      if (!valid) {
        sendJson(res, 400, { ok: false, success: false, errors });
        return;
      }

      try {
        const result = await interviewService.evaluateAnswer(data);
        sendJson(res, 200, { ok: true, success: true, data: result });
      } catch (err) {
        console.error("Error in /api/interview/evaluate:", err);
        sendJson(res, 500, { ok: false, success: false, error: err.message || "Failed to evaluate answer." });
      }
      return;
    }

    // Legacy fallback endpoint for raw AI calls (backward compatibility)
    if (req.method === "POST" && pathname === "/api/groq") {
      const body = await readBody(req);
      const systemPrompt = String(body.systemPrompt || "");
      const userPrompt = String(body.userPrompt || "");
      if (!systemPrompt || !userPrompt) {
        sendJson(res, 400, { ok: false, success: false, error: "Missing prompts." });
        return;
      }
      try {
        const { callGroq } = require("./services/aiClient");
        const content = await callGroq({ systemPrompt, userPrompt });
        sendJson(res, 200, { ok: true, success: true, content });
      } catch (error) {
        sendJson(res, 502, { ok: false, success: false, error: error.message || "AI service unavailable." });
      }
      return;
    }

    // Static file handler
    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, "Method not allowed", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    let filePath = safeJoin(pathname);
    if (!filePath) {
      send(res, 400, "Bad path", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const blocked = ["server.js", ".env", "package.json", "package-lock.json"];
    const relativePath = path.relative(ROOT, filePath);
    if (
      blocked.includes(path.basename(filePath)) ||
      filePath.includes(`${path.sep}node_modules${path.sep}`) ||
      relativePath.startsWith("services" + path.sep)
    ) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    serveFile(res, filePath);
  } catch (error) {
    console.error("Unhandled server error:", error);
    sendJson(res, 500, { ok: false, success: false, error: "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`SkillBridge AI running at http://localhost:${PORT}`);
  console.log("Dedicated services loaded: InternshipService, SkillGapService, InterviewService.");
});
