/**
 * TheNetwrk Content Script - CLEANED VERSION
 * 
 * PHASE 1 - Profile Collection:
 * - Collects profiles from LinkedIn search pages
 * - Extracts: Name, Headline, LinkedIn URL
 * - Uses URLCollector to scroll and gather all visible profiles
 * 
 * PHASE 2 - Deep Research Flow:
 * 1. Main Profile: Scrape About section (with "see more" expansion)
 * 2. Experience Page: Navigate to /details/experience/ and collect job history
 * 3. Contact Info: Check /overlay/contact-info/ for email/phone
 * 4. Comments Page: Scrape /recent-activity/comments/ for last 6 months
 *    - FILTER: Only save comments with @ symbols
 * 5. AI Analysis: Send all data to backend for job seeker scoring
 * 
 * All data is saved to dashboard via background.js
 */

// Prevent multiple script injections
if (window.theNetwrkContentScriptLoaded) {
  console.log('🔄 TheNetwrk content script already loaded, skipping');
} else {
  window.theNetwrkContentScriptLoaded = true;

console.log('✅ TheNetwrk Assistant loaded on:', window.location.href);

// Enhanced logging function with file logging for debugging
function logToExtension(message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const fullTimestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  console.log(logMessage);
  if (data) {
    console.log(data);
  }
  
  // Send to background script for file logging
  try {
    chrome.runtime.sendMessage({
      action: 'fileLog',
      message: logMessage,
      data: data,
      timestamp: fullTimestamp,
      url: window.location.href,
      prospectName: window.currentProspectName || 'Unknown'
    }).catch(() => {
      // Ignore if background script isn't listening
    });
  } catch (e) {
    // Ignore runtime message errors
  }
}

// Initialize
if (typeof window.theNetwrkIsReady === 'undefined') {
  window.theNetwrkIsReady = false;
}

function initializeContentScript() {
  console.log('🚀 CONTENT: Initializing TheNetwrk content script...');
  window.theNetwrkIsReady = true;
  console.log('✅ CONTENT: TheNetwrk content script ready!');
}

initializeContentScript();

// Test logging immediately on load
logToExtension('🧪 CONTENT: Content script loaded and logging test', {
  url: window.location.href,
  timestamp: new Date().toISOString(),
  action: 'content_script_loaded'
});

// AUTO-DETECT & AUTO-SCRAPE: If we loaded on a comments page, scrape it immediately!
if (window.location.href.includes('/recent-activity/comments')) {
  console.log('🔍 CONTENT: AUTO-DETECT - Loaded on comments page!');
  console.log('   📍 URL:', window.location.href);
  
  // Wait for page to load, then auto-scrape
  setTimeout(async () => {
    console.log('   🔍 CONTENT: Checking page status...');
    
    // Check for LinkedIn auth wall
    const pageText = document.body.innerText || '';
    console.log('   📊 CONTENT: Page text length:', pageText.length, 'characters');
    
    if (pageText.includes('Sign in') || pageText.includes('Join LinkedIn')) {
      console.log('   🚫 CONTENT: LinkedIn auth wall detected - cannot scrape');
      
      // Send auth blocked message
      chrome.runtime.sendMessage({
        action: 'commentsScrapingComplete',
        prospectId: 'auto-detect',
        results: { success: false, error: 'LinkedIn authentication required', authBlocked: true }
      }).catch(() => {});
      
      return;
    }
    
    console.log('   ✅ CONTENT: Page accessible! AUTO-SCRAPING comments now...');
    console.log('   🚀 CONTENT: Starting automatic comments scraping...');
    
    try {
      // Get profile name from page (not URL slug!)
      console.log('   🔍 CONTENT: Extracting profile name from page...');
      
      // Try multiple selectors for name
      let profileName = '';
      const nameSelectors = ['h1', 'h1.inline', '.text-heading-xlarge'];
      
      for (const selector of nameSelectors) {
        const nameEl = document.querySelector(selector);
        if (nameEl && nameEl.textContent.trim().length > 2) {
          profileName = nameEl.textContent.trim();
          console.log(`   ✅ Found name via ${selector}: "${profileName}"`);
          break;
        }
      }
      
      // Fallback to URL slug if can't find name
      if (!profileName || profileName.length < 3) {
        const urlMatch = window.location.href.match(/\/in\/([^/]+)/);
        const slug = urlMatch ? urlMatch[1] : 'Unknown';
        // Convert slug to name format: stephanie-risca → Stephanie Risca
        profileName = slug.split('-')
          .filter(word => word.length > 2)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        console.log(`   ⚠️ Using formatted slug as name: "${profileName}"`);
      }
      
      console.log('   👤 CONTENT: Final profile name:', profileName);
      
      // AUTO-SCRAPE
      const results = await scrapeCommentsPageSimple(profileName);
      
      console.log('   ✅ CONTENT: Auto-scraping complete!');
      console.log('   📧 CONTENT: Emails found:', results.commentEmails?.length || 0);
      console.log('   💬 CONTENT: Comments with @:', results.comments?.length || 0);
      
      // Send results to background
      chrome.runtime.sendMessage({
        action: 'commentsScrapingComplete',
        prospectId: 'auto-scraped',
        results: results
      });
      
      console.log('   📤 CONTENT: Results sent to background!');
      
    } catch (error) {
      console.error('   ❌ CONTENT: Auto-scraping error:', error);
      chrome.runtime.sendMessage({
        action: 'commentsScrapingComplete',
        prospectId: 'auto-detect',
        results: { success: false, error: error.message }
      }).catch(() => {});
    }
  }, 5000); // Wait 5 seconds for page to fully load
}

// Global storage for comments results
window.commentsResultsCache = new Map();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 CONTENT: Message received:', request.action);
  
  // Ping test
  if (request.action === 'ping') {
    sendResponse({ 
      success: true, 
      message: 'Content script alive', 
      isReady: window.theNetwrkIsReady,
      url: window.location.href
    });
    return false;
  }
  
  // Receive comments results from background
  if (request.action === 'commentsResultsReady') {
    console.log('📥 CONTENT: Received comments results from background');
    console.log('   Prospect ID:', request.prospectId);
    console.log('   Has results:', !!request.results);
    
    // Store in cache for waitForCommentsResults to find
    window.commentsResultsCache.set(request.prospectId, request.results);
    
    sendResponse({ success: true });
    return false;
  }
  
  // Scrape comments ONLY (for separate comments tab)
  if (request.action === 'scrapeCommentsOnly') {
    console.log('💬 CONTENT: ========== SCRAPE COMMENTS ONLY MESSAGE RECEIVED ==========');
    console.log('   👤 Profile name:', request.profileName);
    console.log('   🆔 Prospect ID:', request.prospectId);
    console.log('   📍 Current URL:', window.location.href);
    
    sendResponse({ success: true, status: 'started' });
    
    (async () => {
      try {
        // Verify we're on comments page
        if (!window.location.href.includes('/recent-activity/comments')) {
          console.log('   ⚠️ Not on comments page!');
          throw new Error('Not on comments page! URL: ' + window.location.href);
        }
        
        console.log('   ✅ Confirmed on comments page');
        console.log('   ⏳ Waiting 5 seconds for page to fully load...');
        await new Promise(r => setTimeout(r, 5000));
        
        console.log('   🚀 Starting comments scraping...');
        const results = await scrapeCommentsPageSimple(request.profileName);
        
        console.log('   ✅ Scraping complete, sending results to background...');
        chrome.runtime.sendMessage({
          action: 'commentsScrapingComplete',
          prospectId: request.prospectId,
          results: results
        });
        
        console.log('   ✅ Results sent! Tab will close soon.');
        
      } catch (error) {
        console.error('   ❌ Comments scraping error:', error);
        chrome.runtime.sendMessage({
          action: 'commentsScrapingComplete',
          prospectId: request.prospectId,
          results: { success: false, error: error.message }
        });
      }
    })();
    
    return false;
  }
  
  // Navigate to comments via UI (or scrape if already there)
  if (request.action === 'navigateToCommentsViaUI') {
    console.log('🖱️ CONTENT: ========== NAVIGATE TO COMMENTS VIA UI ==========');
    console.log('   👤 Profile:', request.profileName);
    console.log('   🆔 Prospect:', request.prospectId);
    console.log('   📍 Current URL:', window.location.href);
    
    sendResponse({ success: true, status: 'started' });
    
    (async () => {
      try {
        const profileName = request.profileName;
        const prospectId = request.prospectId;
        
        // CHECK: Are we already on comments page?
        const alreadyOnComments = window.location.href.includes('/recent-activity/comments');
        console.log('   🔍 Already on comments?', alreadyOnComments);
        
        if (alreadyOnComments) {
          console.log('   ✅ Already on comments page! Scraping directly...');
          
          // Wait for page to settle
          await new Promise(r => setTimeout(r, 3000));
          
          // Scrape directly
          const results = await scrapeCommentsPageSimple(profileName);
          
          // Send results
          chrome.runtime.sendMessage({
            action: 'commentsScrapingComplete',
            prospectId: prospectId,
            results: results
          });
          
          console.log('   ✅ Comments scraping complete (direct)!');
          return;
        }
        
        // Not on comments, need to navigate
        console.log('   🌐 Not on comments yet, navigating...');
        
        let currentUrl = window.location.href.split('?')[0].split('#')[0];
        if (currentUrl.endsWith('/')) currentUrl = currentUrl.slice(0, -1);
        
        if (!currentUrl.includes('/recent-activity')) {
          currentUrl = `${currentUrl}/recent-activity`;
        }
        
        const commentsUrl = `${currentUrl}/comments/`;
        console.log('   📍 Navigating to:', commentsUrl);
        
        window.location.href = commentsUrl;
        
        // WAIT for navigation and page load
        console.log('   ⏳ Waiting 10 seconds for comments page...');
        await new Promise(r => setTimeout(r, 10000));
        
        // Scrape comments
        console.log('   💬 Scraping comments after navigation...');
        const results = await scrapeCommentsPageSimple(profileName);
        
        // Send results back
        chrome.runtime.sendMessage({
          action: 'commentsScrapingComplete',
          prospectId: prospectId,
          results: results
        });
        
        console.log('   ✅ Comments scraping complete (after navigation)!');
        
      } catch (error) {
        console.error('   ❌ UI navigation/scraping error:', error);
        chrome.runtime.sendMessage({
          action: 'commentsScrapingComplete',
          prospectId: request.prospectId,
          results: { success: false, error: error.message }
        });
      }
    })();
    
    return false;
  }
  
  // Collect URLs from search page - SIMPLIFIED
  if (request.action === 'collectURLs') {
    console.log('🔍 CONTENT: Starting SIMPLE profile collection...');
    
    // Send immediate acknowledgment
    sendResponse({ success: true, status: 'started' });
    
    // Start collection process asynchronously
    (async () => {
      try {
        console.log('🚀 CONTENT: Creating URLCollector...');
        
        // Always create fresh collector
        const collector = new URLCollector();
        
        // Wait for page to be ready
        console.log('⏳ CONTENT: Waiting for page to settle...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Simple collection
        console.log('📊 CONTENT: Starting simple profile collection...');
        const profiles = await collector.collectURLsFromPage();
        
        console.log(`✅ CONTENT: Simple collection complete - found ${profiles?.length || 0} profiles`);
        
        if (profiles && profiles.length > 0) {
          console.log('👥 CONTENT: First 3 profiles:', profiles.slice(0, 3).map(p => ({
            name: p.name,
            url: p.linkedinUrl?.substring(0, 40)
          })));
          
          // Wait until we have at least 5 profiles or timeout
          if (profiles.length >= 5) {
            console.log('🎯 CONTENT: Got 5+ profiles, sending to dashboard...');
          } else {
            console.log('⚠️ CONTENT: Only got', profiles.length, 'profiles, but sending anyway...');
          }
        }
        
        // Send results to background for dashboard saving
        chrome.runtime.sendMessage({
          action: 'collectionComplete',
          profiles: profiles || [],
          success: true,
          count: profiles?.length || 0
        });
        
      } catch (error) {
        console.error('❌ CONTENT: Collection error:', error);
        chrome.runtime.sendMessage({
          action: 'collectionComplete',
          profiles: [],
          success: false,
          error: error.message
        });
      }
    })();
    
    return true;
  }
  
  // Comprehensive research
  if (request.action === 'comprehensiveResearch') {
    console.log('🔬 CONTENT: Starting comprehensive research for:', request.prospect?.name);
    
    // Set current prospect name for logging
    window.currentProspectName = request.prospect?.name;
    
    // Send IMMEDIATE acknowledgment that research has started
    sendResponse({ 
      success: true, 
      status: 'started',
      message: `Research started for ${request.prospect?.name}`
    });
    
    // Start SIMPLE research process - NO PAGE NAVIGATIONS
    // Results will be sent via chrome.runtime.sendMessage when complete
    (async () => {
      try {
        console.log('🚀 CONTENT: Starting SIMPLE LinkedIn research (main profile only)...');
        console.log('⏳ CONTENT: NO page navigations to avoid breaking message channel');
        
        // Initialize profile data
        let profileData = {
          name: request.prospect.name,
          linkedinUrl: request.prospect.linkedinUrl,
          headline: '',
          about: '',
          experiences: [],
          skills: [],
          contactEmails: [],
          commentEmails: [],
          comments: [],
          allText: ''
        };
        
        // STEP 1: Navigate to profile and extract header info + about section
        logToExtension('📊 CONTENT: STEP 1 - Main profile research (name, headline, about)...', {
          prospectName: request.prospect.name,
          profileUrl: request.prospect.linkedinUrl,
          step: 1,
          action: 'starting_main_profile'
        });
        
        const mainProfileData = await researchMainProfileThoroughly(request.prospect.linkedinUrl);
        profileData = { ...profileData, ...mainProfileData };
        
        // Extract contact emails from main profile data
        if (mainProfileData.contactEmails && mainProfileData.contactEmails.length > 0) {
          console.log('   📧 CONTENT: Contact emails from modal:', mainProfileData.contactEmails);
        }
        
        // VALIDATE: Must have name before continuing
        if (!profileData.name || profileData.name === 'Unknown') {
          throw new Error('Could not extract name from profile - stopping research');
        }
        
        logToExtension('✅ CONTENT: STEP 1 complete - Name validated', {
          name: profileData.name,
          headline: profileData.headline ? 'Found' : 'Missing',
          about: profileData.about ? 'Found' : 'Missing',
          contactEmails: profileData.contactEmails?.length || 0,
          step: 1,
          action: 'completed_main_profile'
        });
        
        // STEP 2: Request comments scraping in a SEPARATE tab
        console.log('💬 CONTENT: STEP 2 - Requesting comments scraping in separate tab...');
        
        // Ask background to open comments tab and scrape
        // Results will come back via runtime message
        console.log('📤 CONTENT: Sending request to background to open comments tab...');
        
        chrome.runtime.sendMessage({
          action: 'scrapeCommentsInNewTab',
          profileUrl: request.prospect.linkedinUrl,
          profileName: profileData.name,
          prospectId: request.prospect.id
        });
        
        // Wait for comments results (with timeout)
        console.log('⏳ CONTENT: Waiting for comments results from background...');
        const commentsResults = await waitForCommentsResults(request.prospect.id, 30000); // 30 second timeout
        
        if (commentsResults && commentsResults.success) {
          console.log('✅ CONTENT: Got comments results from separate tab!');
          profileData.contactEmails = commentsResults.contactEmails || [];
          profileData.commentEmails = commentsResults.commentEmails || [];
          profileData.comments = commentsResults.comments || [];
          console.log(`   📧 Emails found: ${profileData.commentEmails.length}`);
        } else {
          console.log('⚠️ CONTENT: No comments results (timeout or failed)');
          profileData.contactEmails = [];
          profileData.commentEmails = [];
          profileData.comments = [];
        }
        
        console.log('✅ STEP 2 complete - Comments scraping handled in separate tab');
        
        // STEP 3: Generate comprehensive profile for AI analysis
        logToExtension('🤖 CONTENT: STEP 5 - Generating comprehensive profile for AI...', {
          step: 5,
          action: 'starting_ai_analysis'
        });
        
        const comprehensiveProfile = generateComprehensiveProfile(profileData);
        const aiResults = await analyzeWithOpenAI(comprehensiveProfile);
        profileData = { ...profileData, ...aiResults };
        
        logToExtension('✅ CONTENT: STEP 5 complete', {
          jobSeekerScore: profileData.jobSeekerScore || 0,
          isJobSeeker: profileData.isJobSeeker || false,
          step: 5,
          action: 'completed_ai_analysis'
        });
        
        // Final validation - ensure we have at least name
        if (!profileData.name || profileData.name === 'Unknown') {
          throw new Error('Research completed but name is missing - data quality issue');
        }
        
        // Mark as researched
        profileData.isResearched = true;
        profileData.researchedAt = new Date().toISOString();
        profileData.researchStatus = profileData.contactEmails?.length > 0 || profileData.commentEmails?.length > 0 ? 'email-found' : 'fully-researched';
        
        const researchSummary = {
          name: profileData.name,
          headline: profileData.headline ? 'Found' : 'Missing',
          about: profileData.about ? 'Found' : 'Missing',
          experiences: profileData.experiences?.length || 0,
          skills: profileData.skills?.length || 0,
          contactEmails: profileData.contactEmails?.length || 0,
          commentEmails: profileData.commentEmails?.length || 0,
          commentsWithAtSymbols: profileData.comments?.length || 0,
          jobSeekerScore: profileData.jobSeekerScore || 0,
          isJobSeeker: profileData.isJobSeeker || false,
          researchStatus: profileData.researchStatus
        };
        
        logToExtension('🎉 CONTENT: METHODICAL RESEARCH COMPLETE FOR ' + profileData.name, researchSummary);
        console.log('🎉 ========== METHODICAL RESEARCH COMPLETE ==========');
        console.log('👤 Prospect:', profileData.name);
        console.log('📰 Headline:', profileData.headline || 'Not found');
        console.log('📄 About:', profileData.about ? `Found (${profileData.about.length} chars)` : 'Not found');
        console.log('💼 Experiences:', profileData.experiences?.length || 0);
        console.log('🛠️ Skills:', profileData.skills?.length || 0);
        console.log('📧 Contact Emails:', profileData.contactEmails?.length || 0);
        console.log('💬 Comments with @:', profileData.comments?.length || 0);
        console.log('📧 Comment Emails:', profileData.commentEmails?.length || 0);
        console.log('🎯 Job Seeker Score:', profileData.jobSeekerScore || 0, '%');
        console.log('✅ Is Job Seeker:', profileData.isJobSeeker || false);
        console.log('📊 Research Status:', profileData.researchStatus);
        console.log('==========================================');
        
        // Send result via runtime message (sendResponse was already called above)
        chrome.runtime.sendMessage({
          action: 'researchComplete',
          data: { success: true, profileData: profileData },
          prospectId: request.prospect.id,
          prospectName: request.prospect.name
        });
        
      } catch (error) {
        console.error('❌ CONTENT: Research error:', error);
        
        // Send error via runtime message
        chrome.runtime.sendMessage({
          action: 'researchError',
          error: error.message,
          prospectId: request.prospect?.id,
          prospectName: request.prospect?.name
        });
      }
    })();
    
    // Return false since we already called sendResponse immediately above
    return false;
  }
});

