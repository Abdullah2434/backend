import { Request, Response } from 'express';
import { generateRealEstateTrends } from '../services/trends.service';
import { AuthenticatedRequest } from '../types';

export const getRealEstateTrends = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🚀 Generating real estate trends with Grok...');
    
    // Get user ID if authenticated, otherwise use null for public trends
    const userId = req.user?._id?.toString();
    
    const trends = await generateRealEstateTrends(10, 0, 0, userId);
    
    res.status(200).json({
      success: true,
      message: 'Real estate trends generated successfully with Grok',
      data: {
        topic: 'real_estate',
        location: 'America',
        trends: trends,
        count: trends.length,
        generated_by: 'grok',
        user_authenticated: !!userId
      }
    });
  } catch (error) {
    console.error('Error generating real estate trends:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate real estate trends',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
