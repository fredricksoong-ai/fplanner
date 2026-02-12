// ============================================================================
// COMPACT PLAYER ROW RENDERER
// Individual player row rendering for mobile compact view
// ============================================================================

import {
    formatDecimal,
    getPtsHeatmap,
    getFormHeatmap,
    getHeatmapStyle,
    escapeHtml,
    getTeamShortName,
    formatCurrency,
    getPositionShort
} from '../../utils.js';
import { getGWOpponents, getMatchStatuses } from '../../fixtures.js';
import {
    renderOpponentBadges,
    renderStatusBadges,
    calculateStatusColor,
    calculatePlayerBgColor
} from './compactStyleHelpers.js';
import { isWishlisted } from '../../wishlist/store.js';
import { isGuillotined } from '../../guillotine/store.js';

/**
 * Render compact player row with ownership and transfer momentum
 * @param {Object} pick - Player pick object
 * @param {Object} player - Full player object
 * @param {number} gwNumber - Gameweek number
 * @returns {string} HTML for player row
 */
export function renderCompactPlayerRow(pick, player, gwNumber) {
    const isCaptain = pick.is_captain;
    const isVice = pick.is_vice_captain;
    const isBench = pick.position > 11;
    const isMyPlayer = true; // Always true for My Team page
    const isWishlistedPlayer = isWishlisted(player.id);
    const isGuillotinedPlayer = isGuillotined(player.id);

    let captainBadge = '';
    if (isCaptain) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.7rem;">(C)</span>';
    if (isVice) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.7rem;">(VC)</span>';

    // Player badges (⭐ for wishlisted, 🔪 for guillotined - no 👤 needed since all are my players on Team page)
    const badges = [];
    if (isWishlistedPlayer) badges.push('⭐️');
    if (isGuillotinedPlayer) badges.push('🔪');
    const badgeMarkup = badges.length > 0 ? ` <span style="font-size: 0.65rem;">${badges.join(' ')}</span>` : '';

    const gwOpps = getGWOpponents(player.team, gwNumber);

    // Get match status display with color coding (DGW-aware)
    const matchStatuses = getMatchStatuses(player.team, gwNumber, player);

    // Get GW-specific stats - prioritize live_stats from enriched bootstrap
    const hasGWStats = player.github_gw && player.github_gw.gw === gwNumber;
    const liveStats = player.live_stats;

    // Calculate GW points from live stats or fallback sources
    let gwPoints = liveStats?.total_points ??
                   (hasGWStats ? player.github_gw.total_points : (player.event_points || 0));

    const displayPoints = isCaptain ? (gwPoints * 2) : gwPoints;
    const isLive = !!liveStats;

    // Use GW points for heatmap (not season total)
    const ptsHeatmap = getPtsHeatmap(displayPoints, 'gw_pts');
    const ptsStyle = getHeatmapStyle(ptsHeatmap);

    const formHeatmap = getFormHeatmap(player.form);
    const formStyle = getHeatmapStyle(formHeatmap);

    // Background color using helper
    const bgColor = calculatePlayerBgColor(isCaptain, isVice, isBench);

    // Add thick border after row 11 (last starter)
    const borderStyle = pick.position === 11 ? '3px solid var(--border-color)' : '1px solid var(--border-color)';

    // Display FPL news with colored left border based on severity
    let leftBorderStyle = 'none';
    let riskContextMessage = '';
    let riskContextColor = '';

    if (player.news && player.news.trim() !== '') {
        // Use FPL news directly (e.g., "Suspended until 06 Dec", "Hamstring injury")
        riskContextMessage = player.news;

        // Color based on chance of playing severity
        const chanceOfPlaying = player.chance_of_playing_next_round;
        if (chanceOfPlaying !== null && chanceOfPlaying !== undefined) {
            if (chanceOfPlaying <= 25) {
                leftBorderStyle = '3px solid #ef4444'; // Red - very unlikely to play
                riskContextColor = '#ef4444';
            } else if (chanceOfPlaying <= 50) {
                leftBorderStyle = '3px solid #f97316'; // Orange - doubtful
                riskContextColor = '#f97316';
            } else {
                leftBorderStyle = '3px solid #fbbf24'; // Yellow - possible
                riskContextColor = '#fbbf24';
            }
        } else {
            // No percentage data - default to yellow
            leftBorderStyle = '3px solid #fbbf24';
            riskContextColor = '#fbbf24';
        }
    }

    return `
        <div
            class="player-row mobile-table-row mobile-table-team"
            data-player-id="${player.id}"
            style="
            background: ${bgColor};
            border-bottom: ${borderStyle};
            border-left: ${leftBorderStyle};
            cursor: pointer;
            padding-bottom: 3px !important;
            padding-top: 3px !important;
        ">
            <div style="display: flex; flex-direction: column; gap: 0.1rem;">
                <!-- Line 1: Position + Name + Captain + Badges -->
                <div style="display: flex; align-items: center; gap: 0.3rem; font-weight: 600; color: var(--text-primary);">
                    <span style="font-size: 0.6rem; color: var(--text-secondary);">${getPositionShort(player)}</span>
                    <span style="font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(player.web_name)}${captainBadge}${badgeMarkup}</span>
                </div>
                <!-- Line 2: Team • Price • Own% • Form -->
                <div style="font-size: 0.6rem; color: var(--text-secondary); white-space: nowrap;">
                    ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)} • ${(parseFloat(player.selected_by_percent) || 0).toFixed(1)}% • <span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: ${formStyle.background}; color: ${formStyle.color};">${formatDecimal(player.form)}</span>
                </div>
                <!-- Line 3: Risk context (if any) -->
                ${riskContextMessage ? `<div style="font-size: 0.6rem; color: ${riskContextColor}; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(riskContextMessage)}</div>` : '<div style="height: 0.8rem;"></div>'}
            </div>
            <div style="text-align: center;">
                ${renderOpponentBadges(gwOpps, 'small')}
            </div>
            <div style="text-align: center; padding: 0.5rem;">
                ${renderStatusBadges(matchStatuses, calculateStatusColor)}
            </div>
            <div style="text-align: center; padding: 0.5rem;">
                <span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: ${ptsStyle.background}; color: ${ptsStyle.color};">${displayPoints}</span>
            </div>
        </div>
    `;
}
