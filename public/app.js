const state = {
  jobs: [],
  savedJobs: [],
  sentEmails: [],
  activeJob: null,
};

// ---------- Auth ----------
document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.toggle('active', t === tab));
    const view = tab.dataset.authview;
    document.getElementById('loginForm').classList.toggle('hidden', view !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', view !== 'register');
    document.getElementById('resetForm').classList.toggle('hidden', view !== 'reset');
  });
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const hint = document.getElementById('loginHint');
  hint.textContent = '';
  hint.className = 'hint';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      hint.textContent = data.error || 'Login failed.';
      hint.className = 'hint error';
      return;
    }
    enterApp();
  } catch {
    hint.textContent = 'Could not reach the server.';
    hint.className = 'hint error';
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const hint = document.getElementById('registerHint');
  hint.textContent = '';
  hint.className = 'hint';
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      hint.textContent = data.error || 'Could not create account.';
      hint.className = 'hint error';
      return;
    }
    enterApp();
  } catch {
    hint.textContent = 'Could not reach the server.';
    hint.className = 'hint error';
  }
});

document.getElementById('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('resetUsername').value.trim();
  const newPassword = document.getElementById('resetPassword').value;
  const hint = document.getElementById('resetHint');
  hint.textContent = '';
  hint.className = 'hint';
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      hint.textContent = data.error || 'Password reset failed.';
      hint.className = 'hint error';
      return;
    }
    hint.textContent = data.message || 'Password reset successfully! Switch to Log in.';
    hint.style.color = '#34d399';
    document.getElementById('loginUsername').value = username;
    document.getElementById('resetPassword').value = '';
  } catch {
    hint.textContent = 'Could not reach the server.';
    hint.className = 'hint error';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  document.getElementById('appRoot').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
});

function enterApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('hidden');
  loadCountries();
  loadSavedJobs();
}

async function checkAuthAndInit() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      enterApp();
    } else {
      document.getElementById('authScreen').classList.remove('hidden');
    }
  } catch {
    document.getElementById('authScreen').classList.remove('hidden');
  }
}

// ---------- Resume file upload ----------
document.getElementById('uploadResumeBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('resumeFile');
  const hint = document.getElementById('uploadHint');
  const file = fileInput.files[0];
  if (!file) {
    hint.textContent = 'Choose a file first.';
    hint.className = 'hint error';
    return;
  }
  hint.textContent = 'Reading file…';
  hint.className = 'hint';

  const formData = new FormData();
  formData.append('resume', file);

  try {
    const res = await fetch('/api/profile/upload-resume', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      hint.textContent = data.error || 'Failed to read that file.';
      hint.className = 'hint error';
      return;
    }
    document.getElementById('profileResume').value = data.resumeText;
    hint.textContent = 'Text extracted below — review it, then click Save resume.';
    hint.className = 'hint';
  } catch {
    hint.textContent = 'Could not reach the server.';
    hint.className = 'hint error';
  }
});

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

function switchView(view) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'saved') renderSaved();
  if (view === 'sent') loadSentHistory();
  if (view === 'profile') loadProfile();
}

// ---------- Profile (base resume) ----------
async function loadProfile() {
  const res = await fetch('/api/profile');
  const data = await res.json();
  document.getElementById('profileResume').value = data.resumeText || '';
}

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const resumeText = document.getElementById('profileResume').value;
  const hint = document.getElementById('profileHint');
  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText }),
    });
    hint.textContent = 'Base resume saved!';
    hint.className = 'hint';
  } catch {
    hint.textContent = 'Could not save resume.';
    hint.className = 'hint error';
  }
});

