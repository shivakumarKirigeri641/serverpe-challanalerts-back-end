const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Feedback photos are stored on disk; the route saves the relative path
// "uploads/feedback_pics/<file>" into the feedbacks row.
const DEST = path.join(__dirname, "..", "uploads", "feedback_pics");
fs.mkdirSync(DEST, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DEST),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safe = `fb_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  },
});

const feedbackUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

module.exports = feedbackUpload;
