import {
  QueueStats,
  QueueMetrics,
  QueueLogEntry,
  JobPriority,
  RetryConfig,
  RetryResult,
  QueueCleanupOptions,
  QueueBulkOperationResult,
  BatchJobData,
  BatchJobResult,
} from "../types/queue.types";

// ==================== QUEUE UTILITY FUNCTIONS ====================

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function formatUptime(milliseconds: number): string {
  return formatDuration(milliseconds);
}

export function calculateSuccessRate(metrics: QueueMetrics): number {
  if (metrics.totalJobs === 0) return 0;
  return (metrics.successfulJobs / metrics.totalJobs) * 100;
}

export function calculateFailureRate(metrics: QueueMetrics): number {
  if (metrics.totalJobs === 0) return 0;
  return (metrics.failedJobs / metrics.totalJobs) * 100;
}

export function isQueueHealthy(
  metrics: QueueMetrics,
  maxConsecutiveFailures: number = 5
): boolean {
  return metrics.consecutiveFailures <= maxConsecutiveFailures;
}

export function getQueueStatus(
  metrics: QueueMetrics
): "healthy" | "unhealthy" | "degraded" {
  if (metrics.totalJobs === 0) return "healthy";
  if (isQueueHealthy(metrics)) return "healthy";
  if (metrics.consecutiveFailures <= 10) return "degraded";
  return "unhealthy";
}

export function shouldRetryJob(
  metrics: QueueMetrics,
  maxConsecutiveFailures: number = 10,
  maxRetries: number = 3
): boolean {
  return (
    metrics.consecutiveFailures <= maxConsecutiveFailures &&
    metrics.consecutiveFailures <= maxRetries
  );
}

export function getNextRetryDelay(
  consecutiveFailures: number,
  baseDelay: number = 5000
): number {
  // Exponential backoff: 5s, 10s, 20s, 40s, 80s, etc.
  return baseDelay * Math.pow(2, consecutiveFailures - 1);
}

export function getPriorityName(priority: JobPriority): string {
  switch (priority) {
    case JobPriority.LOW:
      return "Low";
    case JobPriority.NORMAL:
      return "Normal";
    case JobPriority.HIGH:
      return "High";
    case JobPriority.CRITICAL:
      return "Critical";
    default:
      return "Unknown";
  }
}

export function getPriorityColor(priority: JobPriority): string {
  switch (priority) {
    case JobPriority.LOW:
      return "#22c55e"; // green
    case JobPriority.NORMAL:
      return "#3b82f6"; // blue
    case JobPriority.HIGH:
      return "#f59e0b"; // yellow
    case JobPriority.CRITICAL:
      return "#ef4444"; // red
    default:
      return "#6b7280"; // gray
  }
}

export function formatQueueStats(stats: QueueStats): string {
  return `Waiting: ${stats.waiting}, Active: ${stats.active}, Completed: ${stats.completed}, Failed: ${stats.failed}, Delayed: ${stats.delayed}`;
}

export function formatLogEntry(log: QueueLogEntry): string {
  const timestamp = log.timestamp.toISOString();
  const emoji = log.success ? "✅" : "❌";
  const duration = log.duration ? ` (${formatDuration(log.duration)})` : "";

  return `${emoji} [${timestamp}] ${log.queueName}: ${log.message}${duration}`;
}

export function summarizeMetrics(metrics: QueueMetrics): string {
  const successRate = calculateSuccessRate(metrics);
  const status = getQueueStatus(metrics);
  const statusEmoji =
    status === "healthy" ? "✅" : status === "unhealthy" ? "❌" : "⚠️";

  return `${statusEmoji} ${metrics.queueName}: ${
    metrics.totalJobs
  } jobs, ${successRate.toFixed(1)}% success rate, ${formatDuration(
    metrics.averageProcessingTime
  )} avg time`;
}