// ---------- AI Resume Customizer Tester ----------
document.getElementById('testTailorBtn').addEventListener('click', async () => {
  const jobTitle = document.getElementById('testJobTitle').value.trim();
  const company = document.getElementById('testCompany').value.trim();
  const jobDescription = document.getElementById('testJobDesc').value.trim();
  const resumeText = document.getElementById('profileResume').value.trim();
  const hint = document.getElementById('testTailorHint');
  const resultBox = document.getElementById('testTailorResultBox');
  const output = document.getElementById('testTailoredOutput');

  if (!resumeText) {
    hint.textContent = 'Please paste or upload your base resume above first.';
    hint.className = 'hint error';
    return;
  }

  if (!jobTitle || !jobDescription) {
    hint.textContent = 'Please enter a target job title and job description / key skills.';
    hint.className = 'hint error';
    return;
  }

  hint.textContent = 'Customizing resume with AI…';
  hint.className = 'hint';
  output.value = '';
  resultBox.classList.add('hidden');

  try {
    const res = await fetch('/api/resume/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, jobTitle, company, jobDescription }),
    });
    const data = await res.json();
    if (!res.ok) {
      hint.textContent = data.error || 'AI customization failed.';
      hint.className = 'hint error';
      return;
    }
    output.value = data.tailoredResume;
    resultBox.classList.remove('hidden');
    hint.textContent = data.mode === 'llm' ? 'Resume customized with Groq AI!' : 'Resume customized with Smart Local AI!';
    hint.className = 'hint';
  } catch {
    hint.textContent = 'Could not reach the server.';
    hint.className = 'hint error';
  }
});

// ---------- Countries ----------
async function loadCountries() {
  const res = await fetch('/api/countries');
  const countries = await res.json();
  const select = document.getElementById('country');
  select.innerHTML = Object.entries(countries)
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join('');
  select.value = 'us';
}

function linkedinPostsUrl(what = '', where = '') {
  const keywords = what || 'java developer c2c -fulltime -bench -sales -hotlist -w2';
  const url = new URL('https://www.linkedin.com/search/results/content/');
  url.searchParams.set('keywords', keywords);
  url.searchParams.set('origin', 'FACETED_SEARCH');
  url.searchParams.set('sortBy', '"date_posted"');
  return url.toString();
}

function linkedinJobsUrl(what = '', where = '', extraLocation = '') {
  const keywords = what || 'java developer c2c -fulltime -bench -sales -hotlist -w2';
  const url = new URL('https://www.linkedin.com/jobs/search/');
  url.searchParams.set('keywords', keywords);
  const loc = where || extraLocation;
  if (loc) url.searchParams.set('location', loc);
  url.searchParams.set('f_TPR', 'r86400');
  url.searchParams.set('sortBy', 'DD');
  return url.toString();
}

const openPostsBtn = document.getElementById('openLinkedinPostsBtn');
if (openPostsBtn) {
  openPostsBtn.addEventListener('click', () => {
    const what = document.getElementById('what').value.trim() || 'java developer c2c -fulltime -bench -sales -hotlist -w2';
    const where = document.getElementById('where').value.trim();
    window.open(linkedinPostsUrl(what, where), '_blank', 'noopener');
  });
}

const openJobsBtn = document.getElementById('openLinkedinJobsBtn');
if (openJobsBtn) {
  openJobsBtn.addEventListener('click', () => {
    const what = document.getElementById('what').value.trim() || 'java developer c2c -fulltime -bench -sales -hotlist -w2';
    const where = document.getElementById('where').value.trim();
    window.open(linkedinJobsUrl(what, where), '_blank', 'noopener');
  });
}

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  document.getElementById('contractOnly').checked = false;
  const last24hEl = document.getElementById('last24h');
  if (last24hEl) last24hEl.checked = false;
  document.getElementById('where').value = '';
});

