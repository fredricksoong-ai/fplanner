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
import { getLatestFinishedGameweek } from './gameweekUtils.js';
import { calculateTeamMetricsFromPicks, metricKeys } from './teamMetrics.js';
import logger from '../logger.js';

const OVERALL_LEAGUE_ID = 314;
const ENTRIES_PER_PAGE = 50;
const SAMPLE_PAGES_PER_BUCKET = 8;
const MAX_TEAMS_PER_BUCKET = 500;
const MAX_CONCURRENT_FETCHES = 5;
const COHORT_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

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
  const cached = getCachedCohortMetrics(gameweek);
  if (!options.force && isCohortDataFresh(cached)) {
    return cached;
  }

  const computed = await executors.computeCohorts(gameweek);
  updateCohortCache(gameweek, computed);
  return computed;
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
  for (const bucket of COHORT_BUCKETS) {
    const entryIds = await collectEntryIdsForBucket(bucket);
    const metrics = await fetchMetricsForEntries(entryIds, gameweek);
    bucketResults[bucket.key] = buildBucketSummary(bucket, metrics, entryIds.length);
  }

  return {
    gameweek,
    timestamp: Date.now(),
    buckets: bucketResults
  };
}

function isCohortDataFresh(data) {
  if (!data || !data.timestamp) return false;
  return (Date.now() - data.timestamp) < COHORT_CACHE_TTL;
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

  let index = 0;
  async function worker() {
    while (index < entryIds.length) {
      const currentIndex = index++;
      const teamId = entryIds[currentIndex];
      try {
        const picks = await fetchTeamPicks(teamId, gameweek);
        const calculated = calculateTeamMetricsFromPicks(picks?.picks || [], gameweek);
        if (calculated) {
          metrics.push(calculated);
        }
      } catch (err) {
        logger.warn(`⚠️ Failed to fetch picks for team ${teamId}: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_FETCHES, entryIds.length || 1) }, () => worker());
  await Promise.all(workers);

  return metrics;
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

export const __internal = {
  getSamplePagesForBucket,
  isCohortDataFresh
};

