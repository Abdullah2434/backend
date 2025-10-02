import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export class EncryptionHelper {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare a password with its hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a random token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a random string
   */
  static generateRandomString(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Hash a string using SHA-256
   */
  static hashString(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Generate a UUID v4
   */
  static generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Encrypt sensitive data (basic implementation)
   */
  static encrypt(text: string, secretKey: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data (basic implementation)
   */
  static decrypt(encryptedText: string, secretKey: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encrypted = textParts.join(':');
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
