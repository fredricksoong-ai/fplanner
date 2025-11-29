// ============================================================================
// HISTORY ROUTES
// Provides access to historical gameweek data and trends
// ============================================================================

import express from 'express';
import { getCohortMetrics, computeCohortMetrics } from '../services/cohortService.js';
import { isValidGameweek } from '../config.js';
import { getLatestFinishedGameweek } from '../services/gameweekUtils.js';
import s3Storage from '../services/s3Storage.js';
import { fetchElementSummary } from '../services/fplService.js';
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
 * Uses pre-aggregated data if available, otherwise falls back to on-demand computation
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
    // Try to load from aggregated data first (much more efficient)
    const aggregatedData = await s3Storage.loadAggregatedPlayerHistory(playerId);
    if (aggregatedData && aggregatedData.gameweeks && aggregatedData.gameweeks.length > 0) {
      logger.log(`✅ Using aggregated data for player ${playerId}`);
      return res.json({
        playerId,
        gameweeks: aggregatedData.gameweeks,
        source: 'aggregated'
      });
    }

    // Fallback to on-demand computation if aggregated data not available
    logger.log(`⚠️ Aggregated data not found for player ${playerId}, computing on-demand...`);
    const latestFinished = getLatestFinishedGameweek();
    
    // Fetch player history for correct historical price and points data
    let playerHistory = [];
    try {
      const playerSummary = await fetchElementSummary(playerId);
      playerHistory = playerSummary.history || [];
    } catch (historyErr) {
      logger.warn(`⚠️ Failed to fetch player history for ${playerId}: ${historyErr.message}`);
      // Continue without history data - will use S3 data only
    }

    // Create a map of history data by gameweek for quick lookup
    const historyMap = new Map();
    playerHistory.forEach(h => {
      if (h.round) {
        historyMap.set(h.round, h);
      }
    });

    // Calculate form for each gameweek (rolling average of last 3-5 GW points)
    // Also calculate cumulative total_points
    const formMap = new Map();
    const cumulativePointsMap = new Map();
    const pointsArray = playerHistory
      .filter(h => h.round && h.total_points !== null && h.total_points !== undefined)
      .sort((a, b) => a.round - b.round)
      .map(h => ({ round: h.round, points: h.total_points }));

    let cumulativeTotal = 0;
    pointsArray.forEach((item, index) => {
      // Calculate cumulative total points
      cumulativeTotal += item.points;
      cumulativePointsMap.set(item.round, cumulativeTotal);

      // Calculate form as average of last 3-5 gameweeks (or available data)
      const lookback = Math.min(5, index + 1); // Use up to 5 GWs, or all available if fewer
      const startIndex = Math.max(0, index - lookback + 1);
      const recentPoints = pointsArray.slice(startIndex, index + 1).map(p => p.points);
      const avgPoints = recentPoints.reduce((sum, p) => sum + p, 0) / recentPoints.length;
      formMap.set(item.round, parseFloat(avgPoints.toFixed(1)));
    });

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

          // Use player history for price (correct historical data)
          const historyEntry = historyMap.get(gw);
          if (historyEntry) {
            // Price from history (value is in tenths, keep as tenths for consistency)
            if (historyEntry.value !== null && historyEntry.value !== undefined) {
              gwOwnership.price = historyEntry.value;
            }
            // Points for this gameweek (for charts)
            if (historyEntry.total_points !== null && historyEntry.total_points !== undefined) {
              gwOwnership.gw_points = historyEntry.total_points;
            }
            // Cumulative total points (for reference/display)
            const cumulativePoints = cumulativePointsMap.get(gw);
            if (cumulativePoints !== undefined) {
              gwOwnership.total_points = cumulativePoints;
            }
          }

          // Calculate form from points history
          const calculatedForm = formMap.get(gw);
          if (calculatedForm !== undefined) {
            gwOwnership.form = calculatedForm.toString();
          }

          // Use bootstrap for overall_ownership (current ownership % - this is fine as a reference)
          if (bootstrapData && bootstrapData.elements) {
            const playerData = bootstrapData.elements.find(p => p.id === playerId);
            if (playerData && playerData.selected_by_percent) {
              gwOwnership.overall_ownership = playerData.selected_by_percent;
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
      gameweeks: ownership,
      source: 'computed'
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
