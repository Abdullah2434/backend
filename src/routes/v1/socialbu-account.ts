import { Router } from 'express';
import {
  disconnectAccount,
  checkAccount
} from '../../controllers/socialbu-account.controller';

const router = Router();

// Account management routes
router.delete('/:accountId', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }
  
  return await disconnectAccount(req, res, token);
}); // Disconnect account by ID
router.get('/:accountId/check', checkAccount); // Check if user has account

export default router;
