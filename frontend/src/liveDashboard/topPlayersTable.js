// ============================================================================
// TOP PLAYERS TABLE
// Global top players of the GW with my players highlighted
// ============================================================================

import { getAllPlayers, getPlayerById } from '../data.js';
import { getTeamShortName, escapeHtml } from '../utils.js';

/**
 * Render global top players table
 * @param {Object} teamData - Team data
 * @param {number} gameweek - Gameweek number
 * @param {boolean} isLive - Whether GW is live
 * @returns {string} HTML for top players table
 */
export function renderTopPlayersTable(teamData, gameweek, isLive) {
    const allPlayers = getAllPlayers();
    if (!allPlayers || allPlayers.length === 0) {
        return '';
    }
    
    // Get my team player IDs
    const myPlayerIds = new Set();
    if (teamData?.picks?.picks) {
        teamData.picks.picks.forEach(pick => {
            myPlayerIds.add(pick.element);
        });
    }
    
    // Calculate GW points for all players
    const playersWithPoints = allPlayers.map(player => {
        const gwPoints = isLive ? (player.live_stats?.total_points || 0) : (player.event_points || 0);
        return {
            player,
            gwPoints,
            isMyPlayer: myPlayerIds.has(player.id)
        };
    }).filter(p => p.gwPoints > 0); // Only show players with points
    
    // Sort by points descending and take top 15
    const topPlayers = playersWithPoints
        .sort((a, b) => b.gwPoints - a.gwPoints)
        .slice(0, 15);
    
    if (topPlayers.length === 0) {
        return '';
    }
    
    const headerRow = `
        <div class="mobile-table-header mobile-table-header-sticky" style="top: calc(3.5rem + env(safe-area-inset-top));">
            <div style="text-align: center;">Rank</div>
            <div>Player</div>
            <div style="text-align: center;">Pts</div>
            <div style="text-align: center;">Team</div>
        </div>
    `;
    
    const rowsHtml = topPlayers.map((item, index) => {
        const rank = index + 1;
        const bgColor = item.isMyPlayer ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-primary)';
        const borderLeft = item.isMyPlayer ? '3px solid var(--primary-color)' : 'none';
        
        return `
            <div class="mobile-table-row" style="background: ${bgColor}; border-left: ${borderLeft};">
                <div style="text-align: center; font-weight: 600;">${rank}</div>
                <div>
                    <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-primary);">
                        ${escapeHtml(item.player.web_name)}
                        ${item.isMyPlayer ? ' <span style="color: var(--primary-color);">⭐</span>' : ''}
                    </div>
                    <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.1rem;">
                        ${item.player.element_type === 1 ? 'GKP' : item.player.element_type === 2 ? 'DEF' : item.player.element_type === 3 ? 'MID' : 'FWD'}
                    </div>
                </div>
                <div style="text-align: center; font-weight: 700; color: var(--text-primary);">
                    ${item.gwPoints}
                </div>
                <div style="text-align: center; font-size: 0.7rem; color: var(--text-secondary);">
                    ${getTeamShortName(item.player.team)}
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div style="background: var(--bg-secondary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); overflow: hidden; margin-top: 1rem;">
            <div style="padding: 0.5rem 0.75rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                    Top Players (GW${gameweek})
                </h4>
            </div>
            ${headerRow}
            ${rowsHtml}
        </div>
    `;
}

