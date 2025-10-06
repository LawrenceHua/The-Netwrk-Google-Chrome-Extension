/**
 * TheNetwrk Content Script - Simple LinkedIn Profile Capture
 * Captures profile data from the page YOU'RE viewing
 */

console.log('✅ TheNetwrk Assistant loaded on:', window.location.href);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);
  
  // Ping test
  if (request.action === 'ping') {
    console.log('🏓 CONTENT: Ping received, responding...');
    sendResponse({ success: true, message: 'Content script alive' });
    return false;
  }
  
  // Fill LinkedIn message
  if (request.action === 'fillLinkedInMessage') {
    console.log('📤 Filling LinkedIn message:', request.recipientName);
    fillLinkedInMessage(request.message, request.recipientName);
    sendResponse({ success: true });
    return false;
  }
  
  // Automate LinkedIn messaging (new enhanced version)
  if (request.action === 'automateLinkedInMessage') {
    console.log('🤖 Automating LinkedIn message:', request.recipientName);
    automateLinkedInMessage(request.message, request.recipientName)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        console.error('❌ Automation failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Async response
  }
  
  // Google Scout: Scrape Google search results
  if (request.action === 'scrapeGoogleResults') {
    console.log('🔍 Scraping Google search results...');
    try {
      const results = scrapeGoogleSearchResults();
      sendResponse({ success: true, results: results });
    } catch (error) {
      console.error('❌ Error scraping Google results:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }
  
  // Google Scout: Scrape website for contact information
  if (request.action === 'scrapeWebsiteContacts') {
    console.log('🕷️ Scraping website for contacts...');
    try {
      const contacts = scrapeWebsiteForContacts();
      sendResponse({ success: true, ...contacts });
    } catch (error) {
      console.error('❌ Error scraping website contacts:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }
  
  // Phase 1: Collect URLs from search page
  if (request.action === 'collectURLs') {
    console.log('🔍 Collecting profile URLs from search page...');
    
    if (window.URLCollector) {
      const profiles = URLCollector.collectFromCurrentPage();
      console.log(`✅ Collected ${profiles.length} profile URLs`);
      sendResponse({ success: true, profiles: profiles });
        } else {
      sendResponse({ success: false, error: 'URLCollector not loaded' });
    }
    
    return true;
  }
  
  // Phase 1: Search for job seekers
  if (request.action === 'searchJobSeekers') {
    console.log('🔍 CONTENT: searchJobSeekers message received!');
    console.log('🔍 CONTENT: Request data:', request);
    console.log('🔍 CONTENT: Current URL:', window.location.href);
    console.log('🔍 CONTENT: URLCollector available:', typeof window.URLCollector);
    console.log('🔍 CONTENT: Keywords available:', typeof window.JOB_SEEKER_KEYWORDS);
    console.log('🔍 CONTENT: Keywords count:', window.JOB_SEEKER_KEYWORDS?.length);
    
    // Just collect URLs from current page - background will handle navigation
    if (window.URLCollector) {
      console.log('🔍 CONTENT: Collecting URLs from current page only...');
      
      try {
        const profiles = URLCollector.collectFromCurrentPage();
        console.log(`✅ CONTENT: Found ${profiles.length} profiles on current page`);
        
        // Send back to background script with search parameters
        sendResponse({ 
          success: true, 
          profiles: profiles,
          keywordCount: request.keywordCount,
          pagesPerKeyword: request.pagesPerKeyword
        });
  } catch (error) {
        console.error('❌ CONTENT: Error collecting URLs:', error);
        sendResponse({ success: false, error: error.message });
      }
        } else {
      console.error('❌ CONTENT: URLCollector not available');
      sendResponse({ success: false, error: 'URLCollector not loaded' });
    }
    
    // Don't return true - let it be synchronous
    return false;
  }
  
  // Phase 2: Deep research a single prospect
  if (request.action === 'deepResearch') {
    console.log('🔬 CONTENT: Deep research message received');
    console.log('🔬 CONTENT: Prospect:', request.prospect?.name);
    console.log('🔬 CONTENT: Current URL:', window.location.href);
    console.log('🔬 CONTENT: DeepResearcher available:', typeof window.DeepResearcher);
    
    // Send immediate response to prevent timeout, then do work
    sendResponse({ success: true, status: 'started', prospect: request.prospect });
    
    // Do the actual research work asynchronously
    setTimeout(async () => {
      try {
        let profileData;
        
        if (window.DeepResearcher) {
          console.log('🔍 CONTENT: Using comprehensive DeepResearcher...');
          profileData = await DeepResearcher.researchProspect(request.prospect);
        } else {
          console.log('⚠️ CONTENT: Using basic profile capture...');
          profileData = captureCurrentProfile();
        }
        
        if (profileData && profileData.name && profileData.name !== 'Unknown') {
          console.log('✅ CONTENT: Research complete:', profileData.name);
          
          // Store result for background script to retrieve
          window.researchResult = {
            success: true,
            profile: profileData,
            timestamp: Date.now()
          };
          
          // Notify background script that research is complete
          chrome.runtime.sendMessage({
            action: 'researchComplete',
            prospectId: request.prospect.id,
            profile: profileData
          });
          
        } else {
          console.log('❌ CONTENT: Research failed');
          window.researchResult = {
            success: false,
            error: 'Failed to capture profile data',
            timestamp: Date.now()
          };
          
          chrome.runtime.sendMessage({
            action: 'researchComplete',
            prospectId: request.prospect.id,
            error: 'Failed to capture profile data'
          });
        }
        
      } catch (error) {
        console.error('❌ CONTENT: Research error:', error);
        window.researchResult = {
          success: false,
          error: error.message,
          timestamp: Date.now()
        };
        
        chrome.runtime.sendMessage({
          action: 'researchComplete',
          prospectId: request.prospect.id,
          error: error.message
        });
      }
    }, 100); // Small delay to ensure response is sent first
    
    return false; // Don't wait for async operation
  }
  
  // Legacy: Capture current profile (for manual use)
  if (request.action === 'captureProfile') {
    console.log('📸 Capturing current profile...');
    
    const profileData = captureCurrentProfile();
    
    if (profileData) {
      console.log('✅ Profile captured:', profileData.name);
      sendResponse({ success: true, profile: profileData });
      } else {
      console.log('❌ Not on a profile page');
      sendResponse({ success: false, error: 'Not on profile page' });
    }
    
    return true;
  }
});

/**
 * Capture COMPREHENSIVE data from current LinkedIn profile
 */
function captureCurrentProfile() {
  const url = window.location.href;
  
  // Check if we're on a LinkedIn profile page
  if (!url.includes('linkedin.com/in/')) {
    return null;
  }
  
  console.log('🔍 Extracting COMPREHENSIVE profile data...');
  
  // Scroll to load all content first
  scrollToLoadContent();
  
  // Wait a moment for content to load
  setTimeout(() => {}, 2000);
  
  // Get ALL text content from the page
  const allText = document.body.innerText || '';
  
  // Extract name from multiple sources
  let name = extractName();
  
  // Extract headline
  let headline = extractHeadline();
  
  // Extract about section
  let about = extractAboutSection();
  
  // Extract experiences
  let experiences = extractExperiences();
  
  // Extract skills
  let skills = extractSkills();
  
  // Extract education
  let education = extractEducation();
  
  // Extract recent posts and comments (last 6 months)
  let posts = extractRecentPosts();
  let comments = extractRecentComments();
  
  // Extract contact info
  let email = extractEmail(allText);
  let phone = extractPhone(allText);
  let location = extractLocation();
  
  console.log('✅ Comprehensive capture complete:', {
    name: name,
    headline: headline ? headline.substring(0, 50) + '...' : 'None',
    about: about ? 'Found' : 'None',
    experiences: experiences.length,
    skills: skills.length,
    posts: posts.length,
    comments: comments.length,
    email: email ? 'Found' : 'None',
    textLength: allText.length
  });
  
  return {
    name: name || 'Unknown',
    headline: headline || '',
    about: about || '',
    experiences: experiences,
    skills: skills,
    education: education,
    posts: posts,
    comments: comments,
    email: email || '',
    phone: phone || '',
    location: location || '',
    linkedinUrl: url,
    allText: allText, // Send ALL text to AI for analysis
    capturedAt: new Date().toISOString()
  };
}

// Helper functions for comprehensive extraction
function extractName() {
  // Try multiple selectors
  const selectors = ['h1', '[data-field="name"]', '.text-heading-xlarge'];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const name = element.textContent.trim().split('\n')[0].trim();
      if (name && name.length > 2 && name.length < 100) {
        return name;
      }
    }
  }
  
  // Fallback to page title
  const title = document.title.split('|')[0].trim();
  return title.length > 2 ? title : 'Unknown';
}

function extractHeadline() {
  // Look for headline in multiple places
  const allText = document.body.innerText || '';
  const lines = allText.split('\n').filter(l => l.trim().length > 10 && l.trim().length < 300);
  
  // Look for lines that look like headlines
  for (const line of lines.slice(0, 10)) {
    if (line.includes('|') || 
        line.includes(' at ') || 
        line.includes('Engineer') ||
        line.includes('Developer') ||
        line.includes('Manager') ||
        line.includes('Analyst') ||
        line.includes('Scientist')) {
      return line.trim();
    }
    }
    
    return '';
}

function extractAboutSection() {
  const allText = document.body.innerText || '';
  
  // Look for "About" section
  const aboutIndex = allText.toLowerCase().indexOf('about');
  if (aboutIndex !== -1) {
    const aboutSection = allText.substring(aboutIndex, aboutIndex + 2000);
    const lines = aboutSection.split('\n').filter(l => l.trim().length > 20);
    return lines.slice(1, 10).join(' ').trim(); // Skip "About" header, take next 9 lines
    }
    
    return '';
}

function extractExperiences() {
    const experiences = [];
  const allText = document.body.innerText || '';
  
  // Look for experience patterns
  const expRegex = /(.+?)\s+at\s+(.+?)(?:\n|·|$)/gi;
  let match;
  
  while ((match = expRegex.exec(allText)) !== null && experiences.length < 10) {
    const title = match[1]?.trim();
    const company = match[2]?.trim();
    
    if (title && company && title.length < 100 && company.length < 100) {
      experiences.push({
          title: title,
        company: company
      });
    }
  }
  
    return experiences;
}

function extractSkills() {
    const skills = [];
  const allText = document.body.innerText || '';
  
  // Common tech skills to look for
  const techSkills = [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'Angular', 'Vue',
    'HTML', 'CSS', 'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Azure', 'Docker',
    'Kubernetes', 'Git', 'TypeScript', 'C++', 'C#', 'Ruby', 'PHP', 'Swift'
  ];
  
  const lowerText = allText.toLowerCase();
  
  techSkills.forEach(skill => {
    if (lowerText.includes(skill.toLowerCase())) {
      skills.push(skill);
    }
  });
  
  return skills;
}

function extractEducation() {
    const education = [];
  const allText = document.body.innerText || '';
  
  // Look for university patterns
  const eduRegex = /(University of .+?|.+? University|.+? College|MIT|Stanford|Harvard|Berkeley|CMU|Caltech)(?:\n|·|,|$)/gi;
  let match;
  
  while ((match = eduRegex.exec(allText)) !== null && education.length < 5) {
    education.push(match[1].trim());
  }
  
    return education;
}

function extractRecentPosts() {
  // Look for post-like content (last 6 months)
  const posts = [];
  const allText = document.body.innerText || '';
  
  // Look for lines that might be posts
  const lines = allText.split('\n').filter(l => l.trim().length > 50 && l.trim().length < 500);
  
  lines.forEach(line => {
    if ((line.includes('ago') || line.includes('week') || line.includes('month')) && 
        !line.includes('Show') && posts.length < 10) {
      posts.push({
        text: line.trim(),
        extractedAt: new Date().toISOString()
      });
    }
  });
  
  return posts;
}

function extractRecentComments() {
  // Similar to posts but usually shorter
  const comments = [];
  const allText = document.body.innerText || '';
  
  const lines = allText.split('\n').filter(l => l.trim().length > 10 && l.trim().length < 200);
  
  lines.forEach(line => {
    if (line.includes('ago') && line.length < 200 && comments.length < 10) {
      comments.push({
        text: line.trim(),
        extractedAt: new Date().toISOString()
      });
    }
  });
  
  return comments;
}

function extractEmail(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];
  return emails[0] || '';
}

function extractPhone(text) {
  const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
  const phones = text.match(phoneRegex) || [];
  return phones[0] || '';
}

function extractLocation() {
  const allText = document.body.innerText || '';
  
  // Look for location patterns
  const locationRegex = /(.+?),\s*(CA|NY|TX|FL|WA|IL|PA|OH|GA|NC|MI|NJ|VA|WI|AZ|MA|TN|IN|MO|MD|MN|CO|AL|SC|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|DC)/gi;
  
  const match = allText.match(locationRegex);
  return match ? match[0] : '';
}

/**
 * Scroll page to load all dynamic content
 */
function scrollToLoadContent() {
  // Scroll to bottom
  window.scrollTo(0, document.body.scrollHeight);
  
  // Wait a bit, then scroll back to top
    setTimeout(() => {
    window.scrollTo(0, 0);
        }, 1000);
}

/**
 * Automate clicking Message button and filling LinkedIn message
 */
async function automateLinkedInMessage(message, recipientName) {
  console.log(`🤖 Starting LinkedIn message automation for ${recipientName}`);
  
  try {
    // Step 1: Find and click the Message button
    const messageButton = await findAndClickMessageButton();
    if (!messageButton) {
      throw new Error('Could not find Message button on profile');
    }
    
    // Step 2: Wait for message compose window to open
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Find and fill the message input
    const success = await fillMessageInput(message, recipientName);
    if (!success) {
      throw new Error('Could not fill message input');
    }
    
    console.log(`✅ Successfully automated message for ${recipientName}`);
    showNotification(`✅ Message ready to send for ${recipientName}!`, 'success');
    
    return { success: true, message: 'Message automated successfully' };
    
  } catch (error) {
    console.error('❌ Automation failed:', error);
    
    // Fallback: copy message to clipboard
    try {
      await navigator.clipboard.writeText(message);
      showNotification(`📋 Automation failed. Message copied to clipboard for ${recipientName}.`, 'info');
      return { success: false, error: error.message, fallback: 'clipboard' };
    } catch (clipboardError) {
      showNotification(`❌ Automation failed for ${recipientName}. Please send manually.`, 'error');
      return { success: false, error: error.message, fallback: 'manual' };
    }
  }
}

/**
 * Find and click the Message button on LinkedIn profile
 */
async function findAndClickMessageButton() {
  console.log('🔍 Looking for Message button...');
  
  const messageButtonSelectors = [
    'button[aria-label*="Message"]',
    'button:contains("Message")',
    'a[href*="/messaging/thread/"]',
    '.message-anywhere-button',
    '[data-control-name="message"]',
    'button.message-anywhere-button',
    'button.pvs-profile-actions__action',
    'button[data-test-app-aware-link]'
  ];
  
  let messageButton = null;
  
  // Try each selector
  for (const selector of messageButtonSelectors) {
    if (selector.includes(':contains')) {
      // Handle jQuery-style selector manually
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.toLowerCase().includes('message')) {
          messageButton = btn;
          break;
        }
      }
    } else {
      messageButton = document.querySelector(selector);
    }
    
    if (messageButton) {
      console.log(`✅ Found Message button with selector: ${selector}`);
      break;
    }
  }
  
  if (!messageButton) {
    // Look for any button with "Message" text
    const allButtons = document.querySelectorAll('button, a');
    for (const btn of allButtons) {
      if (btn.textContent.toLowerCase().includes('message') && 
          !btn.textContent.toLowerCase().includes('more') &&
          btn.offsetWidth > 0 && btn.offsetHeight > 0) {
        messageButton = btn;
        console.log('✅ Found Message button by text search');
        break;
      }
    }
  }
  
  if (messageButton) {
    console.log('🖱️ Clicking Message button...');
    messageButton.click();
    return messageButton;
  }
  
  console.log('❌ Could not find Message button');
  return null;
}

