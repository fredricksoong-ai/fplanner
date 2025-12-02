// ============================================================================
// CACHE MANAGER SERVICE
// Manages in-memory cache with smart refresh logic and disk persistence
// ============================================================================

import fs from 'fs';
import { SERVER, TTL, S3, MONGO } from '../config.js';
import logger from '../logger.js';
import mongoStorage from './mongoStorage.js';

// ============================================================================
// CACHE STATE
// ============================================================================

export let cache = {
  bootstrap: {
    data: null,
    timestamp: null
  },
  fixtures: {
    data: null,
    timestamp: null
  },
  github: {
    data: null,
    timestamp: null,
    era: null  // 'morning' or 'evening'
  },
  live: {
    // Map of gameweek -> { data, timestamp }
    entries: new Map()
  },
  teams: {
    // Map of teamId -> { data, timestamp }
    entries: new Map(),
    // Map of `${teamId}-${gw}` -> { data, timestamp }
    picks: new Map()
  },
  stats: {
    totalFetches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastFetch: null
  },
  cohorts: {
    // Map of `${gameweek}` -> { data, timestamp }
    entries: new Map()
  }
};

// TTL for live data during active gameweek
export const LIVE_CACHE_TTL = 2 * 60 * 1000;  // 2 minutes

// TTL for team data - dynamic based on GW status
export const TEAM_CACHE_TTL_LIVE = 2 * 60 * 1000;      // 2 minutes during live GW
export const TEAM_CACHE_TTL_FINISHED = 12 * 60 * 60 * 1000;  // 12 hours when GW finished

/**
 * Get appropriate team cache TTL based on current GW status
 * @returns {number} TTL in milliseconds
 */
export function getTeamCacheTTL() {
  if (!cache.bootstrap?.data?.events) {
    return TEAM_CACHE_TTL_LIVE; // Default to short TTL if we can't determine
  }

  const currentEvent = cache.bootstrap.data.events.find(e => e.is_current);

  // If no current event or it's finished, use long TTL
  if (!currentEvent || currentEvent.finished) {
    return TEAM_CACHE_TTL_FINISHED;
  }

  // GW in progress - use short TTL
  return TEAM_CACHE_TTL_LIVE;
}

/**
 * Get appropriate fixtures cache TTL based on current GW status
 * During live GW, fixtures need frequent updates to catch when matches finish
 * @returns {number} TTL in milliseconds
 */
export function getFixturesCacheTTL() {
  if (!cache.bootstrap?.data?.events) {
    return TTL.FIXTURES_LIVE; // Default to short TTL if we can't determine
  }

  const currentEvent = cache.bootstrap.data.events.find(e => e.is_current);

  // If no current event or it's finished, use long TTL (fixtures rarely change)
  if (!currentEvent || currentEvent.finished) {
    return TTL.FIXTURES_FINISHED;
  }

  // GW in progress - use short TTL to catch match status changes (started/finished flags)
  return TTL.FIXTURES_LIVE;
}

// ============================================================================
// ERA MANAGEMENT
// ============================================================================

/**
 * Get current data era based on UTC time
 * Morning: 5am-5pm UTC | Evening: 5pm-5am UTC
 * @returns {string} 'morning' or 'evening'
 */
export function getCurrentEra() {
  const now = new Date();
  const hour = now.getUTCHours();
  return (hour >= 5 && hour < 17) ? 'morning' : 'evening';
}

/**
 * Get the most recent GitHub update time (5am or 5pm UTC)
 * @returns {Date} Most recent update boundary
 */
export function getLastGithubUpdateTime() {
  const now = new Date();
  const hour = now.getUTCHours();

  const boundary = new Date(now);
  boundary.setUTCMinutes(0, 0, 0);

  if (hour >= 17) {
    // After 5pm - last update was 5pm today
    boundary.setUTCHours(17);
  } else if (hour >= 5) {
    // Between 5am and 5pm - last update was 5am today
    boundary.setUTCHours(5);
  } else {
    // Before 5am - last update was 5pm yesterday
    boundary.setUTCHours(17);
    boundary.setUTCDate(boundary.getUTCDate() - 1);
  }

  return boundary;
}

