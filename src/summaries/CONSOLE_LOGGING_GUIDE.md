# 🔍 Extension Console & File Logging Guide

## How to View All Research Logs

### **Method 1: Extension Console (Real-time)**
1. **Open Chrome DevTools** (F12 or right-click → Inspect)
2. **Go to Console tab**
3. **Filter by "CONTENT:"** to see content script logs
4. **Filter by "BACKGROUND:"** to see background script logs
5. **Look for the step-by-step research logs**

### **Method 2: Background Script Console**
1. **Go to** `chrome://extensions/`
2. **Find TheNetwrk extension**
3. **Click "Inspect views: background page"**
4. **Go to Console tab**
5. **See background script logs and forwarded content logs**

### **Method 3: Research Log Files (For AI Processing)**
1. **Automatic log files** are created every 50 log entries
2. **Downloaded to your Downloads folder** as `thenetwrk-research-log-YYYY-MM-DD.txt`
3. **Contains complete research trace** with timestamps, URLs, and data
4. **Perfect for reviewing where research gets stuck**

### **Manual Log File Creation**
Run this in the extension console to create a log file immediately:
```javascript
chrome.runtime.sendMessage({ action: 'createLogFile' });
```

## Expected Log Flow

### **Research Start**
```
🔬 CONTENT: Starting comprehensive research for: Claire Hutcheson
📊 CONTENT: STEP 1 - Main profile About section...
```

### **Step 1: Main Profile**
```
🌐 CONTENT: Navigating to main profile (avoiding feed/posts): https://www.linkedin.com/in/clairehutcheson/
⏳ CONTENT: Waiting for main profile to fully load...
📜 CONTENT: Main profile scroll 1/12 to 250px
⏸️ CONTENT: Pausing before next scroll...
🔘 CONTENT: Found About "see more" button: "show more about"
✅ CONTENT: Clicked About "see more" button 1
✅ CONTENT: Main profile research complete: { name: "Claire Hutcheson", headline: "Found", about: "Found" }
✅ CONTENT: STEP 1 complete
```

### **Step 2: Experience Page**
```
💼 CONTENT: STEP 2 - Experience page...
🌐 CONTENT: Navigating to experience page: https://www.linkedin.com/in/clairehutcheson/details/experience/
⏳ CONTENT: Waiting for experience page to fully load...
📜 CONTENT: Experience scroll 1/10 to 300px
⏸️ CONTENT: Pausing before next scroll...
🔘 CONTENT: Clicked experience "see more" 1
✅ CONTENT: Experience page research complete: { experiences: 8 }
✅ CONTENT: STEP 2 complete
```

### **Step 3: Contact Info**
```
📧 CONTENT: STEP 3 - Contact info overlay...
🌐 CONTENT: Navigating to contact info overlay: https://www.linkedin.com/in/clairehutcheson/overlay/contact-info/
⏳ CONTENT: Waiting for contact overlay to load...
⏸️ CONTENT: Pausing to let overlay fully load...
📧 CONTENT: Contact emails found: ["claire@example.com"]
🔙 CONTENT: Returning to main profile...
✅ CONTENT: STEP 3 complete
```

### **Step 4: Comments Page**
```
💬 CONTENT: STEP 4 - Comments page...
🚫 CONTENT: AVOIDING individual post URLs like /feed/update/urn:li:activity:
✅ CONTENT: ONLY going to comments page: https://www.linkedin.com/in/clairehutcheson/recent-activity/comments/
⏳ CONTENT: Waiting for comments page to fully load...
⏸️ CONTENT: Pausing to let comments page fully load...
📜 CONTENT: Comments scroll 1/20 to 400px
⏸️ CONTENT: Pausing before next scroll...
🎯 CONTENT: Found 5 @ symbols so far...
📅 CONTENT: Reached 6-month limit in comments
🎯 CONTENT: @ symbols found in comments: ["@clairehutcheson", "@recruiting"]
📧 CONTENT: Emails found in comments: ["claire.h@company.com"]
✅ CONTENT: STEP 4 complete
```

### **Step 5: AI Analysis**
```
🤖 CONTENT: STEP 5 - AI analysis...
📊 CONTENT: Sending comprehensive data to AI: { name: "Claire Hutcheson", headline: "Found", totalEmails: 2 }
✅ CONTENT: AI analysis complete: { jobSeekerScore: 85, totalEmailsFound: 2 }
✅ CONTENT: STEP 5 complete
```

### **Final Results**
```
🎉 CONTENT: RESEARCH COMPLETE FOR Claire Hutcheson
🎉 ========== RESEARCH COMPLETE ==========
👤 Prospect: Claire Hutcheson
📰 Headline: Senior Recruiter & Sourcer I Ex-Amazon | Open to Work
📄 About: Found
💼 Experiences: 8
📧 Contact Emails: 1
💬 Comment Emails: 1
📧 Total Emails: 2
🎯 Job Seeker Score: 85 %
📊 Research Status: email-found
==========================================
```

## Troubleshooting

### **If you don't see logs:**
1. **Refresh the extension** - Go to `chrome://extensions/` and click refresh
2. **Check console filters** - Make sure no filters are hiding the logs
3. **Look in both consoles** - Content script logs appear in page console, background logs in extension console

### **Key Log Indicators:**
- ✅ **Step completion** - Each step shows "✅ CONTENT: STEP X complete"
- ⏸️ **Pauses** - Shows when the system is waiting/pausing as requested
- 🚫 **Avoiding posts** - Shows it's not going to individual post URLs
- 📊 **Data collection** - Shows what data was found at each step
- 🎉 **Final summary** - Complete research results with all data

## Sample Log File Content

```
2025-01-11T15:30:45.123Z | Claire Hutcheson | https://www.linkedin.com/in/clairehutcheson/
🌐 BACKGROUND: Creating new research tab for Claire Hutcheson
DATA: {
  "prospectName": "Claire Hutcheson",
  "profileUrl": "https://www.linkedin.com/in/clairehutcheson/",
  "action": "creating_tab"
}
================================================================================

2025-01-11T15:30:46.456Z | Claire Hutcheson | https://www.linkedin.com/in/clairehutcheson/
✅ BACKGROUND: Research tab 1891905942 created successfully for Claire Hutcheson
DATA: {
  "prospectName": "Claire Hutcheson",
  "tabId": 1891905942,
  "profileUrl": "https://www.linkedin.com/in/clairehutcheson/",
  "action": "tab_created"
}
================================================================================

2025-01-11T15:30:50.789Z | Claire Hutcheson | https://www.linkedin.com/in/clairehutcheson/
📊 CONTENT: STEP 1 - Main profile About section...
DATA: {
  "prospectName": "Claire Hutcheson",
  "profileUrl": "https://www.linkedin.com/in/clairehutcheson/",
  "step": 1,
  "action": "starting_main_profile"
}
================================================================================
```

All logs appear in **extension console**, **background console**, and **downloadable log files** for comprehensive debugging and AI processing!
