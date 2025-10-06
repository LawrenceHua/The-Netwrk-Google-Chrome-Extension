/**
 * TheNetwrk Background Script - LinkedIn Automation Assistant
 * Orchestrates profile capture, AI analysis, and message drafting
 */

console.log('🚀 TheNetwrk Background Script loaded');

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // Start massive search
  if (request.action === 'startMassiveSearch') {
    console.log('🚀 Starting massive search...');
    startMassiveSearch(request.keywordCount, request.pagesPerKeyword, request.currentTabId, sendResponse);
    return true;
  }
  
  // Start deep research phase
  if (request.action === 'startDeepResearch') {
    console.log('🔬 Starting deep research phase...');
    const researchLimit = request.researchLimit || 10;
    startDeepResearchPhase(researchLimit, sendResponse);
    return true;
  }
  
  // Handle research completion from content script
  if (request.action === 'researchComplete') {
    console.log('✅ Research completed for prospect:', request.prospectId);
    handleResearchComplete(request.prospectId, request.profile, request.error);
    return false;
  }
  
  // Save prospect
  if (request.action === 'saveProspect') {
    console.log('💾 Saving prospect:', request.prospect.name);
    saveProspect(request.prospect, sendResponse);
    return true;
  }
  
  // Save bulk profiles from Phase 1
  if (request.action === 'saveBulkProfiles') {
    console.log('💾 Saving bulk profiles:', request.profiles.length);
    saveBulkProfiles(request.profiles, sendResponse);
    return true;
  }
  
  // Get all prospects
  if (request.action === 'getProspects') {
    chrome.storage.local.get(['prospects'], (result) => {
      sendResponse({ success: true, prospects: result.prospects || [] });
    });
    return true;
  }
  
  // Analyze with AI
  if (request.action === 'analyzeWithAI') {
    analyzeProspectWithAI(request.prospect, sendResponse);
    return true;
  }
  
  // Draft message
  if (request.action === 'draftMessage') {
    draftMessageWithAI(request.prospect, sendResponse);
    return true;
  }
});

/**
 * Start massive search across multiple keywords and pages
 */
