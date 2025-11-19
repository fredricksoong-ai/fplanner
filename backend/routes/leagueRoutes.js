// ============================================================================
// LEAGUE ROUTES
// Handles league standings endpoints
// ============================================================================

import express from 'express';
import { fetchLeagueStandings } from '../services/fplService.js';
import { isValidLeagueId } from '../config.js';
import logger from '../logger.js';

const router = express.Router();

// ============================================================================
// LEAGUE STANDINGS ENDPOINT
// ============================================================================

/**
 * GET /api/leagues/:leagueId
 * Returns league standings
 * Query params:
 *   - page: Page number (default: 1)
 */
router.get('/api/leagues/:leagueId', async (req, res) => {
  const { leagueId } = req.params;
  const page = parseInt(req.query.page) || 1;

  logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.log(`📥 GET /api/leagues/${leagueId} (page ${page})`);

  // Validate league ID
  if (!isValidLeagueId(leagueId)) {
    logger.warn(`⚠️ Invalid league ID format: ${leagueId}`);
    return res.status(400).json({
      error: 'Invalid league ID',
      message: 'League ID must be a number between 1 and 10 digits'
    });
  }

  // Validate page number
  if (page < 1 || page > 100) {
    logger.warn(`⚠️ Invalid page number: ${page}`);
    return res.status(400).json({
      error: 'Invalid page number',
      message: 'Page must be between 1 and 100'
    });
  }

  try {
    const leagueData = await fetchLeagueStandings(leagueId, page);

    const response = {
      league: leagueData.league,
      standings: leagueData.standings,
      new_entries: leagueData.new_entries,
      timestamp: new Date().toISOString()
    };

    logger.log(`✅ League data ready`);
    logger.log(`   League: ${leagueData.league.name}`);
    logger.log(`   Entries: ${leagueData.standings.results.length}`);
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json(response);
  } catch (err) {
    logger.error(`❌ Error fetching league ${leagueId}:`, err.message);

    // Don't expose detailed error messages in production
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(err.message.includes('unavailable') ? 404 : 500).json({
      error: 'Failed to fetch league data',
      message: isProduction ? 'League not found or unavailable' : err.message
    });
  }
});

export default router;
