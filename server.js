require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mammoth = require('mammoth');
const path = require('path');
const store = require('./store');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me-in-production';
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.FORCE_SECURE_COOKIE === '1',
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// pdfjs-dist ships as ESM only; load it lazily via dynamic import from this CJS file.
let pdfjsLibPromise;
function getPdfjs() {
  if (!pdfjsLibPromise) pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsLibPromise;
}
async function extractPdfText(buffer) {
  const pdfjsLib = await getPdfjs();
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useWorkerFetch: false,
  }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n';
  }
  return text.trim();
}

function requireAuth(req, res, next) {
  if (!req.session.username) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

// --- Auth ---
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: 'Username and a password (6+ characters) are required.' });
  }
  const clean = String(username).trim().toLowerCase();
  if (store.userExists(clean)) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  store.createUser(clean, passwordHash);
  req.session.username = clean;
  res.json({ username: clean });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const clean = String(username || '').trim().toLowerCase();
  const user = store.getUser(clean);
  if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid username or password.' });
  req.session.username = clean;
  res.json({ username: clean });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Username and a new password (6+ characters) are required.' });
  }
  const clean = String(username).trim().toLowerCase();
  if (!store.userExists(clean)) {
    return res.status(404).json({ error: 'Username not found. Please check your username or sign up.' });
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  store.updatePassword(clean, passwordHash);
  res.json({ ok: true, message: 'Password updated successfully! You can now log in.' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'Not logged in' });
  res.json({ username: req.session.username });
});

// Countries Adzuna's free API supports
const ADZUNA_COUNTRIES = {
  us: 'United States', gb: 'United Kingdom', in: 'India', ca: 'Canada',
  de: 'Germany', fr: 'France', nl: 'Netherlands', au: 'Australia',
  sg: 'Singapore', at: 'Austria', be: 'Belgium', br: 'Brazil',
  es: 'Spain', it: 'Italy', mx: 'Mexico', nz: 'New Zealand',
  pl: 'Poland', za: 'South Africa',
};

app.get('/api/countries', (req, res) => {
  res.json(ADZUNA_COUNTRIES);
});

// --- Job search (Adzuna) ---
app.get('/api/jobs/search', requireAuth, async (req, res) => {
  const { what = '', country = 'us', where = '', page = 1, contractOnly = '' } = req.query;

  if (!ADZUNA_COUNTRIES[country]) {
    return res.status(400).json({ error: `Unsupported country code "${country}"` });
  }
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    return res.status(500).json({
      error: 'Adzuna API keys are not configured. Add ADZUNA_APP_ID and ADZUNA_APP_KEY to your .env file.',
    });
  }

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('results_per_page', '20');
  if (what) url.searchParams.set('what', what);
  if (where) url.searchParams.set('where', where);
  if (contractOnly === '1' || contractOnly === 'true') {
    url.searchParams.set('contract', '1');
  }
  url.searchParams.set('content-type', 'application/json');

  try {
    const r = await fetch(url.toString());
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Adzuna API error', detail: text });
    }
    const data = await r.json();
    const jobs = (data.results || []).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company?.display_name || 'Unknown company',
      location: j.location?.display_name || '',
      salaryMin: j.salary_min,
      salaryMax: j.salary_max,
      description: j.description,
      redirectUrl: j.redirect_url,
      created: j.created,
      contractType: j.contract_type || null,
      contractTime: j.contract_time || null,
      // Guess a company domain-free HR contact placeholder; real lookup happens via /api/contacts/find
      companyRaw: j.company?.display_name || '',
    }));
    res.json({ count: data.count, jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch jobs', detail: String(err) });
  }
});

app.post('/api/jobs/save', requireAuth, (req, res) => {
  const job = req.body;
  if (!job || !job.id) return res.status(400).json({ error: 'Invalid job payload' });
  const saved = store.saveJob(req.session.username, job);
  res.json({ savedJobs: saved });
});

app.get('/api/jobs/saved', requireAuth, (req, res) => {
  res.json({ savedJobs: store.getSavedJobs(req.session.username) });
});

