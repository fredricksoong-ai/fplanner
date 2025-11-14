// ============================================================================
// UTILS MODULE
// Helper functions for formatting, calculations, and UI helpers
// ============================================================================

import { fplBootstrap, currentGW } from './data.js';

// ============================================================================
// POSITION HELPERS
// ============================================================================

/**
 * Get short position name
 * @param {Object} player - Player object
 * @returns {string} Position abbreviation (GKP, DEF, MID, FWD)
 */
export function getPositionShort(player) {
    const positions = {
        1: 'GKP',
        2: 'DEF', 
        3: 'MID',
        4: 'FWD'
    };
    return positions[player.element_type] || 'N/A';
}

/**
 * Get position type for analysis
 * @param {Object} player - Player object
 * @returns {string} Position type
 */
export function getPositionType(player) {
    return getPositionShort(player);
}

/**
 * Get full position name
 * @param {number} elementType - Position ID (1-4)
 * @returns {string} Full position name
 */
export function getPositionName(elementType) {
    const positions = {
        1: 'Goalkeeper',
        2: 'Defender',
        3: 'Midfielder',
        4: 'Forward'
    };
    return positions[elementType] || 'Unknown';
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format price in £X.Xm format
 * @param {number} price - Price in tenths (e.g., 95 = £9.5m)
 * @returns {string} Formatted price
 */
export function formatCurrency(price) {
    return `£${(price / 10).toFixed(1)}m`;
}

/**
 * Format percentage
 * @param {number} value - Percentage value
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage
 */
export function formatPercent(value, decimals = 1) {
    if (value === null || value === undefined || value === '') return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return `${num.toFixed(decimals)}%`;
}

/**
 * Format number to 1 decimal place
 * @param {number} value - Number to format
 * @returns {string} Formatted number
 */
export function formatDecimal(value) {
    if (value === null || value === undefined || value === '') return '0.0';
    const num = parseFloat(value);
    if (isNaN(num)) return '0.0';
    return num.toFixed(1);
}

/**
 * Format minutes played
 * @param {number} minutes - Total minutes
 * @param {number} gw - Current gameweek (optional)
 * @returns {string} Formatted minutes
 */
export function formatMinutes(minutes, gw = null) {
    if (!minutes) return '0';
    if (gw && gw > 0) {
        const pct = ((minutes / (gw * 90)) * 100).toFixed(0);
        return `${minutes} (${pct}%)`;
    }
    return minutes.toString();
}

// ============================================================================
// HEATMAP COLORS (for points, form, etc.)
// ============================================================================

/**
 * Get heatmap class for points
 * @param {number} points - Points value
 * @param {string} metric - Metric type ('pts', 'form', 'value')
 * @returns {string} CSS class name
 */
export function getPtsHeatmap(points, metric = 'pts') {
    if (points === null || points === undefined) return 'heat-gray';
    
    if (metric === 'pts') {
        // Total points heatmap
        if (points >= 80) return 'heat-dark-green';
        if (points >= 60) return 'heat-light-green';
        if (points >= 40) return 'heat-yellow';
        if (points >= 20) return 'heat-red';
        return 'heat-gray';
    }
    
    if (metric === 'form') {
        // Form heatmap (per game average)
        if (points >= 7) return 'heat-dark-green';
        if (points >= 5) return 'heat-light-green';
        if (points >= 3) return 'heat-yellow';
        if (points >= 1) return 'heat-red';
        return 'heat-gray';
    }
    
    if (metric === 'value') {
        // Points per million heatmap
        if (points >= 15) return 'heat-dark-green';
        if (points >= 10) return 'heat-light-green';
        if (points >= 7) return 'heat-yellow';
        if (points >= 4) return 'heat-red';
        return 'heat-gray';
    }
    
    return 'heat-gray';
}

/**
 * Get heatmap class for form
 * @param {number} form - Form value
 * @returns {string} CSS class name
 */
export function getFormHeatmap(form) {
    return getPtsHeatmap(parseFloat(form), 'form');
}

/**
 * Get heatmap style object
 * @param {string} heatClass - Heatmap class name
 * @returns {Object} Style object with background and color
 */
export function getHeatmapStyle(heatClass) {
    const styles = {
        'heat-dark-green': { background: 'var(--heat-dark-green-bg)', color: 'var(--heat-dark-green-text)' },
        'heat-light-green': { background: 'var(--heat-light-green-bg)', color: 'var(--heat-light-green-text)' },
        'heat-yellow': { background: 'var(--heat-yellow-bg)', color: 'var(--heat-yellow-text)' },
        'heat-red': { background: 'var(--heat-red-bg)', color: 'var(--heat-red-text)' },
        'heat-gray': { background: 'var(--heat-gray-bg)', color: 'var(--heat-gray-text)' }
    };
    return styles[heatClass] || styles['heat-gray'];
}

// ============================================================================
// FIXTURE DIFFICULTY HELPERS
// ============================================================================

/**
 * Get fixture difficulty class
 * @param {number} difficulty - Difficulty rating (1-5)
 * @returns {string} CSS class name
 */
export function getDifficultyClass(difficulty) {
    if (difficulty === 1) return 'fixture-diff-1'; // Dark green (easiest)
    if (difficulty === 2) return 'fixture-diff-2'; // Light green
    if (difficulty === 3) return 'fixture-diff-3'; // Gray (average)
    if (difficulty === 4) return 'fixture-diff-4'; // Light red
    if (difficulty === 5) return 'fixture-diff-5'; // Dark red (hardest)
    return 'fixture-diff-3'; // Default to average
}

/**
 * Get fixture difficulty color
 * @param {number} difficulty - Difficulty rating (1-5)
 * @returns {string} CSS color value
 */
export function getDifficultyColor(difficulty) {
    const classes = {
        1: '#14532d', // Dark green
        2: '#bbf7d0', // Light green
        3: '#d1d5db', // Gray
        4: '#fca5a5', // Light red
        5: '#991b1b'  // Dark red
    };
    return classes[difficulty] || classes[3];
}

// ============================================================================
// GAMEWEEK HELPERS
// ============================================================================

/**
 * Get current gameweek (from imported data)
 * @returns {number} Current gameweek number
 */
export function getCurrentGW() {
    return currentGW || 1;
}

/**
 * Get fixture headers for a range of gameweeks
 * @param {number} count - Number of headers to generate
 * @param {number} startOffset - Offset from current GW (0 = current, 1 = next)
 * @returns {Array<string>} Array of header strings (e.g., ["GW12", "GW13"])
 */
export function getFixtureHeaders(count = 5, startOffset = 0) {
    const headers = [];
    const startGW = getCurrentGW() + startOffset;
    
    for (let i = 0; i < count; i++) {
        const gw = startGW + i;
        if (gw <= 38) { // Max 38 gameweeks
            headers.push(`GW${gw}`);
        }
    }
    
    return headers;
}

/**
 * Get past gameweek headers
 * @param {number} count - Number of past gameweeks
 * @returns {Array<string>} Array of past GW headers
 */
export function getPastGWHeaders(count = 3) {
    const headers = [];
    const gw = getCurrentGW();
    
    for (let i = count; i >= 1; i--) {
        const pastGW = gw - i;
        if (pastGW > 0) {
            headers.push(`GW${pastGW}`);
        }
    }
    
    return headers;
}

// ============================================================================
// TEAM HELPERS
// ============================================================================

/**
 * Get team short name by ID
 * @param {number} teamId - Team ID
 * @returns {string} Team short name
 */
export function getTeamShortName(teamId) {
    if (!fplBootstrap) return 'N/A';
    const team = fplBootstrap.teams.find(t => t.id === teamId);
    return team ? team.short_name : 'N/A';
}

/**
 * Get team name by ID
 * @param {number} teamId - Team ID
 * @returns {string} Full team name
 */
export function getTeamName(teamId) {
    if (!fplBootstrap) return 'N/A';
    const team = fplBootstrap.teams.find(t => t.id === teamId);
    return team ? team.name : 'N/A';
}

/**
 * Get team by code
 * @param {number} teamCode - Team code
 * @returns {Object|null} Team object
 */
export function getTeamByCode(teamCode) {
    if (!fplBootstrap) return null;
    return fplBootstrap.teams.find(t => t.code === teamCode);
}

// ============================================================================
// PLAYER STATS HELPERS
// ============================================================================

/**
 * Calculate points per million
 * @param {Object} player - Player object
 * @returns {number} Points per million value
 */
export function calculatePPM(player) {
    if (!player.now_cost || player.now_cost === 0) return 0;
    return (player.total_points || 0) / (player.now_cost / 10);
}

/**
 * Calculate points per 90 minutes
 * @param {Object} player - Player object
 * @returns {number} Points per 90
 */
export function calculatePP90(player) {
    if (!player.minutes || player.minutes === 0) return 0;
    return ((player.total_points || 0) / player.minutes) * 90;
}

/**
 * Calculate minutes percentage
 * @param {Object} player - Player object
 * @param {number} gw - Current gameweek
 * @returns {number} Minutes percentage
 */
export function calculateMinutesPercentage(player, gw = null) {
    const currentGw = gw || getCurrentGW();
    if (currentGw === 0) return 0;
    return ((player.minutes || 0) / (currentGw * 90)) * 100;
}

/**
 * Get player form trend
 * @param {Object} player - Player object
 * @returns {string} Trend indicator ('up', 'down', 'stable')
 */
export function getFormTrend(player) {
    const form = parseFloat(player.form) || 0;
    const avgPoints = (player.total_points || 0) / getCurrentGW();
    
    if (form > avgPoints * 1.2) return 'up';
    if (form < avgPoints * 0.8) return 'down';
    return 'stable';
}

// ============================================================================
// SORTING HELPERS
// ============================================================================

/**
 * Sort players by a specific metric
 * @param {Array} players - Array of players
 * @param {string} metric - Metric to sort by
 * @param {boolean} ascending - Sort order
 * @returns {Array} Sorted players array
 */
export function sortPlayers(players, metric = 'total_points', ascending = false) {
    const sorted = [...players].sort((a, b) => {
        let aVal = a[metric];
        let bVal = b[metric];
        
        // Handle null/undefined
        if (aVal === null || aVal === undefined) aVal = -Infinity;
        if (bVal === null || bVal === undefined) bVal = -Infinity;
        
        return ascending ? aVal - bVal : bVal - aVal;
    });
    
    return sorted;
}

/**
 * Filter players by position
 * @param {Array} players - Array of players
 * @param {number} positionId - Position ID (1-4)
 * @returns {Array} Filtered players
 */
export function filterByPosition(players, positionId) {
    return players.filter(p => p.element_type === positionId);
}

/**
 * Filter players by team
 * @param {Array} players - Array of players
 * @param {number} teamId - Team ID
 * @returns {Array} Filtered players
 */
export function filterByTeam(players, teamId) {
    return players.filter(p => p.team === teamId);
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Debounce function for search/input
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show loading spinner
 * @param {string} containerId - Container element ID
 * @param {string} message - Loading message
 */
export function showLoading(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

/**
 * Show error message
 * @param {string} containerId - Container element ID
 * @param {string} message - Error message
 */
export function showError(containerId, message = 'An error occurred') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--danger-color);">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p style="font-weight: 600; margin-bottom: 0.5rem;">Error</p>
            <p style="color: var(--text-secondary);">${escapeHtml(message)}</p>
        </div>
    `;
}