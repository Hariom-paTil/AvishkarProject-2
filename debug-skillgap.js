const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true
});

const script = fs.readFileSync('script.js', 'utf8');

dom.window.eval(script);

console.log('script evaluated');

const navBtn = dom.window.document.getElementById('nav-skillgap');
const skillgapView = dom.window.document.getElementById('skillgap-view');
console.log('navBtn exists?', !!navBtn, 'skillgapView exists?', !!skillgapView, 'initial hidden?', skillgapView.classList.contains('hidden'));
if (navBtn) navBtn.click();
console.log('after click hidden?', skillgapView.classList.contains('hidden'));

const auditBtn = dom.window.document.getElementById('run-gap-audit-btn');
console.log('auditBtn exists?', !!auditBtn);
if (auditBtn) {
  dom.window.document.getElementById('skillgap-current-skills').value = 'JavaScript, React, Python';
  dom.window.document.getElementById('skillgap-education').value = 'B.Tech CSE';
  dom.window.document.getElementById('skillgap-goal').value = 'Become a full-stack engineer';
  dom.window.document.getElementById('skillgap-projects').value = 'Portfolio app';
  auditBtn.click();
  const modal = dom.window.document.getElementById('skillgap-modal');
  console.log('after click modal visible?', !!modal && !modal.classList.contains('hidden'));
  setTimeout(() => {
    const output = dom.window.document.getElementById('skillgap-analysis-output');
    console.log('after timeout modal visible?', !!modal && !modal.classList.contains('hidden'));
    console.log('output length', output.textContent.length);
    console.log('output sample', output.textContent.slice(0, 150));
    process.exit(0);
  }, 300);
}
