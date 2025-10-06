/**
 * URL Collector for TheNetwrk Extension
 * Collects and manages LinkedIn profile URLs from search pages
 */

class URLCollector {
  
  constructor() {
    this.collectedUrls = [];
    this.processedUrls = new Set();
  }
  
  /**
   * Collect LinkedIn profile URLs from current page
   */
  collectURLsFromPage() {
    console.log('🔍 Collecting LinkedIn profile URLs from current page...');
    
    const urls = [];
    const profileLinks = document.querySelectorAll('a[href*="/in/"]');
    
    profileLinks.forEach(link => {
      const href = link.href;
      
      // Clean and validate LinkedIn profile URL
      if (this.isValidLinkedInProfile(href)) {
        const cleanUrl = this.cleanLinkedInUrl(href);
        
        if (!this.processedUrls.has(cleanUrl)) {
          urls.push(cleanUrl);
          this.processedUrls.add(cleanUrl);
        }
      }
    });
    
    console.log(`📊 Found ${urls.length} new LinkedIn profile URLs`);
    this.collectedUrls.push(...urls);
    
    return urls;
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

// Make available globally
window.URLCollector = URLCollector;

// Auto-start if on LinkedIn search page
if (window.location.hostname.includes('linkedin.com') && 
    (window.location.pathname.includes('/search/') || 
     window.location.pathname.includes('/mynetwork/'))) {
  
  window.urlCollector = new URLCollector();
  window.urlCollector.startAutoCollection();
}

console.log('✅ URL Collector loaded');
