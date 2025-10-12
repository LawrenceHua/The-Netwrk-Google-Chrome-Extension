/**
 * TheNetwrk Message Drafting System
 * Finds job seekers with 50%+ scores and drafts personalized messages
 */

let allProspects = [];
let selectedProspect = null;
let selectedMessage = null;
let emailAuthStatus = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);

function init() {
  console.log('🚀 TheNetwrk Message Drafting System loaded');
  console.log('🔍 Checking DOM elements...');
  console.log('   - email-status-text:', !!document.getElementById('email-status-text'));
  console.log('   - email-login-btn:', !!document.getElementById('email-login-btn'));
  console.log('   - load-prospects:', !!document.getElementById('load-prospects'));
  console.log('   - bulk-review-and-send:', !!document.getElementById('bulk-review-and-send'));
  
  setupEventListeners();
  updateStats();
  
  // Check email auth with delay to ensure server is ready
  setTimeout(() => {
    checkEmailAuth();
  }, 1000);
}

function setupEventListeners() {
  // Load prospects button - load job seekers with emails
  const loadBtn = document.getElementById('load-prospects');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadJobSeekersWithEmails);
  }
  
  // Bulk review and send button
  const bulkReviewBtn = document.getElementById('bulk-review-and-send');
  if (bulkReviewBtn) {
    bulkReviewBtn.addEventListener('click', openBulkReviewAndSend);
  }
  
  // Legacy buttons (keep for backward compatibility)
  const draftAllBtn = document.getElementById('draft-all-messages');
  if (draftAllBtn) {
    draftAllBtn.addEventListener('click', draftAllMessages);
  }
  
  const bulkReviewLegacy = document.getElementById('bulk-review');
  if (bulkReviewLegacy) {
    bulkReviewLegacy.addEventListener('click', openBulkReview);
  }
  
  const sendReadyBtn = document.getElementById('send-all-ready');
  if (sendReadyBtn) {
    sendReadyBtn.addEventListener('click', sendAllReadyMessages);
  }
  
  const sendEmailsBtn = document.getElementById('send-all-emails');
  if (sendEmailsBtn) {
    sendEmailsBtn.addEventListener('click', sendAllEmails);
  }
  
  // Email authentication
  document.getElementById('email-login-btn').addEventListener('click', openEmailModal);
  document.querySelector('.close-email-modal').addEventListener('click', closeEmailModal);
  document.getElementById('email-login-submit').addEventListener('click', emailLogin);
  document.getElementById('email-logout').addEventListener('click', emailLogout);
  
  // Modal close buttons
  document.querySelector('.close-modal').addEventListener('click', closeModal);
  document.querySelector('.close-bulk-modal').addEventListener('click', closeBulkModal);
  
  // Modal actions
  document.getElementById('regenerate-messages').addEventListener('click', regenerateMessages);
  document.getElementById('mark-ready').addEventListener('click', markMessageReady);
  
  // Bulk review actions
  document.getElementById('approve-all-recommended').addEventListener('click', approveAllRecommended);
  document.getElementById('mark-all-ready').addEventListener('click', markAllReady);
  
  // Close modals when clicking outside
  document.getElementById('message-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('message-modal')) {
      closeModal();
    }
  });
  
  document.getElementById('bulk-review-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('bulk-review-modal')) {
      closeBulkModal();
    }
  });
  
  // Event delegation for dynamically created elements
  document.addEventListener('click', handleDynamicClicks);
}

function handleDynamicClicks(event) {
  const element = event.target.closest('[data-action]');
  if (!element) return;
  
  const action = element.getAttribute('data-action');
  const prospectId = element.getAttribute('data-prospect-id');
  const version = element.getAttribute('data-version');
  
  switch (action) {
    case 'linkedin-link':
      event.stopPropagation();
      break;
      
    case 'draft-message':
      if (prospectId) draftMessage(prospectId);
      break;
      
    case 'view-message':
      if (prospectId) viewMessage(prospectId);
      break;
      
    case 'send-single-message':
      if (prospectId) sendSingleMessage(prospectId);
      break;
      
    case 'select-message':
      if (version) selectMessage(version);
      break;
      
    case 'select-bulk-message':
      if (prospectId && version) selectBulkMessage(prospectId, version);
      break;
  }
}

// Load job seekers with emails specifically
async function loadJobSeekersWithEmails() {
  console.log('📧 Loading job seekers with email addresses...');
  
  const loadButton = document.getElementById('load-prospects');
  loadButton.disabled = true;
  loadButton.textContent = '🔄 Loading...';
  
  try {
    // Get all prospects from storage
    chrome.storage.local.get(['prospects'], (result) => {
      const allStoredProspects = result.prospects || [];
      
      // Filter for prospects with email addresses (any job seeker score)
      const prospectsWithEmails = allStoredProspects.filter(prospect => {
        const hasEmail = (prospect.email && prospect.email.trim()) ||
                        (prospect.activityEmails && prospect.activityEmails.length > 0);
        
        return hasEmail && prospect.isResearched;
      });
      
      console.log(`✅ Found ${prospectsWithEmails.length} prospects with email addresses`);
      console.log(`📊 Sample prospects:`, prospectsWithEmails.slice(0, 3).map(p => ({
        name: p.name,
        email: p.email || p.activityEmails?.[0],
        score: p.jobSeekerScore
      })));
      
      allProspects = prospectsWithEmails.map(prospect => ({
        ...prospect,
        messageStatus: 'pending', // pending, drafted, ready, sent
        draftedEmail: null,
        emailSubject: '',
        finalEmail: ''
      }));
      
      // Sort by job seeker score (highest first)
      allProspects.sort((a, b) => (b.jobSeekerScore || 0) - (a.jobSeekerScore || 0));
      
      renderEmailProspectsList();
      updateStats();
      updateButtons();
      
      loadButton.disabled = false;
      loadButton.textContent = '📧 Load Job Seekers with Emails';
      
      if (prospectsWithEmails.length === 0) {
        showEmptyState('No prospects with email addresses found. Run prospect research first to find emails.');
      } else {
        showNotificationInPage(`📧 Loaded ${prospectsWithEmails.length} job seekers with emails!`, 'success');
      }
    });
    
  } catch (error) {
    console.error('❌ Error loading job seekers:', error);
    loadButton.disabled = false;
    loadButton.textContent = '📧 Load Job Seekers with Emails';
    alert('Failed to load job seekers: ' + error.message);
  }
}

