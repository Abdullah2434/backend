import { EmailService } from "../email.service";
import {
  ScheduleEmailData,
  VideoGeneratedEmailData,
  VideoProcessingEmailData,
} from "../../types/videoScheduleService.types";
import { EMAIL_SUBJECTS } from "../../constants/videoScheduleService.constants";
import {
  generateScheduleCreatedTemplate,
  generateVideoProcessingTemplate,
  generateVideoGeneratedTemplate,
} from "../../utils/videoScheduleEmailHelpers";

class ScheduleEmailService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  // ==================== EMAIL SENDING ====================
  /**
   * Send email when schedule is created
   */
  async sendScheduleCreatedEmail(data: ScheduleEmailData): Promise<void> {
    const subject = EMAIL_SUBJECTS.SCHEDULE_CREATED(data.totalVideos);
    const html = generateScheduleCreatedTemplate(data);
    await this.emailService.send(data.userEmail, subject, html);
  }

  /**
   * Send email when a video starts processing
   */
  async sendVideoProcessingEmail(
    data: VideoProcessingEmailData
  ): Promise<void> {
    const subject = EMAIL_SUBJECTS.VIDEO_PROCESSING(data.videoTitle);
    const html = generateVideoProcessingTemplate(data);
    await this.emailService.send(data.userEmail, subject, html);
  }

  /**
   * Send email when a video is generated
   */
  async sendVideoGeneratedEmail(data: VideoGeneratedEmailData): Promise<void> {
    const subject = EMAIL_SUBJECTS.VIDEO_GENERATED(
      data.isLastVideo,
      data.videoTitle
    );
    const html = generateVideoGeneratedTemplate(data);
    await this.emailService.send(data.userEmail, subject, html);
  }

}

export default ScheduleEmailService;

