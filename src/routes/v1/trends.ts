import { Router } from 'express';
import { getRealEstateTrends } from '../../controllers/trends.controller';
import { authenticate } from '../../modules/auth/middleware/auth';

const router = Router();

// Public endpoint for real estate trends (works for both authenticated and public users)
// If user is authenticated, trends will be personalized based on their history
router.get('/real-estate', authenticate(), getRealEstateTrends);

// Test endpoint for Grok integration (no auth required)
router.get('/test-grok', async (req, res) => {
  try {
    console.log('🧪 Testing Grok integration...');
    
    const { generateRealEstateTrends } = await import('../../services/trends.service');
    const trends = await generateRealEstateTrends(3, 0, 0, undefined);
    
    res.status(200).json({
      success: true,
      message: 'Grok integration test successful',
      data: {
        trends: trends,
        count: trends.length,
        generated_by: 'grok'
      }
    });
  } catch (error) {
    console.error('Grok test error:', error);
    res.status(500).json({
      success: false,
      message: 'Grok integration test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