document.querySelectorAll('.chip[data-preset]').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    const preset = chip.dataset.preset;
    if (preset === 'javac2c24h') {
      document.getElementById('what').value = 'java developer c2c -fulltime -bench -sales -hotlist -w2';
      document.getElementById('contractOnly').checked = true;
      const last24hEl = document.getElementById('last24h');
      if (last24hEl) last24hEl.checked = true;
    } else if (preset === 'c2c') {
      document.getElementById('what').value = 'C2C';
      document.getElementById('contractOnly').checked = true;
    } else if (preset === 'w2contract') {
      document.getElementById('what').value = 'W2 contract';
      document.getElementById('contractOnly').checked = true;
    } else if (preset === 'remote') {
      document.getElementById('where').value = 'Remote';
    }
    document.getElementById('searchForm').requestSubmit();
  });
});

// ---------- Job search ----------
document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const what = document.getElementById('what').value.trim();
  const country = document.getElementById('country').value;
  const where = document.getElementById('where').value.trim();
  const contractOnly = document.getElementById('contractOnly').checked;
  const last24hEl = document.getElementById('last24h');
  const last24h = last24hEl ? last24hEl.checked : false;

  const meta = document.getElementById('resultsMeta');
  const results = document.getElementById('results');
  meta.textContent = 'Searching past 24h jobs…';
  results.innerHTML = '';

  try {
    const url = `/api/jobs/search?what=${encodeURIComponent(what)}&country=${country}&where=${encodeURIComponent(where)}&contractOnly=${contractOnly ? '1' : '0'}${last24h ? '&maxDaysOld=1' : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      meta.textContent = '';
      results.innerHTML = `<div class="empty-state">${data.error || 'Something went wrong.'}</div>`;
      return;
    }
    state.jobs = data.jobs || [];
    const filterNote = `${contractOnly ? ' (Contract only ✓)' : ''}${last24h ? ' (Posted in last 24h ⚡)' : ''}`;
    meta.textContent = `${data.count?.toLocaleString() || state.jobs.length} roles found — showing first ${state.jobs.length}${filterNote}`;
    renderJobs(state.jobs, results);
  } catch (err) {
    meta.textContent = '';
    results.innerHTML = `<div class="empty-state">Couldn't reach the server. Is it running?</div>`;
  }
});

function getCompanyInitial(companyName) {
  if (!companyName) return 'C';
  const clean = companyName.replace(/[^a-zA-Z0-9]/g, '').trim();
  return clean.charAt(0).toUpperCase() || 'C';
}

function extractSkillTags(job) {
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const commonSkills = ['Node.js', 'Python', 'React', 'Java', 'TypeScript', 'AWS', 'Docker', 'PostgreSQL', 'GraphQL', 'Kubernetes', 'Cloud', 'C++', 'Go', 'Agile'];
  const matches = commonSkills.filter(s => text.includes(s.toLowerCase()));
  return matches.length > 0 ? matches.slice(0, 4) : ['Engineering', 'Software', 'Cloud'];
}

function renderJobs(jobs, container) {
  if (!jobs.length) {
    container.innerHTML = '<div class="empty-state">No roles matched. Try a broader title or a different country.</div>';
    return;
  }
  container.innerHTML = jobs
    .map(
      (job, i) => {
        const initial = getCompanyInitial(job.company);
        const tags = extractSkillTags(job);
        return `
    <div class="job-row" data-id="${job.id}">
      <div class="job-card-top">
        <div class="company-avatar">${initial}</div>
        <div class="job-main-header">
          <h3>${escapeHtml(job.title)}</h3>
          <div class="job-meta-row">
            <span class="job-company">${escapeHtml(job.company)}</span>
            <span>📍 ${escapeHtml(job.location)}</span>
            ${job.contractType ? `<span class="badge-contract">${escapeHtml(job.contractType)}</span>` : ''}
            ${salaryLabel(job)}
          </div>
        </div>
      </div>
      <p class="job-desc">${escapeHtml((job.description || '').slice(0, 160))}${job.description && job.description.length > 160 ? '…' : ''}</p>
      
      <div class="skill-tags">
        ${tags.map(t => `<span class="skill-tag">${escapeHtml(t)}</span>`).join('')}
      </div>

      <div class="job-actions-row">
        <button class="btn-primary" onclick="openCompose('${job.id}')">Draft Email 🚀</button>
        <button class="btn-ghost" onclick="saveJob('${job.id}')">🔖 Save</button>
        <a class="link-btn" href="${job.redirectUrl}" target="_blank" rel="noopener">Posting ↗</a>
        <a class="link-btn" href="${linkedinPostsUrl(job.title + ' C2C')}" target="_blank" rel="noopener">Posts ↗</a>
        <a class="link-btn" href="${linkedinJobsUrl(job.title, job.company, job.location)}" target="_blank" rel="noopener">Jobs ↗</a>
      </div>
    </div>`;
      }
    )
    .join('');
}

