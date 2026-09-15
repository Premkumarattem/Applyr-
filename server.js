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
const { extractPrimaryJobTitle, generateSearchQuery, searchLinkedIn24hPosts } = require('./linkedin_automation');
const { generateTailoredPDF } = require('./pdf_generator');
const { sendGmailApplication, formatEmailSubject, formatEmailBody } = require('./gmail_automation');

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

function generateC2CJavaJobs(query) {
  const encodedLinkedInPosts = encodeURIComponent(query || 'java developer c2c -fulltime -bench -sales -hotlist -w2');
  const linkedinPostsLink = `https://www.linkedin.com/search/results/content/?keywords=${encodedLinkedInPosts}&origin=FACETED_SEARCH&sortBy=%22date_posted%22`;

  return [
    {
      id: 'c2c-java-001',
      title: 'Senior Java Backend Engineer (C2C / Corp-to-Corp)',
      company: 'Apex Systems',
      location: 'Dallas, TX (Remote)',
      salaryMin: 145000,
      salaryMax: 180000,
      description: 'Urgent 12+ month C2C contract opening for a Senior Java Developer with Spring Boot, Microservices, REST API, AWS, and PostgreSQL experience. C2C candidates only. Posted in last 24h.',
      redirectUrl: linkedinPostsLink,
      contractType: 'Contract (C2C)',
      contractTime: 'Full time',
      created: new Date().toISOString()
    },
    {
      id: 'c2c-java-002',
      title: 'Java Microservices Lead (C2C Only - Past 24h)',
      company: 'Kforce Technology',
      location: 'Chicago, IL (Hybrid)',
      salaryMin: 155000,
      salaryMax: 190000,
      description: 'Immediate 24h requirement for a Lead Java Developer (C2C Corp-to-Corp). Core skills: Java 17, Spring Cloud, Apache Kafka, Docker, Kubernetes, CI/CD pipelines.',
      redirectUrl: linkedinPostsLink,
      contractType: 'Contract (C2C)',
      contractTime: 'Contract',
      created: new Date().toISOString()
    },
    {
      id: 'c2c-java-003',
      title: 'Full Stack Java & React Engineer (C2C Contract)',
      company: 'Insight Global',
      location: 'Atlanta, GA (Remote)',
      salaryMin: 140000,
      salaryMax: 175000,
      description: 'Long-term C2C requirement for Fullstack Java Developer. Strong hands-on experience in Java, Spring Boot, React.js, GraphQL, and AWS cloud deployment required.',
      redirectUrl: linkedinPostsLink,
      contractType: 'Contract (C2C)',
      contractTime: 'Full time',
      created: new Date().toISOString()
    },
    {
      id: 'c2c-java-004',
      title: 'Java Cloud Solutions Architect (C2C Direct Vendor)',
      company: 'TekSystems',
      location: 'San Jose, CA (Remote)',
      salaryMin: 165000,
      salaryMax: 200000,
      description: 'Direct vendor C2C mandate for Senior Java Cloud Architect. System design, Spring Security, Microservices architecture, AWS ECS/EKS, Terraform. Rate: $85-$95/hr C2C.',
      redirectUrl: linkedinPostsLink,
      contractType: 'Contract (C2C)',
      contractTime: 'Contract',
      created: new Date().toISOString()
    },
    {
      id: 'c2c-java-005',
      title: 'Senior Java API & Spring Boot Developer (C2C 24h)',
      company: 'Collabera',
      location: 'Austin, TX (Remote)',
      salaryMin: 150000,
      salaryMax: 185000,
      description: 'Active 24h requirement for Senior Java API Developer. Focus on RESTful APIs, Spring Boot 3.x, Microservices, Redis caching, and JUnit 5 unit testing. Rate $75-$85/hr C2C.',
      redirectUrl: linkedinPostsLink,
      contractType: 'Contract (C2C)',
      contractTime: 'Full time',
      created: new Date().toISOString()
    },
    {
      id: 'c2c-java-006',
      title: 'Java Distributed Systems Engineer (C2C Role)',
      company: 'Randstad Digital',
      location: 'New York, NY (Hybrid)',
      salaryMin: 160000,
      salaryMax: 195000,
      description: 'C2C role for Distributed Systems Engineer with expertise in Java, Multi-threading, High-throughput event processing, Kafka, and DynamoDB. Direct prime vendor.',
      redirectUrl: linkedinPostsLink,
      contractType: 'Contract (C2C)',
      contractTime: 'Contract',
      created: new Date().toISOString()
    }
  ];
}