/**
 * Fill the message input with formatted content
 */
async function fillMessageInput(message, recipientName) {
  console.log(`📝 Attempting to fill message input for ${recipientName}`);
  
  // Wait for compose window to appear
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const messageInput = findMessageInput();
    
    if (messageInput) {
      console.log('✅ Found message input, filling content...');
      
      // Clear existing content
      messageInput.innerHTML = '';
      messageInput.textContent = '';
      
      // Set the formatted message
      messageInput.textContent = message;
      messageInput.innerHTML = message.replace(/\n/g, '<br>');
      
      // Trigger events to make LinkedIn recognize the input
      messageInput.dispatchEvent(new Event('input', { bubbles: true }));
      messageInput.dispatchEvent(new Event('change', { bubbles: true }));
      messageInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      
      // Focus the input
      messageInput.focus();
      
      console.log(`✅ Successfully filled message input for ${recipientName}`);
      return true;
    }
    
    // Wait and try again
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  
  console.log('❌ Could not find message input after multiple attempts');
  return false;
}

/**
 * Find message input field
 */
function findMessageInput() {
  const messageSelectors = [
    '.msg-form__contenteditable',
    '[data-placeholder*="message"]',
    '[aria-label*="message"]',
    '.compose-form__message-field',
    '.msg-form__msg-content-container',
    '[contenteditable="true"]',
    '.msg-form__textarea',
    'div[role="textbox"]'
  ];
  
  for (const selector of messageSelectors) {
    const input = document.querySelector(selector);
    if (input && input.offsetWidth > 0 && input.offsetHeight > 0) {
      return input;
    }
  }
  
  return null;
}

