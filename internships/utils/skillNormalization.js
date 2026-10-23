/**
 * Skill Normalization and Alias Taxonomy
 * Maps skill variations, abbreviations, and informal names to canonical representations.
 */

const SKILL_ALIASES = {
  // Programming Languages
  js: "JavaScript",
  javascript: "JavaScript",
  ecmascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  py: "Python",
  python: "Python",
  python3: "Python",
  java: "Java",
  golang: "Go",
  go: "Go",
  cpp: "C++",
  "c++": "C++",
  csharp: "C#",
  "c#": "C#",
  rb: "Ruby",
  ruby: "Ruby",
  php: "PHP",
  rust: "Rust",
  swift: "Swift",
  kotlin: "Kotlin",
  dart: "Dart",
  scala: "Scala",
  r: "R",

  // Frontend Frameworks & Libraries
  react: "React",
  "react.js": "React",
  reactjs: "React",
  "react native": "React Native",
  reactnative: "React Native",
  vue: "Vue.js",
  "vue.js": "Vue.js",
  vuejs: "Vue.js",
  angular: "Angular",
  angularjs: "Angular",
  svelte: "Svelte",
  next: "Next.js",
  "next.js": "Next.js",
  nextjs: "Next.js",
  nuxt: "Nuxt.js",
  "nuxt.js": "Nuxt.js",
  html: "HTML",
  html5: "HTML",
  css: "CSS",
  css3: "CSS",
  tailwind: "Tailwind CSS",
  tailwindcss: "Tailwind CSS",
  bootstrap: "Bootstrap",
  sass: "Sass",
  scss: "Sass",
  redux: "Redux",

  // Backend Frameworks & Runtimes
  node: "Node.js",
  "node.js": "Node.js",
  nodejs: "Node.js",
  express: "Express.js",
  "express.js": "Express.js",
  expressjs: "Express.js",
  nest: "NestJS",
  "nest.js": "NestJS",
  nestjs: "NestJS",
  django: "Django",
  flask: "Flask",
  fastapi: "FastAPI",
  spring: "Spring Boot",
  "spring boot": "Spring Boot",
  springboot: "Spring Boot",
  rails: "Ruby on Rails",
  "ruby on rails": "Ruby on Rails",
  laravel: "Laravel",
  aspnet: "ASP.NET",
  "asp.net": "ASP.NET",
  dotnet: ".NET",
  ".net": ".NET",

  // Databases & Caching
  sql: "SQL",
  mysql: "MySQL",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  mongodb: "MongoDB",
  mongo: "MongoDB",
  redis: "Redis",
  dynamodb: "DynamoDB",
  cassandra: "Cassandra",
  sqlite: "SQLite",
  firebase: "Firebase",
  supabase: "Supabase",

  // Cloud & DevOps
  aws: "AWS",
  amazonwebservices: "AWS",
  gcp: "Google Cloud",
  googlecloud: "Google Cloud",
  azure: "Microsoft Azure",
  docker: "Docker",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  terraform: "Terraform",
  ansible: "Ansible",
  ci_cd: "CI/CD",
  "ci/cd": "CI/CD",
  cicd: "CI/CD",
  jenkins: "Jenkins",
  githubactions: "GitHub Actions",
  "github actions": "GitHub Actions",
  linux: "Linux",
  git: "Git",
  github: "GitHub",

  // AI & Data Science
  ai: "Artificial Intelligence",
  ml: "Machine Learning",
  "machine learning": "Machine Learning",
  "deep learning": "Deep Learning",
  nlp: "Natural Language Processing",
  cv: "Computer Vision",
  pandas: "Pandas",
  numpy: "NumPy",
  scipy: "SciPy",
  pytorch: "PyTorch",
  tensorflow: "TensorFlow",
  keras: "Keras",
  scikit: "Scikit-Learn",
  "scikit-learn": "Scikit-Learn",
  llm: "LLM",
  llms: "LLM",
  langchain: "LangChain",

  // Testing & Architecture
  jest: "Jest",
  mocha: "Mocha",
  cypress: "Cypress",
  selenium: "Selenium",
  playwright: "Playwright",
  graphql: "GraphQL",
  rest: "REST APIs",
  "rest api": "REST APIs",
  "restful api": "REST APIs",
  microservices: "Microservices",
  systemdesign: "System Design",
  "system design": "System Design"
};

/**
 * Normalizes an individual skill name using the canonical taxonomy.
 * @param {string} raw
 * @returns {string} Canonical skill name
 */
