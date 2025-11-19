// ============================================================================
// FPL SERVICE
// Handles all FPL Official API data fetching
// ============================================================================

import axios from 'axios';
import { FPL_BASE_URL } from '../config.js';
import {
  cache,
  updateBootstrapCache,
  updateFixturesCache,
  recordFetch
} from './cacheManager.js';
import logger from '../logger.js';

// ============================================================================
// BOOTSTRAP DATA
// ============================================================================

/**
 * Fetch FPL Bootstrap (static game data)
 * @returns {Promise<Object>} Bootstrap data
 */
export async function fetchBootstrap() {
  logger.log('📡 Fetching FPL Bootstrap...');

  try {
    const response = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ Bootstrap fetched (${Math.round(JSON.stringify(response.data).length / 1024)}KB)`);

    updateBootstrapCache(response.data);
    recordFetch();

    return response.data;
  } catch (err) {
    logger.error('❌ Failed to fetch bootstrap:', err.message);

    // Return cached data if available, even if stale
    if (cache.bootstrap.data) {
      logger.log('⚠️ Using stale bootstrap cache as fallback');
      return cache.bootstrap.data;
    }

    throw new Error('Bootstrap data unavailable');
  }
}

// ============================================================================
// FIXTURES DATA
// ============================================================================

/**
 * Fetch FPL Fixtures data
 * @returns {Promise<Array>} Fixtures data
 */
export async function fetchFixtures() {
  logger.log('📡 Fetching FPL Fixtures...');

  try {
    const response = await axios.get(`${FPL_BASE_URL}/fixtures/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ Fixtures fetched (${Math.round(JSON.stringify(response.data).length / 1024)}KB)`);

    updateFixturesCache(response.data);
    recordFetch();

    return response.data;
  } catch (err) {
    logger.error('❌ Failed to fetch fixtures:', err.message);

    // Return cached data if available
    if (cache.fixtures.data) {
      logger.log('⚠️ Using stale fixtures cache as fallback');
      return cache.fixtures.data;
    }

    throw new Error('Fixtures data unavailable');
  }
}

// ============================================================================
// TEAM DATA
// ============================================================================

/**
 * Fetch team data by ID
 * @param {string|number} teamId - FPL team ID
 * @returns {Promise<Object>} Team data
 */
export async function fetchTeamData(teamId) {
  logger.log(`📡 Fetching team ${teamId}...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/entry/${teamId}/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ Team ${teamId} fetched`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Failed to fetch team ${teamId}:`, err.message);
    throw new Error(`Team data unavailable for team ${teamId}`);
  }
}

/**
 * Fetch team picks for a specific gameweek
 * @param {string|number} teamId - FPL team ID
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object>} Team picks data
 */
export async function fetchTeamPicks(teamId, gameweek) {
  logger.log(`📡 Fetching picks for team ${teamId}, GW${gameweek}...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/entry/${teamId}/event/${gameweek}/picks/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ Picks fetched for team ${teamId}, GW${gameweek}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Failed to fetch picks for team ${teamId}:`, err.message);
    throw new Error(`Picks unavailable for team ${teamId}, GW${gameweek}`);
  }
}

// ============================================================================
// LEAGUE DATA
// ============================================================================

/**
 * Fetch league standings
 * @param {string|number} leagueId - League ID
 * @param {number} page - Page number (default: 1)
 * @returns {Promise<Object>} League standings data
 */
export async function fetchLeagueStandings(leagueId, page = 1) {
  logger.log(`📡 Fetching league ${leagueId} standings (page ${page})...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/leagues-classic/${leagueId}/standings/`, {
      timeout: 10000,
      params: { page_standings: page },
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ League ${leagueId} standings fetched (${response.data.standings.results.length} entries)`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Failed to fetch league ${leagueId}:`, err.message);
    throw new Error(`League data unavailable for league ${leagueId}`);
  }
}
