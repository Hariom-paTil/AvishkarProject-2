const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/GROQ_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : '';

async function testSkillGap() {
  console.log('\n--- Testing Skill Gap Prompt ---');
  const profile = {
    role: 'Full-Stack Engineer',
    seniority: 'Entry-Level',
    education: 'Computer Science',
    goal: 'Build products and become job-ready',
    skills: ['JavaScript', 'React', 'Python', 'Git'],
    projects: 'Practical course & personal projects'
  };

  const userPrompt = JSON.stringify({
    role: profile.role,
    seniority: profile.seniority,
    education: profile.education,
    goal: profile.goal,
    currentSkills: profile.skills,
    projects: profile.projects,
    outputStyle: 'clear, practical, professional, student-friendly'
  });

  const systemPrompt = `You are a senior career coach and technical mentor for students and early-career engineers.
Your job is to evaluate a candidate profile and produce a practical, realistic skill-gap analysis.
Return valid JSON only with this exact structure:
{
  "score": 88,
  "summary": "1 paragraph summary",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "gaps": ["gap 1", "gap 2", "gap 3"],
  "roadmap": ["step 1", "step 2", "step 3"],
  "nextActions": ["action 1", "action 2", "action 3"],
  "finalReport": "A clear readable report with headings and bullet points"
}
Rules:
- Be realistic for internships and entry-level jobs.
- Mention education, current skills, target role, and learning goals.
- Give clear action steps that a student can follow in 2 to 4 weeks.
- Never output empty values.
- Even when skills are incomplete, still provide a useful answer.
- finalReport should be plain text with headings and bullets.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Choices message:', data.choices?.[0]?.message);
    const content = (data.choices?.[0]?.message?.content || "").trim();
    console.log('Content length:', content.length);
    console.log('Content snippet:', content.slice(0, 300));
    try {
      const parsed = JSON.parse(content);
      console.log('Parsed keys:', Object.keys(parsed));
      console.log('finalReport present?', !!parsed.finalReport);
    } catch (e) {
      console.error('JSON parse error on content:', e);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

async function testMockInterview() {
  console.log('\n--- Testing Mock Interview Prompt ---');
  const profile = {
    role: 'Full-Stack Engineer',
    focus: 'Full-Stack',
    skills: ['JavaScript', 'React', 'Python'],
    goal: 'Become a strong software engineer',
    projects: 'Portfolio and coursework projects'
  };

  const userPrompt = JSON.stringify({
    role: profile.role,
    focus: profile.focus,
    skills: profile.skills,
    goal: profile.goal,
    projectExperience: profile.projects,
    questionCount: 10,
    difficulty: 'advanced industry level',
    format: 'JSON only'
  });

  const systemPrompt = `You are an expert technical interview generator for hiring teams and engineering managers.
Generate exactly 10 advanced, industry-level multiple choice interview questions tailored to the candidate profile.
The questions must be realistic for students and early-career engineers targeting ${profile.role} roles.

Rules:
- Return valid JSON only.
- Top-level object must have a "questions" array.
- Each item must contain: "category", "question", "options", "answerIndex".
- options must be an array of exactly 4 strings.
- answerIndex must be an integer from 0 to 3.
- Difficulty should be advanced and practical.
- Questions should match the candidate's stated skills: ${profile.skills.join(', ')}.
- Focus on ${profile.focus} interviewing, but include relevant fundamentals.
- Candidate goal: ${profile.goal}.
- Project background: ${profile.projects}.
- Do not include explanations outside JSON.
- Do not generate resume upload content.
- Keep each question clear, professional, and industry-aligned.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    const content = (data.choices?.[0]?.message?.content || "").trim();
    console.log('Mock Interview Content length:', content.length);
    console.log('Content snippet:', content.slice(0, 300));
    try {
      const parsed = JSON.parse(content);
      console.log('Parsed keys:', Object.keys(parsed));
      console.log('Questions count:', parsed.questions?.length);
    } catch (e) {
      console.error('JSON parse error on mock content:', e);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

async function run() {
  await testSkillGap();
  await testMockInterview();
}

run();