/**
 * Fill LinkedIn message compose window with personalized message
 */
function fillLinkedInMessage(message, recipientName) {
  console.log(`📝 Attempting to fill LinkedIn message for ${recipientName}`);
  
  // Wait for page to load
  setTimeout(() => {
    try {
      // Try multiple selectors for LinkedIn message input
      const messageSelectors = [
        '.msg-form__contenteditable',
        '[data-placeholder="Write a message..."]',
        '[aria-label="Write a message..."]',
        '.compose-form__message-field',
        '.msg-form__msg-content-container',
        '[contenteditable="true"]'
      ];
      
      let messageInput = null;
      
      for (const selector of messageSelectors) {
        messageInput = document.querySelector(selector);
        if (messageInput) {
          console.log(`✅ Found message input with selector: ${selector}`);
          break;
        }
      }
      
      if (messageInput) {
        // Clear existing content
        messageInput.innerHTML = '';
        messageInput.textContent = '';
        
        // Insert the personalized message
        messageInput.innerHTML = `<p>${message}</p>`;
        messageInput.textContent = message;
        
        // Trigger input events to make LinkedIn recognize the content
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        messageInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Focus the input
        messageInput.focus();
        
        console.log(`✅ Successfully filled message for ${recipientName}`);
        console.log(`📝 Message: ${message.substring(0, 100)}...`);
        
        // Show success notification
        showNotification(`✅ Message filled for ${recipientName}!`, 'success');
        
      } else {
        console.log('❌ Could not find LinkedIn message input field');
        console.log('🔍 Available inputs:', document.querySelectorAll('input, textarea, [contenteditable]').length);
        
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(message).then(() => {
          showNotification(`📋 Message copied to clipboard for ${recipientName}. Please paste manually.`, 'info');
        }).catch(() => {
          showNotification(`❌ Could not auto-fill message. Please type manually.`, 'error');
        });
      }
      
  } catch (error) {
      console.error('❌ Error filling LinkedIn message:', error);
      
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(message).then(() => {
        showNotification(`📋 Message copied to clipboard. Please paste manually.`, 'info');
      }).catch(() => {
        showNotification(`❌ Could not auto-fill message. Please type manually.`, 'error');
        });
      }
    }, 2000);
}

