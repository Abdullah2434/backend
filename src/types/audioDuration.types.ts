/**
 * Type definitions for audio duration API
 */

export interface AudioDurationRequest {
  url: string;
}

export interface AudioDurationResponse {
  duration: number; // Duration in seconds (with decimals)
  durationFormatted: string; // Formatted duration (e.g., "3:45")
  url: string;
}

