import express from 'express';
import { Op } from 'sequelize';
import sequelize from '../models/db.js';
import Submission from '../models/submission.js';

const router = express.Router();

// GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const { user_id, timeframe } = req.query;

    // 1. If user_id is provided, return their personal history
    if (user_id) {
      const history = await Submission.findAll({
        where: { user_id },
        order: [['createdAt', 'ASC']],
        attributes: ['id', 'total_score', 'scores', 'createdAt'],
      });
      return res.json(history);
    }

    // Determine starting date for weekly timeframe
    let dateFilter = {};
    if (timeframe === 'weekly') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      dateFilter = {
        createdAt: {
          [Op.gte]: oneWeekAgo,
        },
      };
    }

    // 2. Fetch ranked users: Group by user_id, get their best score and average score
    const rankings = await Submission.findAll({
      where: dateFilter,
      attributes: [
        'user_id',
        [sequelize.fn('MAX', sequelize.col('total_score')), 'max_score'],
        [sequelize.fn('AVG', sequelize.col('total_score')), 'avg_score'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'submission_count'],
      ],
      group: ['user_id'],
      order: [[sequelize.literal('max_score'), 'DESC']],
      limit: 50,
    });

    const formattedRankings = rankings.map((rank, index) => ({
      rank: index + 1,
      user_id: rank.getDataValue('user_id'),
      max_score: parseInt(rank.getDataValue('max_score'), 10),
      avg_score: Math.round(parseFloat(rank.getDataValue('avg_score')) * 10) / 10,
      submission_count: parseInt(rank.getDataValue('submission_count'), 10),
    }));

    return res.json({
      timeframe: timeframe || 'all-time',
      rankings: formattedRankings,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ error: 'Failed to fetch leaderboard rankings' });
  }
});

export default router;
