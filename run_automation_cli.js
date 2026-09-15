require('dotenv').config();
const path = require('path');
const store = require('./store');
const { extractPrimaryJobTitle, generateSearchQuery, searchLinkedIn24hPosts } = require('./linkedin_automation');
const { generateTailoredPDF } = require('./pdf_generator');
const { sendGmailApplication, formatEmailSubject, formatEmailBody } = require('./gmail_automation');

async function runCliAutomation() {
  console.log('======================================================================');
  console.log('⚡ LINKEDIN C2C AUTOMATION ENGINE — 24H JOB FINDER & GMAIL SUBMISSION');
  console.log('======================================================================\n');

  // Step 1: Candidate Session & Profile
  const candidateInfo = {
    name: 'Premkumar Attem',
    email: 'premkumarattem@gmail.com',
    phone: '+1 (555) 019-2831',
    linkedin: 'https://www.linkedin.com/in/premkumarattem',
    location: 'United States',
    workAuth: 'Authorized for C2C / Corp-to-Corp',
    availability: 'Immediate / 1 Week Notice',
    totalExperience: '8+ Years',
    expectedRate: '$75 - $85 / hr C2C',
    resumeText: `Premkumar Attem
Senior Java Developer & Microservices Architect
Summary: Senior Java Consultant with 8+ years experience building enterprise microservices using Java 17, Spring Boot, REST APIs, SQL, and AWS Cloud infrastructure.`
  };

  // Step 2: Search Query Generation based on Resume
  const candidateJobTitle = extractPrimaryJobTitle(candidateInfo.resumeText);
  const searchQuery = generateSearchQuery(candidateJobTitle);
  console.log(`[Step 2] Candidate Job Title Extracted: "${candidateJobTitle}"`);
  console.log(`[Step 2] Formatted LinkedIn Search Query: ${searchQuery}`);

  // Step 2 & 3: 24h LinkedIn Post Extraction
  const searchResult = searchLinkedIn24hPosts(searchQuery, candidateJobTitle);
  console.log(`[Step 3] Search URL: ${searchResult.linkedInSearchUrl}`);
  console.log(`[Step 3] Recruiter Posts Collected (Last 24 Hours): ${searchResult.posts.length} posts\n`);

  for (let i = 0; i < searchResult.posts.length; i++) {
    const post = searchResult.posts[i];
    console.log(`----------------------------------------------------------------------`);
    console.log(`Post #${i + 1}: ${post.jobTitle} at ${post.company}`);
    console.log(`Recruiter: ${post.recruiterName} <${post.recruiterEmail}>`);
    console.log(`Post URL: ${post.linkedInPostUrl}`);
    console.log(`Date Posted: ${post.datePosted}`);

    // Duplicate Check
    const isDup = store.isDuplicateSubmission('cli_user', post.linkedInPostUrl, post.recruiterEmail);
    if (isDup) {
      console.log(`[Duplicate Prevention] ⚠️ SKIP: Post or recruiter email already processed.`);
      continue;
    }

    // Step 4: AI Resume Customization & ATS PDF Generation
    console.log(`[Step 4] Generating ATS-Friendly Customized PDF Resume...`);
    const pdfPath = await generateTailoredPDF(candidateInfo, {
      jobTitle: post.jobTitle,
      company: post.company,
      jobDescription: post.jobDescription,
      skills: post.skills
    });
    console.log(`[Step 4] PDF Created Successfully: ${path.basename(pdfPath)}`);

    // Step 5 & 6: Compose Email Template
    console.log(`[Step 6] Composing Gmail Application (Subject: "${formatEmailSubject(post.jobTitle)}")...`);

    // Step 7: Send Email & Record Submission
    console.log(`[Step 7] Sending Email to Recruiter (${post.recruiterEmail})...`);
    const emailResult = await sendGmailApplication({
      recruiterEmail: post.recruiterEmail,
      recruiterName: post.recruiterName,
      jobTitle: post.jobTitle,
      candidateInfo,
      postUrl: post.linkedInPostUrl,
      jobDescription: post.jobDescription,
      pdfPath
    });

    const record = store.recordSubmission('cli_user', {
      candidateName: candidateInfo.name,
      recruiterName: post.recruiterName,
      recruiterEmail: post.recruiterEmail,
      company: post.company,
      jobTitle: post.jobTitle,
      linkedInPostUrl: post.linkedInPostUrl,
      status: emailResult.simulated ? 'Logged (Simulated)' : 'Sent via Gmail',
      pdfFilename: path.basename(pdfPath),
      deliveryMode: emailResult.mode
    });

    console.log(`[Step 7] Record Saved to Database: Record ID ${record.id}`);
    console.log(`[Step 7] Delivery Status: ${record.status} (${record.deliveryMode})\n`);
  }

  console.log('======================================================================');
  console.log('✅ AUTOMATION PIPELINE EXECUTED SUCCESSFULLY!');
  console.log('======================================================================');
}

runCliAutomation().catch(console.error);
