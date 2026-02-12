// ============================================================================
// COMPACT STYLE HELPERS
// Reusable styling components for mobile compact view
// ============================================================================

import { getDifficultyClass } from '../../utils.js';

/**
 * Render opponent badge with difficulty styling
 * @param {Object} opponent - Opponent object from getGWOpponent
 * @param {string} size - 'small' or 'normal' (default)
 * @returns {string} HTML for opponent badge
 */
export function renderOpponentBadge(opponent, size = 'normal') {
    const fontSize = size === 'small' ? '0.6rem' : '0.62rem';
    const fontWeight = size === 'small' ? '700' : '600';

    return `<span class="${getDifficultyClass(opponent.difficulty)}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: ${fontWeight}; font-size: ${fontSize}; min-width: 3rem; display: inline-block; text-align: center;">${opponent.name} (${opponent.isHome ? 'H' : 'A'})</span>`;
}

/**
 * Render one or more opponent badges (handles DGW with stacked display)
 * @param {OpponentInfo[]} opponents - Array from getGWOpponents()
 * @param {string} size - 'small' or 'normal'
 * @returns {string} HTML - single badge for SGW, vertically stacked for DGW
 */
export function renderOpponentBadges(opponents, size = 'normal') {
    if (!opponents || opponents.length === 0) {
        return renderOpponentBadge({ name: 'TBD', difficulty: 3, isHome: false }, size);
    }
    if (opponents.length === 1) {
        return renderOpponentBadge(opponents[0], size);
    }
    return `<div style="display: flex; flex-direction: column; gap: 1px; align-items: center;">
        ${opponents.map(opp => renderOpponentBadge(opp, size)).join('')}
    </div>`;
}

/**
 * Render one or more match status badges (handles DGW with stacked display)
 * @param {string[]} statuses - Array of status strings from getMatchStatuses()
 * @param {Function} calculateStatusColorFn - The calculateStatusColor function
 * @returns {string} HTML - single badge for SGW, vertically stacked for DGW
 */
export function renderStatusBadges(statuses, calculateStatusColorFn) {
    if (!statuses || statuses.length === 0) return '';
    if (statuses.length === 1) {
        const colors = calculateStatusColorFn(statuses[0]);
        return `<span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: ${colors.statusBgColor}; color: ${colors.statusColor}; white-space: nowrap;">${statuses[0]}</span>`;
    }
    return `<div style="display: flex; flex-direction: column; gap: 1px; align-items: center;">
        ${statuses.map(status => {
            const colors = calculateStatusColorFn(status);
            return `<span style="display: inline-block; padding: 0.15rem 0.3rem; border-radius: 3px; font-weight: 600; font-size: 0.55rem; background: ${colors.statusBgColor}; color: ${colors.statusColor}; white-space: nowrap;">${status}</span>`;
        }).join('')}
    </div>`;
}

/**
 * Render stat card for modal
 * @param {string|number} value - Stat value
 * @param {string} label - Stat label
 * @returns {string} HTML for stat card
 */
export function renderStatCard(value, label) {
    return `
        <div style="
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 0.75rem;
            text-align: center;
        ">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                ${value}
            </div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.2rem;">
                ${label}
            </div>
        </div>
    `;
}

/**
 * Calculate rank indicator (chevron) based on rank change
 * @param {number} teamId - Team ID for caching (fallback only)
 * @param {number} overallRankNum - Current overall rank
 * @param {number|null} previousGWRank - Previous GW overall rank from history (optional, preferred)
 * @returns {Object} Chevron icon and color for rank display
 */
export function calculateRankIndicator(teamId, overallRankNum, previousGWRank = null) {
    let chevron = '▬';
    let color = '#eab308'; // Yellow for no change

    // Use previous_gw_rank from history if available (most accurate)
    // Otherwise fall back to localStorage for backward compatibility
    let previousRank = null;
    
    if (previousGWRank !== null && previousGWRank > 0) {
        previousRank = previousGWRank;
    } else {
        // Fallback to localStorage cache
        const cacheKey = `fpl_rank_${teamId}`;
        const cachedRank = localStorage.getItem(cacheKey);
        if (cachedRank) {
            previousRank = parseInt(cachedRank, 10);
        }
    }

    if (previousRank && overallRankNum > 0) {
        const rankChange = previousRank - overallRankNum;

        if (rankChange > 0) {
            // Rank improved (number went down)
            chevron = '▲';
            color = '#22c55e'; // Green
        } else if (rankChange < 0) {
            // Rank worsened (number went up)
            chevron = '▼';
            color = '#ef4444'; // Red
        }
    }

    // Store current rank in localStorage for next comparison (fallback)
    if (overallRankNum > 0) {
        const cacheKey = `fpl_rank_${teamId}`;
        localStorage.setItem(cacheKey, overallRankNum.toString());
    }

    return { chevron, color };
}