/**
 * Click "Contact info" button and extract email (if available)
 * This is quick and doesn't require navigation - just a modal
 */
async function clickContactInfoAndExtractEmail() {
  console.log('📧 CONTENT: Attempting to extract email from Contact info...');
  
  try {
    // STEP 1: Find and click "Contact info" button/link
    const allElements = document.querySelectorAll('button, a, div[role="button"]');
    let contactInfoButton = null;
    
    console.log(`   🔍 Scanning ${allElements.length} clickable elements...`);
    
    for (const el of allElements) {
      const text = el.textContent?.trim().toLowerCase() || '';
      const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
      const id = el.getAttribute('id')?.toLowerCase() || '';
      
      // Multiple detection patterns
      const isContactInfo = 
        text === 'contact info' ||
        text.includes('contact info') ||
        ariaLabel.includes('contact info') ||
        id.includes('contact-info') ||
        (text.includes('contact') && text.includes('info'));
      
      if (isContactInfo && el.offsetWidth > 0 && el.offsetHeight > 0) {
        contactInfoButton = el;
        console.log(`   ✅ Found "Contact info" element!`);
        console.log(`   📝 Text: "${text.substring(0, 50)}"`);
        console.log(`   📝 Aria: "${ariaLabel}"`);
        console.log(`   📝 Type: ${el.tagName}`);
        break;
      }
    }
    
    if (!contactInfoButton) {
      console.log('   ⚠️ No "Contact info" button found on page');
      console.log('   📊 Sample button texts:', 
        Array.from(allElements)
          .slice(0, 10)
          .map(el => el.textContent?.trim().substring(0, 30))
          .filter(t => t && t.length > 0)
      );
      return [];
    }
    
    // STEP 2: Scroll button into view and click
    console.log('   📜 Scrolling button into view...');
    contactInfoButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 500));
    
    console.log('   🖱️ Clicking "Contact info" button...');
    contactInfoButton.click();
    
    // STEP 3: Wait for modal to open
    console.log('   ⏳ Waiting 3 seconds for contact modal to open...');
    await new Promise(r => setTimeout(r, 3000));
    
    // STEP 4: Extract email from modal/page
    const pageTextBefore = document.body.innerText || '';
    const emailsBefore = pageTextBefore.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    
    console.log(`   📧 Found ${emailsBefore.length} email patterns on page`);
    
    // Filter out common false positives
    const validEmails = emailsBefore.filter(email => {
      const lower = email.toLowerCase();
      return !lower.includes('linkedin.com') && 
             !lower.includes('example.com') &&
             !lower.includes('test.com') &&
             !lower.includes('noreply') &&
             !lower.includes('privacy@');
    });
    
    // Remove duplicates
    const uniqueEmails = [...new Set(validEmails)];
    
    if (uniqueEmails.length > 0) {
      console.log('   ✅ Valid emails found:', uniqueEmails);
    } else {
      console.log('   ℹ️ No valid emails found in contact info');
    }
    
    // STEP 5: Close the modal (try multiple methods)
    console.log('   🗙 Closing contact info modal...');
    
    // Method 1: Find close button
    const closeSelectors = [
      'button[aria-label*="Dismiss"]',
      'button[aria-label*="Close"]', 
      '.artdeco-modal__dismiss',
      'button.artdeco-button--circle',
      '[data-test-modal-close-btn]'
    ];
    
    let modalClosed = false;
    for (const selector of closeSelectors) {
      const closeBtn = document.querySelector(selector);
      if (closeBtn) {
        closeBtn.click();
        console.log(`   ✅ Modal closed via selector: ${selector}`);
        modalClosed = true;
        break;
      }
    }
    
    // Method 2: Press ESC key
    if (!modalClosed) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      console.log('   ✅ Sent ESC key to close modal');
    }
    
    // Wait for modal to close
    await new Promise(r => setTimeout(r, 1000));
    
    return uniqueEmails;
    
  } catch (error) {
    console.error('   ❌ Contact info extraction error:', error.message);
    return [];
  }
}

/**
 * ROBUST main profile research - scrape EVERYTHING then sort
 */
