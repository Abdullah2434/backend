import moment from "moment-timezone";

export interface TimezoneInfo {
  timezone: string;
  offset: string;
  utcTime: Date;
  localTime: Date;
}

export class TimezoneService {
  /**
   * Detect timezone from request headers or use default
   */
  static detectTimezone(req: any): string {
    // Try to get timezone from various sources
    const timezoneFromHeader =
      req.headers["x-timezone"] || req.headers["timezone"];
    const timezoneFromBody = req.body?.timezone;
    const timezoneFromQuery = req.query?.timezone;

    // Use detected timezone or fallback to UTC
    const detectedTimezone =
      timezoneFromHeader || timezoneFromBody || timezoneFromQuery || "UTC";

    // Validate timezone
    if (moment.tz.zone(detectedTimezone)) {
      return detectedTimezone;
    }

    // Fallback to UTC if invalid timezone
    console.warn(
      `Invalid timezone detected: ${detectedTimezone}, falling back to UTC`
    );
    return "UTC";
  }

  /**
   * Convert local time to UTC
   */
  static convertToUTC(localTime: string, timezone: string): Date {
    const momentTime = moment.tz(localTime, "HH:mm", timezone);
    return momentTime.utc().toDate();
  }

  /**
   * Convert UTC time to local timezone
   */
  static convertFromUTC(utcTime: Date, timezone: string): string {
    return moment(utcTime).tz(timezone).format("YYYY-MM-DD HH:mm:ss");
  }

  /**
   * Convert local datetime string to UTC Date
   */
  static convertLocalDateTimeToUTC(
    localDateTime: string,
    timezone: string
  ): Date {
    // If already an ISO string with timezone (e.g., ends with Z or +05:00), don't re-interpret as local
    if (TimezoneService.isISOWithZone(localDateTime)) {
      return new Date(localDateTime);
    }

    const momentTime = moment.tz(
      localDateTime,
      "YYYY-MM-DD HH:mm:ss",
      timezone
    );
    return momentTime.utc().toDate();
  }

  /**
   * Convert UTC Date to local datetime string
   */
  static convertUTCToLocalDateTime(utcTime: Date, timezone: string): string {
    return moment(utcTime).tz(timezone).format("YYYY-MM-DD HH:mm:ss");
  }

  /**
   * Get current time in specific timezone
   */
  static getCurrentTime(timezone: string): Date {
    return moment().tz(timezone).toDate();
  }

  /**
   * Get current UTC time
   */
  static getCurrentUTC(): Date {
    return moment().utc().toDate();
  }

  /**
   * Parse schedule times and convert to UTC
   */
  static parseScheduleTimes(times: string[], timezone: string): string[] {
    return times.map((time) => {
      const utcTime = this.convertToUTC(time, timezone);
      return moment(utcTime).format("HH:mm");
    });
  }

  /**
   * Detect if a datetime string already contains a timezone designator
   * Examples: 2024-01-15T09:00:00Z, 2024-01-15T09:00:00+05:00
   */
  static isISOWithZone(value: string): boolean {
    if (typeof value !== "string") return false;
    return /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  }

  /**
   * Ensure a value is a UTC Date without double conversion.
   * - If Date instance: assume already UTC-compatible and return new Date(date).
   * - If ISO string with zone: new Date(value).
   * - Otherwise: treat as local datetime string in provided timezone and convert to UTC.
   */
  static ensureUTCDate(value: string | Date, timezone: string): Date {
    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (TimezoneService.isISOWithZone(value)) {
      return new Date(value);
    }

    return TimezoneService.convertLocalDateTimeToUTC(value, timezone);
  }

  /**
   * Get timezone information
   */
  static getTimezoneInfo(timezone: string): TimezoneInfo {
    const now = moment();
    const utcTime = now.utc().toDate();
    const localTime = now.tz(timezone).toDate();
    const offset = now.tz(timezone).format("Z");

    return {
      timezone,
      offset,
      utcTime,
      localTime,
    };
  }

  /**
   * Validate timezone string
   */
  static isValidTimezone(timezone: string): boolean {
    return !!moment.tz.zone(timezone);
  }

  /**
   * Get list of common timezones
   */
  static getCommonTimezones(): string[] {
    return [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Kolkata",
      "Australia/Sydney",
    ];
  }
}

export default TimezoneService;
