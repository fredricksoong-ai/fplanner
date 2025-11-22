// ============================================================================
// DASHBOARD HEADER
// Header card showing GW status, points, and rank
// ============================================================================

import { escapeHtml } from '../utils.js';
import { getPlayerById } from '../data.js';

/**
 * Render dashboard header card
 * @param {Object} teamData - Team data
 * @param {number} gameweek - Gameweek number
 * @param {string} status - GW status (LIVE/FINISHED/UPCOMING)
 * @param {boolean} isAutoRefreshActive - Whether auto-refresh is active
 * @returns {string} HTML for dashboard header
 */
export function renderDashboardHeader(teamData, gameweek, status, isAutoRefreshActive) {
    const { team, picks } = teamData;
    
    // Get GW points and rank
    let gwPoints = team.summary_event_points || 0;
    let gwRank = team.summary_event_rank || 0;
    
    // If live, calculate from live stats
    if (status === 'LIVE' && picks?.picks) {
        const livePoints = picks.picks
            .filter(p => p.position <= 11)
            .reduce((sum, p) => {
                const player = getPlayerById(p.element);
                const pts = player?.live_stats?.total_points || 0;
                const mult = p.is_captain ? 2 : 1;
                return sum + (pts * mult);
            }, 0);
        if (livePoints > 0) gwPoints = livePoints;
    }
    
    // Status badge
    let statusBadge = '';
    let statusColor = 'var(--text-secondary)';
    if (status === 'LIVE') {
        statusBadge = '<span style="color: #ef4444; font-weight: 700; animation: pulse 2s infinite;">⚡ LIVE</span>';
        statusColor = '#ef4444';
    } else if (status === 'FINISHED') {
        statusBadge = '<span style="color: #22c55e; font-weight: 700;">✓ FINISHED</span>';
        statusColor = '#22c55e';
    } else {
        statusBadge = '<span style="color: var(--text-secondary); font-weight: 700;">UPCOMING</span>';
    }
    
    // Auto-refresh indicator
    const refreshIndicator = isAutoRefreshActive ? `
        <div style="display: flex; align-items: center; gap: 0.25rem; margin-top: 0.5rem; font-size: 0.65rem; color: var(--text-secondary);">
            <i class="fas fa-sync-alt fa-spin" style="font-size: 0.6rem; color: #00ff88;"></i>
            <span>Auto-refreshing every 2 min</span>
        </div>
    ` : '';
    
    return `
        <div style="
            background: var(--bg-primary);
            border-left: 4px solid ${statusColor};
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 8px var(--shadow);
        ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">
                        Gameweek ${gameweek}
                    </div>
                    <div style="font-size: 2rem; font-weight: 800; color: var(--text-primary); line-height: 1;">
                        ${gwPoints}
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        Rank: ${gwRank ? gwRank.toLocaleString() : 'N/A'}
                    </div>
                </div>
                <div style="text-align: right;">
                    ${statusBadge}
                    ${refreshIndicator}
                </div>
            </div>
        </div>
        ${status === 'LIVE' ? '<style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }</style>' : ''}
    `;
}

