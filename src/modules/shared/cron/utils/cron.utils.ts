import {
  CronJobResult,
  CronLogEntry,
  CronMetrics,
  CronJobCategory,
  CronJobMetadata,
  CronNotificationConfig,
} from "../types/cron.types";

// ==================== CRON UTILITY FUNCTIONS ====================

export function createCronJobMetadata(
  category: CronJobCategory,
  priority: "low" | "medium" | "high" | "critical" = "medium",
  tags: string[] = [],
  dependencies?: string[]
): CronJobMetadata {
  return {
    category,
    priority,
    tags,
    dependencies,
  };
}

export function createNotificationConfig(
  enabled: boolean = true,
  onFailure: boolean = true,
  onSuccess: boolean = false,
  onRetry: boolean = false,
  channels: ("email" | "webhook" | "log")[] = ["log"],
  recipients?: string[],
  webhookUrl?: string
): CronNotificationConfig {
  return {
    enabled,
    onFailure,
    onSuccess,
    onRetry,
    channels,
    recipients,
    webhookUrl,
  };
}

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

export function calculateSuccessRate(metrics: CronMetrics): number {
  if (metrics.totalExecutions === 0) return 0;
  return (metrics.successfulExecutions / metrics.totalExecutions) * 100;
}

export function isJobHealthy(
  metrics: CronMetrics,
  maxConsecutiveFailures: number = 3
): boolean {
  return metrics.consecutiveFailures <= maxConsecutiveFailures;
}

export function getJobStatus(
  metrics: CronMetrics
): "healthy" | "unhealthy" | "unknown" {
  if (metrics.totalExecutions === 0) return "unknown";
  if (isJobHealthy(metrics)) return "healthy";
  return "unhealthy";
}

export function shouldRetryJob(
  metrics: CronMetrics,
  maxConsecutiveFailures: number = 5,
  maxRetries: number = 3
): boolean {
  return (
    metrics.consecutiveFailures <= maxConsecutiveFailures &&
    metrics.consecutiveFailures <= maxRetries
  );
}

export function getNextRetryDelay(
  consecutiveFailures: number,
  baseDelay: number = 60000
): number {
  // Exponential backoff: 1min, 2min, 4min, 8min, 16min, etc.
  return baseDelay * Math.pow(2, consecutiveFailures - 1);
}

export function formatCronSchedule(schedule: string): string {
  const parts = schedule.split(" ");
  if (parts.length !== 5) return schedule;

  const [minute, hour, day, month, weekday] = parts;

  let description = "";

  // Handle special cases
  if (schedule === "0 0 * * *") return "Daily at midnight";
  if (schedule === "0 0 * * 0") return "Weekly on Sunday at midnight";
  if (schedule === "0 0 1 * *") return "Monthly on the 1st at midnight";
  if (schedule === "*/5 * * * *") return "Every 5 minutes";
  if (schedule === "*/10 * * * *") return "Every 10 minutes";
  if (schedule === "*/15 * * * *") return "Every 15 minutes";
  if (schedule === "*/30 * * * *") return "Every 30 minutes";
  if (schedule === "0 * * * *") return "Every hour";
  if (schedule === "0 */2 * * *") return "Every 2 hours";
  if (schedule === "0 */6 * * *") return "Every 6 hours";
  if (schedule === "0 */12 * * *") return "Every 12 hours";

  // Build custom description
  if (minute !== "*" && hour !== "*") {
    description = `Daily at ${hour}:${minute.padStart(2, "0")}`;
  } else if (minute !== "*") {
    description = `Every ${minute} minutes`;
  } else if (hour !== "*") {
    description = `Every ${hour} hours`;
  } else {
    description = schedule;
  }

  return description;
}

export function validateCronSchedule(schedule: string): boolean {
  const parts = schedule.split(" ");
  if (parts.length !== 5) return false;

  const [minute, hour, day, month, weekday] = parts;

  // Basic validation - check if parts are valid cron expressions
  const isValidPart = (part: string): boolean => {
    if (part === "*") return true;
    if (/^\d+$/.test(part)) return true;
    if (/^[\d,]+$/.test(part)) return true;
    if (/^[\d-]+$/.test(part)) return true;
    if (/^[\d,*-]+$/.test(part)) return true;
    if (/^\*\/\d+$/.test(part)) return true;
    return false;
  };

  return [minute, hour, day, month, weekday].every(isValidPart);
}

