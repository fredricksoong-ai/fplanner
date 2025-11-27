// ============================================================================
// PLANNER ROUTES
// Provides planner-specific aggregates for mobile planner
// ============================================================================

import express from 'express';
import { getCohortMetrics } from '../services/cohortService.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * GET /api/planner/cohorts
 * Returns cached cohort aggregates per gameweek
 */
router.get('/api/planner/cohorts', async (req, res) => {
  const gwParam = req.query.gw;
  const gameweek = gwParam ? parseInt(gwParam, 10) : undefined;

  if (gwParam && (Number.isNaN(gameweek) || gameweek < 1 || gameweek > 38)) {
    return res.status(400).json({
      error: 'Invalid gameweek',
      message: 'gw must be between 1 and 38'
    });
  }

  try {
    const data = await getCohortMetrics(gameweek);
    res.json(data);
  } catch (err) {
    logger.error(`❌ Failed to load planner cohorts: ${err.message}`);
    res.status(500).json({
      error: 'Failed to load planner cohorts',
      message: err.message
    });
  }
});

export default router;

