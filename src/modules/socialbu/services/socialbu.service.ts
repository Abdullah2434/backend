import axios from "axios";
import SocialBuToken from "../../../database/models/SocialBuToken";
import { connectMongo } from "../../../database/connection";

const SOCIALBU_API_BASE_URL = process.env.SOCIALBU_API_URL || 'https://socialbu.com/api/v1';
const SOCIALBU_AUTH_URL = `${SOCIALBU_API_BASE_URL}/auth/get_token`;

class SocialBuService {
  private static instance: SocialBuService;

  constructor() {}

  static getInstance() {
    if (!SocialBuService.instance) {
      SocialBuService.instance = new SocialBuService();
    }
    return SocialBuService.instance;
  }

  /**
   * Get valid token for API calls
   */
  async getValidToken() {
    try {
      await connectMongo();
      // Try to get active token from database
      const activeToken = await SocialBuToken.findActiveToken();
      if (activeToken && !activeToken.isExpired) {
        // Mark as used and return token
        await activeToken.markAsUsed();
        return activeToken.authToken;
      }
      // If no valid token, try to get new one
      console.log('No valid token found, attempting to get new token...');
      const newToken = await this.getNewToken();
      if (newToken) {
        return newToken.authToken;
      }
      return null;
    } catch (error) {
      console.error('Error getting valid token:', error);
      return null;
    }
  }

