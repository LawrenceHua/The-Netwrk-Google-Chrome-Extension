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
const sendMessageButton = document.getElementById('send-message');

// State management
let allProspects = [];
let filteredProspects = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentSort = { field: 'dateAdded', direction: 'desc' };
let selectedProspect = null;

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Initialize the dashboard
function initializeDashboard() {
  loadProspects();
  setupEventListeners();
}

// Load prospects from storage
function loadProspects() {
  chrome.runtime.sendMessage({ action: 'getProspects' }, (response) => {
    if (response.success) {
      allProspects = response.prospects;
      updateStats(response.stats);
      applyFiltersAndSort();
    } else {
      showError('Failed to load prospects');
    }
  });
}

// Update statistics
function updateStats(stats) {
  totalProspectsElement.textContent = stats.total;
  contactedCountElement.textContent = stats.contacted;
  respondedCountElement.textContent = stats.responded;
  
  // Calculate conversion rate
  const conversionRate = stats.total > 0 
    ? Math.round((stats.responded / stats.total) * 100) 
    : 0;
  conversionRateElement.textContent = `${conversionRate}%`;
}

// Apply filters and sorting to prospects
function applyFiltersAndSort() {
  const searchTerm = searchInput.value.toLowerCase();
  const statusValue = statusFilter.value;
  
  // Filter prospects
  filteredProspects = allProspects.filter(prospect => {
    // Search term filter
    const matchesSearch = 
      prospect.name.toLowerCase().includes(searchTerm) ||
      prospect.headline.toLowerCase().includes(searchTerm) ||
      prospect.location.toLowerCase().includes(searchTerm) ||
      (prospect.email && prospect.email.toLowerCase().includes(searchTerm));
    
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
  // Clear existing rows
  prospectsTableBody.innerHTML = '';
  
  // Calculate page bounds
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredProspects.length);
  
  // Show empty message if no prospects
  if (filteredProspects.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.className = 'empty-row';
    emptyRow.innerHTML = '<td colspan="8" class="empty-message">No prospects found matching your filters.</td>';
    prospectsTableBody.appendChild(emptyRow);
    return;
  }
  
  // Render each prospect in the current page
  for (let i = startIndex; i < endIndex; i++) {
    const prospect = filteredProspects[i];
    const row = document.createElement('tr');
    
    // Format data for display
    const contactAttempts = prospect.contactAttempts ? prospect.contactAttempts.length : 0;
    const dateAdded = new Date(prospect.dateAdded).toLocaleDateString();
    const status = formatStatus(prospect.status);
    
    // Create row HTML
    row.innerHTML = `
      <td>${prospect.name}</td>
      <td>${prospect.headline || '-'}</td>
      <td>${prospect.location || '-'}</td>
      <td>${prospect.email || '-'}</td>
      <td>${status}</td>
      <td>${contactAttempts}</td>
      <td>${dateAdded}</td>
      <td>
        <button class="action-button view-button" data-id="${prospect.id}">View</button>
        <button class="action-button message-button" data-id="${prospect.id}">Message</button>
      </td>
    `;
    
    prospectsTableBody.appendChild(row);
  }
  
  // Add event listeners to action buttons
  setupActionButtons();
}

// Format status for display
function formatStatus(status) {
  switch(status) {
    case 'new': return '<span style="color: blue;">New</span>';
    case 'contacted': return '<span style="color: orange;">Contacted</span>';
    case 'responded': return '<span style="color: green;">Responded</span>';
    case 'not-interested': return '<span style="color: red;">Not Interested</span>';
    default: return status;
  }
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
      openProspectDetail(id, true);
    });
  });
}

// Open prospect detail modal
function openProspectDetail(id, focusOnMessage = false) {
  // Find the selected prospect
  selectedProspect = allProspects.find(p => p.id === id);
  
  if (!selectedProspect) return;
  
  // Populate modal content
  renderProspectDetail(selectedProspect);
  
  // Show modal
  prospectModal.style.display = 'block';
  
  // Focus on message textarea if requested
  if (focusOnMessage) {
    const messageTextarea = document.getElementById('message-textarea');
    if (messageTextarea) {
      messageTextarea.focus();
    }
  }
}

