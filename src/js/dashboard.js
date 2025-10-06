// Dashboard script for TheNetwrk extension

// DOM elements
const totalProspectsElement = document.getElementById('total-prospects');
const contactedCountElement = document.getElementById('contacted-count');
const respondedCountElement = document.getElementById('responded-count');
const conversionRateElement = document.getElementById('conversion-rate');
const prospectsTableBody = document.getElementById('prospects-table-body');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const statusFilter = document.getElementById('status-filter');
const clearFiltersButton = document.getElementById('clear-filters');
const refreshDataButton = document.getElementById('refresh-data');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const paginationInfo = document.getElementById('pagination-info');
const prospectModal = document.getElementById('prospect-modal');
const prospectDetailContent = document.getElementById('prospect-detail-content');
// Send message button removed - messaging now handled via bulk operations
const sendToAllEmailsButton = document.getElementById('send-to-all-emails');
const sendToAllLinkedInButton = document.getElementById('send-to-all-linkedin');

// State management
let allProspects = [];
let filteredProspects = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentSort = { field: 'id', direction: 'asc' }; // Show in order added (1, 2, 3, 4...)
let selectedProspect = null;

// Email Preview Modal System
let emailCampaignData = [];
let selectedRecipientIndex = -1;

function openEmailPreviewModal(prospectsWithEmails) {
  console.log('📧 Opening email preview modal for', prospectsWithEmails.length, 'prospects');
  
  // Initialize campaign data with default sender name
  emailCampaignData = prospectsWithEmails.map((prospect, index) => ({
    id: prospect.id,
    name: prospect.name,
    email: prospect.email,
    prospect: prospect,
    subject: generateEmailSubject(prospect),
    message: generatePersonalizedMessage(prospect, 'Lawrence'),
    status: 'pending', // pending, ready, sent
    index: index,
    senderName: 'Lawrence'
  }));
  
  // Update campaign stats
  updateCampaignStats();
  
  // Populate recipients list
  populateRecipientsList();
  
  // Show modal
  const modal = document.getElementById('email-preview-modal');
  modal.style.display = 'block';
  
  // Set up event listeners
  setupEmailModalEventListeners();
}

function updateCampaignStats() {
  const total = emailCampaignData.length;
  const ready = emailCampaignData.filter(e => e.status === 'ready').length;
  const pending = emailCampaignData.filter(e => e.status === 'pending').length;
  
  document.getElementById('email-count-total').textContent = total;
  document.getElementById('email-count-ready').textContent = ready;
  document.getElementById('email-count-pending').textContent = pending;
  
  // Update send button state
  const sendButton = document.getElementById('send-all-emails-btn');
  sendButton.disabled = ready === 0;
  sendButton.innerHTML = ready > 0 ? `📧 Send ${ready} Ready Emails` : '📧 No Emails Ready';
}

function populateRecipientsList() {
  const listContainer = document.getElementById('email-recipients-list');
  listContainer.innerHTML = '';
  
  emailCampaignData.forEach((emailData, index) => {
    const recipientItem = document.createElement('div');
    recipientItem.className = `recipient-item ${emailData.status}`;
    recipientItem.dataset.index = index;
    
    recipientItem.innerHTML = `
      <div class="recipient-name">${emailData.name}</div>
      <div class="recipient-email">${emailData.email}</div>
      <div class="recipient-status status-${emailData.status}">${emailData.status}</div>
    `;
    
    recipientItem.addEventListener('click', () => selectRecipient(index));
    listContainer.appendChild(recipientItem);
  });
}

function selectRecipient(index) {
  selectedRecipientIndex = index;
  
  // Update UI selection
  document.querySelectorAll('.recipient-item').forEach(item => {
    item.classList.remove('selected');
  });
  document.querySelector(`[data-index="${index}"]`).classList.add('selected');
  
  // Load email editor
  loadEmailEditor(emailCampaignData[index]);
}

function loadEmailEditor(emailData) {
  const editorContent = document.getElementById('email-editor-content');
  
  editorContent.innerHTML = `
    <div class="email-form">
      <div class="form-group">
        <label class="form-label">To</label>
        <input type="email" class="form-input" value="${emailData.email}" readonly>
      </div>
      
      <div class="form-group">
        <label class="form-label">Subject</label>
        <input type="text" class="form-input" id="email-subject-${emailData.index}" value="${emailData.subject}">
      </div>
      
      <div class="form-group">
        <label class="form-label">Message</label>
        <textarea class="form-textarea" id="email-message-${emailData.index}">${emailData.message}</textarea>
      </div>
      
      <div class="email-actions">
        <button class="btn-success btn-small" id="mark-ready-btn-${emailData.index}">
          ✅ Mark as Ready
        </button>
        <button class="btn-warning btn-small" id="send-now-btn-${emailData.index}">
          📧 Send Now
        </button>
      </div>
    </div>
  `;
  
  // Add input listeners to save changes
  document.getElementById(`email-subject-${emailData.index}`).addEventListener('input', (e) => {
    emailCampaignData[emailData.index].subject = e.target.value;
  });
  
  document.getElementById(`email-message-${emailData.index}`).addEventListener('input', (e) => {
    emailCampaignData[emailData.index].message = e.target.value;
  });
  
  // Add button event listeners
  document.getElementById(`mark-ready-btn-${emailData.index}`).addEventListener('click', () => {
    markEmailReady(emailData.index);
  });
  
  document.getElementById(`send-now-btn-${emailData.index}`).addEventListener('click', () => {
    sendSingleEmail(emailData.index);
  });
}

function markEmailReady(index) {
  emailCampaignData[index].status = 'ready';
  updateCampaignStats();
  populateRecipientsList();
  showSuccess(`Email for ${emailCampaignData[index].name} marked as ready!`);
}

function generateEmailSubject(prospect) {
  const subjects = [
    `Hi ${prospect.name?.split(' ')[0]}, interested in joining TheNetwrk?`,
    `${prospect.name?.split(' ')[0]}, let's accelerate your tech career`,
    `Exclusive invite for ${prospect.name?.split(' ')[0]} - TheNetwrk Community`,
    `${prospect.name?.split(' ')[0]}, join 1000+ job seekers in TheNetwrk`
  ];
  
  return subjects[Math.floor(Math.random() * subjects.length)];
}

function generatePersonalizedMessage(prospect, senderName = 'Lawrence') {
  const firstName = prospect.name?.split(' ')[0] || 'there';
  const skills = Array.isArray(prospect.skills) ? prospect.skills.slice(0, 3).join(', ') : '';
  const experience = Array.isArray(prospect.experiences) && prospect.experiences.length > 0 
    ? prospect.experiences[0].title || 'your background' 
    : 'your background';
  
  return `Hi ${firstName},

I came across your LinkedIn profile and was impressed by your ${experience}${skills ? ` and expertise in ${skills}` : ''}. 

I wanted to reach out because you seem like exactly the type of driven professional who would thrive in TheNetwrk - our exclusive community for ambitious job seekers breaking into tech.

Here's what makes TheNetwrk different:

🎯 Weekly 1:1 coaching sessions with our founder Abigayle
🤝 Access to the most supportive job seeker community 
🚀 Direct pipeline to opportunities at well-funded startups
💡 Proven strategies that have helped members land 8+ job offers

We've helped thousands of professionals like you land their dream tech roles, and I believe you'd be a perfect fit.

Interested in learning more? I'd love to get you on our waitlist.

Best regards,
${senderName}
TheNetwrk Community

P.S. If you're actively job searching, this could be exactly what you need to stand out and land interviews faster.`;
}

function setupEmailModalEventListeners() {
  // Close modal
  document.getElementById('close-email-modal').addEventListener('click', closeEmailModal);
  
  // Send all emails button
  document.getElementById('send-all-emails-btn').addEventListener('click', sendAllReadyEmails);
  
  // Save all drafts button
  document.getElementById('save-all-drafts-btn').addEventListener('click', saveAllDrafts);
  
  // Sender name change listener
  document.getElementById('sender-name-input').addEventListener('input', (e) => {
    updateAllMessagesSenderName(e.target.value);
  });
  
  // Close modal when clicking outside
  document.getElementById('email-preview-modal').addEventListener('click', (e) => {
    if (e.target.id === 'email-preview-modal') {
      closeEmailModal();
    }
  });
}

function updateAllMessagesSenderName(newSenderName) {
  // Update all email messages with new sender name
  emailCampaignData.forEach((emailData, index) => {
    emailData.senderName = newSenderName;
    emailData.message = generatePersonalizedMessage(emailData.prospect, newSenderName);
  });
  
  // If an email is currently selected, refresh the editor
  if (selectedRecipientIndex >= 0) {
    loadEmailEditor(emailCampaignData[selectedRecipientIndex]);
  }
}

function closeEmailModal() {
  document.getElementById('email-preview-modal').style.display = 'none';
  emailCampaignData = [];
  selectedRecipientIndex = -1;
}

async function sendSingleEmail(index) {
  const emailData = emailCampaignData[index];
  const senderName = document.getElementById('sender-name-input')?.value || 'Lawrence';
  
  try {
    console.log('📧 Sending single email to:', emailData.email);
    console.log('👤 From:', senderName);
    
    const response = await fetch('http://localhost:3000/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: emailData.email,
        subject: emailData.subject,
        message: emailData.message,
        name: emailData.name,
        senderName: senderName,
        profileData: emailData.prospect
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      emailData.status = 'sent';
      
      // Update prospect status
      chrome.runtime.sendMessage({
        action: 'updateProspect',
        data: { id: emailData.prospect.id, status: 'contacted' }
      });
      
      showSuccess(`Email sent successfully to ${emailData.name}!`);
      updateCampaignStats();
      populateRecipientsList();
    } else {
      throw new Error(result.error || 'Failed to send email');
    }
    
  } catch (error) {
    console.error('Error sending email:', error);
    showError(`Failed to send email to ${emailData.name}: ${error.message}`);
  }
}

async function sendAllReadyEmails() {
  const readyEmails = emailCampaignData.filter(e => e.status === 'ready');
  const senderName = document.getElementById('sender-name-input')?.value || 'Lawrence';
  
  if (readyEmails.length === 0) {
    showError('No emails marked as ready to send.');
    return;
  }
  
  if (!confirm(`Send ${readyEmails.length} emails now from ${senderName}?`)) {
    return;
  }
  
  const sendButton = document.getElementById('send-all-emails-btn');
  sendButton.disabled = true;
  sendButton.innerHTML = `📧 Sending... (0/${readyEmails.length})`;
  
  let sentCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < readyEmails.length; i++) {
    const emailData = readyEmails[i];
    
    try {
      const response = await fetch('http://localhost:3000/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: emailData.email,
          subject: emailData.subject,
          message: emailData.message,
          name: emailData.name,
          senderName: senderName,
          profileData: emailData.prospect
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        emailData.status = 'sent';
        sentCount++;
        
        // Update prospect status
        chrome.runtime.sendMessage({
          action: 'updateProspect',
          data: { id: emailData.prospect.id, status: 'contacted' }
        });
      } else {
        failedCount++;
        console.error('Failed to send email to', emailData.name, ':', result.error);
      }
      
    } catch (error) {
      failedCount++;
      console.error('Error sending email to', emailData.name, ':', error);
    }
    
    // Update progress
    sendButton.innerHTML = `📧 Sending... (${sentCount + failedCount}/${readyEmails.length})`;
    
    // Small delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final update
  updateCampaignStats();
  populateRecipientsList();
  
  sendButton.disabled = false;
  sendButton.innerHTML = `📧 Send Ready Emails`;
  
  if (sentCount > 0) {
    showSuccess(`Campaign completed! Sent: ${sentCount}, Failed: ${failedCount}`);
  } else {
    showError(`Campaign failed. Sent: ${sentCount}, Failed: ${failedCount}`);
  }
}

