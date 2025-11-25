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
 * @param {number} teamId - Team ID for caching
 * @param {number} overallRankNum - Current overall rank
 * @returns {Object} Chevron icon and color for rank display
 */
export function calculateRankIndicator(teamId, overallRankNum) {
    const cacheKey = `fpl_rank_${teamId}`;
    const cachedRank = localStorage.getItem(cacheKey);
    let chevron = '▬';
    let color = '#eab308'; // Yellow for no change

    if (cachedRank && overallRankNum > 0) {
        const previousRank = parseInt(cachedRank, 10);
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

    // Store current rank for next comparison
    if (overallRankNum > 0) {
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
