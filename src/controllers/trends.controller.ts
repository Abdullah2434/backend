import { Request, Response } from 'express';
import { generateRealEstateTrends } from '../services/trends.service';

export const getRealEstateTrends = async (req: Request, res: Response) => {
  try {
    console.log('Generating real estate trends...');
    
    const trends = await generateRealEstateTrends();
    
    res.status(200).json({
      success: true,
      message: 'Real estate trends generated successfully',
      data: {
        topic: 'real_estate',
        location: 'America',
        trends: trends,
        count: trends.length
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