function salaryLabel(job) {
  if (!job.salaryMin && !job.salaryMax) return '';
  const fmt = (n) => (n ? '$' + Math.round(n / 1000) + 'k' : '');
  return `<span class="job-salary">${fmt(job.salaryMin)}${job.salaryMax ? '–' + fmt(job.salaryMax) : ''}/yr</span>`;
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Save jobs ----------
async function saveJob(jobId) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return;
  const res = await fetch('/api/jobs/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job),
  });
  const data = await res.json();
  state.savedJobs = data.savedJobs || [];
  document.getElementById('savedCount').textContent = state.savedJobs.length;
  showToast(`Saved "${job.title}"`);
}

async function loadSavedJobs() {
  const res = await fetch('/api/jobs/saved');
  const data = await res.json();
  state.savedJobs = data.savedJobs || [];
  document.getElementById('savedCount').textContent = state.savedJobs.length;
}

function renderSaved() {
  renderJobs(state.savedJobs, document.getElementById('savedResults'));
}

// ---------- Outreach: compose & send ----------
function guessCompanyDomain(companyName) {
  if (!companyName) return 'company.com';
  let clean = String(companyName)
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\b(inc|llc|ltd|corp|corporation|technologies|tech|solutions|services|group|co|global|software)\b/gi, '')
    .trim();
  if (!clean) clean = companyName.replace(/[^a-zA-Z0-9]/g, '');
  const slug = clean.toLowerCase().replace(/\s+/g, '');
  return slug ? `${slug}.com` : 'company.com';
}

function autoSuggestEmails(companyName) {
  const domain = guessCompanyDomain(companyName);
  return [
    { value: `careers@${domain}`, position: 'Careers & Hiring Team' },
    { value: `hr@${domain}`, position: 'Human Resources' },
    { value: `recruiting@${domain}`, position: 'Talent Acquisition' },
    { value: `jobs@${domain}`, position: 'Job Inquiries' }
  ];
}

async function openCompose(jobId) {
  const job = state.jobs.find((j) => j.id === jobId) || state.savedJobs.find((j) => j.id === jobId);
  if (!job) return;
  state.activeJob = job;

  const domain = guessCompanyDomain(job.company);
  const defaultEmail = `careers@${domain}`;

  document.getElementById('composeTo').value = defaultEmail;
  document.getElementById('sendHint').textContent = '';
  document.getElementById('sendHint').className = 'hint';
  document.getElementById('tailorHint').textContent = '';
  document.getElementById('tailorHint').className = 'hint';
  document.getElementById('tailoredResume').value = '';
  document.getElementById('attachResume').checked = false;

  const hint = document.getElementById('lookupHint');
  const resultsBox = document.getElementById('lookupResults');

  hint.textContent = `Auto-detected contact emails for ${job.company}:`;
  hint.className = 'hint';
  const suggested = autoSuggestEmails(job.company);
  resultsBox.innerHTML = suggested
    .map(
      (e) => `<div class="lookup-item" onclick="pickContact('${e.value}')">
        <span>${e.value}</span><span style="font-size:0.78rem; opacity:0.85;">${e.position}</span>
      </div>`
    )
    .join('');

  let resumeSnippet = '';
  try {
    const profileRes = await fetch('/api/profile');
    if (profileRes.ok) {
      const profile = await profileRes.json();
      if (profile && profile.resumeText) {
        const lines = profile.resumeText.split('\n').filter((l) => l.trim());
        const summaryLines = lines.slice(0, 10).join('\n');
        resumeSnippet = `\n\n--------------------------------------------------\nAPPLICANT RESUME DETAILS & KEY HIGHLIGHTS:\n${summaryLines}\n--------------------------------------------------`;
      }
    }
  } catch (err) {
    console.warn('Could not fetch candidate profile resume:', err);
  }

  document.getElementById('composeSubject').value = `Application — ${job.title} at ${job.company}`;
  document.getElementById('composeBody').value =
    `Hello,\n\nI'm reaching out regarding the ${job.title} position at ${job.company}` +
    `${job.location ? ' (' + job.location + ')' : ''}. I believe my technical background and experience are a strong fit for your team.\n` +
    `${resumeSnippet}\n\n` +
    `Could you please let me know the best way to formally apply, or point me to the hiring manager?\n\n` +
    `Thank you for your time and consideration,\nJob Applicant`;

  document.getElementById('composeOverlay').classList.remove('hidden');
}

