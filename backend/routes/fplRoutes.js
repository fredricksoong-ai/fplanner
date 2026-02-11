// ============================================================================
// FPL ROUTES
// Handles FPL data endpoints (bootstrap, fixtures, GitHub CSV)
// ============================================================================

import express from 'express';
import {
  fetchBootstrap,
  fetchFixtures,
  fetchElementSummary,
  fetchLiveGameweekData,
  fetchTransferHistory
} from '../services/fplService.js';
import { fetchGithubCSV } from '../services/githubService.js';
import {
  cache,
  getCurrentEra,
  shouldRefreshBootstrap,
  shouldRefreshFixtures,
  shouldRefreshGithub,
  getCacheStats,
  getCachedLiveData,
  updateLiveCache,
  getLiveCacheAge
} from '../services/cacheManager.js';
import {
  getGameweekStatus,
  getCurrentGameweek,
  GW_STATUS
} from '../services/gameweekUtils.js';
import { GEMINI } from '../config.js';
import logger from '../logger.js';

const router = express.Router();

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /health
 * Health check endpoint for monitoring services
 */
router.get('/health', (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      gemini_api_configured: !!GEMINI.API_KEY && GEMINI.API_KEY !== 'your_gemini_api_key_here'
    });
  } catch (error) {
    // Fallback: return 200 even if JSON serialization fails
    res.status(200).send('OK');
  }
});

// ============================================================================
// FPL DATA ENDPOINT
// ============================================================================

/**
 * GET /api/fpl-data
 * Returns combined FPL data (bootstrap + fixtures + github)
 * Query params:
 *   - refresh=true: Force cache refresh
 */
router.get('/api/fpl-data', async (req, res) => {
  const startTime = Date.now();
  const forceRefresh = req.query.refresh === 'true';

  logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.log(`📥 GET /api/fpl-data ${forceRefresh ? '(FORCE REFRESH)' : ''}`);

  try {
    // Determine what needs fetching
    const needsBootstrap = forceRefresh || shouldRefreshBootstrap();
    const needsFixtures = forceRefresh || shouldRefreshFixtures();
    const needsGithub = forceRefresh || shouldRefreshGithub();

    // Track cache performance
    if (!needsBootstrap && !needsFixtures && !needsGithub) {
      logger.log('✨ Full cache hit - returning immediately');
    }

    // Fetch data in parallel
    const fetchPromises = [];

    if (needsBootstrap) {
      fetchPromises.push(fetchBootstrap());
    } else {
      logger.log('✅ Bootstrap cache valid, using cached data');
    }

    if (needsFixtures) {
      fetchPromises.push(fetchFixtures());
    } else {
      logger.log('✅ Fixtures cache valid, using cached data');
    }

    if (needsGithub) {
      fetchPromises.push(fetchGithubCSV());
    } else {
      logger.log('✅ GitHub cache valid, using cached data');
    }

    // Wait for all fetches
    if (fetchPromises.length > 0) {
      await Promise.all(fetchPromises);
    }

    // Prepare response
    const response = {
      bootstrap: cache.bootstrap.data,
      fixtures: cache.fixtures.data,
      github: cache.github.data,
      meta: {
        cached: fetchPromises.length === 0,
        bootstrap_age: cache.bootstrap.timestamp ? Date.now() - cache.bootstrap.timestamp : null,
        fixtures_age: cache.fixtures.timestamp ? Date.now() - cache.fixtures.timestamp : null,
        github_age: cache.github.timestamp ? Date.now() - cache.github.timestamp : null,
        github_era: cache.github.era,
        github_next_gw_status: cache.github.data?.nextGWStatus || cache.github.nextGWStatus || null,
        current_era: getCurrentEra(),
        timestamp: new Date().toISOString()
      }
    };

    const duration = Date.now() - startTime;
    const stats = getCacheStats();
    logger.log(`✅ Response ready (${duration}ms)`);
    logger.log(`   Cache hits: ${stats.cacheHits}, misses: ${stats.cacheMisses}`);
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json(response);
  } catch (err) {
    logger.error('❌ Error in /api/fpl-data:', err.message);

    // Don't expose detailed error messages in production
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'Failed to fetch FPL data',
      message: isProduction ? 'Data temporarily unavailable. Please try again later.' : err.message
    });
  }
});

// ============================================================================
// LIVE GAMEWEEK DATA ENDPOINT
// ============================================================================

/**
 * GET /api/live/:gameweek
 * Returns live player stats for a gameweek (real-time during matches)
 * Only useful when GW is LIVE - returns same data when COMPLETED
 */
