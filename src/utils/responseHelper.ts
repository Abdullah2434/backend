import { Response } from 'express';

export class ResponseHelper {
  static success(res: Response, message: string, data?: any) {
    return res.status(200).json({
      success: true,
      message,
      data
    });
  }

  static badRequest(res: Response, message: string, error?: any) {
    return res.status(400).json({
      success: false,
      message,
      error
    });
  }

  static unauthorized(res: Response, message: string) {
    return res.status(401).json({
      success: false,
      message
    });
  }

  static notFound(res: Response, message: string) {
    return res.status(404).json({
      success: false,
      message
    });
  }

  static serverError(res: Response, message: string, error?: any) {
    return res.status(500).json({
      success: false,
      message,
      error
    });
  }
}
