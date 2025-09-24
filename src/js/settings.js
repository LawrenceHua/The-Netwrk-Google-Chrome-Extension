// Settings script for TheNetwrk extension

// DOM elements
const templateListElement = document.getElementById('template-list');
const saveTemplatesButton = document.getElementById('save-templates');
const resetTemplatesButton = document.getElementById('reset-templates');
const emailSenderInput = document.getElementById('email-sender');
const emailNameInput = document.getElementById('email-name');
const followUpDaysInput = document.getElementById('follow-up-days');
const saveEmailSettingsButton = document.getElementById('save-email-settings');
const exportDataButton = document.getElementById('export-data');
const clearDataButton = document.getElementById('clear-data');

// Default templates
const DEFAULT_TEMPLATES = [
  {
    id: 'initial',
    name: 'Initial Contact',
    subject: 'Connecting with TheNetwrk',
    body: 'Hi {{name}}, \n\nI noticed your profile and thought you might be interested in TheNetwrk - a community helping professionals like you find 90k+ jobs in tech. \n\nWould you be open to learning more? \n\nhttps://welcometothenetwork.xyz/ \n\nBest regards,\nTheNetwrk Team'
  },
  {
    id: 'followup1',
    name: 'First Follow-up',
    subject: 'Following up: TheNetwrk Opportunity',
    body: 'Hi {{name}}, \n\nI wanted to follow up about TheNetwrk - we\'re helping professionals like you pivot into tech roles with great compensation. \n\nMany of our members have found success after struggling with traditional job applications. \n\nhttps://welcometothenetwork.xyz/ \n\nLet me know if you\'d like to connect!\n\nBest,\nTheNetwrk Team'
  },
  {
    id: 'followup2',
    name: 'Final Follow-up',
    subject: 'Last chance: Join TheNetwrk community',
    body: 'Hi {{name}}, \n\nThis is my final note about TheNetwrk. We\'re building a supportive community focused on helping professionals like you land $90k+ tech jobs. \n\nIf you\'re interested in real accountability and ending the cycle of online applications, check us out: \n\nhttps://welcometothenetwork.xyz/ \n\nAll the best in your career journey,\nTheNetwrk Team'
  }
];

// Default email settings
const DEFAULT_EMAIL_SETTINGS = {
  senderEmail: '',
  senderName: 'TheNetwrk Team',
  followUpDays: 1
};

// Current state
let currentTemplates = [];
let emailSettings = { ...DEFAULT_EMAIL_SETTINGS };

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeSettings);

// Initialize settings page
function initializeSettings() {
  loadSettings();
  setupEventListeners();
}

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get('settings', (result) => {
    const settings = result.settings || {};
    
    // Load message templates
    currentTemplates = settings.messageTemplates || [...DEFAULT_TEMPLATES];
    renderTemplates(currentTemplates);
    
    // Load email settings
    emailSettings = settings.emailSettings || { ...DEFAULT_EMAIL_SETTINGS };
    emailSenderInput.value = emailSettings.senderEmail || '';
    emailNameInput.value = emailSettings.senderName || 'TheNetwrk Team';
    followUpDaysInput.value = emailSettings.followUpDays || 1;
  });
}

// Render templates to the UI
function renderTemplates(templates) {
  // Clear existing templates
  templateListElement.innerHTML = '';
  
  // Render each template
  templates.forEach((template, index) => {
    const templateItem = document.createElement('div');
    templateItem.className = 'template-item';
    
    templateItem.innerHTML = `
      <div class="template-header">
        <span class="template-name">${template.name}</span>
        <div class="template-controls">
          <button class="icon-button move-up-button" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-button move-down-button" data-index="${index}" ${index === templates.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
      </div>
      <div class="template-content">
        <div class="field-row">
          <label for="template-id-${index}">Template ID</label>
          <input type="text" id="template-id-${index}" value="${template.id}" readonly>
        </div>
        <div class="field-row">
          <label for="template-name-${index}">Name</label>
          <input type="text" id="template-name-${index}" value="${template.name}">
        </div>
        <div class="field-row">
          <label for="template-subject-${index}">Subject Line</label>
          <input type="text" id="template-subject-${index}" value="${template.subject}">
        </div>
        <div class="field-row">
          <label for="template-body-${index}">Message Body</label>
          <textarea id="template-body-${index}">${template.body}</textarea>
        </div>
      </div>
    `;
    
    templateListElement.appendChild(templateItem);
  });
  
  // Add event listeners to move buttons
  setupMoveButtons();
}

