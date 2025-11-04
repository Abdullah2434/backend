import { IVideoSchedule } from "../../models/VideoSchedule";

export interface ScheduleData {
  frequency: "once_week" | "twice_week" | "three_week" | "daily";
  schedule: {
    days: string[];
    times: string[];
  };
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export { IVideoSchedule };

