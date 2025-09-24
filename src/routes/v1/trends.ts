import { Router } from 'express';
import { getRealEstateTrends } from '../../controllers/trends.controller';

const router = Router();

// Public endpoint for real estate trends
router.get('/real-estate', getRealEstateTrends);

export default router;
