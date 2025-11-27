// ============================================================================
// COHORT SCHEDULER
// Computes cohort aggregates once per finished gameweek
// ============================================================================

import {
  getCachedCohortMetrics,
  updateCohortCache
} from './cacheManager.js';
import { executors } from './cohortService.js';
import {
  getGameweekEvent,
  getLatestFinishedGameweek
} from './gameweekUtils.js';
import logger from '../logger.js';

const CHECK_INTERVAL_MS = parseInt(process.env.COHORT_SCHEDULER_POLL_MS ?? `${15 * 60 * 1000}`, 10);
const POST_GW_DELAY_MS = parseInt(process.env.COHORT_POST_GW_DELAY_MS ?? `${2 * 60 * 60 * 1000}`, 10);
const RETRY_DELAY_MS = parseInt(process.env.COHORT_SCHEDULER_RETRY_MS ?? `${30 * 60 * 1000}`, 10);

let monitorHandle = null;
let scheduledTimeout = null;
let pendingGameweek = null;
let lastProcessedGameweek = null;
let computing = false;

export function startCohortScheduler() {
  if (process.env.DISABLE_COHORT_SCHEDULER === 'true') {
    logger.log('⏭️ Cohort scheduler disabled via env flag');
    return;
  }

  logger.log('🕒 Cohort scheduler starting');
  evaluateSchedule();
  monitorHandle = setInterval(evaluateSchedule, CHECK_INTERVAL_MS);
}

function stopCohortScheduler() {
  if (monitorHandle) {
    clearInterval(monitorHandle);
    monitorHandle = null;
  }

  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout);
    scheduledTimeout = null;
  }
}

async function evaluateSchedule() {
  try {
    const latestFinished = getLatestFinishedGameweek();
    if (!latestFinished) return;

    if (lastProcessedGameweek && latestFinished <= lastProcessedGameweek) {
      return;
    }

    const cached = getCachedCohortMetrics(latestFinished);
    if (cached) {
      lastProcessedGameweek = latestFinished;
      return;
    }

    if (pendingGameweek === latestFinished) {
      return;
    }

    scheduleAggregation(latestFinished);
  } catch (err) {
    logger.warn(`⚠️ Cohort scheduler check failed: ${err.message}`);
  }
}

function scheduleAggregation(gameweek) {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout);
    scheduledTimeout = null;
  }

  pendingGameweek = gameweek;
  const delay = Math.max(0, computeDelay(gameweek));
  logger.log(`🕒 Cohort scheduler: scheduling GW${gameweek} aggregation in ${Math.round(delay / 60000)} minutes`);

  scheduledTimeout = setTimeout(() => runAggregation(gameweek), delay);
}

function computeDelay(gameweek) {
  const event = getGameweekEvent(gameweek);
  if (!event) {
    return POST_GW_DELAY_MS;
  }

  if (!event.finished) {
    return POST_GW_DELAY_MS;
  }

  const dataChecked = event.data_checked_time ? Date.parse(event.data_checked_time) : NaN;
  if (Number.isNaN(dataChecked)) {
    return POST_GW_DELAY_MS;
  }

  const elapsed = Date.now() - dataChecked;
  return Math.max(0, POST_GW_DELAY_MS - elapsed);
}

async function runAggregation(gameweek) {
  if (computing) {
    return;
  }

  scheduledTimeout = null;
  pendingGameweek = null;
  computing = true;

  try {
    logger.log(`🚀 Cohort scheduler: computing GW${gameweek}`);
    const payload = await executors.computeCohorts(gameweek);
    updateCohortCache(gameweek, payload);
    lastProcessedGameweek = gameweek;
    logger.log(`✅ Cohort scheduler: GW${gameweek} snapshot stored`);
  } catch (err) {
    logger.error(`❌ Cohort scheduler failed for GW${gameweek}: ${err.message}`);
    pendingGameweek = gameweek;
    scheduledTimeout = setTimeout(() => runAggregation(gameweek), RETRY_DELAY_MS);
  } finally {
    computing = false;
  }
}

export const __internal = {
  computeDelay,
  stopCohortScheduler
};

