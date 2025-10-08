interface CronJobStats {
  name: string;
  lastExecution: Date | null;
  executionCount: number;
  averageDuration: number;
  successCount: number;
  failureCount: number;
  isRunning: boolean;
  lastError: string | null;
}

export class CronMonitoringService {
  private static instance: CronMonitoringService;
  private stats: Map<string, CronJobStats> = new Map();

  private constructor() {}

  public static getInstance(): CronMonitoringService {
    if (!CronMonitoringService.instance) {
      CronMonitoringService.instance = new CronMonitoringService();
    }
    return CronMonitoringService.instance;
  }

  /**
   * Start monitoring a cron job
   */
  startMonitoring(jobName: string): void {
    this.stats.set(jobName, {
      name: jobName,
      lastExecution: null,
      executionCount: 0,
      averageDuration: 0,
      successCount: 0,
      failureCount: 0,
      isRunning: false,
      lastError: null,
    });
  }

  /**
   * Mark job as started
   */
  markJobStarted(jobName: string): void {
    const stats = this.stats.get(jobName);
    if (stats) {
      stats.isRunning = true;
      stats.lastExecution = new Date();
      stats.executionCount++;
    }
  }

  /**
   * Mark job as completed
   */
  markJobCompleted(
    jobName: string,
    duration: number,
    success: boolean = true
  ): void {
    const stats = this.stats.get(jobName);
    if (stats) {
      stats.isRunning = false;

      if (success) {
        stats.successCount++;
      } else {
        stats.failureCount++;
      }

      // Update average duration
      stats.averageDuration = (stats.averageDuration + duration) / 2;
    }
  }

  /**
   * Mark job as failed
   */
  markJobFailed(jobName: string, error: string): void {
    const stats = this.stats.get(jobName);
    if (stats) {
      stats.isRunning = false;
      stats.failureCount++;
      stats.lastError = error;
    }
  }

  /**
   * Get job statistics
   */
  getJobStats(jobName: string): CronJobStats | null {
    return this.stats.get(jobName) || null;
  }

  /**
   * Get all job statistics
   */
  getAllStats(): CronJobStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    stats: CronJobStats[];
  } {
    const issues: string[] = [];
    const stats = this.getAllStats();

    for (const stat of stats) {
      // Check if job is stuck
      if (stat.isRunning && stat.lastExecution) {
        const timeSinceLastExecution =
          Date.now() - stat.lastExecution.getTime();
        if (timeSinceLastExecution > 20 * 60 * 1000) {
          // 20 minutes
          issues.push(
            `${stat.name} appears to be stuck (running for ${Math.round(
              timeSinceLastExecution / 60000
            )} minutes)`
          );
        }
      }

      // Check if job hasn't run recently
      if (stat.lastExecution) {
        const timeSinceLastExecution =
          Date.now() - stat.lastExecution.getTime();
        if (timeSinceLastExecution > 30 * 60 * 1000) {
          // 30 minutes
          issues.push(
            `${stat.name} hasn't run in ${Math.round(
              timeSinceLastExecution / 60000
            )} minutes`
          );
        }
      }

      // Check failure rate
      const totalExecutions = stat.successCount + stat.failureCount;
      if (totalExecutions > 0) {
        const failureRate = (stat.failureCount / totalExecutions) * 100;
        if (failureRate > 50) {
          issues.push(
            `${stat.name} has high failure rate: ${failureRate.toFixed(1)}%`
          );
        }
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(jobName?: string): void {
    if (jobName) {
      this.stats.delete(jobName);
    } else {
      this.stats.clear();
    }
  }
}

export default CronMonitoringService;
