/**
 * TheNetwrk Background Script - CLEANED VERSION
 * 
 * Main orchestrator for LinkedIn job seeker discovery
 * 
 * KEY FEATURES:
 * - Phase 1 (Massive Search): Collects profiles from LinkedIn search results
 *   - Scrolls through search pages
 *   - Extracts name, headline, LinkedIn URL
 *   - Saves to dashboard in real-time
 *   
 * - Phase 2 (Deep Research): Researches collected profiles
 *   - Processes OLDEST profiles first (by dateAdded)
 *   - Comprehensive profile scraping (About, Experience, Contact, Comments)
 *   - AI analysis for job seeker scoring
 *   - Saves enhanced data to dashboard
 *   
 * - Storage Management: Handles prospect data persistence
 * - AI Integration: Communicates with backend for analysis
 * - Dashboard Updates: Real-time notifications to UI
 */

console.log('🚀 TheNetwrk Background Script loaded');

// Scanning control state
let shouldStopScanning = false;
let currentScanningProcess = null; // Track current process for stopping
let lastCollectionResult = null; // Store collection results (can't use window in background script)

// Global storage for comments scraping results
const commentsScrapingResults = new Map();
// Track which tab is scraping for which prospect
const commentsTabToProspect = new Map(); // tabId -> prospectId