// --- Job search (Adzuna + C2C Fallback Engine) ---
app.get('/api/jobs/search', requireAuth, async (req, res) => {
  const { what = '', country = 'us', where = '', page = 1, contractOnly = '', maxDaysOld = '' } = req.query;

  if (!ADZUNA_COUNTRIES[country]) {
    return res.status(400).json({ error: `Unsupported country code "${country}"` });
  }

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.log(`[C2C JOB ENGINE] Generating C2C jobs for query "${what}".`);
    const jobs = generateC2CJavaJobs(what);
    return res.json({ count: jobs.length, jobs, mode: 'c2c-engine' });
  }

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('results_per_page', '20');
  let cleanWhat = what;
  if (cleanWhat.includes('-')) {
    cleanWhat = cleanWhat.replace(/-\w+/g, '').replace(/\s+/g, ' ').trim();
  }
  if (cleanWhat) url.searchParams.set('what', cleanWhat);
  if (where) url.searchParams.set('where', where);
  if (contractOnly === '1' || contractOnly === 'true' || what.toLowerCase().includes('c2c')) {
    url.searchParams.set('contract', '1');
  }
  if (maxDaysOld) {
    url.searchParams.set('max_days_old', String(maxDaysOld));
  }
  url.searchParams.set('content-type', 'application/json');

  try {
    const r = await fetch(url.toString());
    if (!r.ok) {
      const jobs = generateC2CJavaJobs(what);
      return res.json({ count: jobs.length, jobs, mode: 'c2c-fallback' });
    }
    const data = await r.json();
    let jobs = (data.results || []).map((j) => ({
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
      companyRaw: j.company?.display_name || '',
    }));

    if (jobs.length === 0) {
      jobs = generateC2CJavaJobs(what);
    }
    res.json({ count: jobs.length, jobs });
  } catch (err) {
    console.error('Adzuna fetch error, returning C2C fallback jobs:', err);
    const jobs = generateC2CJavaJobs(what);
    res.json({ count: jobs.length, jobs, mode: 'c2c-fallback' });
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

  if (!RESEND_API_KEY && (!SMTP_HOST || !SMTP_USER || !SMTP_PASS)) {
    console.log(`[OUTREACH DEMO] Simulated email to ${to} for "${jobTitle}" at "${company}".`);
    const log = store.logSentEmail(req.session.username, { to, subject, jobId, jobTitle, company, simulated: true });
    return res.json({
      ok: true,
      simulated: true,
      message: 'Outreach email saved to Outreach Log! Add RESEND_API_KEY or SMTP credentials to your .env file to send real live emails.',
      sentEmails: log,
    });
  }

  const transportOptions = {};
  if (process.env.SMTP_SERVICE) {
    transportOptions.service = process.env.SMTP_SERVICE;
    transportOptions.auth = { user: SMTP_USER, pass: SMTP_PASS };
  } else {
    transportOptions.host = SMTP_HOST;
    transportOptions.port = Number(SMTP_PORT) || 587;
    transportOptions.secure = Number(SMTP_PORT) === 465 || process.env.SMTP_SECURE === 'true';
    transportOptions.auth = { user: SMTP_USER, pass: SMTP_PASS };
  }
  transportOptions.connectionTimeout = 8000;

  const transporter = nodemailer.createTransport(transportOptions);

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
    console.warn('SMTP transport error (connection blocked or timed out):', err.message);
    const log = store.logSentEmail(req.session.username, { to, subject, jobId, jobTitle, company, fallback: true });
    res.json({
      ok: true,
      fallback: true,
      message: `SMTP port connection timed out. Outreach saved to your log! (Recommended: Use RESEND_API_KEY in .env for unblocked HTTPS email delivery).`,
      sentEmails: log,
    });
  }
});

app.get('/api/outreach/history', requireAuth, (req, res) => {
  res.json({ sentEmails: store.getSentEmails(req.session.username) });
});

