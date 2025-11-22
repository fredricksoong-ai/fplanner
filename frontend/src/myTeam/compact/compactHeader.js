// ============================================================================
// COMPACT HEADER RENDERER
// Team info, GW points, rank, and captain/vice info for mobile view
// ============================================================================

import { getPlayerById } from '../../data.js';
import { escapeHtml } from '../../utils.js';
import { getGWOpponent } from '../../fixtures.js';
import {
    renderOpponentBadge,
    calculateRankColor,
    calculateGWTextColor
} from './compactStyleHelpers.js';

/**
 * Render ultra-compact header with team info and GW card
 * @param {Object} teamData - Team data with picks and team info
 * @param {number} gwNumber - Current gameweek number
 * @returns {string} HTML for compact header
 */
export function renderCompactHeader(teamData, gwNumber) {
    const { picks, team, isLive } = teamData;
    const entry = picks.entry_history;

    // Calculate GW points from multiple sources
    // FPL API entry_history: points = GW points, total_points = season cumulative
    // team.summary_event_points = GW points from team summary
    // Prefer team.summary_event_points as it's most reliable, then entry_history.points
    let gwPoints = team?.summary_event_points ?? entry?.points ?? 0;
    
    // If live, try to calculate from live_stats (more accurate during live GW)
    if (isLive && picks.picks) {
        // Calculate live points from starting XI (positions 1-11)
        const livePoints = picks.picks
            .filter(p => p.position <= 11)
            .reduce((sum, p) => {
                const player = getPlayerById(p.element);
                const pts = player?.live_stats?.total_points || 0;
                const mult = p.is_captain ? 2 : 1;
                return sum + (pts * mult);
            }, 0);
        // Use live points if calculated and greater than 0
        if (livePoints > 0) gwPoints = livePoints;
    }

    const totalPoints = team.summary_overall_points || 0;
    const overallRankNum = team.summary_overall_rank || 0;
    const gwRankNum = team.summary_event_rank || 0;
    const overallRank = overallRankNum ? overallRankNum.toLocaleString() : 'N/A';
    const gwRank = gwRankNum ? gwRankNum.toLocaleString() : 'N/A';

    // Team value and bank from entry_history (GW-specific)
    const teamValue = ((entry.value || 0) / 10).toFixed(1);
    const bank = ((entry.bank || 0) / 10).toFixed(1);
    const squadValue = ((entry.value || 0) / 10 - (entry.bank || 0) / 10).toFixed(1);
    const freeTransfers = entry.event_transfers || 0;
    const transferCost = entry.event_transfers_cost || 0;

    // Calculate rank color using helper
    const rankColor = calculateRankColor(team.id, overallRankNum);

    // Get captain and vice captain info
    const { captainInfo, viceInfo } = getCaptainViceInfo(picks.picks, gwNumber);

    // Calculate GW text color using helper
    const gwTextColor = calculateGWTextColor(gwRankNum, overallRankNum);

    // Get selected league info
    const selectedLeagueId = localStorage.getItem(`fpl_selected_league_${team.id}`);
    let leagueInfo = '';

    if (selectedLeagueId && selectedLeagueId !== 'null') {
        // Store league data in a data attribute for later rendering
        leagueInfo = `
            <div id="league-info-placeholder" data-team-id="${team.id}" data-league-id="${selectedLeagueId}" style="margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid var(--border-color);">
                <div style="font-size: 0.65rem; color: var(--text-secondary);">Loading league...</div>
            </div>
        `;
    }

    return `
        <div
            id="compact-header"
            style="
                position: sticky;
                top: calc(3.5rem + env(safe-area-inset-top)); /* Keeps this box sticky just below the top app bar */
                background: var(--bg-primary);
                z-index: 100;
                padding: 0.5rem 0;
                border-bottom: 2px solid var(--border-color);
                margin: 0;
            "
        >
            <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 0.5rem;">
                <div style="flex: 1; display: grid; gap: 0.2rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <button
                            id="change-team-btn"
                            style="
                                background: transparent;
                                border: 1px solid var(--border-color);
                                border-radius: 0.3rem;
                                padding: 0.2rem 0.35rem;
                                color: var(--text-secondary);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.2s;
                            "
                            title="Change Team"
                        >
                            <i class="fas fa-exchange-alt" style="font-size: 0.7rem;"></i>
                        </button>
                        <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; flex: 1;">
                            ${escapeHtml(team.name)}
                        </div>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Overall Rank: <span style="color: ${rankColor};">${overallRank}</span>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Overall Points: ${totalPoints.toLocaleString()}
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Squad Value: £${squadValue}m + £${bank}m
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Transfers: ${freeTransfers} FT${transferCost > 0 ? ` (-${transferCost} pts)` : ''}
                    </div>
                </div>

                <div style="display: flex; align-items: stretch;">
                    <div style="
                        background: var(--bg-primary);
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        padding: 0.3rem 0.6rem;
                        text-align: center;
                        min-width: 175px;
                        display: flex;
                        flex-direction: column;
                        justify-content: right;
                        box-shadow: 0 1px 3px var(--shadow);
                    ">
                        <div style="font-size: 2rem; font-weight: 800; color: ${gwTextColor}; line-height: 1;">
                            ${gwPoints}
                        </div>
                        <div style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 0.1rem; font-weight: 600;">
                            GW ${gwNumber}${isLive ? ' <span style="color: #22c55e; animation: pulse 2s infinite;">⚡ LIVE</span>' : ''}
                        </div>
                        ${isLive ? '<style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }</style>' : ''}
                        ${leagueInfo}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Get captain and vice captain info with opponent badges
 * @param {Array} picks - Player picks array
 * @param {number} gwNumber - Gameweek number
 * @returns {Object} Captain and vice info HTML
 */
function getCaptainViceInfo(picks, gwNumber) {
    const captainPick = picks.find(p => p.is_captain);
    const vicePick = picks.find(p => p.is_vice_captain);

    let captainInfo = 'None';
    let viceInfo = 'None';

    if (captainPick) {
        const captainPlayer = getPlayerById(captainPick.element);
        if (captainPlayer) {
            const captainOpp = getGWOpponent(captainPlayer.team, gwNumber);
            const oppBadge = renderOpponentBadge(captainOpp, 'normal');
            captainInfo = `${captainPlayer.web_name} vs. ${oppBadge}`;
        }
    }

    if (vicePick) {
        const vicePlayer = getPlayerById(vicePick.element);
        if (vicePlayer) {
            const viceOpp = getGWOpponent(vicePlayer.team, gwNumber);
            const oppBadge = renderOpponentBadge(viceOpp, 'normal');
            viceInfo = `${vicePlayer.web_name} vs. ${oppBadge}`;
        }
    }

    return { captainInfo, viceInfo };
}