/**
 * Show notification on LinkedIn page
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
    z-index: 10000;
      padding: 15px 20px;
      border-radius: 8px;
        color: white;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    max-width: 350px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    ${type === 'success' ? 'background: #48bb78;' : ''}
    ${type === 'error' ? 'background: #e53e3e;' : ''}
    ${type === 'info' ? 'background: #4299e1;' : ''}
  `;
  
  notification.textContent = message;
      document.body.appendChild(notification);
    
  // Auto-remove after 5 seconds
    setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

console.log('✅ TheNetwrk ready - visit LinkedIn profiles to capture data');

// ==================== GOOGLE SCOUT FUNCTIONS ====================

/**
 * Scrape Google search results for contact information
 */
function scrapeGoogleSearchResults() {
  console.log('🔍 Scraping Google search results...');
  
  const results = [];
  
  // Get search result containers
  const searchResults = document.querySelectorAll('.g, .tF2Cxc');
  
  searchResults.forEach((result, index) => {
    try {
      const titleElement = result.querySelector('h3, .LC20lb.MBeuO.DKV0Md');
      const linkElement = result.querySelector('a[href]');
      const snippetElement = result.querySelector('.VwiC3b.yXK7lf.MUxGbd.yDYNvb.lyLwlc.lEBKkf, .s3v9rd.AP7Wnd');
      
      if (titleElement && linkElement) {
        const resultData = {
          title: titleElement.textContent.trim(),
          url: linkElement.href,
          snippet: snippetElement ? snippetElement.textContent.trim() : '',
          position: index + 1
        };
        
        results.push(resultData);
        console.log(`📄 Result ${index + 1}:`, resultData.title);
      }
    } catch (error) {
      console.log(`⚠️ Error processing result ${index + 1}:`, error);
    }
  });
  
  console.log(`✅ Scraped ${results.length} Google search results`);
  return results;
}