function saveAllDrafts() {
  // Save current email data to local storage for later
  chrome.storage.local.set({ 
    emailDrafts: emailCampaignData.map(e => ({
      name: e.name,
      email: e.email,
      subject: e.subject,
      message: e.message,
      status: e.status,
      prospectId: e.id
    }))
  }, () => {
    showSuccess(`Saved ${emailCampaignData.length} email drafts for later!`);
  });
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Initialize the dashboard
function initializeDashboard() {
  console.log('🚀 TheNetwrk Dashboard: Initializing...');
  console.log('🚀 Dashboard: URL:', window.location.href);
  console.log('🚀 Dashboard: DOM ready, elements found:', {
    totalProspectsElement: !!totalProspectsElement,
    prospectsTableBody: !!prospectsTableBody,
    refreshDataButton: !!refreshDataButton
  });
  
  loadProspects();
  setupEventListeners();
  setupStorageListener();
}

// Set up storage listener for real-time updates
function setupStorageListener() {
  // Listen for storage changes to update dashboard in real-time
  chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log(`\n🔄🔄🔄 DASHBOARD: STORAGE CHANGE DETECTED 🔄🔄🔄`);
    console.log(`🔄 Namespace: ${namespace}`);
    console.log(`🔄 Changed keys:`, Object.keys(changes));
    console.log(`🔄 Time: ${new Date().toLocaleString()}`);
    
    if (namespace === 'local' && changes.prospects) {
      const oldCount = changes.prospects.oldValue?.length || 0;
      const newCount = changes.prospects.newValue?.length || 0;
      
      console.log(`📊📊📊 PROSPECTS STORAGE UPDATE:`);
      console.log(`📊 Old count: ${oldCount}`);
      console.log(`📊 New count: ${newCount}`);
      
      if (newCount > oldCount) {
        console.log(`📈📈📈 ${newCount - oldCount} NEW PROSPECTS ADDED!`);
      }
      
      // Check if any prospects were updated (not just added)
      if (oldCount === newCount && oldCount > 0) {
        console.log(`🔄🔄🔄 PROSPECTS UPDATED (SAME COUNT) - CHECKING FOR AI UPDATES...`);
        const oldProspects = changes.prospects.oldValue || [];
        const newProspects = changes.prospects.newValue || [];
        
        console.log(`🔄 Comparing ${oldProspects.length} old vs ${newProspects.length} new prospects...`);
        
        for (let i = 0; i < newProspects.length; i++) {
          const oldP = oldProspects[i];
          const newP = newProspects[i];
          
          if (oldP && newP && oldP.id === newP.id) {
            const hasChanges = (
              oldP.jobSeekerScore !== newP.jobSeekerScore ||
              oldP.careerStage !== newP.careerStage ||
              oldP.summary !== newP.summary ||
              oldP.hasAIAnalysis !== newP.hasAIAnalysis ||
              oldP.headline !== newP.headline ||
              oldP.email !== newP.email
            );
            
            if (hasChanges) {
              console.log(`🤖🤖🤖 PROSPECT ${newP.name} RECEIVED AI UPDATE:`);
              console.log(`🤖 Job Seeker Score: ${oldP.jobSeekerScore} → ${newP.jobSeekerScore}`);
              console.log(`🤖 Career Stage: ${oldP.careerStage} → ${newP.careerStage}`);
              console.log(`🤖 Headline: ${oldP.headline} → ${newP.headline}`);
              console.log(`🤖 Email: ${oldP.email} → ${newP.email}`);
              console.log(`🤖 Has AI Analysis: ${oldP.hasAIAnalysis} → ${newP.hasAIAnalysis}`);
            }
          }
        }
      }
      
      console.log(`🔄🔄🔄 REFRESHING DASHBOARD WITH UPDATED DATA...`);
      loadProspects();
    }
  });
  
  // Listen for messages from content script about analysis completion
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'pageAnalysisComplete') {
      console.log('TheNetwrk Dashboard: Page analysis complete, refreshing...');
      setTimeout(() => {
        loadProspects();
      }, 2000); // Wait a bit for all updates to complete
    }
  });
}

// Load prospects from storage
function loadProspects() {
  console.log('TheNetwrk Dashboard: Loading prospects...');
  
  // Check if chrome.runtime is available
  if (!chrome || !chrome.runtime) {
    console.error('TheNetwrk Dashboard: Chrome runtime not available');
    showError('Chrome extension APIs not available. Please reload the page.');
    return;
  }
  
  chrome.runtime.sendMessage({ action: 'getProspects' }, (response) => {
    console.log('🔍 Dashboard: Received response:', response);
    
    if (chrome.runtime.lastError) {
      console.error('❌ Dashboard: Runtime error:', chrome.runtime.lastError);
      showError('Extension communication error: ' + chrome.runtime.lastError.message);
      return;
    }
    
    if (response && response.success) {
      console.log(`📊 Dashboard: Loaded ${response.prospects.length} prospects`);
      
      // Debug: Log all prospect IDs and names
      console.log('🔍 Dashboard: All prospects:', response.prospects.map(p => ({
        id: p.id,
        name: p.name,
        dateAdded: p.dateAdded,
        source: p.source
      })));
      
      allProspects = response.prospects || [];
      
      // Sort by ID to ensure chronological order (1, 2, 3, 4...)
      allProspects.sort((a, b) => a.id.localeCompare(b.id));
      
      console.log(`📊 Dashboard: Loaded ${allProspects.length} prospects in chronological order`);
      console.log(`📊 Dashboard: First 5 prospects:`, allProspects.slice(0, 5).map((p, idx) => `${idx + 1}. ${p.name}`));
      
      updateStats(response.stats || { total: 0, contacted: 0, responded: 0 });
      applyFiltersAndSort();
    } else {
      console.error('❌ Dashboard: Failed to load prospects:', response);
      showError('Failed to load prospects: ' + (response?.error || 'Unknown error'));
    }
  });
}

// Update statistics
function updateStats(stats) {
  // Use actual prospect count instead of potentially outdated stats
  const actualTotal = allProspects.length;
  const actualContacted = allProspects.filter(p => p.status === 'contacted' || p.status === 'responded').length;
  const actualResponded = allProspects.filter(p => p.status === 'responded').length;
  const actualMembers = allProspects.filter(p => p.status === 'member').length;
  const withEmails = allProspects.filter(p => p.email && p.email !== 'Not available' && p.email !== '' && p.email !== null).length;
  
  totalProspectsElement.textContent = actualTotal;
  contactedCountElement.textContent = actualContacted;
  respondedCountElement.textContent = actualResponded;
  
  // Calculate conversion rate based on members (not just responded)
  const conversionRate = actualTotal > 0 
    ? Math.round((actualMembers / actualTotal) * 100) 
    : 0;
  conversionRateElement.textContent = `${conversionRate}%`;
  
  // Update bulk email button text and state
  const emailAllButton = document.getElementById('send-to-all-emails');
  if (emailAllButton) {
    emailAllButton.innerHTML = `📧 Email All (${withEmails})`;
    emailAllButton.disabled = withEmails === 0;
    if (withEmails === 0) {
      emailAllButton.title = 'No prospects with email addresses found';
      emailAllButton.style.opacity = '0.5';
    } else {
      emailAllButton.title = `Preview and send personalized emails to ${withEmails} prospects`;
      emailAllButton.style.opacity = '1';
    }
  }
  
  console.log('TheNetwrk Dashboard: Updated stats - Total:', actualTotal, 'Contacted:', actualContacted, 'Responded:', actualResponded, 'Members:', actualMembers, 'With Emails:', withEmails);
}

// Apply filters and sorting to prospects
function applyFiltersAndSort() {
  const searchTerm = searchInput.value.toLowerCase();
  const statusValue = statusFilter.value;
  
  // Filter prospects
  filteredProspects = allProspects.filter(prospect => {
    // Ensure we have the basic fields, with fallbacks
    const name = prospect.name || '';
    const headline = prospect.headline || '';
    const location = prospect.location || '';
    const email = prospect.email || '';
    
    // Search term filter
    const matchesSearch = 
      name.toLowerCase().includes(searchTerm) ||
      headline.toLowerCase().includes(searchTerm) ||
      location.toLowerCase().includes(searchTerm) ||
      email.toLowerCase().includes(searchTerm);
    
    // Status filter
    const matchesStatus = statusValue === 'all' || prospect.status === statusValue;
    
    return matchesSearch && matchesStatus;
  });
  
  // Sort prospects
  filteredProspects.sort((a, b) => {
    let valueA = a[currentSort.field];
    let valueB = b[currentSort.field];
    
    // Handle special cases for sorting
    if (currentSort.field === 'contactAttempts') {
      valueA = a.contactAttempts ? a.contactAttempts.length : 0;
      valueB = b.contactAttempts ? b.contactAttempts.length : 0;
    }
    
    // Handle dates
    if (currentSort.field === 'dateAdded') {
      valueA = new Date(valueA).getTime();
      valueB = new Date(valueB).getTime();
    }
    
    // Compare values based on sort direction
    if (currentSort.direction === 'asc') {
      return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
    } else {
      return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
    }
  });
  
  // Reset to first page when filters change
  currentPage = 1;
  
  // Update UI
  renderProspects();
  updatePagination();
}