// Listen for backup research complete messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle request to scrape comments in new tab
  if (request.action === 'scrapeCommentsInNewTab') {
    console.log('💬 BACKGROUND: Request to scrape comments in new tab');
    console.log('   Profile:', request.profileName);
    console.log('   Prospect ID:', request.prospectId);
    
    (async () => {
      try {
        // Open MAIN PROFILE first (not comments URL directly)
        const baseUrl = request.profileUrl.replace(/\/$/, '');
        
        console.log('   📍 Opening profile tab (will navigate to comments):', baseUrl);
        console.log('   👤 Profile:', request.profileName);
        
        // Open new tab with MAIN profile URL
        const commentsTab = await chrome.tabs.create({
          url: baseUrl,
          active: false // Background tab, don't switch to it
        });
        
        console.log('   ✅ Profile tab created:', commentsTab.id);
        
        // Track this tab -> prospect mapping for when results come back
        commentsTabToProspect.set(commentsTab.id, request.prospectId);
        console.log('   📝 Tracking: tab', commentsTab.id, '→ prospect', request.prospectId);
        
        // Wait for main profile to load
        console.log('   ⏳ Waiting 8 seconds for main profile to load...');
        await new Promise(r => setTimeout(r, 8000));
        
        // Wait for content script to be ready
        let ready = false;
        let attempts = 0;
        while (!ready && attempts < 10) {
          attempts++;
          await new Promise(r => setTimeout(r, 1000));
          
          try {
            const pingResult = await new Promise((resolve) => {
              chrome.tabs.sendMessage(commentsTab.id, { action: 'ping' }, (resp) => {
                resolve(resp && resp.success);
              });
            });
            
            if (pingResult) {
              ready = true;
              console.log(`   ✅ Profile tab ready after ${attempts} attempts`);
            }
          } catch (e) {
            // Try again
          }
        }
        
        if (!ready) {
          console.log('   ❌ Profile tab not ready, giving up');
          await chrome.tabs.remove(commentsTab.id);
          return;
        }
        
        // Get actual tab URL
        const tab = await chrome.tabs.get(commentsTab.id);
        console.log('   📍 Tab actual URL:', tab.url);
        
        // SIMPLIFIED: Always send navigateToCommentsViaUI
        // The content script will handle whether it needs to navigate or is already there
        console.log('   📤 Sending navigateToCommentsViaUI command...');
        console.log('   📦 Payload:', {
          action: 'navigateToCommentsViaUI',
          profileName: request.profileName,
          prospectId: request.prospectId
        });
        
        // Wait a bit more for content script to settle
        await new Promise(r => setTimeout(r, 2000));
        
        chrome.tabs.sendMessage(commentsTab.id, {
          action: 'navigateToCommentsViaUI',
          profileName: request.profileName,
          prospectId: request.prospectId
        }, (response) => {
          console.log('   📥 Message response:', response);
          console.log('   🔍 Runtime error:', chrome.runtime.lastError?.message || 'NONE');
          
          if (chrome.runtime.lastError) {
            console.log('   ❌ Message delivery failed:', chrome.runtime.lastError.message);
          } else if (response) {
            console.log('   ✅ Message acknowledged:', JSON.stringify(response));
          } else {
            console.log('   ⚠️ No response (silent success or handler returned nothing)');
          }
        });
        
      } catch (error) {
        console.error('❌ BACKGROUND: Error opening comments tab:', error);
      }
    })();
    
    sendResponse({ success: true });
    return false;
  }
  
  // Handle comments scraping completion
  if (request.action === 'commentsScrapingComplete') {
    console.log('📥 BACKGROUND: Comments scraping complete');
    console.log('   Prospect ID from message:', request.prospectId);
    console.log('   Tab ID:', sender.tab?.id);
    console.log('   Results:', request.results);
    
    // If prospectId is 'auto-scraped', look up the real prospectId from tab mapping
    let actualProspectId = request.prospectId;
    if (actualProspectId === 'auto-scraped' && sender.tab?.id) {
      actualProspectId = commentsTabToProspect.get(sender.tab.id) || request.prospectId;
      console.log('   🔍 Mapped tab', sender.tab.id, '→ prospect', actualProspectId);
      commentsTabToProspect.delete(sender.tab.id); // Clean up
    }
    
    console.log('   ✅ Using prospect ID:', actualProspectId);
    
    // Store results for the waiting main tab
    commentsScrapingResults.set(actualProspectId, request.results);
    
    // Notify all tabs with this prospect ID
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'commentsResultsReady',
          prospectId: actualProspectId, // Use the mapped ID
          results: request.results
        }).catch(() => {
          // Ignore if tab doesn't have content script
        });
      });
    });
    
    // Close the comments tab (get tab ID from sender)
    if (sender.tab && sender.tab.id) {
      console.log('🗑️ BACKGROUND: Closing comments tab', sender.tab.id);
      chrome.tabs.remove(sender.tab.id).catch((err) => {
        console.log('   ⚠️ Could not close tab:', err.message);
      });
    }
    
    sendResponse({ success: true });
    return false;
  }
  
  // Handle collection complete from content script
  if (request.action === 'collectionComplete') {
    console.log('📥 BACKGROUND: Received collection complete:', {
      success: request.success,
      profileCount: request.profiles?.length || 0,
      error: request.error
    });
    
    if (request.success && request.profiles?.length > 0) {
      console.log('✅ BACKGROUND: Successfully collected profiles');
      console.log('👥 BACKGROUND: Sample profiles:', request.profiles.slice(0, 3).map(p => ({
        name: p.name,
        headline: p.headline?.substring(0, 30),
        url: p.linkedinUrl
      })));
      
      // Store profiles for the waiting promise in background
      if (lastCollectionResult) {
        lastCollectionResult.profiles = request.profiles;
        lastCollectionResult.success = true;
      }
      
      // IMMEDIATELY save to dashboard (don't wait for polling)
      console.log('💾 BACKGROUND: Immediately saving profiles to dashboard...');
      saveBulkProfiles(request.profiles, (saveResponse) => {
        console.log('✅ BACKGROUND: Dashboard save complete:', {
          saved: saveResponse.savedCount,
          duplicates: saveResponse.duplicateCount,
          total: saveResponse.totalProspects
        });
        
        // Send update to popup
        chrome.runtime.sendMessage({
          action: 'updateStats',
          totalProspects: saveResponse.totalProspects,
          newlyAdded: saveResponse.savedCount
        }).catch(() => {
          // Ignore if popup not open
        });
      });
    } else {
      console.log('⚠️ BACKGROUND: Collection failed or no profiles found');
    }
    
    sendResponse({ received: true });
    return false;
  }
  
  if (request.action === 'researchComplete') {
    console.log('📥 BACKGROUND: Received research complete message:', {
      hasData: !!request.data,
      success: request.data?.success,
      profileName: request.data?.profileData?.name,
      prospectId: request.prospectId
    });
    
    // Handle the research completion
    if (request.data?.success && request.data?.profileData) {
      console.log('✅ BACKGROUND: Processing research completion for:', request.data.profileData.name);
      
      // Save the research data to dashboard
      enhanceExistingProspect(request.data.profileData.linkedinUrl, request.data.profileData)
        .then((enhancedProspect) => {
          console.log('✅ BACKGROUND: Research data saved to dashboard successfully');
          console.log('📊 BACKGROUND: Enhanced prospect:', {
            name: enhancedProspect.name,
            headline: enhancedProspect.headline ? 'Found' : 'Missing',
            jobSeekerScore: enhancedProspect.jobSeekerScore || 0,
            emails: enhancedProspect.activityEmails?.length || 0,
            researchStatus: enhancedProspect.researchStatus
          });
          console.log('📊 BACKGROUND: Dashboard will be notified via enhanceExistingProspect function');
          
          // Now close the research tab since research is complete
          console.log('🗑️ BACKGROUND: Research complete - closing research tab...');
          // Note: We don't have the tab ID here, but the tab will be closed by the research completion handler
          
        })
        .catch(error => {
          console.error('❌ BACKGROUND: Failed to save research data:', error);
        });
    }
    
    sendResponse({ received: true });
  }
  
  if (request.action === 'researchError') {
    console.log('📥 BACKGROUND: Received research error message:', {
      prospectName: request.prospectName,
      error: request.error
    });
    
    // Mark prospect as attempted
    if (request.prospectId) {
      markProspectAsAttempted(request.prospectId, request.error)
        .then(() => {
          console.log('✅ BACKGROUND: Marked prospect as attempted due to error');
        })
        .catch(error => {
          console.error('❌ BACKGROUND: Failed to mark prospect as attempted:', error);
        });
    }
    
    sendResponse({ received: true });
  }
  
  // Debug log forwarding from content script
  if (request.action === 'debugLog') {
    console.log('🔍 CONTENT DEBUG:', request.message);
    if (request.data) {
      console.log('📊 CONTENT DATA:', request.data);
    }
    sendResponse({ received: true });
  }
  
  // File logging for debugging and AI processing
  if (request.action === 'fileLog') {
    const logEntry = {
      timestamp: request.timestamp,
      message: request.message,
      data: request.data,
      url: request.url,
      prospectName: request.prospectName
    };
    
    // Log to console
    console.log('📝 FILE LOG:', request.message);
    if (request.data) {
      console.log('📊 FILE DATA:', request.data);
    }
    
    // Write to research log file
    writeToResearchLog(logEntry);
    
    sendResponse({ received: true });
  }
  
  // Manual log file creation for immediate review
  if (request.action === 'createLogFile') {
    console.log('📁 BACKGROUND: Creating research log file manually...');
    createDownloadableLogFile();
    sendResponse({ success: true, message: 'Log file created' });
  }
  
  // Start massive search
  if (request.action === 'startMassiveSearch') {
    console.log('🚀 Starting massive search...');
    shouldStopScanning = false; // Reset stop flag
    currentScanningProcess = 'jobSeekers';
    
    // Notify dashboard that scanning started
    chrome.runtime.sendMessage({
      action: 'scanningStarted',
      scanningType: 'jobSeekers'
    });
    
    startMassiveSearch(request.keywordCount, request.pagesPerKeyword, request.currentTabId, sendResponse);
    return true;
  }
  
  // Start deep research phase
  if (request.action === 'startDeepResearch') {
    console.log('🔬 Starting deep research phase...');
    shouldStopScanning = false; // Reset stop flag
    currentScanningProcess = 'research';
    
    // Notify dashboard that research started
    chrome.runtime.sendMessage({
      action: 'scanningStarted',
      scanningType: 'research'
    });
    
    const researchLimit = request.researchLimit || 10;
    startDeepResearchPhase(researchLimit, sendResponse);
    return true;
  }
  
  // Stop scanning
  if (request.action === 'stopScanning') {
    console.log('🛑 Stop scanning request received:', request.scanningType);
    shouldStopScanning = true;
    
    // Notify dashboard that scanning stopped
    chrome.runtime.sendMessage({
      action: 'scanningStopped',
      scanningType: request.scanningType
    });
    
    sendResponse({ success: true, message: 'Stop signal sent' });
    return true;
  }
  
  // Clear all data (admin feature)
  if (request.action === 'clearAllData') {
    console.log('🗑️ BACKGROUND: Clear all data request (admin)');
    
    // Clear any ongoing processes
    shouldStopScanning = true;
    currentScanningProcess = null;
    
    // Clear storage
    chrome.storage.local.clear(() => {
      console.log('✅ BACKGROUND: All storage cleared by admin');
      
      sendResponse({ success: true, message: 'All data cleared' });
    });
    
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
    // Check if user requested stop
    if (shouldStopScanning) {
      console.log('🛑 MASSIVE SEARCH: Stop requested by user, terminating search');
      break;
    }
    
    const keyword = keywords[i];
    console.log(`\n🔍 [${i + 1}/${keywords.length}] KEYWORD: "${keyword}"`);
    
    // Search multiple pages for this keyword
    for (let page = 1; page <= pagesPerKeyword; page++) {
      // Check for stop signal before each page
      if (shouldStopScanning) {
        console.log('🛑 MASSIVE SEARCH: Stop requested, ending keyword search');
        break;
      }
      
      console.log(`   📄 Page ${page}/${pagesPerKeyword} for "${keyword}"`);
      
      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keyword)}&page=${page}`;
      
      // Navigate to search page
      console.log(`     🌐 Navigating to: ${searchUrl}`);
      chrome.tabs.update(tabId, { url: searchUrl });
      
      // Wait for page to load and content script to be ready
      console.log(`     ⏳ Waiting for page to load...`);
      await new Promise(resolve => setTimeout(resolve, 8000)); // Increased for comprehensive collection
      
      // Wait for content script to be ready with retry mechanism
      let contentScriptReady = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!contentScriptReady && attempts < maxAttempts) {
        attempts++;
        console.log(`     🏓 Checking content script (attempt ${attempts}/${maxAttempts})...`);
        
        try {
          const pingResult = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
              if (chrome.runtime.lastError) {
                resolve(false);
              } else {
                resolve(response && response.success);
              }
            });
          });
          
          if (pingResult) {
            contentScriptReady = true;
            console.log(`     ✅ Content script ready after ${attempts} attempts`);
          } else {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.log(`     ⚠️ Ping attempt ${attempts} failed:`, error.message);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (!contentScriptReady) {
        console.log(`     ❌ Content script not ready after ${maxAttempts} attempts`);
        console.log(`     🔧 Attempting to inject content script manually...`);
        
        try {
          // Try to inject content script manually
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['JOB_SEEKER_KEYWORDS.js', 'src/js/url-collector.js', 'src/js/deep-researcher.js', 'src/js/content.js']
          });
          
          // Wait a bit after injection
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Try ping one more time
          const finalPing = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
              resolve(response && response.success);
            });
          });
          
          if (finalPing) {
            console.log(`     ✅ Content script manually injected and ready!`);
            contentScriptReady = true;
          } else {
            console.log(`     ❌ Manual injection failed, skipping page`);
            continue;
          }
        } catch (injectionError) {
          console.log(`     ❌ Manual injection error:`, injectionError.message);
          continue; // Skip this page
        }
      }
      
      // Collect profiles using scroll-and-collect method
      console.log(`     🔍 Starting scroll-and-collect profile extraction (2-3 minutes)...`);
      
      // Set up collection result storage (module-level variable, not window)
      lastCollectionResult = { profiles: [], success: false };
      
      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`     ⏰ Collection timeout after 3 minutes`);
          // Check if we got any results via runtime message
          if (lastCollectionResult && lastCollectionResult.profiles?.length > 0) {
            console.log(`     ✅ Using results from runtime message: ${lastCollectionResult.profiles.length} profiles`);
            resolve({ success: true, profiles: lastCollectionResult.profiles });
          } else {
            resolve({ success: false, profiles: [], error: 'Collection timeout - no profiles found' });
          }
        }, 180000); // 3 minute timeout for scroll-and-collect
        
        chrome.tabs.sendMessage(tabId, { action: 'collectURLs' }, (response) => {
          // The content script sends back acknowledgment immediately,
          // actual results come via runtime message to 'collectionComplete'
          console.log(`     📨 Initial response:`, response);
          
          if (chrome.runtime.lastError) {
            console.log(`     ❌ Failed to send collect message: ${chrome.runtime.lastError.message}`);
            clearTimeout(timeout);
            resolve({ success: false, profiles: [] });
          } else {
            // Wait for actual collection to complete via runtime message
            console.log(`     ⏳ Waiting for collection to complete...`);
            
            // Poll for results from runtime message
            const checkInterval = setInterval(() => {
              if (lastCollectionResult && lastCollectionResult.profiles?.length > 0) {
                clearInterval(checkInterval);
                clearTimeout(timeout);
                console.log(`     ✅ Collection complete via runtime message: ${lastCollectionResult.profiles.length} profiles`);
                resolve({ success: true, profiles: lastCollectionResult.profiles });
              }
            }, 1000); // Check every second
            
            // Also clear interval on timeout
            setTimeout(() => clearInterval(checkInterval), 180000);
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
        
        // Save to dashboard immediately (real-time) FIRST, then check for skip
        if (result.profiles.length > 0) {
          console.log(`     💾 Saving ${result.profiles.length} profiles to dashboard...`);
          console.log(`     👥 Names found:`, result.profiles.slice(0, 5).map(p => p.name).join(', '), result.profiles.length > 5 ? `...and ${result.profiles.length - 5} more` : '');
          
          // Log each individual name being processed
          result.profiles.forEach((profile, idx) => {
            console.log(`       [${idx + 1}] ${profile.name} ${profile.headline ? '- ' + profile.headline.substring(0, 40) + '...' : ''}`);
          });
          
          // Save profiles to dashboard before checking for skip
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
          
          // Log if this was a good page for profiles (5+)
          if (result.profiles.length >= 5) {
            console.log(`     🚀 EXCELLENT PAGE: Found ${result.profiles.length} profiles (≥5) - good keyword/page combination!`);
            console.log(`     📊 Profiles saved to dashboard, continuing to page ${page + 1} of "${keyword}"`);
          }
        }
      }
      
      // Wait before next page (longer due to scroll-and-collect)
      if (page < pagesPerKeyword) {
        console.log(`     ⏸️ Waiting 8s before next page...`);
        await new Promise(resolve => setTimeout(resolve, 8000));
      }
    }
    
    console.log(`   🎯 TOTAL for "${keyword}": ${allProfiles.filter(p => p.keyword === keyword).length} profiles`);
    
    // Check for stop before waiting
    if (shouldStopScanning) {
      console.log('🛑 MASSIVE SEARCH: Stop requested, skipping remaining keywords');
      break;
    }
    
    // Wait before next keyword
    if (i < keywords.length - 1) {
      console.log(`   ⏸️ Waiting 6s before next keyword...`);
      await new Promise(resolve => setTimeout(resolve, 6000));
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
  
  // Check if search was stopped or completed naturally
  const wasStopped = shouldStopScanning;
  const completionStatus = wasStopped ? 'STOPPED' : 'COMPLETE';
  
  console.log(`\n🎉 ========== MASSIVE SEARCH ${completionStatus} ==========`);
  console.log(`📊 Total unique profiles found: ${uniqueProfiles.length}`);
  console.log(`✅ All profiles already saved to dashboard in real-time!`);
  if (wasStopped) {
    console.log(`🛑 Search was stopped by user request`);
  }
  
  // Reset scanning state
  currentScanningProcess = null;
  shouldStopScanning = false;
  
  // Update popup with final stats and completion status
  chrome.storage.local.get(['prospects'], (result) => {
    const totalProspects = result.prospects?.length || 0;
    console.log(`📊 Final dashboard count: ${totalProspects} prospects`);
    
    // Send completion notification to popup
    chrome.runtime.sendMessage({
      action: 'updateStats',
      totalProspects: totalProspects,
      searchComplete: true,
      uniqueProfilesFound: uniqueProfiles.length,
      wasStopped: false
    });
    
    // Notify dashboard that scanning completed
    chrome.runtime.sendMessage({
      action: 'scanningStopped',
      scanningType: 'jobSeekers'
    });
    
    // Also send completion notification for any open extension pages
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && tab.url.includes(chrome.runtime.getURL(''))) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'searchComplete',
            totalProspects: totalProspects,
            uniqueProfilesFound: uniqueProfiles.length,
            wasStopped: false
          }).catch(() => {
            // Ignore errors for inactive extension pages
          });
        }
      });
    });
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
    
    // Sort by dateAdded to process OLDEST first (the very first ones added)
    needsResearch.sort((a, b) => {
      const dateA = new Date(a.dateAdded || 0);
      const dateB = new Date(b.dateAdded || 0);
      return dateA - dateB; // Oldest first
    });
    
    console.log('📅 SORTING: Processing prospects by oldest first (earliest dateAdded)');
    console.log('📊 Sample order:', needsResearch.slice(0, 5).map((p, idx) => 
      `${idx + 1}. ${p.name} (added: ${new Date(p.dateAdded).toLocaleString()})`
    ));
    
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
        // Check for stop signal before each research
        if (shouldStopScanning) {
          console.log('🛑 DEEP RESEARCH: Stop requested by user, terminating research');
          break;
        }
        
        const prospect = prospectsToResearch[i];
        
        console.log(`\n👤 [${i + 1}/${prospectsToResearch.length}] RESEARCHING: ${prospect.name}`);
        console.log(`   🔗 URL: ${prospect.linkedinUrl}`);
        console.log(`   📝 Current headline: "${prospect.headline}"`);
        
        // Send progress update to popup and dashboard
        chrome.runtime.sendMessage({
          action: 'researchProgress',
          completed: i,
          total: prospectsToResearch.length,
          currentProspect: prospect.name
        });
        
        // Create a NEW tab for this research to avoid conflicts
        console.log(`   🌐 Creating new tab for profile: ${prospect.linkedinUrl}`);
        
        // Log tab creation to file
        writeToResearchLog({
          timestamp: new Date().toISOString(),
          message: `🌐 BACKGROUND: Creating new research tab for ${prospect.name}`,
          data: {
            prospectName: prospect.name,
            profileUrl: prospect.linkedinUrl,
            action: 'creating_tab'
          },
          url: prospect.linkedinUrl,
          prospectName: prospect.name
        });
        
        let researchTabId;
        try {
          const newTab = await chrome.tabs.create({ 
            url: prospect.linkedinUrl,
            active: false // Don't switch to it
          });
          researchTabId = newTab.id;
          console.log(`   ✅ Created research tab ${researchTabId} for ${prospect.name}`);
          
          // Log successful tab creation
          writeToResearchLog({
            timestamp: new Date().toISOString(),
            message: `✅ BACKGROUND: Research tab ${researchTabId} created successfully for ${prospect.name}`,
            data: {
              prospectName: prospect.name,
              tabId: researchTabId,
              profileUrl: prospect.linkedinUrl,
              action: 'tab_created'
            },
            url: prospect.linkedinUrl,
            prospectName: prospect.name
          });
          
        } catch (tabError) {
          console.log(`   ❌ Failed to create tab for ${prospect.name}:`, tabError.message);
          
          // Log tab creation failure
          writeToResearchLog({
            timestamp: new Date().toISOString(),
            message: `❌ BACKGROUND: Failed to create tab for ${prospect.name}: ${tabError.message}`,
            data: {
              prospectName: prospect.name,
              error: tabError.message,
              action: 'tab_creation_failed'
            },
            url: prospect.linkedinUrl,
            prospectName: prospect.name
          });
          
          continue; // Skip this prospect
        }
        
        // Enhanced content script loading with retry mechanism
        console.log(`   ⏳ Waiting for profile page to load...`);
        await new Promise(resolve => setTimeout(resolve, 8000)); // Longer wait for new tab
        
        // Retry mechanism to ensure content script is loaded and ready
        let contentScriptReady = false;
        let attempts = 0;
        const maxAttempts = 15; // More attempts for profile pages
        
        while (!contentScriptReady && attempts < maxAttempts) {
          attempts++;
          console.log(`   🏓 Testing content script readiness (attempt ${attempts}/${maxAttempts})...`);
          
          try {
            // Test content script with timeout
            const pingResult = await new Promise((resolve) => {
              const timeout = setTimeout(() => {
                resolve(false);
              }, 3000); // 3-second timeout for each ping
              
              chrome.tabs.sendMessage(researchTabId, { action: 'ping' }, (response) => {
                clearTimeout(timeout);
                
                if (chrome.runtime.lastError) {
                  console.log(`     ❌ Ping failed: ${chrome.runtime.lastError.message}`);
                  resolve(false);
                } else if (response && response.success) {
                  console.log(`     ✅ Content script ready - URL: ${response.url}`);
                  resolve(true);
                } else {
                  console.log(`     ⚠️ Unexpected ping response:`, response);
                  resolve(false);
                }
              });
            });
            
            if (pingResult) {
              contentScriptReady = true;
              console.log(`   ✅ Content script ready after ${attempts} attempts`);
            } else {
              console.log(`     ⏳ Content script not ready, waiting 2 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Try manual script injection after several failed attempts
              if (attempts === 8) {
                console.log(`     🔧 Attempting manual content script injection...`);
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId: researchTabId },
                    files: ['JOB_SEEKER_KEYWORDS.js', 'src/js/url-collector.js', 'src/js/deep-researcher.js', 'src/js/content.js']
                  });
                  console.log(`     ✅ Manual injection completed`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (injectionError) {
                  console.log(`     ❌ Manual injection failed:`, injectionError.message);
                }
              }
            }
            
          } catch (error) {
            console.log(`     ❌ Ping attempt ${attempts} error:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        if (!contentScriptReady) {
          console.log(`   ❌ Content script failed to load after ${maxAttempts} attempts, skipping ${prospect.name}`);
          continue; // Skip this prospect
        }
        
        // Start comprehensive profile research with enhanced retry and timeout
        console.log(`   🔬 Starting comprehensive profile research for ${prospect.name}...`);
        console.log(`   📊 Research details:`, {
          prospectId: prospect.id,
          prospectName: prospect.name,
          prospectUrl: prospect.linkedinUrl,
          researchTabId: researchTabId,
          attempt: 'Starting'
        });
        
        let researchAttempts = 0;
        const maxResearchAttempts = 3;
        let result = null;
        
        // Retry mechanism for research
        while (researchAttempts < maxResearchAttempts && !result?.success) {
          researchAttempts++;
          console.log(`   🔄 Research attempt ${researchAttempts}/${maxResearchAttempts} for ${prospect.name}`);
          
          result = await new Promise((resolve) => {
            // Set up timeout for each attempt (90 seconds)
            const researchTimeout = setTimeout(() => {
              console.log(`   ⏰ Research attempt ${researchAttempts} timeout for ${prospect.name} after 5 minutes`);
              resolve({ success: false, error: `Research timeout on attempt ${researchAttempts}` });
            }, 300000); // 5 minute timeout per attempt (increased for SLOW comprehensive research)
            
            try {
              console.log(`   📤 Sending research message to tab ${researchTabId} for ${prospect.name} (attempt ${researchAttempts})`);
              
              chrome.tabs.sendMessage(researchTabId, {
                action: 'comprehensiveResearch',
                prospect: prospect,
                attempt: researchAttempts
              }, (response) => {
                clearTimeout(researchTimeout);
                
                console.log(`   📥 Received response for ${prospect.name} attempt ${researchAttempts}:`, {
                  hasResponse: !!response,
                  responseSuccess: response?.success,
                  responseError: response?.error,
                  lastError: chrome.runtime.lastError?.message
                });
                
                if (chrome.runtime.lastError) {
                  console.log(`   ❌ Research attempt ${researchAttempts} failed: ${chrome.runtime.lastError.message}`);
                  resolve({ 
                    success: false, 
                    error: `Attempt ${researchAttempts}: ${chrome.runtime.lastError.message}` 
                  });
                } else if (response && response.success) {
                  if (response.status === 'started') {
                    console.log(`   ✅ Research attempt ${researchAttempts} acknowledged for ${prospect.name} - research in progress`);
                    console.log(`   ⏳ Waiting for research completion via runtime message...`);
                    console.log(`   🔒 Tab ${researchTabId} will remain open until research completes`);
                    
                    // This will be handled by the runtime message listener
                    // For now, consider this attempt successful (research is running)
                    resolve({ success: true, status: 'in_progress', profileData: { name: prospect.name } });
                    
                  } else {
                    console.log(`   ✅ Research attempt ${researchAttempts} completed immediately for ${prospect.name}`);
                    console.log(`   📊 Response data:`, {
                      hasProfileData: !!response.profileData,
                      profileDataId: response.profileData?.id,
                      profileDataName: response.profileData?.name,
                      profileDataEmails: response.profileData?.activityEmails?.length || 0
                    });
                    resolve(response);
                  }
                } else {
                  console.log(`   ⚠️ Research attempt ${researchAttempts} returned unsuccessful response:`, response?.error);
                  resolve({ 
                    success: false, 
                    error: response?.error || `No valid response on attempt ${researchAttempts}` 
                  });
                }
              });
            } catch (sendError) {
              clearTimeout(researchTimeout);
              console.log(`   ❌ Error sending research message attempt ${researchAttempts}:`, sendError.message);
              resolve({ success: false, error: `Send error attempt ${researchAttempts}: ${sendError.message}` });
            }
          });
          
          // If attempt failed, wait before retry
          if (!result?.success && researchAttempts < maxResearchAttempts) {
            console.log(`   ⏳ Research attempt ${researchAttempts} failed, waiting 5 seconds before retry...`);
            
            // Check if tab still exists before retrying
            try {
              await chrome.tabs.get(researchTabId);
              console.log(`   ✅ Research tab ${researchTabId} still exists, proceeding with retry`);
            } catch (tabError) {
              console.log(`   ❌ Research tab ${researchTabId} no longer exists, cannot retry`);
              break; // Exit retry loop if tab is gone
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Try to refresh the content script before retry
            if (researchAttempts === 2) {
              console.log(`   🔄 Attempting content script refresh before final retry...`);
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: researchTabId },
                  files: ['src/js/deep-researcher.js', 'src/js/content.js']
                });
                await new Promise(resolve => setTimeout(resolve, 3000));
              } catch (refreshError) {
                console.log(`   ⚠️ Content script refresh failed:`, refreshError.message);
              }
            }
          }
        }
        
        // Process the research result with enhanced error handling
        if (result && result.success) {
          if (result.status === 'in_progress') {
            console.log(`   ✅ Research started successfully for ${prospect.name} - will complete via runtime message`);
            console.log(`   ⏳ Research is running in background, tab ${researchTabId} will remain open`);
            console.log(`   📊 Tab will be closed automatically when runtime message completes research`);
            
            // DON'T close tab yet - research is still running
            // DON'T mark as completed yet - the runtime message handler will do that
            // Skip tab closure for in_progress status
            
          } else if (result.profileData) {
            console.log(`   ✅ Research complete immediately for ${prospect.name}`);
            console.log(`   📊 Data captured:`, {
              headline: result.profileData.headline ? 'Found' : 'Not found',
              about: result.profileData.about ? 'Found' : 'Not found',
              experiences: result.profileData.experiences?.length || 0,
              posts: result.profileData.posts?.length || 0,
              emails: result.profileData.activityEmails?.length || 0,
              jobSeekerScore: result.profileData.jobSeekerScore || 0
            });
            
            // Enhance the existing prospect with research data
            try {
              await enhanceExistingProspect(prospect.linkedinUrl, result.profileData);
              console.log(`   💾 Successfully saved research data for ${prospect.name}`);
            } catch (saveError) {
              console.error(`   ❌ Failed to save research data for ${prospect.name}:`, saveError.message);
            }
            
            // Close tab after immediate completion
            try {
              console.log(`   🗑️ Closing research tab ${researchTabId} for ${prospect.name} (immediate completion)`);
              await chrome.tabs.remove(researchTabId);
              console.log(`   ✅ Research tab closed successfully`);
            } catch (closeError) {
              console.log(`   ⚠️ Error closing research tab: ${closeError.message}`);
            }
          }
          
        } else {
          console.log(`   ❌ Research failed for ${prospect.name}: ${result?.error || 'No data returned'}`);
          
          // Mark as researched even if failed to avoid reprocessing
          try {
            await markProspectAsAttempted(prospect.linkedinUrl, result?.error || 'Research failed');
          } catch (markError) {
            console.error(`   ❌ Failed to mark ${prospect.name} as attempted:`, markError.message);
          }
          
          // Close tab after failure
          try {
            console.log(`   🗑️ Closing research tab ${researchTabId} for ${prospect.name} (failed)`);
            await chrome.tabs.remove(researchTabId);
            console.log(`   ✅ Research tab closed successfully`);
          } catch (closeError) {
            console.log(`   ⚠️ Error closing research tab: ${closeError.message}`);
          }
        }
        
        // Check for stop before waiting for next profile
        if (shouldStopScanning) {
          console.log('🛑 DEEP RESEARCH: Stop requested, ending research phase');
          break;
        }
        
        // Wait before next profile
        if (i < prospectsToResearch.length - 1) {
          console.log(`   ⏸️ Waiting 2s before next profile...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Note: Individual research is still running in background tabs
      // We've kicked off all the research, but they complete asynchronously
      console.log(`\n⏳ ========== ALL RESEARCH INITIATED ==========`);
      console.log(`📊 Kicked off research for ${prospectsToResearch.length} prospects`);
      console.log(`🎯 Research running in ${prospectsToResearch.length} background tabs`);
      console.log(`📋 Each prospect will complete individually and save to dashboard`);
      console.log(`⏰ Expected completion time: ${prospectsToResearch.length * 1} - ${prospectsToResearch.length * 2} minutes`);
      console.log(`👀 Watch for "✅ Research data saved" messages above as each completes`);
      
      // Reset scanning state
      currentScanningProcess = null;
      shouldStopScanning = false;
    });
  });
}

