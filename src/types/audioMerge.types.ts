/**
 * Type definitions for audio merge API
 */

export interface AudioMergeRequest {
  urls: string[];
}

export interface AudioMergeResponse {
  url: string;
  totalDuration: number;
  totalFiles: number;
}

