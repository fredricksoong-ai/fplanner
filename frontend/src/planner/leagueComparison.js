/**
 * League comparison metrics for planner
 */

import { sharedState } from '../sharedState.js';
import { loadLeagueStandings, loadMyTeam } from '../data.js';
import { calculateTeamMetrics } from './metrics.js';

const MAX_LEAGUE_ENTRIES = 50;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const METRIC_KEYS = ['avgPPM', 'avgFDR', 'avgForm', 'expectedPoints', 'avgOwnership', 'avgXGI'];

function getPreferredLeagueId(teamId) {
    if (sharedState.activeLeagueTab) {
        return parseInt(sharedState.activeLeagueTab, 10);
    }

    if (typeof window !== 'undefined' && teamId) {
        const stored = window.localStorage?.getItem(`fpl_selected_league_${teamId}`);
        if (stored) {
            return parseInt(stored, 10);
        }
    }

    return null;
}

function getCacheKey(leagueId, gameweek) {
    return `${leagueId}_gw${gameweek}`;
}

function isCacheFresh(entry) {
    return entry && (Date.now() - entry.timestamp) < CACHE_TTL;
}

function computePercentiles(userMetrics, distributions) {
    const percentiles = {};
    const higherIsBetter = {
        avgPPM: true,
        avgFDR: false,
        avgForm: true,
        expectedPoints: true,
        avgOwnership: null, // informational only
        avgXGI: true
    };

    METRIC_KEYS.forEach(key => {
        const values = distributions[key];
        const userValue = userMetrics[key];

        if (!values || values.length === 0 || userValue === undefined || userValue === null) {
            percentiles[key] = null;
            return;
        }

        if (higherIsBetter[key] === null) {
            percentiles[key] = null;
            return;
        }

        const total = values.length;
        const betterCount = values.filter(value => {
            if (higherIsBetter[key]) {
                return value <= userValue;
            }
            return value >= userValue;
        }).length;

        percentiles[key] = Math.round((betterCount / total) * 100);
    });

    return percentiles;
}

async function fetchLeagueMetrics(leagueId, gameweek) {
    let leagueData = sharedState.leagueStandingsCache.get(leagueId);
    const cacheValid = leagueData && leagueData._timestamp && (Date.now() - leagueData._timestamp) < CACHE_TTL;

    if (!cacheValid) {
        leagueData = await loadLeagueStandings(leagueId);
        leagueData._timestamp = Date.now();
        sharedState.leagueStandingsCache.set(leagueId, leagueData);
    }

    const results = leagueData?.standings?.results || [];
    const sampleEntries = results.slice(0, MAX_LEAGUE_ENTRIES);
    if (sampleEntries.length === 0) {
        return null;
    }

    const distributions = {};
    METRIC_KEYS.forEach(key => {
        distributions[key] = [];
    });

    for (const entry of sampleEntries) {
        try {
            let teamData = sharedState.rivalTeamCache.get(entry.entry);
            if (!teamData) {
                teamData = await loadMyTeam(entry.entry);
                sharedState.rivalTeamCache.set(entry.entry, teamData);
            }

            const picks = teamData.picks?.picks;
            if (!picks || picks.length === 0) continue;

            const metrics = calculateTeamMetrics(picks, gameweek);
            METRIC_KEYS.forEach(key => {
                const value = metrics[key];
                if (typeof value === 'number' && Number.isFinite(value)) {
                    distributions[key].push(value);
                }
            });
        } catch (err) {
            console.warn('Failed to load rival team for league metrics:', err);
        }
    }

    const cleanDistributions = {};
    const averages = {};
    METRIC_KEYS.forEach(key => {
        const values = distributions[key].filter(val => typeof val === 'number' && Number.isFinite(val));
        cleanDistributions[key] = values;
        if (values.length > 0) {
            const sum = values.reduce((acc, val) => acc + val, 0);
            averages[key] = sum / values.length;
        } else {
            averages[key] = null;
        }
    });

    const sampleSize = cleanDistributions.avgPPM.length || cleanDistributions.avgFDR.length;

    return {
        leagueId,
        leagueName: leagueData.league?.name || `League ${leagueId}`,
        sampleSize,
        averages,
        distributions: cleanDistributions,
        timestamp: Date.now()
    };
}

export async function getLeagueComparisonMetrics(teamId, userMetrics, gameweek) {
    const leagueId = getPreferredLeagueId(teamId);
    if (!leagueId) return null;

    const cacheKey = getCacheKey(leagueId, gameweek);
    let cached = sharedState.leagueMetricsCache.get(cacheKey);

    if (!isCacheFresh(cached)) {
        const freshData = await fetchLeagueMetrics(leagueId, gameweek);
        if (!freshData) return null;
        cached = freshData;
        sharedState.leagueMetricsCache.set(cacheKey, freshData);
    }

    const percentiles = computePercentiles(userMetrics, cached.distributions);

    return {
        leagueId,
        leagueName: cached.leagueName,
        sampleSize: cached.sampleSize,
        averages: cached.averages,
        percentiles
    };
}