document.getElementById('closeCompose').addEventListener('click', closeCompose);
document.getElementById('cancelSend').addEventListener('click', closeCompose);
function closeCompose() {
  document.getElementById('composeOverlay').classList.add('hidden');
}

document.getElementById('tailorBtn').addEventListener('click', async () => {
  const job = state.activeJob;
  const hint = document.getElementById('tailorHint');
  const out = document.getElementById('tailoredResume');
  if (!job) return;

  const profileRes = await fetch('/api/profile');
  const profile = await profileRes.json();
  if (!profile.resumeText) {
    hint.textContent = 'Add your base resume in the Profile tab first.';
    hint.className = 'hint error';
    return;
  }

  hint.textContent = 'Tailoring with AI…';
  hint.className = 'hint';
  out.value = '';

  try {
    const res = await fetch('/api/resume/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeText: profile.resumeText,
        jobTitle: job.title,
        company: job.company,
        jobDescription: job.description || '',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      hint.textContent = data.error || 'Tailoring failed.';
      hint.className = 'hint error';
      return;
    }
    out.value = data.tailoredResume;
    hint.textContent = 'Review it, then attach if you\'re happy with it.';
  } catch {
    hint.textContent = 'Could not reach the server.';
    hint.className = 'hint error';
  }
});

document.getElementById('lookupBtn').addEventListener('click', async () => {
  const job = state.activeJob;
  const hint = document.getElementById('lookupHint');
  const resultsBox = document.getElementById('lookupResults');
  if (!job) return;

  const defaultDomain = guessCompanyDomain(job.company);
  const domain = prompt(
    `Enter website domain for ${job.company} to search verified emails:`,
    defaultDomain
  );
  if (!domain) return;

  hint.textContent = `Searching verified contacts for ${domain}…`;
  hint.className = 'hint';
  try {
    const res = await fetch(`/api/contacts/find?domain=${encodeURIComponent(domain)}`);
    const data = await res.json();
    if (!res.ok) {
      hint.textContent = data.error || 'Hunter API lookup not available. Showing suggested emails:';
      const suggested = autoSuggestEmails(job.company);
      resultsBox.innerHTML = suggested
        .map(
          (e) => `<div class="lookup-item" onclick="pickContact('${e.value}')">
            <span>${e.value}</span><span style="font-size:0.78rem; opacity:0.85;">${e.position}</span>
          </div>`
        )
        .join('');
      return;
    }
    if (!data.emails || !data.emails.length) {
      hint.textContent = 'No verified contacts found for that domain. Showing suggested emails:';
      const suggested = autoSuggestEmails(job.company);
      resultsBox.innerHTML = suggested
        .map(
          (e) => `<div class="lookup-item" onclick="pickContact('${e.value}')">
            <span>${e.value}</span><span style="font-size:0.78rem; opacity:0.85;">${e.position}</span>
          </div>`
        )
        .join('');
      return;
    }
    hint.textContent = `Found ${data.emails.length} contact(s) for ${domain}:`;
    resultsBox.innerHTML = data.emails
      .map(
        (e) => `<div class="lookup-item" onclick="pickContact('${e.value}')">
          <span>${e.value}</span><span>${e.position || 'Recruiting'}</span>
        </div>`
      )
      .join('');
  } catch {
    hint.textContent = 'Lookup failed. Showing suggested emails:';
    const suggested = autoSuggestEmails(job.company);
    resultsBox.innerHTML = suggested
      .map(
        (e) => `<div class="lookup-item" onclick="pickContact('${e.value}')">
          <span>${e.value}</span><span style="font-size:0.78rem; opacity:0.85;">${e.position}</span>
        </div>`
      )
      .join('');
  }
});