async function startMassiveSearch(keywordCount, pagesPerKeyword, tabId, callback) {
  console.log('\n🚀 ========== MASSIVE SEARCH STARTED ==========');
  console.log('📊 Keywords to search:', keywordCount);
  console.log('📄 Pages per keyword:', pagesPerKeyword);
  console.log('🎯 Total searches:', keywordCount * pagesPerKeyword);
  
  callback({ success: true, message: 'Massive search started' });
  
  // Get keywords (we'll load them from the content script)
  const keywords = [
    "open to work", "seeking opportunities", "looking for work", "job search", "actively seeking",
    "seeking employment", "job hunting", "looking for opportunities", "exploring opportunities", "open for work",
    "available for hire", "seeking new role", "looking for new role", "open to new opportunities", "seeking full-time",
    "seeking part-time", "contract available", "freelance available", "consulting available", "available immediately"
  ].slice(0, keywordCount);
  
  const allProfiles = [];
  
  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    console.log(`\n🔍 [${i + 1}/${keywords.length}] KEYWORD: "${keyword}"`);
    
    // Search multiple pages for this keyword
    for (let page = 1; page <= pagesPerKeyword; page++) {
      console.log(`   📄 Page ${page}/${pagesPerKeyword} for "${keyword}"`);
      
      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}&page=${page}`;
      
      // Navigate to search page
      chrome.tabs.update(tabId, { url: searchUrl });
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Collect URLs from this page
      const result = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: 'collectURLs' }, (response) => {
      if (chrome.runtime.lastError) {
            console.log(`     ❌ Failed to collect from page: ${chrome.runtime.lastError.message}`);
            resolve({ success: false, profiles: [] });
          } else {
            resolve(response || { success: false, profiles: [] });
          }
        });
      });
      
      if (result.success && result.profiles) {
        // Add metadata to profiles
        result.profiles.forEach(profile => {
          profile.keyword = keyword;
          profile.page = page;
          profile.searchIndex = i + 1;
          allProfiles.push(profile);
        });
        
        console.log(`     ✅ Page ${page}: Found ${result.profiles.length} profiles`);
        
        // Save to dashboard immediately (real-time)
        if (result.profiles.length > 0) {
        console.log(`     💾 Saving ${result.profiles.length} profiles to dashboard...`);
        console.log(`     👥 Names found:`, result.profiles.slice(0, 5).map(p => p.name).join(', '), result.profiles.length > 5 ? `...and ${result.profiles.length - 5} more` : '');
        
        // Log each individual name being processed
        result.profiles.forEach((profile, idx) => {
          console.log(`       [${idx + 1}] ${profile.name} ${profile.headline ? '- ' + profile.headline.substring(0, 40) + '...' : ''}`);
        });
        
        await new Promise((resolve) => {
          saveBulkProfiles(result.profiles, (saveResponse) => {
            console.log(`     ✅ Saved ${saveResponse.savedCount} new profiles (${saveResponse.duplicateCount} duplicates)`);
            console.log(`     📊 Dashboard now has ${saveResponse.totalProspects} total prospects`);
            
            // Send real-time update to popup
            chrome.runtime.sendMessage({
              action: 'updateStats',
              totalProspects: saveResponse.totalProspects,
              newlyAdded: saveResponse.savedCount
            });
            
            resolve();
          });
        });
        }
      }
      
      // Wait before next page
      if (page < pagesPerKeyword) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(`   🎯 TOTAL for "${keyword}": ${allProfiles.filter(p => p.keyword === keyword).length} profiles`);
    
    // Wait before next keyword
    if (i < keywords.length - 1) {
      console.log(`   ⏸️ Waiting 4s before next keyword...`);
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
  
  // Remove duplicates
  const uniqueProfiles = [];
  const seenUrls = new Set();
  
  allProfiles.forEach(profile => {
    if (!seenUrls.has(profile.linkedinUrl)) {
      seenUrls.add(profile.linkedinUrl);
      uniqueProfiles.push(profile);
    }
  });
  
  console.log(`\n🎉 ========== MASSIVE SEARCH COMPLETE ==========`);
  console.log(`📊 Total unique profiles found: ${uniqueProfiles.length}`);
  console.log(`✅ All profiles already saved to dashboard in real-time!`);
  
  // Update popup with final stats
  chrome.storage.local.get(['prospects'], (result) => {
    const totalProspects = result.prospects?.length || 0;
    console.log(`📊 Final dashboard count: ${totalProspects} prospects`);
  });
}

/**
 * Start deep research phase
 * Takes collected URLs and researches each one thoroughly
 */
async function startDeepResearchPhase(researchLimit, callback) {
  console.log('\n🔬 ========== DEEP RESEARCH PHASE ==========');
  
  // Get prospects from dashboard that need research
  chrome.storage.local.get(['prospects'], async (result) => {
    const allProspects = result.prospects || [];
    const needsResearch = allProspects.filter(p => p.needsResearch === true);
    
    if (needsResearch.length === 0) {
      callback({ success: false, error: 'No prospects need research. Run Phase 1 first.' });
      return;
    }
    
    // Sort by ID to process in the exact order they were added (1, 2, 3, 4...)
    needsResearch.sort((a, b) => a.id.localeCompare(b.id));
    
    // Use the user-specified limit instead of hardcoded 10
    const prospectsToResearch = needsResearch.slice(0, researchLimit);
    
    console.log(`📊 USER LIMIT: Researching FIRST ${prospectsToResearch.length} of ${needsResearch.length} prospects (in order added)...`);
    console.log(`👥 Researching:`, prospectsToResearch.map((p, idx) => `${idx + 1}. ${p.name}`).join(', '));
    console.log(`🆔 ID range: ${prospectsToResearch[0]?.id.substring(-10)} to ${prospectsToResearch[prospectsToResearch.length-1]?.id.substring(-10)}`);
    callback({ success: true });
    
    // Get current tab to use for research
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) return;
      
      const tabId = tabs[0].id;
      
      for (let i = 0; i < prospectsToResearch.length; i++) {
        const prospect = prospectsToResearch[i];
        
        console.log(`\n👤 [${i + 1}/${prospectsToResearch.length}] TESTING: ${prospect.name}`);
        console.log(`   🔗 URL: ${prospect.linkedinUrl}`);
        console.log(`   📝 Current headline: "${prospect.headline}"`);
        
        // Send progress update to popup
        chrome.runtime.sendMessage({
          action: 'researchProgress',
          completed: i,
          total: prospectsToResearch.length
        });
        
        // Navigate to profile and research
        chrome.tabs.update(tabId, { url: prospect.linkedinUrl });
        
        // Wait longer for navigation and content script to reload
        console.log(`   ⏳ Waiting for profile to load and content script to initialize...`);
        await new Promise(resolve => setTimeout(resolve, 8000)); // Increased to 8 seconds
        
        // Test if content script is loaded
        console.log(`   🔍 Testing if content script is loaded...`);
        const pingResult = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
              console.log(`   ❌ Content script not loaded: ${chrome.runtime.lastError.message}`);
              resolve(false);
            } else {
              console.log(`   ✅ Content script responding`);
              resolve(true);
            }
          });
        });
        
        if (!pingResult) {
          console.log(`   ⏸️ Waiting additional 5 seconds for content script...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // Start deep research
        console.log(`   🔬 Starting deep research for ${prospect.name}...`);
        const result = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, {
            action: 'deepResearch',
            prospect: prospect
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log(`   ❌ Deep research message failed: ${chrome.runtime.lastError.message}`);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else if (response && response.status === 'started') {
              console.log(`   ⏳ Research started for ${prospect.name}, waiting for completion...`);
              // Wait for research to complete via message handler
              waitForResearchCompletion(prospect.id, resolve);
            } else {
              resolve(response);
            }
          });
        });
        
        if (result && result.success) {
          console.log(`   ✅ Research complete for ${result.profile?.name || prospect.name}`);
          // Result will be handled by handleResearchComplete
        } else {
          console.log(`   ❌ Research failed for ${prospect.name}: ${result?.error || 'Unknown error'}`);
        }
        
        // Wait before next profile
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Send final progress update
      chrome.runtime.sendMessage({
        action: 'researchProgress',
        completed: prospectsToResearch.length,
        total: prospectsToResearch.length
      });
      
      console.log('\n✅ ========== TEST RESEARCH COMPLETE ==========');
      console.log(`📊 Enhanced ${prospectsToResearch.length} prospects with correct names and AI analysis`);
      console.log(`🎯 Check dashboard to see the corrected names and data!`);
    });
  });
}

