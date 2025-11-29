// ============================================================================
// COHORT SERVICE
// Aggregates planner metrics for top cohort buckets
// ============================================================================

import {
  fetchBootstrap,
  fetchFixtures,
  fetchLeagueStandings,
  fetchTeamPicks
} from './fplService.js';
import {
  cache,
  shouldRefreshBootstrap,
  shouldRefreshFixtures,
  getCachedCohortMetrics,
  updateCohortCache
} from './cacheManager.js';
import { getLatestFinishedGameweek, isGameweekCompleted } from './gameweekUtils.js';
import { calculateTeamMetricsFromPicks, metricKeys } from './teamMetrics.js';
import s3Storage from './s3Storage.js';
import logger from '../logger.js';

const OVERALL_LEAGUE_ID = 314;
const ENTRIES_PER_PAGE = 50;
const SAMPLE_PAGES_PER_BUCKET = 8;
const MAX_TEAMS_PER_BUCKET = 500;
const MAX_CONCURRENT_FETCHES = 5;
const COHORT_CACHE_TTL_DEFAULT = 6 * 60 * 60 * 1000; // 6 hours (live/uncertain)
const COHORT_CACHE_TTL_FINISHED = 3 * 60 * 60 * 1000; // 3 hours post-finish

const COHORT_BUCKETS = [
  { key: 'top10k', label: 'Top 10k', maxRank: 10000 },
  { key: 'top50k', label: 'Top 50k', maxRank: 50000 },
  { key: 'top100k', label: 'Top 100k', maxRank: 100000 }
];

/**
 * Retrieve cohort metrics for a given gameweek (with cache)
 * @param {number} [gameweek] - Target gameweek (defaults to latest finished)
 * @param {Object} [options]
 * @param {boolean} [options.force=false] - Force recompute even if cache fresh
 */
export const executors = {
  computeCohorts: computeCohortMetrics
};

export async function getCohortMetrics(gameweek = getLatestFinishedGameweek(), options = {}) {
  const targetGameweek = normalizeTargetGameweek(gameweek);

  // Step 1: Check in-memory cache
  const cached = getCachedCohortMetrics(targetGameweek);
  if (!options.force && isCohortDataFresh(cached, targetGameweek)) {
    return cached;
  }

  // Step 2: For completed GWs, try loading from S3 archive
  const isCompleted = isGameweekCompleted(targetGameweek);
  if (isCompleted && !options.force) {
    const archived = await s3Storage.loadGameweekFromS3(targetGameweek, 'cohorts');
    if (archived) {
      // Update in-memory cache with archived data
      updateCohortCache(targetGameweek, archived);
      logger.log(`✅ GW${targetGameweek} cohorts restored from S3 archive`);
      return archived;
    }
  }

  // Step 3: Not in cache or archive - compute from scratch
  const computed = await executors.computeCohorts(targetGameweek);
  const { cohorts, picks } = computed;

  // Update in-memory cache with cohort metrics only
  updateCohortCache(targetGameweek, cohorts);

  // Step 4: Archive all data types to S3 if gameweek is completed
  if (isCompleted && s3Storage.isEnabled()) {
    logger.log(`📦 Archiving GW${targetGameweek} complete dataset to S3...`);

    // Archive cohorts
    await s3Storage.archiveGameweekToS3(targetGameweek, 'cohorts', cohorts);

    // Archive picks
    await s3Storage.archiveGameweekToS3(targetGameweek, 'picks', picks);

    // Archive bootstrap snapshot (player prices, ownership, form)
    if (cache.bootstrap?.data) {
      const bootstrapSnapshot = {
        gameweek: targetGameweek,
        timestamp: Date.now(),
        elements: cache.bootstrap.data.elements,
        teams: cache.bootstrap.data.teams,
        events: cache.bootstrap.data.events
      };
      await s3Storage.archiveGameweekToS3(targetGameweek, 'bootstrap', bootstrapSnapshot);
    }

    // Archive GitHub snapshot (enriched metrics)
    if (cache.github?.data) {
      const githubSnapshot = {
        gameweek: targetGameweek,
        timestamp: Date.now(),
        currentGW: cache.github.data.currentGW,
        seasonStats: cache.github.data.seasonStats,
        currentGWStats: cache.github.data.currentGWStats
      };
      await s3Storage.archiveGameweekToS3(targetGameweek, 'github', githubSnapshot);
    }

    logger.log(`✅ GW${targetGameweek} complete dataset archived to S3`);
  }

  return cohorts;
}

