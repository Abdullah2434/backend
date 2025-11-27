import { Router } from 'express';
import {
  disconnectAccount,
  checkAccount
} from '../../controllers/socialbu/socialbu-account.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Account management routes
router.delete('/:accountId', authenticate, disconnectAccount); // Disconnect account by ID
router.get('/:accountId/check', authenticate, checkAccount); // Check if user has account

export default router;
