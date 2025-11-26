// ============================================================================
// GITHUB SERVICE
// Handles GitHub CSV data fetching (FPL-Elo-Insights)
// ============================================================================

import axios from 'axios';
import Papa from 'papaparse';
import { getGithubUrls } from '../config.js';
import {
  cache,
  getCurrentEra,
  updateGithubCache,
  recordFetch
} from './cacheManager.js';
import { fetchBootstrap } from './fplService.js';
import logger from '../logger.js';

const NEXT_GW_RETRY_DELAY = 30 * 60 * 1000; // 30 minutes

function shouldSkipNextGWFetch(targetGW) {
  const status = cache.github.nextGWStatus;
  if (!status) return false;
  if (status.gw !== targetGW) return false;
  if (status.available) return false;
  if (!status.lastChecked) return false;
  return (Date.now() - status.lastChecked) < NEXT_GW_RETRY_DELAY && status.reason === 'not_found';
}

// ============================================================================
// GITHUB CSV DATA FETCHING
// ============================================================================

/**
 * Fetch GitHub CSV data (3-source strategy)
 * - Season stats (always)
 * - Current GW stats (if finished)
 * - Next GW stats (for transfers)
 * @returns {Promise<Object>} Parsed GitHub data
 */
export async function fetchGithubCSV() {
  logger.log('📡 Fetching GitHub CSV data...');

  try {
    // Get current GW from bootstrap
    if (!cache.bootstrap.data) {
      await fetchBootstrap();
    }

    // Find the latest FINISHED game week (not is_current which could be in-progress)
    const finishedEvents = cache.bootstrap.data.events.filter(e => e.finished);
    const latestFinishedGW = finishedEvents.length > 0
      ? Math.max(...finishedEvents.map(e => e.id))
      : 1;
    const currentGW = latestFinishedGW;
    const isFinished = true; // By definition, we're using a finished GW

    logger.log(`📊 Latest Finished GW: ${currentGW}`);

    const urls = getGithubUrls(currentGW, isFinished);
    const nextGWTarget = currentGW + 1;
    let nextGWStatus = cache.github.nextGWStatus || {
      gw: nextGWTarget,
      available: false,
      reason: 'unknown',
      lastChecked: null
    };

    // Fetch all available sources in parallel
    const fetchPromises = [];

    // 1. Season stats (always fetch)
    logger.log(`📡 Fetching season stats...`);
    fetchPromises.push(
      axios.get(urls.seasonStats, {
        timeout: 15000,
        headers: { 'User-Agent': 'FPLanner/1.0' }
      })
        .then(res => ({ type: 'season', data: res.data }))
        .catch(err => {
          logger.error(`❌ Failed to fetch season stats:`, err.message);
          return null;
        })
    );

    // 2. Current GW stats (if finished)
    if (urls.currentGWStats) {
      logger.log(`📡 Fetching GW${currentGW} stats...`);
      fetchPromises.push(
        axios.get(urls.currentGWStats, {
          timeout: 15000,
          headers: { 'User-Agent': 'FPLanner/1.0' }
        })
          .then(res => ({ type: 'currentGW', data: res.data }))
          .catch(err => {
            logger.warn(`⚠️ GW${currentGW} stats not available yet:`, err.message);
            return null;
          })
      );
    }

    // 3. Next GW stats (for transfers)
    if (shouldSkipNextGWFetch(nextGWTarget)) {
      logger.log(`⏭️ Skipping GW${nextGWTarget} stats fetch (recent 404)`);
      nextGWStatus = {
        gw: nextGWTarget,
        available: false,
        reason: 'not_found_recent',
        lastChecked: Date.now()
      };
    } else {
      logger.log(`📡 Fetching GW${nextGWTarget} stats for transfers...`);
      fetchPromises.push(
        axios.get(urls.nextGWStats, {
          timeout: 15000,
          headers: { 'User-Agent': 'FPLanner/1.0' }
        })
          .then(res => {
            nextGWStatus = {
              gw: nextGWTarget,
              available: true,
              reason: null,
              lastChecked: Date.now()
            };
            return { type: 'nextGW', data: res.data };
          })
          .catch(err => {
            const notFound = err.response?.status === 404;
            nextGWStatus = {
              gw: nextGWTarget,
              available: false,
              reason: notFound ? 'not_found' : 'error',
              lastChecked: Date.now(),
              message: err.message
            };
            const label = notFound ? 'not published yet' : err.message;
            logger.warn(`⚠️ GW${nextGWTarget} stats not available (${label})`);
            return null;
          })
      );
    }

    const results = await Promise.all(fetchPromises);

    // Parse CSVs
    const parsedData = {};

    for (const result of results.filter(r => r !== null)) {
      const parsed = Papa.parse(result.data, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      if (parsed.errors.length > 0) {
        logger.warn(`⚠️ CSV parsing warnings for ${result.type}:`, parsed.errors.length);
      }

      parsedData[result.type] = parsed.data;
      logger.log(`✅ Parsed ${result.type}: ${parsed.data.length} players`);
    }

    // Build cache data
    const githubData = {
      currentGW: currentGW,
      isFinished: isFinished,
      seasonStats: parsedData.season || [],
      currentGWStats: parsedData.currentGW || [],
      nextGWStats: parsedData.nextGW || [],
      nextGWStatus
    };

    // Update cache with additional metadata
    cache.github.data = githubData;
    cache.github.timestamp = Date.now();
    cache.github.era = getCurrentEra();
    cache.github.currentGW = currentGW;
    cache.github.nextGWStatus = nextGWStatus;
    recordFetch();

    logger.log(`✅ GitHub data loaded:`);
    logger.log(`   Season stats: ${parsedData.season?.length || 0} players`);
    logger.log(`   GW${currentGW} stats: ${parsedData.currentGW?.length || 0} players`);
    logger.log(`   GW${currentGW + 1} stats: ${parsedData.nextGW?.length || 0} players`);

    return githubData;

  } catch (err) {
    logger.error('❌ Failed to fetch GitHub CSV:', err.message);

    if (cache.github.data) {
      logger.log('⚠️ Using stale GitHub cache as fallback');
      return cache.github.data;
    }

    throw new Error('GitHub data unavailable');
  }
}
