// ============================================================================
// MY TEAM LIVE TABLE
// Left column showing top players with sticky C/VC
// ============================================================================

import { getPlayerById } from '../data.js';
import { escapeHtml } from '../utils.js';

/**
 * Render my team live table (left column)
 * @param {Object} teamData - Team data
 * @param {number} gameweek - Gameweek number
 * @param {boolean} isLive - Whether GW is live
 * @returns {string} HTML for team live table
 */
export function renderMyTeamLiveTable(teamData, gameweek, isLive) {
    const { picks } = teamData;
    if (!picks || !picks.picks) {
        return '<div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; text-align: center; color: var(--text-secondary);">No team data</div>';
    }
    
    // Get all players with their live points
    const playersWithPoints = picks.picks.map(pick => {
        const player = getPlayerById(pick.element);
        if (!player) return null;
        
        const gwPoints = isLive ? (player.live_stats?.total_points || 0) : (player.event_points || 0);
        const minutes = isLive ? (player.live_stats?.minutes || 0) : 0;
        
        return {
            pick,
            player,
            gwPoints,
            minutes,
            isCaptain: pick.is_captain,
            isVice: pick.is_vice_captain,
            isBench: pick.position > 11
        };
    }).filter(Boolean);
    
    // Separate C/VC and other players
    const captain = playersWithPoints.find(p => p.isCaptain && !p.isBench);
    const vice = playersWithPoints.find(p => p.isVice && !p.isBench);
    const otherPlayers = playersWithPoints
        .filter(p => !p.isCaptain && !p.isVice && !p.isBench)
        .sort((a, b) => b.gwPoints - a.gwPoints)
        .slice(0, 5); // Top 5 performers
    
    // Build rows: C, VC, then top performers
    const rows = [];
    if (captain) rows.push(captain);
    if (vice) rows.push(vice);
    rows.push(...otherPlayers);
    
    const headerRow = `
        <div class="mobile-table-header mobile-table-header-sticky" style="top: calc(3.5rem + env(safe-area-inset-top));">
            <div>Player</div>
            <div style="text-align: center;">Pts</div>
            <div style="text-align: center;">Min</div>
        </div>
    `;
    
    const rowsHtml = rows.map((item, index) => {
        const bgColor = item.isCaptain ? 'rgb(104, 98, 132)' : 
                       item.isVice ? 'rgb(104, 98, 132)' : 
                       'var(--bg-primary)';
        const borderLeft = item.isCaptain ? '3px solid var(--primary-color)' : 
                          item.isVice ? '3px solid var(--text-secondary)' : 'none';
        
        return `
            <div class="mobile-table-row" style="background: ${bgColor}; border-left: ${borderLeft};">
                <div>
                    <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-primary);">
                        ${item.isCaptain ? '(C) ' : item.isVice ? '(VC) ' : ''}${escapeHtml(item.player.web_name)}
                    </div>
                    <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.1rem;">
                        ${item.player.element_type === 1 ? 'GKP' : item.player.element_type === 2 ? 'DEF' : item.player.element_type === 3 ? 'MID' : 'FWD'}
                    </div>
                </div>
                <div style="text-align: center; font-weight: 700; color: var(--text-primary);">
                    ${item.gwPoints}
                </div>
                <div style="text-align: center; font-size: 0.7rem; color: var(--text-secondary);">
                    ${item.minutes || '—'}
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div style="background: var(--bg-secondary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); overflow: hidden;">
            <div style="padding: 0.5rem 0.75rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                    My Team Live
                </h4>
            </div>
            ${headerRow}
            ${rowsHtml}
        </div>
    `;
}

