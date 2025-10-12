/**
 * SIMPLE & RELIABLE LinkedIn Profile Scraper
 * 
 * Philosophy: Keep it simple!
 * 1. Load page fully
 * 2. Scroll to trigger lazy loading
 * 3. Click ALL "see more" buttons
 * 4. Get ALL text ONCE
 * 
 * No complicated percentage-based scrolling.
 * No collecting text multiple times.
 * Just get everything, then parse it.
 */

/**
 * Main scraping function - SIMPLE approach
 */
async function scrapeLinkedInProfile(profileUrl) {
  console.log('🚀 SIMPLE SCRAPER: Starting...');
  console.log('📍 URL:', profileUrl);
  
  // STEP 1: Navigate to profile (if needed)
  const baseUrl = profileUrl.replace(/\/$/, '');
  if (!window.location.href.includes(baseUrl)) {
    console.log('🌐 Navigating to profile...');
    window.location.href = baseUrl;
    await waitForPageLoad(10000); // 10 second timeout
  }
  
  // STEP 2: Wait for initial page load
  console.log('⏳ Waiting for page to load...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // STEP 3: Scroll slowly to bottom to trigger lazy loading
  console.log('📜 Scrolling to load all content...');
  await scrollToBottomSlowly();
  
  // STEP 4: Scroll back to top
  console.log('⬆️ Scrolling back to top...');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // STEP 5: Click ALL "see more" buttons
  console.log('🔘 Clicking all "see more" buttons...');
  const buttonsClicked = await clickAllExpandButtons();
  console.log(`✅ Clicked ${buttonsClicked} buttons`);
  
  // STEP 6: Wait for expansions to complete
  console.log('⏳ Waiting for content to expand...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // STEP 7: Get ALL the text - simple!
  console.log('📋 Copying ALL text from page...');
  const allText = document.body.innerText || '';
  
  console.log('✅ Text collected:', allText.length, 'characters');
  
  // STEP 8: Parse the text to extract structured data
  console.log('🧠 Parsing text to extract data...');
  const parsedData = parseProfileText(allText);
  
  console.log('✅ SCRAPING COMPLETE!');
  console.log('📊 Results:', {
    name: parsedData.name || 'Not found',
    headline: parsedData.headline ? 'Found' : 'Not found',
    about: parsedData.about ? `${parsedData.about.length} chars` : 'Not found',
    experiences: parsedData.experiences?.length || 0,
    skills: parsedData.skills?.length || 0,
    totalText: allText.length
  });
  
  return {
    ...parsedData,
    allText: allText,
    scrapedAt: new Date().toISOString(),
    url: profileUrl
  };
}

/**
 * Wait for page to load
 */
async function waitForPageLoad(timeout = 10000) {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const checkLoaded = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      // Check if page has loaded
      if (document.readyState === 'complete' && document.body.innerText.length > 100) {
        clearInterval(checkLoaded);
        resolve();
      }
      
      // Timeout
      if (elapsed > timeout) {
        console.log('⚠️ Page load timeout, continuing anyway...');
        clearInterval(checkLoaded);
        resolve();
      }
    }, 500);
  });
}

/**
 * Scroll slowly to bottom to trigger lazy loading
 */
async function scrollToBottomSlowly() {
  const scrollStep = 300; // pixels per step
  const scrollDelay = 500; // ms between steps
  const maxScrolls = 20; // max number of scrolls
  
  let lastHeight = 0;
  let scrollCount = 0;
  
  while (scrollCount < maxScrolls) {
    // Scroll down one step
    window.scrollBy({ top: scrollStep, behavior: 'smooth' });
    scrollCount++;
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, scrollDelay));
    
    // Check if we've reached bottom
    const currentHeight = window.pageYOffset + window.innerHeight;
    const totalHeight = document.body.scrollHeight;
    
    console.log(`📜 Scroll ${scrollCount}: ${currentHeight}px / ${totalHeight}px`);
    
    if (currentHeight >= totalHeight - 100) {
      console.log('✅ Reached bottom of page');
      break;
    }
    
    // Check if page stopped growing (no more lazy loading)
    if (currentHeight === lastHeight) {
      console.log('✅ Page stopped growing');
      break;
    }
    
    lastHeight = currentHeight;
  }
}

/**
 * Click ALL expand/see more buttons on the page
 */