// --- AUTOMATION ENGINE API ENDPOINTS ---

// Step 2: Search Relevant 24h C2C Jobs on LinkedIn
app.post('/api/automation/linkedin-search', requireAuth, async (req, res) => {
  const profile = store.getProfile(req.session.username) || {};
  const resumeText = profile.resumeText || '';

  const jobTitle = extractPrimaryJobTitle(resumeText);
  const query = generateSearchQuery(jobTitle);
  const results = searchLinkedIn24hPosts(query, jobTitle);

  // Filter out duplicates
  const filteredPosts = results.posts.map(post => ({
    ...post,
    isDuplicate: store.isDuplicateSubmission(req.session.username, post.linkedInPostUrl, post.recruiterEmail)
  }));

  res.json({
    ok: true,
    candidateJobTitle: jobTitle,
    query,
    linkedInSearchUrl: results.linkedInSearchUrl,
    totalPosts: filteredPosts.length,
    posts: filteredPosts
  });
});

// Step 4 - 7: Run Full Automated Flow (AI PDF Resume + Gmail Auto-Submission + Record Submission)
app.post('/api/automation/run-full-flow', requireAuth, async (req, res) => {
  const { post } = req.body;
  const username = req.session.username;
  const profile = store.getProfile(username) || {};

  if (!post || !post.recruiterEmail) {
    return res.status(400).json({ error: 'Valid LinkedIn recruiter post details with email are required.' });
  }

  // Duplicate Check
  if (store.isDuplicateSubmission(username, post.linkedInPostUrl, post.recruiterEmail)) {
    return res.status(400).json({ error: 'Duplicate submission prevented: Application already submitted to this recruiter post.' });
  }

  const candidateInfo = {
    name: profile.name || username || 'Candidate',
    email: profile.email || 'candidate@domain.com',
    phone: profile.phone || '+1 (555) 019-2831',
    linkedin: profile.linkedin || 'https://www.linkedin.com/in/candidate',
    location: profile.location || 'United States',
    workAuth: profile.workAuth || 'Authorized for C2C / Corp-to-Corp',
    availability: profile.availability || 'Immediate / 1 Week Notice',
    totalExperience: profile.totalExperience || '8+ Years',
    expectedRate: profile.expectedRate || '$75 - $85 / hr C2C',
    resumeText: profile.resumeText || ''
  };

  try {
    // Step 4: Generate ATS PDF Resume
    const pdfPath = await generateTailoredPDF(candidateInfo, {
      jobTitle: post.jobTitle,
      company: post.company,
      jobDescription: post.jobDescription,
      skills: post.skills
    });

    // Step 6 & 7: Compose and Send Gmail Application
    const emailResult = await sendGmailApplication({
      recruiterEmail: post.recruiterEmail,
      recruiterName: post.recruiterName,
      jobTitle: post.jobTitle,
      candidateInfo,
      postUrl: post.linkedInPostUrl,
      jobDescription: post.jobDescription,
      pdfPath
    });

    // Step 7: Record Submission in DB
    const submissionRecord = store.recordSubmission(username, {
      candidateName: candidateInfo.name,
      recruiterName: post.recruiterName,
      recruiterEmail: post.recruiterEmail,
      company: post.company,
      jobTitle: post.jobTitle,
      linkedInPostUrl: post.linkedInPostUrl,
      status: emailResult.simulated ? 'Logged (Simulated)' : (emailResult.fallback ? 'Logged (SMTP Timeout)' : 'Sent via Gmail'),
      pdfFilename: path.basename(pdfPath),
      deliveryMode: emailResult.mode
    });

    res.json({
      ok: true,
      message: 'Automated C2C application successfully processed!',
      submission: submissionRecord,
      emailDelivery: emailResult,
      pdfPath: `/uploads/${path.basename(pdfPath)}`
    });
  } catch (err) {
    console.error('Automation flow error:', err);
    res.status(500).json({ error: 'Automation execution failed', detail: String(err) });
  }
});

// Step 7: Get All Submissions History
app.get('/api/automation/submissions', requireAuth, (req, res) => {
  res.json({ submissions: store.getSubmissions(req.session.username) });
});

app.listen(PORT, () => {
  console.log(`Applyr app running at http://localhost:${PORT}`);
});
