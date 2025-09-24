// Content script for LinkedIn profile scraping and interaction
// This script runs on LinkedIn pages

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeExtension);

// Global state
let isProfilePage = false;
let currentProfileData = null;

// Initialize the extension functionality
function initializeExtension() {
  // Check if we're on a LinkedIn profile page
  isProfilePage = checkIfProfilePage();
  
  if (isProfilePage) {
    // Add a small delay to ensure LinkedIn has loaded dynamic content
    setTimeout(() => {
      // Extract profile data
      currentProfileData = extractProfileData();
      
      // Add action button to profile
      addActionButton();
    }, 1500);
  }
}

// Check if the current page is a LinkedIn profile
function checkIfProfilePage() {
  return window.location.href.includes('linkedin.com/in/');
}

// Extract profile information from the page
function extractProfileData() {
  try {
    // Basic profile data
    const name = document.querySelector('.text-heading-xlarge')?.textContent.trim() || '';
    const headline = document.querySelector('.text-body-medium')?.textContent.trim() || '';
    const location = document.querySelectorAll('.text-body-small')[1]?.textContent.trim() || '';
    
    // Extract contact info if available on the page
    // Note: LinkedIn typically hides email/phone behind the contact info section
    // This is a basic implementation and may need to be enhanced
    const email = extractEmail();
    const phone = extractPhone();
    
    // Determine if they're likely a job seeker
    const isLikelyJobSeeker = checkIfJobSeeker(headline);
    
    return {
      name,
      headline,
      location,
      email,
      phone,
      linkedinUrl: window.location.href,
      isLikelyJobSeeker
    };
  } catch (error) {
    console.error('Error extracting profile data:', error);
    return null;
  }
}

// Try to extract email from the page (if visible)
function extractEmail() {
  // This is a simple implementation - emails are often not directly visible
  const pageContent = document.body.textContent;
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const matches = pageContent.match(emailRegex);
  
  return matches && matches.length > 0 ? matches[0] : '';
}

// Try to extract phone from the page (if visible)
function extractPhone() {
  // This is a simple implementation - phones are often not directly visible
  const pageContent = document.body.textContent;
  const phoneRegex = /(\+\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
  const matches = pageContent.match(phoneRegex);
  
  return matches && matches.length > 0 ? matches[0] : '';
}

// Check if the profile is likely a job seeker based on their headline/about
function checkIfJobSeeker(headline) {
  const jobSeekerKeywords = [
    'seeking', 'looking for', 'open to', 'job seeker', 
    'opportunities', 'available', 'job search',
    'in transition', 'career change', 'new opportunities'
  ];
  
  const lowercaseHeadline = headline.toLowerCase();
  
  // Check for job seeker indicators in headline
  return jobSeekerKeywords.some(keyword => lowercaseHeadline.includes(keyword));
}

// Add TheNetwrk action button to profile page
function addActionButton() {
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'netwrk-action-container';
  buttonContainer.style.margin = '20px 0';
  
  // Create button
  const actionButton = document.createElement('button');
  actionButton.className = 'netwrk-action-button';
  actionButton.textContent = 'Add to TheNetwrk';
  actionButton.style.padding = '10px 15px';
  actionButton.style.backgroundColor = '#0073b1';
  actionButton.style.color = 'white';
  actionButton.style.border = 'none';
  actionButton.style.borderRadius = '4px';
  actionButton.style.cursor = 'pointer';
  actionButton.style.fontWeight = 'bold';
  
  // Add click handler
  actionButton.addEventListener('click', handleSaveProfile);
  
  // Add button to container
  buttonContainer.appendChild(actionButton);
  
  // Find a good place to insert the button on LinkedIn profile
  const actionsSection = document.querySelector('.pv-top-card-v2-ctas');
  if (actionsSection) {
    actionsSection.appendChild(buttonContainer);
  }
}

// Handle saving a profile to our database
function handleSaveProfile() {
  if (!currentProfileData) return;
  
  // Send message to background script to save the profile
  chrome.runtime.sendMessage(
    { 
      action: 'saveProspect', 
      data: currentProfileData 
    },
    (response) => {
      if (response.success) {
        // Show success message
        showNotification('Profile saved to TheNetwrk');
        
        // In a real implementation, this is where we might prepare to send a LinkedIn message
        prepareLinkedInMessage(currentProfileData);
      } else {
        // Show error or already saved message
        showNotification(response.error || 'Error saving profile');
      }
    }
  );
}

// Show a notification to the user
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'netwrk-notification';
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.backgroundColor = '#0073b1';
  notification.style.color = 'white';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '9999';
  notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 3000);
}

// Prepare LinkedIn message - this would help user compose a message
function prepareLinkedInMessage(profileData) {
  // Find LinkedIn message button
  const messageButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => btn.textContent.trim().toLowerCase().includes('message'));
  
  if (messageButtons.length > 0) {
    // Highlight the message button
    const messageBtn = messageButtons[0];
    messageBtn.style.boxShadow = '0 0 10px 5px rgba(0,115,177,0.5)';
    
    // In a real implementation, we might:
    // 1. Auto-click the message button
    // 2. Wait for the message dialog to appear
    // 3. Fill in a template message
    
    // For now, we'll just prepare a message template that can be copied
    prepareMessageTemplate(profileData);
  }
}

// Prepare a personalized message template
function prepareMessageTemplate(profileData) {
  const firstName = profileData.name.split(' ')[0];
  
  const messageTemplate = `Hi ${firstName}, 

I noticed your profile and thought you might be interested in TheNetwrk - we help professionals find 90k+ jobs in tech through our supportive community.

Would you be open to learning more about it?

https://welcometothenetwork.xyz/

Best regards,
TheNetwrk Team`;

  // Copy message to clipboard
  navigator.clipboard.writeText(messageTemplate)
    .then(() => {
      showNotification('Message template copied to clipboard!');
    })
    .catch(err => {
      console.error('Failed to copy message:', err);
    });
}

// Listen for page navigation events
// This helps re-initialize when navigating between LinkedIn profiles
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Re-run initialization if URL changed
    initializeExtension();
  }
}).observe(document, {subtree: true, childList: true});

// Initial call
initializeExtension();