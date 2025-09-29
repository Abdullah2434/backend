import { Request, Response } from 'express';
import webhookService from '../services/webhook.service';

/**
 * Test webhook endpoint
 */
export const testWebhook = async (req: Request, res: Response) => {
  try {
    console.log('Test webhook request:', {
      body: req.body,
      headers: req.headers,
      method: req.method,
      rawBody: req.body
    });

    // Try to parse body if it's a string
    let parsedBody = req.body;
    if (typeof req.body === 'string') {
      try {
        parsedBody = JSON.parse(req.body);
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Webhook test successful',
      data: {
        originalBody: req.body,
        parsedBody: parsedBody,
        hasBody: !!req.body,
        bodyType: typeof req.body,
        headers: req.headers
      }
    });
  } catch (error) {
    console.error('Error in test webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Test webhook failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Handle SocialBu account webhook
 */
export const handleSocialBuWebhook = async (req: Request, res: Response) => {
  try {
    console.log('=== SocialBu Webhook Debug ===');
    console.log('Request Method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request Query:', JSON.stringify(req.query, null, 2));
    console.log('Request Body Type:', typeof req.body);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    console.log('Request Body Length:', req.body ? JSON.stringify(req.body).length : 0);
    console.log('================================');

    // Try to parse body if it's a string
    let webhookData = req.body;
    if (typeof req.body === 'string') {
      try {
        webhookData = JSON.parse(req.body);
        console.log('Parsed JSON body:', JSON.stringify(webhookData, null, 2));
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
        console.error('Raw body that failed to parse:', req.body);
      }
    }

    const { account_action, account_id, account_type, account_name } = webhookData || {};
    const userId = req.query.user_id as string; // Extract user ID from query parameters

    console.log('Extracted data:', {
      account_action,
      account_id,
      account_type,
      account_name,
      userId
    });

    // Validate required fields
    if (!account_action || !account_id || !account_type || !account_name) {
      console.log('Validation failed - Missing required fields:', {
        hasAccountAction: !!account_action,
        hasAccountId: !!account_id,
        hasAccountType: !!account_type,
        hasAccountName: !!account_name,
        account_action,
        account_id,
        account_type,
        account_name
      });
      
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: account_action, account_id, account_type, account_name',
        debug: {
          received: {
            account_action,
            account_id,
            account_type,
            account_name
          }
        }
      });
    }

    // Process the webhook with user ID
    const result = await webhookService.handleSocialBuAccountWebhook({
      account_action,
      account_id,
      account_type,
      account_name
    }, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('=== SocialBu Webhook Error ===');
    console.error('Error details:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Request details:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query
    });
    console.error('===============================');
    
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        requestMethod: req.method,
        requestUrl: req.url,
        hasBody: !!req.body,
        bodyType: typeof req.body
      }
    });
  }
};

/**
 * Get user's SocialBu account IDs
 */
export const getUserSocialBuAccounts = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const result = await webhookService.getUserSocialBuAccounts(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error getting user SocialBu accounts:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get SocialBu accounts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Remove specific SocialBu account from user
 */
export const removeUserSocialBuAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const { accountId } = req.body;

    if (!userId || !accountId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Account ID are required'
      });
    }

    const result = await webhookService.removeUserSocialBuAccount(userId, accountId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error removing SocialBu account:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to remove SocialBu account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};