// Render prospects to the table
function renderProspects() {
  console.log('🔍 Dashboard: Rendering prospects...');
  console.log(`📊 Dashboard: Total prospects: ${allProspects.length}`);
  console.log(`📊 Dashboard: Filtered prospects: ${filteredProspects.length}`);
  console.log(`📊 Dashboard: Current page: ${currentPage}`);
  console.log(`📊 Dashboard: Items per page: ${itemsPerPage}`);
  
  // Clear existing rows
  prospectsTableBody.innerHTML = '';
  
  // Calculate page bounds
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredProspects.length);
  
  console.log(`📊 Dashboard: Showing items ${startIndex + 1}-${endIndex} of ${filteredProspects.length}`);
  console.log(`📊 Dashboard: First few prospects:`, filteredProspects.slice(0, 3).map(p => p.name));
  
  // Show empty message if no prospects
  if (filteredProspects.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.className = 'empty-row';
    emptyRow.innerHTML = '<td colspan="7" class="empty-message">No prospects found matching your filters.</td>';
    prospectsTableBody.appendChild(emptyRow);
    return;
  }
  
  // Render each prospect in the current page
  for (let i = startIndex; i < endIndex; i++) {
    const prospect = filteredProspects[i];
    const row = document.createElement('tr');
    
    // Format data for display
    const dateAdded = new Date(prospect.dateAdded).toLocaleString(); // Include time
    const status = formatStatus(prospect.status);
    
    // Format AI insights for display with safe null checks
    const jobSeekerConfidence = (prospect.jobSeekerScore && typeof prospect.jobSeekerScore === 'number') ? 
      `${prospect.jobSeekerScore}%` : (prospect.needsResearch ? '🔍 Needs Research' : '-');
    
    const careerStage = prospect.careerStage || (prospect.needsResearch ? '🔍 Needs Research' : '-');
    
    const techInterest = prospect.techBackground || (prospect.needsResearch ? '🔍 Needs Research' : '-');
    
    const aiSummary = (prospect.summary && typeof prospect.summary === 'string') ? 
      (prospect.summary.length > 60 ? prospect.summary.substring(0, 60) + '...' : prospect.summary) : 
      (prospect.needsResearch ? '🔍 Awaiting deep research' : '-');
    
    // Create clickable row (no action buttons)
    row.style.cursor = 'pointer';
    row.className = 'prospect-row';
    row.setAttribute('data-prospect-id', prospect.id);
    
    // Clean the headline for display
    let cleanHeadline = prospect.headline || (prospect.needsResearch ? '🔍 Headline not captured yet' : 'No headline');
    if (cleanHeadline && !cleanHeadline.includes('🔍') && cleanHeadline !== 'No headline') {
      cleanHeadline = cleanHeadline
        .replace(/\s*·\s*/g, ' · ') // Fix spacing around bullets
        .replace(/\d+(st|nd|rd|th)\+?\s*degree connection/gi, '') // Remove degree connection
        .replace(/2nd2nd/gi, '2nd') // Fix duplicate degree text
        .replace(/3rd3rd/gi, '3rd') // Fix duplicate degree text
        .replace(/\s+/g, ' ') // Fix multiple spaces
        .trim();
    }
    
    // Add visual indicator for research status
    const nameClass = prospect.needsResearch ? 'needs-research' : 'researched';
    const keywordInfo = prospect.keyword ? `<br><span class="keyword-tag">Found via: ${prospect.keyword}</span>` : '';
    
    // Check if prospect has email address
    const hasEmail = (prospect.email && prospect.email.trim()) ||
                     (prospect.activityEmails && prospect.activityEmails.length > 0) ||
                     (prospect.googleEmails && prospect.googleEmails.length > 0);
    const emailIndicator = hasEmail ? 
      `<br><span class="email-indicator found">📧 Email Found</span>` : 
      `<br><span class="email-indicator missing">❌ No Email</span>`;
    
    row.innerHTML = `
      <td class="${nameClass}">
        <strong>${prospect.name || 'Unknown'}</strong>
        <br><small class="headline">${cleanHeadline}</small>
        ${keywordInfo}
        ${emailIndicator}
      </td>
      <td>${jobSeekerConfidence}</td>
      <td>${careerStage}</td>
      <td>${techInterest}</td>
      <td>${aiSummary}</td>
      <td>${status}</td>
      <td><small>${dateAdded}</small></td>
    `;
    
    // Make entire row clickable to show prospect details
    row.addEventListener('click', () => {
      openProspectDetail(prospect.id);
    });
    
    prospectsTableBody.appendChild(row);
  }
  
  // Rows are now clickable - no action buttons needed
}

// Format status for display
function formatStatus(status) {
  switch(status) {
    case 'new': return '<span style="color: blue;">New</span>';
    case 'contacted': return '<span style="color: orange;">Contacted</span>';
    case 'responded': return '<span style="color: green;">Responded</span>';
    case 'member': return '<span style="color: #28a745; font-weight: bold;">Member ⭐</span>';
    case 'not-interested': return '<span style="color: red;">Not Interested</span>';
    default: return status;
  }
}

// Highlight job seeker keywords in headlines
function highlightJobSeekerKeywords(headline) {
  if (!headline || headline === '-') return headline;
  
  const jobSeekerKeywords = [
    'seeking', 'looking for', 'open to work', 'job seeker', 'actively looking',
    'available for', 'job search', 'seeking opportunities', 'seeking role',
    'seeking position', 'open to opportunities', 'exploring opportunities',
    'recent graduate', 'new grad', 'entry level', 'junior', 'career change',
    'transitioning', 'breaking into', 'bootcamp graduate', 'self-taught',
    'aspiring', 'future', 'upcoming', 'trainee', 'intern', 'unemployed',
    'between roles', 'laid off', 'ready for new', 'open to new'
  ];
  
  let highlightedHeadline = headline;
  let hasJobSeekerKeywords = false;
  
  // Check if any job seeker keywords are present
  const lowerHeadline = headline.toLowerCase();
  for (const keyword of jobSeekerKeywords) {
    if (lowerHeadline.includes(keyword.toLowerCase())) {
      hasJobSeekerKeywords = true;
      // Highlight the keyword with a span
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlightedHeadline = highlightedHeadline.replace(regex, '<strong style="color: #28a745; background: #e8f5e8; padding: 2px 4px; border-radius: 3px;">$1</strong>');
    }
  }
  
  // If it contains job seeker keywords, wrap the whole headline
  if (hasJobSeekerKeywords) {
    return `<div class="job-seeker-headline">${highlightedHeadline}</div>`;
  }
  
  return highlightedHeadline;
}

// Update pagination controls
function updatePagination() {
  const totalPages = Math.max(1, Math.ceil(filteredProspects.length / itemsPerPage));
  paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  
  // Update button states
  prevPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= totalPages;
}

// Set up action buttons in the table
function setupActionButtons() {
  // View buttons
  document.querySelectorAll('.view-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      openProspectDetail(id);
    });
  });
  
  // Message buttons
  document.querySelectorAll('.message-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      openProspectDetail(id);
    });
  });
}

// Open prospect detail modal
function openProspectDetail(id) {
  // Find the selected prospect
  selectedProspect = allProspects.find(p => p.id === id);
  
  if (!selectedProspect) return;
  
  // Populate modal content
  renderProspectDetail(selectedProspect);
  
  // Show modal
  prospectModal.style.display = 'block';
  
  // Message textarea removed - messaging now handled via bulk operations
}