// --- Optional: find a likely recruiting/HR contact email via Hunter.io ---
// Only runs if HUNTER_API_KEY is set. This looks up publicly listed pattern
// emails for a company DOMAIN you provide — it does not scrape LinkedIn or
// guess personal emails without basis.
app.get('/api/contacts/find', requireAuth, async (req, res) => {
  const { domain } = req.query;
  const key = process.env.HUNTER_API_KEY;
  if (!key) {
    return res.status(400).json({
      error: 'Hunter.io is not configured. Add HUNTER_API_KEY to .env, or enter the HR email manually.',
    });
  }
  if (!domain) return res.status(400).json({ error: 'domain query param is required' });

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(
      domain
    )}&department=hr&api_key=${key}`;
    const r = await fetch(url);
    const data = await r.json();
    const emails = (data?.data?.emails || []).map((e) => ({
      value: e.value,
      firstName: e.first_name,
      lastName: e.last_name,
      position: e.position,
      confidence: e.confidence,
    }));
    res.json({ domain, emails });
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed', detail: String(err) });
  }
});

// --- Profile: store your base resume once ---
app.get('/api/profile', requireAuth, (req, res) => {
  res.json(store.getProfile(req.session.username));
});

app.post('/api/profile', requireAuth, (req, res) => {
  const { resumeText } = req.body;
  if (typeof resumeText !== 'string') {
    return res.status(400).json({ error: 'resumeText (string) is required' });
  }
  res.json(store.saveProfile(req.session.username, { resumeText }));
});

// --- Resume file upload: extract text from PDF, DOCX, or plain text ---
app.post('/api/profile/upload-resume', requireAuth, upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "resume").' });

  const { originalname, mimetype, buffer } = req.file;
  const lower = originalname.toLowerCase();

  try {
    let text = '';
    if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
      text = await extractPdfText(buffer);
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lower.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (mimetype === 'text/plain' || lower.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else {
      return res.status(400).json({
        error: 'Unsupported file type. Upload a .pdf, .docx, or .txt file (old .doc files are not supported — save as .docx first).',
      });
    }

    text = text.trim();
    if (!text) {
      return res.status(422).json({ error: 'Could not extract any text from that file. Try a different file or paste your resume as text.' });
    }
    res.json({ resumeText: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read that file', detail: String(err) });
  }
});

// --- Resume tailoring via Groq (free-tier LLM API) ---
// Get a free key at https://console.groq.com/keys
app.post('/api/resume/tailor', requireAuth, async (req, res) => {
  const { resumeText, jobTitle, company, jobDescription } = req.body;
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (!key) {
    return res.status(500).json({
      error: 'Groq is not configured. Add GROQ_API_KEY to your .env file (free key at console.groq.com/keys).',
    });
  }
  if (!resumeText) {
    return res.status(400).json({ error: 'Save a base resume in your Profile tab first.' });
  }
  if (!jobTitle || !jobDescription) {
    return res.status(400).json({ error: 'jobTitle and jobDescription are required' });
  }

  const prompt = `You are helping a job seeker tailor their resume to a specific job posting.
Rewrite the resume below so its bullet points and summary emphasize the skills and experience
most relevant to the target job. Do not invent experience, employers, dates, or skills that
aren't already present in the original resume — only reorder, re-emphasize, and rephrase what's
really there. Keep it roughly the same length as the original. Output only the revised resume
text, with no preamble or commentary.

TARGET JOB TITLE: ${jobTitle}
TARGET COMPANY: ${company || 'Unknown'}
TARGET JOB DESCRIPTION:
${jobDescription}

ORIGINAL RESUME:
${resumeText}`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Groq API error', detail: text });
    }
    const data = await r.json();
    const tailored = data.choices?.[0]?.message?.content?.trim();
    if (!tailored) {
      return res.status(500).json({ error: 'Groq returned an empty response' });
    }
    res.json({ tailoredResume: tailored });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reach Groq', detail: String(err) });
  }
});

// --- Outreach: send an email to an HR contact ---
// Rate-limited to discourage accidental mass-spamming from the UI.
const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 outreach emails per hour per user
  message: { error: 'Rate limit reached. Please slow down your outreach — quality over volume.' },
  keyGenerator: (req) => req.session?.username || req.ip,
});

app.post('/api/outreach/send', requireAuth, sendLimiter, async (req, res) => {
  const { to, subject, body, jobId, jobTitle, company, resumeAttachment } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body are required' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ error: 'Invalid recipient email address' });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME, RESEND_API_KEY } = process.env;

  const attachments = [];
  if (resumeAttachment) {
    attachments.push({
      filename: `resume-${(company || 'application').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`,
      content: resumeAttachment,
    });
  }

  // Prefer Resend (HTTPS API) when configured — it works even on hosts that
  // block outbound SMTP ports (Railway's free/hobby plans, for example).
  if (RESEND_API_KEY) {
    try {
      const payload = {
        from: `${FROM_NAME || 'Job Applicant'} <${FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: [to],
        subject,
        text: body,
      };
      if (resumeAttachment) {
        payload.attachments = [
          {
            filename: attachments[0].filename,
            content: Buffer.from(resumeAttachment, 'utf-8').toString('base64'),
          },
        ];
      }
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const detail = await r.text();
        return res.status(r.status).json({ error: 'Resend API error', detail });
      }
      const log = store.logSentEmail(req.session.username, { to, subject, jobId, jobTitle, company });
      return res.json({ ok: true, sentEmails: log });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to send via Resend', detail: String(err) });
    }
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({
      error:
        'No email method configured. Add RESEND_API_KEY (recommended — works on all hosts, free at resend.com) ' +
        'or SMTP_HOST/SMTP_USER/SMTP_PASS to your .env file. Note: Railway\'s free/hobby plan blocks outbound SMTP entirely — use Resend there.',
    });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000, // fail fast (10s) instead of hanging indefinitely on blocked ports
  });

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME || 'Job Applicant'}" <${FROM_EMAIL || SMTP_USER}>`,
      to,
      subject,
      text: body,
      attachments,
    });
    const log = store.logSentEmail(req.session.username, { to, subject, jobId, jobTitle, company });
    res.json({ ok: true, sentEmails: log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email', detail: String(err) });
  }
});

app.get('/api/outreach/history', requireAuth, (req, res) => {
  res.json({ sentEmails: store.getSentEmails(req.session.username) });
});

app.listen(PORT, () => {
  console.log(`Applyr app running at http://localhost:${PORT}`);
});
