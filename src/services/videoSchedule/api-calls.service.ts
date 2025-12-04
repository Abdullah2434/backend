import {
  callCreateVideoAPI as callCreateVideoAPIHelper,
  callGenerateVideoAPI as callGenerateVideoAPIHelper,
} from "../../utils/videoScheduleServiceHelpers";
import { EnhancedContent } from "../../types/videoScheduleService.types";

export class VideoScheduleAPICalls {
  /**
   * Call Step 1: Create Video API endpoint (same as manual)
   */
  static async callCreateVideoAPI(data: any): Promise<EnhancedContent | null> {
    try {
      return await callCreateVideoAPIHelper(data);
    } catch (error: any) {
      throw new Error(`Create Video API failed: ${error.message}`);
    }
  }

  /**
   * Call Step 2: Generate Video API endpoint (same as manual)
   */
  static async callGenerateVideoAPI(data: any): Promise<void> {
    try {
      await callGenerateVideoAPIHelper(data);
    } catch (error: any) {
      throw new Error(`Generate Video API failed: ${error.message}`);
    }
  }
}