router.get('/api/live/:gameweek', async (req, res) => {
  const { gameweek } = req.params;
  const gw = parseInt(gameweek);

  logger.log(`📥 GET /api/live/${gw}`);

  // Validate gameweek
  if (isNaN(gw) || gw < 1 || gw > 38) {
    return res.status(400).json({
      error: 'Invalid gameweek',
      message: 'Gameweek must be between 1 and 38'
    });
  }

  try {
    // Check cache first
    let liveData = getCachedLiveData(gw);
    let fromCache = !!liveData;

    if (!liveData) {
      liveData = await fetchLiveGameweekData(gw);
      updateLiveCache(gw, liveData);
      logger.log(`✅ Live data for GW${gw} fetched and cached`);
    } else {
      logger.log(`✅ Live data for GW${gw} served from cache (${getLiveCacheAge(gw)}s old)`);
    }

    const status = getGameweekStatus(gw);

    res.json({
      gameweek: gw,
      status: status,
      elements: liveData.elements,
      cached: fromCache,
      cacheAge: getLiveCacheAge(gw),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error(`❌ Error fetching live data for GW${gw}:`, err.message);
    res.status(500).json({
      error: 'Failed to fetch live data',
      message: err.message
    });
  }
});

// ============================================================================
// ENRICHED BOOTSTRAP ENDPOINT
// ============================================================================

/**
 * GET /api/bootstrap/enriched
 * Returns bootstrap data with live stats merged into elements during live GW
 * Includes provisional bonus calculation from BPS rankings
 */
router.get('/api/bootstrap/enriched', async (req, res) => {
  const startTime = Date.now();
  logger.log('📥 GET /api/bootstrap/enriched');

  try {
    // Ensure we have bootstrap data
    if (shouldRefreshBootstrap()) {
      await fetchBootstrap();
    }

    if (!cache.bootstrap.data) {
      return res.status(503).json({
        error: 'Bootstrap data not available',
        message: 'Please try again shortly'
      });
    }

    const bootstrapData = cache.bootstrap.data;

    // Get current GW status
    const currentGW = getCurrentGameweek();
    const gwStatus = getGameweekStatus(currentGW);

    // Start with original elements — only create new objects for enriched ones
    let elements = bootstrapData.elements;

    // Only enrich with live data if GW is live
    if (gwStatus === GW_STATUS.LIVE && currentGW) {
      // Get live data (from cache or fetch)
      let liveData = getCachedLiveData(currentGW);
      if (!liveData) {
        liveData = await fetchLiveGameweekData(currentGW);
        updateLiveCache(currentGW, liveData);
      }

      if (liveData && liveData.elements) {
        // Create lookup map for live stats
        const liveStats = new Map();
        liveData.elements.forEach(el => {
          liveStats.set(el.id, el.stats);
        });

        // Calculate provisional bonus from BPS rankings per fixture
        const provisionalBonus = calculateProvisionalBonus(liveData.elements, cache.fixtures.data);

        // Build new elements array, only spreading elements that have live stats
        elements = bootstrapData.elements.map(element => {
          const stats = liveStats.get(element.id);
          if (stats) {
            const bonus = provisionalBonus.get(element.id) || 0;
            return {
              ...element,
              live_stats: {
                ...stats,
                provisional_bonus: bonus
              }
            };
          }
          return element;
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.log(`✅ Enriched bootstrap ready (${duration}ms, GW${currentGW} ${gwStatus})`);

    // Build response referencing original data — avoids deep-cloning the entire bootstrap
    res.json({
      events: bootstrapData.events,
      game_settings: bootstrapData.game_settings,
      phases: bootstrapData.phases,
      teams: bootstrapData.teams,
      total_players: bootstrapData.total_players,
      elements,
      element_stats: bootstrapData.element_stats,
      element_types: bootstrapData.element_types,
      meta: {
        gameweek: currentGW,
        gwStatus: gwStatus,
        isLive: gwStatus === GW_STATUS.LIVE,
        liveDataAge: currentGW ? getLiveCacheAge(currentGW) : null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    logger.error('❌ Error in /api/bootstrap/enriched:', err.message);
    res.status(500).json({
      error: 'Failed to fetch enriched bootstrap',
      message: err.message
    });
  }
});

/**
 * Calculate provisional bonus points from BPS rankings per fixture
 * Top 3 BPS in each fixture get 3/2/1 bonus points
 * @param {Array} liveElements - Live data elements with stats
 * @param {Array} fixtures - Fixtures data
 * @returns {Map} Map of playerId -> provisional bonus
 */
function calculateProvisionalBonus(liveElements, fixtures) {
  const bonusMap = new Map();

  if (!fixtures || !liveElements) return bonusMap;

  // Group players by fixture (using their team and the current GW fixture)
  const fixturePlayerMap = new Map(); // fixtureId -> [{ id, bps }]

  // Find current/live fixtures
  const liveFixtures = fixtures.filter(f => f.started && !f.finished);
  const finishedFixtures = fixtures.filter(f => f.finished);
  const relevantFixtures = [...liveFixtures, ...finishedFixtures];

  // Build team to fixture mapping
  const teamToFixture = new Map();
  relevantFixtures.forEach(fixture => {
    teamToFixture.set(fixture.team_h, fixture.id);
    teamToFixture.set(fixture.team_a, fixture.id);
  });

  // Group players by fixture based on their team
  liveElements.forEach(el => {
    // We need to find the player's team from bootstrap
    const player = cache.bootstrap?.data?.elements?.find(p => p.id === el.id);
    if (!player) return;

    const fixtureId = teamToFixture.get(player.team);
    if (!fixtureId) return;

    if (!fixturePlayerMap.has(fixtureId)) {
      fixturePlayerMap.set(fixtureId, []);
    }
    fixturePlayerMap.get(fixtureId).push({
      id: el.id,
      bps: el.stats.bps || 0
    });
  });

  // Calculate bonus for each fixture
  fixturePlayerMap.forEach((players, fixtureId) => {
    // Sort by BPS descending
    players.sort((a, b) => b.bps - a.bps);

    // Assign bonus points (handle ties)
    let bonusPoints = 3;
    let lastBps = null;
    let sameRankCount = 0;

    for (let i = 0; i < players.length && bonusPoints > 0; i++) {
      const player = players[i];

      if (player.bps === lastBps) {
        // Same BPS as previous player - same bonus
        bonusMap.set(player.id, bonusMap.get(players[i - 1].id));
        sameRankCount++;
      } else {
        // Different BPS - assign current bonus level
        bonusMap.set(player.id, bonusPoints);
        lastBps = player.bps;

        // Reduce bonus points, accounting for ties
        bonusPoints -= (1 + sameRankCount);
        sameRankCount = 0;
      }
    }
  });

  return bonusMap;
}

// ============================================================================
// PLAYER ELEMENT SUMMARY ENDPOINT
// ============================================================================

/**
 * GET /api/player/:playerId/summary
 * Returns player history and upcoming fixtures
 */
router.get('/api/player/:playerId/summary', async (req, res) => {
  const { playerId } = req.params;

  logger.log(`📥 GET /api/player/${playerId}/summary`);

  // Validate player ID
  const id = parseInt(playerId);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      error: 'Invalid player ID',
      message: 'Player ID must be a positive integer'
    });
  }

  try {
    const summary = await fetchElementSummary(id);

    res.json({
      history: summary.history || [],
      fixtures: summary.fixtures || [],
      history_past: summary.history_past || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error(`❌ Error fetching player ${id} summary:`, err.message);
    res.status(500).json({
      error: 'Failed to fetch player summary',
      message: err.message
    });
  }
});

// ============================================================================
// TRANSFER HISTORY ENDPOINT
// ============================================================================

/**
 * GET /api/team/:teamId/transfers
 * Returns transfer history for a team
 */
router.get('/api/team/:teamId/transfers', async (req, res) => {
  const { teamId } = req.params;

  logger.log(`📥 GET /api/team/${teamId}/transfers`);

  // Validate team ID
  const id = parseInt(teamId);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      error: 'Invalid team ID',
      message: 'Team ID must be a positive integer'
    });
  }

  try {
    const transfers = await fetchTransferHistory(id);

    res.json({
      transfers: transfers || [],
      count: transfers?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error(`❌ Error fetching transfers for team ${id}:`, err.message);
    res.status(500).json({
      error: 'Failed to fetch transfer history',
      message: err.message
    });
  }
});

// ============================================================================
// CACHE STATS ENDPOINT
// ============================================================================

/**
 * GET /api/stats
 * Returns cache statistics and health info
 */
router.get('/api/stats', (req, res) => {
  const stats = getCacheStats();

  res.json({
    uptime: process.uptime(),
    cache: {
      bootstrap: {
        exists: !!cache.bootstrap.data,
        age_minutes: stats.bootstrapAge
      },
      fixtures: {
        exists: !!cache.fixtures.data,
        age_hours: Math.round(stats.fixturesAge / 60)
      },
      github: {
        exists: !!cache.github.data,
        era: cache.github.era,
        current_era: stats.currentEra,
        current_gw: cache.github.currentGW,
        season_stats: cache.github.data?.seasonStats?.length || 0,
        current_gw_stats: cache.github.data?.currentGWStats?.length || 0,
        next_gw_stats: cache.github.data?.nextGWStats?.length || 0
      }
    },
    stats: {
      totalFetches: cache.stats.totalFetches,
      cacheHits: cache.stats.cacheHits,
      cacheMisses: cache.stats.cacheMisses,
      hitRate: stats.hitRate
    },
    memory: {
      used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  });
});

export default router;
