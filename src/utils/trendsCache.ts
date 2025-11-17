/**
 * Trends cache management
 */

import { TrendData } from "../types/services/trends.types";
import { CACHE_DURATION } from "../constants/trends.constants";

// Simple in-memory cache for trends
const trendsCache = new Map<string, { data: TrendData[]; timestamp: number }>();

/**
 * Get cached trends
 */
export function getCachedTrends(cacheKey: string): TrendData[] | null {
  const cached = trendsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

/**
 * Set cached trends
 */
export function setCachedTrends(cacheKey: string, data: TrendData[]): void {
  trendsCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Generate cache key
 */
export function generateCacheKey(
  city: string,
  position: string,
  count: number
): string {
  const normalizedCity = city.trim().toLowerCase();
  const normalizedPosition = position.trim().toLowerCase();
  return `${normalizedCity}_${normalizedPosition}_${count}`;
}
