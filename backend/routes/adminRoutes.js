// ============================================================================
// ADMIN ROUTES
// Administrative endpoints for backfilling data and maintenance
// ============================================================================

import express from 'express';
import logger from '../logger.js';

const router = express.Router();

/**
 * POST /api/admin/backfill
 * Backfill endpoint (deprecated - cohorts feature removed)
 */
router.post('/api/admin/backfill', (req, res) => {
  res.status(410).json({
    error: 'Feature removed',
    message: 'Cohort backfill feature has been removed. Historical data is now fetched directly from FPL API.'
  });
});

/**
 * GET /api/admin/backfill/status
 * Backfill status endpoint (deprecated)
 */
router.get('/api/admin/backfill/status', (req, res) => {
  res.status(410).json({
    error: 'Feature removed',
    message: 'Cohort backfill feature has been removed.'
  });
});

/**
 * POST /api/admin/aggregate-player-history
 * Player history aggregation endpoint (deprecated - MongoDB/S3 removed)
 */
router.post('/api/admin/aggregate-player-history', (req, res) => {
  res.status(410).json({
    error: 'Feature removed',
    message: 'Player history aggregation feature has been removed. Historical data is now fetched directly from FPL API.'
  });
});

/**
 * GET /api/admin/aggregate-player-history/status
 * Aggregation status endpoint (deprecated)
 */
router.get('/api/admin/aggregate-player-history/status', (req, res) => {
  res.status(410).json({
    error: 'Feature removed',
    message: 'Player history aggregation feature has been removed.'
  });
});

export default router;
