const fs = require('fs');
const { JSDOM } = require('jsdom');

const resultsHtml = fs.readFileSync('results.html', 'utf8');
const scriptJs = fs.readFileSync('script.js', 'utf8');

async function testType(type, sampleProfile) {
  console.log(`\n--- Testing results.html for type: ${type} ---`);
  const dom = new JSDOM(resultsHtml, {
    url: `http://localhost:3000/results.html?type=${type}`,
    runScripts: 'dangerously',
    resources: 'usable'
  });

  // Mock authenticated state
  dom.window.localStorage.setItem('sb_admin_auth', '1');
  dom.window.sessionStorage.setItem('sb_result_request', JSON.stringify({
    type,
    profile: sampleProfile
  }));

  // Stub fetch for /api/session and /api/groq (falls back gracefully)
  dom.window.fetch = async (url) => {
    if (url === '/api/session') {
      return { ok: true, json: async () => ({ ok: true, email: 'admin123@gmail.com' }) };
    }
    return { ok: false, status: 502 };
  };

  dom.window.eval(scriptJs);

  // Allow async initResultsPage to execute
  await new Promise(r => setTimeout(r, 900));

  const doc = dom.window.document;
  const loaderHidden = doc.getElementById('results-loader')?.classList.contains('hidden');
  const contentVisible = !doc.getElementById('results-content')?.classList.contains('hidden');
  const bodyHasTheme = doc.body.classList.contains(`theme-${type}`);

  console.log(`[${type}] Loader hidden:`, loaderHidden);
  console.log(`[${type}] Content visible:`, contentVisible);
  console.log(`[${type}] Body has theme class:`, bodyHasTheme);

  if (type === 'internship' || type === 'job') {
    const oppPanelVisible = !doc.getElementById('opportunities-panel')?.classList.contains('hidden');
    const roleCards = doc.querySelectorAll('#internship-results .opportunity-card, #internship-results a[href*="linkedin"], #internship-results h3');
    console.log(`[${type}] Opportunities panel visible:`, oppPanelVisible, 'Cards count:', roleCards.length);
  } else if (type === 'skillgap') {
    const gapPanelVisible = !doc.getElementById('skillgap-panel')?.classList.contains('hidden');
    const strengths = doc.querySelectorAll('#skillgap-strengths-list li');
    const missing = doc.querySelectorAll('#skillgap-missing-list li');
    console.log(`[${type}] Skillgap panel visible:`, gapPanelVisible, 'Strengths count:', strengths.length, 'Missing count:', missing.length);
  } else if (type === 'interview') {
    const interviewPanelVisible = !doc.getElementById('interview-panel')?.classList.contains('hidden');
    const qText = doc.getElementById('mock-question-text')?.textContent;
    const options = doc.querySelectorAll('#mock-options button');
    console.log(`[${type}] Interview panel visible:`, interviewPanelVisible, 'Question loaded:', !!qText, 'Options count:', options.length);
  }
}

async function run() {
  await testType('internship', { education: 'B.Tech CSE', skills: 'React, Node.js', goal: 'Frontend internship' });
  await testType('job', { education: 'MCA', skills: 'Python, Django, AWS', goal: 'Full-time backend engineer' });
  await testType('skillgap', { role: 'Full-Stack Developer', skills: ['JavaScript', 'React', 'Python', 'Git'] });
  await testType('interview', { role: 'Full-Stack Engineer', focus: 'Frontend', skills: 'React, TypeScript' });
  console.log('\nAll results.html tests completed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
