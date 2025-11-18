import { z } from "zod";

// ==================== VIDEO SCHEDULE VALIDATIONS ====================

const VALID_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const VALID_FREQUENCIES = ["once_week", "twice_week", "three_week", "daily"] as const;

export const scheduleObjectSchema = z.object({
  days: z
    .union([
      z.array(z.enum(VALID_DAYS)),
      z.record(z.string()).transform((val) => Object.values(val)),
    ])
    .transform((days) => {
      // Normalize day names (capitalize first letter, lowercase rest)
      return days.map((day: string) => {
        const trimmed = day.trim();
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      });
    })
    .refine(
      (days) => days.every((day) => VALID_DAYS.includes(day as typeof VALID_DAYS[number])),
      {
        message: `Invalid day names. Valid days are: ${VALID_DAYS.join(", ")}`,
      }
    ),
  times: z.union([
    z.array(z.string()),
    z.record(z.string()).transform((val) => Object.values(val)),
  ]),
});

export const createScheduleSchema = z.object({
  frequency: z.enum(VALID_FREQUENCIES, {
    errorMap: () => ({
      message: `Invalid frequency. Must be one of: ${VALID_FREQUENCIES.join(", ")}`,
    }),
  }),
  schedule: scheduleObjectSchema,
  startDate: z.union([z.string(), z.date()]),
  endDate: z.union([z.string(), z.date()]).optional(),
  email: z.string().email("Email must be a valid email address").optional(),
});

export const scheduleIdParamSchema = z.object({
  scheduleId: z.string().min(1, "Schedule ID is required"),
});

export const updateScheduleSchema = z.object({
  frequency: z.enum(VALID_FREQUENCIES).optional(),
  schedule: scheduleObjectSchema.optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    // At least one field must be provided for update
    return (
      data.frequency !== undefined ||
      data.schedule !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.isActive !== undefined
    );
  },
  {
    message: "At least one field must be provided for update",
  }
);

