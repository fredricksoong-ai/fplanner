/**
 * Team Metrics Calculation
 * Calculates team-level metrics before and after changes
 */

import { getAllPlayers } from '../data.js';
import { calculateSquadAverages } from '../myTeam/teamSummaryHelpers.js';
import { calculateFixtureDifficulty } from '../fixtures.js';
import { analyzePlayerRisks, hasHighRisk, hasMediumRisk } from '../risk.js';
import { currentGW } from '../data.js';

/**
 * Calculate team metrics for a given squad
 * @param {Array} picks - Team picks array
 * @param {number} gameweek - Current gameweek
 * @returns {Object} Team metrics
 */
export function calculateTeamMetrics(picks, gameweek) {
    if (!picks || picks.length === 0) {
        return getEmptyMetrics();
    }

    const allPlayers = getAllPlayers();
    const players = picks
        .map(pick => allPlayers.find(p => p.id === pick.element))
        .filter(p => p !== undefined);

    if (players.length === 0) {
        return getEmptyMetrics();
    }

    // Use existing squad averages calculation
    const squadAverages = calculateSquadAverages(picks, gameweek);

    // Calculate expected points (sum of ep_next for next 5 GWs)
    let totalExpectedPoints = 0;
    players.forEach(player => {
        const epNext = parseFloat(player.ep_next) || 0;
        // For simplicity, use ep_next * 5 for next 5 GWs
        // In reality, we'd need to calculate per-GW, but ep_next is FPL's prediction
        totalExpectedPoints += epNext * 5;
    });

    // Count risks
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;

    players.forEach(player => {
        const risks = analyzePlayerRisks(player);
        if (hasHighRisk(risks)) {
            highRiskCount++;
        } else if (hasMediumRisk(risks)) {
            mediumRiskCount++;
        } else if (risks.length > 0) {
            lowRiskCount++;
        }
    });

    return {
        avgPPM: squadAverages.avgPPM,
        avgFDR: squadAverages.avgFDR,
        avgForm: calculateAverageForm(players),
        expectedPoints: totalExpectedPoints,
        riskCount: {
            high: highRiskCount,
            medium: mediumRiskCount,
            low: lowRiskCount
        },
        avgOwnership: squadAverages.avgOwnership,
        avgMinPercent: squadAverages.avgMinPercent
    };
}

/**
 * Calculate projected team metrics after changes
 * @param {Array} originalPicks - Original team picks
 * @param {Array} changes - Array of {out: playerId, in: playerId}
 * @param {number} gameweek - Current gameweek
 * @returns {Object} Projected team metrics
 */
export function calculateProjectedTeamMetrics(originalPicks, changes, gameweek) {
    if (!changes || changes.length === 0) {
        return calculateTeamMetrics(originalPicks, gameweek);
    }

    // Create projected squad
    const projectedPicks = originalPicks.map(pick => ({ ...pick }));
    
    changes.forEach(change => {
        const outIndex = projectedPicks.findIndex(p => p.element === change.out);
        if (outIndex >= 0) {
            projectedPicks[outIndex] = {
                ...projectedPicks[outIndex],
                element: change.in
            };
        }
    });

    return calculateTeamMetrics(projectedPicks, gameweek);
}

/**
 * Calculate average form across squad
 * @param {Array} players - Player objects
 * @returns {number} Average form
 */
function calculateAverageForm(players) {
    if (players.length === 0) return 0;
    
    const totalForm = players.reduce((sum, player) => {
        return sum + (parseFloat(player.form) || 0);
    }, 0);
    
    return totalForm / players.length;
}

/**
 * Get empty metrics object
 * @returns {Object} Empty metrics
 */
function getEmptyMetrics() {
    return {
        avgPPM: 0,
        avgFDR: 0,
        avgForm: 0,
        expectedPoints: 0,
        riskCount: {
            high: 0,
            medium: 0,
            low: 0
        },
        avgOwnership: 0,
        avgMinPercent: 0
    };
}

/**
 * Calculate delta between two metrics
 * @param {Object} current - Current metrics
 * @param {Object} original - Original metrics
 * @returns {Object} Delta metrics with direction indicators
 */
export function calculateMetricsDelta(current, original) {
    return {
        avgPPM: {
            value: current.avgPPM,
            delta: current.avgPPM - original.avgPPM,
            direction: current.avgPPM > original.avgPPM ? 'up' : 
                      current.avgPPM < original.avgPPM ? 'down' : 'neutral'
        },
        avgFDR: {
            value: current.avgFDR,
            delta: current.avgFDR - original.avgFDR,
            direction: current.avgFDR < original.avgFDR ? 'up' : // Lower FDR is better
                       current.avgFDR > original.avgFDR ? 'down' : 'neutral'
        },
        avgForm: {
            value: current.avgForm,
            delta: current.avgForm - original.avgForm,
            direction: current.avgForm > original.avgForm ? 'up' : 
                      current.avgForm < original.avgForm ? 'down' : 'neutral'
        },
        expectedPoints: {
            value: current.expectedPoints,
            delta: current.expectedPoints - original.expectedPoints,
            direction: current.expectedPoints > original.expectedPoints ? 'up' : 
                      current.expectedPoints < original.expectedPoints ? 'down' : 'neutral'
        },
        riskCount: {
            high: {
                value: current.riskCount.high,
                delta: current.riskCount.high - original.riskCount.high,
                direction: current.riskCount.high < original.riskCount.high ? 'up' : // Fewer risks is better
                           current.riskCount.high > original.riskCount.high ? 'down' : 'neutral'
            },
            medium: {
                value: current.riskCount.medium,
                delta: current.riskCount.medium - original.riskCount.medium,
                direction: current.riskCount.medium < original.riskCount.medium ? 'up' :
                           current.riskCount.medium > original.riskCount.medium ? 'down' : 'neutral'
            },
            low: {
                value: current.riskCount.low,
                delta: current.riskCount.low - original.riskCount.low,
                direction: current.riskCount.low < original.riskCount.low ? 'up' :
                           current.riskCount.low > original.riskCount.low ? 'down' : 'neutral'
            }
        }
    };
}