/**
 * OLD FUNCTION - REPLACED
 */
async function startAutomatedSearch(keywords, maxProfiles = 50, callback) {
  console.log('\n🚀 ========== AUTOMATED SEARCH STARTED ==========');
  console.log('📊 Keywords:', keywords);
  console.log('📈 Max profiles:', maxProfiles);
  
  callback({ success: true, message: 'Search started' });
  
  let totalProcessed = 0;
  
  for (const keyword of keywords) {
    if (totalProcessed >= maxProfiles) break;
    
    console.log(`\n🔍 Searching for: "${keyword}"`);
    
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}`;
    
    // Open search page in main window
    const tab = await new Promise((resolve) => {
      chrome.tabs.create({ url: searchUrl, active: true }, resolve);
    });
    
    console.log(`📑 Opened search tab ${tab.id}`);
    
    // Wait for page to load
    await new Promise(r => setTimeout(r, 5000));
    
    // Get profile URLs from search page (visible in main view)
    const profileUrls = await getProfileUrlsFromPage(tab.id);
    
    console.log(`✅ Found ${profileUrls.length} profile URLs`);
    
    // Visit each profile one by one
    for (let i = 0; i < profileUrls.length && totalProcessed < maxProfiles; i++) {
      const profileUrl = profileUrls[i];
      console.log(`\n👤 [${i + 1}/${profileUrls.length}] Opening: ${profileUrl}`);
      
      // Navigate to profile in same tab (user sees it)
      await new Promise((resolve) => {
        chrome.tabs.update(tab.id, { url: profileUrl }, resolve);
      });
      
      // Wait for profile to load
      await new Promise(r => setTimeout(r, 8000));
      
      // Scroll to load content
      await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'scrollPage' }, resolve);
      });
      
      await new Promise(r => setTimeout(r, 3000));
      
      // Capture profile
      const result = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'captureProfile' }, resolve);
      });
      
      if (result && result.success) {
        console.log(`   ✅ Captured: ${result.profile.name}`);
        
        // Analyze with AI
        await analyzeAndSaveProfile(result.profile);
        totalProcessed++;
      } else {
        console.log(`   ❌ Failed to capture profile`);
      }
      
      // Wait before next profile
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // Close search tab
    chrome.tabs.remove(tab.id);
    
    // Wait before next keyword
    if (totalProcessed < maxProfiles) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  console.log(`\n✅ ========== SEARCH COMPLETE ==========`);
  console.log(`📊 Total profiles processed: ${totalProcessed}`);
}

/**
 * Get profile URLs from current search page
 */
async function getProfileUrlsFromPage(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.executeScript(tabId, {
      code: `
        const urls = [];
        const links = document.querySelectorAll('a[href*="/in/"]');
        links.forEach(link => {
          const url = link.href.split('?')[0];
          if (url.includes('/in/') && !urls.includes(url)) {
            urls.push(url);
          }
        });
        urls.slice(0, 10); // First 10 profiles per page
      `
    }, (results) => {
      resolve(results && results[0] ? results[0] : []);
      });
  });
}

/**
 * Analyze profile and save to dashboard
 */
async function analyzeAndSaveProfile(profile) {
  console.log(`🤖 Analyzing ${profile.name} with AI...`);
  
  try {
    // Send ALL text to AI for analysis
    const response = await fetch('http://localhost:3000/api/analyze-job-seeker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
        name: profile.name,
        headline: profile.headline,
        allText: profile.allText,
        linkedinUrl: profile.linkedinUrl
      })
    });
    
    const aiResult = await response.json();
    
    if (aiResult.success) {
      console.log(`   ✅ AI Analysis: Score ${aiResult.jobSeekerScore}%`);
      
      // Combine and save
      const completeProfile = {
        ...profile,
        ...aiResult,
        id: `prospect_${Date.now()}`,
        dateAdded: new Date().toISOString()
      };
      
      await saveProspect(completeProfile);
    }
    
  } catch (error) {
    console.error(`   ❌ AI analysis failed:`, error);
  }
}

/**
 * Save bulk profiles from Phase 1 to dashboard
 */
async function saveBulkProfiles(profiles, callback) {
  console.log('\n💾 ========== SAVING BULK PROFILES TO DASHBOARD ==========');
  console.log('📊 Profiles to save:', profiles.length);
  
  chrome.storage.local.get(['prospects'], (result) => {
    const existingProspects = result.prospects || [];
    const existingUrls = new Set(existingProspects.map(p => p.linkedinUrl));
    
    let savedCount = 0;
    let duplicateCount = 0;
    
    profiles.forEach(profile => {
      // Filter out bad names and junk data
      if (profile.name === 'Status is offline' || 
          profile.name === 'Unknown' || 
          profile.name === 'Premium' ||
          profile.name.length < 3 ||
          profile.name.includes('View') ||
          profile.name.includes('Connect') ||
          profile.name.includes('Show all') ||
          profile.name.includes('skills') ||
          profile.name.includes('experiences') ||
          profile.name.includes('Start a conversation') ||
          profile.name.includes('Introduce myself') ||
          profile.name.includes('licenses') ||
          profile.name.includes('certifications') ||
          profile.name.includes('projects') ||
          profile.name.includes('volunteer') ||
          profile.name.includes('courses') ||
          profile.name.includes('honors') ||
          profile.name.includes('awards') ||
          profile.name.includes('languages') ||
          profile.name.includes('educations') ||
          profile.name.includes('+') && profile.name.includes('skills')) {
        console.log(`     ⏭️ Skipping junk data: "${profile.name}"`);
      return;
    }

      if (!existingUrls.has(profile.linkedinUrl)) {
        console.log(`     ✅ Adding: ${profile.name}`);
        
        // Create basic prospect for dashboard
        const basicProspect = {
          id: `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: profile.name,
          linkedinUrl: profile.linkedinUrl,
          headline: profile.headline || 'Headline not captured yet',
          jobSeekerScore: 50, // Default score - will be updated in Phase 2
          careerStage: 'Needs Research', 
          techBackground: 'Needs Research',
          summary: `Found via "${profile.keyword}" search - awaiting deep research`,
          dateAdded: new Date().toISOString(),
          source: `phase1_${profile.keyword}`,
          keyword: profile.keyword,
          page: profile.page,
          searchIndex: profile.searchIndex,
          isResearched: false,
          needsResearch: true,
          status: 'Collected - Ready for Research'
        };
        
        existingProspects.push(basicProspect);
        existingUrls.add(profile.linkedinUrl);
        savedCount++;
        } else {
        duplicateCount++;
      }
    });
    
    // Save to storage
    chrome.storage.local.set({ prospects: existingProspects }, () => {
      console.log(`✅ Saved ${savedCount} new profiles to dashboard`);
      console.log(`⏭️ Skipped ${duplicateCount} duplicates`);
      console.log(`📊 Total prospects in dashboard: ${existingProspects.length}`);
      
        callback({ 
          success: true, 
        savedCount: savedCount,
        duplicateCount: duplicateCount,
        totalProspects: existingProspects.length
        });
      });
  });
}

