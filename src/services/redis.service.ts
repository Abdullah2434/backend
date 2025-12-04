import Redis from "ioredis";

let redisClient: Redis | null = null;

/**
 * Get Redis client instance (singleton pattern)
 */
export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on("connect", () => {
      console.log("✅ Redis connected");
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis error:", err);
    });

    redisClient.on("close", () => {
      console.warn("⚠️ Redis connection closed");
    });
  }

  return redisClient;
}

/**
 * Cache-aside pattern helper function
 * Checks cache first, if not found, calls fetcher and stores result in cache
 *
 * @param key Cache key
 * @param fetcher Function that fetches data from source (database, API, etc.)
 * @param ttlSeconds Time to live in seconds (default: 600 = 10 minutes)
 * @returns Cached or freshly fetched data
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 600
): Promise<T> {
  const redis = getRedis();

  try {
    // Try to get from cache
    const cached = await redis.get(key);
    if (cached) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`✅ Cache HIT: ${key}`);
      }
      return JSON.parse(cached) as T;
    }

    // Not in cache, fetch from source
    if (process.env.NODE_ENV !== "production") {
      console.log(`❌ Cache MISS: ${key}`);
    }
    const data = await fetcher();

    // Store in cache if data exists
    if (data !== null && data !== undefined) {
      try {
        await redis.setex(key, ttlSeconds, JSON.stringify(data));
        if (process.env.NODE_ENV !== "production") {
          console.log(`💾 Cached: ${key} (TTL: ${ttlSeconds}s)`);
        }
      } catch (cacheError) {
        // Log but don't fail if cache write fails
        console.error(`⚠️ Failed to cache ${key}:`, cacheError);
      }
    }

    return data;
  } catch (error) {
    // If Redis fails, fall back to fetching from source
    console.error(`⚠️ Redis error for key ${key}, falling back to source:`, error);
    return await fetcher();
  }
}

/**
 * Invalidate cache by deleting the key
 *
 * @param key Cache key to delete
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();

  try {
    await redis.del(key);
    if (process.env.NODE_ENV !== "production") {
      console.log(`🗑️ Cache invalidated: ${key}`);
    }
  } catch (error) {
    // Log but don't fail if cache deletion fails
    console.error(`⚠️ Failed to invalidate cache ${key}:`, error);
  }
}

/**
 * Invalidate multiple cache keys
 *
 * @param keys Array of cache keys to delete
 */
export async function invalidateCaches(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const redis = getRedis();

  try {
    await redis.del(...keys);
    if (process.env.NODE_ENV !== "production") {
      console.log(`🗑️ Cache invalidated: ${keys.length} key(s)`);
    }
  } catch (error) {
    // Log but don't fail if cache deletion fails
    console.error(`⚠️ Failed to invalidate caches:`, error);
  }
}