function pickContact(email) {
  document.getElementById('composeTo').value = email;
  const hint = document.getElementById('lookupHint');
  hint.textContent = `Selected recipient: ${email}`;
  hint.className = 'hint';
}
window.pickContact = pickContact;

document.getElementById('confirmSend').addEventListener('click', async () => {
  const to = document.getElementById('composeTo').value.trim();
  const subject = document.getElementById('composeSubject').value.trim();
  const body = document.getElementById('composeBody').value.trim();
  const sendHint = document.getElementById('sendHint');
  const job = state.activeJob;
  const attachResume = document.getElementById('attachResume').checked;
  const tailoredResume = document.getElementById('tailoredResume').value.trim();

  if (attachResume && !tailoredResume) {
    sendHint.textContent = 'Tailor (or write) a resume before attaching it.';
    sendHint.className = 'hint error';
    return;
  }

  if (!to || !subject || !body) {
    sendHint.textContent = 'Fill in the recipient, subject, and message.';
    sendHint.className = 'hint error';
    return;
  }

  const btn = document.getElementById('confirmSend');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const res = await fetch('/api/outreach/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject,
        body,
        jobId: job?.id,
        jobTitle: job?.title,
        company: job?.company,
        resumeAttachment: attachResume ? tailoredResume : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      sendHint.textContent = data.detail ? `${data.error}: ${data.detail}` : (data.error || 'Failed to send.');
      sendHint.className = 'hint error';
      return;
    }
    state.sentEmails = data.sentEmails || [];
    document.getElementById('sentCount').textContent = state.sentEmails.length;
    if (data.fallback) {
      showToast(`SMTP timed out - Outreach saved to log (Use RESEND_API_KEY for HTTP delivery)`);
    } else if (data.simulated) {
      showToast(`Outreach saved to log (Demo mode - configure SMTP/.env for live sending)`);
    } else {
      showToast(`Email sent successfully to ${to}`);
    }
    closeCompose();
  } catch {
    sendHint.textContent = 'Could not reach the server.';
    sendHint.className = 'hint error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send email';
  }
});

// ---------- Sent history ----------
async function loadSentHistory() {
  const res = await fetch('/api/outreach/history');
  const data = await res.json();
  state.sentEmails = data.sentEmails || [];
  document.getElementById('sentCount').textContent = state.sentEmails.length;
  const body = document.getElementById('sentBody');
  body.innerHTML = state.sentEmails
    .slice()
    .reverse()
    .map(
      (e) => `<tr>
        <td>${new Date(e.sentAt).toLocaleString()}</td>
        <td>${escapeHtml(e.to)}</td>
        <td>${escapeHtml(e.subject)}</td>
        <td>${escapeHtml(e.jobTitle || '')}</td>
        <td>${escapeHtml(e.company || '')}</td>
      </tr>`
    )
    .join('');
}

// ---------- Toast ----------
let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = isError ? 'toast error' : 'toast';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ---------- Init ----------
checkAuthAndInit();
