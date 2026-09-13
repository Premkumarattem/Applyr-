# Applyr — job search + AI-tailored outreach

Search open roles across several countries, let AI tailor your resume to a specific
posting, and send it straight to a recruiting contact — all from one place.

## What it does

- **Accounts** — simple username/password login. Each user's saved jobs, resume, and sent-mail history are kept separate.
- **Search** — pulls live job listings from the [Adzuna API](https://developer.adzuna.com/) (free tier), covering US, UK, India, Canada, Germany, France, Netherlands, Australia, Singapore, and more. Quick filters for C2C/Corp-to-Corp, W2 Contract, and Remote.
- **Save** — bookmark roles you're interested in.
- **Resume profile** — upload a `.pdf`, `.docx`, or `.txt` resume (text is auto-extracted) or paste it directly, all editable before saving.
- **Draft & send outreach** — compose an email per job, optionally look up a likely HR/recruiting contact for a company via [Hunter.io](https://hunter.io/) (optional, free tier available), then send it via **Resend** (recommended — free HTTPS API, works on every host) or your own SMTP account.
- **AI resume tailoring** — while drafting outreach for a specific job, click "Tailor with AI" and [Groq](https://console.groq.com/keys) (free tier) rewrites your resume's emphasis to match that posting — review it, then optionally attach it to the email as a `.txt` file. It's instructed to only reorder/rephrase what's genuinely in your resume, not invent experience — always review before sending.
- **Outreach log** — every email you send is recorded so you can track who you've contacted.

## Why not scrape LinkedIn?

LinkedIn's Terms of Service prohibit scraping job listings or contact data, and they don't
offer a public API for bulk job search. Building that would break their ToS and could get
an app (and your account) blocked. This app instead uses **Adzuna**, which explicitly
licenses its job data for this kind of use, plus optional **Hunter.io** lookups for
publicly-listed company contact patterns — both are legitimate, ToS-compliant sources.
If you want more job volume, you can add other compliant sources later (Greenhouse/Lever/
Workday public job boards, RemoteOK, Arbeitnow, USAJobs, etc. all have open APIs).

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Get an Adzuna API key** (free) at https://developer.adzuna.com/ — you'll get an
   `app_id` and `app_key` instantly.

3. **Set up email sending.** Two options:
   - **Resend (recommended)** — free HTTPS API that works on every host, including Railway's free tier, which blocks raw SMTP entirely. Get a free key at https://resend.com/api-keys and set `RESEND_API_KEY`. Without a verified domain, you can still send from `onboarding@resend.dev` for testing.
   - **SMTP** — works on Render and most hosts, but **not on Railway's free/hobby plan** (Railway blocks outbound SMTP ports there — use Resend instead if you're on Railway). For Gmail: enable 2FA, then create an [App Password](https://myaccount.google.com/apppasswords).

4. **(Optional) Get a free Groq API key** at https://console.groq.com/keys if you want AI resume
   tailoring. Without it, the Profile tab and "Tailor with AI" button just won't do anything —
   the rest of the app works fine.

5. **(Optional) Get a Hunter.io key** at https://hunter.io/ if you want the "Find contact"
   button to look up recruiting emails by company domain. Without it, you just type the
   HR email in manually — the app works fine either way.

6. **Copy the env file and fill in your keys**
   ```bash
   cp .env.example .env
   ```
   Also set `SESSION_SECRET` to a random string (used to sign login sessions):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

7. **Run it**
   ```bash
   npm start
   ```
   Open http://localhost:3000

## Sending outreach responsibly

A few things baked in, and a few things worth doing yourself:

- The send endpoint is rate-limited (30 emails/hour) to discourage accidental mass-blasting.
- Every email requires a real recipient address, subject, and body — no bulk/blind sending.
- **You should still**: personalize each message, only email addresses that are genuinely
  work/recruiting contacts (not scraped personal addresses), and comply with your country's
  anti-spam law (e.g. CAN-SPAM in the US, PECR/GDPR in the UK/EU) — which generally means
  identifying yourself clearly and not sending unsolicited bulk commercial email.

## Project structure

```
jobfinder/
  server.js          Express API (job search, contact lookup, email sending)
  store.js           Simple JSON file storage for saved jobs + sent-email log
  public/            Frontend (vanilla HTML/CSS/JS, no build step)
  .env.example       Copy to .env and fill in your keys
```

## Extending it

- Swap `store.js` for a real database (SQLite/Postgres) once you have multiple users.
- Add user accounts/auth if this becomes multi-user.
- Add more job sources by adding new routes alongside `/api/jobs/search` and merging results.
- Add a "mark as replied" status to the outreach log to track responses.
