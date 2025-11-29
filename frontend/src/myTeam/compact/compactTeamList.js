// ============================================================================
// COMPACT TEAM LIST RENDERER
// Horizontal scrolling table with comprehensive stats
// ============================================================================

import { getPlayerById, isGameweekLive, currentGW, getActiveGW } from '../../data.js';
import {
    getPositionShort,
    formatCurrency,
    escapeHtml,
    formatDecimal,
    getFormHeatmap,
    getPtsHeatmap,
    getHeatmapStyle,
    getDifficultyClass,
    calculatePPM,
    getTeamShortName
} from '../../utils.js';
import { getFixtures, getGWOpponent, getMatchStatus } from '../../fixtures.js';
import { analyzePlayerRisks } from '../../risk.js';
import { calculateStatusColor } from './compactStyleHelpers.js';
import { isWishlisted } from '../../wishlist/store.js';

/**
 * Render comprehensive team table with horizontal scroll
 * @param {Array} players - Player picks array with full player data
 * @param {number} gwNumber - Gameweek number
 * @param {boolean} isLive - Whether gameweek is live
 * @returns {string} HTML for team table
 */
export function renderCompactTeamList(players, gwNumber, isLive) {
    const starters = players.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
    const bench = players.filter(p => p.position > 11).sort((a, b) => a.position - b.position);
    // Next 5 fixtures AFTER the active GW (exclude current GW)
    const activeGW = getActiveGW();
    const next5GWs = [activeGW + 1, activeGW + 2, activeGW + 3, activeGW + 4, activeGW + 5];

    return `
        <div style="
            background: var(--bg-secondary);
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 0.5rem;
        ">
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <table style="width: 100%; font-size: 0.7rem; border-collapse: collapse;">
                    <thead style="background: var(--bg-tertiary);">
                        <tr>
                            <th style="position: sticky; left: 0; background: var(--bg-tertiary); z-index: 10; text-align: left; padding: 0.5rem; min-width: 140px;">Player</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Opp</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Status</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Pts</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Δ</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Defcon</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">xGI/xGC</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">PPM</th>
                            ${next5GWs.map(gw => `<th style="text-align: center; padding: 0.5rem; min-width: 60px;">GW${gw}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${renderTeamSection(starters, gwNumber, isLive, next5GWs, activeGW, 'starter')}
                        ${renderTeamSection(bench, gwNumber, isLive, next5GWs, activeGW, 'bench')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderTeamSection(players, gwNumber, isLive, next5GWs, activeGW, sectionType) {
    let html = '';

    players.forEach((pick, idx) => {
        const player = getPlayerById(pick.element);
        if (!player) return;

        // Get risk data
        const risks = analyzePlayerRisks(player);
        const hasHighRisk = risks.some(r => r.severity === 'high');
        const hasMediumRisk = risks.some(r => r.severity === 'medium');
        const hasLowRisk = risks.length > 0;

        let borderColor = '';
        if (hasHighRisk) borderColor = '#ef4444';
        else if (hasMediumRisk) borderColor = '#fb923c';
        else if (hasLowRisk) borderColor = '#eab308';

        // Current GW opponent for Opp column (use active GW, not gwNumber)
        const opponent = getGWOpponent(player.team, activeGW);

        // Calculate GW points with captain doubling (use gwNumber for points data)
        const hasGWStats = player.github_gw && player.github_gw.gw === gwNumber;
        const liveStats = player.live_stats;
        let gwPoints = liveStats?.total_points ?? (hasGWStats ? player.github_gw.total_points : (player.event_points || 0));
        const displayPoints = pick.is_captain ? (gwPoints * 2) : gwPoints;

        // Points heatmap styling
        const ptsHeatmap = getPtsHeatmap(displayPoints, 'gw_pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);

        // Form styling
        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);

        // xGI or xGC based on position
        const posType = player.element_type;
        let xMetric = 0;
        if (posType === 1 || posType === 2) { // GK or DEF
            xMetric = player.expected_goals_conceded_per_90 || 0;
        } else { // MID or FWD
            xMetric = player.expected_goal_involvements_per_90 || 0;
        }

        // Other stats
        const ppm = calculatePPM(player);
        const ownership = parseFloat(player.selected_by_percent) || 0;
        const defCon = player.github_season?.defensive_contribution_per_90 || 0;

        // Transfer momentum
        let transferDelta = 0;
        let transferColor = 'var(--text-primary)';
        if (player.github_transfers) {
            transferDelta = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
        } else if (player.transfers_in_event !== undefined && player.transfers_out_event !== undefined) {
            transferDelta = player.transfers_in_event - player.transfers_out_event;
        }
        if (transferDelta > 0) transferColor = '#22c55e';
        else if (transferDelta < 0) transferColor = '#ef4444';

        // Next 5 fixtures
        const next5Fixtures = getFixtures(player.team, 5, false);

        // Match status display with color coding
        const matchStatus = getMatchStatus(player.team, gwNumber, player);
        const statusColors = calculateStatusColor(matchStatus);

        // Row styling
        const rowBg = idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)';
        const isCaptain = pick.is_captain;
        const isViceCaptain = pick.is_vice_captain;
        const isWishlistedPlayer = isWishlisted(player.id);

        // Captain badge
        let captainBadge = '';
        if (isCaptain) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.6rem;">(C)</span>';
        if (isViceCaptain) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.6rem;">(VC)</span>';

        // Player badges (⭐ for wishlisted only - no 👤 needed since all are my players on Team page)
        const badges = [];
        if (isWishlistedPlayer) badges.push('⭐️');
        const badgeMarkup = badges.length > 0 ? ` <span style="font-size: 0.65rem;">${badges.join(' ')}</span>` : '';

        html += `
            <tr
                style="background: ${rowBg}; ${borderColor ? `border-left: 4px solid ${borderColor};` : ''}; cursor: pointer; ${pick.position === 11 ? 'border-bottom: 3px solid var(--border-color);' : ''}"
                data-player-id="${player.id}"
                class="player-row"
            >
                <td style="
                    position: sticky;
                    left: 0;
                    background: ${rowBg};
                    z-index: 5;
                    padding: 0.5rem;
                    border-right: 1px solid var(--border-color);
                    min-height: 3rem;
                ">
                    <div style="display: flex; flex-direction: column; gap: 0.1rem;">
                        <!-- Line 1: Position + Name + Captain + Badges -->
                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                            <span style="font-size: 0.6rem; color: var(--text-secondary);">${getPositionShort(player)}</span>
                            <strong style="font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(player.web_name)}</strong>${captainBadge}${badgeMarkup}
                        </div>
                        <!-- Line 2: Team • Price • Own% • Form -->
                        <div style="font-size: 0.6rem; color: var(--text-secondary); white-space: nowrap;">
                            ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)} • ${ownership.toFixed(1)}% • <span style="background: ${formStyle.background}; color: ${formStyle.color}; padding: 0.1rem 0.25rem; border-radius: 0.25rem; font-weight: 600;">${formatDecimal(player.form)}</span>
                        </div>
                        <!-- Line 3: Risk context (if any) -->
                        ${risks.length > 0 ? `<div style="font-size: 0.6rem; color: ${borderColor}; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(risks[0]?.message || 'Issue')}</div>` : `<div style="height: 0.8rem;"></div>`}
                    </div>
                </td>
                <td style="text-align: center; padding: 0.5rem;">
                    <span class="${getDifficultyClass(opponent.difficulty)}" style="display: inline-block; width: 52px; padding: 0.2rem 0.3rem; border-radius: 3px; font-weight: 600; font-size: 0.6rem; text-align: center;">
                        ${opponent.name} (${opponent.isHome ? 'H' : 'A'})
                    </span>
                </td>
                <td style="text-align: center; padding: 0.5rem; font-size: 0.6rem; font-weight: ${statusColors.statusWeight}; color: ${statusColors.statusColor}; background: ${statusColors.statusBgColor}; padding: 0.08rem 0.25rem; border-radius: 0.25rem; white-space: nowrap;">
                    ${matchStatus}
                </td>
                <td style="text-align: center; padding: 0.5rem; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; border-radius: 0.25rem;">
                    ${displayPoints}
                </td>
                <td style="text-align: center; padding: 0.5rem;">
                    <span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: ${transferDelta > 0 ? 'rgba(34, 197, 94, 0.2)' : transferDelta < 0 ? 'rgba(239, 68, 68, 0.2)' : 'transparent'}; color: ${transferColor};">
                        ${transferDelta > 0 ? '+' : ''}${(transferDelta / 1000).toFixed(0)}k
                    </span>
                </td>
                <td style="text-align: center; padding: 0.5rem; font-weight: 600;">
                    ${formatDecimal(defCon)}
                </td>
                <td style="text-align: center; padding: 0.5rem; font-weight: 600;">
                    ${formatDecimal(xMetric)}
                </td>
                <td style="text-align: center; padding: 0.5rem; font-weight: 600;">
                    ${formatDecimal(ppm)}
                </td>
                ${next5Fixtures.map(fix => {
                    const fdrClass = getDifficultyClass(fix.difficulty);
                    return `
                        <td style="text-align: center; padding: 0.5rem;">
                            <span class="${fdrClass}" style="display: inline-block; width: 52px; padding: 0.2rem 0.3rem; border-radius: 3px; font-weight: 600; font-size: 0.6rem; text-align: center;">
                                ${fix.opponent}
                            </span>
                        </td>
                    `;
                }).join('')}
                ${next5Fixtures.length < 5 ? Array(5 - next5Fixtures.length).fill('<td style="text-align: center; padding: 0.5rem;">—</td>').join('') : ''}
            </tr>
        `;
    });

    return html;
}