/**
 * Compute cohort metrics by sampling ranked teams
 * Exported for testing
 * @param {number} gameweek
 */
export async function computeCohortMetrics(gameweek) {
  if (!Number.isInteger(gameweek) || gameweek < 1 || gameweek > 38) {
    throw new Error('Invalid gameweek supplied to cohort metrics');
  }

  await ensureBaseData();

  const bucketResults = {};
  const bucketPicks = {};

  for (const bucket of COHORT_BUCKETS) {
    const entryIds = await collectEntryIdsForBucket(bucket);
    const { metrics, allPicks } = await fetchMetricsForEntries(entryIds, gameweek);

    bucketResults[bucket.key] = buildBucketSummary(bucket, metrics, entryIds.length);
    bucketPicks[bucket.key] = aggregatePicksData(allPicks);
  }

  return {
    cohorts: {
      gameweek,
      timestamp: Date.now(),
      buckets: bucketResults
    },
    picks: {
      gameweek,
      timestamp: Date.now(),
      buckets: bucketPicks
    }
  };
}

function isCohortDataFresh(data, gameweek) {
  if (!data || !data.timestamp) return false;

  // Once a gameweek is completed we treat the snapshot as immutable until the next season.
  if (gameweek && isGameweekCompleted(gameweek)) {
    return true;
  }

  const ttl = getCohortCacheTTL(gameweek);
  return (Date.now() - data.timestamp) < ttl;
}

async function ensureBaseData() {
  if (!cache.bootstrap.data || shouldRefreshBootstrap()) {
    await fetchBootstrap();
  }
  if (!cache.fixtures.data || shouldRefreshFixtures()) {
    await fetchFixtures();
  }
}

async function collectEntryIdsForBucket(bucket) {
  const pages = getSamplePagesForBucket(bucket);
  const entryIds = new Set();

  for (const page of pages) {
    try {
      const standings = await fetchLeagueStandings(OVERALL_LEAGUE_ID, page);
      const results = standings?.standings?.results || [];
      for (const entry of results) {
        if (entry.rank && entry.rank <= bucket.maxRank) {
          entryIds.add(entry.entry);
          if (entryIds.size >= MAX_TEAMS_PER_BUCKET) {
            break;
          }
        }
      }
    } catch (err) {
      logger.warn(`⚠️ Failed to fetch page ${page} for bucket ${bucket.key}: ${err.message}`);
    }

    if (entryIds.size >= MAX_TEAMS_PER_BUCKET) {
      break;
    }
  }

  return Array.from(entryIds).slice(0, MAX_TEAMS_PER_BUCKET);
}

function getSamplePagesForBucket(bucket) {
  const totalPages = Math.ceil(bucket.maxRank / ENTRIES_PER_PAGE);
  const step = Math.max(1, Math.floor(totalPages / SAMPLE_PAGES_PER_BUCKET));
  const pages = new Set([1]);

  for (let page = step; page <= totalPages; page += step) {
    pages.add(Math.min(page, totalPages));
  }

  return Array.from(pages).sort((a, b) => a - b);
}

