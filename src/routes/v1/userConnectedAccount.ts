import { Router } from 'express'
import {
  getUserConnectedAccounts,
  getUserConnectedAccountsByType,
  getUserAccountStats,
  syncUserConnectedAccounts,
  deactivateConnectedAccount,
  deleteConnectedAccount,
  updateAccountLastUsed
} from '../../controllers/userConnectedAccount.controller'

const router = Router()

// Get all connected accounts for the authenticated user
router.get('/', getUserConnectedAccounts)

// Get connected accounts by type
router.get('/type/:type', getUserConnectedAccountsByType)

// Get account statistics
router.get('/stats', getUserAccountStats)

// Sync accounts from SocialBu API
router.post('/sync', syncUserConnectedAccounts)

// Deactivate a connected account
router.put('/:socialbuAccountId/deactivate', deactivateConnectedAccount)

// Delete a connected account permanently
router.delete('/:socialbuAccountId', deleteConnectedAccount)

// Update last used timestamp
router.put('/:socialbuAccountId/last-used', updateAccountLastUsed)

export default router
