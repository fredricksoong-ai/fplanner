// ============================================================================
// HISTORY ROUTES
// Provides access to historical gameweek data and trends
// ============================================================================

import express from 'express';
import { getCohortMetrics } from '../services/cohortService.js';
import { isValidGameweek } from '../config.js';
import { getLatestFinishedGameweek } from '../services/gameweekUtils.js';
import s3Storage from '../services/s3Storage.js';
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

/**
 * GET /api/history/gameweek/:gw/picks
 * Returns aggregated pick data for a specific gameweek
 * Shows player ownership, captain picks, formations, etc.
 */
router.get('/api/history/gameweek/:gw/picks', async (req, res) => {
  const gameweek = parseInt(req.params.gw, 10);

  if (!isValidGameweek(gameweek)) {
    return res.status(400).json({
      error: 'Invalid gameweek',
      message: 'Gameweek must be between 1 and 38'
    });
  }

  try {
    const picksData = await s3Storage.loadGameweekFromS3(gameweek, 'picks');

    if (!picksData) {
      return res.status(404).json({
        error: 'Data not available',
        message: `Pick data for GW${gameweek} not found in archive`
      });
    }

    res.json(picksData);
  } catch (err) {
    logger.error(`❌ Failed to load picks for GW${gameweek}:`, err.message);
    res.status(500).json({
      error: 'Failed to load pick data',
      message: err.message
    });
  }
});

/**
 * GET /api/history/player/:playerId/ownership
 * Returns ownership trend for a specific player across all archived gameweeks
 */
router.get('/api/history/player/:playerId/ownership', async (req, res) => {
  const playerId = parseInt(req.params.playerId, 10);

  if (isNaN(playerId) || playerId < 1) {
    return res.status(400).json({
      error: 'Invalid player ID',
      message: 'Player ID must be a positive number'
    });
  }

  try {
    const latestFinished = getLatestFinishedGameweek();
    const ownership = [];

    // Fetch ownership data from all archived gameweeks
    for (let gw = 1; gw <= latestFinished; gw++) {
      try {
        const picksData = await s3Storage.loadGameweekFromS3(gw, 'picks');
        const bootstrapData = await s3Storage.loadGameweekFromS3(gw, 'bootstrap');

        if (picksData && picksData.buckets) {
          const gwOwnership = { gameweek: gw };

          // Extract ownership from each cohort
          for (const [cohortKey, cohortData] of Object.entries(picksData.buckets)) {
            const player = cohortData.players?.find(p => p.element === playerId);
            if (player) {
              gwOwnership[cohortKey] = {
                ownership: player.ownership,
                ownershipPercent: (player.ownership / cohortData.sampleSize * 100).toFixed(1),
                captainCount: player.captainCount,
                captainPercent: (player.captainCount / cohortData.sampleSize * 100).toFixed(1)
              };
            }
          }

          // Add bootstrap data if available
          if (bootstrapData && bootstrapData.elements) {
            const playerData = bootstrapData.elements.find(p => p.id === playerId);
            if (playerData) {
              gwOwnership.price = playerData.now_cost;
              gwOwnership.overall_ownership = playerData.selected_by_percent;
              gwOwnership.form = playerData.form;
              gwOwnership.total_points = playerData.total_points;
            }
          }

          ownership.push(gwOwnership);
        }
      } catch (gwErr) {
        // Skip this gameweek if data not available
        continue;
      }
    }

    if (ownership.length === 0) {
      return res.status(404).json({
        error: 'No data available',
        message: `No ownership data found for player ${playerId}`
      });
    }

    res.json({
      playerId,
      gameweeks: ownership
    });
  } catch (err) {
    logger.error(`❌ Failed to load player ownership:`, err.message);
    res.status(500).json({
      error: 'Failed to load ownership data',
      message: err.message
    });
  }
});

/**
 * GET /api/history/gameweek/:gw/captains
 * Returns captain picks distribution for a specific gameweek
 */
router.get('/api/history/gameweek/:gw/captains', async (req, res) => {
  const gameweek = parseInt(req.params.gw, 10);

  if (!isValidGameweek(gameweek)) {
    return res.status(400).json({
      error: 'Invalid gameweek',
      message: 'Gameweek must be between 1 and 38'
    });
  }

  try {
    const picksData = await s3Storage.loadGameweekFromS3(gameweek, 'picks');

    if (!picksData || !picksData.buckets) {
      return res.status(404).json({
        error: 'Data not available',
        message: `Pick data for GW${gameweek} not found`
      });
    }

    const captainData = {};

    // Extract captain data from each cohort
    for (const [cohortKey, cohortData] of Object.entries(picksData.buckets)) {
      const captains = cohortData.players
        .filter(p => p.captainCount > 0)
        .sort((a, b) => b.captainCount - a.captainCount)
        .slice(0, 10) // Top 10 captains
        .map(p => ({
          element: p.element,
          captainCount: p.captainCount,
          captainPercent: (p.captainCount / cohortData.sampleSize * 100).toFixed(1),
          ownership: p.ownership,
          ownershipPercent: (p.ownership / cohortData.sampleSize * 100).toFixed(1)
        }));

      captainData[cohortKey] = {
        sampleSize: cohortData.sampleSize,
        captains
      };
    }

    res.json({
      gameweek,
      captainData
    });
  } catch (err) {
    logger.error(`❌ Failed to load captain data:`, err.message);
    res.status(500).json({
      error: 'Failed to load captain data',
      message: err.message
    });
  }
});

export default router;
