/**
 * Team Table Rendering Module
 * Displays squad with detailed player statistics
 */

import { getPlayerById } from '../data.js';
import {
    getPositionShort,
    getPositionType,
    formatCurrency,
    formatDecimal,
    getPtsHeatmap,
    getFormHeatmap,
    getHeatmapStyle,
    getDifficultyClass,
    getTeamShortName,
    calculatePPM,
    escapeHtml
} from '../utils.js';

import {
    getFixtures,
    getGWOpponent
} from '../fixtures.js';

import {
    analyzePlayerRisks,
    hasHighRisk,
    renderRiskTooltip
} from '../risk.js';

/**
 * Render team table with player statistics
 * @param {Array} players - Player picks
 * @param {number} gameweek - Current gameweek
 * @returns {string} HTML for team table
 */
export function renderTeamTable(players, gameweek) {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }

    // Separate starters and bench
    const starters = players.filter(p => p.position <= 11);
    const bench = players.filter(p => p.position > 11);

    // Next 5 gameweeks for fixture columns
    const next5GWs = [gameweek + 1, gameweek + 2, gameweek + 3, gameweek + 4, gameweek + 5];

    let html = `
        <div style="overflow-x: auto; background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead style="background: var(--primary-color); color: white;">
                    <tr>
                        <th style="text-align: left; padding: 0.75rem 0.5rem; white-space: nowrap;">Pos</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Opp</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Min</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">DefCon/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">xGI/xGC</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[0]}</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[1]}</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[2]}</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[3]}</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[4]}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Render starting 11
    html += renderTeamRows(starters, gameweek, next5GWs);

    // Dark purple separator line between starters and bench
    html += `<tr><td colspan="18" style="padding: 0; background: linear-gradient(90deg, #37003c, #2a002e); height: 3px;"></td></tr>`;

    // Render bench
    html += renderTeamRows(bench, gameweek, next5GWs);

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

/**
 * Render table rows for players
 * @param {Array} players - Player picks
 * @param {number} gameweek - Current gameweek
 * @param {Array} next5GWs - Next 5 gameweeks array
 * @returns {string} HTML for table rows
 */
function renderTeamRows(players, gameweek, next5GWs) {
    let html = '';

    players.forEach((pick, index) => {
        const player = getPlayerById(pick.element);
        if (!player) return;

        const rowBg = index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';
        const isCaptain = pick.is_captain;
        const isVice = pick.is_vice_captain;

        let captainBadge = '';
        if (isCaptain) captainBadge = ' <span style="color: var(--primary-color); font-weight: 700;">(C)</span>';
        if (isVice) captainBadge = ' <span style="color: var(--text-secondary); font-weight: 700;">(VC)</span>';

        const gwOpp = getGWOpponent(player.team, gameweek);
        const posType = getPositionType(player);
        const risks = analyzePlayerRisks(player);
        const riskTooltip = renderRiskTooltip(risks);
        const hasHighSeverity = hasHighRisk(risks);

        // Get GW-specific stats from GitHub (only if matches current GW)
        const hasGWStats = player.github_gw && player.github_gw.gw === gameweek;
        const liveStats = player.live_stats;

        // Minutes: use live_stats if available, then GitHub, otherwise dash
        const gwMinutes = liveStats?.minutes ??
                         (hasGWStats ? player.github_gw.minutes : '—');

        // Points: prioritize live_stats during live GW
        const gwPoints = liveStats?.total_points ??
                        (hasGWStats ? player.github_gw.total_points : (player.event_points || 0));

        // Use GW points for heatmap (not season total)
        const ptsHeatmap = getPtsHeatmap(gwPoints, 'gw_pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);

        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);

        // Get next 5 fixtures for this player
        const next5Fixtures = getFixtures(player.team, 5, false);

        // Position-specific xGI/xGC
        let metricValue = '';
        if (posType === 'GKP' || posType === 'DEF') {
            const xGC = player.expected_goals_conceded_per_90 || 0;
            metricValue = formatDecimal(xGC);
        } else {
            const xGI = player.expected_goal_involvements_per_90 || 0;
            metricValue = formatDecimal(xGI);
        }

        // Defensive contribution per 90
        const defCon = player.github_season?.defensive_contribution_per_90 || 0;
        const defConFormatted = formatDecimal(defCon);

        // Calculate additional metrics
        const ppm = calculatePPM(player);
        const ownership = parseFloat(player.selected_by_percent) || 0;

        // Transfer momentum: Use GitHub or FPL API data
        let transferNet = '—';
        let transferColor = 'inherit';
        if (player.github_transfers) {
            const netTransfers = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
            const prefix = netTransfers > 0 ? '+' : '';
            transferNet = `${prefix}${(netTransfers / 1000).toFixed(0)}k`;
            transferColor = netTransfers > 0 ? '#22c55e' : netTransfers < 0 ? '#ef4444' : 'inherit';
        } else if (player.transfers_in_event !== undefined && player.transfers_out_event !== undefined) {
            const netTransfers = player.transfers_in_event - player.transfers_out_event;
            const prefix = netTransfers > 0 ? '+' : '';
            transferNet = `${prefix}${(netTransfers / 1000).toFixed(0)}k`;
            transferColor = netTransfers > 0 ? '#22c55e' : netTransfers < 0 ? '#ef4444' : 'inherit';
        }

        html += `
            <tr style="background: ${hasHighSeverity ? 'rgba(220, 38, 38, 0.05)' : rowBg};">
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">${getPositionShort(player)}</td>
                <td style="padding: 0.75rem 0.5rem;">
                    <strong>${escapeHtml(player.web_name)}</strong>${captainBadge}
                    ${riskTooltip ? `${riskTooltip}` : ''}
                </td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">
                    <span class="${getDifficultyClass(gwOpp.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; min-width: 5rem; display: inline-block; text-align: center;">
                        ${gwOpp.name}${gwOpp.isHome ? ' (H)' : ' (A)'}
                    </span>
                </td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">
                    ${gwMinutes}
                </td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">
                    ${gwPoints}
                </td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                    ${formatDecimal(player.form)}
                </td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${defConFormatted}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${metricValue}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                ${next5Fixtures.map((fix, idx) => {
                    const fdrClass = getDifficultyClass(fix.difficulty);
                    return `
                        <td style="padding: 0.75rem 0.5rem; text-align: center;">
                            <span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; white-space: nowrap;">
                                ${fix.opponent}
                            </span>
                        </td>
                    `;
                }).join('')}
                ${next5Fixtures.length < 5 ? Array(5 - next5Fixtures.length).fill('<td style="padding: 0.75rem 0.5rem; text-align: center;">—</td>').join('') : ''}
            </tr>
        `;
    });

    return html;
}