/**
 * Scrape current website for contact information
 */
function scrapeWebsiteForContacts() {
  console.log('🕷️ Scraping website for contact information...');
  
  const contacts = {
    emails: [],
    phones: [],
    socialMedia: []
  };
  
  // Get all text content from the page
  const pageText = document.body.textContent || document.body.innerText || '';
  
  // Extract emails using regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = pageText.match(emailRegex) || [];
  
  emailMatches.forEach(email => {
    // Filter out common non-personal emails
    if (!email.includes('noreply') && 
        !email.includes('support') && 
        !email.includes('info@') &&
        !email.includes('admin@') &&
        !email.includes('no-reply')) {
      contacts.emails.push(email);
    }
  });
  
  // Extract phone numbers
  const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
  const phoneMatches = pageText.match(phoneRegex) || [];
  contacts.phones = [...new Set(phoneMatches)];
  
  // Look for social media links
  const socialLinks = document.querySelectorAll('a[href*="twitter.com"], a[href*="instagram.com"], a[href*="facebook.com"], a[href*="linkedin.com"]');
  socialLinks.forEach(link => {
    contacts.socialMedia.push({
      platform: getSocialPlatform(link.href),
      url: link.href
    });
  });
  
  // Also check contact pages specifically
  const contactLinks = document.querySelectorAll('a[href*="contact"], a[href*="about"]');
  if (contactLinks.length > 0) {
    console.log(`📧 Found ${contactLinks.length} potential contact pages`);
  }
  
  console.log('📧 Contact extraction results:', {
    emails: contacts.emails.length,
    phones: contacts.phones.length,
    socialMedia: contacts.socialMedia.length
  });
  
  return contacts;
}

