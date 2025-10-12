/**
 * TheNetwrk Popup - 2-Phase Approach
 * Phase 1: Collect URLs (lightweight)
 * Phase 2: Deep research (comprehensive)
 */

document.addEventListener('DOMContentLoaded', init);

function init() {
  loadStats();
  setupButtons();
}

function loadStats() {
  chrome.storage.local.get(['prospects', 'urlsCollected'], (result) => {
    const prospects = result.prospects || [];
    const urls = result.urlsCollected || [];
    
    document.getElementById('prospect-count').textContent = prospects.length;
    
    // Enable research button if we have prospects to research
    const researchBtn = document.getElementById('start-research');
    if (prospects.length > 0) {
      researchBtn.disabled = false;
      researchBtn.textContent = `🔬 Research Prospects`;
    }
  });
}

function setupButtons() {
  // Phase 1: Start URL collection
  document.getElementById('start-url-collection').addEventListener('click', () => {
    console.log('🔍 POPUP: URL Collection button clicked!');
    
    const keywordCount = parseInt(document.getElementById('keyword-count').value) || 20;
    const pagesPerKeyword = parseInt(document.getElementById('pages-per-keyword').value) || 3;
    
    console.log('🔍 POPUP: Starting URL collection with', keywordCount, 'keywords,', pagesPerKeyword, 'pages each');
    
    // Get current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        console.error('❌ POPUP: No active tab');
        alert('No active tab');
        return;
      }
      
      console.log('🔍 POPUP: Sending message to tab', tabs[0].id);
      console.log('🔍 POPUP: Tab URL:', tabs[0].url);
      
      // Send to background script to handle navigation
      chrome.runtime.sendMessage({
        action: 'startMassiveSearch',
        keywordCount: keywordCount,
        pagesPerKeyword: pagesPerKeyword,
        currentTabId: tabs[0].id
      }, (response) => {
        console.log('🔍 POPUP: Received response:', response);
        
        if (chrome.runtime.lastError) {
          console.error('❌ POPUP: Runtime error:', chrome.runtime.lastError);
          const errorMsg = chrome.runtime.lastError.message || JSON.stringify(chrome.runtime.lastError);
          alert('Error: ' + errorMsg + '\n\nMake sure you are on a LinkedIn page and refresh it.');
          return;
        }
        
        if (response && response.success) {
          // Check if this is the initial "started" response or the final "completed" response
          if (response.profiles) {
            console.log('✅ POPUP: Success! Found', response.profiles.length, 'profiles');
            
            // Save basic profiles to dashboard immediately
            chrome.runtime.sendMessage({
              action: 'saveBulkProfiles',
              profiles: response.profiles
            }, (saveResponse) => {
              if (saveResponse && saveResponse.success) {
                alert(`✅ Found ${response.profiles.length} job seekers!\n\nSaved ${saveResponse.savedCount} to dashboard.\n\nClick "Start Deep Research" to enhance with AI analysis.`);
                
                // Also save URLs for Phase 2 enhancement
                chrome.storage.local.set({ 
                  urlsCollected: response.profiles 
                }, () => {
                  console.log('✅ POPUP: URLs saved for Phase 2');
                  loadStats(); // Refresh UI
                });
              } else {
                alert('Found profiles but failed to save to dashboard: ' + (saveResponse?.error || 'Unknown error'));
              }
            });
          } else {
            // This is just the "started" confirmation - show different message
            console.log('✅ POPUP: Search started successfully');
            alert('✅ Job seeker search started!\n\nThe extension is now searching LinkedIn in the background.\nWatch your browser as it navigates through search results.\n\nThis may take 5-10 minutes to complete.');
            
            // Disable button and show progress
            document.getElementById('start-url-collection').disabled = true;
            document.getElementById('start-url-collection').textContent = '🔄 Searching LinkedIn...';
          }
        } else {
          console.error('❌ POPUP: Failed:', response);
          alert('Failed: ' + (response?.error || response?.message || 'Unknown error'));
        }
      });
    });
  });
  
  // Phase 2: Start deep research
  document.getElementById('start-research').addEventListener('click', () => {
    console.log('Starting deep research...');
    
    const researchLimit = parseInt(document.getElementById('research-limit').value) || 10;
    
    chrome.runtime.sendMessage({
      action: 'startDeepResearch',
      researchLimit: researchLimit
    }, (response) => {
      if (response && response.success) {
        alert(`✅ Deep research started!\n\nWill research ${researchLimit} prospects. Watch your browser work. This will take 5-10 minutes per 10 profiles.`);
        
        // Show progress
        document.getElementById('research-status').style.display = 'block';
        
        // Disable button during research
        document.getElementById('start-research').disabled = true;
        document.getElementById('start-research').textContent = '🔄 Researching...';
      } else {
        alert('Failed to start research: ' + (response?.error || 'Unknown error'));
      }
    });
  });
  
  // View dashboard
  document.getElementById('view-dashboard').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/pages/dashboard.html')
    });
  });
  
  // Manual capture
  document.getElementById('capture-current').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'captureProfile' }, (response) => {
          if (response && response.success) {
            chrome.runtime.sendMessage({
              action: 'saveProspect',
              prospect: response.profile
            }, (saveResponse) => {
              if (saveResponse && saveResponse.success) {
                alert(`✅ Captured: ${response.profile.name}`);
                loadStats();
              }
            });
          } else {
            alert('Not on a LinkedIn profile page');
          }
        });
      }
    });
  });
}

