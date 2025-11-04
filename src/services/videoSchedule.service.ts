// Re-export from the new modular structure in videoSchedule folder
// This maintains backward compatibility with existing imports
export {
  VideoScheduleService,
  ScheduleData,
  IVideoSchedule,
} from "./videoSchedule";

// Default export for backward compatibility
export { default } from "./videoSchedule";
