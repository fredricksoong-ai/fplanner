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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate total team points from live stats
 * Handles captain multiplier and automatic subs
 * @param {Array} picks - Team picks array with live_stats
 * @param {Array} automaticSubs - Automatic substitutions array
 * @returns {number} Total calculated points
 */
function calculateLiveTeamPoints(picks, automaticSubs = []) {
  if (!picks || picks.length === 0) {
    return 0;
  }

  // Create a map of automatic subs for quick lookup
  const subMap = new Map();
  automaticSubs.forEach(sub => {
    subMap.set(sub.element_in, sub.element_out);
  });

  let totalPoints = 0;
  const starting11 = picks.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);

  starting11.forEach(pick => {
    // Check if this player was subbed out
    const wasSubbedOut = Array.from(subMap.values()).includes(pick.element);
    if (wasSubbedOut) {
      // Player was subbed out, don't count their points
      return;
    }

    // Get points from live_stats
    const livePoints = pick.live_stats?.total_points ?? 0;

    // Apply captain multiplier
    if (pick.is_captain) {
      totalPoints += livePoints * 2;
    } else {
      totalPoints += livePoints;
    }
  });

  // Add points from players who were subbed in
  automaticSubs.forEach(sub => {
    const subbedInPick = picks.find(p => p.element === sub.element_in);
    if (subbedInPick && subbedInPick.live_stats) {
      const livePoints = subbedInPick.live_stats.total_points ?? 0;
      // Subs don't get captain multiplier (captain must be in starting 11)
      totalPoints += livePoints;
    }
  });

  return totalPoints;
}

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
    let calculatedLivePoints = null;

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

        // Calculate total team points from live stats
        calculatedLivePoints = calculateLiveTeamPoints(enrichedPicks.picks, enrichedPicks.automatic_subs);

        logger.log(`   ⚡ Enriched with live data (${liveData.elements.length} players)`);
        logger.log(`   📊 Calculated live points: ${calculatedLivePoints}`);
      } catch (err) {
        logger.warn(`⚠️ Failed to fetch live data: ${err.message}`);
        // Continue without live data
      }
    }

    // Update entry_history with calculated live points if available
    const entryHistory = enrichedPicks.entry_history ? { ...enrichedPicks.entry_history } : null;
    if (calculatedLivePoints !== null && entryHistory) {
      entryHistory.points = calculatedLivePoints;
      entryHistory.live_points = calculatedLivePoints; // Also store as separate field for clarity
    }

    const response = {
      team: teamInfo,
      picks: {
        ...enrichedPicks,
        entry_history: entryHistory || enrichedPicks.entry_history
      },
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

    // Check if it's a 503 (Service Unavailable) - FPL API might be updating
    const is503 = err.message.includes('503') || err.message.includes('Service Unavailable');
    const isProduction = process.env.NODE_ENV === 'production';
    
    // For 503 errors, provide a more helpful message
    if (is503) {
      res.status(503).json({
        error: 'FPL API temporarily unavailable',
        message: 'The official FPL API is currently updating. Please try again in a few minutes.',
        retryAfter: 60 // Suggest retrying after 60 seconds
      });
    } else {
      res.status(err.message.includes('unavailable') ? 404 : 500).json({
        error: 'Failed to fetch team data',
        message: isProduction ? 'Team not found or unavailable' : err.message
      });
    }
  }
});

export default router;
