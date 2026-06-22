import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Submission from '../models/submission.js';
import { evaluateHandwriting } from '../services/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter (accept only PNG, JPG, JPEG)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const mimeType = allowedTypes.test(file.mimetype);
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimeType && extName) {
    return cb(null, true);
  }
  cb(new Error('Only JPG, JPEG, and PNG images are allowed!'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

// POST /api/upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const userId = req.body.user_id || 'anonymous_user';
    const moduleType = req.body.module_type || 'essay';
    
    let additionalInput = '';
    if (moduleType === 'worksheet') {
      additionalInput = req.body.answer_key || '';
    } else if (moduleType === 'picture_description') {
      additionalInput = req.body.image_prompt || '';
    } else if (moduleType === 'handwriting') {
      additionalInput = req.body.reference_text || '';
    }

    const filePath = req.file.path;
    
    // Construct local serving URL
    const imageUrl = `/uploads/${req.file.filename}`;

    // Convert file to Base64 for the OpenAI API
    const imageBuffer = fs.readFileSync(filePath);
    const mimeType = req.file.mimetype;
    const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    // Run AI Evaluation
    const evaluation = await evaluateHandwriting(base64Image, moduleType, additionalInput);

    // Calculate normalized total score (0 to 100) for leaderboard consistency
    let totalScore = 0;
    if (evaluation.unclear) {
      totalScore = 0;
    } else if (moduleType === 'worksheet') {
      const totalQ = parseInt(evaluation.subscores.total_questions, 10) || 1;
      const correctQ = parseInt(evaluation.subscores.correct, 10) || 0;
      totalScore = Math.round((correctQ / Math.max(totalQ, 1)) * 100);
    } else {
      const rawScore = parseFloat(evaluation.score) || 0.0;
      totalScore = Math.round(rawScore * 10);
    }

    // Map backwards-compatible scores object for legacy code or components
    let legacyScores = { grammar: 0, spelling: 0, clarity: 0, total: totalScore };
    if (!evaluation.unclear) {
      if (moduleType === 'essay') {
        legacyScores = {
          grammar: evaluation.subscores.grammar || 0,
          spelling: evaluation.subscores.spelling || 0,
          clarity: evaluation.subscores.content || 0,
          total: totalScore
        };
      } else if (moduleType === 'worksheet') {
        legacyScores = {
          grammar: evaluation.subscores.correct || 0,
          spelling: evaluation.subscores.wrong || 0,
          clarity: evaluation.subscores.total_questions || 0,
          total: totalScore
        };
      } else if (moduleType === 'picture_description') {
        legacyScores = {
          grammar: evaluation.subscores.relevance || 0,
          spelling: evaluation.subscores.language || 0,
          clarity: 0,
          total: totalScore
        };
      } else if (moduleType === 'handwriting') {
        legacyScores = {
          grammar: evaluation.subscores.neatness || 0,
          spelling: evaluation.subscores.readability || 0,
          clarity: evaluation.subscores.accuracy || 0,
          total: totalScore
        };
      }
    }

    // Save submission to database
    const submission = await Submission.create({
      user_id: userId,
      image_url: imageUrl,
      module_type: moduleType,
      score: evaluation.score,
      subscores: evaluation.subscores,
      mistakes: evaluation.mistakes,
      feedback: evaluation.feedback,
      top_issue: evaluation.top_issue,
      improvement: evaluation.improvement,
      unclear: evaluation.unclear,
      ocr_confidence: evaluation.ocr_confidence,
      extracted_text: evaluation.extracted_text,
      corrected_text: evaluation.corrected_text,
      total_score: totalScore,
      scores: legacyScores
    });

    // Return the response matching the strict JSON output format requested,
    // plus the DB ID and imageUrl so the frontend can display them.
    return res.status(201).json({
      id: submission.id,
      image_url: submission.image_url,
      ...evaluation,
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Cleanup file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (error.message.includes('file size')) {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }
    
    return res.status(500).json({ error: error.message || 'Evaluation failed. Please try again.' });
  }
});

export default router;