// Render email prospects list with clean UI
function renderEmailProspectsList() {
  console.log('📋 Rendering email prospects list...');
  
  const container = document.getElementById('prospects-container');
  if (!container) return;
  
  if (allProspects.length === 0) {
    showEmptyState('No prospects with emails loaded yet.');
    return;
  }
  
  let html = '<div class="email-prospects-list">';
  
  allProspects.forEach((prospect, index) => {
    const email = prospect.email || prospect.activityEmails?.[0] || 'No email';
    const statusClass = prospect.messageStatus || 'pending';
    const statusIcon = {
      'pending': '⏳',
      'drafted': '✍️',
      'ready': '✅',
      'sent': '📤'
    }[statusClass] || '❓';
    
    html += `
      <div class="email-prospect-card ${statusClass}" data-prospect-id="${prospect.id}">
        <div class="prospect-info">
          <div class="prospect-name-large">${index + 1}. ${prospect.name}</div>
          <div class="prospect-email-display">📧 ${email}</div>
          ${prospect.headline ? `<div class="prospect-headline-small">${prospect.headline.substring(0, 80)}...</div>` : ''}
          <div class="prospect-meta">
            <span class="score-badge">Job Seeker: ${prospect.jobSeekerScore || 0}%</span>
            ${prospect.keyword ? `<span class="keyword-badge">From: ${prospect.keyword}</span>` : ''}
          </div>
        </div>
        <div class="prospect-status-actions">
          <div class="status-indicator ${statusClass}">${statusIcon} ${statusClass.toUpperCase()}</div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  
  container.innerHTML = html;
  console.log(`✅ Rendered ${allProspects.length} prospects with emails`);
  
  // Enable bulk review button
  const bulkBtn = document.getElementById('bulk-review-and-send');
  if (bulkBtn && allProspects.length > 0) {
    bulkBtn.disabled = false;
  }
}

// Open bulk review and send flow
async function openBulkReviewAndSend() {
  console.log('✍️ Starting bulk review and send flow...');
  
  if (!emailAuthStatus) {
    alert('⚠️ Please login with your email credentials first!\n\nClick "📧 Setup Email" to authenticate.');
    document.getElementById('email-login-btn').click();
    return;
  }
  
  if (allProspects.length === 0) {
    alert('No prospects loaded. Click "📧 Load Job Seekers with Emails" first.');
    return;
  }
  
  const confirmed = confirm(`📧 Bulk Email Campaign\n\nThis will draft personalized emails for ${allProspects.length} prospects with emails.\n\nThis uses AI and may take 1-2 minutes.\n\nContinue?`);
  if (!confirmed) return;
  
  // Draft personalized emails for all prospects
  showNotificationInPage('✍️ Drafting personalized emails with AI...', 'info');
  await draftAllPersonalizedEmails();
  
  // Show bulk review interface
  showBulkEmailReviewModal();
}

// Draft personalized emails for all prospects with proper formatting
async function draftAllPersonalizedEmails() {
  console.log(`✍️ Drafting ${allProspects.length} personalized emails...`);
  
  for (let i = 0; i < allProspects.length; i++) {
    const prospect = allProspects[i];
    
    console.log(`✍️ [${i + 1}/${allProspects.length}] Drafting for ${prospect.name}...`);
    
    try {
      const personalizedEmail = await draftPersonalizedEmail(prospect);
      
      prospect.finalEmail = personalizedEmail;
      prospect.emailSubject = `Exciting Opportunity for Your Tech Career`;
      prospect.messageStatus = 'drafted';
      
      console.log(`✅ Drafted email for ${prospect.name}`);
      
      // Small delay to avoid overwhelming the AI
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Failed to draft email for ${prospect.name}:`, error);
      prospect.messageStatus = 'error';
      prospect.draftError = error.message;
    }
  }
  
  console.log(`✅ Completed drafting ${allProspects.length} emails`);
  renderEmailProspectsList();
}

// Draft a single personalized email with proper formatting
async function draftPersonalizedEmail(prospect) {
  const firstName = prospect.name.split(' ')[0];
  
  // Create personalized message based on their profile data
  let personalizedContent = '';
  
  // Personalization based on available data
  if (prospect.headline && prospect.headline.length > 0) {
    if (prospect.headline.toLowerCase().includes('engineer') || 
        prospect.headline.toLowerCase().includes('developer')) {
      personalizedContent = `I came across your profile and was impressed by your engineering background. `;
    } else if (prospect.headline.toLowerCase().includes('manager') || 
               prospect.headline.toLowerCase().includes('director')) {
      personalizedContent = `I noticed your leadership experience and thought you might be interested in this opportunity. `;
    } else {
      personalizedContent = `I came across your profile on LinkedIn and was impressed by your background. `;
    }
  } else {
    personalizedContent = `I wanted to reach out because you might be interested in an exciting opportunity. `;
  }
  
  // Add job seeker context if available
  if (prospect.jobSeekerScore >= 70) {
    personalizedContent += `I see you're actively exploring new opportunities in tech. `;
  } else if (prospect.jobSeekerScore >= 40) {
    personalizedContent += `Given your background, I thought this might be relevant to your career goals. `;
  }
  
  // Build the complete email with proper formatting
  const emailBody = `Hi ${firstName},

${personalizedContent}

I wanted to introduce you to TheNetwrk - a community designed to help professionals like you break into and advance in the tech industry.

TheNetwrk offers:
• Weekly coaching sessions with industry experts
• Direct connections to YC-backed startups
• Accountability partners for your job search
• Exclusive job pipeline and warm introductions

Founded by Abigayle (who landed 8+ offers), we're focused on helping job seekers cut through the noise and land their dream tech roles.

You can learn more and join our community here:
https://welcometothenetwork.xyz/

Would love to have you as part of the community!

Best,
Lawrence Hua
Growth Engineer Intern
TheNetwrk`;

  return emailBody;
}