/**
 * Check if cache was updated before the last GitHub update boundary
 * @param {number} cacheTimestamp - Cache timestamp in ms
 * @returns {boolean} True if cache is from before last update
 */
export function isCacheBeforeLastUpdate(cacheTimestamp) {
  if (!cacheTimestamp) return true;
  const lastUpdate = getLastGithubUpdateTime();
  return cacheTimestamp < lastUpdate.getTime();
}

// ============================================================================
// CACHE VALIDATION
// ============================================================================

/**
 * Determine if bootstrap data needs refresh based on GW status
 * @returns {boolean} True if refresh needed
 */
export function shouldRefreshBootstrap() {
  if (!cache.bootstrap.data || !cache.bootstrap.timestamp) {
    logger.log('🔄 Bootstrap cache empty, needs fetch');
    return true;
  }

  const age = Date.now() - cache.bootstrap.timestamp;

  try {
    const currentEvent = cache.bootstrap.data.events.find(e => e.is_current);

    if (!currentEvent || currentEvent.finished) {
      // GW finished or between gameweeks
      const shouldRefresh = age > TTL.GW_FINISHED;
      if (shouldRefresh) {
        logger.log(`🔄 Bootstrap cache stale (${Math.round(age / 1000 / 60)} min old, GW finished)`);
      }
      return shouldRefresh;
    } else {
      // GW in progress
      const shouldRefresh = age > TTL.GW_LIVE;
      if (shouldRefresh) {
        logger.log(`🔄 Bootstrap cache stale (${Math.round(age / 1000 / 60)} min old, GW live)`);
      }
      return shouldRefresh;
    }
  } catch (err) {
    logger.error('❌ Error checking bootstrap status:', err.message);
    return true; // Refresh on error
  }
}

/**
 * Determine if fixtures data needs refresh based on GW status
 * During live GW, refresh every 2 minutes to catch match status changes
 * When GW finished, refresh every 12 hours (fixtures rarely change)
 * @returns {boolean} True if refresh needed
 */
export function shouldRefreshFixtures() {
  if (!cache.fixtures.data || !cache.fixtures.timestamp) {
    logger.log('🔄 Fixtures cache empty, needs fetch');
    return true;
  }

  const age = Date.now() - cache.fixtures.timestamp;
  const ttl = getFixturesCacheTTL();
  const shouldRefresh = age > ttl;

  if (shouldRefresh) {
    const isLive = ttl === TTL.FIXTURES_LIVE;
    const ageDisplay = isLive
      ? `${Math.round(age / 1000)} sec`
      : `${Math.round(age / 1000 / 60 / 60)} hours`;
    const gwStatus = isLive ? 'GW live' : 'GW finished';
    logger.log(`🔄 Fixtures cache stale (${ageDisplay} old, ${gwStatus})`);
  }

  return shouldRefresh;
}

/**
 * Determine if GitHub data needs refresh based on update boundaries
 * GitHub updates at 5am and 5pm UTC - refresh if cache is from before last update
 * @returns {boolean} True if refresh needed
 */
export function shouldRefreshGithub() {
  if (!cache.github.data || !cache.github.timestamp) {
    logger.log('🔄 GitHub cache empty, needs fetch');
    return true;
  }

  // Check if cache was updated before the last 5am/5pm UTC boundary
  const needsRefresh = isCacheBeforeLastUpdate(cache.github.timestamp);

  if (needsRefresh) {
    const lastUpdate = getLastGithubUpdateTime();
    const cacheAge = Math.round((Date.now() - cache.github.timestamp) / 1000 / 60);
    logger.log(`🔄 GitHub cache stale (${cacheAge}min old, last update boundary: ${lastUpdate.toISOString()})`);
  }

  return needsRefresh;
}

// ============================================================================
// CACHE UPDATES
// ============================================================================

/**
 * Update bootstrap cache
 * @param {Object} data - Bootstrap data from FPL API
 */
