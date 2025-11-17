import { z } from "zod";

// ==================== VIDEO MUTE VALIDATIONS ====================

export const muteVideoSchema = z.union([
  z.array(z.string().url("Each item must be a valid URL")),
  z.record(z.string()).transform((val) => {
    // Convert object with numeric keys to array
    const keys = Object.keys(val);
    const allNumericKeys = keys.every((key) => /^\d+$/.test(key));
    
    if (allNumericKeys && keys.length > 0) {
      return keys
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        .map((key) => val[key])
        .filter((url): url is string => typeof url === "string" && url.trim() !== "");
    }
    
    throw new Error("Invalid format: must be an array of URLs or object with numeric keys");
  }),
]).refine(
  (val) => Array.isArray(val) && val.length > 0,
  "At least one video URL is required"
).refine(
  (val) => {
    if (!Array.isArray(val)) return false;
    return val.every((url) => {
      try {
        new URL(url);
        return url.trim() !== "";
      } catch {
        return false;
      }
    });
  },
  {
    message: "All URLs must be valid and non-empty",
  }
);

