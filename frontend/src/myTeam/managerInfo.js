/**
 * Manager Info Card Module
 * Displays manager details and team statistics
 */

import { escapeHtml } from '../utils.js';

/**
 * Render manager info card with team statistics
 * @param {Object} teamData - Team data including team and picks
 * @returns {string} HTML for manager info card
 */
export function renderManagerInfo(teamData) {
    const { team, picks } = teamData;
    const entry = picks.entry_history;

    // Use team.summary_* fields (most accurate, from /api/entry/{teamId}/)
    const overallRank = team.summary_overall_rank || 0;
    const totalPlayers = team.last_deadline_total_players || team.total_players || 0;
    const overallPoints = team.summary_overall_points || 0;
    const gwPoints = team.summary_event_points || 0;
    const gwRank = team.summary_event_rank || 0;

    return `
        <div style="
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
            padding: 1.5rem;
            border-radius: 12px;
            color: white;
            box-shadow: 0 4px 12px var(--shadow);
        ">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem;">
                <div>
                    <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.25rem;">Manager</div>
                    <div style="font-size: 1.25rem; font-weight: 700; line-height: 1.2;">${escapeHtml(team.player_first_name)} ${escapeHtml(team.player_last_name)}</div>
                    <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">${escapeHtml(team.name)}</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.25rem;">Overall Rank</div>
                    <div style="font-size: 1.25rem; font-weight: 700; line-height: 1.2;">${overallRank.toLocaleString()}</div>
                    <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">of ${totalPlayers.toLocaleString()}</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.25rem;">Total Points</div>
                    <div style="font-size: 1.25rem; font-weight: 700; line-height: 1.2;">${overallPoints.toLocaleString()}</div>
                    <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">GW${teamData.gameweek}: ${gwPoints} pts (Rank: ${gwRank.toLocaleString()})</div>
                </div>
                <div>
                    <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.25rem;">Team Value</div>
                    <div style="font-size: 1.25rem; font-weight: 700; line-height: 1.2;">£${(entry.value / 10).toFixed(1)}m</div>
                    <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">Bank: £${(entry.bank / 10).toFixed(1)}m</div>
                </div>
            </div>
        </div>
    `;
}
