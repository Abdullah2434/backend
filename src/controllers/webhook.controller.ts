import { Request, Response } from 'express';
import WebhookService from '../services/webhook.service';
import WorkflowHistory from '../models/WorkflowHistory';
import { notificationService } from '../services/notification.service';
import {
  WebhookRequest,
  WebhookResponse,
  ApiResponse
} from '../types';

const webhookService = new WebhookService();

/**
 * Custom webhook endpoint for video avatar notifications
 * POST /v2/webhook/avatar
 */
export async function avatarWebhook(req: Request, res: Response) {
  try {
    const {
      avatar_id,
      status,
      avatar_group_id,
      callback_id,
      user_id
    } = req.body;

    // Validate required fields
    if (!avatar_id || !status || !avatar_group_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: avatar_id, status, and avatar_group_id are required'
      });
    }

    // Validate status
    if (!['completed', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "completed" or "failed"'
      });
    }

    const webhookPayload: WebhookRequest = {
      avatar_id,
      status,
      avatar_group_id,
      callback_id,
      user_id
    };

    // Get user token from headers
    const userToken = req.headers.authorization;

    // Process webhook with user authentication
    const result = await webhookService.processWebhookWithAuth(
      req.body.webhook_url || 'https://webhook.site/test',
      webhookPayload,
      userToken
    );

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Error processing avatar webhook:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}

/**
 * Test webhook endpoint
 * POST /v2/webhook/test
 */
export async function testWebhook(req: Request, res: Response) {
  try {
    const { webhook_url, user_token } = req.body;

    if (!webhook_url) {
      return res.status(400).json({
        success: false,
        message: 'webhook_url is required'
      });
    }

    // Test webhook with optional user authentication
    const result = await webhookService.testWebhook(webhook_url, user_token);

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Error testing webhook:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}

/**
 * Verify webhook signature
 * POST /v2/webhook/verify
 */
export async function verifyWebhook(req: Request, res: Response) {
  try {
    const { payload, signature } = req.body;

    if (!payload || !signature) {
      return res.status(400).json({
        success: false,
        message: 'payload and signature are required'
      });
    }

    const isValid = webhookService.verifyWebhookSignature(payload, signature);

    return res.status(200).json({
      success: true,
      message: isValid ? 'Signature is valid' : 'Signature is invalid',
      data: { isValid }
    });

  } catch (error: any) {
    console.error('Error verifying webhook:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}

/**
 * Get webhook status
 * GET /v2/webhook/status
 */
export async function getWebhookStatus(req: Request, res: Response) {
  try {
    return res.status(200).json({
      success: true,
      message: 'Webhook service is operational',
      data: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: [
          'User authentication',
          'Signature verification',
          'Custom payloads',
          'Error handling'
        ]
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
}

/**
 * Video complete webhook (legacy function for v1 compatibility)
 * POST /webhook/video-complete
 */
export async function videoComplete(req: Request, res: Response) {
  try {
    console.log('Video complete webhook received:', req.body);
    const { videoId, status, s3Key, metadata, error } = req.body;
    
    const result = await webhookService.handleVideoComplete({
      videoId,
      status,
      s3Key,
      metadata,
      error
    });
    
    return res.json(result);
  } catch (e: any) {
    console.error('Video complete webhook error:', e);
    return res.status(500).json({
      success: false,
      message: e.message || 'Internal server error'
    });
  }
}

/**
 * Handle workflow error (legacy function for v1 compatibility)
 * POST /webhook/workflow-error
 */
export async function handleWorkflowError(req: Request, res: Response) {
  try {
    console.log('Workflow error webhook received:', req.body);
    const { errorMessage, executionId } = req.body;
    
    // Validate required fields
    if (!errorMessage || !executionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: errorMessage, executionId'
      });
    }

    // Find user by execution ID
    const workflowHistory = await WorkflowHistory.findOne({ executionId }).populate('userId');
    if (!workflowHistory) {
      console.log(`No workflow history found for execution ID: ${executionId}`);
      return res.status(404).json({
        success: false,
        message: 'Execution not found'
      });
    }

    // Convert technical error to user-friendly message
    const userFriendlyMessage = 'Video creation failed. Please try again or contact support if the issue persists.';

    // Update workflow history to mark as failed
    await WorkflowHistory.findOneAndUpdate({ executionId }, {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: errorMessage
    });

    console.log(`Workflow history updated for execution ${executionId}: failed`);

    // Send socket notification to user
    console.log('Sending workflow error notification to user:', workflowHistory.userId._id.toString());
    notificationService.notifyUser(workflowHistory.userId._id.toString(), 'video-download-update', {
      type: 'error',
      status: 'error',
      message: userFriendlyMessage,
      timestamp: new Date().toISOString()
    });

    console.log(`Workflow error notification sent to user: ${workflowHistory.email}`);

    return res.json({
      success: true,
      message: 'Error notification sent successfully',
      data: {
        executionId,
        email: workflowHistory.email,
        originalError: errorMessage,
        userMessage: userFriendlyMessage,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e: any) {
    console.error('Workflow error webhook error:', e);
    return res.status(500).json({
      success: false,
      message: e.message || 'Internal server error'
    });
  }
}