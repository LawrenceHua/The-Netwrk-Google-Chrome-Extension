/**
 * Google Scout - Free Contact Discovery System
 * Uses Google search to find portfolio sites, GitHub profiles, and personal websites
 * Scrapes publicly available contact information
 */

// Prevent redeclaration errors
if (typeof window.GoogleScout !== 'undefined') {
  console.log('🔄 GoogleScout already loaded, skipping redeclaration');
} else {

class GoogleScout {
  
  /**
   * Enhance a prospect with Google-discovered contact information
   */
  static async enhanceProspectWithGoogle(prospect) {
    console.log(`🔍 Google Scout: Searching for ${prospect.name}...`);
    
    const searchResults = {
      emails: [],
      phones: [],
      websites: [],
      socialMedia: [],
      portfolioSites: [],
      githubProfile: null,
      personalWebsite: null
    };
    
    try {
      // Search for portfolio sites and personal websites
      await this.searchPortfolioSites(prospect, searchResults);
      
      // Search for GitHub profile
      await this.searchGitHubProfile(prospect, searchResults);
      
      // Search for contact information
      await this.searchContactInfo(prospect, searchResults);
      
      // Search Reddit for job seeker activity
      await this.searchRedditActivity(prospect, searchResults);
      
      // Scrape found websites for contact info
      await this.scrapeFoundWebsites(searchResults);
      
      console.log('🎯 Google Scout Results:', {
        name: prospect.name,
        emails: searchResults.emails.length,
        phones: searchResults.phones.length,
        websites: searchResults.websites.length,
        portfolioSites: searchResults.portfolioSites.length,
        githubProfile: searchResults.githubProfile ? 'Found' : 'None'
      });
      
      return {
        ...prospect,
        googleEmails: [...new Set(searchResults.emails)],
        googlePhones: [...new Set(searchResults.phones)],
        googleWebsites: searchResults.websites,
        portfolioSites: searchResults.portfolioSites,
        githubProfile: searchResults.githubProfile,
        personalWebsite: searchResults.personalWebsite,
        redditActivity: searchResults.redditActivity,
        googleSearched: true,
        googleSearchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Google Scout error:', error);
      return {
        ...prospect,
        googleSearched: true,
        googleSearchError: error.message
      };
    }
  }
  
  /**
   * Search for portfolio sites and personal websites
   */
  static async searchPortfolioSites(prospect, results) {
    const searchQueries = [
      `"${prospect.name}" portfolio site:behance.net`,
      `"${prospect.name}" portfolio site:dribbble.com`,
      `"${prospect.name}" portfolio personal website`,
      `"${prospect.name}" developer portfolio`,
      `"${prospect.name}" designer portfolio`,
      `"${prospect.name}" ${prospect.industry || ''} portfolio`,
      `"${prospect.name}" contact email`,
      `"${prospect.name}" personal website`
    ];
    
    for (const query of searchQueries) {
      console.log(`🔍 Searching: ${query}`);
      await this.performGoogleSearch(query, results);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between searches
    }
  }
  
  /**
   * Search for GitHub profile
   */
  static async searchGitHubProfile(prospect, results) {
    const githubQueries = [
      `"${prospect.name}" site:github.com`,
      `"${prospect.name}" github.com developer`,
      `"${prospect.name}" github profile`
    ];
    
    for (const query of githubQueries) {
      console.log(`🔍 GitHub search: ${query}`);
      const githubResults = await this.performGoogleSearch(query, results);
      
      // Look for GitHub profile URLs
      githubResults.forEach(result => {
        if (result.includes('github.com/') && !result.includes('/repos/')) {
          const githubMatch = result.match(/github\.com\/([a-zA-Z0-9_-]+)/);
          if (githubMatch && !results.githubProfile) {
            results.githubProfile = `https://github.com/${githubMatch[1]}`;
            console.log(`✅ Found GitHub profile: ${results.githubProfile}`);
          }
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  /**
   * Search Reddit for job seeker activity
   */
  static async searchRedditActivity(prospect, results) {
    const redditQueries = [
      `"${prospect.name}" site:reddit.com "looking for work"`,
      `"${prospect.name}" site:reddit.com "job search"`,
      `"${prospect.name}" site:reddit.com "career change"`,
      `"${prospect.name}" site:reddit.com "pivot to tech"`,
      `"${prospect.name}" site:reddit.com "breaking into tech"`,
      `"${prospect.name}" site:reddit.com "bootcamp"`,
      `"${prospect.name}" site:reddit.com "self taught"`
    ];
    
    results.redditActivity = [];
    
    for (const query of redditQueries) {
      console.log(`🔍 Reddit search: ${query}`);
      const redditResults = await this.performGoogleSearch(query, results);
      
      // Look for Reddit profile URLs and posts
      redditResults.forEach(result => {
        if (result.includes('reddit.com/user/') || result.includes('reddit.com/u/')) {
          const redditMatch = result.match(/reddit\.com\/u(?:ser)?\/([a-zA-Z0-9_-]+)/);
          if (redditMatch) {
            results.redditActivity.push({
              type: 'profile',
              username: redditMatch[1],
              url: `https://reddit.com/u/${redditMatch[1]}`,
              found_via: query
            });
          }
        } else if (result.includes('reddit.com/r/')) {
          results.redditActivity.push({
            type: 'post',
            url: result,
            found_via: query
          });
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`📱 Found ${results.redditActivity.length} Reddit activities`);
  }
  
  /**
   * Search for contact information directly
   */
  static async searchContactInfo(prospect, results) {
    const contactQueries = [
      `"${prospect.name}" email contact`,
      `"${prospect.name}" @gmail.com`,
      `"${prospect.name}" @outlook.com`,
      `"${prospect.name}" @${prospect.company || 'company'}.com`
    ];
    
    for (const query of contactQueries) {
      console.log(`📧 Contact search: ${query}`);
      await this.performGoogleSearch(query, results);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  /**
   * Perform actual Google search (using Google Custom Search or scraping)
   */
  static async performGoogleSearch(query, results) {
    try {
      // Method 1: Try Google Custom Search API (if available)
      // Method 2: Fallback to direct Google search scraping
      
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;
      console.log(`🔍 Searching: ${searchUrl}`);
      
      // Open Google search in a new tab and scrape results
      return new Promise((resolve) => {
        chrome.tabs.create({ url: searchUrl, active: false }, (tab) => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'scrapeGoogleResults',
              query: query
            }, (response) => {
              if (response && response.success) {
                // Process search results
                this.processSearchResults(response.results, results);
                resolve(response.results);
              } else {
                console.log('⚠️ Google search failed:', response?.error);
                resolve([]);
              }
              
              // Close the tab
              chrome.tabs.remove(tab.id);
            });
          }, 5000); // Wait for page to load
        });
      });
      
    } catch (error) {
      console.error('❌ Google search error:', error);
      return [];
    }
  }
  
  /**
   * Process Google search results to extract useful information
   */
  static processSearchResults(results, searchResults) {
    results.forEach(result => {
      const url = result.url || result.link;
      const title = result.title || '';
      const snippet = result.snippet || result.description || '';
      const text = `${title} ${snippet}`.toLowerCase();
      
      // Extract emails from search results
      const emailMatches = (title + ' ' + snippet).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      emailMatches.forEach(email => {
        if (!searchResults.emails.includes(email)) {
          searchResults.emails.push(email);
          console.log(`📧 Found email in search: ${email}`);
        }
      });
      
      // Identify portfolio sites
      if (url && (
        url.includes('behance.net') ||
        url.includes('dribbble.com') ||
        url.includes('portfolio') ||
        url.includes('personal') ||
        text.includes('portfolio') ||
        text.includes('personal website')
      )) {
        if (!searchResults.portfolioSites.find(site => site.url === url)) {
          searchResults.portfolioSites.push({
            url: url,
            title: title,
            type: this.identifyWebsiteType(url, text)
          });
          console.log(`🎨 Found portfolio site: ${url}`);
        }
      }
      
      // Identify personal websites
      if (url && !url.includes('linkedin.com') && !url.includes('facebook.com') && 
          (text.includes('personal') || text.includes('about me') || text.includes('contact'))) {
        if (!searchResults.websites.includes(url)) {
          searchResults.websites.push(url);
          console.log(`🌐 Found personal website: ${url}`);
        }
      }
    });
  }
  
  /**
   * Scrape found websites for contact information
   */
  static async scrapeFoundWebsites(results) {
    console.log('🕷️ Scraping found websites for contact info...');
    
    const websitesToScrape = [
      ...results.portfolioSites.map(site => site.url),
      ...results.websites,
      results.githubProfile,
      results.personalWebsite
    ].filter(Boolean);
    
    for (const website of websitesToScrape.slice(0, 5)) { // Limit to 5 sites
      try {
        console.log(`🔍 Scraping: ${website}`);
        await this.scrapeWebsiteForContacts(website, results);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay between scrapes
      } catch (error) {
        console.log(`⚠️ Failed to scrape ${website}:`, error.message);
      }
    }
  }
  
  /**
   * Scrape a specific website for contact information
   */
  static async scrapeWebsiteForContacts(url, results) {
    return new Promise((resolve) => {
      chrome.tabs.create({ url: url, active: false }, (tab) => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'scrapeWebsiteContacts'
          }, (response) => {
            if (response && response.success) {
              // Add found emails
              response.emails?.forEach(email => {
                if (!results.emails.includes(email)) {
                  results.emails.push(email);
                  console.log(`📧 Found email on ${url}: ${email}`);
                }
              });
              
              // Add found phones
              response.phones?.forEach(phone => {
                if (!results.phones.includes(phone)) {
                  results.phones.push(phone);
                  console.log(`📱 Found phone on ${url}: ${phone}`);
                }
              });
            }
            
            // Close the tab
            chrome.tabs.remove(tab.id);
            resolve();
          });
        }, 5000);
      });
    });
  }
  
  /**
   * Identify website type based on URL and content
   */
  static identifyWebsiteType(url, text) {
    if (url.includes('behance.net')) return 'Behance Portfolio';
    if (url.includes('dribbble.com')) return 'Dribbble Portfolio';
    if (url.includes('github.com')) return 'GitHub Profile';
    if (url.includes('portfolio')) return 'Portfolio Website';
    if (text.includes('portfolio')) return 'Portfolio Site';
    if (text.includes('personal')) return 'Personal Website';
    return 'Website';
  }
  
  /**
   * Generate comprehensive search queries for a prospect
   */
  static generateSearchQueries(prospect) {
    const queries = [];
    const name = prospect.name;
    const company = prospect.company || prospect.currentRole || '';
    const location = prospect.location || '';
    const industry = prospect.industry || '';
    
    // Basic contact searches
    queries.push(`"${name}" email contact`);
    queries.push(`"${name}" portfolio website`);
    queries.push(`"${name}" personal website`);
    
    // Company-specific searches
    if (company) {
      queries.push(`"${name}" "${company}" contact`);
      queries.push(`"${name}" "${company}" email`);
    }
    
    // Industry-specific searches
    if (industry) {
      queries.push(`"${name}" ${industry} portfolio`);
      queries.push(`"${name}" ${industry} contact`);
    }
    
    // Location-specific searches
    if (location) {
      queries.push(`"${name}" ${location} contact`);
    }
    
    // Platform-specific searches
    queries.push(`"${name}" site:github.com`);
    queries.push(`"${name}" site:behance.net`);
    queries.push(`"${name}" site:dribbble.com`);
    
    return queries;
  }
}

// Make available globally
window.GoogleScout = GoogleScout;

console.log('✅ Google Scout loaded - Free contact discovery system ready');

} // End of redeclaration guard
