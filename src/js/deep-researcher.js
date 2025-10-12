/**
 * Deep Researcher - Phase 2 (Simplified)
 * Core research functionality - most logic is now in content.js
 */

// Prevent redeclaration errors
if (typeof window.DeepResearcher !== 'undefined') {
  console.log('🔄 DeepResearcher already loaded, skipping redeclaration');
} else {

class DeepResearcher {
  
  /**
   * Analyze posts and comments with AI to find hidden emails and job seeker indicators
   */
  static async analyzeWithAI(posts, comments, fullText) {
    try {
      // Combine all posts and comments into text
      const postsText = posts.map(p => p.text || p).join('\n\n--- POST ---\n');
      const commentsText = comments.map(c => c.text || c).join('\n\n--- COMMENT ---\n');
      const combinedText = `${postsText}\n\n=== COMMENTS ===\n${commentsText}`;
      
      // Look for any text with @ symbols for AI analysis
      const atSymbolMatches = fullText.match(/@[a-zA-Z0-9._-]+/g) || [];
      const atSymbolText = atSymbolMatches.join(' ');
      
      // Extract any existing emails
      const extractedEmails = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      
      const analysisPayload = {
        posts: posts.slice(0, 10), // Limit for API
        comments: comments.slice(0, 10),
        combinedText: combinedText.slice(0, 8000), // Limit text length
        atSymbolText: atSymbolText,
        extractedEmails: extractedEmails,
        fullTextSnippet: fullText.slice(0, 5000)
      };
      
      console.log('📤 Sending to AI for analysis...', {
        postsCount: posts.length,
        commentsCount: comments.length,
        atSymbols: atSymbolMatches.length,
        emails: extractedEmails.length,
        textLength: combinedText.length
      });
      
      // Call backend AI service
      const response = await fetch('http://localhost:3000/api/analyze-job-seeker-and-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('📥 AI analysis result:', result);
      
      return {
        emails: result.emails || [],
        jobSeekerScore: result.jobSeekerScore || 0,
        jobSeekerIndicators: result.jobSeekerIndicators || [],
        analysis: result.analysis || 'No analysis available',
        confidence: result.confidence || 0
      };
      
    } catch (error) {
      console.error('❌ AI analysis failed:', error);
      return {
        emails: [],
        jobSeekerScore: 0,
        jobSeekerIndicators: [],
        analysis: 'AI analysis failed: ' + error.message,
        confidence: 0
      };
    }
  }

  /**
   * Hunt for contact information in text
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
      /phone ([\d\s\-\(\)\.]+)/gi
    ];
    
    phonePatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
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
      /github\.com\/([a-zA-Z0-9_\-]+)/gi
    ];
    
    socialPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        socialMedia.push(match.trim());
      });
    });
    
    return { emails, phones, socialMedia };
  }
}

// Make available globally
window.DeepResearcher = DeepResearcher;

console.log('✅ Deep Researcher loaded (simplified)');

} // End of redeclaration guard
