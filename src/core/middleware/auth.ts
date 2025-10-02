import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from '../errors/AppError';
import { logger } from '../utils/logger';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export const authenticate = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new AuthenticationError('Access token is required'));
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is required');
      }

      const decoded = jwt.verify(token, jwtSecret) as any;
      
      if (!decoded.userId || !decoded.email) {
        return next(new AuthenticationError('Invalid token payload'));
      }

      req.user = {
        id: decoded.userId,
        email: decoded.email
      };

      next();
    } catch (error) {
      logger.error('Authentication error:', error);
      next(new AuthenticationError('Invalid or expired token'));
    }
  };
};

export const optionalAuth = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret) {
          const decoded = jwt.verify(token, jwtSecret) as any;
          if (decoded.userId && decoded.email) {
            req.user = {
              id: decoded.userId,
              email: decoded.email
            };
          }
        }
      }
      
      next();
    } catch (error) {
      // For optional auth, we don't throw errors, just continue without user
      next();
    }
  };
};

export const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    // This would need to be implemented based on your user model
    // For now, we'll assume all authenticated users have access
    // You can enhance this by checking user roles from the database
    
    next();
  };
};
