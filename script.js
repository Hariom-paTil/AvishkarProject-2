/**
 * SkillBridge AI - Core Application Script
 * Communicates with dedicated server-side services:
 * - InternshipService (/api/internships/search)
 * - SkillGapService (/api/skillgap/analyze)
 * - InterviewService (/api/interview/generate & /api/interview/evaluate)
 */

const RESULTS_STORAGE_KEY = "sb_result_request";

// Current Active Opportunity Type: 'internship' | 'job'
let currentOpportunityType = 'internship';

/**
 * Switch opportunity type between 'internship' and 'job'
 * @param {'internship' | 'job'} type
 */
function setOpportunityType(type) {
  currentOpportunityType = type;
  
  const btnInternship = document.getElementById('type-btn-internship');
  const btnJob = document.getElementById('type-btn-job');
  const findBtnLabel = document.getElementById('find-btn-label');
  
  if (type === 'internship') {
    if (btnInternship) {
      btnInternship.className = "px-5 py-2 text-xs font-bold rounded-lg transition-all bg-slate-900 text-white shadow-sm";
    }
    if (btnJob) {
      btnJob.className = "px-5 py-2 text-xs font-bold rounded-lg transition-all text-slate-600 hover:text-slate-900";
    }
    if (findBtnLabel) {
      findBtnLabel.textContent = "Find Internships";
    }
  } else {
    if (btnJob) {
      btnJob.className = "px-5 py-2 text-xs font-bold rounded-lg transition-all bg-slate-900 text-white shadow-sm";
    }
    if (btnInternship) {
      btnInternship.className = "px-5 py-2 text-xs font-bold rounded-lg transition-all text-slate-600 hover:text-slate-900";
    }
    if (findBtnLabel) {
      findBtnLabel.textContent = "Find Full-Time Jobs";
    }
  }
}

function openResultsPage(type, profile) {
  sessionStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify({ type, profile, createdAt: Date.now() }));
  window.location.href = `/results.html?type=${encodeURIComponent(type)}`;
}

function editPreviousProfile() {
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem(RESULTS_STORAGE_KEY) || 'null');
  } catch (_) {}

  const type = (stored?.type || 'internship').toLowerCase();
  const targetHash = (type === 'skillgap') ? 'skillgap' : ((type === 'interview') ? 'interview' : 'internship');
  window.location.href = `/index.html#${targetHash}`;
}

function restoreFormInputsFromSession() {
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem(RESULTS_STORAGE_KEY) || 'null');
  } catch (_) {}

  if (!stored || !stored.profile) return;
  const { type, profile } = stored;

  const skillsStr = Array.isArray(profile.skills) ? profile.skills.join(', ') : (profile.skills || '');

  // Internship / Job inputs
  if (profile.education && document.getElementById('internship-education-input')) {
    document.getElementById('internship-education-input').value = profile.education;
  }
  if (skillsStr && document.getElementById('internship-skills-input')) {
    document.getElementById('internship-skills-input').value = skillsStr;
  }
  if (profile.goal && document.getElementById('internship-goal-input')) {
    document.getElementById('internship-goal-input').value = profile.goal;
  }
  if (profile.workplace && document.getElementById('internship-workplace')) {
    document.getElementById('internship-workplace').value = profile.workplace;
  }
  if (profile.batch && document.getElementById('internship-batch')) {
    document.getElementById('internship-batch').value = profile.batch;
  }
  if (type === 'job' || type === 'internship') {
    setOpportunityType(type);
  }

  // Skill Gap inputs
  if (profile.role && document.getElementById('skillgap-target-role')) {
    document.getElementById('skillgap-target-role').value = profile.role;
  }
  if (profile.seniority && document.getElementById('skillgap-seniority')) {
    document.getElementById('skillgap-seniority').value = profile.seniority;
  }
  if (profile.education && document.getElementById('skillgap-education')) {
    document.getElementById('skillgap-education').value = profile.education;
  }
  if (profile.goal && document.getElementById('skillgap-goal')) {
    document.getElementById('skillgap-goal').value = profile.goal;
  }
  if (skillsStr && document.getElementById('skillgap-current-skills')) {
    document.getElementById('skillgap-current-skills').value = skillsStr;
  }
  if (profile.projects && document.getElementById('skillgap-projects')) {
    document.getElementById('skillgap-projects').value = profile.projects;
  }

  // Interview inputs
  if (profile.role && document.getElementById('interview-role')) {
    document.getElementById('interview-role').value = profile.role;
  }
  if (skillsStr && document.getElementById('interview-skills')) {
    document.getElementById('interview-skills').value = skillsStr;
  }
  if (profile.goal && document.getElementById('interview-goal')) {
    document.getElementById('interview-goal').value = profile.goal;
  }
  if (profile.projects && document.getElementById('interview-projects')) {
    document.getElementById('interview-projects').value = profile.projects;
  }
  if (profile.focus && document.getElementById('interview-focus')) {
    document.getElementById('interview-focus').value = profile.focus;
  }
}

async function logoutSkillBridge() {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  } catch (error) {
    console.warn("Logout request failed.", error);
  }
  localStorage.removeItem("sb_admin_auth");
  localStorage.removeItem("sb_admin_email");
  sessionStorage.removeItem("sb_admin_auth");
  sessionStorage.removeItem(RESULTS_STORAGE_KEY);
  window.location.href = "/login.html";
}

/**
 * Robust opportunity search service calling InternshipService (/api/internships/search)
 */
