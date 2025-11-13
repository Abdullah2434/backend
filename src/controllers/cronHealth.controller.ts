import { Request, Response } from "express";
import CronMonitoringService from "../services/cronMonitoring.service";

const cronMonitor = CronMonitoringService.getInstance();

/**
 * Get cron job health status
 */
export async function getCronHealth(req: Request, res: Response) {
  try {
    const healthStatus = cronMonitor.getHealthStatus();
    const allStats = cronMonitor.getAllStats();

    const response = {
      success: true,
      data: {
        healthy: healthStatus.healthy,
        issues: healthStatus.issues,
        jobs: allStats.map((stat) => ({
          name: stat.name,
          lastExecution: stat.lastExecution,
          executionCount: stat.executionCount,
          averageDuration: Math.round(stat.averageDuration),
          successCount: stat.successCount,
          failureCount: stat.failureCount,
          isRunning: stat.isRunning,
          lastError: stat.lastError,
          successRate:
            stat.executionCount > 0
              ? Math.round((stat.successCount / stat.executionCount) * 100)
              : 0,
        })),
        system: {
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024),
          },
          uptime: Math.round(process.uptime()),
          nodeVersion: process.version,
          platform: process.platform,
        },
      },
    };

    const statusCode = healthStatus.healthy ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to get cron health status",
      error: error.message,
    });
  }
}

/**
 * Reset cron job statistics
 */
export async function resetCronStats(req: Request, res: Response) {
  try {
    const { jobName } = req.body;

    cronMonitor.resetStats(jobName);

    res.json({
      success: true,
      message: jobName
        ? `Reset stats for ${jobName}`
        : "Reset all cron job statistics",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to reset cron statistics",
      error: error.message,
    });
  }
}
