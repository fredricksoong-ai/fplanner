// ============================================================================
// TEAM METRICS SERVICE
// Server-side replica of planner metrics used for cohort aggregation
// ============================================================================

import { cache } from './cacheManager.js';

const DEFAULT_FIXTURE_DIFFICULTY = 3;
const METRIC_KEYS = ['avgPPM', 'avgFDR', 'avgForm', 'expectedPoints', 'avgOwnership', 'avgXGI'];

/**
 * Calculate planner metrics for a given squad
 * @param {Array} picks - Team picks array from FPL API
 * @param {number} gameweek - Target gameweek
 * @returns {Object} Team metrics
 */
export function calculateTeamMetricsFromPicks(picks, gameweek) {
  if (!Array.isArray(picks) || picks.length === 0) {
    return getEmptyMetrics();
  }

  const players = picks
    .map(pick => getPlayerById(pick.element))
    .filter(Boolean);

  if (!players.length) {
    return getEmptyMetrics();
  }

  const squadStats = calculateSquadAverages(players, gameweek);
  const avgForm = calculateAverage(players, player => parseFloat(player.form) || 0);
  const avgXGI = calculateAverage(players, player => parseFloat(player.expected_goal_involvements_per_90) || 0);
  const expectedPoints = players.reduce((sum, player) => {
    const epNext = parseFloat(player.ep_next) || 0;
    return sum + (epNext * 5);
  }, 0);

  return {
    avgPPM: squadStats.avgPPM,
    avgFDR: squadStats.avgFDR,
    avgForm,
    expectedPoints,
    avgOwnership: squadStats.avgOwnership,
    avgMinPercent: squadStats.avgMinPercent,
    avgXGI
  };
}

/**
 * Calculate squad averages for planner metrics
 * @param {Array} players - Player objects from bootstrap
 * @param {number} gameweek - Target gameweek
 * @returns {Object} Aggregate stats
 */
function calculateSquadAverages(players, gameweek) {
  const totals = players.reduce((acc, player) => {
    acc.ppm += calculatePPM(player);
    acc.ownership += parseFloat(player.selected_by_percent) || 0;
    acc.minutesPercent += calculateMinutesPercentage(player, gameweek);
    acc.fdr += calculateFixtureDifficulty(player.team, 5, gameweek + 1);
    return acc;
  }, { ppm: 0, ownership: 0, minutesPercent: 0, fdr: 0 });

  const count = players.length;

  return {
    avgPPM: count ? totals.ppm / count : 0,
    avgOwnership: count ? totals.ownership / count : 0,
    avgMinPercent: count ? totals.minutesPercent / count : 0,
    avgFDR: count ? totals.fdr / count : DEFAULT_FIXTURE_DIFFICULTY
  };
}

function calculateAverage(players, getter) {
  if (!players.length) return 0;
  const total = players.reduce((sum, player) => sum + getter(player), 0);
  return total / players.length;
}

function calculatePPM(player) {
  if (!player || !player.now_cost) return 0;
  return (player.total_points || 0) / (player.now_cost / 10);
}

function calculateMinutesPercentage(player, gameweek) {
  if (!player || !gameweek) return 0;
  return ((player.minutes || 0) / (gameweek * 90)) * 100;
}

function calculateFixtureDifficulty(teamId, count = 5, startGameweek = 1) {
  if (!teamId || !cache.fixtures?.data?.length) {
    return DEFAULT_FIXTURE_DIFFICULTY;
  }

  const fixtures = cache.fixtures.data
    .filter(f => (f.team_h === teamId || f.team_a === teamId) && f.event >= startGameweek)
    .sort((a, b) => a.event - b.event)
    .slice(0, count);

  if (!fixtures.length) {
    return DEFAULT_FIXTURE_DIFFICULTY;
  }

  const totalDifficulty = fixtures.reduce((sum, fixture) => {
    const isHome = fixture.team_h === teamId;
    return sum + (isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty || DEFAULT_FIXTURE_DIFFICULTY);
  }, 0);

  return totalDifficulty / fixtures.length;
}

function getPlayerById(playerId) {
  return cache.bootstrap?.data?.elements?.find(element => element.id === playerId) || null;
}

function getEmptyMetrics() {
  return METRIC_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, { avgMinPercent: 0 });
}

export const metricKeys = METRIC_KEYS;