async function clickAllExpandButtons() {
  const buttons = document.querySelectorAll('button');
  let clickedCount = 0;
  
  console.log(`🔍 Found ${buttons.length} total buttons`);
  
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || '';
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
    
    // Check if this is an expand button
    const isExpandButton = (
      text.includes('see more') ||
      text.includes('show more') ||
      text.includes('see all') ||
      text.includes('show all') ||
      ariaLabel.includes('see more') ||
      ariaLabel.includes('show more')
    );
    
    // Make sure it's visible and not a navigation button
    const isVisible = button.offsetWidth > 0 && button.offsetHeight > 0;
    const isNotNavigation = !text.includes('message') && 
                           !text.includes('connect') && 
                           !text.includes('follow') &&
                           !text.includes('more actions');
    
    if (isExpandButton && isVisible && isNotNavigation) {
      try {
        console.log(`  🔘 Clicking: "${text || ariaLabel}"`);
        button.click();
        clickedCount++;
        
        // Small delay between clicks
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        console.log(`  ⚠️ Click failed: ${e.message}`);
      }
    }
  }
  
  return clickedCount;
}

/**
 * Parse all text to extract structured data
 * This is where we intelligently extract info from the raw text
 */
function parseProfileText(allText) {
  console.log('🧠 Parsing profile text...');
  
  const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let name = '';
  let headline = '';
  let about = '';
  const experiences = [];
  const skills = new Set();
  
  // Extract name - look for h1 first, then text
  const nameEl = document.querySelector('h1.text-heading-xlarge') || 
                 document.querySelector('h1');
  if (nameEl) {
    name = nameEl.textContent.trim();
    console.log(`✅ Name from DOM: "${name}"`);
  } else {
    // Fallback to text analysis
    for (const line of lines.slice(0, 10)) {
      if (line.length > 2 && line.length < 60 && 
          /^[A-Z]/.test(line) &&
          !line.includes('LinkedIn') &&
          !line.includes('connection')) {
        name = line;
        console.log(`✅ Name from text: "${name}"`);
        break;
      }
    }
  }
  
  // Extract headline - look for div.text-body-medium first
  const headlineEl = document.querySelector('div.text-body-medium.break-words');
  if (headlineEl && headlineEl.textContent.trim().length > 10) {
    headline = headlineEl.textContent.trim();
    console.log(`✅ Headline from DOM: "${headline.substring(0, 60)}..."`);
  } else {
    // Fallback to text analysis
    const jobKeywords = ['engineer', 'developer', 'manager', 'designer', 'analyst', 'director', 'at ', ' | '];
    for (const line of lines.slice(0, 20)) {
      const lower = line.toLowerCase();
      if (line.length > 10 && line.length < 200 &&
          jobKeywords.some(k => lower.includes(k))) {
        headline = line;
        console.log(`✅ Headline from text: "${headline.substring(0, 60)}..."`);
        break;
      }
    }
  }
  
  // Extract about - find "About" section
  const aboutIndex = allText.toLowerCase().indexOf('\nabout\n');
  if (aboutIndex !== -1) {
    const afterAbout = allText.substring(aboutIndex + 7); // Skip "\nabout\n"
    const nextSection = afterAbout.search(/\n(experience|education|skills|activity)/i);
    
    if (nextSection !== -1) {
      about = afterAbout.substring(0, nextSection).trim();
    } else {
      about = afterAbout.substring(0, 2000).trim(); // Max 2000 chars
    }
    
    console.log(`✅ About section: ${about.length} chars`);
  }
  
  // Extract experiences - look for "at" patterns
  const expRegex = /(.{10,100})\s+at\s+(.{3,100})/gi;
  let match;
  while ((match = expRegex.exec(allText)) !== null) {
    const title = match[1].trim();
    const company = match[2].trim().split('\n')[0]; // Take first line only
    
    // Basic validation
    if (title.length > 3 && company.length > 2 &&
        !title.includes('Show') && !company.includes('Show')) {
      const expKey = `${title}|||${company}`;
      if (!experiences.some(e => `${e.title}|||${e.company}` === expKey)) {
        experiences.push({ title, company });
      }
    }
  }
  console.log(`✅ Found ${experiences.length} experiences`);
  
  // Extract skills - look for common tech skills
  const techSkills = [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'Angular', 'Vue',
    'TypeScript', 'HTML', 'CSS', 'SQL', 'MongoDB', 'PostgreSQL',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git',
    'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Go', 'Rust',
    'Django', 'Flask', 'Spring', 'Express', 'FastAPI',
    'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Scikit-learn',
    'Tableau', 'Power BI', 'Excel', 'Figma', 'Sketch', 'Adobe XD',
    'Jira', 'Confluence', 'Slack', 'GraphQL', 'REST API',
    'Microservices', 'CI/CD', 'DevOps', 'Agile', 'Scrum'
  ];
  
  const lowerText = allText.toLowerCase();
  for (const skill of techSkills) {
    if (lowerText.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  }
  console.log(`✅ Found ${skills.size} skills`);
  
  return {
    name: name || 'Unknown',
    headline: headline || '',
    about: about || '',
    experiences: experiences.slice(0, 10), // Max 10
    skills: Array.from(skills)
  };
}

/**
 * Export for use in content script
 */
if (typeof window !== 'undefined') {
  window.SimpleLinkedInScraper = {
    scrapeProfile: scrapeLinkedInProfile
  };
}

