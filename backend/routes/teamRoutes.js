// ============================================================================
// TEAM ROUTES
// Handles user team data endpoints
// ============================================================================

import express from 'express';
import {
  fetchBootstrap,
  fetchTeamData,
  fetchTeamPicks,
  fetchLiveGameweekData
} from '../services/fplService.js';
import {
  cache,
  shouldRefreshBootstrap
} from '../services/cacheManager.js';
import {
  getGameweekStatus,
  GW_STATUS
} from '../services/gameweekUtils.js';
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

    // Check if GW is live and enrich with live data
    const gwStatus = getGameweekStatus(currentGW);
    let liveData = null;
    let enrichedPicks = teamPicks;

    if (gwStatus === GW_STATUS.LIVE) {
      try {
        liveData = await fetchLiveGameweekData(currentGW);

        // Create lookup map for live stats
        const liveStatsMap = new Map();
        for (const element of liveData.elements) {
          liveStatsMap.set(element.id, element.stats);
        }

        // Enrich each pick with live stats
        enrichedPicks = {
          ...teamPicks,
          picks: teamPicks.picks.map(pick => ({
            ...pick,
            live_stats: liveStatsMap.get(pick.element) || null
          }))
        };

        logger.log(`   ⚡ Enriched with live data (${liveData.elements.length} players)`);
      } catch (err) {
        logger.warn(`⚠️ Failed to fetch live data: ${err.message}`);
        // Continue without live data
      }
    }

    const response = {
      team: teamInfo,
      picks: enrichedPicks,
      gameweek: currentGW,
      gwStatus: gwStatus,
      isLive: gwStatus === GW_STATUS.LIVE,
      liveTimestamp: liveData ? new Date().toISOString() : null,
      timestamp: new Date().toISOString()
    };

    logger.log(`✅ Team data ready (GW ${gwStatus})`);
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
