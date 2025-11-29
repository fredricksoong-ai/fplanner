// ============================================================================
// HISTORY ROUTES
// Provides access to historical gameweek data and trends
// ============================================================================

import express from 'express';
import { getCohortMetrics } from '../services/cohortService.js';
import { isValidGameweek } from '../config.js';
import { getLatestFinishedGameweek } from '../services/gameweekUtils.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * GET /api/history/gameweek/:gw
 * Returns cohort data for a specific historical gameweek
 * Computes on first request, then serves from S3 archive
 */
router.get('/api/history/gameweek/:gw', async (req, res) => {
  const gameweek = parseInt(req.params.gw, 10);

  // Validate gameweek parameter
  if (!isValidGameweek(gameweek)) {
    return res.status(400).json({
      error: 'Invalid gameweek',
      message: 'Gameweek must be between 1 and 38'
    });
  }

  try {
    const cohortData = await getCohortMetrics(gameweek);

    if (!cohortData) {
      return res.status(404).json({
        error: 'Data not available',
        message: `Cohort data for GW${gameweek} could not be computed`
      });
    }

    res.json({
      gameweek,
      cohorts: cohortData,
      source: 'archive'
    });
  } catch (err) {
    logger.error(`❌ Failed to load historical GW${gameweek}:`, err.message);
    res.status(500).json({
      error: 'Failed to load historical data',
      message: err.message
    });
  }
});

/**
 * GET /api/history/trend/cohorts
 * Returns cohort data for all finished gameweeks (for trend analysis)
 * Query params:
 *   - from: Starting gameweek (default: 1)
 *   - to: Ending gameweek (default: latest finished)
 */
router.get('/api/history/trend/cohorts', async (req, res) => {
  const latestFinished = getLatestFinishedGameweek();
  const fromGW = parseInt(req.query.from, 10) || 1;
  const toGW = parseInt(req.query.to, 10) || latestFinished;

  // Validate range
  if (!isValidGameweek(fromGW) || !isValidGameweek(toGW)) {
    return res.status(400).json({
      error: 'Invalid gameweek range',
      message: 'Both from and to must be between 1 and 38'
    });
  }

  if (fromGW > toGW) {
    return res.status(400).json({
      error: 'Invalid range',
      message: 'from must be less than or equal to to'
    });
  }

  try {
    const results = [];

    // Fetch cohort data for each gameweek in range
    for (let gw = fromGW; gw <= toGW; gw++) {
      try {
        const cohortData = await getCohortMetrics(gw);
        if (cohortData) {
          results.push({
            gameweek: gw,
            cohorts: cohortData
          });
        }
      } catch (gwErr) {
        logger.warn(`⚠️ Skipping GW${gw}: ${gwErr.message}`);
        // Continue to next GW instead of failing entire request
      }
    }

    res.json({
      season: '2024-25',
      from: fromGW,
      to: toGW,
      count: results.length,
      gameweeks: results
    });
  } catch (err) {
    logger.error(`❌ Failed to load cohort trends:`, err.message);
    res.status(500).json({
      error: 'Failed to load trend data',
      message: err.message
    });
  }
});

export default router;
