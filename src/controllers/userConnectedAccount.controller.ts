import { Request, Response } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import { ResponseHelper } from '../utils/responseHelper'
import { userConnectedAccountService } from '../services/userConnectedAccount.service'

/**
 * Get all connected accounts for the authenticated user
 */
export const getUserConnectedAccounts = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id

  if (!userId) {
    return ResponseHelper.unauthorized(res, 'User authentication required')
  }

  const accounts = await userConnectedAccountService.getUserConnectedAccounts(userId)

  return ResponseHelper.success(
    res,
    'User connected accounts retrieved successfully',
    accounts
  )
})

/**
 * Get connected accounts by type for the authenticated user
 */
export const getUserConnectedAccountsByType = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id
  const { type } = req.params

  if (!userId) {
    return ResponseHelper.unauthorized(res, 'User authentication required')
  }

  if (!type) {
    return ResponseHelper.badRequest(res, 'Account type is required')
  }

  const accounts = await userConnectedAccountService.getUserConnectedAccountsByType(userId, type)

  return ResponseHelper.success(
    res,
    `User connected ${type} accounts retrieved successfully`,
    accounts
  )
})

/**
 * Get account statistics for the authenticated user
 */
export const getUserAccountStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id

  if (!userId) {
    return ResponseHelper.unauthorized(res, 'User authentication required')
  }

  const stats = await userConnectedAccountService.getUserAccountStats(userId)

  return ResponseHelper.success(
    res,
    'User account statistics retrieved successfully',
    stats
  )
})

/**
 * Sync user connected accounts from SocialBu API
 */
export const syncUserConnectedAccounts = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id

  if (!userId) {
    return ResponseHelper.unauthorized(res, 'User authentication required')
  }

  // Get user's accounts from SocialBu API
  const { socialBuAccountService } = await import('../services/socialbu-account.service')
  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return ResponseHelper.unauthorized(res, 'Access token is required')
  }

  const result = await socialBuAccountService.getUserAccounts(token)

  if (!result.success || !result.data) {
    return ResponseHelper.badRequest(res, result.message, result.error)
  }

  // Update local database with SocialBu accounts
  const updatedAccounts = await userConnectedAccountService.updateUserConnectedAccountsFromSocialBu(
    userId,
    result.data
  )

  return ResponseHelper.success(
    res,
    'User connected accounts synced successfully',
    {
      synced: updatedAccounts.length,
      accounts: updatedAccounts
    }
  )
})

/**
 * Deactivate a connected account
 */
export const deactivateConnectedAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id
  const { socialbuAccountId } = req.params

  if (!userId) {
    return ResponseHelper.unauthorized(res, 'User authentication required')
  }

  if (!socialbuAccountId) {
    return ResponseHelper.badRequest(res, 'SocialBu account ID is required')
  }

  const success = await userConnectedAccountService.deactivateUserConnectedAccount(
    userId,
    parseInt(socialbuAccountId)
  )

  if (!success) {
    return ResponseHelper.notFound(res, 'Connected account not found')
  }

  return ResponseHelper.success(
    res,
    'Connected account deactivated successfully',
    { socialbuAccountId: parseInt(socialbuAccountId) }
  )
})

/**
 * Delete a connected account permanently
 */
export const deleteConnectedAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id
  const { socialbuAccountId } = req.params

  if (!userId) {
    return ResponseHelper.unauthorized(res, 'User authentication required')
  }

  if (!socialbuAccountId) {
    return ResponseHelper.badRequest(res, 'SocialBu account ID is required')
  }

  const success = await userConnectedAccountService.deleteUserConnectedAccount(
    userId,
    parseInt(socialbuAccountId)
  )

  if (!success) {
    return ResponseHelper.notFound(res, 'Connected account not found')
  }

  return ResponseHelper.success(
    res,
    'Connected account deleted successfully',
    { socialbuAccountId: parseInt(socialbuAccountId) }
  )
})

/**
 * Update last used timestamp for an account
 */
export const updateAccountLastUsed = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id
  const { socialbuAccountId } = req.params

  if (!userId) {
    return ResponseHelper.unauthorized(res, 'User authentication required')
  }

  if (!socialbuAccountId) {
    return ResponseHelper.badRequest(res, 'SocialBu account ID is required')
  }

  const success = await userConnectedAccountService.updateLastUsed(
    userId,
    parseInt(socialbuAccountId)
  )

  if (!success) {
    return ResponseHelper.notFound(res, 'Connected account not found')
  }

  return ResponseHelper.success(
    res,
    'Account last used timestamp updated successfully',
    { socialbuAccountId: parseInt(socialbuAccountId) }
  )
})
