/**
 * Test script for comprehensive LinkedIn profile analysis endpoint
 * 
 * This tests the /api/analyze-job-seeker-comprehensive endpoint
 * that the Chrome extension content script calls during deep research.
 * 
 * Usage:
 *   node test-comprehensive-analysis.js
 */

// Use native fetch (Node.js 18+) or http module
const http = require('http');

// Test data simulating what the content script sends
const testProfile = {
  name: "Sarah Johnson",
  headline: "Software Engineer | Open to Work | Seeking Full-Time Opportunities",
  about: "Passionate software engineer with 3 years of experience in web development. Recently completed a coding bootcamp focused on React and Node.js. Looking for opportunities to join an innovative tech company where I can contribute to meaningful projects.",
  experiences: [
    { title: "Junior Software Engineer", company: "Tech Startup Inc" },
    { title: "Web Developer Intern", company: "Digital Agency" }
  ],
  skills: [
    "JavaScript", "React", "Node.js", "HTML", "CSS", "Git",
    "Python", "SQL", "MongoDB", "TypeScript"
  ],
  commentsWithAtSymbols: [
    { 
      text: "Great article about career transitions! I'm also looking to break into tech. Feel free to connect: sarah.johnson@email.com",
      mentions: ["@career", "@tech"]
    },
    {
      text: "Thanks for sharing this! Really helpful for job seekers like me. Reach out at @sarahjohnson",
      mentions: ["@sarahjohnson"]
    }
  ],
  contactEmails: ["sarah.j@example.com"],
  commentEmails: ["sarah.johnson@email.com"],
  combinedText: `
Sarah Johnson
Software Engineer | Open to Work | Seeking Full-Time Opportunities
Pittsburgh, PA

About
Passionate software engineer with 3 years of experience in web development. 
Recently completed a coding bootcamp focused on React and Node.js. 
Looking for opportunities to join an innovative tech company where I can 
contribute to meaningful projects.

Experience
Junior Software Engineer at Tech Startup Inc
2022 - Present
Built and maintained web applications using React and Node.js
Collaborated with cross-functional teams in agile environment

Web Developer Intern at Digital Agency
2021 - 2022
Created responsive websites for clients
Learned modern web development practices

Skills
JavaScript, React, Node.js, HTML, CSS, Git, Python, SQL, MongoDB, TypeScript

Recent Activity
- Posted about job search journey
- Commented on tech career articles
- Active in coding communities
  `,
  linkedinUrl: "https://www.linkedin.com/in/sarahjohnson"
};

async function testAnalysis() {
  console.log('\n🧪 ========== TESTING COMPREHENSIVE ANALYSIS ENDPOINT ==========\n');
  
  console.log('📊 Test Profile:');
  console.log('   Name:', testProfile.name);
  console.log('   Headline:', testProfile.headline);
  console.log('   Experiences:', testProfile.experiences.length);
  console.log('   Skills:', testProfile.skills.length);
  console.log('   Comments with @:', testProfile.commentsWithAtSymbols.length);
  console.log('   Contact Emails:', testProfile.contactEmails.length);
  console.log('   Comment Emails:', testProfile.commentEmails.length);
  
  console.log('\n🔄 Sending request to backend...\n');
  
  try {
    // Make HTTP POST request
    const result = await new Promise((resolve, reject) => {
      const data = JSON.stringify(testProfile);
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/analyze-job-seeker-comprehensive',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };
      
      const req = http.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          } else {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error('Invalid JSON response: ' + body));
            }
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(data);
      req.end();
    });
    
    console.log('✅ ANALYSIS SUCCESSFUL!\n');
    console.log('📊 ========== ANALYSIS RESULTS ==========\n');
    console.log('✅ Success:', result.success);
    console.log('📊 Job Seeker Score:', result.jobSeekerScore, '/100');
    console.log('🎯 Is Job Seeker:', result.isJobSeeker);
    console.log('🎓 Career Stage:', result.careerStage);
    console.log('💻 Tech Background:', result.techBackground);
    console.log('🏢 Industry:', result.industry);
    console.log('📈 Confidence:', result.confidence, '%');
    
    if (result.keySkills && result.keySkills.length > 0) {
      console.log('\n🛠️ Key Skills:', result.keySkills.join(', '));
    }
    
    if (result.jobSeekerIndicators && result.jobSeekerIndicators.length > 0) {
      console.log('\n🚨 Job Seeking Indicators:');
      result.jobSeekerIndicators.forEach((indicator, i) => {
        console.log(`   ${i + 1}. ${indicator}`);
      });
    }
    
    if (result.extractedEmails && result.extractedEmails.length > 0) {
      console.log('\n📧 Emails Found:', result.extractedEmails.join(', '));
    }
    
    if (result.summary) {
      console.log('\n📝 AI Summary:');
      console.log('   ' + result.summary);
    }
    
    if (result.notes) {
      console.log('\n📋 Additional Notes:');
      console.log('   ' + result.notes);
    }
    
    console.log('\n💰 Tokens Used:', result.tokensUsed);
    console.log('⏰ Analysis Timestamp:', result.analysisTimestamp);
    
    console.log('\n✅ ========== TEST PASSED ==========\n');
    
    // Validate expected results
    console.log('🔍 Validating Results...\n');
    
    const validations = [
      { check: result.success === true, label: 'Success flag is true' },
      { check: result.jobSeekerScore >= 0 && result.jobSeekerScore <= 100, label: 'Job seeker score in valid range' },
      { check: ['Entry', 'Mid', 'Senior', 'Executive'].includes(result.careerStage), label: 'Career stage is valid' },
      { check: ['Expert', 'Strong', 'Some', 'None'].includes(result.techBackground), label: 'Tech background is valid' },
      { check: result.extractedEmails && result.extractedEmails.length > 0, label: 'Emails were extracted' },
      { check: result.jobSeekerIndicators && result.jobSeekerIndicators.length > 0, label: 'Job seeker indicators found' },
      { check: result.summary && result.summary.length > 0, label: 'AI summary generated' }
    ];
    
    let passedCount = 0;
    validations.forEach(validation => {
      const status = validation.check ? '✅' : '❌';
      console.log(`${status} ${validation.label}`);
      if (validation.check) passedCount++;
    });
    
    console.log(`\n📊 Validation Results: ${passedCount}/${validations.length} passed\n`);
    
    if (passedCount === validations.length) {
      console.log('🎉 ALL VALIDATIONS PASSED! The endpoint is working correctly.\n');
      process.exit(0);
    } else {
      console.log('⚠️ Some validations failed. Check the results above.\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ ========== TEST FAILED ==========\n');
    console.error('Error:', error.message);
    console.error('\nPossible causes:');
    console.error('1. Backend server is not running (run: cd backend && npm start)');
    console.error('2. OpenAI API key not configured in .env file');
    console.error('3. Network connection issue');
    console.error('4. OpenAI API error (check credits/quota)');
    console.error('\n');
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting comprehensive analysis endpoint test...');
console.log('📍 Endpoint: http://localhost:3000/api/analyze-job-seeker-comprehensive');
console.log('');

testAnalysis();

