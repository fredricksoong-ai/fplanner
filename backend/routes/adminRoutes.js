// ============================================================================
// ADMIN ROUTES
// Administrative endpoints for backfilling data and maintenance
// ============================================================================

import express from 'express';
import { getCohortMetrics } from '../services/cohortService.js';
import { getLatestFinishedGameweek } from '../services/gameweekUtils.js';
import { isValidGameweek } from '../config.js';
import { aggregatePlayerHistory } from '../services/playerHistoryAggregator.js';
import logger from '../logger.js';

const router = express.Router();

// Track backfill status
let backfillStatus = {
  running: false,
  currentGW: null,
  fromGW: null,
  toGW: null,
  completed: [],
  failed: [],
  startedAt: null,
  completedAt: null
};

// Track aggregation status
let aggregationStatus = {
  running: false,
  fromGW: null,
  toGW: null,
  totalPlayers: 0,
  aggregated: 0,
  skipped: 0,
  startedAt: null,
  completedAt: null
};

/**
 * POST /api/admin/backfill
 * Backfill historical gameweek data to S3 archive
 * Query params:
 *   - from: Starting gameweek (default: 1)
 *   - to: Ending gameweek (default: latest finished)
 *   - force: Force recompute even if already cached (default: false)
 */
router.post('/api/admin/backfill', async (req, res) => {
  // Check if backfill is already running
  if (backfillStatus.running) {
    return res.status(409).json({
      error: 'Backfill already in progress',
      status: backfillStatus
    });
  }

  const latestFinished = getLatestFinishedGameweek();
  const fromGW = parseInt(req.query.from, 10) || 1;
  const toGW = parseInt(req.query.to, 10) || latestFinished;
  const force = req.query.force === 'true';

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

  // Initialize backfill status
  backfillStatus = {
    running: true,
    currentGW: null,
    fromGW,
    toGW,
    completed: [],
    failed: [],
    startedAt: new Date().toISOString(),
    completedAt: null
  };

  // Return immediately - backfill runs in background
  res.json({
    message: 'Backfill started',
    from: fromGW,
    to: toGW,
    total: toGW - fromGW + 1,
    force,
    estimatedTime: `${(toGW - fromGW + 1) * 60} seconds (~${Math.ceil((toGW - fromGW + 1) / 60)} minutes)`,
    checkStatus: '/api/admin/backfill/status'
  });

  // Run backfill in background
  runBackfill(fromGW, toGW, force);
});

/**
 * GET /api/admin/backfill/status
 * Get current backfill status
 */
router.get('/api/admin/backfill/status', (req, res) => {
  const totalGWs = backfillStatus.toGW - backfillStatus.fromGW + 1;
  const completedCount = backfillStatus.completed.length;
  const failedCount = backfillStatus.failed.length;
  const progress = totalGWs > 0 ? Math.round((completedCount / totalGWs) * 100) : 0;

  res.json({
    ...backfillStatus,
    progress: {
      total: totalGWs,
      completed: completedCount,
      failed: failedCount,
      remaining: totalGWs - completedCount - failedCount,
      percentage: progress
    }
  });
});

/**
 * Background backfill function
 */
async function runBackfill(fromGW, toGW, force) {
  logger.log(`🔄 Starting backfill for GW${fromGW} to GW${toGW}...`);

  for (let gw = fromGW; gw <= toGW; gw++) {
    backfillStatus.currentGW = gw;

    try {
      logger.log(`📦 Backfilling GW${gw}...`);

      // Force recompute if requested, otherwise use cache/archive
      await getCohortMetrics(gw, { force });

      backfillStatus.completed.push(gw);
      logger.log(`✅ GW${gw} backfilled successfully (${backfillStatus.completed.length}/${toGW - fromGW + 1})`);
    } catch (err) {
      logger.error(`❌ Failed to backfill GW${gw}:`, err.message);
      backfillStatus.failed.push({ gw, error: err.message });
    }
  }

  backfillStatus.running = false;
  backfillStatus.currentGW = null;
  backfillStatus.completedAt = new Date().toISOString();

  const duration = Math.round((new Date(backfillStatus.completedAt) - new Date(backfillStatus.startedAt)) / 1000);
  logger.log(`🎉 Backfill complete! Duration: ${duration}s, Completed: ${backfillStatus.completed.length}, Failed: ${backfillStatus.failed.length}`);

  // Auto-trigger player history aggregation after backfill completes
  if (backfillStatus.completed.length > 0) {
    logger.log(`🔄 Auto-triggering player history aggregation after backfill...`);
    runAggregation(fromGW, toGW, force);
  }
}

/**
 * POST /api/admin/aggregate-player-history
 * Manually trigger player history aggregation
 * Query params:
 *   - from: Starting gameweek (default: 1)
 *   - to: Ending gameweek (default: latest finished)
 *   - force: Force re-aggregation even if exists (default: false)
 */
router.post('/api/admin/aggregate-player-history', async (req, res) => {
  // Check if aggregation is already running
  if (aggregationStatus.running) {
    return res.status(409).json({
      error: 'Aggregation already in progress',
      status: aggregationStatus
    });
  }

  const latestFinished = getLatestFinishedGameweek();
  const fromGW = parseInt(req.query.from, 10) || 1;
  const toGW = parseInt(req.query.to, 10) || latestFinished;
  const force = req.query.force === 'true';

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

  // Return immediately - aggregation runs in background
  res.json({
    message: 'Player history aggregation started',
    from: fromGW,
    to: toGW,
    force,
    checkStatus: '/api/admin/aggregate-player-history/status'
  });

  // Run aggregation in background
  runAggregation(fromGW, toGW, force);
});

/**
 * GET /api/admin/aggregate-player-history/status
 * Get current aggregation status
 */
router.get('/api/admin/aggregate-player-history/status', (req, res) => {
  res.json(aggregationStatus);
});

/**
 * Background aggregation function
 */
async function runAggregation(fromGW, toGW, force) {
  aggregationStatus = {
    running: true,
    fromGW,
    toGW,
    totalPlayers: 0,
    aggregated: 0,
    skipped: 0,
    startedAt: new Date().toISOString(),
    completedAt: null
  };

  try {
    const result = await aggregatePlayerHistory({ fromGW, toGW, force });
    
    aggregationStatus.totalPlayers = result.totalPlayers;
    aggregationStatus.aggregated = result.aggregated;
    aggregationStatus.skipped = result.skipped;
    aggregationStatus.completedAt = result.completedAt;
  } catch (err) {
    logger.error(`❌ Player history aggregation failed:`, err.message);
  } finally {
    aggregationStatus.running = false;
  }
}

export default router;