async function fetchMetricsForEntries(entryIds, gameweek) {
  const metrics = [];
  const allPicks = [];  // Store raw picks for archiving

  let index = 0;
  async function worker() {
    while (index < entryIds.length) {
      const currentIndex = index++;
      const teamId = entryIds[currentIndex];
      try {
        const picks = await fetchTeamPicks(teamId, gameweek);
        const picksArray = picks?.picks || [];
        const calculated = calculateTeamMetricsFromPicks(picksArray, gameweek);
        if (calculated) {
          metrics.push(calculated);
          // Store raw picks for aggregation
          allPicks.push({ teamId, picks: picksArray });
        }
      } catch (err) {
        logger.warn(`⚠️ Failed to fetch picks for team ${teamId}: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_FETCHES, entryIds.length || 1) }, () => worker());
  await Promise.all(workers);

  return { metrics, allPicks };
}

/**
 * Aggregate raw picks into player ownership data
 * @param {Array} allPicks - Array of {teamId, picks} objects
 * @returns {Object} Aggregated ownership data
 */
function aggregatePicksData(allPicks) {
  const playerMap = new Map();
  const formations = {};

  allPicks.forEach(({ picks }) => {
    // Track formation
    const defenders = picks.filter(p => p.position <= 2).length;
    const midfielders = picks.filter(p => p.position === 3).length;
    const forwards = picks.filter(p => p.position === 4).length;
    const formation = `${defenders}-${midfielders}-${forwards}`;
    formations[formation] = (formations[formation] || 0) + 1;

    // Track player ownership
    picks.forEach(pick => {
      if (!playerMap.has(pick.element)) {
        playerMap.set(pick.element, {
          element: pick.element,
          ownership: 0,
          captainCount: 0,
          viceCaptainCount: 0,
          benchCount: 0,
          multiplierSum: 0
        });
      }

      const stats = playerMap.get(pick.element);
      stats.ownership++;

      if (pick.is_captain) stats.captainCount++;
      if (pick.is_vice_captain) stats.viceCaptainCount++;
      if (pick.multiplier) stats.multiplierSum += pick.multiplier;
      if (pick.position > 11) stats.benchCount++;
    });
  });

  // Convert to array and sort by ownership
  const players = Array.from(playerMap.values())
    .sort((a, b) => b.ownership - a.ownership);

  return {
    players,
    formations,
    sampleSize: allPicks.length
  };
}

function buildBucketSummary(bucket, metrics, attempted) {
  const distributions = {};
  const averages = {};

  metricKeys.forEach(key => {
    distributions[key] = [];
  });

  metrics.forEach(metric => {
    metricKeys.forEach(key => {
      const value = metric[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        distributions[key].push(value);
      }
    });
  });

  metricKeys.forEach(key => {
    const values = distributions[key];
    if (values.length === 0) {
      averages[key] = null;
      return;
    }
    const sum = values.reduce((acc, val) => acc + val, 0);
    averages[key] = sum / values.length;
  });

  return {
    key: bucket.key,
    label: bucket.label,
    maxRank: bucket.maxRank,
    sampleSize: metrics.length,
    attempted,
    averages,
    distributions
  };
}

function normalizeTargetGameweek(requestedGameweek) {
  if (requestedGameweek === undefined || requestedGameweek === null) {
    return getLatestFinishedGameweek();
  }

  if (!cache.bootstrap?.data) {
    return requestedGameweek;
  }

  if (isGameweekCompleted(requestedGameweek)) {
    return requestedGameweek;
  }

  const latestFinished = getLatestFinishedGameweek();
  if (requestedGameweek !== latestFinished) {
    logger.log(`ℹ️ Cohort GW ${requestedGameweek} not finished, falling back to latest finished GW ${latestFinished}`);
  }

  return latestFinished;
}

function getCohortCacheTTL(gameweek) {
  if (gameweek && isGameweekCompleted(gameweek)) {
    return COHORT_CACHE_TTL_FINISHED;
  }
  return COHORT_CACHE_TTL_DEFAULT;
}

export const __internal = {
  getSamplePagesForBucket,
  isCohortDataFresh
};

