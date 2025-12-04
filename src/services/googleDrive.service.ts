import { google } from "googleapis";
import fs from "fs";

export interface GoogleDriveConfig {
  clientEmail: string;
  privateKey: string;
  folderId: string;
}

export interface GoogleDriveUploadResult {
  fileId: string;
  shareableLink: string;
}

export class GoogleDriveService {
  private drive: any;
  private folderId: string;

  constructor(config: GoogleDriveConfig) {
    // Validate configuration
    if (!config.clientEmail || !config.privateKey || !config.folderId) {
      throw new Error(
        "Google Drive configuration is incomplete. Please check environment variables."
      );
    }

    // Format private key (handle newlines from env var)
    const privateKey = config.privateKey.replace(/\\n/g, "\n");

    // Authenticate with service account
    const auth = new google.auth.JWT({
      email: config.clientEmail,
      key: privateKey,
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive",
      ],
    });

    this.drive = google.drive({ version: "v3", auth });
    this.folderId = config.folderId;
  }

  /**
   * Upload a file from disk path to Google Drive
   */
  async uploadFileFromPath(
    filePath: string,
    fileName: string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      // Read file from disk
      const fileStream = fs.createReadStream(filePath);

      // Prepare file metadata
      const fileMetadata: any = {
        name: fileName,
        parents: [this.folderId],
      };

      // Add custom metadata if provided
      if (metadata) {
        fileMetadata.description = JSON.stringify(metadata);
      }

      // Prepare media for upload
      const media = {
        mimeType: mimeType,
        body: fileStream,
      };

      // Upload file to Google Drive (support Shared Drives)
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, webViewLink, webContentLink",
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });

      const fileId = response.data.id;

      if (!fileId) {
        throw new Error("Failed to upload file to Google Drive: No file ID returned");
      }

      // Make file shareable (anyone with link can view)
      // Support Shared Drives
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });

      return fileId;
    } catch (error: any) {
      console.error("Error uploading file to Google Drive:", error);
      throw new Error(
        `Failed to upload file to Google Drive: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Generate shareable link for a file ID
   */
  async generateShareableLink(fileId: string): Promise<string> {
    try {
      // Ensure file is shareable (support Shared Drives)
      try {
        await this.drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
          supportsAllDrives: true,
          supportsTeamDrives: true,
        });
      } catch (permError: any) {
        // If permission already exists or can't be set, continue
        // (some Shared Drive files may have restrictions)
        console.warn("Could not set permissions (may already exist or be restricted):", permError?.message);
      }

      // Get file metadata to retrieve the shareable link (support Shared Drives)
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: "webViewLink, webContentLink",
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });

      // Return webViewLink for viewing or webContentLink for direct download
      return response.data.webViewLink || response.data.webContentLink || "";
    } catch (error: any) {
      console.error("Error generating shareable link:", error);
      throw new Error(
        `Failed to generate shareable link: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Get direct download/view URL for a file ID
   */
  async getFileUrl(fileId: string, download: boolean = false): Promise<string> {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: "webViewLink, webContentLink",
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });

      if (download) {
        return response.data.webContentLink || "";
      }
      return response.data.webViewLink || "";
    } catch (error: any) {
      console.error("Error getting file URL:", error);
      throw new Error(
        `Failed to get file URL: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Get preview link (webViewLink) for a file ID
   */
  async getPreviewLink(fileId: string): Promise<string> {
    try {
      // Ensure file is shareable (support Shared Drives)
      try {
        await this.drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
          supportsAllDrives: true,
          supportsTeamDrives: true,
        });
      } catch (permError: any) {
        // If permission already exists or can't be set, continue
        console.warn("Could not set permissions (may already exist or be restricted):", permError?.message);
      }

      // Get file metadata to retrieve the preview link (webViewLink)
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: "webViewLink",
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });

      return response.data.webViewLink || "";
    } catch (error: any) {
      console.error("Error getting preview link:", error);
      throw new Error(
        `Failed to get preview link: ${error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      await this.drive.files.delete({
        fileId: fileId,
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });
      return true;
    } catch (error: any) {
      console.error("Error deleting file from Google Drive:", error);
      throw new Error(
        `Failed to delete file: ${error?.message || "Unknown error"}`
      );
    }
  }
}

