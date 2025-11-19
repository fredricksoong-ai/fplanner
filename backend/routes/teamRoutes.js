// ============================================================================
// TEAM ROUTES
// Handles user team data endpoints
// ============================================================================

import express from 'express';
import {
  fetchBootstrap,
  fetchTeamData,
  fetchTeamPicks
} from '../services/fplService.js';
import {
  cache,
  shouldRefreshBootstrap
} from '../services/cacheManager.js';
import { isValidTeamId } from '../config.js';
import logger from '../logger.js';

const router = express.Router();

// ============================================================================
// TEAM DATA ENDPOINT
// ============================================================================

/**
 * GET /api/team/:teamId
 * Returns user's team data for current gameweek
 */
router.get('/api/team/:teamId', async (req, res) => {
  const { teamId } = req.params;

  logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.log(`📥 GET /api/team/${teamId}`);

  // Validate team ID
  if (!isValidTeamId(teamId)) {
    logger.warn(`⚠️ Invalid team ID format: ${teamId}`);
    return res.status(400).json({
      error: 'Invalid team ID',
      message: 'Team ID must be a number between 1 and 10 digits'
    });
  }

  try {
    // Ensure we have bootstrap data to get current GW
    if (!cache.bootstrap.data || shouldRefreshBootstrap()) {
      await fetchBootstrap();
    }

    // Find current gameweek
    const currentEvent = cache.bootstrap.data.events.find(e => e.is_current);
    const currentGW = currentEvent ? currentEvent.id : 1;

    logger.log(`   Current GW: ${currentGW}`);

    // Fetch team info and picks in parallel
    const [teamInfo, teamPicks] = await Promise.all([
      fetchTeamData(teamId),
      fetchTeamPicks(teamId, currentGW)
    ]);

    const response = {
      team: teamInfo,
      picks: teamPicks,
      gameweek: currentGW,
      timestamp: new Date().toISOString()
    };

    logger.log(`✅ Team data ready`);
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json(response);
  } catch (err) {
    logger.error(`❌ Error fetching team ${teamId}:`, err.message);

    // Don't expose detailed error messages in production
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(err.message.includes('unavailable') ? 404 : 500).json({
      error: 'Failed to fetch team data',
      message: isProduction ? 'Team not found or unavailable' : err.message
    });
  }
});

export default router;
