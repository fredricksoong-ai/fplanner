// ============================================================================
// COMPACT TEAM LIST RENDERER
// Horizontal scrolling table with comprehensive stats
// ============================================================================

import { getPlayerById, isGameweekLive } from '../../data.js';
import {
    getPositionShort,
    formatCurrency,
    escapeHtml,
    formatDecimal,
    getFormHeatmap,
    getHeatmapStyle,
    getDifficultyClass,
    calculatePPM
} from '../../utils.js';
import { getFixtures, getGWOpponent, getMatchStatus } from '../../fixtures.js';
import { analyzePlayerRisks } from '../../risk.js';
import { calculateStatusColor } from './compactStyleHelpers.js';

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
    const next5GWs = [gwNumber + 1, gwNumber + 2, gwNumber + 3, gwNumber + 4, gwNumber + 5];

    return `
        <div style="
            background: var(--bg-secondary);
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 0.5rem;
        ">
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <table style="width: 100%; font-size: 0.7rem; border-collapse: collapse; min-width: 1000px;">
                    <thead style="background: var(--bg-tertiary);">
                        <tr>
                            <th style="position: sticky; left: 0; background: var(--bg-tertiary); z-index: 10; text-align: left; padding: 0.5rem; min-width: 100px;">Player</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 45px;">Opp</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 50px;">Status</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 35px;">Pts</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 40px;">Form</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 45px;">Price</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 55px;">Defcon</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 50px;">xGI/xGC</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 40px;">PPM</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 45px;">Own%</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 50px;">Δ</th>
                            ${next5GWs.map(gw => `<th style="text-align: center; padding: 0.5rem; min-width: 50px;">GW${gw}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${renderTeamSection(starters, gwNumber, isLive, next5GWs, 'starter')}
                        ${renderTeamSection(bench, gwNumber, isLive, next5GWs, 'bench')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderTeamSection(players, gwNumber, isLive, next5GWs, sectionType) {
    const sectionLabel = sectionType === 'starter' ? 'Starting XI' : 'Bench';
    const isBench = sectionType === 'bench';

    // Section header row
    let html = `
        <tr style="background: var(--bg-tertiary);">
            <td colspan="16" style="padding: 0.4rem 0.5rem; font-weight: 700; font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase;">
                ${sectionLabel}
            </td>
        </tr>
    `;

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

        // GW opponent and points
        const opponent = getGWOpponent(player.team, gwNumber);
        const gwPoints = player.live_stats?.total_points ?? player.event_points ?? 0;

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

        html += `
            <tr
                style="background: ${rowBg}; ${borderColor ? `border-left: 4px solid ${borderColor};` : ''}"
                data-player-id="${player.id}"
                class="player-row-interactive"
            >
                <td style="
                    position: sticky;
                    left: 0;
                    background: ${rowBg};
                    z-index: 5;
                    padding: 0.5rem;
                    border-right: 1px solid var(--border-color);
                    ${pick.position === 11 ? 'border-bottom: 3px solid var(--border-color);' : ''}
                ">
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                        <span style="font-size: 0.6rem; color: var(--text-secondary);">${getPositionShort(player)}</span>
                        <strong style="font-size: 0.7rem;">${escapeHtml(player.web_name)}</strong>
                        ${isCaptain ? '<span style="font-size: 0.6rem; margin-left: 0.2rem;">(C)</span>' : ''}
                        ${isViceCaptain ? '<span style="font-size: 0.6rem; margin-left: 0.2rem;">(V)</span>' : ''}
                    </div>
                </td>
                <td style="text-align: center; padding: 0.5rem; font-size: 0.65rem;">
                    ${opponent.opponent || '—'}
                </td>
                <td style="text-align: center; padding: 0.5rem; font-size: 0.6rem; font-weight: ${statusColors.statusWeight}; color: ${statusColors.statusColor}; background: ${statusColors.statusBgColor}; padding: 0.08rem 0.25rem; border-radius: 0.25rem; white-space: nowrap;">
                    ${matchStatus}
                </td>
                <td style="text-align: center; padding: 0.5rem; font-weight: 700;">
                    ${gwPoints}
                </td>
                <td style="text-align: center; padding: 0.5rem; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                    ${formatDecimal(player.form)}
                </td>
                <td style="text-align: center; padding: 0.5rem;">
                    ${formatCurrency(player.now_cost)}
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
                <td style="text-align: center; padding: 0.5rem; font-size: 0.65rem;">
                    ${ownership.toFixed(1)}%
                </td>
                <td style="text-align: center; padding: 0.5rem; color: ${transferColor}; font-weight: 600; font-size: 0.65rem;">
                    ${transferDelta > 0 ? '+' : ''}${(transferDelta / 1000).toFixed(0)}k
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