// Show bulk email review modal
function showBulkEmailReviewModal() {
  console.log('📋 Opening bulk email review modal...');
  
  const modal = document.getElementById('bulk-review-modal');
  if (!modal) {
    console.error('❌ Bulk review modal not found');
    return;
  }
  
  // Build review interface
  const modalBody = modal.querySelector('.modal-body');
  if (!modalBody) return;
  
  let html = `
    <div class="bulk-email-review">
      <div class="review-header">
        <h3>📧 Review ${allProspects.length} Personalized Emails</h3>
        <p>Review each email below. You can edit them before sending.</p>
        <div class="bulk-actions">
          <button class="action-button success" onclick="sendAllDraftedEmails()">
            🚀 Send All ${allProspects.length} Emails
          </button>
          <button class="action-button secondary" onclick="closeBulkReviewModal()">
            ❌ Cancel
          </button>
        </div>
      </div>
      <div class="email-review-list">
  `;
  
  allProspects.forEach((prospect, index) => {
    const email = prospect.email || prospect.activityEmails?.[0];
    
    html += `
      <div class="email-review-card">
        <div class="email-review-header">
          <span class="email-number">#${index + 1}</span>
          <strong>${prospect.name}</strong>
          <span class="email-address">→ ${email}</span>
        </div>
        <div class="email-preview">
          <div class="email-subject">
            <strong>Subject:</strong> ${prospect.emailSubject || 'Exciting Opportunity for Your Tech Career'}
          </div>
          <div class="email-body">
            <textarea class="email-edit" data-prospect-id="${prospect.id}" rows="12">${prospect.finalEmail || ''}</textarea>
          </div>
        </div>
        <div class="email-review-actions">
          <button class="btn-approve" onclick="approveEmail('${prospect.id}')">✅ Approve</button>
          <button class="btn-skip" onclick="skipEmail('${prospect.id}')">⏭️ Skip</button>
        </div>
      </div>
    `;
  });
  
  html += `
      </div>
    </div>
  `;
  
  modalBody.innerHTML = html;
  modal.style.display = 'block';
  
  // Add change listeners to textareas
  document.querySelectorAll('.email-edit').forEach(textarea => {
    textarea.addEventListener('change', (e) => {
      const prospectId = e.target.dataset.prospectId;
      const prospect = allProspects.find(p => p.id === prospectId);
      if (prospect) {
        prospect.finalEmail = e.target.value;
        console.log(`📝 Updated email for ${prospect.name}`);
      }
    });
  });
}

// Send all drafted emails
async function sendAllDraftedEmails() {
  const approvedEmails = allProspects.filter(p => p.messageStatus === 'ready' || p.finalEmail);
  
  if (approvedEmails.length === 0) {
    alert('No emails approved for sending. Please approve at least one email.');
    return;
  }
  
  const confirmed = confirm(`🚀 Send ${approvedEmails.length} Emails?\n\nThis will send personalized emails from your Gmail account.\n\nAre you sure?`);
  if (!confirmed) return;
  
  console.log(`📤 Sending ${approvedEmails.length} emails...`);
  
  let sentCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < approvedEmails.length; i++) {
    const prospect = approvedEmails[i];
    const email = prospect.email || prospect.activityEmails?.[0];
    
    console.log(`📤 [${i + 1}/${approvedEmails.length}] Sending to ${prospect.name} (${email})...`);
    
    try {
      const response = await fetch('http://localhost:3000/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: prospect.emailSubject || 'Exciting Opportunity for Your Tech Career',
          message: prospect.finalEmail,
          name: prospect.name,
          senderName: 'Lawrence Hua',
          profileData: prospect
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        prospect.messageStatus = 'sent';
        prospect.sentAt = new Date().toISOString();
        sentCount++;
        console.log(`✅ Sent to ${prospect.name}`);
      } else {
        failedCount++;
        console.error(`❌ Failed to send to ${prospect.name}:`, result.error);
      }
      
    } catch (error) {
      failedCount++;
      console.error(`❌ Error sending to ${prospect.name}:`, error);
    }
    
    // Delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`✅ Email campaign complete: ${sentCount} sent, ${failedCount} failed`);
  
  closeBulkReviewModal();
  showNotificationInPage(`📤 Email Campaign Complete!\n\n✅ Sent: ${sentCount}\n❌ Failed: ${failedCount}`, 'success');
  
  // Refresh the list
  renderEmailProspectsList();
}

// Helper functions for email review
function approveEmail(prospectId) {
  const prospect = allProspects.find(p => p.id === prospectId);
  if (prospect) {
    prospect.messageStatus = 'ready';
    console.log(`✅ Approved email for ${prospect.name}`);
    
    // Update card visual
    const card = document.querySelector(`[data-prospect-id="${prospectId}"]`);
    if (card) {
      card.classList.remove('pending');
      card.classList.add('ready');
      const statusIndicator = card.querySelector('.status-indicator');
      if (statusIndicator) {
        statusIndicator.textContent = '✅ READY';
        statusIndicator.className = 'status-indicator ready';
      }
    }
  }
}

function skipEmail(prospectId) {
  const prospect = allProspects.find(p => p.id === prospectId);
  if (prospect) {
    prospect.messageStatus = 'skipped';
    console.log(`⏭️ Skipped email for ${prospect.name}`);
    
    // Update card visual
    const card = document.querySelector(`[data-prospect-id="${prospectId}"]`);
    if (card) {
      card.style.opacity = '0.5';
      const statusIndicator = card.querySelector('.status-indicator');
      if (statusIndicator) {
        statusIndicator.textContent = '⏭️ SKIPPED';
        statusIndicator.className = 'status-indicator skipped';
      }
    }
  }
}

