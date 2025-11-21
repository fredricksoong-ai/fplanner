// ============================================================================
// COMPACT PLAYER ROW RENDERER
// Individual player row rendering for mobile compact view
// ============================================================================

import {
    formatDecimal,
    getPtsHeatmap,
    getFormHeatmap,
    getHeatmapStyle,
    escapeHtml
} from '../../utils.js';
import { getGWOpponent, getMatchStatus } from '../../fixtures.js';
import { analyzePlayerRisks, renderRiskTooltip } from '../../risk.js';
import {
    renderOpponentBadge,
    calculateStatusColor,
    calculatePlayerBgColor
} from './compactStyleHelpers.js';

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

    let captainBadge = '';
    if (isCaptain) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.7rem;">(C)</span>';
    if (isVice) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.7rem;">(VC)</span>';

    const gwOpp = getGWOpponent(player.team, gwNumber);
    const risks = analyzePlayerRisks(player);
    const riskTooltip = renderRiskTooltip(risks);

    // Get match status display with color coding
    const matchStatus = getMatchStatus(player.team, gwNumber, player);
    const statusColors = calculateStatusColor(matchStatus);

    // Get GW-specific stats - prioritize live_stats from enriched bootstrap
    const hasGWStats = player.github_gw && player.github_gw.gw === gwNumber;
    const liveStats = player.live_stats;
    const gwPoints = liveStats?.total_points ??
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
    if (player.news && player.news.trim() !== '') {
        const chanceOfPlaying = player.chance_of_playing_next_round;
        if (chanceOfPlaying !== null && chanceOfPlaying !== undefined) {
            if (chanceOfPlaying <= 25) {
                leftBorderStyle = '3px solid #ef4444'; // Red
            } else if (chanceOfPlaying <= 50) {
                leftBorderStyle = '3px solid #f97316'; // Orange
            } else {
                leftBorderStyle = '3px solid #fbbf24'; // Yellow
            }
        } else {
            leftBorderStyle = '3px solid #fbbf24'; // Yellow default for news
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
            <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(player.web_name)}${captainBadge}
                ${riskTooltip ? `${riskTooltip}` : ''}
            </div>
            <div style="text-align: center;">
                ${renderOpponentBadge(gwOpp, 'small')}
            </div>
            <div style="text-align: center; font-size: 0.6rem; font-weight: ${statusColors.statusWeight}; color: ${statusColors.statusColor}; background: ${statusColors.statusBgColor}; padding: 0.08rem 0.25rem; border-radius: 0.25rem;">${matchStatus}</div>
            <div style="text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${displayPoints}</div>
            <div style="text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${formatDecimal(player.form)}</div>
        </div>
    `;
}
