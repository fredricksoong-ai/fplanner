// ============================================================================
// GAMEWEEK UTILITIES
// Centralized gameweek status detection and helpers
// ============================================================================

import { cache } from './cacheManager.js';
import logger from '../logger.js';

// ============================================================================
// GAMEWEEK STATUS ENUM
// ============================================================================

export const GW_STATUS = {
  COMPLETED: 'COMPLETED',
  LIVE: 'LIVE',
  UPCOMING: 'UPCOMING',
  UNKNOWN: 'UNKNOWN'
};

// ============================================================================
// STATUS DETECTION
// ============================================================================

/**
 * Get the status of a specific gameweek
 * @param {number} gameweek - Gameweek number to check
 * @returns {string} GW_STATUS value
 */
export function getGameweekStatus(gameweek) {
  if (!cache.bootstrap?.data?.events) {
    logger.error('❌ Cannot determine GW status: bootstrap data not loaded');
    return GW_STATUS.UNKNOWN;
  }

  const event = cache.bootstrap.data.events.find(e => e.id === gameweek);
  if (!event) {
    logger.error(`❌ Gameweek ${gameweek} not found in bootstrap data`);
    return GW_STATUS.UNKNOWN;
  }

  // If finished flag is set, it's completed
  if (event.finished) {
    return GW_STATUS.COMPLETED;
  }

  const now = new Date();
  const deadline = new Date(event.deadline_time);

  // If deadline has passed but not finished, it's live
  if (deadline <= now && !event.finished) {
    return GW_STATUS.LIVE;
  }

  // If deadline is in the future, it's upcoming
  if (deadline > now) {
    return GW_STATUS.UPCOMING;
  }

  return GW_STATUS.UNKNOWN;
}

/**
 * Check if a gameweek is currently live
 * @param {number} gameweek - Gameweek number to check
 * @returns {boolean} True if gameweek is live
 */
export function isGameweekLive(gameweek) {
  return getGameweekStatus(gameweek) === GW_STATUS.LIVE;
}

/**
 * Check if a gameweek is completed
 * @param {number} gameweek - Gameweek number to check
 * @returns {boolean} True if gameweek is completed
 */
export function isGameweekCompleted(gameweek) {
  return getGameweekStatus(gameweek) === GW_STATUS.COMPLETED;
}

// ============================================================================
// GAMEWEEK QUERIES
// ============================================================================

/**
 * Get the current gameweek number (marked as is_current by FPL)
 * @returns {number|null} Current gameweek number or null if not found
 */
export function getCurrentGameweek() {
  if (!cache.bootstrap?.data?.events) {
    logger.error('❌ Cannot get current GW: bootstrap data not loaded');
    return null;
  }

  const currentEvent = cache.bootstrap.data.events.find(e => e.is_current);
  if (currentEvent) {
    return currentEvent.id;
  }

  // Fallback to next event if between gameweeks
  const nextEvent = cache.bootstrap.data.events.find(e => e.is_next);
  if (nextEvent) {
    return nextEvent.id;
  }

  return null;
}

/**
 * Get the latest finished gameweek number
 * @returns {number} Latest finished gameweek number (defaults to 1)
 */
export function getLatestFinishedGameweek() {
  if (!cache.bootstrap?.data?.events) {
    logger.error('❌ Cannot get finished GW: bootstrap data not loaded');
    return 1;
  }

  const finishedEvents = cache.bootstrap.data.events.filter(e => e.finished);
  if (finishedEvents.length === 0) {
    return 1;
  }

  return Math.max(...finishedEvents.map(e => e.id));
}

/**
 * Get the next upcoming gameweek number
 * @returns {number|null} Next gameweek number or null if season ended
 */
export function getNextGameweek() {
  if (!cache.bootstrap?.data?.events) {
    logger.error('❌ Cannot get next GW: bootstrap data not loaded');
    return null;
  }

  const nextEvent = cache.bootstrap.data.events.find(e => e.is_next);
  return nextEvent ? nextEvent.id : null;
}

/**
 * Get gameweek event data
 * @param {number} gameweek - Gameweek number
 * @returns {Object|null} Event object or null if not found
 */
export function getGameweekEvent(gameweek) {
  if (!cache.bootstrap?.data?.events) {
    return null;
  }

  return cache.bootstrap.data.events.find(e => e.id === gameweek) || null;
}

/**
 * Get time until gameweek deadline
 * @param {number} gameweek - Gameweek number
 * @returns {number|null} Milliseconds until deadline, negative if passed, null if not found
 */
export function getTimeUntilDeadline(gameweek) {
  const event = getGameweekEvent(gameweek);
  if (!event) {
    return null;
  }

  const deadline = new Date(event.deadline_time);
  return deadline.getTime() - Date.now();
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

/**
 * Log current gameweek status summary
 */
export function logGameweekStatus() {
  const current = getCurrentGameweek();
  const finished = getLatestFinishedGameweek();
  const next = getNextGameweek();

  if (!current) {
    logger.log('⚠️ Gameweek status: Bootstrap data not loaded');
    return;
  }

  const currentStatus = getGameweekStatus(current);

  logger.log('📅 Gameweek Status:');
  logger.log(`   Current GW: ${current} (${currentStatus})`);
  logger.log(`   Latest Finished: GW${finished}`);
  if (next) {
    const timeUntil = getTimeUntilDeadline(next);
    if (timeUntil && timeUntil > 0) {
      const hours = Math.floor(timeUntil / (1000 * 60 * 60));
      const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
      logger.log(`   Next GW: ${next} (deadline in ${hours}h ${minutes}m)`);
    } else {
      logger.log(`   Next GW: ${next}`);
    }
  }
}
