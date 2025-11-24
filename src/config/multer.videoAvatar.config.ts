import multer from "multer";
import {
  TEMP_DIR,
  MAX_FILE_SIZE,
  MAX_FIELD_SIZE,
  MAX_FILES,
  MAX_FIELDS,
} from "../constants/videoAvatar.constants";

/**
 * Configure multer for video avatar file uploads with streaming to avoid memory issues
 */
export const videoAvatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
    fieldSize: MAX_FIELD_SIZE,
    files: MAX_FILES,
    fields: MAX_FIELDS,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed") as any);
    }
  },
});

/**
 * Multer middleware for video avatar file uploads
 */
export const videoAvatarUploadMiddleware = (
  req: any,
  res: any,
  next: any
) => {
  const mw = videoAvatarUpload.fields([
    { name: "training_footage", maxCount: 1 },
    { name: "consent_statement", maxCount: 1 },
  ]);
  mw(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: "Upload error",
        error: String(err),
      });
    }
    next();
  });
};