export function updateBootstrapCache(data) {
  cache.bootstrap = {
    data,
    timestamp: Date.now()
  };
  cache.stats.lastFetch = Date.now();
}

/**
 * Update fixtures cache
 * @param {Object} data - Fixtures data from FPL API
 */
export function updateFixturesCache(data) {
  cache.fixtures = {
    data,
    timestamp: Date.now()
  };
}

/**
 * Update GitHub cache
 * @param {Object} data - GitHub CSV data
 */
export function updateGithubCache(data) {
  cache.github = {
    data,
    timestamp: Date.now(),
    era: getCurrentEra()
  };
}

// ============================================================================
// TEAM CACHE
// ============================================================================

/**
 * Get cached team data if fresh
 * @param {string|number} teamId - Team ID
 * @returns {Object|null} Cached data or null if stale/missing
 */
export function getCachedTeamData(teamId) {
  const cached = cache.teams.entries.get(String(teamId));
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  const ttl = getTeamCacheTTL();

  if (age > ttl) {
    cache.teams.entries.delete(String(teamId));
    return null;
  }

  return cached.data;
}

/**
 * Update team data cache
 * @param {string|number} teamId - Team ID
 * @param {Object} data - Team data
 */
export function updateTeamCache(teamId, data) {
  cache.teams.entries.set(String(teamId), {
    data,
    timestamp: Date.now()
  });
}

/**
 * Get cached team picks if fresh
 * @param {string|number} teamId - Team ID
 * @param {number} gameweek - Gameweek number
 * @returns {Object|null} Cached picks or null if stale/missing
 */
