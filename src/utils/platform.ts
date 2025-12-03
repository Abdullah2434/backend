import { Request } from "express";

/**
 * Detect if the request is from a mobile app
 * Checks for X-Platform or X-Client-Type header with value "mobile"
 * @param req Express request object
 * @returns true if request is from mobile app, false otherwise
 */
export function isMobileApp(req: Request): boolean {
  const platform = req.headers["x-platform"] || req.headers["x-client-type"];
  return platform?.toString().toLowerCase() === "mobile";
}

/**
 * Get the platform type from request
 * @param req Express request object
 * @returns "mobile" | "web" | "unknown"
 */
export function getPlatform(req: Request): "mobile" | "web" | "unknown" {
  if (isMobileApp(req)) {
    return "mobile";
  }
  return "web";
}