// Keep old function for backward compatibility
export function calculateRankColor(teamId, overallRankNum) {
    return calculateRankIndicator(teamId, overallRankNum).color;
}

/**
 * Calculate GW rank indicator (chevron) based on performance
 * @param {number} gwRankNum - GW rank
 * @param {number} overallRankNum - Overall rank
 * @returns {Object} Chevron icon and color for GW display
 */
export function calculateGWIndicator(gwRankNum, overallRankNum) {
    let chevron = '▬';
    let color = '#eab308'; // Yellow for on par

    if (overallRankNum > 0 && gwRankNum > 0) {
        const rankRatio = gwRankNum / overallRankNum;

        if (rankRatio <= 0.5) {
            // Exceptional: GW rank is 50% or better than overall rank
            chevron = '▲▲';
            color = '#9333ea'; // Purple
        } else if (rankRatio < 1.0) {
            // Outperforming: GW rank is better than overall rank
            chevron = '▲';
            color = '#22c55e'; // Green
        } else if (rankRatio <= 1.2) {
            // On par: Within 20% of overall rank
            chevron = '▬';
            color = '#eab308'; // Yellow
        } else {
            // Underperforming: Worse than 20% of overall rank
            chevron = '▼';
            color = '#ef4444'; // Red
        }
    }

    return { chevron, color };
}

// Keep old function for backward compatibility
export function calculateGWTextColor(gwRankNum, overallRankNum) {
    return calculateGWIndicator(gwRankNum, overallRankNum).color;
}

/**
 * Calculate status color for match status display
 * @param {string} matchStatus - Match status string
 * @returns {Object} Color styling for status
 */
export function calculateStatusColor(matchStatus) {
    const isLive = matchStatus.startsWith('LIVE');
    const isFinished = matchStatus.startsWith('FT');

    // Use same heat-* variables as Form/Pts columns for consistency
    let statusColor = 'var(--text-secondary)';
    let statusBgColor = 'transparent';
    let statusWeight = '400';

    if (isFinished && matchStatus.includes('(')) {
        // Extract minutes from "FT (90)" format
        const minsMatch = matchStatus.match(/\((\d+)\)/);
        if (minsMatch) {
            const mins = parseInt(minsMatch[1]);
            statusWeight = '700';
            if (mins >= 90) {
                statusColor = 'var(--heat-dark-green-text)';
                statusBgColor = 'var(--heat-dark-green-bg)';
            } else if (mins >= 60) {
                statusColor = 'var(--heat-yellow-text)';
                statusBgColor = 'var(--heat-yellow-bg)';
            } else {
                statusColor = 'var(--heat-red-text)';
                statusBgColor = 'var(--heat-red-bg)';
            }
        } else {
            statusColor = 'var(--heat-light-green-text)';
            statusBgColor = 'var(--heat-light-green-bg)';
            statusWeight = '700';
        }
    } else if (isLive) {
        statusColor = '#ef4444';
        statusWeight = '700';
    }

    return { statusColor, statusBgColor, statusWeight };
}

/**
 * Calculate player row background color
 * @param {boolean} isCaptain - Is captain
 * @param {boolean} isVice - Is vice captain
 * @param {boolean} isBench - Is on bench
 * @returns {string} Background color
 */
export function calculatePlayerBgColor(isCaptain, isVice, isBench) {
    // Background color - captain/vice get purple highlights, no bench highlight
    let bgColor = 'var(--bg-primary)';
    if (isCaptain && !isBench) {
        bgColor = 'rgb(104, 98, 132)';
    } else if (isVice && !isBench) {
        bgColor = 'rgb(104, 98, 132)';
    }
    return bgColor;
}