export function getCachedTeamPicks(teamId, gameweek) {
  const key = `${teamId}-${gameweek}`;
  const cached = cache.teams.picks.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  const ttl = getTeamCacheTTL();

  if (age > ttl) {
    cache.teams.picks.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Update team picks cache
 * @param {string|number} teamId - Team ID
 * @param {number} gameweek - Gameweek number
 * @param {Object} data - Picks data
 */
export function updateTeamPicksCache(teamId, gameweek, data) {
  const key = `${teamId}-${gameweek}`;
  cache.teams.picks.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Clear all team caches (useful when GW changes)
 */
export function clearTeamCaches() {
  cache.teams.entries.clear();
  cache.teams.picks.clear();
  logger.log('🗑️ Team caches cleared');
}

// ============================================================================
// COHORT CACHE
// ============================================================================

/**
 * Get cached cohort metrics for a specific gameweek
 * @param {number|string} gameweek - Gameweek number
 * @returns {Object|null} Cached cohort data
 */
export function getCachedCohortMetrics(gameweek) {
  if (!gameweek && gameweek !== 0) return null;
  const key = String(gameweek);
  const cached = cache.cohorts.entries.get(key);
  return cached ? cached.data : null;
}

/**
 * Update cohort cache for a gameweek
 * @param {number|string} gameweek - Gameweek number
 * @param {Object} data - Cohort metrics payload
 */
export function updateCohortCache(gameweek, data) {
  if (!gameweek && gameweek !== 0) return;
  const key = String(gameweek);
  cache.cohorts.entries.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Clear all cached cohort data (e.g., when forcing recompute)
 */
export function clearCohortCache() {
  cache.cohorts.entries.clear();
  logger.log('🗑️ Cohort cache cleared');
}

// ============================================================================
// LIVE DATA CACHE
// ============================================================================

/**
 * Get cached live data if fresh
 * @param {number} gameweek - Gameweek number
 * @returns {Object|null} Cached live data or null if stale/missing
 */
export function getCachedLiveData(gameweek) {
  const cached = cache.live.entries.get(gameweek);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > LIVE_CACHE_TTL) {
    cache.live.entries.delete(gameweek);
    return null;
  }

  return cached.data;
}

/**
 * Update live data cache
 * @param {number} gameweek - Gameweek number
 * @param {Object} data - Live data from FPL API
 */
export function updateLiveCache(gameweek, data) {
  cache.live.entries.set(gameweek, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Get live cache age in seconds
 * @param {number} gameweek - Gameweek number
 * @returns {number|null} Age in seconds or null if not cached
 */
export function getLiveCacheAge(gameweek) {
  const cached = cache.live.entries.get(gameweek);
  if (!cached) return null;
  return Math.round((Date.now() - cached.timestamp) / 1000);
}

/**
 * Clear all live data caches
 */
export function clearLiveCaches() {
  cache.live.entries.clear();
  logger.log('🗑️ Live data caches cleared');
}

/**
 * Record cache hit
 */
export function recordCacheHit() {
  cache.stats.cacheHits++;
}

/**
 * Record cache miss
 */
export function recordCacheMiss() {
  cache.stats.cacheMisses++;
}

/**
 * Record fetch
 */
export function recordFetch() {
  cache.stats.totalFetches++;
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  const hitRate = cache.stats.cacheHits + cache.stats.cacheMisses > 0
    ? ((cache.stats.cacheHits / (cache.stats.cacheHits + cache.stats.cacheMisses)) * 100).toFixed(1)
    : '0.0';

  return {
    ...cache.stats,
    hitRate: `${hitRate}%`,
    bootstrapAge: cache.bootstrap.timestamp
      ? Math.round((Date.now() - cache.bootstrap.timestamp) / 1000 / 60)
      : null,
    fixturesAge: cache.fixtures.timestamp
      ? Math.round((Date.now() - cache.fixtures.timestamp) / 1000 / 60)
      : null,
    githubAge: cache.github.timestamp
      ? Math.round((Date.now() - cache.github.timestamp) / 1000 / 60)
      : null,
    githubEra: cache.github.era,
    currentEra: getCurrentEra(),
    liveCacheEntries: cache.live.entries.size
  };
}

// ============================================================================
// DISK PERSISTENCE
// ============================================================================

/**
 * Load cache from disk backup or S3 (async)
 */
export async function loadCacheFromDisk() {
  let backup = null;
  let source = null;

  // Try MongoDB first if enabled
  if (MONGO.ENABLED && mongoStorage.isEnabled()) {
    backup = await mongoStorage.loadCacheFromMongo();
    if (backup) source = 'MongoDB';
  }

  // Fallback to S3 if MongoDB not available (for backwards compatibility)
  if (!backup && S3.ENABLED) {
    try {
      const s3Storage = await import('./s3Storage.js');
      if (s3Storage.default.isEnabled()) {
        backup = await s3Storage.default.loadCacheFromS3();
        if (backup) source = 'S3';
      }
    } catch (err) {
      // S3 not available, continue to local file
    }
  }

  // Fallback to local file if MongoDB/S3 failed or disabled
  if (!backup && fs.existsSync(SERVER.CACHE_BACKUP_PATH)) {
    try {
      backup = JSON.parse(fs.readFileSync(SERVER.CACHE_BACKUP_PATH, 'utf8'));
      source = 'local file';
    } catch (err) {
      logger.error('❌ Failed to load cache from local file:', err.message);
    }
  }

  // No backup found anywhere
  if (!backup) {
    logger.log('ℹ️ No cache backup found, starting fresh');
    return;
  }

  // Validate backup age
  const backupAge = Date.now() - (backup.bootstrap?.timestamp || 0);
  if (backupAge >= 24 * 60 * 60 * 1000) {
    logger.log('⚠️ Cache backup too old (>24h), starting fresh');
    return;
  }

  // Restore cache from backup
  try {
    cache.bootstrap = backup.bootstrap || { data: null, timestamp: null };
    cache.fixtures = backup.fixtures || { data: null, timestamp: null };
    cache.github = backup.github || { data: null, timestamp: null, era: null };
    cache.stats = backup.stats || { totalFetches: 0, cacheHits: 0, cacheMisses: 0, lastFetch: null };

    // Restore team caches from arrays back to Maps (if present in old backups)
    // Note: New backups don't include teams/cohorts/live to save memory
    if (backup.teams) {
      cache.teams.entries = new Map(backup.teams.entries || []);
      cache.teams.picks = new Map(backup.teams.picks || []);
    } else {
      // Initialize empty if not in backup (new format)
      cache.teams.entries = new Map();
      cache.teams.picks = new Map();
    }

    if (backup.cohorts) {
      cache.cohorts.entries = new Map(backup.cohorts.entries || []);
    } else {
      cache.cohorts.entries = new Map();
    }

    // Restore live cache from arrays back to Map (if present in old backups)
    if (backup.live) {
      cache.live.entries = new Map(backup.live.entries || []);
    } else {
      cache.live.entries = new Map();
    }

    logger.log(`✅ Cache restored from ${source}`);
    logger.log(`   Bootstrap: ${cache.bootstrap.data ? 'loaded' : 'empty'}`);
    logger.log(`   Fixtures: ${cache.fixtures.data ? 'loaded' : 'empty'}`);
    logger.log(`   GitHub: ${cache.github.data ? 'loaded' : 'empty'}`);
    logger.log(`   Teams: ${cache.teams.entries.size} entries, ${cache.teams.picks.size} picks (transient, not saved)`);
  } catch (err) {
    logger.error('❌ Failed to restore cache:', err.message);
    logger.log('   Starting with empty cache');
  }
}

/**
 * Save cache to disk and S3 (async)
 * Only saves essential data to avoid memory issues - excludes large transient caches
 */
export async function saveCacheToDisk() {
  try {
    // Only save essential, non-transient data to avoid memory issues
    // Exclude: teams, cohorts, live (these are transient and can be refetched)
    const serializable = {
      bootstrap: cache.bootstrap,
      fixtures: cache.fixtures,
      github: cache.github,
      stats: cache.stats
      // NOTE: Excluding teams, cohorts, and live caches to prevent OOM
      // - teams: Can be refetched from API
      // - cohorts: Already archived to S3 per-gameweek
      // - live: Transient data, not needed on restart
    };

    // Estimate size before serialization to avoid OOM
    const estimatedSize = JSON.stringify(serializable).length;
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    
    if (estimatedSize > maxSize) {
      logger.warn(`⚠️ Cache too large (${(estimatedSize / 1024 / 1024).toFixed(2)}MB), skipping backup to prevent OOM`);
      return;
    }

    // Save to local file (always, for redundancy)
    try {
      fs.writeFileSync(SERVER.CACHE_BACKUP_PATH, JSON.stringify(serializable, null, 2));
      logger.log('💾 Cache backed up to local disk');
    } catch (err) {
      logger.error('❌ Failed to backup cache to local disk:', err.message);
    }

    // Save to MongoDB if enabled
    if (MONGO.ENABLED && mongoStorage.isEnabled()) {
      await mongoStorage.saveCacheToMongo(serializable);
    }

    // Also save to S3 if enabled (for backwards compatibility during migration)
    if (S3.ENABLED) {
      try {
        const s3Storage = await import('./s3Storage.js');
        if (s3Storage.default.isEnabled()) {
          await s3Storage.default.saveCacheToS3(serializable);
        }
      } catch (err) {
        // S3 not available, ignore
      }
    }
  } catch (err) {
    logger.error('❌ Failed to backup cache:', err.message);
    // If it's a memory error, log it specifically
    if (err.message.includes('memory') || err.message.includes('allocation')) {
      logger.error('💥 Memory error during cache backup - consider reducing cache size');
    }
  }
}

/**
 * Initialize cache persistence (auto-save and graceful shutdown)
 */
export function initializeCachePersistence() {
  // Save cache every 5 minutes (async, fire-and-forget)
  setInterval(() => {
    saveCacheToDisk().catch(err => {
      logger.error('❌ Auto-save failed:', err.message);
    });
  }, 5 * 60 * 1000);

  // Save cache on graceful shutdown (await to ensure completion)
  process.on('SIGTERM', async () => {
    logger.log('🛑 SIGTERM received, saving cache...');
    await saveCacheToDisk();
    await mongoStorage.closeMongoConnection();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('🛑 SIGINT received, saving cache...');
    await saveCacheToDisk();
    await mongoStorage.closeMongoConnection();
    process.exit(0);
  });
}
