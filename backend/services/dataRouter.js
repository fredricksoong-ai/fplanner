// ============================================================================
// DATA ROUTER SERVICE
// Routes data requests to appropriate source based on gameweek status
// ============================================================================

import { fetchLiveGameweekData, fetchBootstrap } from './fplService.js';
import { fetchGithubCSV } from './githubService.js';
import { cache } from './cacheManager.js';
import {
  GW_STATUS,
  getGameweekStatus,
  getCurrentGameweek,
  getLatestFinishedGameweek,
  isGameweekLive
} from './gameweekUtils.js';
import logger from '../logger.js';

// ============================================================================
// DATA SOURCE ENUM
// ============================================================================

export const DATA_SOURCE = {
  FPL_LIVE: 'FPL_LIVE',
  FPL_BOOTSTRAP: 'FPL_BOOTSTRAP',
  GITHUB: 'GITHUB'
};

// ============================================================================
// ROUTING LOGIC
// ============================================================================

/**
 * Determine which data source to use for a gameweek
 * @param {number} gameweek - Gameweek number
 * @returns {string} DATA_SOURCE value
 */
export function getDataSourceForGameweek(gameweek) {
  const status = getGameweekStatus(gameweek);

  switch (status) {
    case GW_STATUS.LIVE:
      return DATA_SOURCE.FPL_LIVE;
    case GW_STATUS.COMPLETED:
      return DATA_SOURCE.GITHUB;
    case GW_STATUS.UPCOMING:
      return DATA_SOURCE.FPL_BOOTSTRAP;
    default:
      return DATA_SOURCE.FPL_BOOTSTRAP;
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Get player stats for a specific gameweek from the appropriate source
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object>} Player stats data with source metadata
 */
export async function getPlayerStatsForGameweek(gameweek) {
  const source = getDataSourceForGameweek(gameweek);

  logger.log(`📊 Routing GW${gameweek} data request to ${source}`);

  try {
    switch (source) {
      case DATA_SOURCE.FPL_LIVE: {
        const liveData = await fetchLiveGameweekData(gameweek);
        return {
          source,
          gameweek,
          data: liveData,
          timestamp: Date.now()
        };
      }

      case DATA_SOURCE.GITHUB: {
        // Ensure GitHub data is loaded
        if (!cache.github?.data) {
          await fetchGithubCSV();
        }

        return {
          source,
          gameweek,
          data: cache.github.data,
          timestamp: cache.github.timestamp
        };
      }

      case DATA_SOURCE.FPL_BOOTSTRAP:
      default: {
        // Ensure bootstrap is loaded
        if (!cache.bootstrap?.data) {
          await fetchBootstrap();
        }

        return {
          source,
          gameweek,
          data: {
            elements: cache.bootstrap.data.elements,
            teams: cache.bootstrap.data.teams
          },
          timestamp: cache.bootstrap.timestamp
        };
      }
    }
  } catch (err) {
    logger.error(`❌ Failed to get data for GW${gameweek} from ${source}:`, err.message);
    throw err;
  }
}

/**
 * Get live player points (only during live GW)
 * Returns null if GW is not live
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object|null>} Live points data or null
 */
export async function getLivePointsIfAvailable(gameweek) {
  if (!isGameweekLive(gameweek)) {
    return null;
  }

  try {
    const liveData = await fetchLiveGameweekData(gameweek);
    return {
      gameweek,
      elements: liveData.elements,
      timestamp: Date.now()
    };
  } catch (err) {
    logger.error(`❌ Failed to fetch live points for GW${gameweek}:`, err.message);
    return null;
  }
}

/**
 * Enrich team picks with live data if gameweek is live
 * @param {Object} picks - Team picks from FPL API
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object>} Picks enriched with live data if available
 */
export async function enrichPicksWithLiveData(picks, gameweek) {
  if (!isGameweekLive(gameweek)) {
    return {
      ...picks,
      liveData: null,
      isLive: false
    };
  }

  try {
    const liveData = await fetchLiveGameweekData(gameweek);

    // Create lookup map for live stats
    const liveStatsMap = new Map();
    for (const element of liveData.elements) {
      liveStatsMap.set(element.id, element.stats);
    }

    // Enrich each pick with live stats
    const enrichedPicks = picks.picks.map(pick => {
      const liveStats = liveStatsMap.get(pick.element);
      return {
        ...pick,
        live_stats: liveStats || null
      };
    });

    return {
      ...picks,
      picks: enrichedPicks,
      liveData: {
        timestamp: Date.now(),
        elementCount: liveData.elements.length
      },
      isLive: true
    };
  } catch (err) {
    logger.error(`❌ Failed to enrich picks with live data:`, err.message);
    return {
      ...picks,
      liveData: null,
      isLive: false,
      liveError: err.message
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Log current data routing configuration
 */
export function logDataRoutingStatus() {
  const current = getCurrentGameweek();
  const finished = getLatestFinishedGameweek();

  if (!current) {
    logger.log('⚠️ Data routing: Bootstrap data not loaded');
    return;
  }

  logger.log('🔀 Data Routing Configuration:');
  logger.log(`   GW${finished} (Finished) → ${getDataSourceForGameweek(finished)}`);
  logger.log(`   GW${current} (Current) → ${getDataSourceForGameweek(current)}`);

  if (current < 38) {
    logger.log(`   GW${current + 1} (Upcoming) → ${getDataSourceForGameweek(current + 1)}`);
  }
}
