const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');
require('dotenv').config();

// Try to load puppeteer, but don't fail if it's not available
let puppeteer = null;
let browserInstance = null;
let browserPromise = null;

try {
  puppeteer = require('puppeteer');
  console.log('Puppeteer loaded successfully');
} catch (error) {
  console.warn('Puppeteer not available:', error.message);
}

// Request queue to limit concurrent scraping
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 2;
const requestQueue = [];

// Browser pool management
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  
  if (browserPromise) {
    return browserPromise;
  }
  
  browserPromise = puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ],
    timeout: 30000
  });
  
  try {
    browserInstance = await browserPromise;
    console.log('TheNetwrk: Browser instance created successfully');
    
    browserInstance.on('disconnected', () => {
      console.log('TheNetwrk: Browser disconnected, clearing instance');
      browserInstance = null;
      browserPromise = null;
    });
    
    return browserInstance;
  } catch (error) {
    console.error('TheNetwrk: Failed to create browser instance:', error);
    browserPromise = null;
    throw error;
  }
}

// Queue management for concurrent requests
function processQueue() {
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const { resolve, reject, task } = requestQueue.shift();
    activeRequests++;
    
    task()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        activeRequests--;
        processQueue();
      });
  }
}

function queueRequest(task) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, task });
    processQueue();
  });
}

// Cleanup browser on process exit
process.on('SIGINT', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit();
});

process.on('SIGTERM', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit();
});

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Email configuration
let transporter;
try {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  console.log('Email transporter configured successfully');
} catch (error) {
  console.error('Error configuring email transporter:', error);
}

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Database to store contacts and email history (in-memory for demonstration)
// In a production environment, use a proper database
const db = {
  prospects: [],
  emailHistory: [],
  userSettings: {
    email: null,
    password: null,
    isAuthenticated: false
  }
};

// Routes

// Health check endpoint
app.get('/', (req, res) => {
  res.send({
    status: 'ok',
    message: 'TheNetwrk Email Server is running',
  });
});

// Save prospect endpoint
app.post('/api/save-prospect', async (req, res) => {
  try {
    const prospectData = req.body;
    console.log('TheNetwrk: Saving prospect:', prospectData.name);
    
    // Store prospect data (in a real app, this would go to a database)
    // For now, just log it
    console.log('TheNetwrk: Prospect data received:', {
      name: prospectData.name,
      headline: prospectData.headline,
      linkedinUrl: prospectData.linkedinUrl,
      hasEmail: !!prospectData.email
    });
    
    res.json({ 
      success: true, 
      message: 'Prospect saved successfully',
      prospect: prospectData
    });
  } catch (error) {
    console.error('TheNetwrk: Error saving prospect:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save prospect' 
    });
  }
});

// Update prospect endpoint
app.post('/api/update-prospect', async (req, res) => {
  try {
    const prospectData = req.body;
    console.log('TheNetwrk: Updating prospect:', prospectData.name);
    
    // Update prospect data (in a real app, this would update a database)
    console.log('TheNetwrk: Prospect update received:', {
      id: prospectData.id,
      name: prospectData.name,
      hasDeepAnalysis: !!prospectData.deepAnalysis,
      hasExperiences: !!prospectData.experiences,
      hasSkills: !!prospectData.skills
    });
    
    res.json({ 
      success: true, 
      message: 'Prospect updated successfully',
      prospect: prospectData
    });
  } catch (error) {
    console.error('TheNetwrk: Error updating prospect:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update prospect' 
    });
  }
});

// Email authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    console.log('\n📧 ========== EMAIL AUTHENTICATION TEST ==========');
    console.log('📧 Testing email authentication for:', email);
    console.log('🔐 Using provided credentials');
    
    // Test the email credentials by creating a transporter
    const testTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: email,
        pass: password,
      },
    });

    console.log('🔄 Verifying connection to Gmail servers...');
    
    // Verify the connection
    await testTransporter.verify();

    // If verification succeeds, store the credentials
    db.userSettings.email = email;
    db.userSettings.password = password;
    db.userSettings.isAuthenticated = true;

    // Update the global transporter
    transporter = testTransporter;
    
    console.log('✅ Email authentication successful!');
    console.log('📧 Ready to send emails from:', email);
    console.log('📧 ================================================\n');

    res.json({
      success: true,
      message: 'Email authentication successful',
      email: email
    });

  } catch (error) {
    console.error('Email authentication failed:', error);
    res.status(401).json({
      success: false,
      error: 'Email authentication failed. Please check your credentials and ensure you\'re using an App Password for Gmail.',
      details: error.message
    });
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    success: true,
    isAuthenticated: db.userSettings.isAuthenticated,
    email: db.userSettings.isAuthenticated ? db.userSettings.email : null
  });
});