// Render prospect detail in modal - Professional compact design
function renderProspectDetail(prospect) {
  let html = `
    <div class="prospect-header">
      <div class="prospect-name">${prospect.name}</div>
      <div class="prospect-headline">${prospect.headline || 'No headline available'}</div>
      <div class="prospect-status">
        <select id="status-select" class="status-select">
          <option value="new" ${prospect.status === 'new' ? 'selected' : ''}>🆕 New</option>
          <option value="contacted" ${prospect.status === 'contacted' ? 'selected' : ''}>📞 Contacted</option>
          <option value="responded" ${prospect.status === 'responded' ? 'selected' : ''}>💬 Responded</option>
          <option value="member" ${prospect.status === 'member' ? 'selected' : ''}>⭐ Member</option>
          <option value="not-interested" ${prospect.status === 'not-interested' ? 'selected' : ''}>❌ Not Interested</option>
        </select>
      </div>
    </div>
    
    <div class="prospect-content">
      <!-- AI Analysis Summary (Top Priority) -->
      <div class="ai-summary-section">
        <h3>🎯 AI Analysis</h3>
        <div class="ai-metrics">
          ${prospect.jobSeekerScore ? `
            <div class="metric-item">
              <div class="metric-label">Job Seeker Score</div>
              <div class="metric-value">
                <div class="score-bar">
                  <div class="score-fill" style="width: ${prospect.jobSeekerScore}%"></div>
                  <span class="score-text">${prospect.jobSeekerScore}%</span>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${prospect.careerStage ? `
            <div class="metric-item">
              <div class="metric-label">Career Stage</div>
              <div class="metric-value">${prospect.careerStage}</div>
            </div>
          ` : ''}
          
          ${prospect.techBackground ? `
            <div class="metric-item">
              <div class="metric-label">Tech Background</div>
              <div class="metric-value">${prospect.techBackground}</div>
            </div>
          ` : ''}
          
          ${prospect.industry ? `
            <div class="metric-item">
              <div class="metric-label">Industry</div>
              <div class="metric-value">${prospect.industry}</div>
            </div>
          ` : ''}
          
          ${prospect.experienceYears ? `
            <div class="metric-item">
              <div class="metric-label">Experience</div>
              <div class="metric-value">${prospect.experienceYears} years</div>
            </div>
          ` : ''}
          
          ${prospect.techProficiency ? `
            <div class="metric-item">
              <div class="metric-label">Tech Level</div>
              <div class="metric-value">${prospect.techProficiency}</div>
            </div>
          ` : ''}
          
          ${prospect.contactability ? `
            <div class="metric-item">
              <div class="metric-label">Contactability</div>
              <div class="metric-value">${prospect.contactability}</div>
            </div>
          ` : ''}
          
          ${prospect.remotePreference ? `
            <div class="metric-item">
              <div class="metric-label">Remote Work</div>
              <div class="metric-value">${prospect.remotePreference}</div>
            </div>
          ` : ''}
        </div>
        
        ${prospect.summary ? `
          <div class="ai-summary-text">
            <strong>Summary:</strong> ${prospect.summary}
          </div>
        ` : ''}
        
        ${prospect.jobSeekingSignals && prospect.jobSeekingSignals.length > 0 ? `
          <div class="job-signals-section">
            <strong>🎯 Job Seeking Signals:</strong>
            <div class="signals-list">
              ${prospect.jobSeekingSignals.map(signal => `<span class="signal-tag">${signal}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        
        ${prospect.keySkills && prospect.keySkills.length > 0 ? `
          <div class="skills-section">
            <strong>🛠️ Key Skills:</strong>
            <div class="skills-list">
              ${prospect.keySkills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        
        ${prospect.notes ? `
          <div class="ai-notes-section">
            <strong>📝 AI Notes:</strong> ${prospect.notes}
          </div>
        ` : ''}
        
        ${prospect.tokensUsed ? `
          <div class="tokens-info">
            <small>🤖 Analysis used ${prospect.tokensUsed} tokens</small>
          </div>
        ` : ''}
      </div>
      
      <!-- Contact Information -->
      <div class="contact-section">
        <h3>📞 Contact Information</h3>
        <div class="contact-grid">
          <div class="contact-item">
            <div class="contact-label">Email</div>
            <div class="contact-value">${prospect.email ? `<a href="mailto:${prospect.email}">${prospect.email}</a>` : 'Not available'}</div>
          </div>
          <div class="contact-item">
            <div class="contact-label">Phone</div>
            <div class="contact-value">${prospect.phone || 'Not available'}</div>
          </div>
          <div class="contact-item">
            <div class="contact-label">LinkedIn</div>
            <div class="contact-value">
              ${(prospect.originalLinkedInUrl || prospect.linkedinUrl) ? 
                `<a href="${prospect.originalLinkedInUrl || prospect.linkedinUrl}" target="_blank">View Profile</a>` : 
                'Not available'}
            </div>
          </div>
          <div class="contact-item">
            <div class="contact-label">Added</div>
            <div class="contact-value">${new Date(prospect.dateAdded).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
      
      <!-- Key Details (Collapsible) -->
      <div class="details-section">
        <h3>📋 Key Details</h3>
        <div class="details-grid">
          ${prospect.about ? `
            <div class="detail-item">
              <div class="detail-label">About</div>
              <div class="detail-value">${prospect.about.substring(0, 200)}${prospect.about.length > 200 ? '...' : ''}</div>
            </div>
          ` : ''}
          
          ${prospect.experiences && prospect.experiences.length > 0 ? `
            <div class="detail-item">
              <div class="detail-label">Experience</div>
              <div class="detail-value">${prospect.experiences.length} position${prospect.experiences.length !== 1 ? 's' : ''}</div>
            </div>
          ` : ''}
          
          ${prospect.skills && prospect.skills.length > 0 ? `
            <div class="detail-item">
              <div class="detail-label">Skills</div>
              <div class="detail-value">${prospect.skills.slice(0, 5).join(', ')}${prospect.skills.length > 5 ? ` +${prospect.skills.length - 5} more` : ''}</div>
            </div>
          ` : ''}
          
          ${prospect.education && prospect.education.length > 0 ? `
            <div class="detail-item">
              <div class="detail-label">Education</div>
              <div class="detail-value">${prospect.education[0].school || 'Not specified'}</div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- AI Notes (Collapsible) -->
      ${prospect.aiNotes ? `
        <div class="ai-notes-section">
          <h3>🤖 AI Notes</h3>
          <div class="ai-notes-content">
            ${prospect.aiNotes.jobSeekerStatus ? `
              <div class="note-item">
                <strong>Job Seeker Status:</strong> ${prospect.aiNotes.jobSeekerStatus}
              </div>
            ` : ''}
            
            ${prospect.aiNotes.generalNotes && prospect.aiNotes.generalNotes.length > 0 ? `
              <div class="note-item">
                <strong>General Notes:</strong>
                <ul>
                  ${Array.isArray(prospect.aiNotes.generalNotes) ? 
                    prospect.aiNotes.generalNotes.map(note => `<li>${note}</li>`).join('') :
                    `<li>${prospect.aiNotes.generalNotes}</li>`
                  }
                </ul>
              </div>
            ` : ''}
            
            ${prospect.aiNotes.techSkillsNotes ? `
              <div class="note-item">
                <strong>Tech Skills:</strong> ${prospect.aiNotes.techSkillsNotes}
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  
  // AI Summary section (consolidated)
  if (prospect.careerStage || prospect.techBackground || prospect.jobSeekerScore || prospect.summary || prospect.aiNotes) {
    html += `
      <div class="detail-section">
        <h3>AI Summary</h3>
        
        ${prospect.jobSeekerScore ? `
          <div class="detail-field">
            <div class="field-label">Job Seeker Confidence</div>
            <div class="field-value">
              <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${prospect.jobSeekerScore}%"></div>
                <span class="confidence-text">${prospect.jobSeekerScore}%</span>
              </div>
            </div>
          </div>
        ` : ''}
        
        ${prospect.careerStage ? `
          <div class="detail-field">
            <div class="field-label">Career Stage</div>
            <div class="field-value">${prospect.careerStage}</div>
          </div>
        ` : ''}
        
        ${prospect.techBackground ? `
          <div class="detail-field">
            <div class="field-label">Tech Background</div>
            <div class="field-value">${prospect.techBackground}</div>
          </div>
        ` : ''}
        
        ${prospect.interests && prospect.interests.length > 0 ? `
          <div class="detail-field">
            <div class="field-label">Interests</div>
            <div class="field-value">${prospect.interests.join(', ')}</div>
          </div>
        ` : ''}
        
        ${prospect.communicationStyle ? `
          <div class="detail-field">
            <div class="field-label">Communication Style</div>
            <div class="field-value">${prospect.communicationStyle}</div>
          </div>
        ` : ''}
        
        ${prospect.jobSeekerSignals && prospect.jobSeekerSignals.length > 0 ? `
          <div class="detail-field">
            <div class="field-label">Job Seeking Signals</div>
            <div class="field-value">
              ${prospect.jobSeekerSignals.map(signal => 
                `<div style="margin-bottom: 4px; padding: 4px 8px; background: #e8f5e8; border-radius: 4px; font-size: 12px;">• ${signal}</div>`
              ).join('')}
            </div>
          </div>
        ` : ''}
        
        ${prospect.personalityTraits && prospect.personalityTraits.length > 0 ? `
          <div class="detail-field">
            <div class="field-label">Personality Traits</div>
            <div class="field-value">${prospect.personalityTraits.join(', ')}</div>
          </div>
        ` : ''}
        
        ${prospect.summary ? `
          <div class="detail-field">
            <div class="field-label">AI Summary</div>
            <div class="field-value">${prospect.summary}</div>
          </div>
        ` : ''}
        
        ${prospect.deepAnalysisError ? `
          <div class="detail-field">
            <div class="field-label">Analysis Status</div>
            <div class="field-value" style="color: #e74c3c;">
              Error: ${prospect.deepAnalysisError}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // AI Notes section with bulleted format
  if (prospect.aiNotes) {
    html += `
      <div class="detail-section">
        <h3>AI Analysis Notes</h3>
        
        ${prospect.aiNotes.jobSeekerStatus ? `
          <div class="detail-field">
            <div class="field-label">Job Seeker Status</div>
            <div class="field-value ai-notes-content">${prospect.aiNotes.jobSeekerStatus}</div>
          </div>
        ` : ''}
        
        ${prospect.aiNotes.generalNotes && prospect.aiNotes.generalNotes.length > 0 ? `
          <div class="detail-field">
            <div class="field-label">General Notes</div>
            <div class="field-value ai-notes-content">
              ${Array.isArray(prospect.aiNotes.generalNotes) ? 
                prospect.aiNotes.generalNotes.map(note => `<div class="ai-note-item">${note}</div>`).join('') :
                `<div class="ai-note-item">${prospect.aiNotes.generalNotes}</div>`
              }
            </div>
          </div>
        ` : ''}
        
        ${prospect.aiNotes.techSkillsNotes ? `
          <div class="detail-field">
            <div class="field-label">Tech Skills Assessment</div>
            <div class="field-value ai-notes-content">${prospect.aiNotes.techSkillsNotes}</div>
          </div>
        ` : ''}
        
        ${prospect.aiNotes.careerGoals ? `
          <div class="detail-field">
            <div class="field-label">Career Goals</div>
            <div class="field-value ai-notes-content">${prospect.aiNotes.careerGoals}</div>
          </div>
        ` : ''}
        
        ${prospect.aiNotes.postAnalysis ? `
          <div class="detail-field">
            <div class="field-label">Posts Analysis</div>
            <div class="field-value ai-notes-content">${prospect.aiNotes.postAnalysis}</div>
          </div>
        ` : ''}
        
        ${prospect.aiNotes.contactability ? `
          <div class="detail-field">
            <div class="field-label">Contactability</div>
            <div class="field-value ai-notes-content">${prospect.aiNotes.contactability}</div>
          </div>
        ` : ''}
        
        ${prospect.aiNotes.fitForNetwrk ? `
          <div class="detail-field">
            <div class="field-label">TheNetwrk Fit</div>
            <div class="field-value ai-notes-content">${prospect.aiNotes.fitForNetwrk}</div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Profile Details section
  if (prospect.about || prospect.experiences || prospect.education || prospect.skills) {
    html += `
      <div class="detail-section">
        <h3>Profile Details</h3>
        
        ${prospect.about ? `
          <div class="detail-field">
            <div class="field-label">About</div>
            <div class="field-value">${prospect.about.substring(0, 300)}${prospect.about.length > 300 ? '...' : ''}</div>
          </div>
        ` : ''}
        
        ${prospect.experiences && prospect.experiences.length > 0 ? `
          <div class="detail-field">
            <div class="field-label">Experience</div>
            <div class="field-value">
              ${Array.isArray(prospect.experiences) ? 
                prospect.experiences.map(exp => 
                  typeof exp === 'object' ? 
                    `<div style="margin-bottom: 8px;"><strong>${exp.title}</strong> at ${exp.company}<br><small>${exp.duration}</small></div>` :
                    `<div style="margin-bottom: 8px;">${exp}</div>`
                ).join('') :
                prospect.experiences
              }
            </div>
          </div>
        ` : ''}
        
        ${prospect.education && prospect.education.length > 0 ? `
          <div class="detail-field">
            <div class="field-label">Education</div>
            <div class="field-value">
              ${Array.isArray(prospect.education) ? 
                prospect.education.map(edu => 
                  typeof edu === 'object' ? 
                    `<div style="margin-bottom: 8px;"><strong>${edu.school}</strong><br>${edu.degree ? edu.degree + '<br>' : ''}<small>${edu.dates}</small></div>` :
                    `<div style="margin-bottom: 8px;">${edu}</div>`
                ).join('') :
                prospect.education
              }
            </div>
          </div>
        ` : ''}
        
        ${prospect.skills && prospect.skills.length > 0 ? `
          <div class="detail-field">
            <div class="field-label">Skills</div>
            <div class="field-value">
              ${Array.isArray(prospect.skills) ? 
                prospect.skills.slice(0, 10).map(skill => 
                  `<span style="display: inline-block; background: #e1f5fe; padding: 2px 8px; margin: 2px; border-radius: 12px; font-size: 12px;">${skill}</span>`
                ).join('') :
                prospect.skills
              }
              ${Array.isArray(prospect.skills) && prospect.skills.length > 10 ? 
                `<span style="color: #666; font-size: 12px;">... and ${prospect.skills.length - 10} more</span>` : 
                ''
              }
            </div>
          </div>
        ` : ''}
        
        ${prospect.posts && prospect.posts !== 'Not available' ? `
          <div class="detail-field">
            <div class="field-label">Recent Posts & Activity</div>
            <div class="field-value">
              ${Array.isArray(prospect.posts) ? 
                prospect.posts.map(post => {
                  if (typeof post === 'object') {
                    return `
                      <div class="post-item ${post.hasJobKeywords ? 'job-seeking-post' : ''} ${post.hasTechKeywords ? 'tech-post' : ''}">
                        <div class="post-content">${post.text}</div>
                        ${post.hasJobKeywords || post.hasTechKeywords ? `
                          <div class="post-tags">
                            ${post.hasJobKeywords ? '<span class="post-tag job-tag">🔍 Job Seeking</span>' : ''}
                            ${post.hasTechKeywords ? '<span class="post-tag tech-tag">💻 Tech Related</span>' : ''}
                            ${post.foundEmail ? '<span class="post-tag email-tag">📧 Email Found</span>' : ''}
                          </div>
                        ` : ''}
                        <div class="post-engagement">
                          👍 ${post.engagement?.likes || '0'} • 💬 ${post.engagement?.comments || '0'}
                        </div>
                      </div>
                    `;
                  } else {
                    return `<div class="post-item"><div class="post-content">${post}</div></div>`;
                  }
                }).join('') :
                `<div class="post-item"><div class="post-content">${prospect.posts}</div></div>`
              }
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Contact history section
  html += `
    <div class="detail-section">
      <h3>Contact History</h3>
  `;
  
  if (prospect.contactAttempts && prospect.contactAttempts.length > 0) {
    prospect.contactAttempts.forEach(attempt => {
      html += `
        <div class="contact-attempt">
          <div class="contact-header">
            <span>${attempt.type.toUpperCase()}</span>
            <span>${new Date(attempt.date).toLocaleString()}</span>
          </div>
          <div class="contact-body">
            Template: ${attempt.templateId}<br>
            Status: ${attempt.status}
          </div>
        </div>
      `;
    });
  } else {
    html += '<p>No contact attempts yet.</p>';
  }
  
  html += `
    </div>
    
    <div class="detail-section">
      <h3>Notes</h3>
      <textarea id="notes-textarea" rows="3" style="width: 100%;">${prospect.notes || ''}</textarea>
    </div>
    
    <!-- Scraped Data Section -->
    <div class="detail-section">
      <h3>📊 Scraped Profile Data</h3>
      
      <!-- Contact Information Found -->
      ${(prospect.activityEmails && prospect.activityEmails.length > 0) || 
        (prospect.activityPhones && prospect.activityPhones.length > 0) || 
        (prospect.email && prospect.email) || 
        (prospect.phone && prospect.phone) ? `
        <div class="detail-field contact-info-found">
          <div class="field-label">🎯 Contact Information Found</div>
          <div class="field-value contact-treasure">
            ${prospect.activityEmails && prospect.activityEmails.length > 0 ? `
              <div class="contact-item email-found">
                <strong>📧 Emails from Activity:</strong>
                ${prospect.activityEmails.map(email => `
                  <div class="contact-value">
                    <a href="mailto:${email}" class="contact-link">${email}</a>
                    <button onclick="copyToClipboard('${email}')" class="copy-btn">📋</button>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            ${prospect.email && prospect.email ? `
              <div class="contact-item">
                <strong>📧 Profile Email:</strong>
                <div class="contact-value">
                  <a href="mailto:${prospect.email}" class="contact-link">${prospect.email}</a>
                  <button onclick="copyToClipboard('${prospect.email}')" class="copy-btn">📋</button>
                </div>
              </div>
            ` : ''}
            
            ${prospect.activityPhones && prospect.activityPhones.length > 0 ? `
              <div class="contact-item phone-found">
                <strong>📱 Phones from Activity:</strong>
                ${prospect.activityPhones.map(phone => `
                  <div class="contact-value">
                    <a href="tel:${phone}" class="contact-link">${phone}</a>
                    <button onclick="copyToClipboard('${phone}')" class="copy-btn">📋</button>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            ${prospect.phone && prospect.phone ? `
              <div class="contact-item">
                <strong>📱 Profile Phone:</strong>
                <div class="contact-value">
                  <a href="tel:${prospect.phone}" class="contact-link">${prospect.phone}</a>
                  <button onclick="copyToClipboard('${prospect.phone}')" class="copy-btn">📋</button>
                </div>
              </div>
            ` : ''}
            
            ${prospect.activitySocialMedia && prospect.activitySocialMedia.length > 0 ? `
              <div class="contact-item social-found">
                <strong>🔗 Social Media from Activity:</strong>
                ${prospect.activitySocialMedia.map(social => `
                  <div class="contact-value">
                    <span class="contact-link">${social}</span>
                    <button onclick="copyToClipboard('${social}')" class="copy-btn">📋</button>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      
      ${prospect.experiences && prospect.experiences.length > 0 ? `
        <div class="detail-field">
          <div class="field-label">Work Experience (${prospect.experiences.length})</div>
          <div class="field-value">
            ${prospect.experiences.map(exp => `
              <div style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                <strong>${exp.title || 'Position'}</strong> at ${exp.company || 'Company'}
                ${exp.duration ? `<br><small style="color: #666;">${exp.duration}</small>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${prospect.education && prospect.education.length > 0 ? `
        <div class="detail-field">
          <div class="field-label">Education (${prospect.education.length})</div>
          <div class="field-value">
            ${prospect.education.map(edu => `
              <div style="margin-bottom: 4px;">
                ${typeof edu === 'object' ? (edu.school || edu.degree || 'Education') : edu}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${prospect.skills && prospect.skills.length > 0 ? `
        <div class="detail-field">
          <div class="field-label">Skills (${prospect.skills.length})</div>
          <div class="field-value">
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${prospect.skills.slice(0, 20).map(skill => 
                `<span style="padding: 2px 8px; background: #e3f2fd; border-radius: 12px; font-size: 12px;">${skill}</span>`
              ).join('')}
              ${prospect.skills.length > 20 ? `<span style="padding: 2px 8px; color: #666;">... +${prospect.skills.length - 20} more</span>` : ''}
            </div>
          </div>
        </div>
      ` : ''}
      
      ${prospect.posts && prospect.posts.length > 0 ? `
        <div class="detail-field">
          <div class="field-label">Recent Posts (${prospect.posts.length})</div>
          <div class="field-value">
            ${prospect.posts.slice(0, 3).map(post => `
              <div style="margin-bottom: 8px; padding: 8px; background: #f0f8ff; border-radius: 4px; font-size: 12px;">
                ${post.text ? post.text.substring(0, 200) + (post.text.length > 200 ? '...' : '') : 'Post content'}
                ${post.date ? `<br><small style="color: #666;">Posted: ${post.date}</small>` : ''}
              </div>
            `).join('')}
            ${prospect.posts.length > 3 ? `<small style="color: #666;">... and ${prospect.posts.length - 3} more posts</small>` : ''}
          </div>
        </div>
      ` : ''}
      
      ${prospect.comments && prospect.comments.length > 0 ? `
        <div class="detail-field">
          <div class="field-label">Recent Comments (${prospect.comments.length})</div>
          <div class="field-value">
            ${prospect.comments.slice(0, 2).map(comment => `
              <div style="margin-bottom: 8px; padding: 8px; background: #fffaf0; border-radius: 4px; font-size: 12px;">
                ${comment.text ? comment.text.substring(0, 150) + (comment.text.length > 150 ? '...' : '') : 'Comment'}
              </div>
            `).join('')}
            ${prospect.comments.length > 2 ? `<small style="color: #666;">... and ${prospect.comments.length - 2} more comments</small>` : ''}
          </div>
        </div>
      ` : ''}
      
      ${prospect.location ? `
        <div class="detail-field">
          <div class="field-label">Location</div>
          <div class="field-value">${prospect.location}</div>
        </div>
      ` : ''}
      
      ${prospect.workStatus ? `
        <div class="detail-field">
          <div class="field-label">Work Status</div>
          <div class="field-value">${prospect.workStatus}</div>
        </div>
      ` : ''}
      
      <div class="detail-field">
        <div class="field-label">Data Collection</div>
        <div class="field-value">
          <small style="color: #666;">
            Extracted: ${new Date(prospect.extractionTimestamp || prospect.dateAdded).toLocaleString()}<br>
            ${prospect.dataCompleteness ? `Data Completeness: ${prospect.dataCompleteness}%` : ''}
          </small>
        </div>
      </div>
    </div>
    
  `;
  
  // Set modal content
  prospectDetailContent.innerHTML = html;
  
  // Add event listener to status select
  document.getElementById('status-select').addEventListener('change', (e) => {
    updateProspectStatus(prospect.id, e.target.value);
  });
  
  // Add event listener to notes textarea
  document.getElementById('notes-textarea').addEventListener('blur', (e) => {
    updateProspectNotes(prospect.id, e.target.value);
  });
}

// Get personalized message template
function getMessageTemplate(firstName) {
  return `Hi ${firstName},

I noticed your profile and thought you might be interested in TheNetwrk - we help professionals find 90k+ jobs in tech through our supportive community.

Would you be open to learning more about it?

https://welcometothenetwork.xyz/

Best regards,
TheNetwrk Team`;
}

// Update prospect status
function updateProspectStatus(id, status) {
  chrome.runtime.sendMessage({
    action: 'updateProspect',
    data: { id, status }
  }, (response) => {
    if (response.success) {
      // Update local data
      const index = allProspects.findIndex(p => p.id === id);
      if (index !== -1) {
        allProspects[index].status = status;
        // Refresh display
        applyFiltersAndSort();
      }
    }
  });
}

// Update prospect notes
function updateProspectNotes(id, notes) {
  chrome.runtime.sendMessage({
    action: 'updateProspect',
    data: { id, notes }
  }, (response) => {
    if (response.success) {
      // Update local data
      const index = allProspects.findIndex(p => p.id === id);
      if (index !== -1) {
        allProspects[index].notes = notes;
      }
    }
  });
}

// Set up all event listeners
function setupEventListeners() {
  // Search button
  searchButton.addEventListener('click', () => {
    applyFiltersAndSort();
  });
  
  // Search input (search as you type)
  searchInput.addEventListener('input', () => {
    applyFiltersAndSort();
  });
  
  // Status filter
  statusFilter.addEventListener('change', () => {
    applyFiltersAndSort();
  });
  
  // Clear filters
  clearFiltersButton.addEventListener('click', () => {
    searchInput.value = '';
    statusFilter.value = 'all';
    applyFiltersAndSort();
  });
  
  // Refresh data
  refreshDataButton.addEventListener('click', () => {
    loadProspects();
  });
  
  // Message drafting
  document.getElementById('message-drafting').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/message-drafting.html') });
  });
  
  // Export to CSV
  document.getElementById('export-csv').addEventListener('click', () => {
    exportToCSV();
  });
  
  // Import from CSV
  document.getElementById('import-csv').addEventListener('click', () => {
    document.getElementById('csv-file-input').click();
  });
  
  // Handle CSV file selection
  document.getElementById('csv-file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      importFromCSV(file);
    }
  });
  
  // Clear dashboard with password
  document.getElementById('clear-dashboard').addEventListener('click', () => {
    const password = prompt('Enter password to clear all prospects:');
    if (password === '0000') {
      clearDashboard();
    } else if (password !== null) {
      alert('Incorrect password');
    }
  });
  
  // Add debug button to clear all prospects
  const debugClearButton = document.createElement('button');
  debugClearButton.textContent = '🗑️ Clear All (Debug)';
  debugClearButton.style.cssText = 'margin-left: 10px; padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;';
  debugClearButton.addEventListener('click', () => {
    if (confirm('Clear all prospects? This cannot be undone.')) {
      chrome.runtime.sendMessage({ action: 'clearAllProspects' }, (response) => {
        if (response && response.success) {
          showSuccess('All prospects cleared!');
          loadProspects();
        } else {
          showError('Failed to clear prospects: ' + (response?.error || 'Unknown error'));
        }
      });
    }
  });
  
  // Debug: Add console log to verify dashboard JS is loading
  // CSV Export function
function exportToCSV() {
  console.log('📊 Exporting prospects to CSV...');
  
  if (allProspects.length === 0) {
    alert('No prospects to export');
    return;
  }
  
  // Create CSV header
  const headers = [
    'Name', 'Headline', 'LinkedIn URL', 'Job Seeker Score', 'Career Stage', 
    'Tech Background', 'Summary', 'About', 'Email', 'Phone', 'Location',
    'Skills', 'Experiences', 'Posts', 'Comments', 'Status', 'Keyword', 'Date Added'
  ];
  
  // Create CSV rows
  const rows = allProspects.map(p => [
    p.name || '',
    p.headline || '',
    p.linkedinUrl || '',
    p.jobSeekerScore || '',
    p.careerStage || '',
    p.techBackground || '',
    p.summary || '',
    p.about || '',
    p.email || '',
    p.phone || '',
    p.location || '',
    (p.skills || []).join('; '),
    (p.experiences || []).map(exp => `${exp.title} at ${exp.company}`).join('; '),
    (p.posts || []).map(post => post.text).join('; '),
    (p.comments || []).map(comment => comment.text).join('; '),
    p.status || '',
    p.keyword || '',
    p.dateAdded || ''
  ]);
  
  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thenetwrk-prospects-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  
  console.log(`✅ Exported ${allProspects.length} prospects to CSV`);
  alert(`✅ Exported ${allProspects.length} prospects to CSV file`);
}

// CSV Import function
function importFromCSV(file) {
  console.log('📥 Importing prospects from CSV...');
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csv = e.target.result;
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
      
      const importedProspects = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
        
        if (values.length >= 3 && values[0] && values[2]) { // Must have name and URL
          const prospect = {
            id: `imported_${Date.now()}_${i}`,
            name: values[0],
            headline: values[1],
            linkedinUrl: values[2],
            jobSeekerScore: parseInt(values[3]) || null,
            careerStage: values[4],
            techBackground: values[5],
            summary: values[6],
            about: values[7],
            email: values[8],
            phone: values[9],
            location: values[10],
            skills: values[11] ? values[11].split('; ') : [],
            experiences: values[12] ? values[12].split('; ').map(exp => ({ title: exp.split(' at ')[0], company: exp.split(' at ')[1] })) : [],
            posts: values[13] ? values[13].split('; ').map(text => ({ text })) : [],
            comments: values[14] ? values[14].split('; ').map(text => ({ text })) : [],
            status: values[15] || 'imported',
            keyword: values[16] || 'imported',
            dateAdded: values[17] || new Date().toISOString(),
            isResearched: true,
            needsResearch: false,
            source: 'csv_import'
          };
          
          importedProspects.push(prospect);
        }
      }
      
      // Save imported prospects
      chrome.runtime.sendMessage({
        action: 'saveBulkProfiles',
        profiles: importedProspects
      }, (response) => {
        if (response && response.success) {
          alert(`✅ Imported ${response.savedCount} prospects from CSV`);
          loadProspects(); // Refresh dashboard
        } else {
          alert('Failed to import CSV: ' + (response?.error || 'Unknown error'));
        }
      });
      
    } catch (error) {
      console.error('❌ CSV import error:', error);
      alert('Failed to parse CSV file: ' + error.message);
    }
  };
  
  reader.readAsText(file);
}

// Clear dashboard function
function clearDashboard() {
  console.log('🗑️ Clearing dashboard...');
  
  chrome.storage.local.set({ prospects: [] }, () => {
    console.log('✅ Dashboard cleared');
    alert('✅ Dashboard cleared successfully');
    loadProspects(); // Refresh to show empty dashboard
  });
}

console.log('✅ Dashboard: JavaScript loaded and event listeners set up');
  
  // Simple test: log current storage state
  chrome.storage.local.get(['prospects'], (result) => {
    console.log('🔍 Dashboard: Current storage has', result.prospects?.length || 0, 'prospects');
    if (result.prospects && result.prospects.length > 0) {
      console.log('🔍 Dashboard: Prospect names:', result.prospects.map(p => p.name));
    }
  });
  
  // Dashboard is now ready and modular - enhanced flow implemented
  
  // Dashboard ready - no test buttons needed
  
  // Pagination
  prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderProspects();
      updatePagination();
    }
  });
  
  nextPageButton.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredProspects.length / itemsPerPage);
    console.log(`📄 Dashboard: Next page clicked. Current: ${currentPage}, Total: ${totalPages}`);
    
    if (currentPage < totalPages) {
      currentPage++;
      console.log(`📄 Dashboard: Moving to page ${currentPage}`);
      renderProspects();
      updatePagination();
    } else {
      console.log(`📄 Dashboard: Already on last page (${currentPage})`);
    }
  });
  
  // Sortable columns
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      
      // Toggle direction if clicking the same column
      if (field === currentSort.field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
      }
      
      applyFiltersAndSort();
    });
  });
  
  // Modal close button
  document.querySelector('.close-modal').addEventListener('click', closeModal);
  document.querySelector('.close-button').addEventListener('click', closeModal);
  
  // Send message button removed - messaging now handled via bulk operations
  
  // Bulk action buttons
  if (sendToAllEmailsButton) {
    sendToAllEmailsButton.addEventListener('click', () => {
      const prospectsWithEmails = allProspects.filter(p => p.email && p.email !== '-' && p.email !== 'Not available' && p.email !== '' && p.email !== null);
      if (prospectsWithEmails.length === 0) {
        showError('No prospects with email addresses found.');
        return;
      }
      
      openEmailPreviewModal(prospectsWithEmails);
    });
  }
  
  if (sendToAllLinkedInButton) {
    sendToAllLinkedInButton.addEventListener('click', () => {
      const prospectsWithLinkedIn = allProspects.filter(p => p.linkedinUrl);
      if (prospectsWithLinkedIn.length === 0) {
        showError('No prospects with LinkedIn profiles found.');
        return;
      }
      openDMPreviewModal(prospectsWithLinkedIn);
    });
  }
  
  // Close modal if clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === prospectModal) {
      closeModal();
    }
  });
}

