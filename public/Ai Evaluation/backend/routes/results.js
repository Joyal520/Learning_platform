import express from 'express';
import Submission from '../models/submission.js';

const router = express.Router();

// GET /api/result/:id
router.get('/:id', async (req, res) => {
  try {
    const submission = await Submission.findByPk(req.params.id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Result not found' });
    }

    return res.json({
      id: submission.id,
      user_id: submission.user_id,
      image_url: submission.image_url,
      module_type: submission.module_type,
      score: submission.score,
      subscores: submission.subscores,
      mistakes: submission.mistakes,
      scores: submission.scores,
      feedback: submission.feedback,
      top_issue: submission.top_issue,
      improvement: submission.improvement,
      unclear: submission.unclear,
      ocr_confidence: submission.ocr_confidence,
      extracted_text: submission.extracted_text,
      corrected_text: submission.corrected_text,
      timestamp: submission.createdAt,
    });
  } catch (error) {
    console.error('Fetch result error:', error);
    return res.status(500).json({ error: 'Failed to fetch result' });
  }
});

export default router;
