// Popup script for TheNetwrk extension

// DOM elements
const totalProspectsElement = document.getElementById('total-prospects');
const contactedElement = document.getElementById('contacted');
const respondedElement = document.getElementById('responded');
const profileDataElement = document.getElementById('profile-data');
const viewDashboardButton = document.getElementById('view-dashboard');
const settingsButton = document.getElementById('settings');

// Initialize the popup
document.addEventListener('DOMContentLoaded', initializePopup);

// Initialize popup content
function initializePopup() {
  // Load statistics
  loadStats();
  
  // Check current tab for LinkedIn profile
  checkCurrentTab();
  
  // Set up button listeners
  setupButtonListeners();
}

// Load statistics from storage
function loadStats() {
  chrome.storage.local.get('stats', (result) => {
    const stats = result.stats || { total: 0, contacted: 0, responded: 0 };
    
    totalProspectsElement.textContent = stats.total;
    contactedElement.textContent = stats.contacted;
    respondedElement.textContent = stats.responded;
  });
}

// Check if current tab is a LinkedIn profile
function checkCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    // Check if we're on LinkedIn
    if (currentTab.url.includes('linkedin.com/in/')) {
      // Get profile data from content script
      chrome.tabs.sendMessage(
        currentTab.id, 
        { action: 'getProfileData' },
        (response) => {
          if (response && response.profileData) {
            displayProfileData(response.profileData);
          } else {
            displayEmptyProfileState();
          }
        }
      );
    } else {
      displayEmptyProfileState('Navigate to a LinkedIn profile');
    }
  });
}

// Display profile data in the popup
function displayProfileData(profileData) {
  profileDataElement.innerHTML = '';
  
  // Create profile display
  const fields = [
    { label: 'Name', value: profileData.name },
    { label: 'Headline', value: profileData.headline },
    { label: 'Location', value: profileData.location },
    { label: 'Email', value: profileData.email || 'Not available' },
    { label: 'Likely Job Seeker', value: profileData.isLikelyJobSeeker ? 'Yes' : 'Maybe' }
  ];
  
  fields.forEach(field => {
    const fieldElement = document.createElement('div');
    fieldElement.className = 'profile-field';
    
    const labelElement = document.createElement('div');
    labelElement.className = 'field-label';
    labelElement.textContent = field.label;
    
    const valueElement = document.createElement('div');
    valueElement.className = 'field-value';
    valueElement.textContent = field.value;
    
    fieldElement.appendChild(labelElement);
    fieldElement.appendChild(valueElement);
    profileDataElement.appendChild(fieldElement);
  });
  
  // Add action button
  const actionButton = document.createElement('button');
  actionButton.className = 'primary-button';
  actionButton.style.width = '100%';
  actionButton.style.marginTop = '10px';
  actionButton.textContent = 'Add to Prospects';
  actionButton.addEventListener('click', () => saveCurrentProfile(profileData));
  
  profileDataElement.appendChild(actionButton);
}

// Display empty state message
function displayEmptyProfileState(message = 'No LinkedIn profile detected') {
  profileDataElement.innerHTML = `<p class="empty-state">${message}</p>`;
}

// Save the current profile to prospects
function saveCurrentProfile(profileData) {
  chrome.runtime.sendMessage(
    { action: 'saveProspect', data: profileData },
    (response) => {
      if (response.success) {
        const successMsg = document.createElement('p');
        successMsg.textContent = 'Profile added successfully!';
        successMsg.style.color = 'green';
        successMsg.style.textAlign = 'center';
        successMsg.style.marginTop = '10px';
        
        profileDataElement.appendChild(successMsg);
        
        // Update stats
        loadStats();
      } else {
        const errorMsg = document.createElement('p');
        errorMsg.textContent = response.error || 'Error adding profile';
        errorMsg.style.color = 'red';
        errorMsg.style.textAlign = 'center';
        errorMsg.style.marginTop = '10px';
        
        profileDataElement.appendChild(errorMsg);
      }
    }
  );
}

// Set up button event listeners
function setupButtonListeners() {
  // Open dashboard in new tab
  viewDashboardButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/dashboard.html') });
  });
  
  // Open settings in new tab
  settingsButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/settings.html') });
  });
}