// Close modal
function closeModal() {
  prospectModal.style.display = 'none';
  selectedProspect = null;
}

// Copy text to clipboard utility
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show temporary success message
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '✅';
    button.style.background = '#48bb78';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
    }, 1500);
  }).catch(err => {
    console.error('Could not copy text: ', err);
    alert('Could not copy to clipboard');
  });
}

// Send message to prospect
function sendMessage(prospect, content) {
  // Check if we have the necessary information
  if (!content.trim()) {
    showError('Please write a message first.');
    return;
  }
  
  console.log('TheNetwrk: Sending message to:', prospect.name);
  console.log('TheNetwrk: Has email:', !!prospect.email);
  console.log('TheNetwrk: Has LinkedIn URL:', !!prospect.linkedinUrl);
  
  if (prospect.email) {
    // Send email
    console.log('TheNetwrk: Attempting to send email to:', prospect.email);
    sendEmailMessage(prospect, content);
  } else if (prospect.linkedinUrl) {
    // Send LinkedIn DM
    console.log('TheNetwrk: Attempting to send LinkedIn DM via:', prospect.linkedinUrl);
    sendLinkedInMessage(prospect, content);
  } else {
    showError('No email or LinkedIn URL available for this prospect.');
  }
}

// Send email message
function sendEmailMessage(prospect, content) {
  // Generate personalized message first
  chrome.runtime.sendMessage({
    action: 'generatePersonalizedMessage',
    data: {
      name: prospect.name,
      headline: prospect.headline,
      location: prospect.location,
      email: prospect.email,
      isLikelyJobSeeker: true,
      customMessage: content
    }
  }, (messageResponse) => {
    if (messageResponse && messageResponse.success) {
      // Send the personalized email
      chrome.runtime.sendMessage({
        action: 'sendPersonalizedEmail',
        data: {
          name: prospect.name,
          headline: prospect.headline,
          location: prospect.location,
          email: prospect.email,
          message: messageResponse.message || content,
          customMessage: content
        }
      }, (emailResponse) => {
        handleMessageResponse(prospect, content, 'email', emailResponse);
      });
    } else {
      // Fall back to sending the original content
      chrome.runtime.sendMessage({
        action: 'sendPersonalizedEmail',
        data: {
          name: prospect.name,
          headline: prospect.headline,
          location: prospect.location,
          email: prospect.email,
          message: content,
          customMessage: content
        }
      }, (emailResponse) => {
        handleMessageResponse(prospect, content, 'email', emailResponse);
      });
    }
  });
}

