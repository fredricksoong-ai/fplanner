// ============================================================================
// DATA ANALYSIS FILTER HELPERS
// Filter functions for player data filtering
// ============================================================================

import { getAllPlayers, currentGW } from '../data.js';
import { calculateMinutesPercentage } from '../utils.js';
import { calculateFixtureDifficulty } from '../fixtures.js';

// ============================================================================
// POSITION MAPPING
// ============================================================================

const POSITION_TYPE_MAP = {
    'GKP': 1,
    'DEF': 2,
    'MID': 3,
    'FWD': 4
};

// ============================================================================
// BASIC FILTERS
// ============================================================================

/**
 * Filter players by position
 * @param {Array} players - All players
 * @param {string} position - 'GKP', 'DEF', 'MID', 'FWD', or 'all'
 * @returns {Array} Filtered players
 */
export function filterByPosition(players, position) {
    if (position === 'all') return players;

    const positionType = POSITION_TYPE_MAP[position.toUpperCase()];
    if (!positionType) return players;

    return players.filter(p => p.element_type === positionType);
}

/**
 * Filter players by ownership threshold
 * @param {Array} players - Players to filter
 * @param {number} threshold - Max ownership percentage (e.g., 15 for 15%)
 * @returns {Array} Filtered players
 */
export function filterByOwnership(players, threshold) {
    return players.filter(p => {
        const ownership = parseFloat(p.selected_by_percent) || 0;
        return ownership < threshold;
    });
}

/**
 * Filter players by price range
 * @param {Array} players - Players to filter
 * @param {string} range - 'all', 'budget' (<6m), 'mid' (6-9m), or 'premium' (>9m)
 * @returns {Array} Filtered players
 */
export function filterByPriceRange(players, range) {
    if (range === 'all') return players;

    return players.filter(p => {
        const price = p.now_cost / 10; // Convert to millions

        switch (range) {
            case 'budget':
                return price < 6.0;
            case 'mid':
                return price >= 6.0 && price < 9.0;
            case 'premium':
                return price >= 9.0;
            default:
                return true;
        }
    });
}

/**
 * Filter players by fixture difficulty
 * @param {Array} players - Players to filter
 * @param {number} maxFDR - Maximum FDR (e.g., 3.0 for good fixtures)
 * @param {number} gameweeks - Number of gameweeks to look ahead (default: 5)
 * @returns {Array} Filtered players
 */
export function filterByFixtureDifficulty(players, maxFDR, gameweeks = 5) {
    return players.filter(p => {
        const fdr = calculateFixtureDifficulty(p.team, gameweeks);
        return fdr <= maxFDR;
    });
}

/**
 * Filter players by transfer momentum
 * @param {Array} players - Players to filter
 * @param {boolean} positiveOnly - If true, only include players with net positive transfers
 * @returns {Array} Filtered players
 */
export function filterByMomentum(players, positiveOnly = true) {
    if (!positiveOnly) return players;

    return players.filter(p => {
        if (!p.github_transfers) return false;
        const netTransfers = p.github_transfers.transfers_in - p.github_transfers.transfers_out;
        return netTransfers > 0;
    });
}

// ============================================================================
// POSITION-SPECIFIC FILTERS
// ============================================================================

/**
 * Apply position-specific threshold filters
 * @param {Array} players - Players to filter
 * @param {string} position - Position type
 * @returns {Array} Filtered players
 */
export function filterByPositionThresholds(players, position) {
    return players.filter(p => {
        const minPercentage = calculateMinutesPercentage(p, currentGW);
        const posType = p.element_type;

        // Goalkeeper thresholds
        if (position === 'GKP' || posType === 1) {
            // Need decent minutes OR significant saves
            if (minPercentage <= 50 && (p.saves || 0) <= 20) {
                return false;
            }
        }
        // Defender thresholds
        else if (position === 'DEF' || posType === 2) {
            // Need decent minutes OR good defensive contribution
            if (minPercentage <= 40 &&
                (!p.github_season || p.github_season.defensive_contribution_per_90 <= 3.0)) {
                return false;
            }
        }
        // Midfielder/Forward thresholds
        else {
            // Need decent minutes AND decent form
            if (minPercentage <= 30 || parseFloat(p.form) <= 3) {
                return false;
            }
        }

        return true;
    });
}

// ============================================================================
// COMPOUND FILTERS
// ============================================================================

/**
 * Apply differential filters (low ownership with quality thresholds)
 * @param {Object} filterState - Filter state object
 * @param {string} position - Position to filter
 * @returns {Array} Filtered players
 */
export function applyDifferentialFilters(filterState, position) {
    let players = getAllPlayers();

    // Position filter
    players = filterByPosition(players, position);

    // Ownership threshold
    if (filterState.ownershipThreshold) {
        players = filterByOwnership(players, filterState.ownershipThreshold);
    }

    // Price range
    if (filterState.priceRange && filterState.priceRange !== 'all') {
        players = filterByPriceRange(players, filterState.priceRange);
    }

    // Position-specific thresholds
    players = filterByPositionThresholds(players, position);

    // Fixture filter
    if (filterState.fixtureFilter) {
        players = filterByFixtureDifficulty(players, 3.0, 5);
    }

    // Momentum filter
    if (filterState.momentumFilter) {
        players = filterByMomentum(players, true);
    }

    return players;
}

/**
 * Get default filter state for differentials tab
 * @returns {Object} Default filter state
 */
export function getDefaultFilterState() {
    return {
        ownershipThreshold: 15,
        priceRange: 'all',
        fixtureFilter: false,
        momentumFilter: false
    };
}

/**
 * Validate and sanitize filter state
 * @param {Object} state - Filter state to validate
 * @returns {Object} Validated state
 */
export function validateFilterState(state) {
    const defaults = getDefaultFilterState();

    return {
        ownershipThreshold: Math.max(1, Math.min(100, state.ownershipThreshold || defaults.ownershipThreshold)),
        priceRange: ['all', 'budget', 'mid', 'premium'].includes(state.priceRange)
            ? state.priceRange
            : defaults.priceRange,
        fixtureFilter: Boolean(state.fixtureFilter),
        momentumFilter: Boolean(state.momentumFilter)
    };
}
