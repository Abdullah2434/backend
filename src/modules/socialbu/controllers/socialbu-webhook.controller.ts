import { Response } from "express";
import SocialBuService from "../services/socialbu.service";

const socialBuService = SocialBuService;

const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any
): void => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
  });
};

export const testWebhook = async (req: any, res: Response): Promise<void> => {
  try {
    console.log('SocialBu webhook test endpoint called');
    sendResponse(res, 200, 'Webhook test successful', {
      timestamp: new Date().toISOString(),
      method: req.method,
      headers: req.headers,
      body: req.body
    });
  } catch (error: any) {
    console.error('Error in webhook test:', error);
    sendResponse(res, 500, 'Webhook test failed');
  }
};

export const handleWebhook = async (req: any, res: Response): Promise<void> => {
  try {
    const webhookData = req.body;
    console.log('SocialBu webhook received:', webhookData);
    
    // Simple webhook handling - just log the data
    console.log('Webhook data:', JSON.stringify(webhookData, null, 2));
    
    sendResponse(res, 200, 'Webhook processed successfully', {
      received: true,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    sendResponse(res, 500, 'Webhook processing failed');
  }
};

export const getPublicAccounts = async (req: any, res: Response): Promise<void> => {
  try {
    // Return public account information (no authentication required)
    const result = await socialBuService.getAccounts();
    
    if (result.success) {
      sendResponse(res, 200, 'Public accounts retrieved successfully', result.data);
    } else {
      sendResponse(res, 400, result.message);
    }
  } catch (error: any) {
    console.error('Error getting public accounts:', error);
    sendResponse(res, 500, 'Failed to retrieve public accounts');
  }
};