// Send LinkedIn message
function sendLinkedInMessage(prospect, content) {
  // First generate a personalized message
  chrome.runtime.sendMessage({
    action: 'generatePersonalizedMessage',
    data: {
      name: prospect.name,
      headline: prospect.headline,
      location: prospect.location,
      isLikelyJobSeeker: true,
      customMessage: content
    }
  }, (messageResponse) => {
    const finalMessage = messageResponse && messageResponse.success ? 
                        messageResponse.message : content;
    
    console.log('TheNetwrk: Opening LinkedIn for DM automation...');
    
    // Extract LinkedIn username from URL
    let linkedinUsername = '';
    try {
      const urlParts = prospect.linkedinUrl.split('/in/');
      if (urlParts.length > 1) {
        linkedinUsername = urlParts[1].replace('/', '').split('?')[0];
      }
    } catch (error) {
      console.error('TheNetwrk: Error extracting LinkedIn username:', error);
    }
    
    // Open LinkedIn profile first, then navigate to messaging
    const profileUrl = prospect.linkedinUrl;
    
    // Create a new tab for LinkedIn profile
    chrome.tabs.create({ url: profileUrl, active: true }, (tab) => {
      // Wait for the page to load, then inject the message
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'sendAutomatedDM',
          data: {
            message: finalMessage,
            recipientName: prospect.name
          }
        }, (dmResponse) => {
          if (dmResponse && dmResponse.success) {
            // Record successful LinkedIn message
            handleMessageResponse(prospect, finalMessage, 'linkedin', { success: true });
            
            // Show success notification
            alert(`LinkedIn DM prepared for ${prospect.name}! The message has been filled in - just click Send on LinkedIn.`);
          } else {
            // Manual fallback - just open LinkedIn and let user send manually
            alert(`LinkedIn opened for ${prospect.name}. Please send this message manually:\n\n${finalMessage}`);
            
            // Still record the attempt
            handleMessageResponse(prospect, finalMessage, 'linkedin', { success: true, manual: true });
          }
        });
      }, 4000); // Give LinkedIn time to load
    });
  });
}

// Handle message response (common for both email and LinkedIn)
function handleMessageResponse(prospect, content, type, response) {
  console.log('TheNetwrk: Message response:', response);
  
  // Create contact attempt object
  const contactAttempt = {
    type: type,
    templateId: 'custom',
    date: new Date().toISOString(),
    status: response && response.success ? 'sent' : 'failed',
    content: content,
    error: response && response.error ? response.error : null
  };
  
  // Add to prospect's contact attempts
  if (!prospect.contactAttempts) {
    prospect.contactAttempts = [];
  }
  prospect.contactAttempts.push(contactAttempt);
  
  // Update status if it was new and message was successful
  if (prospect.status === 'new' && response && response.success) {
    prospect.status = 'contacted';
  }
  
  // Save changes
  chrome.runtime.sendMessage({
    action: 'updateProspect',
    data: {
      id: prospect.id,
      contactAttempts: prospect.contactAttempts,
      status: prospect.status
    }
  }, (updateResponse) => {
    // Send button removed - messaging now handled via bulk operations
    
    if (updateResponse && updateResponse.success) {
      if (response && response.success) {
        if (type === 'email') {
          showSuccess('Email sent successfully!');
        } else if (response.manual) {
          // LinkedIn manual send - already showed alert above
        } else {
          showSuccess('LinkedIn DM sent successfully!');
        }
      } else {
        showError(`Failed to send ${type} message: ${response?.error || 'Unknown error'}`);
      }
      
      // Update UI
      const index = allProspects.findIndex(p => p.id === prospect.id);
      if (index !== -1) {
        allProspects[index] = {
          ...allProspects[index],
          contactAttempts: prospect.contactAttempts,
          status: prospect.status
        };
        
        // Refresh UI
        applyFiltersAndSort();
        
        // Update the modal if it's still open
        if (selectedProspect && selectedProspect.id === prospect.id) {
          renderProspectDetail(allProspects[index]);
        }
      }
      
      // Close modal only for successful email sends
      if (type === 'email' && response && response.success) {
      closeModal();
      }
    } else {
      showError('Failed to update prospect record.');
    }
  });
}

