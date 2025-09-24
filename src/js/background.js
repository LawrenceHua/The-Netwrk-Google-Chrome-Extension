// Background script for TheNetwrk Chrome Extension

// Initialize the extension database
chrome.runtime.onInstalled.addListener(() => {
  // Initialize empty database structure
  chrome.storage.local.set({
    prospects: [],
    stats: {
      total: 0,
      contacted: 0,
      responded: 0
    },
    settings: {
      messageTemplates: [
        {
          id: 'initial',
          subject: 'Connecting with TheNetwrk',
          body: 'Hi {{name}}, \n\nI noticed your profile and thought you might be interested in TheNetwrk - a community helping professionals like you find 90k+ jobs in tech. \n\nWould you be open to learning more? \n\nhttps://welcometothenetwork.xyz/ \n\nBest regards,\nTheNetwrk Team'
        },
        {
          id: 'followup1',
          subject: 'Following up: TheNetwrk Opportunity',
          body: 'Hi {{name}}, \n\nI wanted to follow up about TheNetwrk - we\'re helping professionals like you pivot into tech roles with great compensation. \n\nMany of our members have found success after struggling with traditional job applications. \n\nhttps://welcometothenetwork.xyz/ \n\nLet me know if you\'d like to connect!\n\nBest,\nTheNetwrk Team'
        },
        {
          id: 'followup2',
          subject: 'Last chance: Join TheNetwrk community',
          body: 'Hi {{name}}, \n\nThis is my final note about TheNetwrk. We\'re building a supportive community focused on helping professionals like you land $90k+ tech jobs. \n\nIf you\'re interested in real accountability and ending the cycle of online applications, check us out: \n\nhttps://welcometothenetwork.xyz/ \n\nAll the best in your career journey,\nTheNetwrk Team'
        }
      ]
    }
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveProspect') {
    saveProspect(request.data, sendResponse);
    return true; // Keep the messaging channel open for async response
  }
  
  if (request.action === 'getProspects') {
    getProspects(sendResponse);
    return true; // Keep the messaging channel open for async response
  }
  
  if (request.action === 'updateProspect') {
    updateProspect(request.data, sendResponse);
    return true; // Keep the messaging channel open for async response
  }
});

// Save prospect to database
function saveProspect(prospectData, callback) {
  chrome.storage.local.get(['prospects', 'stats'], (result) => {
    const prospects = result.prospects || [];
    const stats = result.stats || { total: 0, contacted: 0, responded: 0 };
    
    // Check if prospect already exists
    const existingIndex = prospects.findIndex(p => p.linkedinUrl === prospectData.linkedinUrl);
    
    if (existingIndex === -1) {
      // Add new prospect with additional tracking data
      const newProspect = {
        ...prospectData,
        id: Date.now().toString(),
        dateAdded: new Date().toISOString(),
        contactAttempts: [],
        status: 'new',
        notes: ''
      };
      
      prospects.push(newProspect);
      stats.total += 1;
      
      chrome.storage.local.set({ prospects, stats }, () => {
        callback({ success: true, prospect: newProspect });
      });
    } else {
      // Update existing prospect
      callback({ 
        success: false, 
        error: 'Prospect already exists', 
        prospect: prospects[existingIndex] 
      });
    }
  });
}

// Get all prospects
function getProspects(callback) {
  chrome.storage.local.get(['prospects', 'stats'], (result) => {
    callback({ 
      success: true, 
      prospects: result.prospects || [], 
      stats: result.stats || { total: 0, contacted: 0, responded: 0 } 
    });
  });
}

// Update prospect
function updateProspect(prospectData, callback) {
  chrome.storage.local.get('prospects', (result) => {
    const prospects = result.prospects || [];
    const index = prospects.findIndex(p => p.id === prospectData.id);
    
    if (index !== -1) {
      prospects[index] = {
        ...prospects[index],
        ...prospectData,
        lastUpdated: new Date().toISOString()
      };
      
      chrome.storage.local.set({ prospects }, () => {
        callback({ success: true, prospect: prospects[index] });
      });
      
      // Update stats if needed
      updateStats(prospects);
    } else {
      callback({ success: false, error: 'Prospect not found' });
    }
  });
}

// Update stats based on prospect data
function updateStats(prospects) {
  const stats = {
    total: prospects.length,
    contacted: prospects.filter(p => p.contactAttempts && p.contactAttempts.length > 0).length,
    responded: prospects.filter(p => p.status === 'responded').length
  };
  
  chrome.storage.local.set({ stats });
}

// Set up alarms for email follow-ups
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('followup_')) {
    const prospectId = alarm.name.split('_')[1];
    scheduleFollowUp(prospectId);
  }
});

// Schedule follow-up emails
function scheduleFollowUp(prospectId) {
  chrome.storage.local.get('prospects', (result) => {
    const prospects = result.prospects || [];
    const index = prospects.findIndex(p => p.id === prospectId);
    
    if (index !== -1 && prospects[index].status !== 'responded') {
      const prospect = prospects[index];
      const attemptCount = prospect.contactAttempts ? prospect.contactAttempts.length : 0;
      
      if (attemptCount < 3) {
        // Add a new contact attempt
        const templateId = attemptCount === 0 ? 'initial' : 
                          attemptCount === 1 ? 'followup1' : 'followup2';
        
        // In a real implementation, this would trigger an email send
        // For now, we just log the attempt
        if (!prospect.contactAttempts) {
          prospect.contactAttempts = [];
        }
        
        prospect.contactAttempts.push({
          type: 'email',
          templateId: templateId,
          date: new Date().toISOString(),
          status: 'sent'
        });
        
        prospects[index] = prospect;
        chrome.storage.local.set({ prospects });
        
        // Schedule next follow-up if needed
        if (attemptCount < 2) {
          chrome.alarms.create(`followup_${prospectId}`, { delayInMinutes: 1440 }); // 24 hours
        }
      }
    }
  });
}