import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getMetrics, getMetricsByDateRange, getLatestMetrics } from '../database/db.js';

const router = express.Router();

router.get('/:serverId', authenticateToken, (req, res, next) => {
  try {
    const { serverId } = req.params;
    const { startDate, endDate, limit } = req.query;

    let metrics;

    if (startDate && endDate) {
      metrics = getMetricsByDateRange(serverId, startDate, endDate);
    } else if (limit) {
      metrics = getLatestMetrics(serverId, parseInt(limit));
    } else {
      // Default: last 7 days
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      metrics = getMetrics(serverId, startDate, endDate);
    }

    res.json({ metrics });
  } catch (error) {
    next(error);
  }
});

export { router as metricsRouter };

