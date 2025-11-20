// ============================================================================
// FPL ROUTES
// Handles FPL data endpoints (bootstrap, fixtures, GitHub CSV)
// ============================================================================

import express from 'express';
import {
  fetchBootstrap,
  fetchFixtures,
  fetchElementSummary
} from '../services/fplService.js';
import { fetchGithubCSV } from '../services/githubService.js';
import {
  cache,
  getCurrentEra,
  shouldRefreshBootstrap,
  shouldRefreshFixtures,
  shouldRefreshGithub,
  getCacheStats
} from '../services/cacheManager.js';
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