// Old functions removed - now handled by comprehensive collection and research flow

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
          profile.name === 'Name not found' ||
          profile.name === 'Profile found' ||
          (profile.name.includes('+') && profile.name.includes('skills'))) {
        console.log(`     ⏭️ Skipping invalid profile: "${profile.name}"`);
        return;
      }

      if (!existingUrls.has(profile.linkedinUrl)) {
        console.log(`     ✅ Adding: ${profile.name} (headline will be added by AI research)`);
        
        // Create basic prospect for dashboard (simplified - no headline initially)
        const basicProspect = {
          id: `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: profile.name,
          linkedinUrl: profile.linkedinUrl,
          jobSeekerScore: 0, // Will be updated by AI during research
          email: '', // Will be found during research
          dateAdded: new Date().toISOString(),
          keyword: profile.keyword,
          page: profile.page,
          searchIndex: profile.searchIndex,
          isResearched: false,
          needsResearch: true,
          researchStatus: 'new'
          // headline will be added during AI research phase
        };
        
        console.log(`     💾 Saving basic prospect: ${basicProspect.name} (AI will enhance with headline + score)`);
        
        
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
  
  // Check if AI analysis already included in researchData (new flow)
  // If jobSeekerScore exists in researchData, AI analysis already done
  const hasAIAnalysis = researchData.jobSeekerScore !== undefined;
  
  let aiAnalysis = {};
  if (!hasAIAnalysis) {
    console.log('   🤖 AI analysis not in research data, requesting separately...');
    // Get AI analysis (old flow)
    aiAnalysis = await new Promise((resolve) => {
      analyzeProspectWithAI(researchData, (result) => {
        resolve(result.success ? result : { jobSeekerScore: 0 });
      });
    });
  } else {
    console.log('   ✅ AI analysis already included in research data (new flow)');
    // Extract ALL AI fields from researchData
    aiAnalysis = {
      // Core scoring
      jobSeekerScore: researchData.jobSeekerScore,
      isJobSeeker: researchData.isJobSeeker,
      confidence: researchData.confidence,
      
      // Career fields
      careerStage: researchData.careerStage,
      techBackground: researchData.techBackground,
      industry: researchData.industry,
      currentRole: researchData.currentRole,
      
      // Experience metrics
      experienceYears: researchData.experienceYears,
      techProficiency: researchData.techProficiency,
      
      // Contact metrics
      contactability: researchData.contactability,
      remotePreference: researchData.remotePreference,
      networkingActivity: researchData.networkingActivity,
      
      // Text fields
      summary: researchData.summary,
      notes: researchData.notes,
      aiNotes: researchData.aiNotes,
      
      // Skills and signals
      jobSeekerIndicators: researchData.jobSeekerIndicators,
      jobSeekingSignals: researchData.jobSeekingSignals || researchData.jobSeekerIndicators,
      keySkills: researchData.keySkills,
      
      // Metadata
      tokensUsed: researchData.tokensUsed
    };
  }
  
  // Update existing prospect in storage
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['prospects'], (result) => {
      const prospects = result.prospects || [];
      
      // Find the prospect to enhance
      const prospectIndex = prospects.findIndex(p => p.linkedinUrl === linkedinUrl);
    
    if (prospectIndex !== -1) {
      console.log(`   ✅ FOUND prospect to enhance at index ${prospectIndex}`);
      console.log(`   🔄 BEFORE enhancement:`, {
        id: prospects[prospectIndex].id,
        name: prospects[prospectIndex].name,
        headline: prospects[prospectIndex].headline || 'undefined',
        jobSeekerScore: prospects[prospectIndex].jobSeekerScore || 0,
        isResearched: prospects[prospectIndex].isResearched || false,
        activityEmails: prospects[prospectIndex].activityEmails?.length || 0
      });
      console.log(`   🔄 RESEARCH DATA received:`, {
        name: researchData.name,
        headline: researchData.headline || 'undefined',
        about: researchData.about ? 'Found' : 'Missing',
        experiences: researchData.experiences?.length || 0,
        comments: researchData.comments?.length || 0,
        activityEmails: researchData.activityEmails?.length || 0,
        jobSeekerScore: researchData.jobSeekerScore || 0,
        emails: researchData.emails?.length || 0
      });
      console.log(`   🤖 AI ANALYSIS:`, {
        jobSeekerScore: aiAnalysis.jobSeekerScore,
        careerStage: aiAnalysis.careerStage,
        techBackground: aiAnalysis.techBackground,
        isJobSeeker: aiAnalysis.isJobSeeker,
        confidence: aiAnalysis.confidence
      });
      
      // Keep original name from collection, use researched data for everything else
      const originalName = prospects[prospectIndex].name; // The name we collected from search
      const researchedName = researchData.name || originalName;
      
      // Validate researched name isn't corrupted
      const isValidResearchedName = researchedName && 
                                    !researchedName.includes('Feed') &&
                                    !researchedName.includes('detail') &&
                                    !researchedName.includes('update') &&
                                    researchedName.length > 2;
      
      const finalName = isValidResearchedName ? researchedName : originalName;
      
      console.log(`   🔍 Name validation: Original="${originalName}", Researched="${researchedName}", Final="${finalName}"`);
      
      // Extract all emails from various sources
      const allEmails = [
        ...(researchData.activityEmails || []),
        ...(researchData.emails || []),
        ...(researchData.contactEmails || []),
        ...(researchData.commentEmails || [])
      ];
      const uniqueEmails = [...new Set(allEmails)].filter(e => e && e.includes('@'));
      
      console.log(`   📧 Total unique emails found: ${uniqueEmails.length}`);
      
      // CAREFULLY MERGE data keeping original name if research name is corrupted
      prospects[prospectIndex] = {
        // Keep essential original data
        id: prospects[prospectIndex].id,
        dateAdded: prospects[prospectIndex].dateAdded,
        keyword: prospects[prospectIndex].keyword,
        page: prospects[prospectIndex].page,
        searchIndex: prospects[prospectIndex].searchIndex,
        linkedinUrl: prospects[prospectIndex].linkedinUrl,
        
        // Use validated name
        name: finalName,
        
        // Add researched data
        headline: researchData.headline || '',
        about: researchData.about || '',
        experiences: researchData.experiences || [],
        skills: researchData.skills || [],
        education: researchData.education || [],
        posts: researchData.posts || [],
        comments: researchData.comments || [],
        email: uniqueEmails[0] || '',
        activityEmails: uniqueEmails,
        phone: researchData.phone || '',
        location: researchData.location || '',
        
        // Add ALL AI analysis fields (dashboard needs these)
        jobSeekerScore: aiAnalysis.jobSeekerScore || 0,
        isJobSeeker: aiAnalysis.isJobSeeker || false,
        confidence: aiAnalysis.confidence || 0,
        
        // Career fields
        careerStage: aiAnalysis.careerStage || 'Unknown',
        techBackground: aiAnalysis.techBackground || 'Unknown',
        industry: aiAnalysis.industry || 'Unknown',
        currentRole: aiAnalysis.currentRole || '',
        
        // Experience metrics
        experienceYears: aiAnalysis.experienceYears || 0,
        techProficiency: aiAnalysis.techProficiency || 'Unknown',
        
        // Contact metrics
        contactability: aiAnalysis.contactability || 'Unknown',
        remotePreference: aiAnalysis.remotePreference || 'Unknown',
        networkingActivity: aiAnalysis.networkingActivity || 'Unknown',
        
        // Text fields
        summary: aiAnalysis.summary || 'No AI summary available',
        notes: aiAnalysis.notes || '',
        aiNotes: aiAnalysis.aiNotes || aiAnalysis.notes || '',
        
        // Skills and signals
        keySkills: aiAnalysis.keySkills || [],
        jobSeekerIndicators: aiAnalysis.jobSeekerIndicators || [],
        jobSeekingSignals: aiAnalysis.jobSeekingSignals || aiAnalysis.jobSeekerIndicators || [],
        
        // Metadata
        tokensUsed: aiAnalysis.tokensUsed || '',
        
        // Update status
        isResearched: true,
        needsResearch: false,
        researchStatus: uniqueEmails.length > 0 ? 'email-found' : 'fully-researched',
        researchedAt: new Date().toISOString()
      };
      
      console.log(`   ✅ Enhanced prospect data:`, {
        name: prospects[prospectIndex].name,
        headline: prospects[prospectIndex].headline?.substring(0, 50) || 'None',
        jobSeekerScore: prospects[prospectIndex].jobSeekerScore,
        email: prospects[prospectIndex].email || 'None'
      });
      
      console.log(`   🔄 AFTER enhancement:`, {
        id: prospects[prospectIndex].id,
        name: prospects[prospectIndex].name,
        headline: prospects[prospectIndex].headline || 'undefined',
        jobSeekerScore: prospects[prospectIndex].jobSeekerScore || 0,
        isResearched: prospects[prospectIndex].isResearched || false,
        activityEmails: prospects[prospectIndex].activityEmails?.length || 0,
        researchStatus: prospects[prospectIndex].researchStatus
      });
      
      // Save back to storage
      chrome.storage.local.set({ prospects }, () => {
        console.log(`✅ Enhanced prospect saved to storage: ${researchData.name}`);
        console.log(`📊 Job seeker score: ${aiAnalysis.jobSeekerScore || 'N/A'}`);
        console.log(`📧 Emails found: ${prospects[prospectIndex].activityEmails?.length || 0}`);
        
        // Notify dashboard of update (if dashboard is open)
        console.log('📤 BACKGROUND: Attempting to send prospectUpdated message to dashboard...');
        chrome.runtime.sendMessage({
          action: 'prospectUpdated',
          prospect: prospects[prospectIndex]
        }).then(() => {
          console.log('✅ BACKGROUND: Dashboard message sent successfully');
        }).catch((msgError) => {
          console.log('ℹ️ BACKGROUND: Dashboard not open (this is normal):', msgError.message);
          console.log('📊 BACKGROUND: Data saved to storage - dashboard will update when opened');
        });
        
        resolve(prospects[prospectIndex]);
      });
      } else {
        console.log(`❌ Prospect not found in storage for URL: ${linkedinUrl}`);
        console.log(`📊 Available prospects:`, prospects.map(p => ({ name: p.name, url: p.linkedinUrl })));
        reject(new Error('Prospect not found in storage'));
      }
    });
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

/**
 * Mark a prospect as attempted even if research failed
 */
async function markProspectAsAttempted(linkedinUrl, errorMessage) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prospects'], (result) => {
      const prospects = result.prospects || [];
      
      // Find the prospect to mark
      const prospectIndex = prospects.findIndex(p => p.linkedinUrl === linkedinUrl);
      
      if (prospectIndex !== -1) {
        console.log(`   🏷️ Marking ${prospects[prospectIndex].name} as research attempted`);
        
        // Update status to show it was attempted
        prospects[prospectIndex] = {
          ...prospects[prospectIndex],
          isResearched: true,
          needsResearch: false,
          researchStatus: 'research-failed',
          researchError: errorMessage,
          researchedAt: new Date().toISOString()
        };
        
        // Save back to storage
        chrome.storage.local.set({ prospects }, () => {
          console.log(`   ✅ Marked ${prospects[prospectIndex].name} as attempted`);
          resolve();
        });
      } else {
        console.log(`   ⚠️ Prospect not found in storage: ${linkedinUrl}`);
        resolve();
      }
    });
  });
}

console.log('✅ TheNetwrk Background ready');

// Research log file management
let researchLogEntries = [];

/**
 * Write research log entry to file for debugging and AI processing
 */
function writeToResearchLog(logEntry) {
  researchLogEntries.push(logEntry);
  
  // Keep only last 1000 entries to prevent memory issues
  if (researchLogEntries.length > 1000) {
    researchLogEntries = researchLogEntries.slice(-1000);
  }
  
  // Save to storage for persistence
  chrome.storage.local.set({ 
    researchLogs: researchLogEntries 
  });
  
  // Also create downloadable log file every 50 entries
  if (researchLogEntries.length % 50 === 0) {
    createDownloadableLogFile();
  }
}

/**
 * Create downloadable research log file
 */
function createDownloadableLogFile() {
  const logContent = researchLogEntries.map(entry => {
    const dataStr = entry.data ? JSON.stringify(entry.data, null, 2) : '';
    return `${entry.timestamp} | ${entry.prospectName} | ${entry.url}
${entry.message}
${dataStr ? 'DATA: ' + dataStr : ''}
${'='.repeat(80)}`;
  }).join('\n\n');
  
  const blob = new Blob([logContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  // Download the log file
  chrome.downloads.download({
    url: url,
    filename: `thenetwrk-research-log-${new Date().toISOString().split('T')[0]}.txt`,
    saveAs: false
  }).then(() => {
    console.log('📁 BACKGROUND: Research log file created');
  }).catch(error => {
    console.log('⚠️ BACKGROUND: Could not create log file:', error.message);
  });
}