// Listen for real-time updates
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Real-time stats updates during massive search
  if (request.action === 'updateStats') {
    console.log('📊 POPUP: Real-time update:', request);
    
    // Update prospect count
    const prospectCount = document.getElementById('prospect-count');
    if (prospectCount) {
      prospectCount.textContent = request.totalProspects;
    }
    
    // Update research button text
    const researchBtn = document.getElementById('start-research');
    if (researchBtn && request.totalProspects > 0) {
      researchBtn.disabled = false;
      researchBtn.textContent = `🔬 Research Prospects`;
    }
    
    // Re-enable the collection button if search is complete
    if (request.searchComplete) {
      const collectionBtn = document.getElementById('start-url-collection');
      if (collectionBtn) {
        collectionBtn.disabled = false;
        collectionBtn.textContent = '✅ Search Complete - Start Another?';
      }
    }
    
    console.log(`📊 POPUP: Updated to ${request.totalProspects} prospects`);
  }
  
  // Search completion notification
  if (request.action === 'searchComplete') {
    console.log('🎉 POPUP: Search completed!', request);
    
    const collectionBtn = document.getElementById('start-url-collection');
    if (collectionBtn) {
      collectionBtn.disabled = false;
      collectionBtn.textContent = '🔍 Start Finding Job Seekers';
    }
    
    // Show completion alert with stop status
    setTimeout(() => {
      if (request.wasStopped) {
        alert(`⛔ Job seeker search stopped by user!\n\n📊 Partial results saved: ${request.uniqueProfilesFound} profiles\n📊 Total prospects: ${request.totalProspects}\n\n🎯 You can resume research or start a new search.`);
      } else {
        alert(`🎉 Job seeker search completed!\n\n✅ Found ${request.uniqueProfilesFound} unique profiles\n📊 Total prospects: ${request.totalProspects}\n\n🎯 Next: Click "Start Research & Email Extraction" or check the Dashboard!\n\n💡 Tip: Use Dashboard's Stop button to halt long processes.`);
      }
    }, 1000);
  }
  
  // Research progress updates
  if (request.action === 'researchProgress') {
    const progress = document.getElementById('research-progress');
    const fill = document.getElementById('progress-fill');
    
    if (progress && fill) {
      progress.textContent = `${request.completed}/${request.total}`;
      const percentage = (request.completed / request.total) * 100;
      fill.style.width = percentage + '%';
    }
    
    // Re-enable button when complete
    if (request.completed === request.total) {
      document.getElementById('start-research').disabled = false;
      
      if (request.wasStopped) {
        document.getElementById('start-research').textContent = '⛔ Research Stopped';
        setTimeout(() => {
          alert(`⛔ Research stopped by user!\n\n📊 Partial progress: ${request.completed} prospects analyzed.\n\nYou can resume research or check the dashboard.`);
        }, 1000);
      } else {
        document.getElementById('start-research').textContent = '✅ Research Complete';
        setTimeout(() => {
          alert(`✅ Research complete!\n\n${request.total} prospects analyzed.\n\nCheck the dashboard to review and send messages.`);
        }, 1000);
      }
    }
  }
});