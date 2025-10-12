/**
 * URL Collector for TheNetwrk Extension - CLEANED VERSION
 * 
 * Collects profiles from LinkedIn search pages
 * 
 * FEATURES:
 * - Scroll-and-collect: Progressively scrolls page to load all profiles
 * - Profile extraction: Gets name, headline, LinkedIn URL from search results
 * - Smart filtering: Removes junk entries and duplicates
 * - Auto-detection: Works on any LinkedIn search page
 * 
 * USAGE:
 * - Called by content.js when 'collectURLs' message is received
 * - Returns array of profile objects: { name, headline, linkedinUrl, location }
 */

// Prevent redeclaration errors
if (typeof window.URLCollector !== 'undefined') {
  console.log('🔄 URLCollector already loaded, skipping redeclaration');
} else {

class URLCollector {
  
  constructor() {
    this.collectedUrls = [];
    this.processedUrls = new Set();
  }
  
  /**
   * SIMPLIFIED: Just collect names and LinkedIn URLs from search page
   */
  async collectURLsFromPage() {
    console.log('🔍 SIMPLE COLLECTION: Starting LinkedIn profile collection...');
    console.log('🔍 Current URL:', window.location.href);
    
    const profiles = [];
    
    // STEP 1: Simple scroll to load everything
    console.log('📜 STEP 1: Scrolling to load all profiles...');
    await this.simpleScrollToLoadAll();
    
    // STEP 2: Find all profile containers
    console.log('📊 STEP 2: Finding all profile containers...');
    const containers = document.querySelectorAll([
      '.entity-result',
      '.reusable-search__result-container', 
      '.search-result',
      'li[data-entity-urn*="person"]',
      '[data-test-app-aware-link]',
      'div:has(a[href*="/in/"])'  // Any div containing a LinkedIn profile link
    ].join(', '));
    
    console.log(`📊 Found ${containers.length} potential profile containers`);
    
    // STEP 3: Extract name and URL from each container (with deduplication)
    console.log('🔍 STEP 3: Extracting names and URLs...');
    const seenUrls = new Set();
    let duplicateCount = 0;
    
    containers.forEach((container, index) => {
      const profile = this.simpleExtractProfile(container, index);
      if (profile) {
        // Check for duplicates by URL
        if (!seenUrls.has(profile.linkedinUrl)) {
          seenUrls.add(profile.linkedinUrl);
          profiles.push(profile);
          console.log(`✅ [${profiles.length}] ${profile.name} → ${profile.linkedinUrl.substring(0, 50)}...`);
        } else {
          duplicateCount++;
          console.log(`⏭️ [${index + 1}] DUPLICATE: ${profile.name} (already have this URL)`);
        }
      }
    });
    
    console.log(`🎉 SIMPLE COLLECTION COMPLETE: ${profiles.length} unique profiles found (${duplicateCount} duplicates removed)`);
    return profiles;
  }
  
  /**
   * Simple scroll: top → middle → bottom to load everything
   */
  async simpleScrollToLoadAll() {
    const positions = [0, 0.5, 1.0]; // Top, middle, bottom
    
    for (const position of positions) {
      const scrollY = position * (document.body.scrollHeight - window.innerHeight);
      console.log(`📜 Scrolling to ${Math.round(position * 100)}% (${Math.round(scrollY)}px)`);
      
      window.scrollTo({ top: scrollY, behavior: 'smooth' });
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for content to load
    }
    
    // Stay at bottom for a moment to ensure everything loads
    console.log('⏳ Waiting at bottom for lazy loading...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  /**
   * SIMPLE extraction: Just get name and LinkedIn URL with DEBUGGING
   */
  simpleExtractProfile(container, index) {
    try {
      // Find LinkedIn profile link
      const profileLink = container.querySelector('a[href*="/in/"]');
      if (!profileLink) {
        console.log(`⚠️ [${index + 1}] No profile link found in container`);
        return null;
      }
      
      const linkedinUrl = this.cleanLinkedInUrl(profileLink.href);
      if (!this.isValidLinkedInProfile(linkedinUrl)) {
        console.log(`⚠️ [${index + 1}] Invalid LinkedIn URL: ${linkedinUrl}`);
        return null;
      }
      
      // DEBUG: Log what we're working with
      console.log(`🔍 [${index + 1}] Processing container for URL: ${linkedinUrl.substring(0, 50)}...`);
      
      // Extract name - try multiple simple methods with detailed logging
      let name = '';
      let extractionMethod = '';
      
      // Method 1: aria-label from link (most reliable)
      const ariaLabel = profileLink.getAttribute('aria-label');
      if (ariaLabel) {
        console.log(`   🏷️ [${index + 1}] aria-label: "${ariaLabel}"`);
        const match = ariaLabel.match(/View\s+(.+?)(?:'s profile|,|\s*$)/i);
        if (match && match[1]) {
          name = match[1].trim();
          extractionMethod = 'aria-label';
          console.log(`   ✅ [${index + 1}] Name from aria-label: "${name}"`);
        }
      }
      
      // Method 2: text content of link
      if (!name) {
        const linkText = profileLink.textContent.trim();
        console.log(`   📝 [${index + 1}] Link text: "${linkText}"`);
        if (linkText && linkText.length > 2 && linkText.length < 100 && this.looksLikeName(linkText)) {
          name = linkText;
          extractionMethod = 'link-text';
          console.log(`   ✅ [${index + 1}] Name from link text: "${name}"`);
        }
      }
      
      // Method 3: find text near the link (look for spans with names)
      if (!name) {
        const parent = profileLink.closest('div, li, article');
        if (parent) {
          // Look specifically for spans that might contain names
          const spans = parent.querySelectorAll('span');
          console.log(`   🔍 [${index + 1}] Found ${spans.length} spans in parent`);
          
          for (const span of spans) {
            const spanText = span.textContent.trim();
            console.log(`     📝 [${index + 1}] Span text: "${spanText}"`);
            
            if (spanText && this.looksLikeName(spanText) && spanText.length < 100) {
              name = spanText;
              extractionMethod = 'span-text';
              console.log(`   ✅ [${index + 1}] Name from span: "${name}"`);
              break;
            }
          }
        }
      }
      
      // Method 4: Look for text in specific patterns (first line that looks like a name)
      if (!name) {
        const allText = container.textContent;
        const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        console.log(`   📄 [${index + 1}] Container has ${lines.length} text lines`);
        console.log(`   📄 [${index + 1}] First 3 lines:`, lines.slice(0, 3));
        
        for (const line of lines.slice(0, 5)) { // Check first 5 lines only
          if (this.looksLikeName(line)) {
            name = line;
            extractionMethod = 'text-analysis';
            console.log(`   ✅ [${index + 1}] Name from text analysis: "${name}"`);
            break;
          }
        }
      }
      
      // Validate final name
      if (!name || !this.looksLikeName(name)) {
        console.log(`   ❌ [${index + 1}] FAILED - Invalid name: "${name}" for URL: ${linkedinUrl}`);
        console.log(`   📊 [${index + 1}] Container text preview:`, container.textContent.substring(0, 200));
        return null;
      }
      
      console.log(`   🎉 [${index + 1}] SUCCESS - Name: "${name}" via ${extractionMethod}`);
      
      return {
        name: name,
        linkedinUrl: linkedinUrl,
        headline: '', 
        location: '',
        extractionMethod: extractionMethod // For debugging
      };
      
    } catch (error) {
      console.log(`⚠️ [${index + 1}] Extraction error:`, error.message);
      return null;
    }
  }
  
  /**
   * Enhanced name validation - filter out LinkedIn UI elements
   */
  looksLikeName(text) {
    if (!text || typeof text !== 'string') return false;
    
    const trimmed = text.trim();
    
    // Basic checks
    if (trimmed.length < 2 || trimmed.length > 100) return false;
    
    // Must contain letters
    if (!/[a-zA-Z]/.test(trimmed)) return false;
    
    // ENHANCED exclusion list based on the logs
    const excludeWords = [
      'status is offline', 'status is reachable', 'status is',
      'view', 'message', 'connect', 'follow', 'linkedin', 'premium', 'profile',
      'provides services', 'application development', 'information management',
      'business analytics', 'leadership development',
      'show more', 'see more', 'load more', 'get started',
      'mutual connection', 'mutual connections', '+ mutual',
      'ago', 'week', 'month', 'year', 'day',
      'like', 'comment', 'share', 'repost'
    ];
    
    const lowerText = trimmed.toLowerCase();
    if (excludeWords.some(word => lowerText.includes(word))) {
      return false;
    }
    
    // Must not be all numbers
    if (/^\d+$/.test(trimmed)) return false;
    
    // Must not be too short common words
    if (trimmed.length < 4 && ['in', 'at', 'to', 'is', 'of', 'or', 'and'].includes(lowerText)) {
      return false;
    }
    
    // Should look like a person's name (has space or is a single word that could be a name)
    const hasSpace = trimmed.includes(' ');
    const isSingleWord = !hasSpace && trimmed.length >= 3;
    
    return hasSpace || isSingleWord;
  }
  
  /**
   * Collect profiles (name, headline, URL) from currently visible content
   */
  collectProfilesFromCurrentView() {
    const profiles = [];
    
    // Find all profile containers currently visible
    const profileContainers = document.querySelectorAll([
      '.entity-result',
      '.reusable-search__result-container', 
      '.search-result',
      'li[data-entity-urn*="person"]',
      '[data-test-app-aware-link]'
    ].join(', '));
    
    console.log(`🔍 Found ${profileContainers.length} profile containers in current view`);
    
    profileContainers.forEach((container, index) => {
      try {
        // Extract profile data from this container
        const profile = this.extractProfileFromContainer(container);
        
        if (profile && profile.name && profile.linkedinUrl && 
            !profile.name.includes('View') && !profile.name.includes('Message') &&
            profile.name.length > 2 && profile.name !== 'Unknown') {
          
          // Check for duplicates
          const isDuplicate = profiles.some(p => p.linkedinUrl === profile.linkedinUrl);
          
          if (!isDuplicate) {
            profiles.push(profile);
            console.log(`     ✅ [${index + 1}] ${profile.name} - ${profile.headline?.substring(0, 40) || 'No headline'}...`);
          }
        }
        
      } catch (error) {
        console.log(`⚠️ Error extracting profile ${index + 1}:`, error.message);
      }
    });
    
    return profiles;
  }
  
  /**
   * Extract profile data from a specific container element
   * DYNAMIC APPROACH - Works regardless of LinkedIn's class name changes
   */
  extractProfileFromContainer(container) {
    let name = '';
    let headline = '';
    let linkedinUrl = '';
    let location = '';
    
    try {
      // STEP 1: Find profile link (this pattern rarely changes)
      const profileLink = container.querySelector('a[href*="/in/"]');
      if (!profileLink) {
        return null;
      }
      
      linkedinUrl = this.cleanLinkedInUrl(profileLink.href);
      if (!this.isValidLinkedInProfile(linkedinUrl)) {
        return null;
      }
      
      // STEP 2: Extract name DYNAMICALLY from aria-label (most reliable)
      const allLinks = container.querySelectorAll('a[href*="/in/"]');
      for (const link of allLinks) {
        const ariaLabel = link.getAttribute('aria-label');
        if (ariaLabel) {
          // Pattern: "View Name's profile" or "Name" or "Name, Title"
          const patterns = [
            /View\s+(.+?)(?:'s profile|,|\s*$)/i,  // "View John Smith's profile"
            /^(.+?),/,                              // "John Smith, Title"
            /^(.+)$/                                // Just the name
          ];
          
          for (const pattern of patterns) {
            const match = ariaLabel.match(pattern);
            if (match && match[1]) {
              const potentialName = match[1].trim();
              if (this.isValidName(potentialName)) {
                name = potentialName;
                console.log(`✅ Name from aria-label: "${name}"`);
                break;
              }
            }
          }
          if (name) break;
        }
      }
      
      // STEP 3: Fallback - Find name by DOM structure analysis
      if (!name) {
        name = this.extractNameByDOMAnalysis(container);
      }
      
      // STEP 4: Extract headline by finding text near the profile link
      headline = this.extractHeadlineByProximity(container, profileLink);
      
      // STEP 5: Extract location (usually has location/city keywords)
      location = this.extractLocationByPattern(container);
      
      console.log('🔍 Dynamic extraction:', {
        name: name?.substring(0, 30) || 'NOT FOUND',
        headline: headline?.substring(0, 30) || 'none',
        url: linkedinUrl?.substring(0, 40) || 'none'
      });
      
      // Only return if we have at least name and URL
      if (name && linkedinUrl) {
        return {
          name: name,
          headline: headline || '',
          linkedinUrl: linkedinUrl,
          location: location || ''
        };
      }
      
    } catch (error) {
      console.log('⚠️ Container extraction error:', error.message);
    }
    
    return null;
  }
  
  /**
   * Validate if a string looks like a real person's name
   */
  isValidName(text) {
    if (!text || typeof text !== 'string') return false;
    
    const trimmed = text.trim();
    
    // Length checks
    if (trimmed.length < 2 || trimmed.length > 100) return false;
    
    // Exclude UI elements and common patterns
    const excludePatterns = [
      'view', 'message', 'connect', 'follow', 'save', 'more',
      'linkedin', 'premium', 'profile', 'mutual', 'connection',
      'open', 'start', 'show', 'hide', 'see', 'get', 'try'
    ];
    
    const lowerText = trimmed.toLowerCase();
    if (excludePatterns.some(pattern => lowerText.includes(pattern))) {
      return false;
    }
    
    // Must have at least one letter
    if (!/[a-zA-Z]/.test(trimmed)) return false;
    
    // Must not be all numbers
    if (/^\d+$/.test(trimmed)) return false;
    
    return true;
  }
  
  /**
   * Extract name by analyzing DOM structure (no hardcoded classes)
   */
  extractNameByDOMAnalysis(container) {
    // Strategy: Find the first significant text near a profile link
    const allLinks = container.querySelectorAll('a[href*="/in/"]');
    
    for (const link of allLinks) {
      // Get immediate text content of the link
      const linkText = link.textContent.trim();
      if (this.isValidName(linkText)) {
        console.log(`✅ Name from link text: "${linkText}"`);
        return linkText;
      }
      
      // Check link's parent and siblings
      const parent = link.parentElement;
      if (parent) {
        // Look for spans or divs near the link
        const nearbyElements = [
          ...parent.querySelectorAll('span'),
          ...parent.querySelectorAll('div')
        ];
        
        for (const el of nearbyElements) {
          const text = el.textContent.trim();
          // Get only the direct text, not nested text
          const directText = Array.from(el.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent.trim())
            .join(' ');
          
          const testText = directText || text;
          if (testText && testText.length < linkText.length + 50 && this.isValidName(testText)) {
            console.log(`✅ Name from DOM analysis: "${testText}"`);
            return testText;
          }
        }
      }
    }
    
    // Final fallback: Get first valid text from container
    const allText = container.textContent;
    const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines) {
      if (this.isValidName(line) && line.length < 100) {
        console.log(`✅ Name from text analysis: "${line}"`);
        return line;
      }
    }
    
    return '';
  }
  
  /**
   * Extract headline by finding text near the profile link
   */
  extractHeadlineByProximity(container, profileLink) {
    // Find text elements near the profile link
    const parent = profileLink.closest('div, li, article');
    if (!parent) return '';
    
    // Get all text nodes
    const allText = parent.textContent;
    const lines = allText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 10 && l.length < 300);
    
    // Headline usually has job-related keywords
    const headlineKeywords = [
      'engineer', 'developer', 'manager', 'designer', 'analyst',
      'director', 'founder', 'ceo', 'cto', 'at ', ' | ',
      'specialist', 'consultant', 'lead', 'senior', 'junior'
    ];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (headlineKeywords.some(keyword => lowerLine.includes(keyword))) {
        return line;
      }
    }
    
    // Fallback: Return second line (first is usually name)
    return lines[1] || '';
  }
  
  /**
   * Extract location by finding text with location patterns
   */
  extractLocationByPattern(container) {
    const allText = container.textContent;
    const lines = allText.split('\n').map(l => l.trim());
    
    // Location patterns
    const locationKeywords = [
      'area', 'city', 'state', 'country', ', ca', ', ny', ', tx',
      'united states', 'canada', 'uk', 'london', 'francisco'
    ];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (line.length > 5 && line.length < 100 &&
          locationKeywords.some(keyword => lowerLine.includes(keyword))) {
        return line;
      }
    }
    
    return '';
  }
  
  /**
   * Scroll down the page to load all lazy-loaded profiles
   */
  async scrollToLoadAllProfiles() {
    console.log('📜 Starting comprehensive scroll to load all profiles...');
    
    let lastHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;
    
    while (scrollAttempts < maxScrollAttempts) {
      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if page height increased (more content loaded)
      const currentHeight = document.body.scrollHeight;
      
      if (currentHeight === lastHeight) {
        // No new content loaded
        console.log(`📜 No new content after scroll attempt ${scrollAttempts + 1}`);
        
        // Try scrolling to different positions to trigger lazy loading
        const positions = [
          document.body.scrollHeight * 0.25,
          document.body.scrollHeight * 0.5,
          document.body.scrollHeight * 0.75,
          document.body.scrollHeight
        ];
        
        for (const pos of positions) {
          window.scrollTo(0, pos);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        break;
      } else {
        console.log(`📜 Page grew from ${lastHeight} to ${currentHeight} pixels`);
        lastHeight = currentHeight;
      }
      
      scrollAttempts++;
    }
    
    // Final scroll to top to reset view
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`✅ Scroll complete after ${scrollAttempts} attempts`);
  }
  
  /**
   * Click "Show more results" or similar buttons to load additional profiles
   */
  async clickShowMoreResults() {
    const showMoreSelectors = [
      'button[aria-label*="Show more"]',
      'button:contains("Show more")',
      '.artdeco-button--secondary:contains("Show more")',
      '[data-test-pagination-page-btn="next"]',
      '.search-results__pagination-list button',
      'button[aria-label*="more results"]',
      'button[data-test-id*="show-more"]'
    ];
    
    let clicked = false;
    
    for (const selector of showMoreSelectors) {
      try {
        let button;
        
        // Handle :contains() selector manually
        if (selector.includes(':contains')) {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.textContent.toLowerCase().includes('show more') && 
                btn.offsetWidth > 0 && btn.offsetHeight > 0) {
              button = btn;
              break;
            }
          }
        } else {
          button = document.querySelector(selector);
        }
        
        if (button && button.offsetWidth > 0 && button.offsetHeight > 0) {
          console.log(`🔘 Found "Show more" button with selector: ${selector}`);
          
          // Scroll to button and click
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          button.click();
          console.log(`✅ Clicked "Show more results" button`);
          
          // Wait for new content to load
          await new Promise(resolve => setTimeout(resolve, 3000));
          clicked = true;
          break;
        }
      } catch (error) {
        console.log(`⚠️ Error with selector ${selector}:`, error.message);
      }
    }
    
    if (!clicked) {
      console.log('ℹ️  No "Show more" button found - page may already show all results');
    }
    
    return clicked;
  }
  
  /**
   * Check if URL is a valid LinkedIn profile
   */
  isValidLinkedInProfile(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Must be LinkedIn domain
    if (!url.includes('linkedin.com')) return false;
    
    // Must contain /in/ for profile
    if (!url.includes('/in/')) return false;
    
    // Exclude non-profile URLs
    const excludePatterns = [
      '/company/',
      '/school/',
      '/groups/',
      '/events/',
      '/jobs/',
      '/feed/',
      '/search/',
      '/messaging/',
      '/notifications/'
    ];
    
    return !excludePatterns.some(pattern => url.includes(pattern));
  }
  
  /**
   * Clean LinkedIn URL to standard format
   */
  cleanLinkedInUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Extract profile identifier
      const pathParts = urlObj.pathname.split('/');
      const inIndex = pathParts.indexOf('in');
      
      if (inIndex !== -1 && pathParts[inIndex + 1]) {
        const profileId = pathParts[inIndex + 1];
        return `https://www.linkedin.com/in/${profileId}/`;
      }
      
      return url;
    } catch (error) {
      console.log('⚠️ Error cleaning URL:', url, error);
      return url;
    }
  }
  
  /**
   * Get all collected URLs
   */
  getAllUrls() {
    return [...this.collectedUrls];
  }
  
  /**
   * Clear collected URLs
   */
  clearUrls() {
    this.collectedUrls = [];
    this.processedUrls.clear();
    console.log('🗑️ Cleared collected URLs');
  }
  
  /**
   * Get URL statistics
   */
  getStats() {
    return {
      total: this.collectedUrls.length,
      unique: this.processedUrls.size,
      lastCollected: new Date().toISOString()
    };
  }
  
  /**
   * Auto-collect URLs when page loads
   */
  startAutoCollection() {
    // Collect immediately
    this.collectURLsFromPage();
    
    // Set up observer for dynamic content
    const observer = new MutationObserver(() => {
      // Debounce collection to avoid too many calls
      clearTimeout(this.collectionTimeout);
      this.collectionTimeout = setTimeout(() => {
        this.collectURLsFromPage();
      }, 1000);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('👀 Auto URL collection started');
    return observer;
  }
}

// Static async method for comprehensive collection (returns profile objects)
URLCollector.collectFromCurrentPage = async function() {
  console.log('🚀 Starting comprehensive profile collection...');
  
  if (window.urlCollector) {
    return await window.urlCollector.collectURLsFromPage();
  } else {
    const tempCollector = new URLCollector();
    return await tempCollector.collectURLsFromPage();
  }
};

// Static method to get profiles with data from current view (synchronous)
URLCollector.collectProfilesFromCurrentView = function() {
  console.log('🔍 Collecting profiles from current view...');
  
  if (window.urlCollector) {
    return window.urlCollector.collectProfilesFromCurrentView();
  } else {
    const tempCollector = new URLCollector();
    return tempCollector.collectProfilesFromCurrentView();
  }
};

// Make available globally
window.URLCollector = URLCollector;

// Auto-start if on LinkedIn search page
if (window.location.hostname.includes('linkedin.com') && 
    (window.location.pathname.includes('/search/') || 
     window.location.pathname.includes('/mynetwork/'))) {
  
  window.urlCollector = new URLCollector();
  window.urlCollector.startAutoCollection();
  
  console.log('✅ Auto-started URL collection on LinkedIn search page');
} else {
  console.log('ℹ️  URL Collector loaded but not auto-started (not a search page)');
}

console.log('✅ URL Collector loaded');

} // End of redeclaration guard

