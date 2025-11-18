/**
 * Team Summary Calculation Helpers
 * Pure calculation functions for team statistics
 */

import { getPlayerById } from '../data.js';
import { calculatePPM, calculateMinutesPercentage } from '../utils.js';
import { calculateFixtureDifficulty } from '../fixtures.js';
import { analyzePlayerRisks, hasHighRisk } from '../risk.js';

/**
 * Calculate bench points for a given gameweek
 * @param {Array} players - All player picks with positions
 * @param {number} gameweek - Current gameweek
 * @returns {number} Total bench points
 */
export function calculateBenchPoints(players, gameweek) {
    const bench = players.filter(p => p.position > 11);
    let benchPoints = 0;

    bench.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (player) {
            const hasGWStats = player.github_gw && player.github_gw.gw === gameweek;
            const gwPoints = hasGWStats ? player.github_gw.total_points : player.event_points;
            benchPoints += gwPoints || 0;
        }
    });

    return benchPoints;
}

/**
 * Calculate squad averages (PPM, ownership, minutes %, FDR)
 * @param {Array} players - All player picks
 * @param {number} gameweek - Current gameweek
 * @returns {Object} Squad statistics
 */
export function calculateSquadAverages(players, gameweek) {
    let totalPPM = 0;
    let totalOwnership = 0;
    let totalMinPercent = 0;
    let totalFDR = 0;
    let highRiskCount = 0;

    players.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (player) {
            totalPPM += calculatePPM(player);
            totalOwnership += parseFloat(player.selected_by_percent) || 0;
            totalMinPercent += calculateMinutesPercentage(player, gameweek);
            totalFDR += calculateFixtureDifficulty(player.team, 5);

            const risks = analyzePlayerRisks(player);
            if (hasHighRisk(risks)) {
                highRiskCount++;
            }
        }
    });

    const count = players.length;

    return {
        avgPPM: count > 0 ? totalPPM / count : 0,
        avgOwnership: count > 0 ? totalOwnership / count : 0,
        avgMinPercent: count > 0 ? totalMinPercent / count : 0,
        avgFDR: count > 0 ? totalFDR / count : 0,
        highRiskCount
    };
}

/**
 * Classify fixture difficulty rating
 * @param {number} avgFDR - Average FDR value
 * @returns {Object} Classification with color and label
 */
export function classifyFixtureDifficulty(avgFDR) {
    if (avgFDR <= 2.5) {
        return {
            color: '#22c55e',
            label: '✓ Excellent fixtures',
            severity: 'excellent'
        };
    } else if (avgFDR <= 3.5) {
        return {
            color: '#fb923c',
            label: 'Average fixtures',
            severity: 'average'
        };
    } else {
        return {
            color: '#ef4444',
            label: '⚠️ Tough fixtures',
            severity: 'tough'
        };
    }
}

/**
 * Classify high risk player count
 * @param {number} count - Number of high risk players
 * @returns {Object} Classification with color and label
 */
export function classifyRiskLevel(count) {
    if (count > 2) {
        return {
            color: '#ef4444',
            label: '⚠️ Action needed',
            severity: 'action'
        };
    } else if (count > 0) {
        return {
            color: '#fb923c',
            label: 'Monitor closely',
            severity: 'monitor'
        };
    } else {
        return {
            color: '#22c55e',
            label: '✓ Squad stable',
            severity: 'stable'
        };
    }
}

/**
 * Classify minutes percentage
 * @param {number} avgMinPercent - Average minutes percentage
 * @returns {Object} Classification with color and label
 */
export function classifyMinutesPercentage(avgMinPercent) {
    if (avgMinPercent >= 70) {
        return {
            color: '#22c55e',
            label: '✓ Regular starters',
            severity: 'regular'
        };
    } else if (avgMinPercent >= 50) {
        return {
            color: '#fb923c',
            label: 'Mixed rotation',
            severity: 'mixed'
        };
    } else {
        return {
            color: '#ef4444',
            label: '⚠️ High rotation risk',
            severity: 'high-rotation'
        };
    }
}

/**
 * Classify ownership level
 * @param {number} avgOwnership - Average ownership percentage
 * @returns {Object} Classification with color and label
 */
export function classifyOwnership(avgOwnership) {
    if (avgOwnership > 50) {
        return {
            color: '#fb923c',
            label: 'Template heavy',
            isTemplate: true
        };
    } else {
        return {
            color: '#22c55e',
            label: 'Differential picks',
            isTemplate: false
        };
    }
}

/**
 * Classify bench points warning
 * @param {number} benchPoints - Bench points total
 * @returns {Object} Classification with color and label
 */
export function classifyBenchPoints(benchPoints) {
    if (benchPoints > 0) {
        return {
            color: '#ef4444',
            label: '⚠️ Points wasted',
            hasWarning: true
        };
    } else {
        return {
            color: '#22c55e',
            label: '✓ No wasted points',
            hasWarning: false
        };
    }
}
