// Test script for OpenAI integration
const OpenAI = require('openai');

// Initialize OpenAI with the API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Sample prospect data for testing
const sampleProspectData = {
  name: "Sarah Chen",
  headline: "Software Engineer seeking new opportunities in tech",
  location: "San Francisco, CA",
  experiences: "Frontend Developer at TechCorp (2 years); Junior Developer at StartupXYZ (1 year)",
  posts: "Recently shared thoughts on React best practices and job searching tips",
  skills: "JavaScript, React, Node.js, Python, AWS",
  projects: "E-commerce web app with React and Node.js; Personal portfolio website",
  workStatus: "Open to work",
  isLikelyJobSeeker: true,
  education: "BS Computer Science from UC Berkeley"
};

// Helper function to create personalized prompt
function createPersonalizedPrompt(prospectData) {
  const {
    name,
    headline,
    location,
    experiences,
    posts,
    skills,
    projects,
    workStatus,
    isLikelyJobSeeker
  } = prospectData;

  const firstName = name ? name.split(' ')[0] : 'there';

  return `Take all the information I have given you about ${firstName}. They are ${isLikelyJobSeeker ? 'actively looking for a job and want to break into tech' : 'potentially interested in career opportunities in tech'}. Here's their profile:

Name: ${name || 'Not provided'}
Current Role/Headline: ${headline || 'Not provided'}
Location: ${location || 'Not provided'}
Experiences: ${experiences || 'Not provided'}
Recent Posts/Activity: ${posts || 'Not provided'}
Work Status: ${workStatus || 'Not provided'}
Skills: ${skills || 'Not provided'}
Projects: ${projects || 'Not provided'}

Here's everything about TheNetwrk that you should condense and personalize to make sense for this job seeker:

TheNetwrk is a community founded by Abigayle that helps early career professionals find $90k+ jobs in tech. We focus on:

- Weekly coaching sessions with actionable insights (not generic advice)
- Access to the most supportive job seeker community with accountability partners
- Direct pipeline into well-funded tech startups and small businesses
- Building real connections, not transactional networking

Abigayle's story: Started with no CS background in high school, created her own path by founding the first Girls Who Code club in Hawaii, became state robotics champion, scaled a mental health nonprofit to 100+ chapters while in college, and landed 8 job offers by creating her own opportunities.

The community costs $39/month for accepted members and focuses on helping driven individuals who feel stuck in the traditional job application cycle.

Write a simple yet powerful LinkedIn message that:
1. Doesn't look AI-generated 
2. Is actually interesting and personalized to their background
3. Shows genuine interest in their career journey
4. Briefly explains how TheNetwrk could specifically help them
5. Includes a soft call-to-action
6. Keep it under 150 words
7. Sound conversational and human

Do NOT use phrases like "I came across your profile" or "I hope this message finds you well" or other generic openings. Make it feel like a real person reaching out.`;
}

// Test the OpenAI integration
async function testOpenAI() {
  try {
    console.log('Testing OpenAI integration...\n');
    
    const prompt = createPersonalizedPrompt(sampleProspectData);
    console.log('Generated prompt:\n', prompt);
    console.log('\n' + '='.repeat(80) + '\n');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional networking expert who writes authentic, personalized outreach messages that don't sound AI-generated. Your messages should be warm, genuine, and focused on how TheNetwrk can specifically help this person based on their background."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const personalizedMessage = completion.choices[0].message.content.trim();

    console.log('Generated personalized message:');
    console.log('='.repeat(50));
    console.log(personalizedMessage);
    console.log('='.repeat(50));
    console.log('\nUsage:', completion.usage);
    console.log('\n✅ OpenAI integration test successful!');

  } catch (error) {
    console.error('❌ Error testing OpenAI integration:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testOpenAI();