// Render prospect detail in modal
function renderProspectDetail(prospect) {
  let html = `
    <div class="detail-section">
      <h3>Profile Information</h3>
      
      <div class="detail-field">
        <div class="field-label">Name</div>
        <div class="field-value">${prospect.name}</div>
      </div>
      
      <div class="detail-field">
        <div class="field-label">Headline</div>
        <div class="field-value">${prospect.headline || '-'}</div>
      </div>
      
      <div class="detail-field">
        <div class="field-label">Location</div>
        <div class="field-value">${prospect.location || '-'}</div>
      </div>
      
      <div class="detail-field">
        <div class="field-label">Email</div>
        <div class="field-value">${prospect.email || 'Not available'}</div>
      </div>
      
      <div class="detail-field">
        <div class="field-label">Phone</div>
        <div class="field-value">${prospect.phone || 'Not available'}</div>
      </div>
      
      <div class="detail-field">
        <div class="field-label">LinkedIn</div>
        <div class="field-value">
          <a href="${prospect.linkedinUrl}" target="_blank">${prospect.linkedinUrl}</a>
        </div>
      </div>
      
      <div class="detail-field">
        <div class="field-label">Status</div>
        <div class="field-value">
          <select id="status-select">
            <option value="new" ${prospect.status === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${prospect.status === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="responded" ${prospect.status === 'responded' ? 'selected' : ''}>Responded</option>
            <option value="not-interested" ${prospect.status === 'not-interested' ? 'selected' : ''}>Not Interested</option>
          </select>
        </div>
      </div>
      
      <div class="detail-field">
        <div class="field-label">Added on</div>
        <div class="field-value">${new Date(prospect.dateAdded).toLocaleString()}</div>
      </div>
    </div>
  `;
  
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
    
    <div class="detail-section">
      <h3>Send Message</h3>
      <div class="message-container">
        <textarea id="message-textarea" placeholder="Write your personalized message here..."></textarea>
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
  
  // Pre-populate message textarea with template
  const messageTextarea = document.getElementById('message-textarea');
  const firstName = prospect.name.split(' ')[0];
  messageTextarea.value = getMessageTemplate(firstName);
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
    if (currentPage < totalPages) {
      currentPage++;
      renderProspects();
      updatePagination();
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
  
  // Send message button
  sendMessageButton.addEventListener('click', () => {
    if (selectedProspect) {
      const messageContent = document.getElementById('message-textarea').value;
      sendMessage(selectedProspect, messageContent);
    }
  });
  
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

// Send message to prospect
function sendMessage(prospect, content) {
  // Check if we have the necessary information
  if (!content.trim()) {
    alert('Please write a message first.');
    return;
  }
  
  // In a real implementation, this would trigger a LinkedIn message or email
  // For now, we'll just record the contact attempt
  
  // Create contact attempt object
  const contactAttempt = {
    type: prospect.email ? 'email' : 'linkedin',
    templateId: 'custom',
    date: new Date().toISOString(),
    status: 'sent',
    content: content
  };
  
  // Add to prospect's contact attempts
  if (!prospect.contactAttempts) {
    prospect.contactAttempts = [];
  }
  prospect.contactAttempts.push(contactAttempt);
  
  // Update status if it was new
  if (prospect.status === 'new') {
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
  }, (response) => {
    if (response.success) {
      alert('Message recorded successfully!');
      
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
      }
      
      // Close modal
      closeModal();
    } else {
      alert('Failed to send message. Please try again.');
    }
  });
}

// Show error message
function showError(message) {
  // Implement error display
  console.error(message);
  alert('Error: ' + message);
}

// Initial load
initializeDashboard();