/**
 * Get social media platform from URL
 */
function getSocialPlatform(url) {
  if (url.includes('twitter.com')) return 'Twitter';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('facebook.com')) return 'Facebook';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  return 'Other';
}

// ==================== REDDIT SCOUT FUNCTIONS ====================

/**
 * Scrape Reddit for job seeker posts and career pivot discussions
 */
function scrapeRedditJobSeekers(prospect) {
  console.log('🔍 Scraping Reddit for job seeker activity...');
  
  const redditData = {
    posts: [],
    comments: [],
    jobSeekerSignals: [],
    careerPivotSignals: [],
    techInterest: []
  };
  
  // Check if we're on Reddit
  if (!window.location.hostname.includes('reddit.com')) {
    console.log('⚠️ Not on Reddit, cannot scrape');
    return redditData;
  }
  
  try {
    // Look for job-seeking keywords in posts and comments
    const jobSeekerKeywords = [
      'looking for work',
      'job search',
      'unemployed',
      'laid off',
      'seeking opportunities',
      'open to work',
      'job hunting',
      'career change',
      'pivot to tech',
      'breaking into tech',
      'career transition',
      'new grad',
      'bootcamp graduate',
      'self taught',
      'looking for entry level',
      'junior developer',
      'help with resume',
      'interview prep',
      'job applications'
    ];
    
    // Scrape posts
    const posts = document.querySelectorAll('[data-testid="post-container"], .Post');
    posts.forEach((post, index) => {
      try {
        const title = post.querySelector('h3, [data-testid="post-content"] h3')?.textContent?.trim() || '';
        const content = post.querySelector('[data-testid="post-content"] .md, .usertext-body')?.textContent?.trim() || '';
        const author = post.querySelector('[data-testid="post_author_link"], .author')?.textContent?.trim() || '';
        const subreddit = post.querySelector('[data-testid="subreddit-name"], .subreddit')?.textContent?.trim() || '';
        
        const fullText = `${title} ${content}`.toLowerCase();
        
        // Check for job seeker signals
        const jobSeekerMatches = jobSeekerKeywords.filter(keyword => 
          fullText.includes(keyword.toLowerCase())
        );
        
        if (jobSeekerMatches.length > 0) {
          redditData.posts.push({
            title,
            content: content.substring(0, 500), // Limit content length
            author,
            subreddit,
            jobSeekerSignals: jobSeekerMatches,
            url: window.location.href
          });
          
          console.log(`📝 Found job seeker post: ${title.substring(0, 50)}...`);
        }
        
      } catch (error) {
        console.log(`⚠️ Error processing Reddit post ${index}:`, error);
      }
    });
    
    // Scrape comments
    const comments = document.querySelectorAll('[data-testid="comment"], .comment');
    comments.forEach((comment, index) => {
      try {
        const content = comment.querySelector('.md, .usertext-body')?.textContent?.trim() || '';
        const author = comment.querySelector('[data-testid="comment_author_link"], .author')?.textContent?.trim() || '';
        
        const fullText = content.toLowerCase();
        
        // Check for job seeker signals
        const jobSeekerMatches = jobSeekerKeywords.filter(keyword => 
          fullText.includes(keyword.toLowerCase())
        );
        
        if (jobSeekerMatches.length > 0) {
          redditData.comments.push({
            content: content.substring(0, 300),
            author,
            jobSeekerSignals: jobSeekerMatches,
            url: window.location.href
          });
        }
        
      } catch (error) {
        console.log(`⚠️ Error processing Reddit comment ${index}:`, error);
      }
    });
    
    console.log(`✅ Reddit scraping complete: ${redditData.posts.length} posts, ${redditData.comments.length} comments`);
    
  } catch (error) {
    console.error('❌ Reddit scraping error:', error);
  }
  
  return redditData;
}

/**
 * Search Reddit for specific user activity
 */
function searchRedditUser(username) {
  console.log(`🔍 Searching Reddit for user: ${username}`);
  
  // This would be called when we open a Reddit user profile
  const userData = {
    username,
    posts: [],
    comments: [],
    jobSeekerActivity: false,
    techInterest: false,
    careerStage: 'unknown'
  };
  
  try {
    // Look for user's posts and comments
    const userContent = document.querySelectorAll('[data-testid="post-container"], [data-testid="comment"]');
    
    userContent.forEach(item => {
      const text = item.textContent?.toLowerCase() || '';
      
      // Check for job seeking activity
      if (text.includes('looking for') || text.includes('job search') || text.includes('unemployed')) {
        userData.jobSeekerActivity = true;
      }
      
      // Check for tech interest
      if (text.includes('programming') || text.includes('coding') || text.includes('developer')) {
        userData.techInterest = true;
      }
    });
    
  } catch (error) {
    console.error('❌ Reddit user search error:', error);
  }
  
  return userData;
}

console.log('🚀 Google Scout & Reddit Scout loaded - Multi-platform contact discovery ready');
