import { Router } from 'express';
import {
  disconnectAccount,
  checkAccount
} from '../../controllers/socialbu-account.controller';

const router = Router();

// Account management routes
router.delete('/:accountId', disconnectAccount); // Disconnect account by ID
router.get('/:accountId/check', checkAccount); // Check if user has account

export default router;
