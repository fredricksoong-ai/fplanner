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
import { getGWOpponent, getMatchStatus } from '../../fixtures.js';
import { analyzePlayerRisks, renderRiskTooltip } from '../../risk.js';
import {
    renderOpponentBadge,
    calculateStatusColor,
    calculatePlayerBgColor
} from './compactStyleHelpers.js';
import { isWishlisted } from '../../wishlist/store.js';

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

    let captainBadge = '';
    if (isCaptain) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.7rem;">(C)</span>';
    if (isVice) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.7rem;">(VC)</span>';

    // Player badges (⭐ for wishlisted only - no 👤 needed since all are my players on Team page)
    const badges = [];
    if (isWishlistedPlayer) badges.push('⭐️');
    const badgeMarkup = badges.length > 0 ? ` <span style="font-size: 0.65rem;">${badges.join(' ')}</span>` : '';

    const gwOpp = getGWOpponent(player.team, gwNumber);
    const risks = analyzePlayerRisks(player);
    const riskTooltip = renderRiskTooltip(risks);

    // Get match status display with color coding
    const matchStatus = getMatchStatus(player.team, gwNumber, player);
    const statusColors = calculateStatusColor(matchStatus);

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

    // Colored left border for players with news/injury
    let leftBorderStyle = 'none';
    let riskContextMessage = '';
    let riskContextColor = '';

    if (player.news && player.news.trim() !== '') {
        const chanceOfPlaying = player.chance_of_playing_next_round;
        if (chanceOfPlaying !== null && chanceOfPlaying !== undefined) {
            if (chanceOfPlaying <= 25) {
                leftBorderStyle = '3px solid #ef4444'; // Red
                riskContextColor = '#ef4444';
                riskContextMessage = `${chanceOfPlaying}% chance: ${player.news}`;
            } else if (chanceOfPlaying <= 50) {
                leftBorderStyle = '3px solid #f97316'; // Orange
                riskContextColor = '#f97316';
                riskContextMessage = `${chanceOfPlaying}% chance: ${player.news}`;
            } else {
                leftBorderStyle = '3px solid #fbbf24'; // Yellow
                riskContextColor = '#fbbf24';
                riskContextMessage = `${chanceOfPlaying}% chance: ${player.news}`;
            }
        } else {
            leftBorderStyle = '3px solid #fbbf24'; // Yellow default for news
            riskContextColor = '#fbbf24';
            riskContextMessage = player.news;
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
                    ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)} • ${(parseFloat(player.selected_by_percent) || 0).toFixed(1)}% • <span style="background: ${formStyle.background}; color: ${formStyle.color}; padding: 0.1rem 0.25rem; border-radius: 0.25rem; font-weight: 600;">${formatDecimal(player.form)}</span>
                </div>
                <!-- Line 3: Risk context (if any) -->
                ${riskContextMessage ? `<div style="font-size: 0.6rem; color: ${riskContextColor}; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(riskContextMessage)}</div>` : '<div style="height: 0.8rem;"></div>'}
            </div>
            <div style="text-align: center;">
                ${renderOpponentBadge(gwOpp, 'small')}
            </div>
            <div style="text-align: center; font-size: 0.6rem; font-weight: ${statusColors.statusWeight}; color: ${statusColors.statusColor}; background: ${statusColors.statusBgColor}; padding: 0.08rem 0.25rem; border-radius: 0.25rem; white-space: nowrap;">${matchStatus}</div>
            <div style="text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${displayPoints}</div>
        </div>
    `;
}
