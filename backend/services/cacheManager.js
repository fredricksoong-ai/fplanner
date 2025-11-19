// ============================================================================
// CACHE MANAGER SERVICE
// Manages in-memory cache with smart refresh logic and disk persistence
// ============================================================================

import fs from 'fs';
import { SERVER, TTL } from '../config.js';
import logger from '../logger.js';

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
  stats: {
    totalFetches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastFetch: null
  }
};

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
 * Determine if fixtures data needs refresh
 * @returns {boolean} True if refresh needed
 */
export function shouldRefreshFixtures() {
  if (!cache.fixtures.data || !cache.fixtures.timestamp) {
    logger.log('🔄 Fixtures cache empty, needs fetch');
    return true;
  }

  const age = Date.now() - cache.fixtures.timestamp;
  const shouldRefresh = age > TTL.FIXTURES;

  if (shouldRefresh) {
    logger.log(`🔄 Fixtures cache stale (${Math.round(age / 1000 / 60 / 60)} hours old)`);
  }

  return shouldRefresh;
}

/**
 * Determine if GitHub data needs refresh based on era
 * @returns {boolean} True if refresh needed
 */
export function shouldRefreshGithub() {
  if (!cache.github.data || !cache.github.timestamp) {
    logger.log('🔄 GitHub cache empty, needs fetch');
    return true;
  }

  const currentEra = getCurrentEra();
  const shouldRefresh = cache.github.era !== currentEra;

  if (shouldRefresh) {
    logger.log(`🔄 GitHub cache stale (era changed: ${cache.github.era} → ${currentEra})`);
  }

  return shouldRefresh;
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
    currentEra: getCurrentEra()
  };
}

// ============================================================================
// DISK PERSISTENCE
// ============================================================================

/**
 * Load cache from disk backup
 */
export function loadCacheFromDisk() {
  if (fs.existsSync(SERVER.CACHE_BACKUP_PATH)) {
    try {
      const backup = JSON.parse(fs.readFileSync(SERVER.CACHE_BACKUP_PATH, 'utf8'));

      // Only restore if backup is less than 24 hours old
      const backupAge = Date.now() - (backup.bootstrap?.timestamp || 0);
      if (backupAge < 24 * 60 * 60 * 1000) {
        cache = backup;
        logger.log('✅ Cache restored from disk');
        logger.log(`   Bootstrap: ${cache.bootstrap.data ? 'loaded' : 'empty'}`);
        logger.log(`   Fixtures: ${cache.fixtures.data ? 'loaded' : 'empty'}`);
        logger.log(`   GitHub: ${cache.github.data ? 'loaded' : 'empty'}`);
      } else {
        logger.log('⚠️ Cache backup too old (>24h), starting fresh');
      }
    } catch (err) {
      logger.error('❌ Failed to load cache from disk:', err.message);
      logger.log('   Starting with empty cache');
    }
  } else {
    logger.log('ℹ️ No cache backup found, starting fresh');
  }
}

/**
 * Save cache to disk
 */
export function saveCacheToDisk() {
  try {
    fs.writeFileSync(SERVER.CACHE_BACKUP_PATH, JSON.stringify(cache, null, 2));
    logger.log('💾 Cache backed up to disk');
  } catch (err) {
    logger.error('❌ Failed to backup cache:', err.message);
  }
}

/**
 * Initialize cache persistence (auto-save and graceful shutdown)
 */
export function initializeCachePersistence() {
  // Save cache every 5 minutes
  setInterval(saveCacheToDisk, 5 * 60 * 1000);

  // Save cache on graceful shutdown
  process.on('SIGTERM', () => {
    logger.log('🛑 SIGTERM received, saving cache...');
    saveCacheToDisk();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.log('🛑 SIGINT received, saving cache...');
    saveCacheToDisk();
    process.exit(0);
  });
}