// Show error message
function showError(message) {
  console.error('TheNetwrk Dashboard Error:', message);
  
  // Remove any existing error notifications
  const existingError = document.querySelector('.error-notification');
  if (existingError) {
    existingError.remove();
  }
  
  // Create error notification element
  const errorNotification = document.createElement('div');
  errorNotification.className = 'error-notification';
  errorNotification.innerHTML = `
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <div class="error-text">
        <strong>Error</strong>
        <p>${message}</p>
      </div>
      <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  
  // Add styles if they don't exist
  if (!document.querySelector('#error-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'error-notification-styles';
    style.textContent = `
      .error-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 8px;
        padding: 16px;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInFromRight 0.3s ease-out;
      }
      
      .error-content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      
      .error-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      
      .error-text {
        flex: 1;
      }
      
      .error-text strong {
        color: #c53030;
        font-size: 14px;
        display: block;
        margin-bottom: 4px;
      }
      
      .error-text p {
        color: #744;
        font-size: 13px;
        margin: 0;
        line-height: 1.4;
      }
      
      .error-close {
        background: none;
        border: none;
        font-size: 18px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      .error-close:hover {
        background: #fdd;
        color: #c53030;
      }
      
      @keyframes slideInFromRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add to page
  document.body.appendChild(errorNotification);
  
  // Auto-remove after 8 seconds
  setTimeout(() => {
    if (errorNotification.parentElement) {
      errorNotification.style.animation = 'slideInFromRight 0.3s ease-out reverse';
      setTimeout(() => {
        if (errorNotification.parentElement) {
          errorNotification.remove();
        }
      }, 300);
    }
  }, 8000);
}

// Show success message
function showSuccess(message) {
  console.log('TheNetwrk Dashboard Success:', message);
  
  // Remove any existing success notifications
  const existingSuccess = document.querySelector('.success-notification');
  if (existingSuccess) {
    existingSuccess.remove();
  }
  
  // Create success notification element
  const successNotification = document.createElement('div');
  successNotification.className = 'success-notification';
  successNotification.innerHTML = `
    <div class="success-content">
      <div class="success-icon">✅</div>
      <div class="success-text">
        <strong>Success</strong>
        <p>${message}</p>
      </div>
      <button class="success-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  
  // Add styles if they don't exist
  if (!document.querySelector('#success-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'success-notification-styles';
    style.textContent = `
      .success-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #efe;
        border: 1px solid #cfc;
        border-radius: 8px;
        padding: 16px;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInFromRight 0.3s ease-out;
      }
      
      .success-content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      
      .success-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      
      .success-text {
        flex: 1;
      }
      
      .success-text strong {
        color: #2d7d32;
        font-size: 14px;
        display: block;
        margin-bottom: 4px;
      }
      
      .success-text p {
        color: #474;
        font-size: 13px;
        margin: 0;
        line-height: 1.4;
      }
      
      .success-close {
        background: none;
        border: none;
        font-size: 18px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      .success-close:hover {
        background: #dfd;
        color: #2d7d32;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add to page
  document.body.appendChild(successNotification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (successNotification.parentElement) {
      successNotification.style.animation = 'slideInFromRight 0.3s ease-out reverse';
      setTimeout(() => {
        if (successNotification.parentElement) {
          successNotification.remove();
        }
      }, 300);
    }
  }, 5000);
}

// Send bulk emails to multiple prospects
function sendBulkEmails(prospects) {
  sendToAllEmailsButton.disabled = true;
  sendToAllEmailsButton.textContent = `Sending to ${prospects.length} prospects...`;
  
  let sentCount = 0;
  let failedCount = 0;
  
  prospects.forEach((prospect, index) => {
    // Generate personalized message for each prospect
    const firstName = prospect.name ? prospect.name.split(' ')[0] : 'there';
    const personalizedMessage = generatePersonalizedMessage(prospect, firstName);
    
    // Send email after a delay to avoid rate limiting
    setTimeout(() => {
      sendEmailMessage(prospect, personalizedMessage, (response) => {
        if (response && response.success) {
          sentCount++;
        } else {
          failedCount++;
        }
        
        // Update button text with progress
        sendToAllEmailsButton.textContent = `Sent: ${sentCount}, Failed: ${failedCount}`;
        
        // Check if all emails are processed
        if (sentCount + failedCount === prospects.length) {
          setTimeout(() => {
            sendToAllEmailsButton.disabled = false;
            sendToAllEmailsButton.textContent = '📧 Email All';
            alert(`Bulk email complete! Sent: ${sentCount}, Failed: ${failedCount}`);
            loadProspects(); // Refresh data
          }, 2000);
        }
      });
    }, index * 2000); // 2 second delay between emails
  });
}

// Send bulk LinkedIn messages to multiple prospects
function sendBulkLinkedInMessages(prospects) {
  sendToAllLinkedInButton.disabled = true;
  sendToAllLinkedInButton.textContent = `Preparing ${prospects.length} LinkedIn DMs...`;
  
  alert(`This will open ${prospects.length} LinkedIn profiles in new tabs with pre-written messages. You'll need to manually click "Send" on each one.`);
  
  // Open LinkedIn profiles one by one with delays
  prospects.forEach((prospect, index) => {
    setTimeout(() => {
      const firstName = prospect.name ? prospect.name.split(' ')[0] : 'there';
      const personalizedMessage = generatePersonalizedMessage(prospect, firstName);
      sendLinkedInMessage(prospect, personalizedMessage);
      
      // Update progress
      sendToAllLinkedInButton.textContent = `Opening LinkedIn ${index + 1}/${prospects.length}`;
      
      if (index === prospects.length - 1) {
        setTimeout(() => {
          sendToAllLinkedInButton.disabled = false;
          sendToAllLinkedInButton.textContent = '💬 DM All';
          alert(`All ${prospects.length} LinkedIn profiles opened with pre-written messages!`);
        }, 3000);
      }
    }, index * 5000); // 5 second delay between LinkedIn opens
  });
}

// Generate personalized message based on prospect data
function generatePersonalizedMessage(prospect, firstName) {
  // Create personalized intro based on their profile data
  let personalizedIntro = '';
  if (prospect.headline && prospect.headline.toLowerCase().includes('open to work')) {
    personalizedIntro = `I noticed you're actively seeking new opportunities`;
  } else if (prospect.careerStage === 'early-career') {
    personalizedIntro = `I see you're in the early stages of your career journey`;
  } else if (prospect.summary && prospect.summary.includes('job seeking')) {
    personalizedIntro = `I noticed you're looking to make your next career move`;
  } else {
    personalizedIntro = `I came across your profile and thought you might be interested`;
  }
  
  return `Hi ${firstName},

${personalizedIntro} and wanted to reach out about TheNetwrk - a community that's helped thousands of early-career professionals land their dream jobs.

What makes us different:
✅ Weekly strategy sessions with actionable insights (not generic advice)
✅ Tight-knit community of driven professionals who actually support each other
✅ Direct pipeline to well-funded startups actively hiring

We're selective about who we accept, but based on your background, I think you'd be a great fit.

Interested in learning more? It's just $39/month if accepted.

Best,
[Your Name]

P.S. Getting on our waitlist is free and shows your intent to join: welcometothenetwork.xyz`;
}

// DM Campaign Management
let dmCampaignData = [];
let selectedDMRecipientIndex = -1;

