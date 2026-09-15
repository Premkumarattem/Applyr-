const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate a clean, ATS-friendly PDF resume tailored to the given job.
 * @param {Object} candidateInfo - Candidate details (name, email, phone, location, linkedin, resumeText)
 * @param {Object} jobDetails - Target job details (jobTitle, company, jobDescription, skills)
 * @param {string} outputDir - Directory to save generated PDF
 * @returns {Promise<string>} Path to the generated PDF file
 */
async function generateTailoredPDF(candidateInfo, jobDetails, outputDir = path.join(__dirname, 'public', 'uploads')) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeName = (candidateInfo.name || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
  const safeTitle = (jobDetails.jobTitle || 'Role').replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = Date.now();
  const filename = `Resume_${safeName}_${safeTitle}_${timestamp}.pdf`;
  const filePath = path.join(outputDir, filename);

  // Extract skills & match keywords
  const jobText = (jobDetails.jobDescription || '') + ' ' + (jobDetails.skills || []).join(' ');
  const keywords = extractKeywords(jobText);
  const baseResume = candidateInfo.resumeText || '';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // --- Header Section ---
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(candidateInfo.name || 'Job Applicant', { align: 'center' });

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#2563eb')
      .text(jobDetails.jobTitle ? `${jobDetails.jobTitle} | C2C Senior Consultant` : 'Senior Software Consultant', { align: 'center' });

    doc.moveDown(0.3);

    const contactLine = [
      candidateInfo.email || 'applicant@domain.com',
      candidateInfo.phone || '+1 (555) 019-2831',
      candidateInfo.location || 'United States',
      candidateInfo.linkedin || 'linkedin.com/in/applicant'
    ].filter(Boolean).join('  |  ');

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#475569')
      .text(contactLine, { align: 'center' });

    doc.moveDown(0.8);
    drawDivider(doc);

    // --- Professional Summary ---
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('PROFESSIONAL SUMMARY');
    doc.moveDown(0.2);

    const summaryText = extractOrBuildSummary(baseResume, jobDetails.jobTitle, jobDetails.company, keywords);
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(summaryText, { lineGap: 3 });

    doc.moveDown(0.6);
    drawDivider(doc);

    // --- Technical Competencies ---
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('CORE TECHNICAL COMPETENCIES');
    doc.moveDown(0.2);

    const matchedSkills = keywords.slice(0, 12).join(', ');
    const skillsText = `Primary Expertise: ${matchedSkills || 'Java, Spring Boot, REST APIs, Microservices, SQL, AWS, Docker, Git'}\nDevelopment & Architecture: Object-Oriented Design, CI/CD Pipelines, Cloud Infrastructure, Agile/Scrum Methodologies`;
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(skillsText, { lineGap: 3 });

    doc.moveDown(0.6);
    drawDivider(doc);

    // --- Professional Experience ---
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('PROFESSIONAL EXPERIENCE');
    doc.moveDown(0.4);

    const experienceBullets = extractExperience(baseResume, keywords);
    experienceBullets.forEach((exp) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(exp.role, { continued: true });
      doc.font('Helvetica-Oblique').fontSize(9.5).fillColor('#64748b').text(` — ${exp.period}`, { align: 'right' });
      
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#2563eb').text(exp.company);
      doc.moveDown(0.2);

      exp.bullets.forEach((bullet) => {
        doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`•  ${bullet}`, { indent: 10, lineGap: 2 });
      });
      doc.moveDown(0.5);
    });

    drawDivider(doc);

    // --- Education & Work Auth ---
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b').text('EDUCATION & AUTHORIZATION');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`• Bachelor of Science in Computer Science / Information Technology`);
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`• Work Authorization: ${candidateInfo.workAuth || 'US Citizen / Green Card / Authorized for C2C'}`);
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`• Availability: ${candidateInfo.availability || 'Immediate / 1 Week Notice'}`);

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', (err) => reject(err));
  });
}

function drawDivider(doc) {
  doc
    .strokeColor('#cbd5e1')
    .lineWidth(0.75)
    .moveTo(40, doc.y)
    .lineTo(572, doc.y)
    .stroke();
}

function extractKeywords(text) {
  const words = (text || '').toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || [];
  const stopwords = new Set(['and', 'the', 'for', 'with', 'you', 'that', 'this', 'are', 'from', 'have', 'will', 'our', 'team', 'work', 'your', 'about', 'can', 'all', 'more', 'they', 'looking', 'role', 'must', 'with', 'using']);
  const unique = [...new Set(words.filter(w => !stopwords.has(w) && w.length > 2))];
  return unique.slice(0, 15);
}

function extractOrBuildSummary(baseResume, jobTitle, company, keywords) {
  if (baseResume && baseResume.length > 50) {
    const firstPara = baseResume.split('\n\n')[0].replace(/\n/g, ' ');
    if (firstPara.length > 40) return firstPara;
  }
  const topKw = keywords.slice(0, 5).join(', ');
  return `Results-driven Senior Software Engineer & C2C Consultant with extensive hands-on experience designing and building scalable backend services and enterprise software solutions. Proven track record of delivering robust applications utilizing ${topKw || 'Java, Spring Boot, REST APIs, and Cloud Technology'}. Demonstrated ability to collaborate in fast-paced Agile environments and align architecture with key business objectives.`;
}

function extractExperience(baseResume, keywords) {
  const defaultExperiences = [
    {
      role: 'Senior Software Engineer / C2C Consultant',
      company: 'Enterprise Technology Solutions',
      period: '2021 — Present',
      bullets: [
        `Architected and deployed enterprise microservices utilizing ${keywords[0] || 'Java'}, ${keywords[1] || 'Spring Boot'}, and RESTful APIs.`,
        `Optimized SQL database query performance, resulting in a 35% reduction in API response latency across core transactional services.`,
        `Collaborated with cross-functional teams to integrate CI/CD automated deployment pipelines and cloud infrastructure.`
      ]
    },
    {
      role: 'Software Developer',
      company: 'Apex Systems Solutions',
      period: '2018 — 2021',
      bullets: [
        `Developed core business logic modules and web application services supporting high-throughput user operations.`,
        `Implemented unit and integration automated test suites to maintain high code quality and zero critical defects in production.`,
        `Participated in daily Agile standups, code reviews, and technical design documentation.`
      ]
    }
  ];

  if (!baseResume || baseResume.length < 100) return defaultExperiences;

  const lines = baseResume.split('\n').filter(l => l.trim());
  const customBullets = lines.filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().startsWith('*')).slice(0, 6);

  if (customBullets.length >= 3) {
    return [
      {
        role: 'Senior Software Consultant',
        company: 'Technology Client Services',
        period: 'Recent Experience',
        bullets: customBullets.map(b => b.replace(/^[-•*]\s*/, '').trim())
      }
    ];
  }

  return defaultExperiences;
}

module.exports = { generateTailoredPDF };