/**
 * Enhance existing prospect with research data and AI analysis
 */
async function enhanceExistingProspect(linkedinUrl, researchData) {
  console.log(`🔬 Enhancing existing prospect: ${researchData.name}`);
  
  // Get AI analysis
  const aiAnalysis = await new Promise((resolve) => {
    analyzeProspectWithAI(researchData, (result) => {
      resolve(result.success ? result : { jobSeekerScore: 0 });
          });
        });
  
  // Update existing prospect in storage
  chrome.storage.local.get(['prospects'], (result) => {
    const prospects = result.prospects || [];
    
    // Find the prospect to enhance
    const prospectIndex = prospects.findIndex(p => p.linkedinUrl === linkedinUrl);
    
    if (prospectIndex !== -1) {
      console.log(`   🔄 BEFORE: Name="${prospects[prospectIndex].name}", Headline="${prospects[prospectIndex].headline}"`);
      console.log(`   🔄 AFTER:  Name="${researchData.name}", Headline="${researchData.headline}"`);
      
      // COMPLETELY OVERWRITE with correct data from profile page
      prospects[prospectIndex] = {
        // Keep only essential original data
        id: prospects[prospectIndex].id,
        dateAdded: prospects[prospectIndex].dateAdded,
        keyword: prospects[prospectIndex].keyword,
        page: prospects[prospectIndex].page,
        searchIndex: prospects[prospectIndex].searchIndex,
        
        // OVERWRITE EVERYTHING ELSE with correct data from profile
        name: researchData.name || prospects[prospectIndex].name, // Use profile name
        headline: researchData.headline || 'No headline found',
        linkedinUrl: researchData.linkedinUrl || prospects[prospectIndex].linkedinUrl,
        about: researchData.about || '',
        experiences: researchData.experiences || [],
        skills: researchData.skills || [],
        education: researchData.education || [],
        posts: researchData.posts || [],
        comments: researchData.comments || [],
        email: researchData.email || '',
        phone: researchData.phone || '',
        location: researchData.location || '',
        
        // Add AI analysis
        jobSeekerScore: aiAnalysis.jobSeekerScore || 0,
        careerStage: aiAnalysis.careerStage || 'Unknown',
        techBackground: aiAnalysis.techBackground || 'Unknown',
        summary: aiAnalysis.summary || 'No AI summary available',
        isJobSeeker: aiAnalysis.isJobSeeker || false,
        
        // Update status
        isResearched: true,
        needsResearch: false,
        status: 'Fully Researched',
        researchedAt: new Date().toISOString(),
        source: `enhanced_${prospects[prospectIndex].keyword}`
      };
      
      // Save back to storage
      chrome.storage.local.set({ prospects }, () => {
        console.log(`✅ Enhanced prospect: ${researchData.name}`);
        console.log(`📊 Job seeker score: ${aiAnalysis.jobSeekerScore || 'N/A'}`);
      });
      } else {
      console.log(`⚠️ Prospect not found in storage: ${linkedinUrl}`);
    }
  });
}

