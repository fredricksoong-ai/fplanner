// ============================================================================
// DASHBOARD HEADER
// Header card reusing mobile Team page design
// ============================================================================

import { escapeHtml } from '../utils.js';
import { getPlayerById } from '../data.js';
import { calculateRankColor, calculateGWTextColor } from '../myTeam/compact/compactStyleHelpers.js';

/**
 * Render dashboard header card (reusing mobile Team page card design)
 * @param {Object} teamData - Team data
 * @param {number} gameweek - Gameweek number
 * @param {string} status - GW status (LIVE/FINISHED/UPCOMING)
 * @param {boolean} isAutoRefreshActive - Whether auto-refresh is active
 * @returns {string} HTML for dashboard header
 */
export function renderDashboardHeader(teamData, gameweek, status, isAutoRefreshActive) {
    const { team, picks } = teamData;
    
    // Get overall rank
    const overallRankNum = team.summary_overall_rank || 0;
    const overallRank = overallRankNum ? overallRankNum.toLocaleString() : 'N/A';
    
    // Get GW points and rank (only if not UPCOMING)
    let gwPoints = null;
    let gwRankNum = null;
    
    if (status !== 'UPCOMING') {
        gwPoints = team.summary_event_points || 0;
        gwRankNum = team.summary_event_rank || 0;
        
        // If live, calculate from live stats
        if (status === 'LIVE' && picks?.picks) {
            const livePoints = picks.picks
                .filter(p => p.position <= 11)
                .reduce((sum, p) => {
                    const player = getPlayerById(p.element);
                    if (!player) return sum;
                    const pts = player.live_stats?.total_points || player.event_points || 0;
                    const mult = p.is_captain ? 2 : 1;
                    return sum + (pts * mult);
                }, 0);
            if (livePoints > 0) gwPoints = livePoints;
        }
    }
    
    // Calculate rank color and GW text color
    const rankColor = calculateRankColor(team.id, overallRankNum);
    const gwTextColor = status === 'UPCOMING' ? 'var(--text-secondary)' : calculateGWTextColor(gwRankNum || 0, overallRankNum);
    const isLive = status === 'LIVE';
    
    // Auto-refresh indicator
    const refreshIndicator = isAutoRefreshActive ? `
        <div style="display: flex; align-items: center; gap: 0.25rem; margin-top: 0.5rem; font-size: 0.65rem; color: var(--text-secondary);">
            <i class="fas fa-sync-alt fa-spin" style="font-size: 0.6rem; color: #00ff88;"></i>
            <span>Auto-refreshing</span>
        </div>
    ` : '';
    
    return `
        <div
            id="dashboard-header"
            style="
                position: sticky;
                top: calc(3.5rem + env(safe-area-inset-top));
                background: var(--bg-primary);
                z-index: 100;
                padding: 0.5rem 0;
                border-bottom: 2px solid var(--border-color);
                margin: 0 0 1rem 0;
            "
        >
            <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 0.5rem;">
                <div style="flex: 1; display: grid; gap: 0.2rem;">
                    <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.2;">
                        ${escapeHtml(team.name)}
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Overall Rank: <span style="color: ${rankColor};">${overallRank}</span>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        GW Rank: ${status === 'UPCOMING' ? '<span style="color: var(--text-secondary);">-</span>' : `<span style="color: ${gwTextColor};">${gwRankNum ? gwRankNum.toLocaleString() : 'N/A'}</span>`}
                    </div>
                    
                    ${refreshIndicator}
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
                        <div style="font-size: 2rem; font-weight: 800; color: ${gwPoints !== null ? gwTextColor : 'var(--text-secondary)'}; line-height: 1;">
                            ${gwPoints !== null ? gwPoints : '—'}
                        </div>
                        <div style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 0.1rem; font-weight: 600;">
                            GW ${gameweek}${isLive ? ' <span style="color: #22c55e; animation: pulse 2s infinite;">⚡ LIVE</span>' : ''}
                        </div>
                        ${isLive ? '<style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }</style>' : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

