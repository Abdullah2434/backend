import multer from "multer";
import { MAX_FILE_SIZE } from "../constants/music.constants";

/**
 * Multer configuration for music file uploads
 */
export const musicUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