/**
 * Save prospect to storage
 */
async function saveProspect(prospect, callback) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prospects'], (result) => {
    const prospects = result.prospects || [];
      
      // Check for duplicates
      const exists = prospects.find(p => p.linkedinUrl === prospect.linkedinUrl);
      
      if (!exists) {
        prospects.push(prospect);
        
        chrome.storage.local.set({ prospects }, () => {
          console.log(`✅ Saved: ${prospect.name} (Total: ${prospects.length})`);
          if (callback) callback({ success: true });
          resolve();
                });
              } else {
        console.log(`⏭️  Already exists: ${prospect.name}`);
        if (callback) callback({ success: false, error: 'Duplicate' });
        resolve();
      }
    });
  });
}

/**
 * Analyze prospect with AI
 */
async function analyzeProspectWithAI(prospect, callback) {
  console.log(`🤖 Sending comprehensive data to AI for analysis: ${prospect.name}`);
  console.log(`📊 Data being sent:`, {
    name: prospect.name,
    headline: prospect.headline?.substring(0, 50),
    about: prospect.about ? 'Present' : 'Missing',
    experiences: prospect.experiences?.length || 0,
    skills: prospect.skills?.length || 0,
    posts: prospect.posts?.length || 0,
    comments: prospect.comments?.length || 0,
    email: prospect.email ? 'Found' : 'None',
    textLength: prospect.allText?.length || 0
  });

  try {
    const response = await fetch('http://localhost:3000/api/analyze-job-seeker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Send ALL comprehensive data to AI
        name: prospect.name,
        headline: prospect.headline,
        allText: prospect.allText,
        linkedinUrl: prospect.linkedinUrl,
        about: prospect.about,
        experiences: prospect.experiences,
        skills: prospect.skills,
        posts: prospect.posts,
        comments: prospect.comments,
        education: prospect.education,
        email: prospect.email,
        phone: prospect.phone,
        location: prospect.location
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ AI analysis complete for ${prospect.name}:`);
      console.log(`   Job Seeker Score: ${result.jobSeekerScore}%`);
      console.log(`   Career Stage: ${result.careerStage}`);
      console.log(`   Tech Background: ${result.techBackground}`);
      console.log(`   Industry: ${result.industry}`);
      console.log(`   Key Skills: ${result.keySkills?.join(', ')}`);
      console.log(`   Experience Years: ${result.experienceYears}`);
      console.log(`   Job Seeking Signals: ${result.jobSeekingSignals?.length || 0}`);
      console.log(`   Tokens Used: ${result.tokensUsed}`);
    }
    
    callback(result);
    
  } catch (error) {
    console.error(`❌ AI analysis error for ${prospect.name}:`, error);
    callback({ success: false, error: error.message });
  }
}

/**
 * Draft message with AI
 */
async function draftMessageWithAI(prospect, callback) {
  try {
    const response = await fetch('http://localhost:3000/api/draft-message', {
        method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prospect)
    });
    
    const result = await response.json();
    callback(result);
    
  } catch (error) {
          callback({ success: false, error: error.message });
  }
}

// Global storage for pending research operations
const pendingResearch = new Map();

/**
 * Wait for research completion with timeout
 */
function waitForResearchCompletion(prospectId, resolve) {
  const timeout = 120000; // 2 minutes timeout
  const startTime = Date.now();
  
  const checkCompletion = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeout) {
      console.log(`⏰ Research timeout for prospect ${prospectId}`);
      resolve({ success: false, error: 'Research timeout' });
      return;
    }
    
    // Check if result is available
    if (pendingResearch.has(prospectId)) {
      const result = pendingResearch.get(prospectId);
      pendingResearch.delete(prospectId);
      resolve(result);
      return;
    }
    
    // Check again in 1 second
    setTimeout(checkCompletion, 1000);
  };
  
  checkCompletion();
}

/**
 * Handle research completion from content script
 */
async function handleResearchComplete(prospectId, profileData, error) {
  console.log(`📋 Handling research completion for ${prospectId}`);
  
  if (profileData && !error) {
    console.log(`✅ Processing successful research for ${profileData.name}`);
    
    // Store the result for the waiting promise
    pendingResearch.set(prospectId, { success: true, profile: profileData });
    
    // Enhance existing prospect with research data
    await enhanceExistingProspect(profileData.linkedinUrl || profileData.url, profileData);
    
  } else {
    console.log(`❌ Processing failed research for ${prospectId}: ${error}`);
    pendingResearch.set(prospectId, { success: false, error: error });
  }
}

console.log('✅ TheNetwrk Background ready');
