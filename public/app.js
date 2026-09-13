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
    const isLogin = tab.dataset.authview === 'login';
    document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
    document.getElementById('registerForm').classList.toggle('hidden', isLogin);
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
    hint.textContent = 'Saved.';
    hint.className = 'hint';
    showToast('Resume saved');
  } catch {
    hint.textContent = 'Failed to save.';
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

function linkedinSearchUrl(what = '', where = '', extraLocation = '') {
  const url = new URL('https://www.linkedin.com/jobs/search/');
  if (what) url.searchParams.set('keywords', what);
  const loc = where || extraLocation;
  if (loc) url.searchParams.set('location', loc);
  return url.toString();
}

document.getElementById('openLinkedinBtn').addEventListener('click', () => {
  const what = document.getElementById('what').value.trim();
  const where = document.getElementById('where').value.trim();
  window.open(linkedinSearchUrl(what, where), '_blank', 'noopener');
});

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  document.getElementById('contractOnly').checked = false;
  document.getElementById('where').value = '';
});

document.querySelectorAll('.chip[data-preset]').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    const preset = chip.dataset.preset;
    if (preset === 'c2c') {
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

  const meta = document.getElementById('resultsMeta');
  const results = document.getElementById('results');
  meta.textContent = 'Searching…';
  results.innerHTML = '';

  try {
    const url = `/api/jobs/search?what=${encodeURIComponent(what)}&country=${country}&where=${encodeURIComponent(where)}&contractOnly=${contractOnly ? '1' : '0'}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      meta.textContent = '';
      results.innerHTML = `<div class="empty-state">${data.error || 'Something went wrong.'}</div>`;
      return;
    }
    state.jobs = data.jobs || [];
    const filterNote = contractOnly ? ' (Contract only ✓ — uncheck to widen results)' : '';
    meta.textContent = `${data.count?.toLocaleString() || state.jobs.length} roles found — showing first ${state.jobs.length}${filterNote}`;
    renderJobs(state.jobs, results);
  } catch (err) {
    meta.textContent = '';
    results.innerHTML = `<div class="empty-state">Couldn't reach the server. Is it running?</div>`;
  }
});

function renderJobs(jobs, container) {
  if (!jobs.length) {
    container.innerHTML = '<div class="empty-state">No roles matched. Try a broader title or a different country.</div>';
    return;
  }
  container.innerHTML = jobs
    .map(
      (job, i) => `
    <div class="job-row" data-id="${job.id}">
      <div class="job-index">${String(i + 1).padStart(2, '0')}</div>
      <div class="job-main">
        <h3>${escapeHtml(job.title)}</h3>
        <div class="job-meta">
          <span>${escapeHtml(job.company)}</span>
          <span>${escapeHtml(job.location)}</span>
          ${job.contractType ? `<span class="badge-contract">${escapeHtml(job.contractType)}${job.contractTime ? ' · ' + escapeHtml(job.contractTime) : ''}</span>` : ''}
          ${salaryLabel(job)}
        </div>
        <p class="job-desc">${escapeHtml((job.description || '').slice(0, 180))}${job.description && job.description.length > 180 ? '…' : ''}</p>
      </div>
      <div class="job-actions">
        <button class="btn-primary" onclick="openCompose('${job.id}')">Draft email</button>
        <button class="btn-ghost" onclick="saveJob('${job.id}')">Save</button>
        <a href="${job.redirectUrl}" target="_blank" rel="noopener">View posting ↗</a>
        <a href="${linkedinSearchUrl(job.title, job.company, job.location)}" target="_blank" rel="noopener">Search on LinkedIn ↗</a>
      </div>
    </div>`
    )
    .join('');
}

function salaryLabel(job) {
  if (!job.salaryMin && !job.salaryMax) return '';
  const fmt = (n) => (n ? Math.round(n).toLocaleString() : '');
  return `<span class="salary">${fmt(job.salaryMin)}${job.salaryMax ? '–' + fmt(job.salaryMax) : ''}</span>`;
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
function openCompose(jobId) {
  const job = state.jobs.find((j) => j.id === jobId) || state.savedJobs.find((j) => j.id === jobId);
  if (!job) return;
  state.activeJob = job;

  document.getElementById('composeTo').value = '';
  document.getElementById('lookupResults').innerHTML = '';
  document.getElementById('lookupHint').textContent = '';
  document.getElementById('sendHint').textContent = '';
  document.getElementById('sendHint').className = 'hint';
  document.getElementById('tailorHint').textContent = '';
  document.getElementById('tailorHint').className = 'hint';
  document.getElementById('tailoredResume').value = '';
  document.getElementById('attachResume').checked = false;

  document.getElementById('composeSubject').value = `Application — ${job.title} at ${job.company}`;
  document.getElementById('composeBody').value =
    `Hello,\n\nI'm reaching out about the ${job.title} role at ${job.company}` +
    `${job.location ? ' (' + job.location + ')' : ''}. I came across the listing and believe my background ` +
    `is a strong fit — I'd welcome the chance to share more and discuss next steps.\n\n` +
    `Could you let me know the best way to formally apply, or point me to the right person on the team?\n\n` +
    `Thank you for your time,\n[Your name]`;

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

  // Ask the user for the company's website domain since we only have a company name.
  const domain = prompt(
    `Enter ${job.company}'s website domain to look up a recruiting contact (e.g. company.com).\nLeave blank to skip — you can always enter the HR email manually.`
  );
  if (!domain) return;

  hint.textContent = 'Looking up…';
  resultsBox.innerHTML = '';
  try {
    const res = await fetch(`/api/contacts/find?domain=${encodeURIComponent(domain)}`);
    const data = await res.json();
    if (!res.ok) {
      hint.textContent = data.error || 'Lookup failed.';
      hint.className = 'hint error';
      return;
    }
    if (!data.emails.length) {
      hint.textContent = 'No HR contacts found for that domain. Enter the email manually.';
      return;
    }
    hint.textContent = `Found ${data.emails.length} possible contact(s):`;
    resultsBox.innerHTML = data.emails
      .map(
        (e) => `<div class="lookup-item" onclick="pickContact('${e.value}')">
          <span>${e.value}</span><span>${e.position || ''}</span>
        </div>`
      )
      .join('');
  } catch {
    hint.textContent = 'Lookup failed. Enter the email manually.';
    hint.className = 'hint error';
  }
});

function pickContact(email) {
  document.getElementById('composeTo').value = email;
}

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
      sendHint.textContent = data.error || 'Failed to send.';
      sendHint.className = 'hint error';
      return;
    }
    state.sentEmails = data.sentEmails || [];
    document.getElementById('sentCount').textContent = state.sentEmails.length;
    showToast(`Email sent to ${to}`);
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
