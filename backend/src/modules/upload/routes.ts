import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateJWT, AuthRequest, requireRole } from "../../middleware/auth";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|jpg|jpeg|png)$/i.test(file.originalname);
    if (allowed) cb(null, true);
    else cb(new Error("Only PDF, DOC, DOCX, JPG, PNG allowed"));
  },
});

const router = Router();
router.use(authenticateJWT, requireRole(["agent", "manager", "admin"]));

router.post("/", upload.single("file"), (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: "No file uploaded" } });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.status(201).json({ file_url: fileUrl });
});

export default router;
