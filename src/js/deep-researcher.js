/**
 * Deep Researcher - Phase 2
 * Visits each LinkedIn profile and performs comprehensive research
 * Gets ALL data: posts, comments, experiences, skills, about section
 */

class DeepResearcher {
  
  /**
   * Research a single prospect thoroughly
   */
  static async researchProspect(prospect) {
    console.log(`\n🔬 ========== RESEARCHING: ${prospect.name} ==========`);
    console.log(`🔗 URL: ${prospect.linkedinUrl}`);
    
    // Ensure we're on the right profile page
    if (!window.location.href.includes(prospect.linkedinUrl.split('/in/')[1]?.split('/')[0] || '')) {
      console.log('⚠️ Not on the target profile page, skipping navigation for now');
    }
    
    // Wait for page to fully load if we just navigated
    console.log('⏳ Waiting for profile to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Scroll to load all dynamic content
    console.log('📜 Scrolling to load all content...');
    await this.scrollToLoadEverything();
    
    // Extract comprehensive data from main profile
    console.log('📊 Extracting comprehensive profile data...');
    const profileData = this.extractComprehensiveData();
    
    // Try to get activity data from current page only (safer approach)
    console.log('📝 Getting activity from current page...');
    const activityData = this.extractActivityFromCurrentPage();
    
    // Combine all data
    const completeProfile = {
      ...prospect,
      ...profileData,
      ...activityData,
      researchedAt: new Date().toISOString(),
      isResearched: true
    };
    
    console.log('✅ Research complete:', {
      name: completeProfile.name,
      headline: completeProfile.headline ? 'Found' : 'Missing',
      about: completeProfile.about ? 'Found' : 'Missing',
      experiences: completeProfile.experiences?.length || 0,
      skills: completeProfile.skills?.length || 0,
      posts: completeProfile.posts?.length || 0,
      comments: completeProfile.comments?.length || 0,
      emails: completeProfile.activityEmails?.length || 0,
      phones: completeProfile.activityPhones?.length || 0
    });
    
    // Enhance with Google Scout for multi-platform contact discovery
    if (window.GoogleScout) {
      try {
        console.log('🔍 Enhancing prospect with Google Scout...');
        const enhancedProfile = await GoogleScout.enhanceProspectWithGoogle(completeProfile);
        console.log('✅ Google Scout enhancement complete');
        return enhancedProfile;
      } catch (error) {
        console.log('⚠️ Google Scout failed:', error.message);
        return completeProfile;
      }
    }
    
    return completeProfile;
  }
  
  /**
   * Extract activity data from current page only (no navigation)
   */
  static async extractActivityFromCurrentPage() {
    console.log('📝 Extracting activity from current page...');
    
    // Step 1: Click all "See more" buttons to expand content
    await this.expandAllContent();
    
    // Step 2: Scroll to load more posts and comments
    await this.scrollToLoadAllActivity();
    
    // Step 3: Get all text after expansion
    const allText = document.body.innerText || '';
    console.log(`📄 Total page text length after expansion: ${allText.length} characters`);
    
    // Step 4: Look for activity section content on main profile
    const activitySection = this.findActivitySection();
    let activityText = activitySection || allText;
    
    // Step 5: Extract posts and comments from visible content
    const { posts, comments } = this.extractActivityFromPage(activityText);
    
    // Step 6: Hunt for contact info in all visible text
    const contacts = this.huntContactInfo(allText);
    
    console.log('📊 Current page activity extraction:', {
      posts: posts.length,
      comments: comments.length,
      emails: contacts.emails.length,
      phones: contacts.phones.length,
      socialMedia: contacts.socialMedia.length,
      totalTextLength: allText.length
    });
    
    if (contacts.emails.length > 0) {
      console.log('🎯 FOUND EMAILS:', contacts.emails);
    }
    
    return {
      posts: posts.slice(0, 20), // More posts
      comments: comments.slice(0, 20), // More comments
      activityEmails: [...new Set(contacts.emails)],
      activityPhones: [...new Set(contacts.phones)],
      activitySocialMedia: [...new Set(contacts.socialMedia)],
      fullActivityText: activityText.slice(0, 15000) // More text for AI
    };
  }
  
  /**
   * Click all "See more" buttons to expand content
   */
  static async expandAllContent() {
    console.log('🔍 Looking for "See more" buttons to expand content...');
    
    // Common selectors for "See more" buttons on LinkedIn
    const seeMoreSelectors = [
      'button[aria-label*="more"]',
      'button[data-control-name*="more"]',
      '.show-more-less-html__button',
      '.inline-show-more-text button',
      '[data-test-id="see-more-button"]',
      '.see-more',
      'button:contains("See more")',
      'button:contains("Show more")',
      '.pv-shared-text-with-see-more button'
    ];
    
    let clickedButtons = 0;
    
    for (const selector of seeMoreSelectors) {
      try {
        if (selector.includes(':contains')) {
          // Handle text-based selectors
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            if ((text.includes('see more') || text.includes('show more')) && 
                btn.offsetWidth > 0 && btn.offsetHeight > 0) {
              console.log(`👆 Clicking "See more" button: ${btn.textContent.trim()}`);
              btn.click();
              clickedButtons++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } else {
          const buttons = document.querySelectorAll(selector);
          for (const btn of buttons) {
            if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
              console.log(`👆 Clicking expand button: ${selector}`);
              btn.click();
              clickedButtons++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Error with selector ${selector}:`, error.message);
      }
    }
    
    if (clickedButtons > 0) {
      console.log(`✅ Clicked ${clickedButtons} expand buttons, waiting for content to load...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('ℹ️ No expandable content found');
    }
  }
  
  /**
   * Scroll through the page to load all activity content
   */
  static async scrollToLoadAllActivity() {
    console.log('📜 Scrolling to load all activity content...');
    
    const initialHeight = document.body.scrollHeight;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;
    
    while (scrollAttempts < maxScrollAttempts) {
      // Scroll to different positions to trigger lazy loading
      const scrollPositions = [
        document.body.scrollHeight * 0.3,  // 30%
        document.body.scrollHeight * 0.5,  // 50%
        document.body.scrollHeight * 0.7,  // 70%
        document.body.scrollHeight * 0.9,  // 90%
        document.body.scrollHeight         // 100%
      ];
      
      for (const position of scrollPositions) {
        window.scrollTo(0, position);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Slower scrolling
        
        // Look for and click "Show more activities" or similar buttons
        await this.clickShowMoreActivities();
      }
      
      // Check if new content loaded
      const newHeight = document.body.scrollHeight;
      if (newHeight > initialHeight) {
        console.log(`📈 Page height increased from ${initialHeight} to ${newHeight}, continuing...`);
        scrollAttempts = 0; // Reset counter if we're still loading content
      } else {
        scrollAttempts++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Scroll back to top
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Finished loading activity content');
  }
  
  /**
   * Click "Show more activities" buttons during scrolling
   */
  static async clickShowMoreActivities() {
    const showMoreActivitySelectors = [
      'button[aria-label*="Show more activities"]',
      'button[data-control-name*="load_more"]',
      '.scaffold-finite-scroll__load-button',
      'button:contains("Show more")',
      '.pv-profile-section__see-more-inline'
    ];
    
    for (const selector of showMoreActivitySelectors) {
      try {
        if (selector.includes(':contains')) {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.textContent.toLowerCase().includes('show more') && 
                btn.offsetWidth > 0 && btn.offsetHeight > 0) {
              console.log(`👆 Clicking "Show more activities" button`);
              btn.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
              return; // Only click one at a time
            }
          }
        } else {
          const button = document.querySelector(selector);
          if (button && button.offsetWidth > 0 && button.offsetHeight > 0) {
            console.log(`👆 Clicking activity load button: ${selector}`);
            button.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            return; // Only click one at a time
          }
        }
      } catch (error) {
        console.log(`⚠️ Error clicking activity button:`, error.message);
      }
    }
  }
  
  /**
   * Find activity section on profile page
   */
  static findActivitySection() {
    // Try to find activity section in the DOM
    const activitySelectors = [
      '[data-section="activity"]',
      '.pv-recent-activity-section',
      '.pvs-list__container',
      '[aria-label*="Activity"]',
      '.activity-section'
    ];
    
    for (const selector of activitySelectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`✅ Found activity section with selector: ${selector}`);
        return element.innerText || '';
      }
    }
    
    // Look for activity-related text patterns
    const allText = document.body.innerText || '';
    const activityIndex = allText.toLowerCase().indexOf('activity');
    if (activityIndex !== -1) {
      // Extract text around activity section
      const start = Math.max(0, activityIndex - 500);
      const end = Math.min(allText.length, activityIndex + 5000);
      return allText.substring(start, end);
    }
    
    console.log('⚠️ No dedicated activity section found, using full page text');
    return allText;
  }
  
  /**
   * Scroll page to load all dynamic content
   */
  static async scrollToLoadEverything() {
    // Scroll to different sections to trigger loading
    const scrollPositions = [
      0,                                    // Top
      document.body.scrollHeight * 0.25,   // 25%
      document.body.scrollHeight * 0.5,    // 50%
      document.body.scrollHeight * 0.75,   // 75%
      document.body.scrollHeight,          // Bottom
      0                                     // Back to top
    ];
    
    for (const position of scrollPositions) {
      window.scrollTo(0, position);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Click "Show more" buttons if they exist
    const showMoreButtons = document.querySelectorAll('button[aria-label*="more"], button[data-control-name*="more"]');
    for (const button of showMoreButtons) {
      try {
        button.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        // Ignore click errors
      }
    }
  }
  
  /**
   * Extract ALL visible data from profile
   */
  static extractComprehensiveData() {
    // Get ALL text from page
    const allText = document.body.innerText || '';
    
    // Extract specific sections by looking for patterns in the text
    const data = {
      allText: allText,
      
      // Extract name (first line or h1)
      name: this.extractName(allText),
      
      // Extract headline (usually second significant line)
      headline: this.extractHeadline(allText),
      
      // Extract about section
      about: this.extractAbout(allText),
      
      // Extract experiences
      experiences: this.extractExperiences(allText),
      
      // Extract skills
      skills: this.extractSkills(allText),
      
      // Extract education
      education: this.extractEducation(allText),
      
      // Extract location
      location: this.extractLocation(allText),
      
      // Look for contact info
      email: this.extractEmail(allText),
      phone: this.extractPhone(allText)
    };
    
    return data;
  }
  
  static extractName(text) {
    const lines = text.split('\n').filter(l => l.trim().length > 2);
    
    // First meaningful line is usually the name
    for (const line of lines.slice(0, 5)) {
      if (line.length > 2 && line.length < 50 && 
          !line.includes('LinkedIn') && 
          !line.includes('connection') &&
          !line.includes('Message') &&
          !line.includes('Connect')) {
        return line.trim();
      }
    }
    
    return 'Unknown';
  }
  
  static extractHeadline(text) {
    const lines = text.split('\n').filter(l => l.trim().length > 10);
    
    // Look for headline patterns
    for (const line of lines.slice(0, 10)) {
      if (line.includes('|') || 
          line.includes('at ') || 
          line.includes('Engineer') ||
          line.includes('Developer') ||
          line.includes('Manager') ||
          line.includes('Analyst')) {
        return line.trim();
      }
    }
    
    return '';
  }
  
  static extractAbout(text) {
    // Look for "About" section
    const aboutIndex = text.toLowerCase().indexOf('about');
    if (aboutIndex !== -1) {
      const aboutSection = text.substring(aboutIndex, aboutIndex + 1000);
      const lines = aboutSection.split('\n').filter(l => l.trim().length > 20);
      return lines.slice(1, 5).join(' ').trim(); // Skip "About" header
    }
    return '';
  }
  
  static extractExperiences(text) {
    const experiences = [];
    
    // Look for experience patterns
    const expPatterns = [
      /(.+?)\s+at\s+(.+?)(?:\n|$)/gi,
      /(.+?)\s+·\s+(.+?)(?:\n|$)/gi
    ];
    
    expPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null && experiences.length < 10) {
        experiences.push({
          title: match[1]?.trim(),
          company: match[2]?.trim()
        });
      }
    });
    
    return experiences;
  }
  
  static extractSkills(text) {
    // Common tech skills to look for
    const techSkills = [
      'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'Angular', 'Vue',
      'HTML', 'CSS', 'SQL', 'MongoDB', 'PostgreSQL', 'AWS', 'Azure', 'Docker',
      'Kubernetes', 'Git', 'TypeScript', 'C++', 'C#', 'Ruby', 'PHP', 'Swift',
      'Kotlin', 'Flutter', 'React Native', 'Django', 'Flask', 'Express',
      'Spring', 'Laravel', 'Rails', 'TensorFlow', 'PyTorch', 'Pandas',
      'NumPy', 'Scikit-learn', 'Tableau', 'Power BI', 'Excel', 'R',
      'Scala', 'Go', 'Rust', 'DevOps', 'CI/CD', 'Jenkins', 'Terraform'
    ];
    
    const foundSkills = [];
    const lowerText = text.toLowerCase();
    
    techSkills.forEach(skill => {
      if (lowerText.includes(skill.toLowerCase())) {
        foundSkills.push(skill);
      }
    });
    
    return foundSkills;
  }
  
  static extractEducation(text) {
    const education = [];
    
    // Look for university/college patterns
    const eduPatterns = [
      /University of (.+?)(?:\n|·|,|$)/gi,
      /(.+?) University(?:\n|·|,|$)/gi,
      /(.+?) College(?:\n|·|,|$)/gi,
      /(MIT|Stanford|Harvard|Berkeley|CMU|Caltech)(?:\n|·|,|$)/gi
    ];
    
    eduPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null && education.length < 5) {
        education.push(match[0].trim());
      }
    });
    
    return education;
  }
  
  static extractLocation(text) {
    // Look for location patterns
    const locationPatterns = [
      /(.+?),\s*(CA|NY|TX|FL|WA|IL|PA|OH|GA|NC|MI|NJ|VA|WI|AZ|MA|TN|IN|MO|MD|MN|CO|AL|SC|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|DC)/gi,
      /(San Francisco|New York|Los Angeles|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|San Jose|Austin|Jacksonville|Fort Worth|Columbus|Charlotte|Seattle|Denver|Boston|El Paso|Detroit|Nashville|Portland|Memphis|Oklahoma City|Las Vegas|Louisville|Baltimore|Milwaukee|Albuquerque|Tucson|Fresno|Sacramento|Mesa|Kansas City|Atlanta|Long Beach|Colorado Springs|Raleigh|Miami|Virginia Beach|Omaha|Oakland|Minneapolis|Tulsa|Arlington|Tampa|New Orleans)/gi
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return '';
  }
  
  static extractEmail(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex) || [];
    return emails[0] || '';
  }
  
  static extractPhone(text) {
    const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const phones = text.match(phoneRegex) || [];
    return phones[0] || '';
  }
  
  /**
   * Get recent posts and comments (last 6 months) + HUNT FOR CONTACT INFO
   */
  static async getRecentActivity() {
    console.log('📝 Getting recent activity + hunting for contact info...');
    
    const currentUrl = window.location.href.replace('/recent-activity/', '').split('/recent-activity')[0];
    console.log(`🔗 Base profile URL: ${currentUrl}`);
    
    // Check multiple activity pages for maximum data
    const activityPages = [
      '/recent-activity/comments/',
      '/recent-activity/posts/',
      '/recent-activity/shares/',
      '/recent-activity/reactions/'
    ];
    
    let allPosts = [];
    let allComments = [];
    let foundEmails = [];
    let foundPhones = [];
    let foundSocialMedia = [];
    let allActivityText = '';
    
    for (const page of activityPages) {
      try {
        console.log(`🔍 Scraping ${page}...`);
        
        const activityUrl = currentUrl + page;
        console.log(`📍 Navigating to: ${activityUrl}`);
        
        window.location.href = activityUrl;
        await new Promise(resolve => setTimeout(resolve, 6000)); // Increased wait time
        
        // Check if we actually navigated to the right page
        const actualUrl = window.location.href;
        console.log(`📍 Actually at: ${actualUrl}`);
        
        if (!actualUrl.includes(page.replace(/\//g, ''))) {
          console.log(`⚠️ Navigation to ${page} may have failed, skipping...`);
          continue;
        }
        
        // Scroll to load more activity
        console.log(`📜 Scrolling to load activity content...`);
    await this.scrollToLoadEverything();
    
        const pageText = document.body.innerText || '';
        console.log(`📄 Page text length: ${pageText.length} characters`);
        
        if (pageText.length < 100) {
          console.log(`⚠️ Very little content found on ${page}, may be empty or restricted`);
          continue;
        }
        
        allActivityText += '\n' + pageText;
        
        // Extract activity data from this page
        const pageActivity = this.extractActivityFromPage(pageText);
        allPosts = allPosts.concat(pageActivity.posts);
        allComments = allComments.concat(pageActivity.comments);
        
        // Hunt for contact info in this page
        const contacts = this.huntContactInfo(pageText);
        foundEmails = foundEmails.concat(contacts.emails);
        foundPhones = foundPhones.concat(contacts.phones);
        foundSocialMedia = foundSocialMedia.concat(contacts.socialMedia);
        
        console.log(`✅ Page ${page}: ${pageActivity.posts.length} posts, ${pageActivity.comments.length} comments, ${contacts.emails.length} emails found`);
        
        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`⚠️ Could not scrape ${page}:`, error.message);
        continue;
      }
    }
    
    // Go back to main profile
    console.log(`🔙 Returning to main profile: ${currentUrl}`);
    window.location.href = currentUrl;
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Remove duplicates and clean up
    const uniqueEmails = [...new Set(foundEmails)];
    const uniquePhones = [...new Set(foundPhones)];
    const uniqueSocial = [...new Set(foundSocialMedia)];
    
    console.log('🎯 ACTIVITY SCRAPING SUMMARY:', {
      totalPosts: allPosts.length,
      totalComments: allComments.length,
      emails: uniqueEmails.length,
      phones: uniquePhones.length,
      socialMedia: uniqueSocial.length,
      totalTextLength: allActivityText.length
    });
    
    console.log('📧 Found emails:', uniqueEmails);
    console.log('📱 Found phones:', uniquePhones);
    console.log('🔗 Found social media:', uniqueSocial);
    
    return {
      posts: allPosts.slice(0, 25), // More posts for better analysis
      comments: allComments.slice(0, 25),
      activityEmails: uniqueEmails,
      activityPhones: uniquePhones,
      activitySocialMedia: uniqueSocial,
      fullActivityText: allActivityText.slice(0, 50000) // Limit for AI processing
    };
  }
  
  /**
   * Extract activity data from a single page
   */
  static extractActivityFromPage(text) {
    const posts = [];
    const comments = [];
    const lines = text.split('\n').filter(l => l.trim().length > 5);
    
    console.log(`🔍 Processing ${lines.length} lines of text from activity page`);
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Skip navigation and UI elements
      if (trimmed.includes('LinkedIn') || 
          trimmed.includes('Show more') || 
          trimmed.includes('See all') ||
          trimmed.includes('Back to') ||
          trimmed.includes('ago') === false || // Must contain timing
          trimmed.length < 10) {
        return;
      }
      
      // Look for posts - usually longer content with engagement indicators
      if (trimmed.length > 50 && trimmed.length < 2000 && 
          (trimmed.includes('ago') || trimmed.includes('week') || trimmed.includes('month'))) {
        
        // Additional checks for post-like content
        if (trimmed.includes('like') || trimmed.includes('comment') || 
            trimmed.includes('share') || trimmed.includes('repost') ||
            trimmed.match(/\d+\s+(like|comment|share)/i)) {
          
          posts.push({
            text: trimmed,
            extractedAt: new Date().toISOString(),
            source: 'activity_scrape',
            lineIndex: index
          });
        }
      }
      
      // Look for comments - usually shorter, conversational
      if (trimmed.length > 15 && trimmed.length < 500 && 
          (trimmed.includes('ago') || trimmed.includes('replied') || trimmed.includes('commented'))) {
        
        // Check if it looks like a comment response
        if (!trimmed.includes('Show more') && !trimmed.includes('Load more') &&
            (trimmed.match(/^[A-Z][a-z].*/) || trimmed.includes('Thanks') || 
             trimmed.includes('Great') || trimmed.includes('Congratulations'))) {
          
          comments.push({
            text: trimmed,
            extractedAt: new Date().toISOString(),
            source: 'activity_scrape',
            lineIndex: index
          });
        }
      }
    });
    
    console.log(`📊 Extracted ${posts.length} posts and ${comments.length} comments from activity page`);
    return { posts, comments };
  }
  
  /**
   * Hunt for contact information in activity text
   */
  static huntContactInfo(text) {
    const emails = [];
    const phones = [];
    const socialMedia = [];
    
    // Enhanced email patterns
    const emailPatterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      /reach me at ([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
      /contact me at ([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
      /email me at ([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
    ];
    
    emailPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        // Extract just the email part
        const emailMatch = match.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          emails.push(emailMatch[0]);
        }
      });
    });
    
    // Enhanced phone number patterns
    const phonePatterns = [
      /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      /call me at ([\d\s\-\(\)\.]+)/gi,
      /phone ([\d\s\-\(\)\.]+)/gi,
      /text me ([\d\s\-\(\)\.]+)/gi
    ];
    
    phonePatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        // Clean up phone number
        const cleaned = match.replace(/[^\d]/g, '');
        if (cleaned.length >= 10) {
          phones.push(match.trim());
        }
      });
    });
    
    // Social media handles
    const socialPatterns = [
      /twitter\.com\/([a-zA-Z0-9_]+)/gi,
      /instagram\.com\/([a-zA-Z0-9_\.]+)/gi,
      /github\.com\/([a-zA-Z0-9_\-]+)/gi,
      /@([a-zA-Z0-9_]+) on twitter/gi,
      /@([a-zA-Z0-9_]+) on instagram/gi,
      /follow me @([a-zA-Z0-9_]+)/gi,
      /my twitter @([a-zA-Z0-9_]+)/gi,
      /my instagram @([a-zA-Z0-9_]+)/gi
    ];
    
    socialPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        socialMedia.push(match.trim());
      });
    });
    
    return { emails, phones, socialMedia };
  }
  
  static extractPosts(text) {
    // Look for post patterns in activity feed
    const posts = [];
    const lines = text.split('\n').filter(l => l.trim().length > 20);
    
    // Posts usually have certain patterns
    lines.forEach(line => {
      if (line.length > 50 && line.length < 500 &&
          (line.includes('ago') || line.includes('week') || line.includes('month'))) {
        posts.push({
          text: line.trim(),
          extractedAt: new Date().toISOString()
        });
      }
    });
    
    return posts;
  }
  
  static extractComments(text) {
    // Similar to posts but usually shorter
    const comments = [];
    const lines = text.split('\n').filter(l => l.trim().length > 10 && l.trim().length < 200);
    
    lines.forEach(line => {
      if (line.includes('ago') && line.length < 200) {
        comments.push({
          text: line.trim(),
          extractedAt: new Date().toISOString()
        });
      }
    });
    
    return comments;
  }
}

// Make available globally
window.DeepResearcher = DeepResearcher;

console.log('✅ Deep Researcher loaded');