const opportunitySearchService = {
  async findMatches(profile) {
    const payload = {
      type: profile.type === 'job' ? 'job' : 'internship',
      education: profile.education || '',
      skills: profile.skills || '',
      goal: profile.goal || '',
      workplace: profile.workplace || 'Any',
      batch: profile.batch || 'Current Student'
    };

    try {
      const response = await fetch('/api/internships/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        window.location.href = '/login.html';
        return { data: [], fallback: true };
      }

      const resData = await response.json();
      if (resData.ok && resData.data && Array.isArray(resData.data.opportunities)) {
        return { data: resData.data.opportunities, summary: resData.data.searchSummary, fallback: false };
      }
    } catch (error) {
      console.error('Internship search API request failed:', error);
    }

    return { data: [], fallback: true };
  }
};

let currentAllOpportunities = [];
let currentFilterPlatform = 'all';

/**
 * Filter rendered opportunities by platform (All, LinkedIn, Internshala, Remotive)
 * @param {string} platform
 */
function filterOpportunitiesByPlatform(platform) {
  currentFilterPlatform = platform;
  renderOpportunitiesList();
}
window.filterOpportunitiesByPlatform = filterOpportunitiesByPlatform;

/**
 * Render the filtered subset of opportunities
 */
function renderOpportunitiesList() {
  const container = document.getElementById('internship-cards-grid');
  if (!container) return;

  const filtered = currentFilterPlatform === 'all'
    ? currentAllOpportunities
    : currentAllOpportunities.filter(item => (item.source || '').toLowerCase() === currentFilterPlatform.toLowerCase());

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
        <p class="text-sm font-semibold text-slate-800">No openings found for filter "${currentFilterPlatform}".</p>
        <button onclick="filterOpportunitiesByPlatform('all')" class="mt-3 px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-black transition-colors">
          View All Opportunities (${currentAllOpportunities.length})
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const matchingPills = (item.matchingSkills || []).map(skill => 
      `<span class="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md font-medium">${skill}</span>`
    ).join('');

    const urls = item.searchUrls || {};
    const sourceLower = (item.source || '').toLowerCase();
    
    // Platform styling
    let sourceBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
    let sourceIcon = 'fa-solid fa-briefcase';
    if (sourceLower.includes('linkedin')) {
      sourceBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
      sourceIcon = 'fa-brands fa-linkedin';
    } else if (sourceLower.includes('internshala')) {
      sourceBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
      sourceIcon = 'fa-solid fa-graduation-cap';
    } else if (sourceLower.includes('remotive')) {
      sourceBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
      sourceIcon = 'fa-solid fa-laptop-code';
    }

    const applyUrl = item.applyUrl || (urls.linkedIn || urls.internshala || '#');

    return `
      <div class="opportunity-card bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:border-slate-300 transition-all flex flex-col justify-between group">
        <div>
          <!-- Header: Platform & Match Badge -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-[11px] font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${sourceBadgeClass}">
              <i class="${sourceIcon}"></i> ${item.source || 'Verified Role'}
            </span>
            <span class="text-[11px] font-extrabold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
              ${item.matchPercentage || 85}% Match
            </span>
          </div>

          <!-- Company Name -->
          <div class="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            <i class="fa-solid fa-building text-[10px] text-slate-400"></i>
            <span class="truncate">${item.company || 'Tech Company'}</span>
          </div>

          <!-- Role Title -->
          <h3 class="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
            ${item.title}
          </h3>

          <!-- Location, Stipend, Duration Badges -->
          <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
              <i class="fa-solid fa-location-dot text-[10px] mr-1 text-slate-400"></i>${item.location || 'India / Remote'}
            </span>
            ${item.stipend ? `
              <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                <i class="fa-solid fa-money-bill-wave text-[10px] mr-1"></i>${item.stipend}
              </span>
            ` : ''}
            ${item.duration ? `
              <span class="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-medium border border-sky-100">
                <i class="fa-regular fa-clock text-[10px] mr-1"></i>${item.duration}
              </span>
            ` : ''}
          </div>

          <!-- Relevance Explanation -->
          <p class="text-xs text-slate-600 mt-3 leading-relaxed">
            ${item.whyItMatches || item.relevanceExplanation || 'Strong alignment with your profile background.'}
          </p>

          <!-- Matching Skills -->
          <div class="mt-4">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Matching Skills</span>
            <div class="flex flex-wrap gap-1">${matchingPills || '<span class="text-xs text-slate-400">Core software fundamentals</span>'}</div>
          </div>
        </div>

        <!-- Action Section: Apply Directly + Live Search Links -->
        <div class="mt-6 pt-4 border-t border-slate-100 space-y-3">
          <!-- Primary Direct Apply Button -->
          <a
            href="${applyUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-black transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Apply on ${item.source || 'Platform'}</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
          </a>

          <!-- Cross-platform Quick Links -->
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Search Similar Roles On:</span>
            <div class="grid grid-cols-3 gap-1.5 text-[11px] font-bold text-center">
              ${urls.linkedIn ? `
                <a href="${urls.linkedIn}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1">
                  <i class="fa-brands fa-linkedin text-xs"></i> LinkedIn
                </a>
              ` : ''}
              ${urls.internshala ? `
                <a href="${urls.internshala}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1">
                  <i class="fa-solid fa-graduation-cap text-xs"></i> Internshala
                </a>
              ` : ''}
              ${urls.unstop ? `
                <a href="${urls.unstop}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1">
                  <i class="fa-solid fa-trophy text-xs"></i> Unstop
                </a>
              ` : urls.indeed ? `
                <a href="${urls.indeed}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1">
                  <i class="fa-solid fa-magnifying-glass text-xs"></i> Indeed
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render opportunity listings with real search platform URLs & multi-source results
 */
function renderOpportunitiesAsProducts(opportunities, isFallback = false) {
  const container = document.getElementById('internship-results');
  const countBadge = document.getElementById('results-count-badge');
  
  if (!container) return;

  currentAllOpportunities = Array.isArray(opportunities) ? opportunities : [];
  currentFilterPlatform = 'all';

  if (currentAllOpportunities.length === 0) {
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
        <p class="text-sm font-semibold text-slate-800">No role recommendations available for your exact criteria.</p>
        <p class="text-xs text-slate-500 mt-1">Try broadening your skills or switching workplace preference to "Any".</p>
      </div>
    `;
    if (countBadge) countBadge.classList.add('hidden');
    return;
  }

  // Count per source
  const linkedInCount = currentAllOpportunities.filter(o => (o.source || '').toLowerCase().includes('linkedin')).length;
  const internshalaCount = currentAllOpportunities.filter(o => (o.source || '').toLowerCase().includes('internshala')).length;
  const otherCount = currentAllOpportunities.length - linkedInCount - internshalaCount;

  if (countBadge) {
    countBadge.textContent = `${currentAllOpportunities.length} Live Openings Found Across LinkedIn & Internshala`;
    countBadge.classList.remove('hidden');
  }

  let html = '';

  // Filter toolbar
  html += `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-bold text-slate-500 mr-1">Filter by Source:</span>
        <button
          onclick="filterOpportunitiesByPlatform('all')"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentFilterPlatform === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}"
        >
          All (${currentAllOpportunities.length})
        </button>
        ${linkedInCount > 0 ? `
          <button
            onclick="filterOpportunitiesByPlatform('LinkedIn')"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 flex items-center gap-1.5"
          >
            <i class="fa-brands fa-linkedin"></i> LinkedIn (${linkedInCount})
          </button>
        ` : ''}
        ${internshalaCount > 0 ? `
          <button
            onclick="filterOpportunitiesByPlatform('Internshala')"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-amber-700 hover:bg-amber-50 border border-amber-200 flex items-center gap-1.5"
          >
            <i class="fa-solid fa-graduation-cap"></i> Internshala (${internshalaCount})
          </button>
        ` : ''}
        ${otherCount > 0 ? `
          <button
            onclick="filterOpportunitiesByPlatform('Remotive')"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-purple-700 hover:bg-purple-50 border border-purple-200 flex items-center gap-1.5"
          >
            <i class="fa-solid fa-laptop-code"></i> Remote / Others (${otherCount})
          </button>
        ` : ''}
      </div>
      <div class="text-xs text-slate-500 font-medium">
        <i class="fa-solid fa-bolt text-indigo-500 mr-1"></i> Multi-API Live Feeds
      </div>
    </div>
  `;

  // Cards grid container
  html += `<div id="internship-cards-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>`;

  container.innerHTML = html;
  renderOpportunitiesList();
}

// Views and Navigation Elements Mapping
let views = {};
let navButtons = {};

function navigateTo(viewKey) {
  if (!views[viewKey]) return;

  Object.keys(views).forEach(key => {
    if (views[key]) views[key].classList.add('hidden');
  });

  views[viewKey].classList.remove('hidden');

  Object.keys(navButtons).forEach(key => {
    if (navButtons[key]) {
      if (key === viewKey) navButtons[key].classList.add('active');
      else navButtons[key].classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileIcon = document.getElementById('mobile-menu-icon');
  if (!mobileMenu) return;

  if (mobileMenu.classList.contains('hidden')) {
    mobileMenu.classList.remove('hidden');
    if (mobileIcon) mobileIcon.classList.replace('fa-bars', 'fa-xmark');
  } else {
    mobileMenu.classList.add('hidden');
    if (mobileIcon) mobileIcon.classList.replace('fa-xmark', 'fa-bars');
  }
}

window.navigateTo = navigateTo;
window.toggleMobileMenu = toggleMobileMenu;
window.setOpportunityType = setOpportunityType;
window.logoutSkillBridge = logoutSkillBridge;
window.openResultsPage = openResultsPage;
window.editPreviousProfile = editPreviousProfile;

/**
 * SkillGapService calling /api/skillgap/analyze
 */
const skillGapService = {
  async analyze(profile) {
    const payload = {
      role: profile.role || 'Full-Stack Engineer',
      seniority: profile.seniority || 'Entry-Level',
      education: profile.education || '',
      goal: profile.goal || '',
      skills: profile.skills || [],
      projects: profile.projects || ''
    };

    try {
      const response = await fetch('/api/skillgap/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        window.location.href = '/login.html';
        return null;
      }

      const resData = await response.json();
      if (resData.ok && resData.data) {
        return resData.data;
      }
    } catch (error) {
      console.error('SkillGap API request failed:', error);
    }

    return null;
  }
};

/**
 * Render structured Skill Gap report into results.html elements
 */
function renderSkillGapReport(data, profile) {
  const roleTitle = document.getElementById('skillgap-role-title');
  if (roleTitle) roleTitle.textContent = `${data.targetRole || profile.role} (${data.seniority || profile.seniority})`;

  const scoreDisplay = document.getElementById('skillgap-score-display');
  if (scoreDisplay) scoreDisplay.textContent = `${data.overallMatchPercentage || 75}%`;

  const circlePath = document.getElementById('skillgap-circle-path');
  if (circlePath) {
    const pct = data.overallMatchPercentage || 75;
    circlePath.setAttribute('stroke-dasharray', `${pct}, 100`);
  }

  const verdictBadge = document.getElementById('skillgap-verdict-badge');
  if (verdictBadge) {
    const pct = data.overallMatchPercentage || 75;
    if (pct >= 80) {
      verdictBadge.textContent = 'High Qualification';
      verdictBadge.className = 'px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100';
    } else if (pct >= 60) {
      verdictBadge.textContent = 'Moderate Readiness';
      verdictBadge.className = 'px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100';
    } else {
      verdictBadge.textContent = 'High Skill Gap';
      verdictBadge.className = 'px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100';
    }
  }

  const strengthsList = document.getElementById('skillgap-strengths-list');
  if (strengthsList) {
    const items = data.strengths || [];
    strengthsList.innerHTML = items.map(s => `
      <li class="flex items-start gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
        <span>${s}</span>
      </li>
    `).join('') || '<li class="text-xs text-slate-400">General tech foundation</li>';
  }

  const missingList = document.getElementById('skillgap-missing-list');
  if (missingList) {
    const items = data.criticalGaps || [];
    missingList.innerHTML = items.map(m => `
      <li class="flex items-start gap-2">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
        <span>${m}</span>
      </li>
    `).join('') || '<li class="text-xs text-slate-400">No critical gaps detected</li>';
  }

  // Render per-skill breakdown table
  const breakdownContainer = document.getElementById('skillgap-breakdown-container');
  if (breakdownContainer && Array.isArray(data.skillAnalysis)) {
    breakdownContainer.innerHTML = data.skillAnalysis.map(item => {
      const statusClass = item.status === 'Proficient' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          item.status === 'Developing' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          'bg-rose-50 text-rose-700 border-rose-200';
      const priorityClass = item.priority === 'Critical' ? 'bg-rose-100 text-rose-800' :
                            item.priority === 'High' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-700';

      return `
        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900 text-sm">${item.skill}</span>
              <span class="px-2 py-0.5 rounded-md font-semibold border ${statusClass}">${item.status}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-slate-500">Current: <strong>${item.currentLevel}</strong> &rarr; Target: <strong>${item.requiredLevel}</strong></span>
              <span class="px-2 py-0.5 rounded font-bold uppercase ${priorityClass}">${item.priority}</span>
            </div>
          </div>
          <p class="text-slate-600 mt-1">${item.reason}</p>
          <div class="mt-2 text-indigo-700 font-semibold bg-indigo-50/60 p-2 rounded-lg border border-indigo-100/60">
            <i class="fa-solid fa-lightbulb text-indigo-600 mr-1"></i> Recommended Action: ${item.recommendedAction}
          </div>
        </div>
      `;
    }).join('');
  }

  // Render learning roadmap
  const roadmapContainer = document.getElementById('skillgap-roadmap-container');
  if (roadmapContainer && Array.isArray(data.learningRoadmap)) {
    roadmapContainer.innerHTML = data.learningRoadmap.map(step => `
      <div class="p-4 rounded-2xl bg-purple-50/50 border border-purple-100">
        <div class="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1">Step ${step.order}: ${step.skill}</div>
        <h5 class="text-xs font-bold text-slate-900 mb-1">${step.reason}</h5>
        <p class="text-[11px] text-slate-600 leading-relaxed"><strong class="text-slate-800">Practice Project:</strong> ${step.practiceProject}</p>
      </div>
    `).join('');
  }

  const outputEl = document.getElementById('skillgap-analysis-output');
  if (outputEl) {
    outputEl.textContent = data.summary || "Skill gap diagnostic complete.";
  }
}

/**
 * InterviewService calling /api/interview/generate & /api/interview/evaluate
 */
const mockInterviewState = {
  questions: [],
  currentIndex: 0,
  score: 0,
  answers: []
};

const mockInterviewService = {
  async generateQuestions(profile) {
    const payload = {
      role: profile.role || 'Full-Stack Engineer',
      skills: profile.skills || ['JavaScript', 'React', 'Python'],
      goal: profile.goal || '',
      projects: profile.projects || '',
      focus: profile.focus || 'Full-Stack',
      education: profile.education || ''
    };

    try {
      const response = await fetch('/api/interview/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        window.location.href = '/login.html';
        return [];
      }

      const resData = await response.json();
      if (resData.ok && resData.data && Array.isArray(resData.data.questions)) {
        return resData.data.questions;
      }
    } catch (error) {
      console.error('Interview generate API request failed:', error);
    }

    return [];
  }
};

function renderMockQuestion() {
  const question = mockInterviewState.questions[mockInterviewState.currentIndex];
  const quiz = document.getElementById('mock-interview-quiz');
  const questionText = document.getElementById('mock-question-text');
  const categoryBadge = document.getElementById('mock-category-badge');
  const difficultyBadge = document.getElementById('mock-difficulty-badge');
  const skillTag = document.getElementById('mock-skill-tag');
  const whyAskedText = document.getElementById('mock-why-asked-text');
  const expectedPointsList = document.getElementById('mock-expected-points-list');
  const progress = document.getElementById('mcq-progress');
  const optionsContainer = document.getElementById('mock-options');
  const feedback = document.getElementById('mock-feedback');

  if (!question || !quiz || !questionText || !progress || !optionsContainer) return;

  progress.textContent = `${mockInterviewState.currentIndex + 1} / ${mockInterviewState.questions.length}`;
  const progressBar = document.getElementById('mcq-progress-bar');
  if (progressBar) {
    const pct = Math.round(((mockInterviewState.currentIndex + 1) / mockInterviewState.questions.length) * 100);
    progressBar.style.width = `${pct}%`;
  }

  if (categoryBadge) categoryBadge.textContent = question.category || 'Technical';
  if (difficultyBadge) difficultyBadge.textContent = question.difficulty || 'Medium';
  if (skillTag) skillTag.innerHTML = `<i class="fa-solid fa-code text-xs mr-1"></i>${question.skill || 'Software'}`;

  questionText.textContent = question.question;
  if (whyAskedText) whyAskedText.textContent = question.whyAsked || 'Evaluates key technical skills.';
  if (expectedPointsList) {
    const pts = question.expectedAnswerPoints || [];
    expectedPointsList.innerHTML = pts.map(p => `<li>${p}</li>`).join('') || '<li>Technical accuracy & clarity</li>';
  }

  optionsContainer.innerHTML = '';
  feedback.textContent = '';

  question.options.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-full text-left px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors';
    btn.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
    btn.disabled = false;

    btn.addEventListener('click', () => {
      const correctIdx = typeof question.correctIndex === 'number' ? question.correctIndex : question.answerIndex || 0;
      const selected = correctIdx === index;

      mockInterviewState.answers[mockInterviewState.currentIndex] = {
        selected: index,
        correct: selected,
        category: question.category
      };

      if (selected) {
        mockInterviewState.score += 1;
        feedback.textContent = 'Correct — excellent understanding.';
      } else {
        feedback.textContent = `Incorrect — correct answer: ${String.fromCharCode(65 + correctIdx)}. ${question.options[correctIdx]}`;
      }

      Array.from(optionsContainer.children).forEach((child, childIndex) => {
        child.disabled = true;
        child.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
        child.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
        if (childIndex === correctIdx) {
          child.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
        }
        if (childIndex === index && !selected) {
          child.classList.add('border-rose-500', 'bg-rose-50', 'text-rose-700');
        }
      });

      const nextBtn = document.getElementById('mock-next-btn');
      if (nextBtn) {
        nextBtn.textContent = mockInterviewState.currentIndex === mockInterviewState.questions.length - 1 ? 'Finish Interview' : 'Next Question';
      }
    });

    optionsContainer.appendChild(btn);
  });
}

function moveToNextQuestion() {
  const isLastQuestion = mockInterviewState.currentIndex >= mockInterviewState.questions.length - 1;
  mockInterviewState.currentIndex += 1;

  if (isLastQuestion) {
    showMockInterviewResults();
    return;
  }

  renderMockQuestion();
}

function showMockInterviewResults() {
  const quiz = document.getElementById('mock-interview-quiz');
  const results = document.getElementById('mock-interview-results');
  const finalScore = document.getElementById('final-score');
  const strongAreas = document.getElementById('strong-areas');
  const weakAreas = document.getElementById('weak-areas');
  const finalInsight = document.getElementById('final-insight');
  const finalScoreBadge = document.getElementById('final-score-badge');

  if (!quiz || !results || !finalScore || !strongAreas || !weakAreas || !finalInsight) return;

  quiz.classList.add('hidden');
  results.classList.remove('hidden');

  const total = mockInterviewState.questions.length;
  finalScore.textContent = `${mockInterviewState.score}/${total}`;

  const categoryMap = {};
  mockInterviewState.answers.forEach((answer) => {
    if (!answer || !answer.category) return;
    if (!categoryMap[answer.category]) categoryMap[answer.category] = { correct: 0, total: 0 };
    categoryMap[answer.category].total += 1;
    if (answer.correct) categoryMap[answer.category].correct += 1;
  });

  const strong = Object.entries(categoryMap)
    .filter(([, data]) => data.total > 0 && data.correct / data.total >= 0.5)
    .sort((a, b) => b[1].correct - a[1].correct);

  const weak = Object.entries(categoryMap)
    .filter(([, data]) => data.total > 0 && data.correct / data.total < 0.5)
    .sort((a, b) => a[1].correct - b[1].correct);

  strongAreas.innerHTML = strong.length ? strong.map(([category, data]) => `<li class="flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span><span>${category} (${data.correct}/${data.total})</span></li>`).join('') : '<li class="flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span><span>Solid general technical foundation</span></li>';

  weakAreas.innerHTML = weak.length ? weak.map(([category, data]) => `<li class="flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span><span>${category} (${data.correct}/${data.total})</span></li>`).join('') : '<li class="flex items-start gap-2"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span><span>No critical weak categories detected</span></li>';

  const percentage = Math.round((mockInterviewState.score / total) * 100);
  if (finalScoreBadge) {
    finalScoreBadge.textContent = `${percentage}% Score &bull; ${percentage >= 70 ? 'Passed' : 'Needs Reinforcement'}`;
  }
  finalInsight.textContent = percentage >= 75
    ? 'Excellent performance. Your domain knowledge, problem-solving, and architectural understanding are strong.'
    : percentage >= 50
      ? 'Solid performance. Good foundation shown across core categories. Review the weak topics above to lock in your offer.'
      : 'Keep building momentum. Focus on technical fundamentals, practice explaining trade-offs, and retake the mock set.';
}

async function startMockInterview(profileOverride) {
  const profile = profileOverride || {
    role: document.getElementById('interview-role')?.value || 'Full-Stack Engineer',
    skills: (document.getElementById('interview-skills')?.value || 'JavaScript, React, Python').split(',').map(s => s.trim()).filter(Boolean),
    goal: document.getElementById('interview-goal')?.value || 'Become a strong software engineer',
    projects: document.getElementById('interview-projects')?.value || 'Portfolio and coursework projects',
    focus: document.getElementById('interview-focus')?.value || 'Full-Stack'
  };

  if (document.body?.dataset?.page !== 'results') {
    openResultsPage('interview', profile);
    return;
  }

  const emptyState = document.getElementById('mock-interview-empty');
  const quiz = document.getElementById('mock-interview-quiz');
  const results = document.getElementById('mock-interview-results');

  if (emptyState) emptyState.classList.add('hidden');
  if (results) results.classList.add('hidden');
  if (quiz) quiz.classList.remove('hidden');

  const nextBtn = document.getElementById('mock-next-btn');
  if (nextBtn) {
    nextBtn.textContent = 'Generating Questions...';
    nextBtn.disabled = true;
  }

  const questions = await mockInterviewService.generateQuestions(profile);

  mockInterviewState.questions = questions;
  mockInterviewState.currentIndex = 0;
  mockInterviewState.score = 0;
  mockInterviewState.answers = [];

  renderMockQuestion();

  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.textContent = mockInterviewState.questions.length > 1 ? 'Next Question' : 'Finish Interview';
    nextBtn.onclick = () => {
      const answerExists = mockInterviewState.answers[mockInterviewState.currentIndex];
      if (!answerExists) {
        mockInterviewState.answers[mockInterviewState.currentIndex] = {
          selected: -1,
          correct: false,
          category: mockInterviewState.questions[mockInterviewState.currentIndex]?.category || 'General'
        };
      }
      moveToNextQuestion();
    };
  }
}

function retakeMockInterview() {
  document.getElementById('mock-interview-results')?.classList.add('hidden');
  document.getElementById('mock-interview-empty')?.classList.remove('hidden');
  document.getElementById('mock-interview-quiz')?.classList.add('hidden');
}

window.startMockInterview = startMockInterview;
window.retakeMockInterview = retakeMockInterview;

/**
 * Initialize Results Page View
 */
async function initResultsPage() {
  const isAuth = localStorage.getItem('sb_admin_auth') === '1' || sessionStorage.getItem('sb_admin_auth') === '1';
  try {
    const sessionRes = await fetch('/api/session', { credentials: 'same-origin' });
    if (!sessionRes.ok && !isAuth) {
      window.location.replace('/login.html');
      return;
    }
  } catch (_) {
    if (!isAuth) {
      window.location.replace('/login.html');
      return;
    }
  }

  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem(RESULTS_STORAGE_KEY) || 'null');
  } catch (_) {}

  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  const type = (stored?.type || typeParam || 'internship').toLowerCase();
  const profile = stored?.profile || {};

  const body = document.body;
  body.classList.remove('theme-internship', 'theme-job', 'theme-skillgap', 'theme-interview');
  body.classList.add(`theme-${type}`);

  const badgeText = document.getElementById('results-type-badge-text');
  const badge = document.getElementById('results-type-badge');
  const kickerText = document.getElementById('results-kicker-text');
  const loaderKicker = document.getElementById('loader-kicker');
  const loaderTitle = document.getElementById('loader-title');
  const loaderCopy = document.getElementById('loader-copy');
  const loaderIcon = document.getElementById('loader-icon');
  const resultsHeading = document.getElementById('results-heading');
  const resultsSubheading = document.getElementById('results-subheading');

  const panelOpportunities = document.getElementById('opportunities-panel');
  const panelSkillGap = document.getElementById('skillgap-panel');
  const panelInterview = document.getElementById('interview-panel');

  if (panelOpportunities) panelOpportunities.classList.add('hidden');
  if (panelSkillGap) panelSkillGap.classList.add('hidden');
  if (panelInterview) panelInterview.classList.add('hidden');

  if (type === 'job') {
    if (badgeText) badgeText.textContent = 'Full-Time Engineering Roles';
    if (kickerText) kickerText.textContent = 'Target Role Search Platform Links';
    if (loaderKicker) loaderKicker.textContent = 'Job Search AI';
    if (loaderTitle) loaderTitle.textContent = 'Analyzing Full-Time Role Matches';
    if (loaderCopy) loaderCopy.textContent = 'Evaluating your profile against software engineering job queries...';
    if (loaderIcon) loaderIcon.className = 'fa-solid fa-briefcase';
    if (resultsHeading) resultsHeading.textContent = 'Target Full-Time Roles & Search Platforms';
    if (resultsSubheading) resultsSubheading.textContent = 'Matched engineering roles with direct live search platform links.';
  } else if (type === 'skillgap') {
    if (badgeText) badgeText.textContent = 'Skill Gap Audit';
    if (kickerText) kickerText.textContent = 'Per-Skill Competency Report';
    if (loaderKicker) loaderKicker.textContent = 'AI Career Mentor';
    if (loaderTitle) loaderTitle.textContent = 'Auditing Skill Gaps & Roadmap';
    if (loaderCopy) loaderCopy.textContent = 'Comparing your profile against target industry roles to generate per-skill breakdowns...';
    if (loaderIcon) loaderIcon.className = 'fa-solid fa-chart-pie';
    if (resultsHeading) resultsHeading.textContent = 'Skill Gap & Readiness Breakdown';
    if (resultsSubheading) resultsSubheading.textContent = 'Per-skill level evaluation, priority recommendations, and practice roadmap.';
  } else if (type === 'interview') {
    if (badgeText) badgeText.textContent = 'Technical Mock Interview';
    if (kickerText) kickerText.textContent = 'Categorized Assessment';
    if (loaderKicker) loaderKicker.textContent = 'Senior Interview Lead';
    if (loaderTitle) loaderTitle.textContent = 'Generating Mock Questions';
    if (loaderCopy) loaderCopy.textContent = 'Generating categorized questions (Technical, Project-based, Scenario, Behavioral) with expected answer points...';
    if (loaderIcon) loaderIcon.className = 'fa-solid fa-brain';
    if (resultsHeading) resultsHeading.textContent = 'Interactive Technical Interview';
    if (resultsSubheading) resultsSubheading.textContent = 'Categorized technical questions with whyAsked insights and key answer criteria.';
  } else {
    // internship
    if (badgeText) badgeText.textContent = 'Tech Internships';
    if (kickerText) kickerText.textContent = 'Verified Internship Search Platform Links';
    if (loaderKicker) loaderKicker.textContent = 'Internship Matcher AI';
    if (loaderTitle) loaderTitle.textContent = 'Analyzing Tech Internship Matches';
    if (loaderCopy) loaderCopy.textContent = 'Matching your background against top target internship role categories...';
    if (loaderIcon) loaderIcon.className = 'fa-solid fa-graduation-cap';
    if (resultsHeading) resultsHeading.textContent = 'Target Internship Roles & Search Platforms';
    if (resultsSubheading) resultsSubheading.textContent = 'Matched engineering internship roles with direct search platform links.';
  }
  if (badge) badge.classList.remove('hidden');

  const startTime = Date.now();

  try {
    if (type === 'internship' || type === 'job') {
      currentOpportunityType = type;
      const matchData = await opportunitySearchService.findMatches({
        type,
        education: profile.education || '',
        skills: profile.skills || '',
        goal: profile.goal || '',
        workplace: profile.workplace || 'Any',
        batch: profile.batch || 'Current Student'
      });

      renderOpportunitiesAsProducts(matchData.data, matchData.fallback);
      if (panelOpportunities) {
        panelOpportunities.classList.remove('hidden');
      }
    } else if (type === 'skillgap') {
      const skillsArray = Array.isArray(profile.skills) ? profile.skills : (profile.skills || '').split(',').map(s => s.trim()).filter(Boolean);
      const gapData = await skillGapService.analyze({
        role: profile.role || 'Full-Stack Engineer',
        seniority: profile.seniority || 'Entry-Level',
        education: profile.education || '',
        goal: profile.goal || '',
        skills: skillsArray,
        projects: profile.projects || ''
      });

      if (gapData) {
        renderSkillGapReport(gapData, profile);
      }
      if (panelSkillGap) panelSkillGap.classList.remove('hidden');
    } else if (type === 'interview') {
      const mockRoleTitle = document.getElementById('mock-role-title');
      if (mockRoleTitle) {
        mockRoleTitle.textContent = `${profile.role || 'Full-Stack Engineer'} Assessment`;
      }
      if (panelInterview) panelInterview.classList.remove('hidden');
      await startMockInterview(profile);
    }
  } catch (error) {
    console.error('Error generating results on results.html:', error);
  } finally {
    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(500 - elapsed, 50);
    setTimeout(() => {
      const loader = document.getElementById('results-loader');
      const content = document.getElementById('results-content');
      if (loader) loader.classList.add('hidden');
      if (content) {
        content.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, remainingDelay);
  }
}

/**
 * Resume Upload & AI Scanner Handler
 * Sends uploaded resume images to /api/resume/parse and autofills the form fields
 */
function initResumeUploadHandler() {
  const uploadInput = document.getElementById('resume-upload-input');
  const dropZone = document.getElementById('resume-drop-zone');
  const promptEl = document.getElementById('resume-upload-prompt');
  const loadingEl = document.getElementById('resume-uploading-state');
  const parsedCard = document.getElementById('resume-parsed-card');
  const summaryEl = document.getElementById('resume-parsed-summary');
  const chipsEl = document.getElementById('resume-skills-chips');
  const clearBtn = document.getElementById('resume-clear-btn');
  const scanStatusText = document.getElementById('resume-scan-status-text');

  if (!uploadInput || !dropZone) return;

  const handleFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.name.endsWith('.pdf')) {
      alert('Please upload an image of your resume (PNG, JPG, WebP) or document.');
      return;
    }

    if (promptEl) promptEl.classList.add('hidden');
    if (parsedCard) parsedCard.classList.add('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (scanStatusText) scanStatusText.textContent = `Analyzing "${file.name}" with Groq Vision AI...`;

    try {
      // Convert file to base64 data URL
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Send to backend endpoint
      const response = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          image: dataUrl,
          mimeType: file.type || 'image/png',
          filename: file.name
        })
      });

      if (response.status === 401) {
        window.location.href = '/login.html';
        return;
      }

      const resData = await response.json();
      if (!resData.ok || !resData.data) {
        throw new Error(resData.error || 'Failed to analyze resume.');
      }

      const profile = resData.data;

      // Autofill fields
      const eduInput = document.getElementById('internship-education-input');
      const skillsInput = document.getElementById('internship-skills-input');
      const goalInput = document.getElementById('internship-goal-input');
      const batchSelect = document.getElementById('internship-batch');

      if (eduInput && profile.education) {
        eduInput.value = profile.education;
        eduInput.classList.add('bg-emerald-50/50', 'border-emerald-300');
        setTimeout(() => eduInput.classList.remove('bg-emerald-50/50', 'border-emerald-300'), 3000);
      }

      if (skillsInput && Array.isArray(profile.skills)) {
        skillsInput.value = profile.skills.join(', ');
        skillsInput.classList.add('bg-emerald-50/50', 'border-emerald-300');
        setTimeout(() => skillsInput.classList.remove('bg-emerald-50/50', 'border-emerald-300'), 3000);
      }

      if (goalInput && profile.goal) {
        goalInput.value = profile.goal;
        goalInput.classList.add('bg-emerald-50/50', 'border-emerald-300');
        setTimeout(() => goalInput.classList.remove('bg-emerald-50/50', 'border-emerald-300'), 3000);
      }

      if (batchSelect && profile.batch) {
        Array.from(batchSelect.options).forEach(opt => {
          if (opt.text.toLowerCase().includes('2026') || opt.text.toLowerCase().includes(profile.batch.toLowerCase())) {
            batchSelect.value = opt.value;
          }
        });
      }

      // Display parsed card
      if (summaryEl) {
        summaryEl.textContent = profile.summary || `Extracted ${profile.skills.length} skills from resume (${profile.education}).`;
      }

      if (chipsEl && Array.isArray(profile.skills)) {
        chipsEl.innerHTML = profile.skills.map(s => `
          <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md bg-white border border-emerald-200 text-emerald-800 shadow-xs">
            <i class="fa-solid fa-code text-[10px] text-emerald-600"></i> ${s}
          </span>
        `).join('');
      }

      if (loadingEl) loadingEl.classList.add('hidden');
      if (parsedCard) parsedCard.classList.remove('hidden');

    } catch (err) {
      console.error('Resume upload error:', err);
      alert('Error parsing resume: ' + err.message);
      if (loadingEl) loadingEl.classList.add('hidden');
      if (promptEl) promptEl.classList.remove('hidden');
    }
  };

  uploadInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  });

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#resume-clear-btn')) return;
    uploadInput.click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-indigo-500', 'bg-indigo-50/50');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      uploadInput.value = '';
      if (parsedCard) parsedCard.classList.add('hidden');
      if (promptEl) promptEl.classList.remove('hidden');
    });
  }
}

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  if (document.body?.dataset?.page === 'results') {
    initResultsPage();
    return;
  }

  // Initialize Resume Upload Handler for Opportunity Matcher
  initResumeUploadHandler();

  views = {
    'home': document.getElementById('home-view'),
    'internship': document.getElementById('internship-view'),
    'skillgap': document.getElementById('skillgap-view'),
    'interview': document.getElementById('interview-view')
  };

  navButtons = {
    'home': document.getElementById('nav-home'),
    'internship': document.getElementById('nav-internship'),
    'skillgap': document.getElementById('nav-skillgap'),
    'interview': document.getElementById('nav-interview')
  };

  // Restore previously entered profile inputs if user returned to edit
  restoreFormInputsFromSession();

  document.addEventListener('click', (event) => {
    const navTrigger = event.target.closest('[data-nav]');
    if (navTrigger) {
      const targetView = navTrigger.getAttribute('data-nav');
      if (targetView) {
        event.preventDefault();
        navigateTo(targetView);
      }
    }

    const mobileMenuTrigger = event.target.closest('#mobile-menu-btn');
    if (mobileMenuTrigger) {
      event.preventDefault();
      toggleMobileMenu();
    }
  });

  const findBtn = document.getElementById('find-internships-btn');
  if (findBtn) {
    findBtn.addEventListener('click', () => {
      const education = document.getElementById('internship-education-input')?.value.trim() || '';
      const skills = document.getElementById('internship-skills-input')?.value.trim() || '';
      const goal = document.getElementById('internship-goal-input')?.value.trim() || '';
      const workplace = document.getElementById('internship-workplace')?.value || 'Any';
      const batch = document.getElementById('internship-batch')?.value || 'Current Student';
      const type = currentOpportunityType;

      if (!skills && !education) {
        alert("Please provide at least your education stream or skills.");
        document.getElementById('internship-skills-input')?.focus();
        return;
      }

      openResultsPage(type, { type, education, skills, goal, workplace, batch });
    });
  }

  const skillGapAuditBtn = document.getElementById('run-gap-audit-btn');
  if (skillGapAuditBtn) {
    skillGapAuditBtn.addEventListener('click', () => {
      const profile = {
        role: document.getElementById('skillgap-target-role')?.value || 'Full-Stack Engineer',
        seniority: document.getElementById('skillgap-seniority')?.value || 'Entry-Level',
        education: document.getElementById('skillgap-education')?.value || 'Computer Science Stream',
        goal: document.getElementById('skillgap-goal')?.value || 'Build real software products.',
        skills: (document.getElementById('skillgap-current-skills')?.value || 'JavaScript, React, Python').split(',').map(s => s.trim()).filter(Boolean),
        projects: document.getElementById('skillgap-projects')?.value || 'portfolio and coursework projects'
      };

      if (!profile.skills.length && !profile.education) {
        alert('Please add at least your current skills or education stream.');
        document.getElementById('skillgap-current-skills')?.focus();
        return;
      }

      openResultsPage('skillgap', profile);
    });
  }

  const startInterviewBtn = document.getElementById('start-mock-interview-btn');
  if (startInterviewBtn) {
    startInterviewBtn.addEventListener('click', () => {
      const profile = {
        role: document.getElementById('interview-role')?.value || 'Full-Stack Engineer',
        skills: (document.getElementById('interview-skills')?.value || 'JavaScript, React, Python').split(',').map(s => s.trim()).filter(Boolean),
        goal: document.getElementById('interview-goal')?.value || 'Become a strong software engineer',
        projects: document.getElementById('interview-projects')?.value || 'Portfolio and coursework projects',
        focus: document.getElementById('interview-focus')?.value || 'Full-Stack'
      };

      openResultsPage('interview', profile);
    });
  }

  const hash = (window.location.hash || '').replace('#', '');
  navigateTo(hash && views[hash] ? hash : 'home');
});