  /**
   * Get new token from SocialBu API
   */
  async getNewToken() {
    try {
      await connectMongo();
      const email = process.env.SOCIALBU_EMAIL;
      const password = process.env.SOCIALBU_PASSWORD;
      if (!email || !password) {
        console.error('SocialBu credentials not found in environment variables');
        return null;
      }
      console.log('Calling SocialBu API to get new token...');
      const response = await axios.post(SOCIALBU_AUTH_URL, {
        email,
        password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      if (response.data && response.data.authToken) {
        console.log('Successfully got new token from SocialBu');
        // Find existing active token to update
        const existingToken = await SocialBuToken.findOne({ isActive: true });
        if (existingToken) {
          // Update existing token instead of creating new one
          console.log('Updating existing token instead of creating new one');
          existingToken.authToken = response.data.authToken;
          existingToken.id = response.data.id;
          existingToken.name = response.data.name;
          existingToken.email = response.data.email;
          existingToken.verified = response.data.verified;
          existingToken.isActive = true;
          existingToken.lastUsed = new Date();
          existingToken.updatedAt = new Date();
          await existingToken.save();
          return existingToken;
        } else {
          // No existing token found, create new one
          console.log('No existing token found, creating new one');
          const newToken = new SocialBuToken({
            authToken: response.data.authToken,
            id: response.data.id,
            name: response.data.name,
            email: response.data.email,
            verified: response.data.verified,
            isActive: true,
            lastUsed: new Date()
          });
          await newToken.save();
          return newToken;
        }
      }
      console.log('Failed to get token - no valid response');
      return null;
    } catch (error) {
      console.error('Error getting new token:', error);
      if (axios.isAxiosError(error)) {
        const axiosError = error;
        console.error('SocialBu API Error:', axiosError.response?.data);
      }
      return null;
    }
  }

  /**
   * Save token manually (for initial setup)
   */
  async saveToken(tokenData: any) {
    try {
      await connectMongo();
      console.log('Saving SocialBu token manually...');
      // Find existing active token to update
      const existingToken = await SocialBuToken.findOne({ isActive: true });
      if (existingToken) {
        // Update existing token instead of creating new one
        console.log('Updating existing token instead of creating new one');
        existingToken.authToken = tokenData.authToken;
        existingToken.id = tokenData.id;
        existingToken.name = tokenData.name;
        existingToken.email = tokenData.email;
        existingToken.verified = tokenData.verified;
        existingToken.isActive = true;
        existingToken.lastUsed = new Date();
        existingToken.updatedAt = new Date();
        await existingToken.save();
        return existingToken;
      } else {
        // No existing token found, create new one
        console.log('No existing token found, creating new one');
        const newToken = new SocialBuToken({
          authToken: tokenData.authToken,
          id: tokenData.id,
          name: tokenData.name,
          email: tokenData.email,
          verified: tokenData.verified,
          isActive: true,
          lastUsed: new Date()
        });
        await newToken.save();
        console.log('Token saved successfully');
        return newToken;
      }
    } catch (error) {
      console.error('Error saving token:', error);
      return null;
    }
  }

  /**
   * Make authenticated request to SocialBu API
   */
  async makeAuthenticatedRequest(method: string, endpoint: string, data?: any, retryCount = 0): Promise<any> {
    try {
      const token = await this.getValidToken();
      if (!token) {
        return {
          success: false,
          message: 'No valid token available'
        };
      }
      const url = `${SOCIALBU_API_BASE_URL}${endpoint}`;
      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        ...(data && { data })
      };
      console.log(`Making ${method} request to: ${url}`);
      const response = await axios(config);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`Error making authenticated request to ${endpoint}:`, error);
      if (axios.isAxiosError(error)) {
        const axiosError = error;
        // If unauthorized and we haven't retried yet, try to get new token
        if ((axiosError.response?.status === 401 || axiosError.response?.status === 403) && retryCount === 0) {
          console.log('Token appears to be invalid, attempting to get new token...');
          // Try to get new token
          const newToken = await this.getNewToken();
          if (newToken) {
            // Retry the request with new token
            return this.makeAuthenticatedRequest(method, endpoint, data, retryCount + 1);
          }
        }
        return {
          success: false,
          message: axiosError.response?.data?.message || axiosError.message,
          error: axiosError.response?.data?.message || axiosError.response?.data?.error || axiosError.response?.data || 'Unknown error'
        };
      }
      return {
        success: false,
        message: 'Unknown error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Connect new social media account to SocialBu
   */
  async connectAccount(provider: string, postbackUrl?: string, accountId?: string) {
    try {
      const requestBody: any = {
        provider
      };
      if (postbackUrl) {
        requestBody.postback_url = postbackUrl;
      }
      if (accountId) {
        requestBody.account_id = accountId;
      }
      console.log('Connecting new account to SocialBu:', requestBody);
      const result = await this.makeAuthenticatedRequest('POST', '/accounts', requestBody);
      if (result.success) {
        console.log('Account connected successfully');
        return result;
      }
      // If failed due to authentication, try to refresh token and retry
      if (result.message && (result.message.includes('401') || result.message.includes('403') || result.message.includes('Unauthenticated'))) {
        console.log('Token appears to be invalid, attempting automatic refresh...');
        // Try to get a new token
        const newToken = await this.getNewToken();
        if (newToken) {
          console.log('New token obtained, retrying account connection...');
          // Retry the request with new token
          return this.makeAuthenticatedRequest('POST', '/accounts', requestBody);
        }
      }
      return result;
    } catch (error) {
      console.error('Error connecting account:', error);
      // Try one more time with fresh token
      try {
        console.log('Attempting final retry with fresh token...');
        const newToken = await this.getNewToken();
        if (newToken) {
          const requestBody: any = { provider };
          if (postbackUrl) requestBody.postback_url = postbackUrl;
          if (accountId) requestBody.account_id = accountId;
          return this.makeAuthenticatedRequest('POST', '/accounts', requestBody);
        }
      } catch (retryError) {
        console.error('Final retry failed:', retryError);
      }
      return {
        success: false,
        message: 'Failed to connect account after multiple attempts',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get accounts from SocialBu with seamless token refresh
   */
  async getAccounts() {
    try {
      // First attempt with current token
      const result = await this.makeAuthenticatedRequest('GET', '/accounts?type=all&type=all');
      // If successful, return the result
      if (result.success) {
        return result;
      }
      // If failed due to authentication, try to refresh token and retry
      if (result.message && (result.message.includes('401') || result.message.includes('403') || result.message.includes('Unauthenticated'))) {
        console.log('Token appears to be invalid, attempting automatic refresh...');
        // Try to get a new token
        const newToken = await this.getNewToken();
        if (newToken) {
          console.log('New token obtained, retrying accounts request...');
          // Retry the request with new token
          return this.makeAuthenticatedRequest('GET', '/accounts?type=all&type=all');
        }
      }
      // If all else fails, return the original error
      return result;
    } catch (error) {
      console.error('Error in getAccounts:', error);
      // Try one more time with fresh token
      try {
        console.log('Attempting final retry with fresh token...');
        const newToken = await this.getNewToken();
        if (newToken) {
          return this.makeAuthenticatedRequest('GET', '/accounts?type=all&type=all');
        }
      } catch (retryError) {
        console.error('Final retry failed:', retryError);
      }
      return {
        success: false,
        message: 'Failed to retrieve accounts after multiple attempts',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Manual login to SocialBu (for testing)
   */
  async manualLogin() {
    try {
      const newToken = await this.getNewToken();
      if (newToken) {
        return {
          success: true,
          message: 'Successfully logged in and saved token',
          data: {
            id: newToken.id,
            name: newToken.name,
            email: newToken.email,
            verified: newToken.verified,
            lastUsed: newToken.lastUsed
          }
        };
      } else {
        return {
          success: false,
          message: 'Failed to login to SocialBu'
        };
      }
    } catch (error) {
      console.error('Error in manual login:', error);
      return {
        success: false,
        message: 'Error during login: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }
}

export default SocialBuService.getInstance();