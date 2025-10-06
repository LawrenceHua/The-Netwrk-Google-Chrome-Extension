const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Email authentication storage (in-memory for demo)
let emailAuth = {
  isAuthenticated: false,
  email: null,
  transporter: null
};

// Email transporter configuration
let emailTransporter = null;

// Initialize email transporter if credentials are available
try {
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
  emailsSent: [],
  campaigns: []
};

// ==================== ROUTES ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'thenetwrk-api',
    timestamp: new Date().toISOString()
  });
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

    console.log(`🔐 Attempting email login for: ${email}`);

    // Create transporter to test credentials
    const testTransporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: email,
        pass: password
      }
    });

    // Verify the connection
    await testTransporter.verify();
    
    // Store authenticated credentials
    emailAuth = {
      isAuthenticated: true,
      email: email,
      transporter: testTransporter
    };

    console.log(`✅ Email authentication successful for: ${email}`);
    
    res.json({ 
      success: true, 
      message: 'Authentication successful',
      email: email
    });
    
  } catch (error) {
    console.error('❌ Email authentication failed:', error);
    
    emailAuth = {
      isAuthenticated: false,
      email: null,
      transporter: null
    };
    
    res.status(401).json({ 
      success: false, 
      error: 'Authentication failed. Please check your email and app password.' 
    });
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    isAuthenticated: emailAuth.isAuthenticated,
    email: emailAuth.email
  });
});

app.post('/api/auth/logout', (req, res) => {
  emailAuth = {
    isAuthenticated: false,
    email: null,
    transporter: null
  };
  
  console.log('🔓 User logged out');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    if (!emailAuth.isAuthenticated || !emailAuth.transporter) {
      return res.status(401).json({ 
        success: false, 
        error: 'Please log in with your email credentials to send emails' 
      });
    }

    const { to, subject, body, prospectId } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: to, subject, body' 
      });
    }

    console.log(`📧 Sending email to: ${to}`);
    console.log(`📋 Subject: ${subject}`);

    const mailOptions = {
      from: `"TheNetwrk" <${emailAuth.email}>`,
      to: to,
      subject: subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          ${body.replace(/\n/g, '<br>')}
        </div>
      `,
      text: body
    };

    const info = await emailAuth.transporter.sendMail(mailOptions);
    
    // Store email in database
    db.emailsSent.push({
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      prospectId: prospectId,
      to: to,
      subject: subject,
      body: body,
      sentAt: new Date().toISOString(),
      status: 'sent',
      messageId: info.messageId
    });
    
    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`📬 Message ID: ${info.messageId}`);
    
    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: info.messageId,
      sentTo: to
    });
    
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send email: ' + error.message 
    });
  }
});

// AI analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
    }

    const { prospect } = req.body;
    
    if (!prospect) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prospect data is required' 
      });
    }

    console.log(`🤖 Analyzing prospect: ${prospect.name}`);

    // Prepare comprehensive data for AI analysis
    const analysisData = {
      name: prospect.name || 'Unknown',
      headline: prospect.headline || '',
      about: prospect.about || '',
      experiences: prospect.experiences || [],
      skills: prospect.skills || [],
      posts: prospect.posts || [],
      comments: prospect.comments || [],
      activityEmails: prospect.activityEmails || [],
      activityPhones: prospect.activityPhones || [],
      googleEmails: prospect.googleEmails || [],
      portfolioSites: prospect.portfolioSites || [],
      githubProfile: prospect.githubProfile || '',
      redditActivity: prospect.redditActivity || []
    };

    const prompt = `Analyze this professional's profile and activity to determine their job-seeking likelihood and generate insights:

PROFILE DATA:
Name: ${analysisData.name}
Headline: ${analysisData.headline}
About: ${analysisData.about}
Experiences: ${analysisData.experiences.length} roles listed
Skills: ${analysisData.skills.join(', ')}

ACTIVITY DATA:
Recent Posts: ${analysisData.posts.length}
Recent Comments: ${analysisData.comments.length}
Emails Found: ${[...analysisData.activityEmails, ...analysisData.googleEmails].length}
Portfolio Sites: ${analysisData.portfolioSites.length}
GitHub Profile: ${analysisData.githubProfile ? 'Yes' : 'No'}
Reddit Activity: ${analysisData.redditActivity.length} activities

ANALYSIS REQUIRED:
1. Job Seeker Score (0-100%): How likely are they actively job seeking?
2. Career Stage: Entry/Mid/Senior/Executive
3. Tech Background: None/Basic/Moderate/Strong
4. Industry: Primary industry/field
5. Key Skills: Top 3-5 relevant skills
6. Experience Years: Estimated years of experience
7. Job Seeking Signals: Number of active job seeking indicators (0-5)

Consider these job seeking signals:
- "Open to work" or similar phrases
- Recent career transitions
- Active on professional platforms
- Portfolio/GitHub activity
- Networking behavior
- Skills updating
- Career change discussions

Respond in JSON format:
{
  "jobSeekerScore": number,
  "careerStage": "string",
  "techBackground": "string", 
  "industry": "string",
  "keySkills": ["skill1", "skill2", "skill3"],
  "experienceYears": number,
  "jobSeekingSignals": number,
  "reasoning": "Brief explanation of the score"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert recruiter and career analyst. Analyze professional profiles to identify job seekers and career changers."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    console.log(`✅ AI analysis complete for ${prospect.name}:`);
    console.log(`📊 Job Seeker Score: ${analysis.jobSeekerScore}%`);
    console.log(`🎯 Career Stage: ${analysis.careerStage}`);
    console.log(`💻 Tech Background: ${analysis.techBackground}`);

    res.json({
      success: true,
      analysis: analysis,
      tokensUsed: response.usage.total_tokens
    });

  } catch (error) {
    console.error('❌ AI analysis failed:', error);
    
    res.status(500).json({ 
      success: false, 
      error: 'AI analysis failed: ' + error.message 
    });
  }
});

