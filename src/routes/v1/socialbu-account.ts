import { Router } from 'express';
import {
  disconnectAccount,
  checkAccount
} from '../../controllers/socialbu/socialbu-account.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Account management routes
router.delete('/:accountId', authenticate as any, disconnectAccount as any); // Disconnect account by ID
router.get('/:accountId/check', authenticate as any, checkAccount as any); // Check if user has account

export default router;
