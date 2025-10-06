// LinkedIn API Service - Hybrid approach using OAuth + scraping
const axios = require('axios');

class LinkedInAPIService {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.accessToken = null;
  }
  
  /**
   * Generate OAuth URL for user to authorize
   */
  getAuthorizationUrl() {
    const scopes = ['r_liteprofile', 'r_emailaddress', 'w_member_social'];
    const state = Math.random().toString(36).substring(7);
    
    return `https://www.linkedin.com/oauth/v2/authorization?` +
      `response_type=code&` +
      `client_id=${this.clientId}&` +
      `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
      `state=${state}&` +
      `scope=${scopes.join('%20')}`;
  }
  
  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code) {
    try {
      const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
        params: {
          grant_type: 'authorization_code',
          code: code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      this.accessToken = response.data.access_token;
      return this.accessToken;
      
    } catch (error) {
      console.error('❌ Failed to get access token:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Get user's own profile
   */
  async getMyProfile() {
    if (!this.accessToken) {
      throw new Error('No access token. Please authenticate first.');
    }
    
    try {
      // Get basic profile
      const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      // Get email
      const emailResponse = await axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      const profile = profileResponse.data;
      const email = emailResponse.data.elements?.[0]?.['handle~']?.emailAddress;
      
      return {
        id: profile.id,
        firstName: profile.localizedFirstName,
        lastName: profile.localizedLastName,
        fullName: `${profile.localizedFirstName} ${profile.localizedLastName}`,
        email: email,
        profilePicture: profile.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier
      };
      
    } catch (error) {
      console.error('❌ Failed to get profile:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Get user's connections
   * NOTE: This requires special LinkedIn partnership - most apps can't access this
   */
  async getConnections() {
    console.log('⚠️ Note: Connection API requires LinkedIn partnership');
    console.log('💡 Use web scraping for connections list instead');
    
    // This endpoint is restricted - keeping for reference
    return {
      available: false,
      message: 'Connection API requires LinkedIn partnership',
      alternative: 'Use scraping from /mynetwork/invite-connect/connections/'
    };
  }
  
  /**
   * Search for people (limited to what LinkedIn allows)
   */
  async searchPeople(keywords) {
    console.log('⚠️ Note: People Search API requires LinkedIn partnership');
    console.log('💡 Use web scraping for people search instead');
    
    return {
      available: false,
      message: 'People Search API requires LinkedIn partnership',
      alternative: 'Use scraping from search results page'
    };
  }
}

module.exports = LinkedInAPIService;