function normalizeSkill(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const key = raw.trim().toLowerCase().replace(/[\s\-_.]+/g, "");
  if (SKILL_ALIASES[key]) return SKILL_ALIASES[key];

  // Try direct lowercase match
  const lower = raw.trim().toLowerCase();
  if (SKILL_ALIASES[lower]) return SKILL_ALIASES[lower];

  // Title case default fallback
  return raw
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Normalizes an array or comma-separated string of skills.
 * Filters out duplicates and empty entries.
 * @param {string|string[]} input
 * @returns {string[]}
 */
function normalizeSkillList(input) {
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === "string") {
    list = input.split(/[,;\n|]+/);
  } else {
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const item of list) {
    const canonical = normalizeSkill(item);
    if (canonical && !seen.has(canonical.toLowerCase())) {
      seen.add(canonical.toLowerCase());
      result.push(canonical);
    }
  }

  return result;
}

/**
 * Extracts recognized technical skills from free-form job text.
 * @param {string} text
 * @returns {string[]}
 */
function extractSkillsFromText(text) {
  if (typeof text !== "string" || !text) return [];

  const found = new Set();
  const lower = " " + text.toLowerCase().replace(/[^a-z0-9#+.]/g, " ") + " ";

  // Multi-word and exact pattern tests
  const candidates = [
    { pattern: /\b(react\.?js|react)\b/i, skill: "React" },
    { pattern: /\b(react native)\b/i, skill: "React Native" },
    { pattern: /\b(node\.?js|node)\b/i, skill: "Node.js" },
    { pattern: /\b(next\.?js|nextjs)\b/i, skill: "Next.js" },
    { pattern: /\b(vue\.?js|vue)\b/i, skill: "Vue.js" },
    { pattern: /\b(angular)\b/i, skill: "Angular" },
    { pattern: /\b(python3?)\b/i, skill: "Python" },
    { pattern: /\b(typescript|ts)\b/i, skill: "TypeScript" },
    { pattern: /\b(javascript|js)\b/i, skill: "JavaScript" },
    { pattern: /\b(java)\b/i, skill: "Java" },
    { pattern: /\b(c\+\+|cpp)\b/i, skill: "C++" },
    { pattern: /\b(c#|csharp)\b/i, skill: "C#" },
    { pattern: /\b(golang|go)\b/i, skill: "Go" },
    { pattern: /\b(rust)\b/i, skill: "Rust" },
    { pattern: /\b(ruby on rails|rails)\b/i, skill: "Ruby on Rails" },
    { pattern: /\b(django)\b/i, skill: "Django" },
    { pattern: /\b(flask)\b/i, skill: "Flask" },
    { pattern: /\b(fastapi)\b/i, skill: "FastAPI" },
    { pattern: /\b(spring boot|spring)\b/i, skill: "Spring Boot" },
    { pattern: /\b(postgresql|postgres)\b/i, skill: "PostgreSQL" },
    { pattern: /\b(mysql)\b/i, skill: "MySQL" },
    { pattern: /\b(mongodb|mongo)\b/i, skill: "MongoDB" },
    { pattern: /\b(redis)\b/i, skill: "Redis" },
    { pattern: /\b(aws|amazon web services)\b/i, skill: "AWS" },
    { pattern: /\b(google cloud|gcp)\b/i, skill: "Google Cloud" },
    { pattern: /\b(azure)\b/i, skill: "Microsoft Azure" },
    { pattern: /\b(docker)\b/i, skill: "Docker" },
    { pattern: /\b(kubernetes|k8s)\b/i, skill: "Kubernetes" },
    { pattern: /\b(graphql)\b/i, skill: "GraphQL" },
    { pattern: /\b(rest(ful)? apis?)\b/i, skill: "REST APIs" },
    { pattern: /\b(git|github)\b/i, skill: "Git" },
    { pattern: /\b(tailwind(css)?)\b/i, skill: "Tailwind CSS" },
    { pattern: /\b(machine learning|ml)\b/i, skill: "Machine Learning" },
    { pattern: /\b(tensorflow|pytorch)\b/i, skill: "PyTorch" },
    { pattern: /\b(ci[\/-]?cd)\b/i, skill: "CI/CD" }
  ];

  for (const c of candidates) {
    if (c.pattern.test(lower)) {
      found.add(c.skill);
    }
  }

  return Array.from(found);
}

module.exports = {
  SKILL_ALIASES,
  normalizeSkill,
  normalizeSkillList,
  extractSkillsFromText
};