async function researchMainProfileThoroughly(profileUrl) {
  console.log('📊 CONTENT: Starting ROBUST main profile research - scrape everything approach...');
  console.log('📍 CONTENT: Target URL:', profileUrl);
  console.log('📍 CONTENT: Current URL:', window.location.href);
  
  const baseUrl = profileUrl.replace(/\/$/, '');
  
  // STEP 1: Check if we need to navigate
  // Don't navigate if we're already on a LinkedIn profile page (main profile)
  // Only navigate if we're on feed/activity/search pages
  const isOnProfilePage = window.location.href.includes('/in/') && 
                          !window.location.href.includes('/feed/') && 
                          !window.location.href.includes('/activity') &&
                          !window.location.href.includes('/details/') &&
                          !window.location.href.includes('/overlay/');
  
  if (!isOnProfilePage) {
    console.log('🌐 CONTENT: Not on main profile page, navigating...');
    console.log('   From:', window.location.href);
    console.log('   To:', baseUrl);
    window.location.href = baseUrl;
    
    // WAIT for navigation
    console.log('⏳ CONTENT: Waiting 8 seconds for main profile to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));
  } else {
    console.log('✅ CONTENT: Already on a profile page, no navigation needed');
    console.log('   Current URL:', window.location.href);
  }
  
  // STEP 2: Initial page settle
  console.log('⏳ CONTENT: Initial page settle (3 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // STEP 2.5: Click "Contact info" button to check for email (QUICK!)
  console.log('📧 CONTENT: Looking for "Contact info" button...');
  console.log('📊 CONTENT: Checking all buttons on page...');
  const contactEmails = await clickContactInfoAndExtractEmail();
  console.log(`✅ CONTENT: Contact info check complete - found ${contactEmails.length} emails`);
  if (contactEmails.length > 0) {
    console.log('📧 CONTENT: Contact emails:', contactEmails);
  }
  
  // STEP 3: FORCE START SCROLLING - don't get stuck
  console.log('📜 CONTENT: FORCE STARTING scrolling NOW...');
  console.log(`📍 CONTENT: Current URL: ${window.location.href}`);
  console.log(`📏 CONTENT: Page height: ${document.body.scrollHeight}px, viewport: ${window.innerHeight}px`);
  console.log(`📄 CONTENT: Page has ${document.body.innerText?.length || 0} characters of text`);
  
  // If page seems stuck, force a scroll to wake it up
  if (document.body.scrollHeight < 1000) {
    console.log('⚠️ CONTENT: Page seems short, forcing scroll to bottom to trigger loading...');
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(resolve => setTimeout(resolve, 2000));
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const scrollPercentages = [0, 25, 50, 75, 100];
  let allTextCollected = '';
  let totalButtonsClicked = 0;
  
  for (const percentage of scrollPercentages) {
    console.log(`📜 CONTENT: SCROLLING NOW to ${percentage}% of page...`);
    
    // Calculate scroll position
    const maxScroll = Math.max(0, document.body.scrollHeight - window.innerHeight);
    const scrollY = (percentage / 100) * maxScroll;
    
    console.log(`📏 CONTENT: Calculated scroll: ${scrollY}px (${percentage}% of ${maxScroll}px)`);
    
    // SCROLL IMMEDIATELY
    window.scrollTo({ top: scrollY, behavior: 'smooth' });
    console.log(`✅ CONTENT: Scrolled to ${scrollY}px`);
    
    // SHORTER WAIT - start working immediately
    console.log(`⏳ CONTENT: Quick wait (2 seconds) at ${percentage}% position...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // CLICK ALL "SEE MORE" BUTTONS at this scroll position
    console.log(`🔘 CONTENT: Looking for "see more" buttons at ${percentage}% position...`);
    const buttonsClicked = await clickAllSeeMoreButtons();
    totalButtonsClicked += buttonsClicked;
    
    // COLLECT ALL TEXT at this position
    const currentText = document.body.innerText || '';
    allTextCollected += `\n--- TEXT AT ${percentage}% ---\n` + currentText;
    
    console.log(`📊 CONTENT: At ${percentage}%: Clicked ${buttonsClicked} buttons, collected ${currentText.length} chars`);
    
    // Force a small pause between percentages
    if (percentage < 100) {
      console.log('⏸️ CONTENT: Brief pause before next scroll position...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✅ CONTENT: Scrolling complete - clicked ${totalButtonsClicked} total buttons, collected ${allTextCollected.length} total chars`);
  
  // STEP 4: INTELLIGENT TEXT SORTING - extract what we need
  console.log('🧠 CONTENT: Intelligently sorting through all collected text...');
  const extractedData = intelligentTextExtraction(allTextCollected);
  
  console.log('✅ CONTENT: Main profile research complete:', {
    name: extractedData.name || 'Not found',
    headline: extractedData.headline ? 'Found' : 'Not found',
    about: extractedData.about ? `Found (${extractedData.about.length} chars)` : 'Not found',
    experiences: extractedData.experiences?.length || 0,
    skills: extractedData.skills?.length || 0,
    contactEmails: contactEmails.length
  });
  
  // Add contact emails to extracted data
  return {
    ...extractedData,
    contactEmails: contactEmails
  };
}

/**
 * Click ALL "see more" buttons at current scroll position - FASTER
 */
async function clickAllSeeMoreButtons() {
  console.log('🔘 CONTENT: Scanning for "see more" buttons...');
  const buttons = document.querySelectorAll('button');
  let clickedCount = 0;
  
  console.log(`🔘 CONTENT: Found ${buttons.length} total buttons on page`);
  
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || '';
    const aria = button.getAttribute('aria-label')?.toLowerCase() || '';
    
    // BROADER "see more" detection - click ANY see more button
    const isSeeMoreButton = (text.includes('see more') || text.includes('show more')) &&
      button.offsetWidth > 0 && button.offsetHeight > 0 &&
      !text.includes('message') && !text.includes('connect') && !text.includes('follow');
    
    if (isSeeMoreButton) {
      try {
        console.log(`🔘 CONTENT: Found "see more" button: "${text || aria}"`);
        
        // Quick click without too much scrolling
        button.click();
        clickedCount++;
        
        // SHORTER WAIT after clicking
        console.log(`⏳ CONTENT: Quick wait (1 second) for expansion...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (e) {
        console.log(`⚠️ CONTENT: Button click failed: ${e.message}`);
      }
    }
  }
  
  console.log(`✅ CONTENT: Clicked ${clickedCount} "see more" buttons`);
  return clickedCount;
}

/**
 * INTELLIGENT text extraction - sort through everything we collected
 */
function intelligentTextExtraction(allText) {
  console.log('🧠 CONTENT: Starting intelligent text extraction...');
  
  // Split into lines for analysis
  const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log(`📄 CONTENT: Analyzing ${lines.length} lines of text...`);
  
  let name = '';
  let headline = '';
  let about = '';
  const experiences = [];
  const skills = [];
  
  // EXTRACT NAME - Try DOM selectors first, then text analysis
  console.log('👤 CONTENT: Extracting name from text...');
  
  // Method 1: Try DOM selectors for name
  const nameSelectors = [
    'h1.text-heading-xlarge',
    'h1[class*="top-card"]',
    '.pv-text-details__left-panel h1',
    'h1.inline'
  ];
  
  for (const selector of nameSelectors) {
    const nameEl = document.querySelector(selector);
    if (nameEl && nameEl.textContent.trim().length > 0) {
      name = nameEl.textContent.trim();
      console.log(`✅ CONTENT: Found name via DOM (${selector}): "${name}"`);
      break;
    }
  }
  
  // Method 2: Fallback to text analysis
  if (!name || name.length < 3) {
  for (const line of lines.slice(0, 20)) {
    if (line.length > 2 && line.length < 100 && 
        !line.includes('LinkedIn') && !line.includes('connection') &&
        !line.includes('Message') && !line.includes('Connect') &&
          !line.includes('Follow') && !line.includes('More') &&
        /^[A-Z]/.test(line)) { // Starts with capital letter
      name = line;
        console.log(`✅ CONTENT: Found name via text analysis: "${name}"`);
      break;
      }
    }
  }
  
  // EXTRACT HEADLINE - Try DOM selectors first
  console.log('📰 CONTENT: Extracting headline from text...');
  
  // Method 1: Try DOM selectors for headline
  const headlineSelectors = [
    'div.text-body-medium.break-words',
    '.pv-top-card-profile-picture__container + div .text-body-medium',
    '[class*="top-card"] [class*="headline"]'
  ];
  
  for (const selector of headlineSelectors) {
    const headlineEl = document.querySelector(selector);
    if (headlineEl && headlineEl.textContent.trim().length > 10) {
      headline = headlineEl.textContent.trim();
      console.log(`✅ CONTENT: Found headline via DOM (${selector}): "${headline.substring(0, 50)}..."`);
      break;
    }
  }
  
  // Method 2: Fallback to text analysis
  if (!headline || headline.length < 10) {
    const headlineKeywords = ['engineer', 'developer', 'manager', 'designer', 'analyst', 'director', 'founder', 'ceo', 'at ', ' | ', 'specialist', 'lead'];
  for (const line of lines.slice(0, 30)) {
    const lowerLine = line.toLowerCase();
    if (line.length > 10 && line.length < 200 && 
          headlineKeywords.some(keyword => lowerLine.includes(keyword)) &&
          !line.includes('Message') && !line.includes('Connect')) {
      headline = line;
        console.log(`✅ CONTENT: Found headline via text analysis: "${headline.substring(0, 50)}..."`);
      break;
      }
    }
  }
  
  // EXTRACT ABOUT - look for About section with improved detection
  console.log('📄 CONTENT: Extracting About section from text...');
  const aboutIndex = allText.toLowerCase().indexOf('about');
  if (aboutIndex !== -1) {
    const aboutSection = allText.substring(aboutIndex, aboutIndex + 5000);
    const aboutLines = aboutSection.split('\n').filter(l => l.trim().length > 20);
    // Skip "About" header and any navigation text
    const cleanAboutLines = aboutLines.slice(1).filter(l => 
      !l.includes('See more') && 
      !l.includes('Show less') &&
      !l.includes('Experience') &&
      !l.includes('Education')
    );
    about = cleanAboutLines.slice(0, 20).join(' ').trim();
    
    // Clean up about section
    about = about
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/See more.*$/i, '') // Remove "See more" artifacts
      .trim();
    
    console.log(`✅ CONTENT: Found About section (${about.length} chars)`);
  }
  
  // EXTRACT EXPERIENCES - improved pattern matching
  console.log('💼 CONTENT: Extracting experiences from text...');
  const expMatches = allText.match(/(.+?)\s+(?:at|@)\s+(.+?)(?:\n|·|$)/gi) || [];
  const seenExperiences = new Set();
  
  expMatches.slice(0, 30).forEach(match => {
    const parts = match.split(/ at | @ /i);
    if (parts.length === 2) {
      const title = parts[0].trim();
      const company = parts[1].trim();
      
      // Validate and clean
      if (title.length > 3 && title.length < 150 && 
          company.length > 1 && company.length < 150 &&
          !title.includes('See all') && !title.includes('Show more') &&
          !company.includes('See all') && !company.includes('Show more')) {
        
        const expKey = `${title}|${company}`;
        if (!seenExperiences.has(expKey)) {
          seenExperiences.add(expKey);
      experiences.push({ 
            title: title, 
            company: company 
      });
        }
      }
    }
  });
  console.log(`✅ CONTENT: Found ${experiences.length} unique experiences`);
  
  // EXTRACT SKILLS - comprehensive tech skills list
  console.log('🛠️ CONTENT: Extracting skills from text...');
  const techSkills = [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'Angular', 'Vue',
    'HTML', 'CSS', 'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Azure', 'Docker',
    'Kubernetes', 'Git', 'TypeScript', 'C++', 'C#', 'Ruby', 'PHP', 'Swift',
    'Kotlin', 'Flutter', 'Django', 'Flask', 'Spring', 'Laravel', 'Rails',
    'Go', 'Rust', 'Scala', 'R', 'MATLAB', 'TensorFlow', 'PyTorch', 'Pandas',
    'NumPy', 'Scikit-learn', 'Tableau', 'Power BI', 'Excel', 'Figma', 'Sketch',
    'Adobe XD', 'Photoshop', 'Illustrator', 'Jira', 'Confluence', 'Slack',
    'GraphQL', 'REST API', 'Microservices', 'CI/CD', 'DevOps', 'Agile', 'Scrum'
  ];
  
  const lowerText = allText.toLowerCase();
  const foundSkills = new Set();
  
  techSkills.forEach(skill => {
    if (lowerText.includes(skill.toLowerCase())) {
      foundSkills.add(skill);
    }
  });
  
  console.log(`✅ CONTENT: Found ${foundSkills.size} skills`);
  
  return { 
    name: name || 'Unknown', 
    headline: headline || '', 
    about: about || '', 
    experiences: experiences, 
    skills: Array.from(foundSkills),
    allText: allText.substring(0, 10000) // Keep first 10k chars for AI
  };
}

/**
 * Scroll methodically to find About section
 */
async function scrollToFindAboutSection() {
  console.log('📜 CONTENT: Scrolling methodically to find About section...');
  
  let aboutFound = false;
  const scrollPositions = [0, 200, 400, 600, 800, 1000, 1200];
  
  for (const position of scrollPositions) {
    console.log(`📜 CONTENT: Scrolling to ${position}px to look for About section...`);
    window.scrollTo({ top: position, behavior: 'smooth' });
    
    // WAIT after each scroll
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if About section is visible
    const aboutIndicators = document.body.innerText.toLowerCase();
    if (aboutIndicators.includes('about') && aboutIndicators.includes('see more')) {
      console.log('👀 CONTENT: Found About section with "see more" at scroll position', position);
      aboutFound = true;
      break;
    }
  }
  
  if (!aboutFound) {
    console.log('⚠️ CONTENT: About section not found during scroll');
  }
}

/**
 * Extract About content methodically
 */
async function extractAboutContent() {
  console.log('📄 CONTENT: Extracting About content...');
  
  // STEP 1: Click all "see more" buttons in About section
  console.log('🔘 CONTENT: Looking for "see more" buttons in About section...');
  
  const buttons = document.querySelectorAll('button');
  let aboutButtonsClicked = 0;
  
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || '';
    const aria = button.getAttribute('aria-label')?.toLowerCase() || '';
    
    // Check if this is an About "see more" button
    if ((text.includes('see more') || text.includes('show more')) && 
        (text.includes('about') || button.closest('[data-section="summary"]') || 
         button.closest('.pv-shared-text-with-see-more'))) {
      
      try {
        console.log(`🔘 CONTENT: Clicking About "see more" button: "${text || aria}"`);
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        button.click();
        aboutButtonsClicked++;
        
        // WAIT after clicking
        console.log('⏳ CONTENT: Waiting 3 seconds for About section to expand...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (e) {
        console.log('⚠️ CONTENT: About button click failed:', e.message);
      }
    }
  }
  
  console.log(`✅ CONTENT: Clicked ${aboutButtonsClicked} About "see more" buttons`);
  
  // STEP 2: Extract About content after expansion
  console.log('📄 CONTENT: Extracting About content after expansion...');
  
  let about = '';
  const pageText = document.body.innerText || '';
  
  // Method 1: Look for "About" section in page text
  const aboutIndex = pageText.toLowerCase().indexOf('about');
  if (aboutIndex !== -1) {
    const aboutSection = pageText.substring(aboutIndex, aboutIndex + 2000);
    const lines = aboutSection.split('\n').filter(l => l.trim().length > 15);
    about = lines.slice(1, 10).join(' ').trim(); // Skip "About" header
    console.log(`📄 CONTENT: Extracted About from text (${about.length} chars)`);
  }
  
  // Method 2: Try DOM selectors for About section
  if (!about || about.length < 50) {
    const aboutSelectors = [
      '[data-section="summary"]',
      '.pv-about-section',
      '.pv-shared-text-with-see-more',
      '.inline-show-more-text'
    ];
    
    for (const selector of aboutSelectors) {
      const aboutElement = document.querySelector(selector);
      if (aboutElement && aboutElement.textContent.trim().length > about.length) {
        about = aboutElement.textContent.trim();
        console.log(`📄 CONTENT: Found About via selector ${selector} (${about.length} chars)`);
        break;
      }
    }
  }
  
  return about;
}

/**
 * Research main profile - About section with "see more" - SLOW and PERSISTENT
 */
async function researchMainProfile(profileUrl) {
  logToExtension('📊 CONTENT: Starting main profile research', {
    profileUrl,
    currentUrl: window.location.href,
    action: 'research_main_profile_start'
  });
  
  const baseUrl = profileUrl.replace(/\/$/, '');
  
  // Ensure we're on the main profile page (not feed or posts)
  if (!window.location.href.includes(baseUrl) || window.location.href.includes('/feed/') || window.location.href.includes('/activity:')) {
    logToExtension('🌐 CONTENT: Navigating to main profile (avoiding feed/posts)', {
      targetUrl: baseUrl,
      currentUrl: window.location.href,
      action: 'navigating_to_main_profile'
    });
    
    try {
      window.location.href = baseUrl;
      await new Promise(resolve => setTimeout(resolve, 6000)); // Longer wait
      
      logToExtension('✅ CONTENT: Navigation to main profile completed', {
        finalUrl: window.location.href,
        targetUrl: baseUrl,
        action: 'navigation_completed'
      });
    } catch (navError) {
      logToExtension('❌ CONTENT: Navigation to main profile failed', {
        error: navError.message,
        targetUrl: baseUrl,
        action: 'navigation_failed'
      });
      throw navError;
    }
  }
  
  // Wait for page to fully load
  logToExtension('⏳ CONTENT: Waiting for main profile to fully load', {
    currentUrl: window.location.href,
    pageTitle: document.title,
    initialTextLength: document.body?.innerText?.length || 0,
    action: 'waiting_for_page_load'
  });
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  logToExtension('📜 CONTENT: Starting THOROUGH scrolling to find About section', {
    pageHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
    totalButtons: document.querySelectorAll('button').length,
    action: 'starting_about_section_scroll'
  });
  
  let scrollPosition = 0;
  const scrollStep = 200; // Even smaller steps
  const maxScrolls = 15; // More scrolls
  let aboutButtonsClicked = 0;
  let totalButtonsFound = 0;
  
  for (let i = 0; i < maxScrolls; i++) {
    console.log(`📜 CONTENT: Main profile scroll ${i + 1}/${maxScrolls} to ${scrollPosition}px`);
    
    // Scroll slowly
    window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
    
    // PAUSE - Wait 1 second after scroll as requested
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then wait longer for content to load
    await new Promise(resolve => setTimeout(resolve, 4000)); // Increased wait time
    
    // COMPREHENSIVE button search - look for ALL possible About expansion buttons
    const buttons = document.querySelectorAll('button');
    const buttonsInView = [];
    
    buttons.forEach(button => {
      const text = button.textContent?.toLowerCase() || '';
      const aria = button.getAttribute('aria-label')?.toLowerCase() || '';
      const className = button.className?.toLowerCase() || '';
      
      // Check if button is visible
      if (button.offsetWidth > 0 && button.offsetHeight > 0) {
        totalButtonsFound++;
        
        // EXPANDED About section detection patterns
        const isAboutButton = 
          // Text-based detection
          (text.includes('see more') && text.includes('about')) ||
          (text.includes('show more') && text.includes('about')) ||
          text.includes('show more about') ||
          text.includes('see more about') ||
          // Aria-label detection
          (aria.includes('see more') && aria.includes('about')) ||
          (aria.includes('show more') && aria.includes('about')) ||
          // CSS class detection
          className.includes('show-more-less-html__button') ||
          className.includes('inline-show-more-text__button') ||
          // Parent element detection
          button.closest('.pv-shared-text-with-see-more') ||
          button.closest('.inline-show-more-text') ||
          button.closest('.show-more-less-html') ||
          // Generic "see more" in About section area
          (button.closest('[data-section="summary"]') && 
           (text.includes('see more') || text.includes('show more')));
        
        if (isAboutButton) {
          buttonsInView.push({ button, text: text || aria, type: 'about' });
        }
      }
    });
    
    logToExtension(`🔍 CONTENT: Scroll ${i + 1} - Found ${buttonsInView.length} About buttons out of ${totalButtonsFound} total buttons`, {
      scrollPosition,
      buttonsInView: buttonsInView.length,
      totalButtons: totalButtonsFound,
      aboutButtonCandidates: buttonsInView.map(b => b.text)
    });
    
    // Click all found About buttons
    for (const buttonInfo of buttonsInView) {
      try {
        console.log(`🔘 CONTENT: Found About "see more" button: "${buttonInfo.text}"`);
        
        buttonInfo.button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        buttonInfo.button.click();
        aboutButtonsClicked++;
        
        logToExtension(`✅ CONTENT: Clicked About "see more" button ${aboutButtonsClicked}`, {
          buttonText: buttonInfo.text,
          scrollPosition,
          action: 'clicked_about_button'
        });
        
        // PAUSE after clicking as requested
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (e) {
        logToExtension(`⚠️ CONTENT: About button click failed: ${e.message}`, {
          buttonText: buttonInfo.text,
          error: e.message
        });
      }
    }
    
    // PAUSE between scrolls as requested
    console.log('⏸️ CONTENT: Pausing before next scroll...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    scrollPosition += scrollStep;
    
    if (scrollPosition >= document.body.scrollHeight - window.innerHeight) {
      console.log('📜 CONTENT: Reached bottom of main profile');
      break;
    }
  }
  
  // Final pause before data extraction
  console.log('⏸️ CONTENT: Final pause before extracting profile data...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Extract data from expanded profile
  const pageText = document.body.innerText || '';
  const nameEl = document.querySelector('h1');
  const name = nameEl?.textContent?.trim() || 'Unknown';
  
  const headlineEl = document.querySelector('.text-body-medium');
  const headline = headlineEl?.textContent?.trim() || '';
  
  // ENHANCED About section extraction
  let about = '';
  
  // Method 1: Look for "About" section in page text
  const aboutIndex = pageText.toLowerCase().indexOf('about');
  if (aboutIndex !== -1) {
    const aboutSection = pageText.substring(aboutIndex, aboutIndex + 3000);
    const lines = aboutSection.split('\n').filter(l => l.trim().length > 15);
    about = lines.slice(1, 15).join(' ').trim(); // More comprehensive
  }
  
  // Method 2: Try to find About section via DOM selectors
  if (!about || about.length < 50) {
    const aboutSelectors = [
      '[data-section="summary"]',
      '.pv-about-section',
      '.pv-shared-text-with-see-more',
      '.inline-show-more-text',
      '.summary-section'
    ];
    
    for (const selector of aboutSelectors) {
      const aboutElement = document.querySelector(selector);
      if (aboutElement && aboutElement.textContent.trim().length > about.length) {
        about = aboutElement.textContent.trim();
        console.log(`📄 CONTENT: Found About section via selector: ${selector}`);
        break;
      }
    }
  }
  
  // Method 3: Look for expanded content after button clicks
  if (aboutButtonsClicked > 0) {
    console.log('🔄 CONTENT: Re-scanning page text after About button clicks...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const expandedPageText = document.body.innerText || '';
    if (expandedPageText.length > pageText.length) {
      console.log(`📈 CONTENT: Page expanded by ${expandedPageText.length - pageText.length} characters after About clicks`);
      
      // Re-extract About section from expanded content
      const expandedAboutIndex = expandedPageText.toLowerCase().indexOf('about');
      if (expandedAboutIndex !== -1) {
        const expandedAboutSection = expandedPageText.substring(expandedAboutIndex, expandedAboutIndex + 3000);
        const expandedLines = expandedAboutSection.split('\n').filter(l => l.trim().length > 15);
        const expandedAbout = expandedLines.slice(1, 15).join(' ').trim();
        
        if (expandedAbout.length > about.length) {
          about = expandedAbout;
          console.log('📄 CONTENT: Using expanded About section content');
        }
      }
    }
  }
  
  logToExtension('✅ CONTENT: Main profile research complete', {
    name,
    headline: headline ? 'Found' : 'Missing',
    about: about ? 'Found' : 'Missing',
    aboutLength: about.length,
    aboutButtonsClicked,
    totalButtonsScanned: totalButtonsFound,
    finalTextLength: pageText.length,
    aboutPreview: about.substring(0, 100) + (about.length > 100 ? '...' : '')
  });
  
  return { name, headline, about };
}

/**
 * ROBUST experience page research - percentage scrolling + scrape everything
 */
async function researchExperiencePageThoroughly(profileUrl) {
  console.log('💼 CONTENT: Starting ROBUST experience page research...');
  
  const baseUrl = profileUrl.replace(/\/$/, '');
  const experienceUrl = `${baseUrl}/details/experience/`;
  
  // STEP 1: Check if we need to navigate to experience page
  const isOnExperiencePage = window.location.href.includes('/details/experience');
  
  if (!isOnExperiencePage) {
  console.log('🌐 CONTENT: Navigating to experience page...');
    console.log('   From:', window.location.href);
    console.log('   To:', experienceUrl);
  window.location.href = experienceUrl;
  
  // WAIT for navigation
  console.log('⏳ CONTENT: Waiting 10 seconds for experience page to load...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  } else {
    console.log('✅ CONTENT: Already on experience page, no navigation needed');
  }
  
  // STEP 2: PERCENTAGE-BASED SCROLLING with expansion
  console.log('📜 CONTENT: Percentage-based scrolling through experience page...');
  const scrollPercentages = [0, 25, 50, 75, 100];
  let allExperienceText = '';
  let totalButtonsClicked = 0;
  
  for (const percentage of scrollPercentages) {
    console.log(`📜 CONTENT: Experience page - scrolling to ${percentage}%...`);
    
    const scrollY = (percentage / 100) * (document.body.scrollHeight - window.innerHeight);
    window.scrollTo({ top: scrollY, behavior: 'smooth' });
    
    // WAIT after scroll
    console.log(`⏳ CONTENT: Waiting 3 seconds at ${percentage}% of experience page...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // CLICK "see more" buttons for experiences at this position
    const buttonsClicked = await clickExperienceSeeMoreButtons();
    totalButtonsClicked += buttonsClicked;
    
    // COLLECT text at this position
    const currentText = document.body.innerText || '';
    allExperienceText += `\n--- EXPERIENCE TEXT AT ${percentage}% ---\n` + currentText;
    
    console.log(`📊 CONTENT: Experience ${percentage}%: Clicked ${buttonsClicked} buttons, collected ${currentText.length} chars`);
  }
  
  console.log(`✅ CONTENT: Experience scrolling complete - clicked ${totalButtonsClicked} buttons, collected ${allExperienceText.length} chars`);
  
  // STEP 3: INTELLIGENT extraction from all collected text
  console.log('🧠 CONTENT: Intelligently extracting experiences and skills from all text...');
  const experiences = extractExperiencesFromText(allExperienceText);
  const skills = extractSkillsFromText(allExperienceText);
  
  console.log('✅ CONTENT: Experience page research complete:', {
    experiences: experiences.length,
    skills: skills.length
  });
  
  // STEP 4: Don't navigate back - we'll do that after all research is complete
  console.log('✅ CONTENT: Experience research complete (staying on same page for now)');
  
  return { experiences, skills };
}

/**
 * Click experience-specific "see more" buttons
 */
async function clickExperienceSeeMoreButtons() {
  const buttons = document.querySelectorAll('button');
  let clickedCount = 0;
  
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || '';
    
    // Look for experience-related "see more" buttons
    if ((text.includes('see more') || text.includes('show more')) && 
        button.offsetWidth > 0 && button.offsetHeight > 0 &&
        !text.includes('message') && !text.includes('connect') && !text.includes('follow')) {
      try {
        console.log(`🔘 CONTENT: Clicking experience "see more": "${text}"`);
        button.click();
        clickedCount++;
        
        // WAIT after clicking
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (e) {
        console.log('⚠️ CONTENT: Experience button click failed:', e.message);
      }
    }
  }
  
  return clickedCount;
}

/**
 * Extract experiences from collected text
 */
function extractExperiencesFromText(text) {
  const experiences = [];
  
  // Look for job title patterns
  const expMatches = text.match(/(.+?)\s+at\s+(.+?)(?:\n|·|$)/gi) || [];
  expMatches.slice(0, 25).forEach(match => {
    const parts = match.split(' at ');
    if (parts.length === 2 && parts[0].length < 150 && parts[1].length < 150) {
      // Avoid duplicates
      const isDuplicate = experiences.some(exp => 
        exp.title === parts[0].trim() && exp.company === parts[1].trim()
      );
      
      if (!isDuplicate) {
        experiences.push({ 
          title: parts[0].trim(), 
          company: parts[1].trim() 
        });
      }
    }
  });
  
  return experiences;
}

/**
 * Extract skills from collected text
 */
function extractSkillsFromText(text) {
  const skills = [];
  
  // Comprehensive tech skills list
  const techSkills = [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'Angular', 'Vue',
    'HTML', 'CSS', 'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Azure', 'Docker',
    'Kubernetes', 'Git', 'TypeScript', 'C++', 'C#', 'Ruby', 'PHP', 'Swift',
    'Kotlin', 'Flutter', 'Django', 'Flask', 'Spring', 'Laravel', 'Rails',
    'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn', 'Tableau',
    'Power BI', 'Excel', 'R', 'Scala', 'Go', 'Rust', 'DevOps', 'CI/CD'
  ];
  
  const lowerText = text.toLowerCase();
  techSkills.forEach(skill => {
    if (lowerText.includes(skill.toLowerCase()) && !skills.includes(skill)) {
      skills.push(skill);
    }
  });
  
  return skills;
}

/**
 * Scroll through experience page methodically
 */
async function scrollThroughExperiencePage() {
  const scrollPositions = [0, 300, 600, 900, 1200, 1500];
  let experienceButtonsClicked = 0;
  
  for (const position of scrollPositions) {
    console.log(`📜 CONTENT: Experience page scroll to ${position}px...`);
    window.scrollTo({ top: position, behavior: 'smooth' });
    
    // WAIT after scroll
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Look for and click "see more" buttons for individual experiences
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent?.toLowerCase() || '';
      
      if ((text.includes('see more') || text.includes('show more')) && 
          button.offsetWidth > 0 && button.offsetHeight > 0 &&
          !text.includes('message') && !text.includes('connect')) {
        try {
          console.log(`🔘 CONTENT: Clicking experience "see more" button`);
          button.click();
          experienceButtonsClicked++;
          
          // WAIT after clicking
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (e) {
          console.log('⚠️ CONTENT: Experience button click failed:', e.message);
        }
      }
    }
    
    // WAIT between scrolls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`✅ CONTENT: Clicked ${experienceButtonsClicked} experience "see more" buttons`);
}

/**
 * Extract experiences from page
 */
function extractExperiencesFromPage() {
  const pageText = document.body.innerText || '';
  const experiences = [];
  
  // Look for job title patterns
  const expMatches = pageText.match(/(.+?)\s+at\s+(.+?)(?:\n|·|$)/gi) || [];
  expMatches.slice(0, 15).forEach(match => {
    const parts = match.split(' at ');
    if (parts.length === 2 && parts[0].length < 100 && parts[1].length < 100) {
      experiences.push({ 
        title: parts[0].trim(), 
        company: parts[1].trim() 
      });
    }
  });
  
  return experiences;
}

/**
 * Extract skills from page
 */
function extractSkillsFromPage() {
  const pageText = document.body.innerText || '';
  const skills = [];
  
  // Common tech skills to look for
  const techSkills = [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'Angular', 'Vue',
    'HTML', 'CSS', 'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Azure', 'Docker',
    'Kubernetes', 'Git', 'TypeScript', 'C++', 'C#', 'Ruby', 'PHP', 'Swift'
  ];
  
  const lowerText = pageText.toLowerCase();
  techSkills.forEach(skill => {
    if (lowerText.includes(skill.toLowerCase())) {
      skills.push(skill);
    }
  });
  
  return skills;
}

/**
 * METHODICAL contact info research
 */
async function researchContactInfoThoroughly(profileUrl) {
  console.log('📧 CONTENT: Starting METHODICAL contact info research...');
  
  const baseUrl = profileUrl.replace(/\/$/, '');
  const contactUrl = `${baseUrl}/overlay/contact-info/`;
  
  // STEP 1: Check if we need to navigate to contact overlay
  const isOnContactPage = window.location.href.includes('/overlay/contact-info');
  
  if (!isOnContactPage) {
  console.log('🌐 CONTENT: Navigating to contact info overlay...');
    console.log('   From:', window.location.href);
    console.log('   To:', contactUrl);
  window.location.href = contactUrl;
  
  // WAIT for overlay to load
  console.log('⏳ CONTENT: Waiting 8 seconds for contact overlay to load...');
  await new Promise(resolve => setTimeout(resolve, 8000));
  } else {
    console.log('✅ CONTENT: Already on contact info page');
  }
  
  // STEP 2: Extract contact information
  console.log('📧 CONTENT: Extracting contact information...');
  const pageText = document.body.innerText || '';
  const emails = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const phones = pageText.match(/(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g) || [];
  
  if (emails.length > 0) {
    console.log('📧 CONTENT: Contact emails found:', emails);
  }
  
  // STEP 3: Don't navigate back - stay on same page for now
  console.log('✅ CONTENT: Contact info research complete (staying on same page for now)');
  
  return { 
    contactEmails: emails,
    contactPhones: phones
  };
}

/**
 * PRODUCTION-READY Comments Research
 * 
 * Strategy:
 * 1. Navigate to /recent-activity/comments/
 * 2. Scroll until 6-month old posts
 * 3. Copy ALL text from page
 * 4. Find @ symbols near profile owner's name
 * 5. Extract emails
 * 
 * NO random clicking, NO complex logic, JUST scroll and parse
 */
async function researchCommentsPageProductionReady(profileUrl, profileOwnerName) {
  console.log('\n💬 ========== PRODUCTION COMMENTS RESEARCH ==========');
  console.log('👤 Profile owner:', profileOwnerName);
  console.log('🔗 Profile URL from DB:', profileUrl);
  console.log('📍 Current URL:', window.location.href);
  
  // Use CURRENT window URL (already resolved by LinkedIn) and append /recent-activity/comments/
  // Example: https://www.linkedin.com/in/olgavaskinova/ → .../olgavaskinova/recent-activity/comments/
  let currentUrl = window.location.href.split('?')[0].split('#')[0]; // Remove query params
  
  // Remove trailing slash
  if (currentUrl.endsWith('/')) {
    currentUrl = currentUrl.slice(0, -1);
  }
  
  // Build comments URL from current URL
  const commentsUrl = `${currentUrl}/recent-activity/comments/`;
  
  console.log('📍 Built comments URL:', commentsUrl);
  
  // STEP 1: Navigate to comments page
  console.log('🌐 STEP 1: Navigating to comments page...');
  window.location.href = commentsUrl;
  
  // WAIT for page to load
  console.log('⏳ Waiting 10 seconds for comments page to load...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Verify we're on the comments page
  console.log('📍 Current URL:', window.location.href);
  console.log('✅ On comments page:', window.location.href.includes('/recent-activity/comments'));
  
  // Check if auth-blocked
  const pageText = document.body.innerText || '';
  if (pageText.includes('Sign in') || window.location.href.includes('authwall')) {
    console.log('🚫 Comments page blocked by authentication');
    return { contactEmails: [], commentEmails: [], comments: [], authBlocked: true };
  }
  
  console.log('📊 Initial page text length:', pageText.length, 'characters');
  
  // STEP 2: Scroll until 6-month limit or max scrolls
  console.log('\n📜 STEP 2: Scrolling to load 6 months of comments...');
  
  let sixMonthReached = false;
  let scrollCount = 0;
  const maxScrolls = 15;
  
  while (!sixMonthReached && scrollCount < maxScrolls) {
    scrollCount++;
    console.log(`📜 Scroll ${scrollCount}/${maxScrolls}...`);
    
    // Scroll down one viewport
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    
    // Wait for lazy loading
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for 6-month indicators
    const currentText = document.body.innerText;
    const has6Months = currentText.match(/([6-9]|1[0-2])\s*mo|months|1\s*yr|year\s*ago/i);
    
    if (has6Months) {
      console.log('📅 Found 6-month indicator:', has6Months[0]);
      sixMonthReached = true;
      break;
    }
    
    // Check if at bottom
    const atBottom = (window.innerHeight + window.pageYOffset) >= document.body.scrollHeight - 50;
    if (atBottom) {
      console.log('📜 Reached bottom of page');
      break;
    }
  }
  
  console.log(`✅ Scrolling complete: ${scrollCount} scrolls, 6mo reached: ${sixMonthReached}`);
  
  // STEP 3: Copy ALL text from the page
  console.log('\n📋 STEP 3: Copying ALL text from comments page...');
  const allCommentsText = document.body.innerText || '';
  console.log(`✅ Copied ${allCommentsText.length} characters`);
  console.log(`📄 First 300 chars:`, allCommentsText.substring(0, 300));
  
  // STEP 4: Parse for emails near profile owner's name
  console.log('\n🔍 STEP 4: Parsing for emails...');
  console.log('👤 Looking for name:', profileOwnerName);
  
  const emailsFound = parseForEmailsNearName(allCommentsText, profileOwnerName);
  
  // STEP 5: Extract comments with @ for reference
  console.log('\n💬 STEP 5: Extracting comments with @ symbols...');
  const commentsWithAt = extractCommentsWithAtSymbols(allCommentsText);
  
  console.log('\n✅ ========== COMMENTS RESEARCH COMPLETE ==========');
  console.log('📧 Emails found:', emailsFound.length);
  console.log('💬 Comments with @:', commentsWithAt.length);
  console.log('📏 Total text:', allCommentsText.length, 'chars');
  
  if (emailsFound.length > 0) {
    console.log('📧 Emails:', emailsFound);
  }
  
  return {
    contactEmails: [],
    commentEmails: emailsFound,
    comments: commentsWithAt,
    allCommentsText: allCommentsText.substring(0, 3000)
  };
}

/**
 * OLD VERSION - KEEP FOR REFERENCE
 */
async function researchCommentsPageThoroughly(profileUrl) {
  console.log('💬 CONTENT: Starting SIMPLE comments research - scroll and copy all approach...');
  
  const baseUrl = profileUrl.replace(/\/$/, '');
  const commentsUrl = `${baseUrl}/recent-activity/comments/`;
  
  console.log('🌐 CONTENT: ALWAYS navigating to comments page...');
  console.log('   Target URL:', commentsUrl);
  console.log('   Current URL:', window.location.href);
  
  // ALWAYS navigate to ensure we're on the right page
  window.location.href = commentsUrl;
  
  // WAIT for comments page to load
  console.log('⏳ CONTENT: Waiting 12 seconds for comments page to load...');
  await new Promise(resolve => setTimeout(resolve, 12000));
  
  // Check if we hit a login page (authentication issue)
  const currentPageText = document.body.innerText || '';
  if (currentPageText.includes('Sign in') || currentPageText.includes('Join LinkedIn') || 
      window.location.href.includes('authwall') || window.location.href.includes('login')) {
    console.log('🚫 CONTENT: Hit authentication wall - cannot access comments page');
    console.log('⚠️ CONTENT: LinkedIn requires login to view comments - skipping comments research');
    
    // Return to main profile immediately
    window.location.href = baseUrl;
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    return {
      comments: [],
      commentEmails: [],
      allCommentsText: '',
      authenticationBlocked: true
    };
  }
  
  // STEP 2: Scroll down until we reach 6-month old posts OR max scrolls
  console.log('📜 CONTENT: Scrolling down until 6-month old posts...');
  
  let sixMonthLimitReached = false;
  let scrollAttempts = 0;
  const maxScrollAttempts = 15; // Max 15 scrolls (about 30 seconds)
  
  while (!sixMonthLimitReached && scrollAttempts < maxScrollAttempts) {
    scrollAttempts++;
    
    console.log(`📜 CONTENT: Scroll ${scrollAttempts}/${maxScrollAttempts}...`);
    
    // Scroll down by viewport height
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    
    // WAIT for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check current page text for 6-month indicators
    const currentText = document.body.innerText || '';
    
    // Look for 6-month time indicators
    if (currentText.includes('6 mo') || currentText.includes('6 months') || 
        currentText.includes('7 mo') || currentText.includes('8 mo') ||
        currentText.includes('9 mo') || currentText.includes('10 mo') ||
        currentText.includes('11 mo') || currentText.includes('12 mo') ||
        currentText.includes('1 yr') || currentText.includes('year ago')) {
      console.log('📅 CONTENT: Found 6-month limit - stopping scroll');
      sixMonthLimitReached = true;
      break;
    }
    
    // Check if we've reached bottom of page
    const atBottom = (window.innerHeight + window.pageYOffset) >= document.body.scrollHeight - 100;
    if (atBottom) {
      console.log('📜 CONTENT: Reached bottom of comments page');
      break;
    }
    
    // Count @ symbols found so far
    const atSymbols = currentText.match(/@/g) || [];
    console.log(`📊 CONTENT: Scroll ${scrollAttempts}: Found ${atSymbols.length} @ symbols, ${currentText.length} chars total`);
  }
  
  // STEP 3: COPY ALL TEXT from the page (like Cmd+A, Cmd+C)
  console.log('📋 CONTENT: Copying ALL text from comments page...');
  const allCommentsText = document.body.innerText || '';
  console.log(`📋 CONTENT: Copied ${allCommentsText.length} characters of text`);
  console.log(`📋 CONTENT: Sample (first 500 chars):`, allCommentsText.substring(0, 500));
  
  // Extract profile owner's name for matching
  const profileOwnerName = extractProfileOwnerName(allCommentsText, profileUrl);
  console.log(`👤 CONTENT: Profile owner's name: "${profileOwnerName}"`);
  
  // STEP 4: Parse for emails - find @ symbols near the profile owner's name
  console.log('🔍 CONTENT: Searching for @ symbols near profile owner name...');
  const emailsFound = parseCommentsForEmailsNearName(allCommentsText, profileOwnerName);
  
  // STEP 5: Extract comments with @ symbols (for reference)
  console.log('💬 CONTENT: Extracting comments with @ symbols...');
  const commentsWithAtSymbols = extractCommentsWithAtSymbols(allCommentsText);
  
  console.log('✅ CONTENT: Comments research complete:', {
    totalTextLength: allCommentsText.length,
    commentsWithAtSymbols: commentsWithAtSymbols.length,
    emailsFound: emailsFound.length,
    scrollAttempts: scrollAttempts
  });
  
  // STEP 6: Don't navigate back - research is complete
  console.log('✅ CONTENT: Comments research complete (research finished)');
  
  return {
    comments: commentsWithAtSymbols,
    commentEmails: emailsFound,
    allCommentsText: allCommentsText.substring(0, 5000) // Keep sample for debugging
  };
}

/**
 * PRODUCTION: Parse comments for emails near the profile owner's name
 * 
 * Strategy:
 * 1. Find all @ symbols
 * 2. For each @, get 200 chars before and after
 * 3. Check if profile owner's name appears in that context
 * 4. If yes, extract the email pattern
 * 5. Validate and return unique emails
 */
function parseForEmailsNearName(allText, profileOwnerName) {
  console.log('🔍 Searching for emails near name:', profileOwnerName);
  
  const emailsFound = [];
  
  // Split name into parts for flexible matching
  const nameParts = profileOwnerName.toLowerCase().split(' ').filter(p => p.length > 2);
  const firstName = nameParts[0] || '';
  const lastName = nameParts[nameParts.length - 1] || '';
  
  console.log(`📝 Name parts: First="${firstName}", Last="${lastName}"`);
  
  // Find all @ positions
  const atPositions = [];
  for (let i = 0; i < allText.length; i++) {
    if (allText[i] === '@') {
      atPositions.push(i);
    }
  }
  
  console.log(`📍 Found ${atPositions.length} @ symbols in ${allText.length} chars of text`);
  
  // Check each @ symbol
  atPositions.forEach((atPos, index) => {
    // Get context (200 chars before and after the @)
    const contextStart = Math.max(0, atPos - 200);
    const contextEnd = Math.min(allText.length, atPos + 200);
    const context = allText.substring(contextStart, contextEnd);
    const contextLower = context.toLowerCase();
    
    // Check if profile owner's name appears in this context
    const hasFirstName = firstName && contextLower.includes(firstName);
    const hasLastName = lastName && contextLower.includes(lastName);
    const hasFullName = profileOwnerName && contextLower.includes(profileOwnerName.toLowerCase());
    
    const nameMatch = hasFullName || (hasFirstName && hasLastName);
    
    if (nameMatch) {
      console.log(`\n✅ Found @ symbol ${index + 1} near name!`);
      console.log(`   Position: ${atPos}`);
      console.log(`   Context: ...${context.substring(Math.max(0, atPos - contextStart - 30), atPos - contextStart + 50)}...`);
      
      // Try to extract email around this @ symbol
      // Look 30 chars before and 50 chars after the @
      const emailContext = allText.substring(Math.max(0, atPos - 30), atPos + 50);
      const emailMatch = emailContext.match(/([a-zA-Z0-9._%+-]{1,40}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10})/);
      
      if (emailMatch) {
        const email = emailMatch[1];
        console.log(`   📧 Extracted email: "${email}"`);
        emailsFound.push(email);
      } else {
        // Try to get just the @ mention
        const afterAt = allText.substring(atPos + 1, atPos + 30);
        const mention = afterAt.match(/^([a-zA-Z0-9._-]+)/);
        if (mention) {
          console.log(`   📧 Found @ mention: @${mention[1]} (no full email)`);
        }
      }
    }
  });
  
  // Remove duplicates
  const uniqueEmails = [...new Set(emailsFound)];
  console.log(`\n✅ Total unique emails found: ${uniqueEmails.length}`);
  uniqueEmails.forEach(email => console.log(`   📧 ${email}`));
  
  return uniqueEmails;
}

/**
 * Extract comments with @ symbols from all collected text
 */
function extractCommentsWithAtSymbols(allText) {
  const commentsWithAtSymbols = [];
  const lines = allText.split('\n').map(l => l.trim());
  
  console.log('💬 Analyzing lines for @ symbols...');
  
  lines.forEach(line => {
    // Check if line contains @ symbol and looks like a comment
    if (line.includes('@') && line.length > 10 && line.length < 2000) {
      const mentions = line.match(/@[\w.-]+/g) || [];
      if (mentions.length > 0) {
        // Additional validation - should look like actual comment text
        const looksLikeComment = !line.includes('LinkedIn') && 
                                !line.includes('Show more') &&
                                !line.includes('Load more') &&
                                line.length > 15;
        
        if (looksLikeComment) {
          // Check for duplicates
          const isDuplicate = commentsWithAtSymbols.some(c => 
            c.text.substring(0, 50) === line.substring(0, 50)
          );
          
          if (!isDuplicate) {
            commentsWithAtSymbols.push({
              text: line,
              mentions: mentions,
              hasAtSymbol: true
            });
          }
        }
      }
    }
  });
  
  console.log(`💬 Found ${commentsWithAtSymbols.length} unique comments with @ symbols`);
  return commentsWithAtSymbols;
}

/**
 * OLD FUNCTION - Parse comments text for emails next to names (like "John Smith john@example.com")
 */
function parseCommentsForEmailsOLD(allText, profileUrl) {
  console.log('🔍 CONTENT: Parsing comments for emails next to names...');
  
  // Get the profile owner's name from URL for context
  const profileUsername = profileUrl.split('/in/')[1]?.split('/')[0] || '';
  console.log(`👤 CONTENT: Profile username: ${profileUsername}`);
  
  const emailsFound = [];
  const lines = allText.split('\n').map(l => l.trim());
  
  console.log(`📄 CONTENT: Analyzing ${lines.length} lines for name-email patterns...`);
  
  lines.forEach((line, index) => {
    // Look for lines with @ symbols
    if (line.includes('@') && line.length > 10) {
      
      // Pattern 1: "Name email@domain.com" (name followed by email)
      const nameEmailPattern = /([A-Z][a-z]+ [A-Z][a-z]+)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      let match;
      while ((match = nameEmailPattern.exec(line)) !== null) {
        const name = match[1].trim();
        const email = match[2].trim();
        console.log(`📧 CONTENT: Found name-email pattern: "${name}" → "${email}"`);
        emailsFound.push({ name, email, source: 'name-email-pattern', line: line.substring(0, 100) });
      }
      
      // Pattern 2: Look for emails in comments and try to associate with nearby names
      const emails = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      if (emails.length > 0) {
        // Look for names in the same line or nearby lines
        const potentialNames = line.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
        
        emails.forEach(email => {
          if (potentialNames.length > 0) {
            potentialNames.forEach(name => {
              console.log(`📧 CONTENT: Found email in comment: "${name}" → "${email}"`);
              emailsFound.push({ name, email, source: 'comment-parsing', line: line.substring(0, 100) });
            });
          } else {
            // Email found but no clear name association
            console.log(`📧 CONTENT: Found email without clear name: "${email}"`);
            emailsFound.push({ name: 'Unknown', email, source: 'email-only', line: line.substring(0, 100) });
          }
        });
      }
      
      // Pattern 3: Look for @ mentions that might be email-like
      const mentions = line.match(/@[\w.-]+/g) || [];
      mentions.forEach(mention => {
        // Check if mention looks like it could be an email username
        if (mention.length > 3 && mention.includes('.')) {
          console.log(`📧 CONTENT: Found potential email mention: "${mention}"`);
          emailsFound.push({ name: 'Unknown', email: mention, source: 'mention-parsing', line: line.substring(0, 100) });
        }
      });
    }
  });
  
  // Remove duplicates
  const uniqueEmails = [];
  const seenEmails = new Set();
  
  emailsFound.forEach(item => {
    if (!seenEmails.has(item.email)) {
      seenEmails.add(item.email);
      uniqueEmails.push(item);
    }
  });
  
  console.log(`📧 CONTENT: Found ${uniqueEmails.length} unique emails from comments`);
  uniqueEmails.forEach(item => {
    console.log(`   📧 ${item.name} → ${item.email} (${item.source})`);
  });
  
  return uniqueEmails.map(item => item.email); // Return just the emails
}

/**
 * Extract comments with @ symbols from all collected text
 */
function extractCommentsWithAtSymbols(allText) {
  const commentsWithAtSymbols = [];
  const lines = allText.split('\n').map(l => l.trim());
  
  console.log('💬 CONTENT: Analyzing lines for @ symbols...');
  
  lines.forEach(line => {
    // Check if line contains @ symbol and looks like a comment
    if (line.includes('@') && line.length > 10 && line.length < 2000) {
      const mentions = line.match(/@[\w.-]+/g) || [];
      if (mentions.length > 0) {
        // Additional validation - should look like actual comment text
        const looksLikeComment = !line.includes('LinkedIn') && 
                                !line.includes('Show more') &&
                                !line.includes('Load more') &&
                                line.length > 15;
        
        if (looksLikeComment) {
          // Check for duplicates
          const isDuplicate = commentsWithAtSymbols.some(c => 
            c.text.substring(0, 50) === line.substring(0, 50)
          );
          
          if (!isDuplicate) {
            commentsWithAtSymbols.push({
              text: line,
              mentions: mentions,
              hasAtSymbol: true
            });
          }
        }
      }
    }
  });
  
  console.log(`💬 CONTENT: Found ${commentsWithAtSymbols.length} unique comments with @ symbols`);
  return commentsWithAtSymbols;
}

/**
 * Extract emails from text
 */
function extractEmailsFromText(text) {
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(emails)]; // Remove duplicates
}

/**
 * Scroll and collect comments with @ symbols
 */
async function scrollAndCollectComments() {
  const commentsWithAtSymbols = [];
  const scrollPositions = [0, 400, 800, 1200, 1600, 2000, 2400];
  
  for (const position of scrollPositions) {
    console.log(`📜 CONTENT: Comments scroll to ${position}px...`);
    window.scrollTo({ top: position, behavior: 'smooth' });
    
    // WAIT after scroll
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check for 6-month limit
    const pageText = document.body.innerText || '';
    if (pageText.includes('6 mo') || pageText.includes('6 months') || 
        pageText.includes('7 mo') || pageText.includes('1 yr')) {
      console.log('📅 CONTENT: Reached 6-month limit in comments');
      break;
    }
    
    // Extract comments with @ symbols from current view
    const lines = pageText.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.includes('@') && trimmed.length > 10 && trimmed.length < 1000) {
        const mentions = trimmed.match(/@[\w.-]+/g) || [];
        if (mentions.length > 0) {
          // Check if we already have this comment
          const isDuplicate = commentsWithAtSymbols.some(c => 
            c.text.substring(0, 50) === trimmed.substring(0, 50)
          );
          
          if (!isDuplicate) {
            commentsWithAtSymbols.push({
              text: trimmed,
              mentions: mentions,
              hasAtSymbol: true
            });
          }
        }
      }
    });
    
    console.log(`💬 CONTENT: Found ${commentsWithAtSymbols.length} comments with @ symbols so far...`);
  }
  
  return commentsWithAtSymbols;
}

/**
 * Generate comprehensive profile for AI analysis
 */
function generateComprehensiveProfile(profileData) {
  console.log('📋 CONTENT: Generating comprehensive profile for AI analysis...');
  
  const profile = {
    // Basic info
    name: profileData.name,
    headline: profileData.headline,
    linkedinUrl: profileData.linkedinUrl,
    
    // About section
    about: profileData.about,
    
    // Professional background
    experiences: profileData.experiences || [],
    skills: profileData.skills || [],
    
    // Contact information
    contactEmails: profileData.contactEmails || [],
    commentEmails: profileData.commentEmails || [],
    
    // Activity data (comments with @ symbols only)
    commentsWithAtSymbols: profileData.comments || [],
    
    // Combined text for AI analysis
    combinedText: `
NAME: ${profileData.name}
HEADLINE: ${profileData.headline}
ABOUT: ${profileData.about}
EXPERIENCES: ${profileData.experiences?.map(exp => `${exp.title} at ${exp.company}`).join('\n') || ''}
SKILLS: ${profileData.skills?.join(', ') || ''}
COMMENTS WITH @ SYMBOLS: ${profileData.comments?.map(c => c.text).join('\n\n') || ''}
CONTACT EMAILS: ${profileData.contactEmails?.join(', ') || ''}
COMMENT EMAILS: ${profileData.commentEmails?.join(', ') || ''}
    `.trim()
  };
  
  console.log('📋 CONTENT: Comprehensive profile generated:', {
    name: profile.name,
    textLength: profile.combinedText.length,
    experiences: profile.experiences.length,
    skills: profile.skills.length,
    commentsWithAtSymbols: profile.commentsWithAtSymbols.length,
    totalEmails: [...(profile.contactEmails || []), ...(profile.commentEmails || [])].length
  });
  
  return profile;
}

/**
 * Analyze with OpenAI for job seeker assessment
 */
async function analyzeWithOpenAI(comprehensiveProfile) {
  console.log('🤖 CONTENT: Sending comprehensive profile to OpenAI for job seeker analysis...');
  
  try {
    // Prepare data for backend API
    const requestData = {
        name: comprehensiveProfile.name,
        headline: comprehensiveProfile.headline,
        about: comprehensiveProfile.about,
      experiences: comprehensiveProfile.experiences || [],
      skills: comprehensiveProfile.skills || [],
      commentsWithAtSymbols: comprehensiveProfile.commentsWithAtSymbols || [],
      contactEmails: comprehensiveProfile.contactEmails || [],
      commentEmails: comprehensiveProfile.commentEmails || [],
        combinedText: comprehensiveProfile.combinedText,
        linkedinUrl: comprehensiveProfile.linkedinUrl
    };
    
    console.log('📤 CONTENT: Sending data to backend:', {
      name: requestData.name,
      headline: requestData.headline ? 'Present' : 'Missing',
      about: requestData.about ? `${requestData.about.length} chars` : 'Missing',
      experiences: requestData.experiences.length,
      skills: requestData.skills.length,
      comments: requestData.commentsWithAtSymbols.length,
      contactEmails: requestData.contactEmails.length,
      commentEmails: requestData.commentEmails.length
    });
    
    const response = await fetch('http://localhost:3000/api/analyze-job-seeker-comprehensive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }
    
    console.log('✅ CONTENT: OpenAI analysis successful!');
    console.log('📊 CONTENT: Results:', {
      jobSeekerScore: result.jobSeekerScore,
      isJobSeeker: result.isJobSeeker,
      careerStage: result.careerStage,
      techBackground: result.techBackground,
      confidence: result.confidence,
      emailsFound: result.extractedEmails?.length || 0,
      indicators: result.jobSeekerIndicators?.length || 0
    });
    
    // Return ALL structured analysis data (mapped for dashboard)
    return {
      // Core scoring
      jobSeekerScore: result.jobSeekerScore || 0,
      isJobSeeker: result.isJobSeeker || false,
      confidence: result.confidence || 0,
      
      // Career assessment  
      careerStage: result.careerStage || 'Unknown',
      techBackground: result.techBackground || 'Unknown',
      industry: result.industry || 'Unknown',
      currentRole: result.currentRole || '',
      
      // Experience metrics
      experienceYears: result.experienceYears || 0,
      techProficiency: result.techProficiency || 'Unknown',
      
      // Contact metrics
      contactability: result.contactability || 'Unknown',
      remotePreference: result.remotePreference || 'Unknown',
      networkingActivity: result.networkingActivity || 'Unknown',
      
      // Text analysis
      summary: result.summary || 'Analysis completed',
      notes: result.notes || '',
      
      // Skills and signals
      keySkills: result.keySkills || [],
      jobSeekerIndicators: result.jobSeekerIndicators || [],
      jobSeekingSignals: result.jobSeekingSignals || result.jobSeekerIndicators || [],
      
      // Contact info
      emails: result.extractedEmails || [...new Set([...(comprehensiveProfile.contactEmails || []), ...(comprehensiveProfile.commentEmails || [])])],
      activityEmails: result.extractedEmails || [],
      
      // Metadata
      tokensUsed: result.tokensUsed || 'unknown'
    };
    
  } catch (error) {
    console.error('❌ CONTENT: OpenAI analysis failed:', error);
    console.error('❌ CONTENT: Error details:', error.message);
    
    // Return fallback data (all fields for dashboard compatibility)
    return {
      // Core scoring
      jobSeekerScore: 0,
      isJobSeeker: false,
      confidence: 0,
      
      // Career fields
      careerStage: 'Unknown',
      techBackground: 'Unknown',
      industry: 'Unknown',
      currentRole: '',
      
      // Experience metrics
      experienceYears: 0,
      techProficiency: 'Unknown',
      
      // Contact metrics
      contactability: 'Unknown',
      remotePreference: 'Unknown',
      networkingActivity: 'Unknown',
      
      // Text fields
      summary: 'AI analysis failed: ' + error.message,
      notes: 'Error: ' + error.message,
      
      // Skills and signals
      keySkills: [],
      jobSeekerIndicators: [],
      jobSeekingSignals: [],
      
      // Contact info
      emails: [...new Set([...(comprehensiveProfile.contactEmails || []), ...(comprehensiveProfile.commentEmails || [])])],
      activityEmails: [],
      
      // Metadata
      tokensUsed: 'error'
    };
  }
}

/**
 * Research experience page - /details/experience/ - SLOW and PERSISTENT
 */
async function researchExperiencePage(profileUrl) {
  console.log('💼 CONTENT: Researching experience page...');
  
  const baseUrl = profileUrl.replace(/\/$/, '');
  const experienceUrl = `${baseUrl}/details/experience/`;
  
  logToExtension('🌐 CONTENT: Navigating to experience page', {
    targetUrl: experienceUrl,
    currentUrl: window.location.href,
    action: 'navigating_to_experience'
  });
  window.location.href = experienceUrl;
  
  // Wait longer for experience page to load
  console.log('⏳ CONTENT: Waiting for experience page to fully load...');
  await new Promise(resolve => setTimeout(resolve, 7000));
  
  console.log('📜 CONTENT: SLOW scrolling through experience page...');
  
  let scrollPosition = 0;
  const scrollStep = 300;
  const maxScrolls = 10;
  let experienceButtonsClicked = 0;
  
  for (let i = 0; i < maxScrolls; i++) {
    console.log(`📜 CONTENT: Experience scroll ${i + 1}/${maxScrolls} to ${scrollPosition}px`);
    
    // Scroll slowly
    window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
    
    // PAUSE - Wait 1 second after scroll as requested
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Click "see more" buttons for individual experiences
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      const text = button.textContent?.toLowerCase() || '';
      const aria = button.getAttribute('aria-label')?.toLowerCase() || '';
      
      if ((text.includes('see more') || text.includes('show more')) && 
          button.offsetWidth > 0 && button.offsetHeight > 0 &&
          !text.includes('message') && !text.includes('connect')) {
        try {
          button.click();
          experienceButtonsClicked++;
          console.log(`🔘 CONTENT: Clicked experience "see more" ${experienceButtonsClicked}`);
          
          // PAUSE after clicking as requested
          setTimeout(() => {}, 1500);
          
        } catch (e) {
          console.log('⚠️ CONTENT: Experience button click failed:', e.message);
        }
      }
    });
    
    // PAUSE between scrolls as requested
    console.log('⏸️ CONTENT: Pausing before next scroll...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    scrollPosition += scrollStep;
    
    if (scrollPosition >= document.body.scrollHeight - window.innerHeight) {
      console.log('📜 CONTENT: Reached bottom of experience page');
      break;
    }
  }
  
  // Final pause before data extraction
  console.log('⏸️ CONTENT: Final pause before extracting experience data...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Extract experience data
  const pageText = document.body.innerText || '';
  const experiences = [];
  
  const expMatches = pageText.match(/(.+?)\s+at\s+(.+?)(?:\n|·|$)/gi) || [];
  expMatches.slice(0, 25).forEach(match => {
    const parts = match.split(' at ');
    if (parts.length === 2 && parts[0].length < 150 && parts[1].length < 150) {
      experiences.push({ 
        title: parts[0].trim(), 
        company: parts[1].trim() 
      });
    }
  });
  
  console.log('✅ CONTENT: Experience page research complete:', {
    experiences: experiences.length,
    experienceButtonsClicked,
    finalTextLength: pageText.length
  });
  
  return { experiences };
}

/**
 * Research contact info overlay - /overlay/contact-info/ - PERSISTENT
 */
async function researchContactInfo(profileUrl) {
  console.log('📧 CONTENT: Researching contact info overlay...');
  
  const baseUrl = profileUrl.replace(/\/$/, '');
  const contactUrl = `${baseUrl}/overlay/contact-info/`;
  
  logToExtension('🌐 CONTENT: Navigating to contact info overlay', {
    targetUrl: contactUrl,
    currentUrl: window.location.href,
    action: 'navigating_to_contact_info'
  });
  window.location.href = contactUrl;
  
  // Wait longer for overlay to load
  console.log('⏳ CONTENT: Waiting for contact overlay to load...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  // PAUSE as requested
  console.log('⏸️ CONTENT: Pausing to let overlay fully load...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Extract contact information
  const pageText = document.body.innerText || '';
  const emails = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const phones = pageText.match(/(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g) || [];
  
  console.log('✅ CONTENT: Contact info research complete:', {
    emails: emails.length,
    phones: phones.length,
    textLength: pageText.length
  });
  
  if (emails.length > 0) {
    console.log('📧 CONTENT: Contact emails found:', emails);
  }
  
  // PAUSE before returning to main profile
  console.log('⏸️ CONTENT: Pausing before returning to main profile...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return to main profile
  console.log('🔙 CONTENT: Returning to main profile...');
  window.location.href = baseUrl;
  
  // Wait for main profile to load again
  console.log('⏳ CONTENT: Waiting for main profile to reload...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  return { 
    contactEmails: emails,
    contactPhones: phones
  };
}

/**
 * Research comments page ONLY - /recent-activity/comments/ - AVOID INDIVIDUAL POSTS
 * Filter and save ONLY comments that contain @ symbols
 */
async function researchCommentsPage(profileUrl) {
  console.log('💬 CONTENT: Researching ONLY comments page (avoiding individual posts)...');
  
  const baseUrl = profileUrl.replace(/\/$/, '');
  const commentsUrl = `${baseUrl}/recent-activity/comments/`;
  
  // CRITICAL: Ensure we ONLY go to the comments page, not individual posts
  logToExtension('🚫 CONTENT: AVOIDING individual post URLs like /feed/update/urn:li:activity:', {
    avoidingPosts: true,
    targetUrl: commentsUrl,
    currentUrl: window.location.href,
    action: 'navigating_to_comments_avoiding_posts'
  });
  
  window.location.href = commentsUrl;
  
  // Wait longer for comments page to load
  console.log('⏳ CONTENT: Waiting for comments page to fully load...');
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  // PAUSE as requested
  console.log('⏸️ CONTENT: Pausing to let comments page fully load...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('📜 CONTENT: SLOW scrolling through comments for 6 months...');
  
  let scrollPosition = 0;
  const scrollStep = 400; // Slower scrolling
  const maxScrolls = 20;
  let commentsWithAtSymbols = [];
  let allCommentTexts = [];
  
  for (let i = 0; i < maxScrolls; i++) {
    console.log(`📜 CONTENT: Comments scroll ${i + 1}/${maxScrolls} to ${scrollPosition}px`);
    
    // Scroll slowly
    window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
    
    // PAUSE - Wait 1 second after scroll as requested
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then wait longer for comments to load
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Extract comment text from visible elements
    const commentElements = document.querySelectorAll('[data-id*="comment"], .comments-comment-item, .feed-shared-update-v2__commentary');
    commentElements.forEach(el => {
      const commentText = el.innerText || el.textContent || '';
      if (commentText.length > 10 && commentText.length < 2000) {
        allCommentTexts.push(commentText);
      }
    });
    
    // Check current content for @ symbols
    const currentPageText = document.body.innerText || '';
    const currentAtSymbols = currentPageText.match(/@[\w.-]+/g) || [];
    
    if (currentAtSymbols.length > 0) {
      console.log(`🎯 CONTENT: Found ${currentAtSymbols.length} @ symbols in scroll ${i + 1}...`);
    }
    
    // Check for 6-month limit indicators
    if (currentPageText.includes('6 mo') || currentPageText.includes('6 months') || 
        currentPageText.includes('7 mo') || currentPageText.includes('1 yr') || 
        currentPageText.includes('year ago')) {
      console.log('📅 CONTENT: Reached 6-month limit in comments');
      break;
    }
    
    // PAUSE between scrolls as requested
    console.log('⏸️ CONTENT: Pausing before next scroll...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    scrollPosition += scrollStep;
    
    if (scrollPosition >= document.body.scrollHeight - window.innerHeight) {
      console.log('📜 CONTENT: Reached bottom of comments page');
      break;
    }
  }
  
  // Final pause before data extraction
  console.log('⏸️ CONTENT: Final pause before extracting comments data...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get final page text
  const pageText = document.body.innerText || '';
  
  // Extract all @ symbols
  const atSymbols = pageText.match(/@[\w.-]+/g) || [];
  
  // Extract all emails
  const emails = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  
  // FILTER: Only save comments that contain @ symbols
  const lines = pageText.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    // Check if this line contains an @ symbol
    if (trimmed.includes('@') && trimmed.length > 10 && trimmed.length < 2000) {
      // Extract the @ mentions from this line
      const mentions = trimmed.match(/@[\w.-]+/g) || [];
      if (mentions.length > 0) {
        commentsWithAtSymbols.push({
          text: trimmed,
          mentions: mentions,
          hasAtSymbol: true
        });
      }
    }
  });
  
  // Remove duplicates
  const uniqueComments = [];
  const seenTexts = new Set();
  commentsWithAtSymbols.forEach(comment => {
    const normalized = comment.text.substring(0, 100); // Use first 100 chars as key
    if (!seenTexts.has(normalized)) {
      seenTexts.add(normalized);
      uniqueComments.push(comment);
    }
  });
  
  console.log('✅ CONTENT: Comments page research complete:', {
    textLength: pageText.length,
    totalAtSymbols: atSymbols.length,
    commentsWithAtSymbols: uniqueComments.length,
    emails: emails.length
  });
  
  if (uniqueComments.length > 0) {
    console.log('🎯 CONTENT: Comments with @ symbols found:', uniqueComments.length);
    console.log('📝 CONTENT: Sample comments:', uniqueComments.slice(0, 3).map(c => c.text.substring(0, 100)));
  }
  if (emails.length > 0) {
    console.log('📧 CONTENT: Emails found in comments:', emails);
  }
  
  // PAUSE before returning to main profile
  console.log('⏸️ CONTENT: Pausing before returning to main profile...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return to main profile
  console.log('🔙 CONTENT: Returning to main profile...');
  window.location.href = baseUrl;
  
  // Wait for main profile to load again
  console.log('⏳ CONTENT: Waiting for main profile to reload...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  return {
    comments: uniqueComments, // Only comments with @ symbols
    commentEmails: emails,
    allAtSymbols: atSymbols
  };
}

/**
 * AI analysis with ALL collected data
 */
async function analyzeWithAI(aboutData, experienceData, contactData, commentsData) {
  console.log('🤖 CONTENT: Analyzing ALL collected data with AI...');
  
  // Combine all emails
  const allEmails = [
    ...(contactData.contactEmails || []),
    ...(commentsData.commentEmails || [])
  ];
  
  console.log('📊 CONTENT: Sending comprehensive data to AI:', {
    name: aboutData.name,
    headline: aboutData.headline ? 'Found' : 'Missing',
    about: aboutData.about ? 'Found' : 'Missing',
    experiences: experienceData.experiences?.length || 0,
    contactEmails: contactData.contactEmails?.length || 0,
    commentEmails: commentsData.commentEmails?.length || 0,
    totalEmails: allEmails.length
  });
  
  try {
    const response = await fetch('http://localhost:3000/api/analyze-job-seeker-and-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posts: [],
        comments: commentsData.comments || [],
        combinedText: `NAME: ${aboutData.name}
HEADLINE: ${aboutData.headline}
ABOUT: ${aboutData.about}
EXPERIENCES: ${experienceData.experiences?.map(exp => `${exp.title} at ${exp.company}`).join('\n') || ''}
COMMENTS: ${commentsData.comments?.map(c => c.text).join('\n') || ''}`,
        extractedEmails: allEmails,
        profileData: {
          name: aboutData.name,
          headline: aboutData.headline,
          about: aboutData.about,
          experiences: experienceData.experiences || []
        }
      })
    });
    
    const result = await response.json();
    console.log('✅ CONTENT: AI analysis complete:', {
      jobSeekerScore: result.jobSeekerScore || 0,
      totalEmailsFound: [...new Set([...allEmails, ...(result.emails || [])])].length
    });
    
    return {
      jobSeekerScore: result.jobSeekerScore || 0,
      emails: [...new Set([...allEmails, ...(result.emails || [])])],
      activityEmails: [...new Set([...allEmails, ...(result.emails || [])])],
      aiAnalysis: result.analysis || ''
    };
    
  } catch (error) {
    console.error('❌ CONTENT: AI analysis failed:', error);
    return {
      jobSeekerScore: 0,
      emails: allEmails,
      activityEmails: allEmails,
      aiAnalysis: 'AI analysis failed'
    };
  }
}

/**
 * Wait for comments results from separate tab
 */
function waitForCommentsResults(prospectId, timeout) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
      // Check if results are cached
      if (window.commentsResultsCache.has(prospectId)) {
        clearInterval(checkInterval);
        const results = window.commentsResultsCache.get(prospectId);
        window.commentsResultsCache.delete(prospectId);
        resolve(results);
        return;
      }
      
      // Timeout
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        console.log('⏰ CONTENT: Comments results timeout');
        resolve(null);
      }
    }, 500);
  });
}

/**
 * SIMPLE comments scraper for separate tab
 * Just scroll and grab text - no complexity!
 */
async function scrapeCommentsPageSimple(profileName) {
  console.log('\n💬 ===== SIMPLE COMMENTS SCRAPER =====');
  console.log('👤 Profile:', profileName);
  console.log('📍 URL:', window.location.href);
  
  // Wait a moment for page to settle
  await new Promise(r => setTimeout(r, 3000));
  
  // Check if auth-blocked
  const initialText = document.body.innerText || '';
  if (initialText.includes('Sign in') || window.location.href.includes('authwall')) {
    console.log('🚫 Auth blocked');
    return { success: false, error: 'Authentication required' };
  }
  
  console.log('📊 Initial text:', initialText.length, 'chars');
  console.log('📏 Page height:', document.body.scrollHeight, 'px');
  console.log('📏 Viewport:', window.innerHeight, 'px');
  
  // Scroll until 6-month or max scrolls
  let scrollCount = 0;
  const maxScrolls = 15; // Increased
  let sixMonthReached = false;
  let lastScrollPosition = 0;
  
  console.log('📜 Starting scroll loop...');
  console.log('📜 Strategy: SCROLL TO BOTTOM - ignore "mo" in random text!');
  console.log('📜 Only stop on: BOTTOM or STUCK (not on time markers)');
  
  // SCROLL TO BOTTOM - don't stop early!
  while (scrollCount < maxScrolls) {
    scrollCount++;
    
    const currentScrollY = window.pageYOffset;
    const pageHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    
    console.log(`📜 Scroll ${scrollCount}/${maxScrolls}: At ${currentScrollY}px of ${pageHeight}px`);
    
    // Scroll down
    window.scrollBy({ top: viewportHeight, behavior: 'smooth' });
    
    // Wait for lazy loading
    console.log(`   ⏳ Wait 1 sec...`);
    await new Promise(r => setTimeout(r, 1000));
    
    // Get new position
    const newScrollY = window.pageYOffset;
    const newPageHeight = document.body.scrollHeight;
    const currentText = document.body.innerText;
    
    console.log(`   📏 Now at: ${newScrollY}px of ${newPageHeight}px (text: ${currentText.length} chars)`);
    
    // ONLY stop on BOTTOM (not on "mo" or "6" or any text!)
    const distanceFromBottom = newPageHeight - (newScrollY + viewportHeight);
    console.log(`   📏 Distance from bottom: ${distanceFromBottom}px`);
    
    if (distanceFromBottom < 100) {
      console.log(`   ✅ AT BOTTOM! Stopping scroll.`);
      break;
    }
    
    // ONLY stop if STUCK (same position for 2 scrolls)
    if (newScrollY === lastScrollPosition && scrollCount > 1) {
      console.log(`   ⚠️ STUCK at ${newScrollY}px (not scrolling anymore) - stopping`);
      break;
    }
    
    if (newScrollY > lastScrollPosition) {
      console.log(`   ✅ Scrolled: ${lastScrollPosition}px → ${newScrollY}px, continuing...`);
    }
    
    lastScrollPosition = newScrollY;
  }
  
  console.log(`\n✅ ========== SCROLL COMPLETE ==========`);
  console.log(`📊 Total scrolls: ${scrollCount}`);
  console.log(`📏 Final position: ${window.pageYOffset}px`);
  console.log(`📏 Page height: ${document.body.scrollHeight}px`);
  console.log(`✅ Reached bottom: ${(window.pageYOffset + window.innerHeight) >= document.body.scrollHeight - 100}`);
  
  // Get ALL text
  const allText = document.body.innerText || '';
  console.log('📋 Copied', allText.length, 'chars');
  
  // Parse for emails near name
  const emails = parseForEmailsNearName(allText, profileName);
  const comments = extractCommentsWithAtSymbols(allText);
  
  console.log('✅ Results: emails:', emails.length, 'comments:', comments.length);
  
  return {
    success: true,
    contactEmails: [],
    commentEmails: emails,
    comments: comments
  };
}

console.log('✅ FINAL TheNetwrk content script loaded');

} // End of content script guard