export function createJobSummary(
  queueName: string,
  jobId: string,
  result: any,
  metrics: QueueMetrics
): string {
  const successEmoji = result.success ? "✅" : "❌";
  const duration = result.duration ? formatDuration(result.duration) : "N/A";
  const successRate = calculateSuccessRate(metrics);

  let summary = `${successEmoji} **${queueName} Job ${jobId}**\n`;
  summary += `Duration: ${duration}\n`;
  summary += `Queue Success Rate: ${successRate.toFixed(1)}%\n`;
  summary += `Total Jobs: ${metrics.totalJobs}\n`;

  if (result.data) {
    summary += `Data: ${JSON.stringify(result.data, null, 2)}\n`;
  }

  if (result.error) {
    summary += `Error: ${result.error}\n`;
  }

  return summary;
}

export function shouldNotify(
  result: any,
  config: { enabled: boolean; onJobComplete: boolean; onJobFail: boolean }
): boolean {
  if (!config.enabled) return false;

  if (result.success && config.onJobComplete) return true;
  if (!result.success && config.onJobFail) return true;

  return false;
}

export function getRetryInfo(
  consecutiveFailures: number,
  maxRetries: number
): RetryResult {
  const canRetry = consecutiveFailures <= maxRetries;
  const delay = getNextRetryDelay(consecutiveFailures);
  const attempt = consecutiveFailures + 1;

  return {
    shouldRetry: canRetry,
    delay,
    attempt,
    maxAttempts: maxRetries,
  };
}

export function createHealthReport(queueMetrics: Map<string, QueueMetrics>): {
  totalQueues: number;
  healthyQueues: number;
  unhealthyQueues: number;
  degradedQueues: number;
  overallHealth: "healthy" | "unhealthy" | "degraded";
} {
  const metrics = Array.from(queueMetrics.values());
  const totalQueues = metrics.length;
  const healthyQueues = metrics.filter(
    (m) => getQueueStatus(m) === "healthy"
  ).length;
  const unhealthyQueues = metrics.filter(
    (m) => getQueueStatus(m) === "unhealthy"
  ).length;
  const degradedQueues = metrics.filter(
    (m) => getQueueStatus(m) === "degraded"
  ).length;

  let overallHealth: "healthy" | "unhealthy" | "degraded";
  if (unhealthyQueues === 0 && degradedQueues === 0) {
    overallHealth = "healthy";
  } else if (unhealthyQueues > totalQueues / 2) {
    overallHealth = "unhealthy";
  } else {
    overallHealth = "degraded";
  }

  return {
    totalQueues,
    healthyQueues,
    unhealthyQueues,
    degradedQueues,
    overallHealth,
  };
}

// ==================== QUEUE CLEANUP UTILITIES ====================

export function createCleanupOptions(
  maxAge: number = 24 * 60 * 60 * 1000, // 24 hours
  maxCount: number = 1000,
  grace: number = 5000 // 5 seconds
): QueueCleanupOptions {
  return {
    maxAge,
    maxCount,
    grace,
  };
}

export function calculateCleanupStats(
  beforeStats: QueueStats,
  afterStats: QueueStats
): {
  jobsRemoved: number;
  completedRemoved: number;
  failedRemoved: number;
} {
  const jobsRemoved =
    beforeStats.completed +
    beforeStats.failed -
    (afterStats.completed + afterStats.failed);
  const completedRemoved = beforeStats.completed - afterStats.completed;
  const failedRemoved = beforeStats.failed - afterStats.failed;

  return {
    jobsRemoved,
    completedRemoved,
    failedRemoved,
  };
}

// ==================== BATCH OPERATION UTILITIES ====================

export function createBatchJobData(
  jobs: Array<{
    name: string;
    data: any;
    options?: any;
  }>
): BatchJobData {
  return { jobs };
}

export function processBatchResults(
  results: Array<{ success: boolean; result?: any; error?: string }>,
  jobNames: string[]
): BatchJobResult {
  const totalJobs = results.length;
  const successfulJobs = results.filter((r) => r.success).length;
  const failedJobs = totalJobs - successfulJobs;

  const processedResults = results.map((result, index) => ({
    jobName: jobNames[index] || `job-${index}`,
    success: result.success,
    result: result.result,
    error: result.error,
  }));

  return {
    success: failedJobs === 0,
    totalJobs,
    successfulJobs,
    failedJobs,
    results: processedResults,
  };
}