// Set up move up/down buttons
function setupMoveButtons() {
  // Move up buttons
  document.querySelectorAll('.move-up-button').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      if (index > 0) {
        // Swap with previous template
        [currentTemplates[index], currentTemplates[index - 1]] = 
        [currentTemplates[index - 1], currentTemplates[index]];
        renderTemplates(currentTemplates);
      }
    });
  });
  
  // Move down buttons
  document.querySelectorAll('.move-down-button').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      if (index < currentTemplates.length - 1) {
        // Swap with next template
        [currentTemplates[index], currentTemplates[index + 1]] = 
        [currentTemplates[index + 1], currentTemplates[index]];
        renderTemplates(currentTemplates);
      }
    });
  });
}

// Save templates from UI inputs
function saveTemplatesFromInputs() {
  const updatedTemplates = [];
  
  // Get values from each template form
  for (let i = 0; i < currentTemplates.length; i++) {
    const id = document.getElementById(`template-id-${i}`).value;
    const name = document.getElementById(`template-name-${i}`).value;
    const subject = document.getElementById(`template-subject-${i}`).value;
    const body = document.getElementById(`template-body-${i}`).value;
    
    updatedTemplates.push({ id, name, subject, body });
  }
  
  // Update current templates
  currentTemplates = updatedTemplates;
  
  // Save to storage
  saveTemplates(currentTemplates);
}

// Save templates to storage
function saveTemplates(templates) {
  chrome.storage.local.get('settings', (result) => {
    const settings = result.settings || {};
    settings.messageTemplates = templates;
    
    chrome.storage.local.set({ settings }, () => {
      showAlert('Templates saved successfully!', 'success');
    });
  });
}

// Save email settings from form inputs
function saveEmailSettingsFromInputs() {
  const updatedSettings = {
    senderEmail: emailSenderInput.value,
    senderName: emailNameInput.value,
    followUpDays: parseInt(followUpDaysInput.value) || 1
  };
  
  // Update current settings
  emailSettings = updatedSettings;
  
  // Save to storage
  saveEmailSettings(emailSettings);
}

// Save email settings to storage
function saveEmailSettings(settings) {
  chrome.storage.local.get('settings', (result) => {
    const existingSettings = result.settings || {};
    existingSettings.emailSettings = settings;
    
    chrome.storage.local.set({ settings: existingSettings }, () => {
      showAlert('Email settings saved successfully!', 'success');
    });
  });
}

// Reset templates to default
function resetTemplatesToDefault() {
  if (confirm('Are you sure you want to reset all templates to default?')) {
    currentTemplates = [...DEFAULT_TEMPLATES];
    renderTemplates(currentTemplates);
    saveTemplates(currentTemplates);
  }
}

// Export all data as JSON file
function exportAllData() {
  chrome.storage.local.get(null, (data) => {
    // Convert data to JSON string
    const jsonString = JSON.stringify(data, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'TheNetwrk_Data_' + new Date().toISOString().split('T')[0] + '.json';
    
    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    showAlert('Data exported successfully!', 'success');
  });
}

// Clear all data
function clearAllData() {
  if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    if (confirm('This will delete all prospects and settings. Are you REALLY sure?')) {
      chrome.storage.local.clear(() => {
        showAlert('All data cleared! Reloading page...', 'success');
        
        // Reload page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      });
    }
  }
}

// Show alert message
function showAlert(message, type = 'success') {
  // Check if alert already exists and remove it
  const existingAlert = document.querySelector('.alert');
  if (existingAlert) {
    existingAlert.remove();
  }
  
  // Create alert element
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type}`;
  alertElement.textContent = message;
  
  // Add to page before the first section
  const firstSection = document.querySelector('.settings-section');
  if (firstSection) {
    firstSection.parentNode.insertBefore(alertElement, firstSection);
  }
  
  // Remove after delay
  setTimeout(() => {
    alertElement.style.opacity = '0';
    alertElement.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      if (alertElement.parentNode) {
        alertElement.parentNode.removeChild(alertElement);
      }
    }, 500);
  }, 3000);
}

// Set up event listeners
function setupEventListeners() {
  // Save templates button
  saveTemplatesButton.addEventListener('click', () => {
    saveTemplatesFromInputs();
  });
  
  // Reset templates button
  resetTemplatesButton.addEventListener('click', () => {
    resetTemplatesToDefault();
  });
  
  // Save email settings button
  saveEmailSettingsButton.addEventListener('click', () => {
    saveEmailSettingsFromInputs();
  });
  
  // Export data button
  exportDataButton.addEventListener('click', () => {
    exportAllData();
  });
  
  // Clear data button
  clearDataButton.addEventListener('click', () => {
    clearAllData();
  });
}

// Initialize the page
initializeSettings();