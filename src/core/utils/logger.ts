// ==================== LOGGER UTILITY ====================

export interface LogLevel {
  ERROR: "error";
  WARN: "warn";
  INFO: "info";
  DEBUG: "debug";
}

export const LOG_LEVELS: LogLevel = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
};

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }

    return `${prefix} ${message}`;
  }

  error(message: string, data?: any): void {
    console.error(this.formatMessage("ERROR", message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage("WARN", message, data));
  }

  info(message: string, data?: any): void {
    console.info(this.formatMessage("INFO", message, data));
  }

  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage("DEBUG", message, data));
    }
  }

  success(message: string, data?: any): void {
    console.log(`✅ ${this.formatMessage("SUCCESS", message, data)}`);
  }
}

export default new Logger();