// ==================== QUEUE MONITORING UTILITIES ====================

export function createQueueAlert(
  queueName: string,
  alertType:
    | "high_failure_rate"
    | "long_processing_time"
    | "queue_backlog"
    | "worker_down",
  data: any
): {
  queueName: string;
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  data: any;
  timestamp: Date;
} {
  const alerts = {
    high_failure_rate: {
      severity: "high" as const,
      message: `High failure rate detected in ${queueName} queue`,
    },
    long_processing_time: {
      severity: "medium" as const,
      message: `Long processing time detected in ${queueName} queue`,
    },
    queue_backlog: {
      severity: "medium" as const,
      message: `Queue backlog detected in ${queueName} queue`,
    },
    worker_down: {
      severity: "critical" as const,
      message: `Worker is down for ${queueName} queue`,
    },
  };

  const alert = alerts[alertType];

  return {
    queueName,
    alertType,
    severity: alert.severity,
    message: alert.message,
    data,
    timestamp: new Date(),
  };
}

export function shouldCreateAlert(
  metrics: QueueMetrics,
  stats: QueueStats,
  thresholds: {
    failureRate: number;
    processingTime: number;
    queueSize: number;
  }
): Array<{ type: string; severity: string; message: string }> {
  const alerts: Array<{ type: string; severity: string; message: string }> = [];

  const failureRate = calculateFailureRate(metrics);
  if (failureRate > thresholds.failureRate) {
    alerts.push({
      type: "high_failure_rate",
      severity: "high",
      message: `Failure rate ${(failureRate * 100).toFixed(
        1
      )}% exceeds threshold ${(thresholds.failureRate * 100).toFixed(1)}%`,
    });
  }

  if (metrics.averageProcessingTime > thresholds.processingTime) {
    alerts.push({
      type: "long_processing_time",
      severity: "medium",
      message: `Average processing time ${formatDuration(
        metrics.averageProcessingTime
      )} exceeds threshold ${formatDuration(thresholds.processingTime)}`,
    });
  }

  const totalQueueSize = stats.waiting + stats.active + stats.delayed;
  if (totalQueueSize > thresholds.queueSize) {
    alerts.push({
      type: "queue_backlog",
      severity: "medium",
      message: `Queue size ${totalQueueSize} exceeds threshold ${thresholds.queueSize}`,
    });
  }

  return alerts;
}

// ==================== QUEUE PERFORMANCE UTILITIES ====================

export function calculateThroughput(
  metrics: QueueMetrics,
  timeWindow: number = 60 * 60 * 1000 // 1 hour
): number {
  if (metrics.totalJobs === 0) return 0;

  // This is a simplified calculation
  // In a real implementation, you'd want to track jobs per time window
  return metrics.totalJobs / (timeWindow / (1000 * 60)); // jobs per minute
}

export function calculateEfficiency(metrics: QueueMetrics): number {
  if (metrics.totalJobs === 0) return 0;

  const successRate = calculateSuccessRate(metrics);
  const avgProcessingTime = metrics.averageProcessingTime;

  // Simple efficiency metric: success rate weighted by processing time
  // Lower processing time = higher efficiency
  const timeEfficiency = Math.max(0, 1 - avgProcessingTime / (5 * 60 * 1000)); // 5 minutes baseline

  return (successRate / 100) * timeEfficiency;
}

export function getPerformanceGrade(
  metrics: QueueMetrics
): "A" | "B" | "C" | "D" | "F" {
  const successRate = calculateSuccessRate(metrics);
  const efficiency = calculateEfficiency(metrics);

  if (successRate >= 95 && efficiency >= 0.8) return "A";
  if (successRate >= 90 && efficiency >= 0.7) return "B";
  if (successRate >= 80 && efficiency >= 0.6) return "C";
  if (successRate >= 70 && efficiency >= 0.5) return "D";
  return "F";
}
