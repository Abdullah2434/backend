import UserConnectedAccount, { IUserConnectedAccount } from '../models/UserConnectedAccount'
import { SocialBuAccount } from '../types'

export interface UserConnectedAccountData {
  userId: string
  socialbuAccountId: number
  accountName: string
  accountType: string
  accountTypeDisplay: string
  accountId: string
  publicId: string
  isActive: boolean
  image?: string
  postMaxlength: number
  attachmentTypes: string[]
  maxAttachments: number
  postMediaRequired: boolean
  videoDimensions: {
    min: [number, number | null]
    max: [number | null, number | null]
  }
  videoDuration: {
    min: number
    max: number
  }
  extraData?: any
}

export class UserConnectedAccountService {
  /**
   * Save or update a user's connected account
   */
  async saveUserConnectedAccount(data: UserConnectedAccountData): Promise<IUserConnectedAccount> {
    const existingAccount = await UserConnectedAccount.findOne({
      userId: data.userId,
      socialbuAccountId: data.socialbuAccountId
    })

    if (existingAccount) {
      // Update existing account
      const updatedAccount = await UserConnectedAccount.findOneAndUpdate(
        { userId: data.userId, socialbuAccountId: data.socialbuAccountId },
        {
          accountName: data.accountName,
          accountType: data.accountType,
          accountTypeDisplay: data.accountTypeDisplay,
          accountId: data.accountId,
          publicId: data.publicId,
          isActive: data.isActive,
          image: data.image,
          postMaxlength: data.postMaxlength,
          attachmentTypes: data.attachmentTypes,
          maxAttachments: data.maxAttachments,
          postMediaRequired: data.postMediaRequired,
          videoDimensions: data.videoDimensions,
          videoDuration: data.videoDuration,
          extraData: data.extraData,
          lastUsedAt: new Date()
        },
        { new: true, upsert: false }
      )

      if (!updatedAccount) {
        throw new Error('Failed to update user connected account')
      }
      return updatedAccount
    } else {
      // Create new account
      const newAccount = new UserConnectedAccount({
        userId: data.userId,
        socialbuAccountId: data.socialbuAccountId,
        accountName: data.accountName,
        accountType: data.accountType,
        accountTypeDisplay: data.accountTypeDisplay,
        accountId: data.accountId,
        publicId: data.publicId,
        isActive: data.isActive,
        image: data.image,
        postMaxlength: data.postMaxlength,
        attachmentTypes: data.attachmentTypes,
        maxAttachments: data.maxAttachments,
        postMediaRequired: data.postMediaRequired,
        videoDimensions: data.videoDimensions,
        videoDuration: data.videoDuration,
        extraData: data.extraData,
        connectedAt: new Date(),
        lastUsedAt: new Date()
      })

      await newAccount.save()
      return newAccount
    }
  }

  /**
   * Get all connected accounts for a user
   */
  async getUserConnectedAccounts(userId: string): Promise<IUserConnectedAccount[]> {
    return await UserConnectedAccount.find({ 
      userId, 
      isActive: true 
    }).sort({ connectedAt: -1 })
  }

  /**
   * Get a specific connected account by userId and socialbuAccountId
   */
  async getUserConnectedAccount(userId: string, socialbuAccountId: number): Promise<IUserConnectedAccount | null> {
    return await UserConnectedAccount.findOne({ 
      userId, 
      socialbuAccountId,
      isActive: true 
    })
  }

  /**
   * Update multiple accounts from SocialBu API response
   */
  async updateUserConnectedAccountsFromSocialBu(userId: string, socialbuAccounts: SocialBuAccount[]): Promise<IUserConnectedAccount[]> {
    const results: IUserConnectedAccount[] = []

    for (const account of socialbuAccounts) {
      const accountData: UserConnectedAccountData = {
        userId,
        socialbuAccountId: account.id,
        accountName: account.name,
        accountType: account.type,
        accountTypeDisplay: account._type,
        accountId: account.account_id,
        publicId: account.public_id,
        isActive: account.active,
        image: account.image,
        postMaxlength: account.post_maxlength,
        attachmentTypes: account.attachment_types,
        maxAttachments: account.max_attachments,
        postMediaRequired: account.post_media_required,
        videoDimensions: account.video_dimensions,
        videoDuration: account.video_duration,
        extraData: account.extra_data
      }

      const savedAccount = await this.saveUserConnectedAccount(accountData)
      results.push(savedAccount)
    }

    return results
  }

  /**
   * Deactivate a connected account
   */
  async deactivateUserConnectedAccount(userId: string, socialbuAccountId: number): Promise<boolean> {
    const result = await UserConnectedAccount.findOneAndUpdate(
      { userId, socialbuAccountId },
      { isActive: false },
      { new: true }
    )
    return result !== null
  }

  /**
   * Delete a connected account permanently
   */
  async deleteUserConnectedAccount(userId: string, socialbuAccountId: number): Promise<boolean> {
    const result = await UserConnectedAccount.deleteOne({ 
      userId, 
      socialbuAccountId 
    })
    return result.deletedCount > 0
  }

  /**
   * Get connected accounts by type
   */
  async getUserConnectedAccountsByType(userId: string, accountType: string): Promise<IUserConnectedAccount[]> {
    return await UserConnectedAccount.find({ 
      userId, 
      accountType,
      isActive: true 
    }).sort({ connectedAt: -1 })
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(userId: string, socialbuAccountId: number): Promise<boolean> {
    const result = await UserConnectedAccount.findOneAndUpdate(
      { userId, socialbuAccountId },
      { lastUsedAt: new Date() },
      { new: true }
    )
    return result !== null
  }

  /**
   * Get account statistics for a user
   */
  async getUserAccountStats(userId: string): Promise<{
    total: number
    active: number
    byType: Record<string, number>
    lastConnected: Date | null
  }> {
    const accounts = await UserConnectedAccount.find({ userId })
    
    const stats = {
      total: accounts.length,
      active: accounts.filter(acc => acc.isActive).length,
      byType: {} as Record<string, number>,
      lastConnected: null as Date | null
    }

    // Count by type
    accounts.forEach(account => {
      stats.byType[account.accountType] = (stats.byType[account.accountType] || 0) + 1
    })

    // Find most recent connection
    if (accounts.length > 0) {
      stats.lastConnected = new Date(Math.max(...accounts.map(acc => acc.connectedAt.getTime())))
    }

    return stats
  }
}

export const userConnectedAccountService = new UserConnectedAccountService()
