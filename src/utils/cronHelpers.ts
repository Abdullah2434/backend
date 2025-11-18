/**
 * Utility functions for cron job optimization and timeout protection
 */

/**
 * Execute an async operation with a timeout
 * @param promise The promise to execute
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Custom error message for timeout
 * @returns Promise that rejects if timeout is exceeded
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = "Operation timed out"
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${errorMessage} (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Execute a database operation with timeout
 * @param operation The database operation promise
 * @param timeoutMs Timeout in milliseconds (default: 30 seconds)
 * @returns Promise with timeout protection
 */
export async function withDatabaseTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return withTimeout(operation, timeoutMs, "Database operation timed out");
}

/**
 * Create axios config with timeout
 * @param timeoutMs Timeout in milliseconds
 * @returns Axios request config
 */
export function withApiTimeout(timeoutMs: number = 60000) {
  return {
    timeout: timeoutMs,
  };
}

/**
 * Execute an entire cron job with overall timeout protection
 * @param jobName Name of the cron job for logging
 * @param operation The main operation to execute
 * @param timeoutMs Overall timeout in milliseconds
 * @returns Promise with timeout protection
 */
export async function executeWithOverallTimeout<T>(
  jobName: string,
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return withTimeout(
    operation,
    timeoutMs,
    `Cron job "${jobName}" exceeded overall timeout`
  );
}

/**
 * Retry an operation with exponential backoff
 * @param operation The operation to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param initialDelayMs Initial delay in milliseconds (default: 1000)
 * @returns Promise that resolves with the operation result
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Process items in batches with delay between batches
 * @param items Array of items to process
 * @param batchSize Number of items per batch
 * @param processor Function to process each item
 * @param delayBetweenBatchesMs Delay between batches in milliseconds
 * @returns Array of results
 */
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>,
  delayBetweenBatchesMs: number = 1000
): Promise<R[]> {
  const results: R[] = [];
  const batches: T[][] = [];
  
  // Split into batches
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // Process batch items in parallel
    const batchPromises = batch.map((item) =>
      processor(item).catch((error) => {
        console.error(`Error processing item in batch:`, error);
        return null as R;
      })
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Collect successful results
    batchResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value !== null) {
        results.push(result.value);
      }
    });
    
    // Add delay between batches (except for last batch)
    if (batchIndex < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatchesMs));
    }
  }
  
  return results;
}

