/**
 * Types for videoMute service
 */

export interface MuteVideoResult {
  url: string;
  s3Key: string;
  size: number;
}

export interface MuteVideoProcessResult {
  url: string;
  result: MuteVideoResult;
}

export interface MuteVideoFailedResult {
  index: number;
  url: string;
  error: string;
}

