import { Request, Response } from 'express'
import WebhookService from '../services/webhook.service'
import { WebhookResult, ApiResponse } from '../types'

const webhookService = new WebhookService()

export async function videoComplete(req: Request, res: Response) {
  try {
    console.log('Video complete webhook received:', req.body)

    const { videoId, status, s3Key, metadata, error } = req.body

    const result = await webhookService.handleVideoComplete({
      videoId,
      status,
      s3Key,
      metadata,
      error
    })

    return res.json(result)
  } catch (e: any) {
    console.error('Video complete webhook error:', e)
    
    return res.status(500).json({
      success: false,
      message: e.message || 'Internal server error'
    })
  }
}