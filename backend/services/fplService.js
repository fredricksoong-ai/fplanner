// ============================================================================
// FPL SERVICE
// Handles all FPL Official API data fetching
// ============================================================================

import axios from 'axios';
import axiosRetry from 'axios-retry';
import { FPL_BASE_URL } from '../config.js';
import {
  cache,
  updateBootstrapCache,
  updateFixturesCache,
  recordFetch,
  getCachedTeamData,
  updateTeamCache,
  getCachedTeamPicks,
  updateTeamPicksCache,
  recordCacheHit
} from './cacheManager.js';
import logger from '../logger.js';

// ============================================================================
// AXIOS RETRY CONFIGURATION
// ============================================================================

// Configure retry with exponential backoff
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => {
    const delay = axiosRetry.exponentialDelay(retryCount);
    logger.log(`⏳ Retry attempt ${retryCount}, waiting ${delay}ms...`);
    return delay;
  },
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           (error.response && error.response.status >= 500);
  },
  onRetry: (retryCount, error, requestConfig) => {
    logger.log(`🔄 Retrying request to ${requestConfig.url} (attempt ${retryCount})`);
  }
});

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
// LIVE GAMEWEEK DATA
// ============================================================================

/**
 * Fetch live gameweek data (real-time player stats during matches)
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object>} Live gameweek data with player stats
 */
export async function fetchLiveGameweekData(gameweek) {
  logger.log(`📡 Fetching live data for GW${gameweek}...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/event/${gameweek}/live/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ Live GW${gameweek} data fetched (${response.data.elements.length} players)`);
    recordFetch();

    return response.data;
  } catch (err) {
    logger.error(`❌ Failed to fetch live data for GW${gameweek}:`, err.message);
    throw new Error(`Live data unavailable for GW${gameweek}`);
  }
}

// ============================================================================
// TEAM DATA
// ============================================================================

/**
 * Fetch team data by ID (with caching)
 * @param {string|number} teamId - FPL team ID
 * @returns {Promise<Object>} Team data
 */
export async function fetchTeamData(teamId) {
  // Check cache first
  const cached = getCachedTeamData(teamId);
  if (cached) {
    logger.log(`✅ Team ${teamId} served from cache`);
    recordCacheHit();
    return cached;
  }

  logger.log(`📡 Fetching team ${teamId}...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/entry/${teamId}/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ Team ${teamId} fetched`);
    updateTeamCache(teamId, response.data);
    recordFetch();
    return response.data;
  } catch (err) {
    logger.error(`❌ Failed to fetch team ${teamId}:`, err.message);
    throw new Error(`Team data unavailable for team ${teamId}`);
  }
}

/**
 * Fetch team picks for a specific gameweek (with caching)
 * @param {string|number} teamId - FPL team ID
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object>} Team picks data
 */
export async function fetchTeamPicks(teamId, gameweek) {
  // Check cache first
  const cached = getCachedTeamPicks(teamId, gameweek);
  if (cached) {
    logger.log(`✅ Picks for team ${teamId}, GW${gameweek} served from cache`);
    recordCacheHit();
    return cached;
  }

  logger.log(`📡 Fetching picks for team ${teamId}, GW${gameweek}...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/entry/${teamId}/event/${gameweek}/picks/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ Picks fetched for team ${teamId}, GW${gameweek}`);
    updateTeamPicksCache(teamId, gameweek, response.data);
    recordFetch();
    return response.data;
  } catch (err) {
    logger.error(`❌ Failed to fetch picks for team ${teamId}:`, err.message);
    throw new Error(`Picks unavailable for team ${teamId}, GW${gameweek}`);
  }
}

// ============================================================================
// PLAYER ELEMENT SUMMARY
// ============================================================================

/**
 * Fetch player element summary (history and fixtures)
 * @param {string|number} playerId - Player element ID
 * @returns {Promise<Object>} Player summary with history and fixtures
 */
export async function fetchElementSummary(playerId) {
  logger.log(`📡 Fetching element summary for player ${playerId}...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/element-summary/${playerId}/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ Element summary fetched for player ${playerId}`);
    return response.data;
  } catch (err) {
    logger.error(`❌ Failed to fetch element summary for player ${playerId}:`, err.message);
    throw new Error(`Element summary unavailable for player ${playerId}`);
  }
}

// ============================================================================
// TRANSFER HISTORY
// ============================================================================

/**
 * Fetch transfer history for a team
 * @param {string|number} teamId - FPL team ID
 * @returns {Promise<Array>} Array of transfers
 */
export async function fetchTransferHistory(teamId) {
  logger.log(`📡 Fetching transfer history for team ${teamId}...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/entry/${teamId}/transfers/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    logger.log(`✅ Transfer history fetched for team ${teamId} (${response.data.length} transfers)`);
    recordFetch();
    return response.data;
  } catch (err) {
    logger.error(`❌ Failed to fetch transfer history for team ${teamId}:`, err.message);
    throw new Error(`Transfer history unavailable for team ${teamId}`);
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