// Message generation endpoint
app.post('/api/generate-message', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
    }

    const { prospect, analysis } = req.body;
    
    if (!prospect || !analysis) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prospect data and analysis are required' 
      });
    }

    console.log(`✍️ Generating personalized message for: ${prospect.name}`);

    const prompt = `Generate a personalized outreach message for this professional:

PROSPECT: ${prospect.name}
HEADLINE: ${prospect.headline || 'Not available'}
INDUSTRY: ${analysis.industry}
CAREER STAGE: ${analysis.careerStage}
JOB SEEKER SCORE: ${analysis.jobSeekerScore}%
KEY SKILLS: ${analysis.keySkills?.join(', ')}

CONTEXT:
- This person appears to be ${analysis.jobSeekerScore > 70 ? 'actively' : analysis.jobSeekerScore > 40 ? 'potentially' : 'not actively'} job seeking
- They have ${analysis.techBackground.toLowerCase()} technical background
- Career stage: ${analysis.careerStage}

Write a personalized 2-3 sentence message that:
1. Shows you've researched their background
2. Mentions relevant skills or experience
3. Offers value (job opportunities, networking, etc.)
4. Is professional but friendly
5. Includes a clear call to action

Keep it concise and authentic. Don't be overly salesy.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional recruiter writing personalized outreach messages. Write messages that are genuine, valuable, and respectful."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const message = response.choices[0].message.content.trim();
    
    console.log(`✅ Message generated for ${prospect.name}`);
    console.log(`📝 Message preview: ${message.substring(0, 100)}...`);

    res.json({
      success: true,
      message: message,
      tokensUsed: response.usage.total_tokens
    });

  } catch (error) {
    console.error('❌ Message generation failed:', error);
    
    res.status(500).json({ 
      success: false, 
      error: 'Message generation failed: ' + error.message 
    });
  }
});

// Get email history
app.get('/api/emails', (req, res) => {
  res.json({
    success: true,
    emails: db.emailsSent,
    total: db.emailsSent.length
  });
});

// Get prospects
app.get('/api/prospects', (req, res) => {
  res.json({
    success: true,
    prospects: db.prospects,
    total: db.prospects.length
  });
});

// Add prospect
app.post('/api/prospects', (req, res) => {
  try {
    const { prospect } = req.body;
    
    if (!prospect) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prospect data is required' 
      });
    }

    // Add timestamp and ID
    const newProspect = {
      ...prospect,
      id: `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date().toISOString()
    };

    db.prospects.push(newProspect);
    
    console.log(`👤 Added new prospect: ${newProspect.name}`);
    
    res.json({
      success: true,
      prospect: newProspect
    });

  } catch (error) {
    console.error('❌ Failed to add prospect:', error);
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add prospect: ' + error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TheNetwrk API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log(`📧 Email endpoint: http://localhost:${PORT}/api/send-email`);
  console.log(`🤖 AI analysis: http://localhost:${PORT}/api/analyze`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️  OpenAI API key not found. Set OPENAI_API_KEY in .env file');
  } else {
    console.log('✅ OpenAI API key configured');
  }
});

module.exports = app;