function closeBulkReviewModal() {
  const modal = document.getElementById('bulk-review-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function renderProspects() {
  const container = document.getElementById('prospects-container');
  const emptyState = document.getElementById('empty-state');
  
  if (allProspects.length === 0) {
    if (emptyState) {
      emptyState.style.display = 'block';
    }
    return;
  }
  
  if (emptyState) {
    emptyState.style.display = 'none';
  }
  
  // Create overview grid layout
  const prospectsHTML = `
    <div class="prospects-grid">
      ${allProspects.map(prospect => {
        const statusClass = getStatusClass(prospect.messageStatus);
        const scoreClass = getScoreClass(prospect.jobSeekerScore);
        
        return `
          <div class="prospect-card-overview ${statusClass}" data-prospect-id="${prospect.id}">
            <div class="prospect-overview-header">
              <div class="prospect-name-section">
                <h4>${prospect.name}</h4>
                <div class="prospect-headline">${prospect.headline || 'No headline'}</div>
              </div>
              <div class="prospect-status-section">
                <span class="score-badge ${scoreClass}">${prospect.jobSeekerScore}%</span>
                <div class="status-indicator-row">
                  <span class="status-indicator status-${prospect.messageStatus}"></span>
                  ${getStatusText(prospect.messageStatus)}
                </div>
              </div>
            </div>
            
            <div class="prospect-overview-details">
              <div class="detail-row">
                <span class="detail-label">LinkedIn:</span>
                <a href="${prospect.linkedinUrl}" target="_blank" class="linkedin-link" data-action="linkedin-link">
                  View Profile
                </a>
              </div>
              <div class="detail-row">
                <span class="detail-label">Stage:</span>
                <span class="detail-value">${prospect.careerStage || 'Unknown'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Industry:</span>
                <span class="detail-value">${prospect.industry || 'Unknown'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Location:</span>
                <span class="detail-value">${prospect.location || 'Unknown'}</span>
              </div>
              <div class="detail-row email-status-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">
                  ${hasEmail(prospect) ? 
                    `<span class="email-status found">📧 Available</span>` : 
                    `<span class="email-status missing">❌ None Found</span>`
                  }
                </span>
              </div>
            </div>
            
            <div class="prospect-overview-footer">
              ${getOverviewFooter(prospect)}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  container.innerHTML = prospectsHTML;
  
  // Add click event listeners to each card (better than onclick attributes)
  document.querySelectorAll('.prospect-card-overview').forEach(card => {
    card.addEventListener('click', function() {
      const prospectId = this.getAttribute('data-prospect-id');
      console.log('🖱️ Card clicked for prospect:', prospectId);
      openProspectModal(prospectId);
    });
  });
}

function getOverviewFooter(prospect) {
  switch (prospect.messageStatus) {
    case 'pending':
      return `<div class="footer-status">⏳ Waiting for draft...</div>`;
    case 'drafted':
      return `
        <div class="footer-status">✍️ Message drafted - Click to review</div>
        <div class="message-preview">${prospect.selectedMessage?.text?.substring(0, 60)}...</div>
      `;
    case 'ready':
      return `
        <div class="footer-status ready">✅ Ready to send</div>
        <div class="message-preview">${prospect.selectedMessage?.text?.substring(0, 60)}...</div>
      `;
    case 'sent':
      return `
        <div class="footer-status sent">🚀 Message sent</div>
        <div class="sent-timestamp">Sent: ${new Date(prospect.sentAt).toLocaleString()}</div>
      `;
    default:
      return `<div class="footer-status">Click to edit</div>`;
  }
}

function getStatusClass(status) {
  const classes = {
    pending: '',
    drafted: 'drafted',
    ready: 'ready',
    sent: 'sent'
  };
  return classes[status] || '';
}

function getScoreClass(score) {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function getStatusText(status) {
  const texts = {
    pending: 'Ready to Draft',
    drafted: 'Message Drafted',
    ready: 'Ready to Send',
    sent: 'Message Sent'
  };
  return texts[status] || status;
}

function getActionButtons(prospect) {
  switch (prospect.messageStatus) {
    case 'pending':
      return `<button class="draft-button" data-action="draft-message" data-prospect-id="${prospect.id}">✍️ Draft Message</button>`;
    case 'drafted':
      return `<button class="view-button" data-action="view-message" data-prospect-id="${prospect.id}">👀 View & Edit</button>`;
    case 'ready':
      return `
        <button class="view-button" data-action="view-message" data-prospect-id="${prospect.id}">👀 View Message</button>
        <button class="ready-button" data-action="send-single-message" data-prospect-id="${prospect.id}">🚀 Send Now</button>
      `;
    case 'sent':
      return `<span class="sent-badge">✅ Sent</span>`;
    default:
      return '';
  }
}

function addProspectEventListeners() {
  // Event listeners are added via onclick attributes in getActionButtons
  // This approach is simpler for dynamic content
}

async function draftMessage(prospectId) {
  console.log(`✍️ Drafting message for prospect: ${prospectId}`);
  
  const prospect = allProspects.find(p => p.id === prospectId);
  if (!prospect) {
    console.error('Prospect not found:', prospectId);
    return;
  }
  
  selectedProspect = prospect;
  
  // Show loading in modal
  openModal(prospect);
  showModalLoading('Crafting personalized message...');
  
  try {
    const response = await fetch('http://localhost:3000/api/draft-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: prospect.name,
        headline: prospect.headline,
        jobSeekerScore: prospect.jobSeekerScore,
        careerStage: prospect.careerStage,
        techBackground: prospect.techBackground,
        industry: prospect.industry,
        keySkills: prospect.keySkills,
        currentRole: prospect.currentRole,
        jobSeekingSignals: prospect.jobSeekingSignals,
        experiences: prospect.experiences,
        about: prospect.about,
        posts: prospect.posts,
        comments: prospect.comments,
        location: prospect.location,
        experienceYears: prospect.experienceYears
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Messages drafted for ${prospect.name}:`);
      console.log('📊 Full AI result:', result);
      console.log('📝 Messages array:', result.messages);
      console.log('🎯 Messages count:', result.messages?.length || 0);
      
      if (!result.messages || result.messages.length === 0) {
        console.error('❌ AI returned no messages for', prospect.name);
        showModalError('AI did not generate any message options. Please try again.');
        return;
      }
      
      // Update prospect with drafted messages
      prospect.draftedMessages = result.messages;
      prospect.messageStatus = 'drafted';
      prospect.selectedMessage = result.messages?.find(m => m.version === result.recommended) || result.messages?.[0];
      prospect.draftReasoning = result.reasoning;
      prospect.tokensUsed = result.tokensUsed;
      
      // Re-render and show messages
      renderProspects();
      updateStats();
      showDraftedMessages(result);
      
    } else {
      throw new Error(result.error || 'Failed to draft message');
    }
    
  } catch (error) {
    console.error(`❌ Error drafting message for ${prospect.name}:`, error);
    
    // Show error in modal if it's open for this prospect
    if (selectedProspect && selectedProspect.id === prospect.id) {
      showModalError('Failed to draft message: ' + error.message);
    }
    
    // Don't call renderProspects() here to avoid the DOM error
    // The prospect status remains 'pending' which is correct
  }
}

// Open prospect modal from overview grid
function openProspectModal(prospectId) {
  console.log(`🔍 Opening modal for prospect: ${prospectId}`);
  
  const prospect = allProspects.find(p => p.id === prospectId);
  if (!prospect) {
    console.error('❌ Prospect not found:', prospectId);
    alert('Prospect not found: ' + prospectId);
    return;
  }
  
  console.log(`✅ Found prospect: ${prospect.name}`);
  selectedProspect = prospect;
  
  // If messages haven't been drafted yet, draft them first
  if (prospect.messageStatus === 'pending') {
    console.log(`📝 Drafting messages for ${prospect.name} on-demand...`);
    openModal(prospect);
    showModalLoading('Crafting personalized messages...');
    draftMessage(prospect.id);
    return;
  }
  
  // If messages are drafted, show them
  if (prospect.draftedMessages && prospect.draftedMessages.length > 0) {
    console.log(`📝 Showing ${prospect.draftedMessages.length} drafted messages for ${prospect.name}`);
    openModal(prospect);
    showDraftedMessages({
      messages: prospect.draftedMessages,
      recommended: prospect.selectedMessage?.version || prospect.draftedMessages[0]?.version,
      reasoning: prospect.draftReasoning
    });
  } else {
    console.error('❌ No drafted messages found for prospect:', prospectId);
    alert('No messages found for this prospect. Please try drafting again.');
  }
}

// Make function globally accessible for debugging
window.openProspectModal = openProspectModal;
window.selectBulkMessage = selectBulkMessage;

function openModal(prospect) {
  selectedProspect = prospect;
  document.getElementById('modal-prospect-name').textContent = prospect.name;
  document.getElementById('message-modal').style.display = 'block';
  
  // Populate prospect summary
  const summaryHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">Job Seeker Score</div>
        <div class="summary-value">${prospect.jobSeekerScore}%</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Career Stage</div>
        <div class="summary-value">${prospect.careerStage || 'Unknown'}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Industry</div>
        <div class="summary-value">${prospect.industry || 'Unknown'}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Tech Level</div>
        <div class="summary-value">${prospect.techProficiency || 'Unknown'}</div>
      </div>
    </div>
    <div class="summary-details">
      <p><strong>Headline:</strong> ${prospect.headline || 'No headline'}</p>
      ${prospect.keySkills?.length ? `<p><strong>Key Skills:</strong> ${prospect.keySkills.join(', ')}</p>` : ''}
      ${prospect.jobSeekingSignals?.length ? `<p><strong>Job Seeking Signals:</strong> ${prospect.jobSeekingSignals.join(', ')}</p>` : ''}
    </div>
  `;
  
  document.getElementById('prospect-summary').innerHTML = summaryHTML;
}

function showModalLoading(message) {
  document.getElementById('message-options').innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner">🤖</div>
      <p>${message}</p>
    </div>
  `;
}

function showModalError(error) {
  document.getElementById('message-options').innerHTML = `
    <div class="error-state">
      <p style="color: #e53e3e; text-align: center;">❌ ${error}</p>
    </div>
  `;
}

function showDraftedMessages(result) {
  const messagesHTML = result.messages.map((message, index) => {
    const isRecommended = message.version === result.recommended;
    const isSelected = selectedProspect.selectedMessage?.version === message.version;
    
    return `
      <div class="message-option ${isRecommended ? 'recommended' : ''} ${isSelected ? 'selected' : ''}" 
           data-action="select-message" data-version="${message.version}">
        <div class="message-header">
          <span class="message-version">Version ${message.version}</span>
          <div class="message-badges">
            ${isRecommended ? '<span class="message-badge badge-recommended">Recommended</span>' : ''}
            <span class="message-badge badge-tone">${message.tone}</span>
          </div>
        </div>
        <div class="message-text">${message.text}</div>
        <div class="message-meta">
          <strong>Personalization:</strong> ${message.personalization_hook}
        </div>
      </div>
    `;
  }).join('');
  
  const reasoningHTML = result.reasoning ? `
    <div style="margin-top: 20px; padding: 15px; background: #f7fafc; border-radius: 8px; font-size: 0.9rem; color: #4a5568;">
      <strong>🤖 AI Reasoning:</strong> ${result.reasoning}
    </div>
  ` : '';
  
  document.getElementById('message-options').innerHTML = messagesHTML + reasoningHTML;
}

function selectMessage(version) {
  if (!selectedProspect?.draftedMessages) return;
  
  const message = selectedProspect.draftedMessages.find(m => m.version === version);
  if (message) {
    selectedProspect.selectedMessage = message;
    
    // Update UI
    document.querySelectorAll('.message-option').forEach(option => {
      option.classList.remove('selected');
    });
    event.target.closest('.message-option').classList.add('selected');
    
    console.log(`✅ Selected message version ${version} for ${selectedProspect.name}`);
  }
}

function viewMessage(prospectId) {
  const prospect = allProspects.find(p => p.id === prospectId);
  if (!prospect || !prospect.draftedMessages) {
    console.error('No drafted messages found for prospect:', prospectId);
    return;
  }
  
  openModal(prospect);
  showDraftedMessages({
    messages: prospect.draftedMessages,
    recommended: prospect.selectedMessage?.version || prospect.draftedMessages[0]?.version,
    reasoning: prospect.draftReasoning
  });
}

async function regenerateMessages() {
  if (!selectedProspect) return;
  
  console.log(`🔄 Regenerating messages for ${selectedProspect.name}`);
  await draftMessage(selectedProspect.id);
}

function markMessageReady() {
  if (!selectedProspect || !selectedProspect.selectedMessage) {
    alert('Please select a message first');
    return;
  }
  
  selectedProspect.messageStatus = 'ready';
  
  console.log(`✅ Marked message as ready for ${selectedProspect.name}`);
  console.log(`📝 Selected message: ${selectedProspect.selectedMessage.text}`);
  
  renderProspects();
  updateStats();
  updateButtons();
  closeModal();
}

function closeModal() {
  document.getElementById('message-modal').style.display = 'none';
  selectedProspect = null;
}

function closeBulkModal() {
  document.getElementById('bulk-review-modal').style.display = 'none';
}

function openBulkReview() {
  console.log('👀 Opening bulk review modal...');
  
  const draftedProspects = allProspects.filter(p => p.messageStatus === 'drafted' && p.draftedMessages);
  
  if (draftedProspects.length === 0) {
    alert('No drafted messages to review. Please draft messages first.');
    return;
  }
  
  console.log(`📝 Found ${draftedProspects.length} prospects with drafted messages`);
  
  // Show bulk review modal
  document.getElementById('bulk-review-modal').style.display = 'block';
  
  // Populate bulk review content
  const container = document.getElementById('bulk-review-container');
  const reviewHTML = draftedProspects.map(prospect => {
    return `
      <div class="bulk-review-item" data-prospect-id="${prospect.id}">
        <div class="bulk-review-header">
          <div class="prospect-info">
            <h4>${prospect.name}</h4>
            <div class="prospect-meta">${prospect.jobSeekerScore}% Job Seeker | ${prospect.careerStage} | ${prospect.industry}</div>
          </div>
          <div class="prospect-status">
            <span class="status-badge ${prospect.messageStatus}">${getStatusText(prospect.messageStatus)}</span>
          </div>
        </div>
        
        <div class="message-options-bulk">
          ${prospect.draftedMessages.map((message, index) => {
            const isRecommended = message.version === (prospect.draftedMessages.find(m => m.version === 'A')?.version || prospect.draftedMessages[0]?.version);
            const isSelected = prospect.selectedMessage?.version === message.version;
            
            return `
              <div class="message-option-bulk ${isRecommended ? 'recommended' : ''} ${isSelected ? 'selected' : ''}" 
                   data-action="select-bulk-message" data-prospect-id="${prospect.id}" data-version="${message.version}">
                <div class="message-header-bulk">
                  <span class="message-version">Version ${message.version}</span>
                  <div class="message-badges">
                    ${isRecommended ? '<span class="badge-recommended">Recommended</span>' : ''}
                    <span class="badge-tone">${message.tone}</span>
                  </div>
                </div>
                <div class="message-text-bulk">${message.text}</div>
                <div class="message-meta-bulk">
                  <strong>Hook:</strong> ${message.personalization_hook}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = reviewHTML;
}

function selectBulkMessage(prospectId, version) {
  console.log(`📝 Selecting message version ${version} for prospect ${prospectId}`);
  
  const prospect = allProspects.find(p => p.id === prospectId);
  if (!prospect || !prospect.draftedMessages) return;
  
  const message = prospect.draftedMessages.find(m => m.version === version);
  if (message) {
    prospect.selectedMessage = message;
    
    // Update UI - remove selected class from all options for this prospect
    document.querySelectorAll(`[data-prospect-id="${prospectId}"] .message-option-bulk`).forEach(option => {
      option.classList.remove('selected');
    });
    
    // Add selected class to clicked option
    event.target.closest('.message-option-bulk').classList.add('selected');
    
    console.log(`✅ Selected message for ${prospect.name}: ${message.text.substring(0, 50)}...`);
  }
}

function approveAllRecommended() {
  console.log('✅ Approving all recommended messages...');
  
  const draftedProspects = allProspects.filter(p => p.messageStatus === 'drafted' && p.draftedMessages);
  let approved = 0;
  
  draftedProspects.forEach(prospect => {
    // Find recommended message (usually version A, or first message)
    const recommendedMessage = prospect.draftedMessages.find(m => m.version === 'A') || prospect.draftedMessages[0];
    
    if (recommendedMessage) {
      prospect.selectedMessage = recommendedMessage;
      approved++;
    }
  });
  
  // Update bulk review UI
  openBulkReview();
  
  console.log(`✅ Approved ${approved} recommended messages`);
  showNotificationInPage(`✅ Approved ${approved} recommended messages!`, 'success');
}

function markAllReady() {
  console.log('🚀 Marking all reviewed messages as ready...');
  
  const draftedProspects = allProspects.filter(p => p.messageStatus === 'drafted' && p.selectedMessage);
  let marked = 0;
  
  draftedProspects.forEach(prospect => {
    if (prospect.selectedMessage) {
      prospect.messageStatus = 'ready';
      marked++;
    }
  });
  
  // Update main UI
  renderProspects();
  updateStats();
  updateButtons();
  
  // Close bulk review modal
  closeBulkModal();
  
  console.log(`🚀 Marked ${marked} messages as ready to send`);
  showNotificationInPage(`🚀 ${marked} messages are now ready to send!`, 'success');
}

async function draftAllMessages() {
  console.log('✍️ Starting background message drafting for all pending prospects...');
  
  const pendingProspects = allProspects.filter(p => p.messageStatus === 'pending');
  
  if (pendingProspects.length === 0) {
    alert('No prospects need message drafting');
    return;
  }
  
  const draftButton = document.getElementById('draft-all-messages');
  draftButton.disabled = true;
  draftButton.textContent = `🔄 Drafting in background...`;
  
  // Show progress in stats
  let completed = 0;
  
  // Update UI to show drafting started
  renderProspects();
  updateStats();
  
  console.log(`🚀 Background drafting started for ${pendingProspects.length} prospects`);
  
  // Process all prospects in background (parallel processing for speed)
  const draftPromises = pendingProspects.map(async (prospect, index) => {
    try {
      // Small delay to stagger requests
      await new Promise(resolve => setTimeout(resolve, index * 500));
      
      console.log(`📝 [${index + 1}/${pendingProspects.length}] Drafting for ${prospect.name}...`);
      
      const response = await fetch('http://localhost:3000/api/draft-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: prospect.name,
          headline: prospect.headline,
          jobSeekerScore: prospect.jobSeekerScore,
          careerStage: prospect.careerStage,
          techBackground: prospect.techBackground,
          industry: prospect.industry,
          keySkills: prospect.keySkills,
          currentRole: prospect.currentRole,
          jobSeekingSignals: prospect.jobSeekingSignals,
          experiences: prospect.experiences,
          about: prospect.about,
          posts: prospect.posts,
          comments: prospect.comments,
          location: prospect.location,
          experienceYears: prospect.experienceYears
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.messages && result.messages.length > 0) {
        // Update prospect with drafted messages
        prospect.draftedMessages = result.messages;
        prospect.messageStatus = 'drafted';
        prospect.selectedMessage = result.messages?.find(m => m.version === result.recommended) || result.messages?.[0];
        prospect.draftReasoning = result.reasoning;
        prospect.tokensUsed = result.tokensUsed;
        
        completed++;
        console.log(`✅ [${completed}/${pendingProspects.length}] Drafted for ${prospect.name}`);
        
        // Update UI in real-time
        renderProspects();
        updateStats();
        updateButtons();
        
        // Update button text with progress
        draftButton.textContent = `🔄 Drafted ${completed}/${pendingProspects.length}`;
        
      } else {
        console.error(`❌ Failed to draft for ${prospect.name}:`, result.error);
      }
      
    } catch (error) {
      console.error(`❌ Error drafting for ${prospect.name}:`, error);
    }
  });
  
  // Wait for all drafting to complete
  await Promise.all(draftPromises);
  
  // Final UI update
  draftButton.disabled = false;
  draftButton.textContent = '✍️ Draft All Messages';
  updateButtons();
  
  console.log(`✅ Background drafting complete: ${completed}/${pendingProspects.length} successful`);
  
  // Show completion notification
  if (completed > 0) {
    showNotificationInPage(`🎉 Drafted ${completed} messages! Click any prospect to review and edit.`, 'success');
  } else {
    showNotificationInPage(`❌ No messages were drafted successfully. Please try again.`, 'error');
  }
}

// Add notification system for the drafting page
function showNotificationInPage(message, type = 'info') {
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
    max-width: 400px;
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

async function sendAllReadyMessages() {
  console.log('🚀 Sending all ready messages...');
  
  const readyProspects = allProspects.filter(p => p.messageStatus === 'ready');
  
  if (readyProspects.length === 0) {
    alert('No messages are ready to send');
    return;
  }
  
  const confirmed = confirm(`Send ${readyProspects.length} personalized messages via LinkedIn automation?`);
  if (!confirmed) return;
  
  const sendButton = document.getElementById('send-all-ready');
  sendButton.disabled = true;
  sendButton.textContent = `🔄 Sending 0/${readyProspects.length}...`;
  
  let sent = 0;
  
  for (const prospect of readyProspects) {
    try {
      await sendLinkedInMessage(prospect);
      prospect.messageStatus = 'sent';
      prospect.sentAt = new Date().toISOString();
      sent++;
      
      sendButton.textContent = `🔄 Sending ${sent}/${readyProspects.length}...`;
      
      // Delay between messages to avoid being flagged
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`❌ Failed to send message to ${prospect.name}:`, error);
    }
  }
  
  renderProspects();
  updateStats();
  updateButtons();
  
  sendButton.disabled = false;
  sendButton.textContent = '🚀 Send All Ready Messages';
  
  console.log(`✅ Sent ${sent}/${readyProspects.length} messages`);
  alert(`✅ Sent ${sent} out of ${readyProspects.length} messages automatically!`);
}

async function sendSingleMessage(prospectId) {
  const prospect = allProspects.find(p => p.id === prospectId);
  if (!prospect || prospect.messageStatus !== 'ready') {
    console.error('Prospect not ready for sending:', prospectId);
    return;
  }
  
  try {
    await sendLinkedInMessage(prospect);
    prospect.messageStatus = 'sent';
    prospect.sentAt = new Date().toISOString();
    
    renderProspects();
    updateStats();
    updateButtons();
    
    console.log(`✅ Sent message to ${prospect.name}`);
    
  } catch (error) {
    console.error(`❌ Failed to send message to ${prospect.name}:`, error);
    alert('Failed to send message: ' + error.message);
  }
}

async function sendLinkedInMessage(prospect) {
  console.log(`📤 Sending LinkedIn message to ${prospect.name}...`);
  
  if (!prospect.selectedMessage) {
    throw new Error('No message selected');
  }
  
  // Format the message with the desired template
  const formattedMessage = formatLinkedInMessage(prospect.name, prospect.selectedMessage.text);
  
  // Open LinkedIn profile and auto-fill message
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url: prospect.linkedinUrl, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      // Wait for the tab to load, then inject the message automation script
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'automateLinkedInMessage',
          message: formattedMessage,
          recipientName: prospect.name
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Could not inject automation script:', chrome.runtime.lastError.message);
            // Still resolve - the tab is open, user can manually send
            resolve();
          } else if (response && response.success) {
            console.log(`✅ Message automated for ${prospect.name}`);
            resolve();
          } else {
            console.log('Automation failed, user will need to send manually');
            resolve();
          }
        });
      }, 3000); // Give page time to load
    });
  });
}

function formatLinkedInMessage(personName, messageContent) {
  const theNetwrkPlug = "I'd love to connect you with opportunities that match your skills and career goals through TheNetwrk's personalized job matching platform.";
  
  return `Hey ${personName},

${messageContent}

${theNetwrkPlug}

Best,
Lawrence
Growth Intern`;
}

function updateStats() {
  const total = allProspects.length;
  const drafted = allProspects.filter(p => p.messageStatus === 'drafted' || p.messageStatus === 'ready').length;
  const ready = allProspects.filter(p => p.messageStatus === 'ready').length;
  const sent = allProspects.filter(p => p.messageStatus === 'sent').length;
  const withEmail = allProspects.filter(p => hasEmail(p)).length;
  
  document.getElementById('total-prospects').textContent = total;
  document.getElementById('drafted-count').textContent = drafted;
  document.getElementById('ready-count').textContent = ready;
  document.getElementById('sent-count').textContent = sent;
  document.getElementById('email-count').textContent = withEmail;
}

function hasEmail(prospect) {
  return (prospect.email && prospect.email.trim()) ||
         (prospect.activityEmails && prospect.activityEmails.length > 0) ||
         (prospect.googleEmails && prospect.googleEmails.length > 0);
}

function getProspectEmail(prospect) {
  // Priority: Profile email > Activity emails > Google emails
  if (prospect.email && prospect.email.trim()) {
    return prospect.email.trim();
  }
  
  if (prospect.activityEmails && prospect.activityEmails.length > 0) {
    return prospect.activityEmails[0]; // Use first email from activity
  }
  
  if (prospect.googleEmails && prospect.googleEmails.length > 0) {
    return prospect.googleEmails[0];
  }
  
  return null;
}

function updateButtons() {
  const pendingCount = allProspects.filter(p => p.messageStatus === 'pending').length;
  const draftedCount = allProspects.filter(p => p.messageStatus === 'drafted').length;
  const readyCount = allProspects.filter(p => p.messageStatus === 'ready').length;
  const emailCount = allProspects.filter(p => p.messageStatus === 'ready' && hasEmail(p)).length;
  
  const draftButton = document.getElementById('draft-all-messages');
  const bulkReviewButton = document.getElementById('bulk-review');
  const sendButton = document.getElementById('send-all-ready');
  const emailButton = document.getElementById('send-all-emails');
  
  // Draft All Messages button
  draftButton.disabled = pendingCount === 0;
  draftButton.textContent = pendingCount > 0 ? `✍️ Draft All Messages (${pendingCount})` : '✍️ Draft All Messages';
  
  // Bulk Review button
  bulkReviewButton.disabled = draftedCount === 0;
  bulkReviewButton.textContent = draftedCount > 0 ? `👀 Bulk Review All (${draftedCount})` : '👀 Bulk Review All';
  
  // Send All Ready button
  sendButton.disabled = readyCount === 0;
  sendButton.textContent = readyCount > 0 ? `🚀 Send All Ready Messages (${readyCount})` : '🚀 Send All Ready Messages';
  
  // Send All Emails button
  emailButton.disabled = emailCount === 0 || !emailAuthStatus;
  emailButton.textContent = emailCount > 0 ? `📧 Send All Emails (${emailCount})` : '📧 Send All Emails';
}

function showEmptyState(message) {
  const container = document.getElementById('prospects-container');
  container.innerHTML = `
    <div class="empty-state">
      <h3>🎯 ${message}</h3>
      <div class="empty-illustration">
        <span class="emoji">🔍</span>
        <span class="emoji">💬</span>
        <span class="emoji">🚀</span>
      </div>
    </div>
  `;
}

// Email Authentication Functions
async function checkEmailAuth() {
  console.log('🔐 Checking email authentication status...');
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/status');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('🔐 Auth status response:', result);
    
    if (result.authenticated && result.email) {
      console.log(`✅ Email authenticated: ${result.email}`);
      emailAuthStatus = true;
      updateEmailStatus(true, result.email);
    } else {
      console.log('❌ Email not authenticated');
      emailAuthStatus = false;
      updateEmailStatus(false);
    }
  } catch (error) {
    console.error('❌ Error checking email auth:', error);
    console.log('⚠️ Backend server may not be running on port 3000');
    emailAuthStatus = false;
    updateEmailStatus(false);
  }
  
  updateButtons(); // Update button states based on auth status
}

function updateEmailStatus(authenticated, email = null) {
  const statusText = document.getElementById('email-status-text');
  const loginBtn = document.getElementById('email-login-btn');
  
  if (!statusText || !loginBtn) {
    console.error('❌ Email status elements not found in DOM');
    return;
  }
  
  if (authenticated && email) {
    console.log(`📧 Updating UI to show authenticated: ${email}`);
    statusText.textContent = `✅ Logged in: ${email}`;
    statusText.style.color = '#38a169';
    statusText.style.fontWeight = '600';
    loginBtn.textContent = '🚪 Logout';
    loginBtn.onclick = emailLogout;
    
    // Update email section styling
    const emailSection = document.getElementById('email-status');
    if (emailSection) {
      emailSection.style.background = 'linear-gradient(135deg, #d4edda, #c3e6cb)';
      emailSection.style.border = '2px solid #28a745';
    }
  } else {
    console.log('📧 Updating UI to show NOT authenticated');
    statusText.textContent = '❌ Email not configured';
    statusText.style.color = '#e53e3e';
    statusText.style.fontWeight = '600';
    loginBtn.textContent = '📧 Setup Email';
    loginBtn.onclick = openEmailModal;
    
    // Update email section styling
    const emailSection = document.getElementById('email-status');
    if (emailSection) {
      emailSection.style.background = 'linear-gradient(135deg, #fff3cd, #ffeaa7)';
      emailSection.style.border = '2px solid #ffc107';
    }
  }
}

function openEmailModal() {
  document.getElementById('email-login-modal').style.display = 'block';
}

function closeEmailModal() {
  document.getElementById('email-login-modal').style.display = 'none';
  // Clear form
  document.getElementById('password-input').value = '';
  hideStatusMessage();
}

async function emailLogin() {
  const email = document.getElementById('email-input').value;
  const password = document.getElementById('password-input').value;
  
  if (!password.trim()) {
    showStatusMessage('Please enter your Gmail App Password', 'error');
    return;
  }
  
  showStatusMessage('Authenticating...', 'info');
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      emailAuthStatus = true;
      updateEmailStatus(true, email);
      showStatusMessage('✅ Login successful! You can now send emails.', 'success');
      updateButtons();
      
      setTimeout(() => {
        closeEmailModal();
      }, 2000);
    } else {
      showStatusMessage('❌ Login failed: ' + (result.error || 'Invalid credentials'), 'error');
    }
  } catch (error) {
    console.error('❌ Email login error:', error);
    showStatusMessage('❌ Connection error. Make sure the backend server is running.', 'error');
  }
}

async function emailLogout() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/logout', {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      emailAuthStatus = false;
      updateEmailStatus(false);
      updateButtons();
      showNotificationInPage('📧 Logged out successfully', 'info');
    }
  } catch (error) {
    console.error('❌ Logout error:', error);
    emailAuthStatus = false;
    updateEmailStatus(false);
    updateButtons();
  }
}

function showStatusMessage(message, type) {
  const statusDiv = document.getElementById('email-status-message');
  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type}`;
  statusDiv.style.display = 'block';
}

function hideStatusMessage() {
  const statusDiv = document.getElementById('email-status-message');
  statusDiv.style.display = 'none';
}

// Email Sending Functions
async function sendAllEmails() {
  console.log('📧 Sending all emails...');
  
  if (!emailAuthStatus) {
    alert('Please login with your email credentials first');
    return;
  }
  
  const emailProspects = allProspects.filter(p => p.messageStatus === 'ready' && hasEmail(p));
  
  if (emailProspects.length === 0) {
    alert('No prospects are ready to send emails');
    return;
  }
  
  const confirmed = confirm(`Send ${emailProspects.length} personalized emails from your Gmail account?`);
  if (!confirmed) return;
  
  const emailButton = document.getElementById('send-all-emails');
  emailButton.disabled = true;
  emailButton.textContent = `🔄 Sending 0/${emailProspects.length}...`;
  
  let sent = 0;
  let failed = 0;
  
  for (const prospect of emailProspects) {
    try {
      const email = getProspectEmail(prospect);
      if (!email) continue;
      
      const formattedMessage = formatLinkedInMessage(prospect.name, prospect.selectedMessage.text);
      
      const response = await fetch('http://localhost:3000/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: `Opportunity at TheNetwrk - ${prospect.name}`,
          body: formattedMessage,
          prospectId: prospect.id
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        prospect.messageStatus = 'sent';
        prospect.sentAt = new Date().toISOString();
        prospect.sentVia = 'email';
        sent++;
        console.log(`✅ Email sent to ${prospect.name} at ${email}`);
      } else {
        failed++;
        console.error(`❌ Failed to send email to ${prospect.name}:`, result.error);
      }
      
      emailButton.textContent = `🔄 Sending ${sent}/${emailProspects.length}...`;
      
      // Delay between emails to avoid being flagged
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      failed++;
      console.error(`❌ Error sending email to ${prospect.name}:`, error);
    }
  }
  
  renderProspects();
  updateStats();
  updateButtons();
  
  emailButton.disabled = false;
  emailButton.textContent = '📧 Send All Emails';
  
  console.log(`✅ Email sending complete: ${sent} sent, ${failed} failed`);
  
  if (sent > 0) {
    showNotificationInPage(`✅ Sent ${sent} emails successfully! ${failed > 0 ? `(${failed} failed)` : ''}`, 'success');
  } else {
    showNotificationInPage(`❌ No emails were sent successfully.`, 'error');
  }
}

console.log('✅ TheNetwrk Message Drafting System ready');