app.post('/api/auth/logout', (req, res) => {
  db.userSettings.email = null;
  db.userSettings.password = null;
  db.userSettings.isAuthenticated = false;
  
  // Reset transporter to default
  try {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } catch (error) {
    transporter = null;
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Get all prospects
app.get('/api/prospects', (req, res) => {
  res.json(db.prospects);
});

// Add a new prospect
app.post('/api/prospects', (req, res) => {
  try {
    const prospect = {
      id: Date.now().toString(),
      ...req.body,
      dateAdded: new Date().toISOString(),
      contactAttempts: [],
      status: 'new',
    };

    db.prospects.push(prospect);
    res.status(201).json({ success: true, prospect });
  } catch (error) {
    console.error('Error adding prospect:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a prospect
app.put('/api/prospects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const index = db.prospects.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Prospect not found' });
    }

    db.prospects[index] = {
      ...db.prospects[index],
      ...req.body,
      lastUpdated: new Date().toISOString(),
    };

    res.json({ success: true, prospect: db.prospects[index] });
  } catch (error) {
    console.error('Error updating prospect:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send email
app.post('/api/send-email', async (req, res) => {
  try {
    console.log('\n📧 ========== EMAIL SENDING REQUEST ==========');
    
    const { to, subject, body, prospectId, message, name, profileData } = req.body;
    
    // Use flexible field names (support both old and new API)
    const emailTo = to;
    const emailSubject = subject;
    const emailBody = body || message;
    const recipientName = name;
    
    console.log('📧 Recipient:', emailTo);
    console.log('👤 Name:', recipientName);
    console.log('📝 Subject:', emailSubject);
    console.log('💬 Message length:', emailBody?.length || 0, 'characters');

    // Validation
    if (!emailTo || !emailSubject || !emailBody) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields (to, subject, message)',
      });
    }

    if (!transporter) {
      console.log('❌ Email service not configured');
      return res.status(500).json({
        success: false,
        error: 'Email service not configured. Please log in with your email credentials first.',
      });
    }

    if (!db.userSettings.isAuthenticated) {
      console.log('❌ User not authenticated');
      return res.status(401).json({
        success: false,
        error: 'Please log in with your email credentials to send emails.',
      });
    }

    console.log('📧 From:', db.userSettings.email);
    console.log('📧 To:', emailTo);
    console.log('🔄 Sending email...');

    // Send email
    const info = await transporter.sendMail({
      from: db.userSettings.email || process.env.EMAIL_USER,
      to: emailTo,
      subject: emailSubject,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>'),
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', info.messageId);

    // Record email in history
    const emailRecord = {
      id: Date.now().toString(),
      prospectId,
      to,
      subject,
      body,
      sentAt: new Date().toISOString(),
      messageId: info.messageId,
      status: 'sent',
    };

    db.emailHistory.push(emailRecord);

    // Update prospect's contact attempts
    const prospectIndex = db.prospects.findIndex((p) => p.id === prospectId);
    if (prospectIndex !== -1) {
      if (!db.prospects[prospectIndex].contactAttempts) {
        db.prospects[prospectIndex].contactAttempts = [];
      }

      db.prospects[prospectIndex].contactAttempts.push({
        type: 'email',
        date: new Date().toISOString(),
        subject,
        status: 'sent',
        emailId: emailRecord.id,
      });

      // Update status if it was 'new'
      if (db.prospects[prospectIndex].status === 'new') {
        db.prospects[prospectIndex].status = 'contacted';
      }
    }

    res.json({
      success: true,
      emailId: emailRecord.id,
      messageId: info.messageId,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get email history for a prospect
app.get('/api/email-history/:prospectId', (req, res) => {
  try {
    const { prospectId } = req.params;
    const emails = db.emailHistory.filter((email) => email.prospectId === prospectId);
    res.json(emails);
  } catch (error) {
    console.error('Error getting email history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// OLD ENDPOINT REMOVED - DUPLICATE EXISTS AT LINE ~1698

// Code removed - orphaned from duplicate endpoint

// ORPHANED CODE REMOVED - DUPLICATE ENDPOINT EXISTS AT LINE ~1687
// Generate comprehensive profile using OpenAI
app.post('/api/generate-profile', async (req, res) => {
  try {
    const { linkedinUrl, basicData } = req.body;
    
    if (!linkedinUrl) {
      return res.status(400).json({
        success: false,
        error: 'LinkedIn URL is required'
      });
    }
    
    console.log('\n🤖 ========== AI PROFILE GENERATION REQUEST ==========');
    console.log('🌐 LinkedIn URL:', linkedinUrl);
    console.log('⏰ Request time:', new Date().toLocaleString());
    console.log('👤 Profile name:', basicData?.name || 'NOT PROVIDED');
    
    // Use the basicData that was already scraped by the Chrome extension
    // The content script has access to the actual LinkedIn page DOM
    
    // Extract name from LinkedIn URL if basicData doesn't have proper name
    let extractedName = 'Unknown';
    if (basicData?.name && basicData.name !== 'Unknown' && !basicData.name.includes('Status')) {
      extractedName = basicData.name;
    } else {
      // Try to extract name from LinkedIn URL
      const urlMatch = linkedinUrl.match(/\/in\/([^/?]+)/);
      if (urlMatch) {
        let cleanName = urlMatch[1].replace(/-/g, ' ').replace(/\d+/g, '').trim();
        
        // Split into words and take only the first 2-3 that look like real names
        const words = cleanName.split(' ').filter(word => word.length > 1);
        const nameWords = words.slice(0, 2); // Take first 2 words (first + last name)
        
        extractedName = nameWords
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
    }
    
    // Use the data already scraped by the content script + enhance with AI analysis
    const scrapedData = {
      name: extractedName,
      headline: basicData?.headline || 'Professional seeking opportunities',
      location: basicData?.location || 'Location not specified',
      about: basicData?.about || '',
      experiences: Array.isArray(basicData?.experiences) ? basicData.experiences : [],
      education: Array.isArray(basicData?.education) ? basicData.education : [],
      skills: Array.isArray(basicData?.skills) ? basicData.skills : [],
      posts: Array.isArray(basicData?.posts) ? basicData.posts : [],
      comments: Array.isArray(basicData?.comments) ? basicData.comments : [],
      workStatus: basicData?.workStatus || '',
      email: basicData?.email || '',
      phone: basicData?.phone || '',
      linkedinUrl: linkedinUrl
    };
    
    console.log('\n📊 ===== COMPREHENSIVE PROFILE DATA =====');
    console.log('👤 Name:', scrapedData.name);
    console.log('💼 Headline:', scrapedData.headline ? `${scrapedData.headline.substring(0, 60)}...` : 'None');
    console.log('📍 Location:', scrapedData.location || 'None');
    console.log('📝 About:', scrapedData.about ? `${scrapedData.about.length} characters` : 'None');
    console.log('📧 Email:', scrapedData.email || 'None');
    console.log('📱 Phone:', scrapedData.phone || 'None');
    console.log('💼 Work Status:', scrapedData.workStatus || 'None');
    
    if (scrapedData.experiences && scrapedData.experiences.length > 0) {
      console.log('💼 Experiences:', `${scrapedData.experiences.length} items`);
      scrapedData.experiences.slice(0, 2).forEach((exp, i) => {
        if (typeof exp === 'object') {
          console.log(`   ${i + 1}. ${exp.title || 'Unknown'} at ${exp.company || 'Unknown'}`);
        }
      });
    }
    
    if (scrapedData.posts && scrapedData.posts.length > 0) {
      console.log('📝 Posts:', `${scrapedData.posts.length} analyzed`);
      const jobSeekingPosts = scrapedData.posts.filter(p => p.hasJobKeywords);
      const techPosts = scrapedData.posts.filter(p => p.hasTechKeywords);
      console.log(`   📊 Post analysis: ${jobSeekingPosts.length} job-seeking, ${techPosts.length} tech-related`);
    }
    
    if (scrapedData.comments && scrapedData.comments.length > 0) {
      console.log('🗨️ Comments:', `${scrapedData.comments.length} analyzed`);
      const commentsWithContact = scrapedData.comments.filter(c => c.hasEmail || c.hasPhone);
      const commentsWithJobSeeking = scrapedData.comments.filter(c => c.hasJobSeeking);
      console.log(`   📧 Comments with contact info: ${commentsWithContact.length}`);
      console.log(`   🔍 Comments with job seeking language: ${commentsWithJobSeeking.length}`);
    }
    
    console.log('📊 =====================================');
    
    console.log('TheNetwrk: Processing profile data for:', scrapedData.name);
    console.log('TheNetwrk: Available data:');
    console.log('  - Headline:', scrapedData.headline);
    console.log('  - Location:', scrapedData.location);
    console.log('  - About:', scrapedData.about ? scrapedData.about.substring(0, 100) + '...' : 'None');
    console.log('  - Experiences:', scrapedData.experiences.length, 'items');
    console.log('  - Education:', scrapedData.education.length, 'items');
    console.log('  - Skills:', scrapedData.skills.length, 'items');
    console.log('  - Posts:', scrapedData.posts.length, 'items');
    console.log('  - Work Status:', scrapedData.workStatus);
    console.log('  - Email:', scrapedData.email || 'None');
    
    // Show sample of actual data
    if (scrapedData.experiences.length > 0) {
      console.log('  - Sample experience:', JSON.stringify(scrapedData.experiences[0]));
    }
    if (scrapedData.skills && scrapedData.skills.length > 0) {
      console.log('  - Sample skills:', Array.isArray(scrapedData.skills) ? scrapedData.skills.slice(0, 5).join(', ') : scrapedData.skills);
    }
    
    // Generate AI analysis using OpenAI with the scraped data
    const prompt = `CRITICAL: You are analyzing LinkedIn profiles to identify GENUINE JOB SEEKERS for tech opportunities, NOT service providers.

        Profile Data:
        Name: ${scrapedData.name}
        Headline: ${scrapedData.headline}
        Location: ${scrapedData.location}
        About: ${scrapedData.about}
        Work Status: ${scrapedData.workStatus}

        Experiences: ${JSON.stringify(scrapedData.experiences)}
        Education: ${JSON.stringify(scrapedData.education)}
        Skills: ${Array.isArray(scrapedData.skills) ? scrapedData.skills.join(', ') : (scrapedData.skills || 'None specified')}
        Recent Posts: ${JSON.stringify(scrapedData.posts)}
        Comments & Interactions: ${JSON.stringify(scrapedData.comments)}

EXCLUSION CRITERIA - If ANY of these apply, set jobSeekerScore to 0:
- Job coaches, career coaches, career counselors
- Recruiters, talent acquisition specialists, headhunters
- Consultants offering career services
- Resume writers, interview coaches
- Business owners, entrepreneurs, freelancers
- Anyone helping others find jobs (not seeking themselves)
- Established professionals NOT actively job seeking

INCLUSION CRITERIA - Look for GENUINE job-seeking signals with TECH focus:
- "Open to work" badges or explicit statements
- Headlines: "Seeking", "Looking for", "Available for hire", "Transitioning to tech"
- Recent graduates, bootcamp graduates, especially coding bootcamps
- Career changers transitioning TO tech from any industry
- Unemployed, laid off, between roles, especially those interested in tech
- Posts about job searching, networking for opportunities, learning to code
- Learning new tech skills (programming, data analysis, digital marketing)
- People mentioning tech companies, startups, or tech roles in posts
- Anyone expressing interest in technology, coding, or digital careers
- Professionals wanting to "break into tech" or "pivot to technology"

TECH FOCUS - Prioritize those seeking TECH roles or interested in technology:
- Software development, web development, data science, AI/ML
- Product management, UX/UI design, DevOps, cloud computing
- Coding bootcamp graduates, self-taught programmers
- Career changers transitioning INTO technology from any field
- People learning tech skills (programming, data analysis, digital marketing)
- Recent graduates with STEM degrees seeking tech roles
- Professionals from non-tech industries wanting to break into tech
- Anyone showing interest in technology, coding, or digital transformation
- People with transferable skills that could apply to tech roles

Based on this analysis, provide JSON with:
1. jobSeekerScore (0-10): 0 if service provider, 8-10 for clear job seekers, 5-7 for potential seekers
2. careerStage: early-career, mid-level, senior, or executive
3. techBackground: none, some, strong, or expert
4. interests: array of 3-5 inferred interests
5. communicationStyle: professional, casual, enthusiastic, etc.
6. summary: 2-3 sentence assessment of their job-seeking status and tech potential
7. jobSeekingSignals: array of specific indicators found (e.g., "Open to work badge", "Recent job search post")
8. excludedReason: if jobSeekerScore is 0, explain why (e.g., "career_coach", "recruiter", "service_provider")
9. aiNotes: object with bulleted analysis containing:
   - jobSeekerStatus: bullet point about their current job seeking status
   - generalNotes: 2-3 bullet points about their background and situation
   - techSkillsNotes: bullet points about their technical abilities
   - careerGoals: bullet points about what they're looking for
   - postAnalysis: bullet points about insights from their recent posts/activities
   - contactability: bullet point about likelihood of response
   - fitForNetwrk: bullet point about how well they'd fit TheNetwrk community

Return ONLY valid JSON.`;

    console.log('TheNetwrk: Sending to OpenAI for analysis...');
    console.log('TheNetwrk: Prompt length:', prompt.length, 'characters');

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert recruiter analyzing LinkedIn profiles. Return only valid JSON."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const aiResponse = completion.choices[0].message.content;
      console.log('\n🤖 ===== OPENAI ANALYSIS RESPONSE =====');
      console.log('📝 Raw AI Response:');
      console.log(aiResponse);
      console.log('🤖 =====================================');
      
      let aiAnalysis;
      try {
        // Clean the AI response to extract JSON from code blocks
        let cleanedResponse = aiResponse.trim();
        
        // Remove ```json and ``` markers if present
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        aiAnalysis = JSON.parse(cleanedResponse);
        console.log('\n✅ ===== PARSED AI ANALYSIS =====');
        console.log('📊 Job Seeker Score:', aiAnalysis.jobSeekerScore);
        console.log('🎓 Career Stage:', aiAnalysis.careerStage);
        console.log('💻 Tech Background:', aiAnalysis.techBackground);
        console.log('🎯 Communication Style:', aiAnalysis.communicationStyle);
        console.log('📝 Summary:', aiAnalysis.summary);
        
        if (aiAnalysis.interests && aiAnalysis.interests.length > 0) {
          console.log('🔍 Interests:', aiAnalysis.interests.join(', '));
        }
        
        if (aiAnalysis.jobSeekingSignals && aiAnalysis.jobSeekingSignals.length > 0) {
          console.log('🚨 Job Seeking Signals:', aiAnalysis.jobSeekingSignals.join(', '));
        }
        
        if (aiAnalysis.aiNotes) {
          console.log('\n📋 AI Notes:');
          console.log('💼 Job Seeker Status:', aiAnalysis.aiNotes.jobSeekerStatus);
          console.log('📝 General Notes:', Array.isArray(aiAnalysis.aiNotes.generalNotes) ? aiAnalysis.aiNotes.generalNotes.join(' | ') : aiAnalysis.aiNotes.generalNotes);
          console.log('🛠️ Tech Skills:', aiAnalysis.aiNotes.techSkillsNotes);
          console.log('🎯 Career Goals:', aiAnalysis.aiNotes.careerGoals);
          console.log('📝 Posts Analysis:', aiAnalysis.aiNotes.postAnalysis);
          console.log('📞 Contactability:', aiAnalysis.aiNotes.contactability);
          console.log('🌟 TheNetwrk Fit:', aiAnalysis.aiNotes.fitForNetwrk);
        }
        
        if (aiAnalysis.excludedReason) {
          console.log('🚫 Exclusion Reason:', aiAnalysis.excludedReason);
        }
        
        console.log('✅ ===========================');
      } catch (parseError) {
        console.log('TheNetwrk: AI response parsing failed, using fallback');
        console.log('TheNetwrk: Raw response was:', aiResponse);
        aiAnalysis = {
          jobSeekerScore: 7.0,
          careerStage: 'mid-level',
          techBackground: 'some',
          interests: ['Technology', 'Career Development', 'Networking'],
          communicationStyle: 'professional',
          summary: `${scrapedData.name} appears to be a professional with potential interest in career opportunities.`,
          jobSeekingSignals: ['Profile activity suggests job interest'],
          aiNotes: {
            jobSeekerStatus: '• Shows signs of career development interest',
            generalNotes: ['• Professional with technology background', '• Active on LinkedIn platform'],
            techSkillsNotes: '• Has some technical skills and experience',
            careerGoals: '• Likely interested in career growth opportunities',
            postAnalysis: '• Limited post data available for analysis',
            contactability: '• Good potential for professional outreach',
            fitForNetwrk: '• Could benefit from TheNetwrk community and resources'
          }
        };
      }

      const finalProfile = {
        ...scrapedData,
        ...aiAnalysis,
        isLikelyJobSeeker: aiAnalysis.jobSeekerScore >= 6,
        generatedAt: new Date().toISOString(),
        dataSource: 'content_script_scraping_with_ai'
      };
      
      console.log('TheNetwrk: Generated AI-enhanced profile for:', finalProfile.name);
      
      res.json({
        success: true,
        profile: finalProfile
      });
      
    } catch (aiError) {
      console.error('TheNetwrk: OpenAI analysis failed:', aiError);
      
      // Fallback to basic analysis without AI
      const basicProfile = {
        ...scrapedData,
        jobSeekerScore: 7.0,
        careerStage: 'mid-level',
        techBackground: 'some',
        interests: ['Technology', 'Career Development'],
        communicationStyle: 'professional',
        summary: `${scrapedData.name} shows potential for career opportunities.`,
        isLikelyJobSeeker: true,
        generatedAt: new Date().toISOString(),
        dataSource: 'content_script_scraping_basic'
      };
      
      res.json({
        success: true,
        profile: basicProfile
      });
    }
    
  } catch (error) {
    console.error('TheNetwrk: Error analyzing profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze profile: ' + error.message
    });
  }
});

// Calculate job seeker score based on various indicators
function calculateJobSeekerScore(analysis) {
  let score = 0;
  
  // Open to Work signals (highest weight)
  score += analysis.openToWorkSignals.length * 5;
  
  // Job seeker indicators in posts and profile
  score += analysis.jobSeekerIndicators.length * 2;
  
  // Tech transition signals
  score += analysis.techTransitionSignals.length * 1.5;
  
  // Recent posting activity (indicates active LinkedIn usage)
  if (analysis.posts.length >= 3) {
    score += 1;
  }
  
  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

app.post('/api/send-personalized-email', async (req, res) => {
  try {
    console.log('TheNetwrk: Send personalized email request:', req.body);
    
    // Check if user is authenticated
    if (!db.userSettings.isAuthenticated) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated. Please login with your email credentials first.'
      });
    }
    
    const { prospectId, name, headline, location, email, message, customMessage } = req.body;
    
    let prospect;
    let finalMessage = message || customMessage;
    
    if (prospectId) {
      // Find the prospect by ID
      prospect = db.prospects.find(p => p.id === prospectId);
      if (!prospect) {
        return res.status(404).json({
          success: false,
          error: 'Prospect not found'
        });
      }
    } else {
      // Use provided prospect data directly
      prospect = {
        id: Date.now().toString(),
        name: name || 'Unknown',
        headline: headline || '',
        location: location || '',
        email: email
      };
    }
    
    if (!prospect.email) {
      return res.status(400).json({
        success: false,
        error: 'No email address provided for prospect'
      });
    }

    // Generate personalized message if not provided
    if (!finalMessage) {
      try {
        const messageResponse = await fetch('http://localhost:3000/api/generate-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospectData: prospect })
        });

        const messageData = await messageResponse.json();
        if (messageData.success) {
          finalMessage = messageData.message;
        } else {
          console.log('TheNetwrk: Failed to generate message, using default template');
          finalMessage = `Hi ${prospect.name.split(' ')[0]},

I noticed your profile and thought you might be interested in TheNetwrk - we help professionals find 90k+ jobs in tech through our supportive community.

Would you be open to learning more about it?

https://welcometothenetwork.xyz/

Best regards,
TheNetwrk Team`;
        }
      } catch (error) {
        console.error('TheNetwrk: Error generating message:', error);
        finalMessage = `Hi ${prospect.name.split(' ')[0]},

I noticed your profile and thought you might be interested in TheNetwrk - we help professionals find 90k+ jobs in tech through our supportive community.

Would you be open to learning more about it?

https://welcometothenetwork.xyz/

Best regards,
TheNetwrk Team`;
      }
    }

    console.log('TheNetwrk: Sending email to:', prospect.email);
    console.log('TheNetwrk: Using transporter:', !!transporter);
    
    // Send the email directly using the configured transporter
    const mailOptions = {
      from: db.userSettings.email,
      to: prospect.email,
      subject: `${prospect.name.split(' ')[0]}, interested in your tech journey - TheNetwrk`,
      text: finalMessage,
      html: finalMessage.replace(/\n/g, '<br>')
    };

    const emailResult = await transporter.sendMail(mailOptions);
    console.log('TheNetwrk: Email sent successfully:', emailResult.messageId);
    
    res.json({
      success: true,
      message: finalMessage,
      emailResult: {
        success: true,
        messageId: emailResult.messageId,
        to: prospect.email
      }
    });

  } catch (error) {
    console.error('TheNetwrk: Error sending personalized email:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Bulk AI analysis endpoint for multiple prospects
app.post('/api/bulk-analyze', async (req, res) => {
  try {
    const { prospects } = req.body;
    
    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prospects array is required'
      });
    }
    
    console.log('\n🤖 ========== BULK AI ANALYSIS STARTED ==========');
    console.log(`📊 Analyzing ${prospects.length} prospects...`);
    
    const analyzedProspects = [];
    
    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      console.log(`\n🔍 Analyzing prospect ${i + 1}/${prospects.length}: ${prospect.name}`);
      
      try {
        // Use the same AI analysis logic as generate-profile
        const scrapedData = {
          name: prospect.name || 'Unknown',
          headline: prospect.headline || '',
          location: prospect.location || '',
          about: prospect.about || '',
          experiences: Array.isArray(prospect.experiences) ? prospect.experiences : [],
          education: Array.isArray(prospect.education) ? prospect.education : [],
          skills: Array.isArray(prospect.skills) ? prospect.skills : [],
          posts: Array.isArray(prospect.posts) ? prospect.posts : [],
          comments: Array.isArray(prospect.comments) ? prospect.comments : [],
          workStatus: prospect.workStatus || '',
          email: prospect.email || '',
          phone: prospect.phone || '',
          linkedinUrl: prospect.linkedinUrl || ''
        };
        
        console.log(`   📝 Data: ${scrapedData.headline ? 'Headline ✓' : 'Headline ✗'} | ${scrapedData.email ? 'Email ✓' : 'Email ✗'} | ${scrapedData.posts.length > 0 ? `${scrapedData.posts.length} Posts ✓` : 'Posts ✗'}`);
        
        // Generate AI analysis
        const currentDate = new Date().toLocaleDateString();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const prompt = `CRITICAL: Analyze this LinkedIn profile as of ${currentDate} to determine if they are CURRENTLY and ACTIVELY job seeking, specifically for tech opportunities.

        Profile Data:
        Name: ${scrapedData.name}
        Headline: ${scrapedData.headline}
        Location: ${scrapedData.location}
        About Section: ${scrapedData.about || 'Not provided'}
        Current Work Status: ${scrapedData.workStatus || 'Unknown'}

        Work Experience (Most Recent 3):
        ${scrapedData.experiences && scrapedData.experiences.length > 0 ? 
          scrapedData.experiences.slice(0, 3).map(exp => 
            `- ${exp.title} at ${exp.company} (${exp.duration || 'Duration unknown'})`
          ).join('\n') : 'No experience data available'}

        Education:
        ${scrapedData.education && scrapedData.education.length > 0 ?
          JSON.stringify(scrapedData.education) : 'No education data available'}

        Technical Skills:
        ${Array.isArray(scrapedData.skills) ? scrapedData.skills.join(', ') : (scrapedData.skills || 'None specified')}

        Recent Activity (Last 6 Months):
        Posts: ${scrapedData.posts && scrapedData.posts.length > 0 ? 
          `${scrapedData.posts.length} posts - Topics: ${scrapedData.posts.slice(0, 3).map(p => p.text?.substring(0, 100)).join(' | ')}` : 
          'No recent posts'}
        Comments: ${scrapedData.comments && scrapedData.comments.length > 0 ? 
          `${scrapedData.comments.length} comments` : 'No recent comments'}

EXCLUSION CRITERIA - If ANY of these apply, set jobSeekerScore to 0:
- Job coaches, career coaches, career counselors
- Recruiters, talent acquisition specialists, headhunters
- Consultants offering career services
- Resume writers, interview coaches
- Business owners, entrepreneurs, freelancers
- Anyone helping others find jobs (not seeking themselves)
- Established professionals NOT actively job seeking

INCLUSION CRITERIA - Look for GENUINE job-seeking signals with TECH focus:
- "Open to work" badges or explicit statements
- Headlines: "Seeking", "Looking for", "Available for hire", "Transitioning to tech"
- Recent graduates, bootcamp graduates, especially coding bootcamps
- Career changers transitioning TO tech from any industry
- Unemployed, laid off, between roles, especially those interested in tech
- Posts about job searching, networking for opportunities, learning to code
- Learning new tech skills (programming, data analysis, digital marketing)
- People mentioning tech companies, startups, or tech roles in posts
- Anyone expressing interest in technology, coding, or digital careers
- Professionals wanting to "break into tech" or "pivot to technology"

TECH FOCUS - Prioritize those seeking TECH roles or interested in technology:
- Software development, web development, data science, AI/ML
- Product management, UX/UI design, DevOps, cloud computing
- Coding bootcamp graduates, self-taught programmers
- Career changers transitioning INTO technology from any field
- People learning tech skills (programming, data analysis, digital marketing)
- Recent graduates with STEM degrees seeking tech roles
- Professionals from non-tech industries wanting to break into tech
- Anyone showing interest in technology, coding, or digital transformation
- People with transferable skills that could apply to tech roles

Based on this analysis, provide JSON with:
1. jobSeekerScore (0-10): 0 if service provider, 8-10 for clear job seekers, 5-7 for potential seekers
2. careerStage: early-career, mid-level, senior, or executive
3. techBackground: none, some, strong, or expert
4. interests: array of 3-5 inferred interests
5. communicationStyle: professional, casual, enthusiastic, etc.
6. summary: 2-3 sentence assessment of their job-seeking status and tech potential
7. jobSeekingSignals: array of specific indicators found (e.g., "Open to work badge", "Recent job search post")
8. excludedReason: if jobSeekerScore is 0, explain why (e.g., "career_coach", "recruiter", "service_provider")
9. aiNotes: object with bulleted analysis containing:
   - jobSeekerStatus: bullet point about their current job seeking status
   - generalNotes: 2-3 bullet points about their background and situation
   - techSkillsNotes: bullet points about their technical abilities
   - careerGoals: bullet points about what they're looking for
   - postAnalysis: bullet points about insights from their recent posts/activities
   - contactability: bullet point about likelihood of response
   - fitForNetwrk: bullet point about how well they'd fit TheNetwrk community

Return ONLY valid JSON.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o', // Upgraded to GPT-4o for better analysis
          messages: [
            {
              role: 'system',
              content: 'You are an expert recruiter and career analyst specializing in identifying genuine job seekers for tech opportunities. You have deep understanding of job market signals, career transitions, and tech industry hiring patterns. Always return valid, detailed JSON analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500, // Increased for more detailed analysis
          temperature: 0.7 // Balanced for nuanced analysis
        });

        const aiResponse = completion.choices[0].message.content;
        console.log(`   🤖 AI Response received (${aiResponse.length} chars)`);
        
        let aiAnalysis;
        try {
          // Clean the AI response to extract JSON from code blocks
          let cleanedResponse = aiResponse.trim();
          
          // Remove ```json and ``` markers if present
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          
          aiAnalysis = JSON.parse(cleanedResponse);
          console.log(`   ✅ AI Analysis: Score ${aiAnalysis.jobSeekerScore}/10, Stage: ${aiAnalysis.careerStage}, Tech: ${aiAnalysis.techBackground}`);
        } catch (parseError) {
          console.log(`   ❌ AI parsing failed, using fallback`);
          aiAnalysis = {
            jobSeekerScore: 5.0,
            careerStage: 'mid-level',
            techBackground: 'some',
            interests: ['Technology', 'Career Development'],
            communicationStyle: 'professional',
            summary: `${scrapedData.name} shows potential for career opportunities.`,
            jobSeekingSignals: ['Profile suggests job interest'],
            aiNotes: {
              jobSeekerStatus: '• Shows signs of career interest',
              generalNotes: ['• Professional with some background'],
              techSkillsNotes: '• Has relevant experience',
              careerGoals: '• Likely interested in growth opportunities',
              postAnalysis: '• Limited analysis available',
              contactability: '• Moderate likelihood of response',
              fitForNetwrk: '• Could benefit from community support'
            }
          };
        }
        
        // Combine original prospect data with AI analysis
        const analyzedProspect = {
          ...prospect,
          ...scrapedData,
          ...aiAnalysis,
          analyzedAt: new Date().toISOString()
        };
        
        analyzedProspects.push(analyzedProspect);
        
      } catch (error) {
        console.log(`   ❌ Error analyzing prospect: ${error.message}`);
        // Add prospect without AI analysis
        analyzedProspects.push({
          ...prospect,
          analysisError: error.message
        });
      }
    }
    
    console.log(`\n✅ Bulk analysis complete: ${analyzedProspects.length} prospects processed`);
    console.log('🤖 ================================================\n');
    
    res.json({
      success: true,
      prospects: analyzedProspects,
      message: `Successfully analyzed ${analyzedProspects.length} prospects`
    });
    
  } catch (error) {
    console.error('❌ Bulk analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Bulk analysis failed: ' + error.message
    });
  }
});

// Generate personalized LinkedIn message using AI
app.post('/api/generate-message', async (req, res) => {
  try {
    const { prospect, senderName = 'Lawrence', messageType = 'linkedin' } = req.body;
    
    if (!prospect) {
      return res.status(400).json({
        success: false,
        error: 'Prospect data is required'
      });
    }
    
    console.log('\n💬 ========== GENERATING PERSONALIZED MESSAGE ==========');
    console.log('👤 Prospect:', prospect.name);
    console.log('📧 Sender:', senderName);
    console.log('💬 Type:', messageType);
    
    // Create comprehensive prompt for personalized message
    const prompt = `You are a witty, personable recruiter writing a LinkedIn message to a job seeker. Create a personalized, engaging message that feels human and slightly humorous while being professional.

PROSPECT INFORMATION:
Name: ${prospect.name}
Headline: ${prospect.headline || 'Professional'}
Location: ${prospect.location || 'Unknown location'}
Work Status: ${prospect.workStatus || 'Unknown'}
Job Seeker Score: ${prospect.jobSeekerScore || 'Unknown'}/10
Career Stage: ${prospect.careerStage || 'Unknown'}
Tech Background: ${prospect.techBackground || 'Unknown'}
Communication Style: ${prospect.communicationStyle || 'Unknown'}

${prospect.experiences && prospect.experiences.length > 0 ? `
Recent Experience: ${JSON.stringify(prospect.experiences.slice(0, 2))}` : ''}

${prospect.education && prospect.education.length > 0 ? `
Education: ${JSON.stringify(prospect.education.slice(0, 2))}` : ''}

${prospect.skills && prospect.skills.length > 0 ? `
Skills: ${Array.isArray(prospect.skills) ? prospect.skills.slice(0, 5).join(', ') : prospect.skills}` : ''}

${prospect.posts && prospect.posts.length > 0 ? `
Recent Posts/Activity: ${JSON.stringify(prospect.posts.slice(0, 2))}` : ''}

${prospect.summary ? `
AI Summary: ${prospect.summary}` : ''}

${prospect.aiNotes ? `
AI Insights: ${JSON.stringify(prospect.aiNotes)}` : ''}

INSTRUCTIONS:
1. Start with proper greeting: "Hi ${prospect.name ? prospect.name.split(' ')[0] : 'there'},"
2. Reference something specific from their profile data above
3. Add a touch of humor or personality (but keep it professional)
4. Mention TheNetwrk naturally - we help early-career professionals land 90k+ tech jobs
5. Keep it conversational and authentic (NOT robotic or templated)
6. Include a clear call-to-action
7. Use proper professional formatting with line breaks for readability
8. Sign with "${senderName}" (EXACTLY this name, not [Your Name] or anything else)
9. Keep it under 150 words
10. Make it sound like a human wrote it, not AI

FORMATTING REQUIREMENTS:
- Use proper greeting: "Hi [FirstName],"
- Include line breaks for readability (2-3 sentences per paragraph)
- Use professional but friendly tone
- End with proper signature: "Best,\n${senderName}"
- Structure: Greeting → Personal connection → Value proposition → Call to action → Signature

AVOID:
- Generic phrases like "I came across your profile" or "I stumbled upon"
- Overly formal language
- Obvious sales pitches
- Mentioning specific pricing
- Using emojis (NO emojis at all)
- Placeholder text like [Your Name]
- Wall of text without line breaks
- Run-on sentences

REQUIRED: End with "Best,\n${senderName}" (use the exact sender name provided)

Generate a personalized LinkedIn message that feels genuine and engaging:`;

    console.log('🤖 Sending message generation request to OpenAI...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Faster, cheaper model
      messages: [
        {
          role: 'system',
          content: `You are a professional recruiter named ${senderName} writing personalized LinkedIn messages. You MUST:
1. Start with proper greeting: "Hi [FirstName],"
2. Reference specific details from their profile
3. Sound human and conversational (not AI-generated)
4. Use proper formatting with line breaks for readability
5. Sign messages with "${senderName}" (never use [Your Name] or placeholders)
6. NO emojis whatsoever
7. Keep under 150 words
8. Include a clear call-to-action about TheNetwrk
9. Structure: Greeting → Personal connection → Value proposition → Call to action → Signature
10. Use professional but friendly tone throughout`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200, // Reduced for faster response
      temperature: 0.6 // Slightly lower for consistency and speed
    });

    let generatedMessage = completion.choices[0].message.content.trim();
    
    // Post-process the message to fix common AI issues and improve formatting
    generatedMessage = generatedMessage
      .replace(/\[Your Name\]/g, senderName)
      .replace(/\[Sender Name\]/g, senderName)
      .replace(/\[Name\]/g, senderName)
      .replace(/Best,\s*\[.*?\]/g, `Best,\n${senderName}`)
      .replace(/Sincerely,\s*\[.*?\]/g, `Best,\n${senderName}`)
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '') // Remove emojis
      .replace(/😊|😄|🚀|✨|💼|📧|👋|🎯|💪|🔥|⭐|🌟|👍|💡|🎉|🚀/g, '') // Remove specific emojis
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .trim();
    
    // Improve formatting for better readability
    generatedMessage = generatedMessage
      .replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2') // Add line breaks after sentences
      .replace(/(Hi\s+\w+,)/g, '$1\n') // Add line break after greeting
      .replace(/(Best,)\s*(\w+)/g, '$1\n$2') // Ensure proper signature formatting
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .trim();
    
    // Ensure proper signature if missing
    if (!generatedMessage.includes(`Best,\n${senderName}`) && !generatedMessage.includes(`Sincerely,\n${senderName}`)) {
      if (generatedMessage.endsWith('Best,') || generatedMessage.endsWith('Sincerely,')) {
        generatedMessage += `\n${senderName}`;
      } else if (!generatedMessage.includes('Best,') && !generatedMessage.includes('Sincerely,')) {
        generatedMessage += `\n\nBest,\n${senderName}`;
      }
    }
    
    console.log('✅ Generated personalized message:');
    console.log('---');
    console.log(generatedMessage);
    console.log('---');
    console.log('💬 ================================================\n');
    
    res.json({
      success: true,
      message: generatedMessage,
      prospect: prospect.name,
      senderName: senderName
    });
    
  } catch (error) {
    console.error('❌ Message generation error:', error);
    
    // Fallback message if AI fails
    const firstName = req.body.prospect?.name ? req.body.prospect.name.split(' ')[0] : 'there';
    const fallbackMessage = `Hey ${firstName}!

Saw your profile and thought you might be interested in TheNetwrk - we're a tight-knit community helping people land amazing tech jobs.

No generic advice here, just real coaching and connections to startups that are actually hiring.

Worth a quick chat?

Best,
${req.body.senderName || 'Lawrence'}

P.S. Check us out: welcometothenetwork.xyz`;
    
    res.json({
      success: true,
      message: fallbackMessage,
      prospect: req.body.prospect?.name || 'Unknown',
      senderName: req.body.senderName || 'Lawrence',
      fallback: true
    });
  }
});

// Test endpoint to create a test prospect
app.post('/api/test/create-prospect', (req, res) => {
  console.log('\n🧪 ========== CREATING TEST PROSPECT ==========');
  
  const testProspect = {
    id: 'test_' + Date.now(),
    name: 'Test User',
    email: 'lhua@alumni.cmu.edu',
    headline: 'Software Engineer seeking new opportunities',
    location: 'Pittsburgh, PA',
    linkedinUrl: 'https://linkedin.com/in/test-user',
    about: 'Experienced software engineer looking for new challenges in tech.',
    experiences: [
      { title: 'Software Engineer', company: 'Tech Corp', duration: '2022-Present' }
    ],
    education: [
      { school: 'Carnegie Mellon University', degree: 'Computer Science', dates: '2018-2022' }
    ],
    skills: ['JavaScript', 'React', 'Node.js', 'Python'],
    posts: [
      { text: 'Looking for new opportunities in software development!', hasJobKeywords: true }
    ],
    workStatus: 'Open to work',
    isLikelyJobSeeker: true,
    jobSeekerScore: 9,
    careerStage: 'mid-level',
    techBackground: 'strong',
    interests: ['Software Development', 'Technology', 'Innovation'],
    communicationStyle: 'professional',
    summary: 'Highly skilled software engineer actively seeking new opportunities.',
    aiNotes: {
      jobSeekerStatus: '• Actively seeking software engineering opportunities',
      generalNotes: ['• Strong technical background', '• Clear career goals'],
      techSkillsNotes: '• Solid full-stack development skills',
      careerGoals: '• Looking for senior engineering roles',
      postAnalysis: '• Recent posts indicate active job search',
      contactability: '• High likelihood of response',
      fitForNetwrk: '• Perfect fit for tech community'
    },
    status: 'new',
    dateAdded: new Date().toISOString(),
    contactAttempts: [],
    notes: 'Test prospect for email functionality'
  };
  
  db.prospects.push(testProspect);
  
  console.log('✅ Test prospect created:', testProspect.name);
  console.log('📧 Email:', testProspect.email);
  console.log('🧪 =====================================\n');
  
  res.json({
    success: true,
    prospect: testProspect,
    message: 'Test prospect created successfully'
  });
});

// Start server
// Simple job seeker analysis endpoint
app.post('/api/analyze-job-seeker', async (req, res) => {
  console.log('\n🔍 ========== COMPREHENSIVE JOB SEEKER ANALYSIS ==========');
  console.log('📊 Request received at:', new Date().toISOString());
  
  try {
    const { 
      name, headline, allText, linkedinUrl, about, experiences, 
      skills, posts, comments, education, email, phone, location 
    } = req.body;
    
    console.log('👤 Analyzing:', name);
    console.log('📝 Headline:', headline?.substring(0, 100));
    console.log('📏 Total text length:', allText?.length || 0);
    console.log('🎯 About section:', about ? 'Present' : 'Missing');
    console.log('💼 Experiences:', experiences?.length || 0);
    console.log('🛠️ Skills:', skills?.length || 0);
    console.log('📱 Posts:', posts?.length || 0);
    console.log('💬 Comments:', comments?.length || 0);
    
    // Enhanced comprehensive prompt with ALL data
    const prompt = `COMPREHENSIVE LINKEDIN PROFILE ANALYSIS

BASIC INFO:
Name: ${name}
Headline: ${headline}
Location: ${location || 'Not specified'}
Email: ${email || 'Not found'}
Phone: ${phone || 'Not found'}

ABOUT SECTION:
${about || 'No about section found'}

WORK EXPERIENCE:
${experiences?.map(exp => `• ${exp.title} at ${exp.company}`).join('\n') || 'No experience data'}

SKILLS:
${skills?.join(', ') || 'No skills found'}

EDUCATION:
${education?.join(', ') || 'No education found'}

RECENT POSTS (Last 6 months):
${posts?.map(post => `• ${post.text}`).join('\n') || 'No posts found'}

RECENT COMMENTS:
${comments?.map(comment => `• ${comment.text}`).join('\n') || 'No comments found'}

FULL PROFILE TEXT (First 8000 characters):
${allText?.substring(0, 8000) || 'No profile text available'}

COMPREHENSIVE ANALYSIS REQUIRED:

1. JOB SEEKING ANALYSIS (0-100% confidence):
   - Look for: "Open to work", "Seeking opportunities", "Looking for", "Available", "Hiring", "Job search"
   - Recent posts about job searching, career changes, networking
   - Profile updates, headline changes indicating availability
   - Comments on job-related posts
   - Experience gaps or recent endings

2. CAREER STAGE ASSESSMENT:
   - Entry Level: 0-2 years experience, recent grad, internships
   - Mid Level: 3-7 years experience, established skills
   - Senior Level: 8+ years, leadership roles, mentoring others
   - Executive: C-level, VP, Director roles

3. TECH BACKGROUND EVALUATION:
   - Strong: Software engineer, developer, data scientist, DevOps, etc.
   - Moderate: Product manager, analyst, tech-adjacent roles
   - Weak: Non-tech roles but some tech skills
   - None: No technical background

4. DETAILED SUMMARY:
   - Current role and company
   - Key skills and expertise
   - Career trajectory
   - Job seeking signals
   - Tech proficiency level
   - Notable achievements
   - Networking activity

5. ADDITIONAL INSIGHTS:
   - Industry focus
   - Geographic preferences
   - Salary expectations (if mentioned)
   - Remote work preferences
   - Company size preferences
   - Role type preferences

Return comprehensive JSON with ALL fields:
{
  "jobSeekerScore": <number 0-100>,
  "careerStage": "<Entry/Mid/Senior/Executive>",
  "techBackground": "<Strong/Moderate/Weak/None>",
  "summary": "<detailed 2-3 sentence summary>",
  "isJobSeeker": <boolean>,
  "industry": "<primary industry>",
  "keySkills": ["<skill1>", "<skill2>", "<skill3>"],
  "currentRole": "<current position>",
  "jobSeekingSignals": ["<signal1>", "<signal2>"],
  "networkingActivity": "<High/Medium/Low>",
  "remotePreference": "<Yes/No/Unknown>",
  "experienceYears": <estimated years>,
  "techProficiency": "<Expert/Advanced/Intermediate/Beginner/None>",
  "lastActivity": "<recent activity summary>",
  "contactability": "<High/Medium/Low based on email/engagement>",
  "notes": "<additional insights or red flags>"
}`;

    console.log('🤖 Sending comprehensive analysis to OpenAI (GPT-4o)...');
    console.log('📊 Prompt length:', prompt.length, 'characters');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Best model
      messages: [
        {
          role: 'system',
          content: `You are an expert technical recruiter and LinkedIn profile analyst with 10+ years experience. 
          
          Analyze profiles with extreme attention to detail. Look for subtle job-seeking signals:
          - Recent profile updates or headline changes
          - Networking posts or engagement with job-related content
          - Skills updates or certifications
          - Experience gaps or recent role endings
          - Language indicating availability or interest in opportunities
          - Comments on industry posts or job announcements
          
          Be thorough but accurate. Return ONLY valid JSON with comprehensive analysis.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000, // 4X INCREASE - Much more detailed analysis
      temperature: 0.3 // Lower for more consistent analysis
    });
    
    const aiResponse = completion.choices[0].message.content.trim();
    console.log('✅ AI Response length:', aiResponse.length);
    console.log('✅ AI Response preview:', aiResponse.substring(0, 300));
    
    // Clean up AI response - remove markdown code blocks
    let cleanResponse = aiResponse;
    if (cleanResponse.includes('```json')) {
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    }
    if (cleanResponse.includes('```')) {
      cleanResponse = cleanResponse.replace(/```\s*/g, '');
    }
    
    console.log('🧹 Cleaned response length:', cleanResponse.length);
    
    // Parse JSON
    const analysis = JSON.parse(cleanResponse);
    
    console.log('📊 COMPREHENSIVE ANALYSIS RESULTS:');
    console.log('   Job Seeker Score:', analysis.jobSeekerScore);
    console.log('   Career Stage:', analysis.careerStage);
    console.log('   Tech Background:', analysis.techBackground);
    console.log('   Industry:', analysis.industry);
    console.log('   Key Skills:', analysis.keySkills?.slice(0, 3));
    console.log('   Experience Years:', analysis.experienceYears);
    console.log('   Job Seeking Signals:', analysis.jobSeekingSignals?.length || 0);
    
    res.json({
      success: true,
      ...analysis,
      analysisTimestamp: new Date().toISOString(),
      tokensUsed: completion.usage?.total_tokens || 'unknown'
    });
    
  } catch (error) {
    console.error('❌ Comprehensive analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to analyze profile comprehensively'
    });
  }
});

// Draft personalized message endpoint
app.post('/api/draft-message', async (req, res) => {
  console.log('\n✉️ ========== DRAFTING PERSONALIZED NETWRK MESSAGE ==========');
  console.log('📊 Request received at:', new Date().toISOString());
  
  try {
    const { 
      name, headline, jobSeekerScore, careerStage, techBackground, 
      industry, keySkills, currentRole, jobSeekingSignals, experiences,
      about, posts, comments, location, experienceYears
    } = req.body;
    
    console.log('👤 Drafting message for:', name);
    console.log('📊 Job Seeker Score:', jobSeekerScore);
    console.log('🎯 Career Stage:', careerStage);
    console.log('🛠️ Key Skills:', keySkills?.slice(0, 3));
    console.log('📍 Location:', location);
    
    // Optimized concise message prompt
    const prompt = `Draft 3 LinkedIn messages for ${name} to join The Netwrk community.

PROSPECT: ${name} | ${headline} | ${jobSeekerScore}% job seeker | ${careerStage} | ${industry}
SKILLS: ${keySkills?.join(', ')} | LOCATION: ${location} | SIGNALS: ${jobSeekingSignals?.join(', ')}

THE NETWRK: Anti-gatekeeping tech community ($39/mo) founded by Abigayle who landed 8+ offers. Weekly coaching, YC mentors, startup pipeline, accountability partners. Stop endless applications, start strategic networking.

REQUIREMENTS:
- 2-3 sentences max (LinkedIn limits)  
- Funny/humble/authentic tone (not corporate)
- Reference their specific background/location/skills
- Invite to https://welcometothenetwork.xyz/
- Make it feel like a friend recommendation

EXAMPLES:
- Tech person: "SF tech scene is wild! Your React skills are solid..."
- Job seeker: "Being 'open to work' feels like a full-time job..."
- Location: "Hey fellow Seattle person! The startup scene here..."

JSON format:
{
  "messages": [
    {"version": "A", "text": "message", "personalization_hook": "what made it personal", "tone": "approach"},
    {"version": "B", "text": "message", "personalization_hook": "different angle", "tone": "approach"},  
    {"version": "C", "text": "message", "personalization_hook": "third angle", "tone": "approach"}
  ],
  "recommended": "A",
  "reasoning": "why this works best"
}`;

    console.log('🤖 Sending message draft request to OpenAI...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a witty, authentic community builder helping Abigayle grow The Netwrk. 

          Your writing style is:
          - Conversational and genuine (like texting a friend)
          - Self-deprecating humor when appropriate  
          - Humble but confident
          - Relatable to job seekers' struggles
          - Anti-corporate, pro-authentic connection
          
          You understand that job seekers are tired of:
          - Generic LinkedIn messages
          - Pushy sales pitches  
          - Empty networking requests
          - Corporate speak
          
          Your goal is to make them think "Finally, someone who gets it!" and want to learn more about this different approach to career growth.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500, // Optimized token usage - 3 concise message options
      temperature: 0.8 // Higher creativity for humor and personality
    });
    
    const aiResponse = completion.choices[0].message.content.trim();
    console.log('✅ Message draft response length:', aiResponse.length);
    
    // Clean up AI response
    let cleanResponse = aiResponse;
    if (cleanResponse.includes('```json')) {
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    }
    if (cleanResponse.includes('```')) {
      cleanResponse = cleanResponse.replace(/```\s*/g, '');
    }
    
    const messageData = JSON.parse(cleanResponse);
    
    console.log('📝 Generated message options:', messageData.messages?.length || 0);
    console.log('🎯 Recommended version:', messageData.recommended);
    console.log('💡 Reasoning:', messageData.reasoning?.substring(0, 100));
    
    res.json({
      success: true,
      ...messageData,
      tokensUsed: completion.usage?.total_tokens || 'unknown',
      draftedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Message drafting error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to draft personalized message'
    });
  }
});

app.listen(port, () => {
  console.log(`TheNetwrk Email Server running on port ${port}`);
  console.log(`- API endpoint: http://localhost:${port}/api`);
  console.log(`- Health check: http://localhost:${port}/`);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('\nWARNING: Email credentials not configured.');
    console.warn('Set EMAIL_USER and EMAIL_PASSWORD environment variables to enable email sending.');
    console.warn('For testing, you can run:');
    console.warn('EMAIL_USER=your-email@example.com EMAIL_PASSWORD=your-password node server.js\n');
  }
});