export function getCategoryEmoji(category: CronJobCategory): string {
  switch (category) {
    case CronJobCategory.AVATAR:
      return "👤";
    case CronJobCategory.VOICE:
      return "🎤";
    case CronJobCategory.TOPIC:
      return "📝";
    case CronJobCategory.CLEANUP:
      return "🧹";
    case CronJobCategory.SYNC:
      return "🔄";
    case CronJobCategory.HEALTH:
      return "🏥";
    case CronJobCategory.NOTIFICATION:
      return "📢";
    default:
      return "⚙️";
  }
}

export function getPriorityColor(
  priority: "low" | "medium" | "high" | "critical"
): string {
  switch (priority) {
    case "low":
      return "#22c55e"; // green
    case "medium":
      return "#f59e0b"; // yellow
    case "high":
      return "#ef4444"; // red
    case "critical":
      return "#dc2626"; // dark red
    default:
      return "#6b7280"; // gray
  }
}

export function formatLogEntry(log: CronLogEntry): string {
  const timestamp = log.timestamp.toISOString();
  const emoji = log.success ? "✅" : "❌";
  const duration = log.duration ? ` (${formatDuration(log.duration)})` : "";

  return `${emoji} [${timestamp}] ${log.jobName}: ${log.message}${duration}`;
}

export function summarizeMetrics(metrics: CronMetrics): string {
  const successRate = calculateSuccessRate(metrics);
  const status = getJobStatus(metrics);
  const statusEmoji =
    status === "healthy" ? "✅" : status === "unhealthy" ? "❌" : "❓";

  return `${statusEmoji} ${metrics.jobName}: ${
    metrics.totalExecutions
  } executions, ${successRate.toFixed(1)}% success rate, ${formatDuration(
    metrics.averageDuration
  )} avg duration`;
}

export function createJobSummary(
  jobName: string,
  result: CronJobResult,
  metrics: CronMetrics
): string {
  const successEmoji = result.success ? "✅" : "❌";
  const duration = formatDuration(result.duration);
  const successRate = calculateSuccessRate(metrics);

  let summary = `${successEmoji} **${jobName}**\n`;
  summary += `Duration: ${duration}\n`;
  summary += `Success Rate: ${successRate.toFixed(1)}%\n`;
  summary += `Total Executions: ${metrics.totalExecutions}\n`;

  if (result.data) {
    summary += `Data: ${JSON.stringify(result.data, null, 2)}\n`;
  }

  if (result.error) {
    summary += `Error: ${result.error}\n`;
  }

  return summary;
}

export function shouldNotify(
  result: CronJobResult,
  config: CronNotificationConfig
): boolean {
  if (!config.enabled) return false;

  if (result.success && config.onSuccess) return true;
  if (!result.success && config.onFailure) return true;

  return false;
}

export function getRetryInfo(
  consecutiveFailures: number,
  maxRetries: number
): { canRetry: boolean; nextRetryDelay: number; attemptsLeft: number } {
  const canRetry = consecutiveFailures <= maxRetries;
  const nextRetryDelay = getNextRetryDelay(consecutiveFailures);
  const attemptsLeft = Math.max(0, maxRetries - consecutiveFailures);

  return { canRetry, nextRetryDelay, attemptsLeft };
}

export function createHealthReport(jobMetrics: Map<string, CronMetrics>): {
  totalJobs: number;
  healthyJobs: number;
  unhealthyJobs: number;
  unknownJobs: number;
  overallHealth: "healthy" | "unhealthy" | "degraded";
} {
  const metrics = Array.from(jobMetrics.values());
  const totalJobs = metrics.length;
  const healthyJobs = metrics.filter(
    (m) => getJobStatus(m) === "healthy"
  ).length;
  const unhealthyJobs = metrics.filter(
    (m) => getJobStatus(m) === "unhealthy"
  ).length;
  const unknownJobs = metrics.filter(
    (m) => getJobStatus(m) === "unknown"
  ).length;

  let overallHealth: "healthy" | "unhealthy" | "degraded";
  if (unhealthyJobs === 0) {
    overallHealth = "healthy";
  } else if (unhealthyJobs > totalJobs / 2) {
    overallHealth = "unhealthy";
  } else {
    overallHealth = "degraded";
  }

  return {
    totalJobs,
    healthyJobs,
    unhealthyJobs,
    unknownJobs,
    overallHealth,
  };
}