// Open DM Preview Modal
async function openDMPreviewModal(prospectsWithLinkedIn) {
  console.log('Opening DM preview modal for', prospectsWithLinkedIn.length, 'prospects');
  
  // Show modal first with loading state
  document.getElementById('dm-preview-modal').style.display = 'block';
  
  // Initialize DM campaign data with loading messages
  dmCampaignData = prospectsWithLinkedIn.map(prospect => ({
    prospect: prospect,
    name: prospect.name,
    linkedinUrl: prospect.linkedinUrl,
    message: 'Generating personalized message...',
    status: 'generating', // 'generating', 'pending', 'ready', 'sent'
    senderName: 'Lawrence'
  }));
  
  // Update campaign stats
  updateDMCampaignStats();
  
  // Populate recipients list
  populateDMRecipientsList();
  
  // Setup event listeners
  setupDMModalEventListeners();
  
  // Generate AI messages for all prospects
  console.log('Generating AI-powered messages for all prospects...');
  showSuccess('Generating personalized messages with AI...');
  
  for (let i = 0; i < dmCampaignData.length; i++) {
    try {
      const aiMessage = await generatePersonalizedLinkedInMessage(
        dmCampaignData[i].prospect, 
        dmCampaignData[i].senderName
      );
      
      dmCampaignData[i].message = aiMessage;
      dmCampaignData[i].status = 'pending';
      
      console.log(`Generated message ${i + 1}/${dmCampaignData.length} for:`, dmCampaignData[i].name);
      
      // Update UI as messages are generated
      updateDMCampaignStats();
      populateDMRecipientsList();
      
      // Small delay to avoid overwhelming the API
      if (i < dmCampaignData.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error('Error generating message for', dmCampaignData[i].name, ':', error);
      dmCampaignData[i].message = `Hey ${dmCampaignData[i].name.split(' ')[0]}! Interested in connecting about TheNetwrk - we help people land amazing tech jobs. Worth a chat?`;
      dmCampaignData[i].status = 'pending';
    }
  }
  
  showSuccess('All personalized messages generated! Review and mark as ready.');
}

// Update DM campaign stats
function updateDMCampaignStats() {
  const total = dmCampaignData.length;
  const ready = dmCampaignData.filter(dm => dm.status === 'ready').length;
  const pending = dmCampaignData.filter(dm => dm.status === 'pending').length;
  const generating = dmCampaignData.filter(dm => dm.status === 'generating').length;
  
  document.getElementById('dm-count-total').textContent = total;
  document.getElementById('dm-count-ready').textContent = ready;
  document.getElementById('dm-count-pending').textContent = generating > 0 ? `${pending} (${generating} generating...)` : pending;
  
  // Enable/disable send button
  const sendButton = document.getElementById('send-all-dms-btn');
  sendButton.disabled = ready === 0 || generating > 0;
  
  if (generating > 0) {
    sendButton.textContent = `🤖 Generating Messages... (${generating} left)`;
  } else if (ready > 0) {
    sendButton.textContent = `💬 Open ${ready} LinkedIn DMs`;
  } else {
    sendButton.textContent = '💬 Open All LinkedIn DMs';
  }
}

// Populate DM recipients list
function populateDMRecipientsList() {
  const recipientsList = document.getElementById('dm-recipients-list');
  recipientsList.innerHTML = '';
  
  dmCampaignData.forEach((dmData, index) => {
    const recipientItem = document.createElement('div');
    recipientItem.className = `recipient-item ${dmData.status}`;
    recipientItem.innerHTML = `
      <div class="recipient-info">
        <div class="recipient-name">${dmData.name}</div>
        <div class="recipient-status ${dmData.status}">${dmData.status}</div>
      </div>
      <div class="recipient-actions">
        ${dmData.status === 'ready' ? '✅' : '⏳'}
      </div>
    `;
    
    recipientItem.addEventListener('click', () => selectDMRecipient(index));
    recipientsList.appendChild(recipientItem);
  });
}

// Select DM recipient
function selectDMRecipient(index) {
  selectedDMRecipientIndex = index;
  
  // Update UI selection
  document.querySelectorAll('.recipient-item').forEach((item, i) => {
    item.classList.toggle('selected', i === index);
  });
  
  // Load message editor
  loadDMEditor(dmCampaignData[index]);
}

// Load DM editor
function loadDMEditor(dmData) {
  const editorContent = document.getElementById('dm-editor-content');
  
  editorContent.innerHTML = `
    <div class="email-form">
      <div class="form-group">
        <label class="form-label">To: ${dmData.name}</label>
        <div class="form-value">${dmData.linkedinUrl}</div>
      </div>
      
      <div class="form-group">
        <label for="dm-message-input" class="form-label">LinkedIn Message:</label>
        <div class="message-editor-container">
          <div class="message-preview">
            <div class="preview-header">Preview:</div>
            <div class="preview-content" id="dm-message-preview">${formatMessageForPreview(dmData.message)}</div>
          </div>
          <textarea 
            id="dm-message-input" 
            class="form-textarea" 
            placeholder="Your personalized LinkedIn message..."
          >${dmData.message}</textarea>
        </div>
      </div>
      
      <div class="form-actions">
        <button id="mark-dm-ready-btn" class="primary-button ${dmData.status === 'ready' ? 'disabled' : ''}">
          ${dmData.status === 'ready' ? '✅ Ready' : '📝 Mark as Ready'}
        </button>
        <button id="open-dm-now-btn" class="secondary-button">
          💬 Open LinkedIn DM Now
        </button>
      </div>
    </div>
  `;
  
  // Add event listeners for this message
  const markReadyBtn = document.getElementById('mark-dm-ready-btn');
  const openNowBtn = document.getElementById('open-dm-now-btn');
  const messageInput = document.getElementById('dm-message-input');
  
  if (markReadyBtn && dmData.status !== 'ready') {
    markReadyBtn.addEventListener('click', () => markDMReady(selectedDMRecipientIndex));
  }
  
  if (openNowBtn) {
    openNowBtn.addEventListener('click', () => openSingleLinkedInDM(selectedDMRecipientIndex));
  }
  
  if (messageInput) {
    messageInput.addEventListener('input', (e) => {
      dmCampaignData[selectedDMRecipientIndex].message = e.target.value;
      // Update preview in real-time
      const preview = document.getElementById('dm-message-preview');
      if (preview) {
        preview.innerHTML = formatMessageForPreview(e.target.value);
      }
    });
  }
}

// Format message for preview display
function formatMessageForPreview(message) {
  if (!message) return '';
  
  return message
    .replace(/\n/g, '<br>') // Convert line breaks to HTML
    .replace(/(Hi\s+\w+,)/g, '<strong>$1</strong>') // Bold the greeting
    .replace(/(Best,)/g, '<strong>$1</strong>') // Bold the signature
    .replace(/(TheNetwrk)/g, '<em>$1</em>'); // Italicize TheNetwrk mentions
}

// Mark DM as ready
function markDMReady(index) {
  dmCampaignData[index].status = 'ready';
  updateDMCampaignStats();
  populateDMRecipientsList();
  
  // Update the current editor
  if (selectedDMRecipientIndex === index) {
    loadDMEditor(dmCampaignData[index]);
  }
  
  showSuccess(`Message for ${dmCampaignData[index].name} marked as ready!`);
}

// Generate AI-powered personalized LinkedIn message
async function generatePersonalizedLinkedInMessage(prospect, senderName = 'Lawrence') {
  try {
    console.log('Generating AI-powered message for:', prospect.name);
    
    const response = await fetch('http://localhost:3000/api/generate-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prospect: prospect,
        senderName: senderName,
        messageType: 'linkedin'
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('AI-generated message received for:', prospect.name);
      return result.message;
    } else {
      throw new Error(result.error || 'Message generation failed');
    }
    
  } catch (error) {
    console.error('Error generating AI message:', error);
    
    // Fallback to simple personalized message
    const firstName = prospect.name ? prospect.name.split(' ')[0] : 'there';
    return `Hey ${firstName}!

Saw your profile and thought you might be interested in TheNetwrk - we're a tight-knit community helping people land amazing tech jobs.

No generic advice here, just real coaching and connections to startups that are actually hiring.

Worth a quick chat?

Best,
${senderName}

P.S. Check us out: welcometothenetwork.xyz`;
  }
}

// Setup DM modal event listeners
function setupDMModalEventListeners() {
  // Close modal
  document.getElementById('close-dm-modal').addEventListener('click', closeDMModal);
  
  // Send all DMs
  document.getElementById('send-all-dms-btn').addEventListener('click', openAllReadyLinkedInDMs);
  
  // Save drafts
  document.getElementById('save-all-dm-drafts-btn').addEventListener('click', saveAllDMDrafts);
  
  // Sender name change
  const senderNameInput = document.getElementById('dm-sender-name-input');
  senderNameInput.addEventListener('input', async (e) => {
    await updateAllDMMessagesSenderName(e.target.value);
  });
}

// Close DM modal
function closeDMModal() {
  document.getElementById('dm-preview-modal').style.display = 'none';
  dmCampaignData = [];
  selectedDMRecipientIndex = -1;
}

// Update all DM messages with new sender name
async function updateAllDMMessagesSenderName(newSenderName) {
  console.log('Updating sender name to:', newSenderName, 'for', dmCampaignData.length, 'messages');
  
  // Update sender name and regenerate messages
  for (let i = 0; i < dmCampaignData.length; i++) {
    dmCampaignData[i].senderName = newSenderName;
    dmCampaignData[i].status = 'generating';
    
    try {
      dmCampaignData[i].message = await generatePersonalizedLinkedInMessage(dmCampaignData[i].prospect, newSenderName);
      dmCampaignData[i].status = 'pending';
    } catch (error) {
      console.error('Error regenerating message:', error);
      dmCampaignData[i].message = `Hey ${dmCampaignData[i].prospect.name.split(' ')[0]}! Interested in connecting about TheNetwrk?`;
      dmCampaignData[i].status = 'pending';
    }
    
    // Update UI as messages are regenerated
    updateDMCampaignStats();
    populateDMRecipientsList();
  }
  
  // Refresh current editor if one is selected
  if (selectedDMRecipientIndex >= 0) {
    loadDMEditor(dmCampaignData[selectedDMRecipientIndex]);
  }
}

// Open all ready LinkedIn DMs
function openAllReadyLinkedInDMs() {
  const readyDMs = dmCampaignData.filter(dm => dm.status === 'ready');
  
  if (readyDMs.length === 0) {
    showError('No DMs marked as ready to send.');
    return;
  }
  
  const senderName = document.getElementById('dm-sender-name-input').value || 'Lawrence';
  
  if (!confirm(`Open ${readyDMs.length} LinkedIn DM tabs with pre-filled messages?`)) {
    return;
  }
  
  showSuccess(`Opening ${readyDMs.length} LinkedIn DMs...`);
  
  // Open each LinkedIn DM in sequence with delays
  readyDMs.forEach((dmData, index) => {
    setTimeout(() => {
      openLinkedInDMTab(dmData.prospect, dmData.message);
      
      // Mark as sent
      const originalIndex = dmCampaignData.findIndex(dm => dm.prospect.id === dmData.prospect.id);
      if (originalIndex >= 0) {
        dmCampaignData[originalIndex].status = 'sent';
      }
      
      // Update UI after last one
      if (index === readyDMs.length - 1) {
        setTimeout(() => {
          updateDMCampaignStats();
          populateDMRecipientsList();
          showSuccess(`All ${readyDMs.length} LinkedIn DMs opened! Check your browser tabs.`);
        }, 2000);
      }
    }, index * 3000); // 3 second delay between opens
  });
  
  // Close modal after starting
  setTimeout(() => {
    closeDMModal();
  }, 1000);
}

// Open single LinkedIn DM
function openSingleLinkedInDM(index) {
  const dmData = dmCampaignData[index];
  openLinkedInDMTab(dmData.prospect, dmData.message);
  
  // Mark as sent
  dmData.status = 'sent';
  updateDMCampaignStats();
  populateDMRecipientsList();
  
  showSuccess(`LinkedIn DM opened for ${dmData.name}!`);
}

// Open LinkedIn DM tab with pre-filled message
function openLinkedInDMTab(prospect, message) {
  console.log('Opening LinkedIn DM for:', prospect.name, 'URL:', prospect.linkedinUrl);
  
  // Extract LinkedIn profile ID from URL - try multiple formats
  let profileId = null;
  
  try {
    // Format 1: /in/profilename/
    if (prospect.linkedinUrl.includes('/in/')) {
      profileId = prospect.linkedinUrl.split('/in/')[1]?.split('/')[0]?.split('?')[0];
    }
    
    // Format 2: Direct profile ID
    if (!profileId && prospect.linkedinUrl.includes('linkedin.com')) {
      const urlParts = prospect.linkedinUrl.split('/');
      for (let i = 0; i < urlParts.length; i++) {
        if (urlParts[i] === 'in' && urlParts[i + 1]) {
          profileId = urlParts[i + 1].split('?')[0];
          break;
        }
      }
    }
    
    console.log('Extracted profile ID:', profileId, 'from URL:', prospect.linkedinUrl);
    
    if (!profileId) {
      throw new Error('Could not extract profile ID');
    }
    
    // LinkedIn messaging URL formats to try
    const messagingUrls = [
      `https://www.linkedin.com/messaging/compose/?recipient=${profileId}`,
      `https://www.linkedin.com/messaging/thread/compose/?recipient=${profileId}`,
      `https://www.linkedin.com/in/${profileId}/detail/contact-info/`,
      prospect.linkedinUrl // Fallback to profile URL
    ];
    
    console.log('Trying messaging URLs:', messagingUrls);
    
    // Try the first messaging URL
    const messagingUrl = messagingUrls[0];
    
    // Open LinkedIn messaging in new tab
    chrome.tabs.create({ url: messagingUrl, active: true }, (tab) => {
      console.log(`Opened LinkedIn DM tab for ${prospect.name}: ${messagingUrl}`);
      
      // Wait longer for LinkedIn to load, then inject the message
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'fillLinkedInMessage',
          message: message,
          recipientName: prospect.name
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Could not inject message (tab may not be ready):', chrome.runtime.lastError.message);
            
            // If messaging compose didn't work, try opening their profile
            console.log('Trying profile URL as fallback...');
            chrome.tabs.update(tab.id, { url: prospect.linkedinUrl }, () => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'openLinkedInMessaging',
                  message: message,
                  recipientName: prospect.name
                }, (fallbackResponse) => {
                  if (chrome.runtime.lastError) {
                    console.log('Fallback also failed, user will need to send manually');
                  }
                });
              }, 3000);
            });
          } else {
            console.log('Message injected successfully for:', prospect.name);
          }
        });
      }, 4000); // Longer wait time
    });
    
  } catch (error) {
    console.error('Error opening LinkedIn DM:', error);
    showError(`Could not open DM for ${prospect.name}. Opening profile instead...`);
    
    // Fallback: open their profile page
    chrome.tabs.create({ url: prospect.linkedinUrl, active: true }, (tab) => {
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'showLinkedInMessage',
          message: message,
          recipientName: prospect.name
        });
      }, 3000);
    });
  }
}

// Save all DM drafts
function saveAllDMDrafts() {
  chrome.storage.local.set({
    dmDrafts: dmCampaignData,
    dmDraftsSavedAt: new Date().toISOString()
  }, () => {
    showSuccess(`Saved ${dmCampaignData.length} DM drafts to local storage.`);
  });
}

// Initial load
initializeDashboard();