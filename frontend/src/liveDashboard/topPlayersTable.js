// ============================================================================
// TOP PLAYERS TABLE
// Global top players of the GW with my players highlighted
// Uses exact same styling as stats page Top Performers table
// ============================================================================

import { getAllPlayers, getPlayerById } from '../data.js';
import { 
    escapeHtml, 
    formatDecimal, 
    getPtsHeatmap, 
    getFormHeatmap, 
    getHeatmapStyle 
} from '../utils.js';
import { getGWOpponent, getMatchStatus } from '../fixtures.js';
import { getDifficultyClass } from '../utils.js';
import { getActiveGW } from '../data.js';

/**
 * Render global top players table (GW Top Performers)
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
    
    const currentGW = getActiveGW();
    
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
    
    // Sort by GW points descending and take top 15
    const topPlayers = playersWithPoints
        .sort((a, b) => b.gwPoints - a.gwPoints)
        .slice(0, 15);
    
    if (topPlayers.length === 0) {
        return '';
    }
    
    // Header row (same as stats page: Player, Opp, Status, Pts, Form, GW Pts)
    let html = `
        <div style="background: var(--bg-secondary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); overflow: hidden; margin-top: 1rem;">
            <div style="padding: 0.5rem 0.75rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                    GW Top Performers
                </h4>
            </div>
            <div class="mobile-table">
                <div class="mobile-table-header" style="grid-template-columns: 2fr 1.2fr 1fr 0.7fr 0.7fr; padding-bottom: 2px !important; padding-top: 2px !important;">
                    <div>Player</div>
                    <div style="text-align: center;">Opp</div>
                    <div style="text-align: center;">Status</div>
                    <div style="text-align: center;">Pts</div>
                    <div style="text-align: center;">Form</div>
                </div>
    `;
    
    // Render rows (same styling as stats page)
    topPlayers.forEach((item) => {
        const player = item.player;
        const gwOpp = getGWOpponent(player.team, currentGW);
        const matchStatus = getMatchStatus(player.team, currentGW, player);
        const isLiveMatch = matchStatus === 'LIVE';
        const isFinished = matchStatus.startsWith('FT');
        
        // GW Points (for Pts column)
        const gwPoints = isLive ? (player.live_stats?.total_points || 0) : (player.event_points || 0);
        const ptsHeatmap = getPtsHeatmap(gwPoints, 'gw_pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);
        
        // Form
        const formHeatmap = getFormHeatmap(parseFloat(player.form) || 0);
        const formStyle = getHeatmapStyle(formHeatmap);
        
        // GW Points for last column (same value, but displayed again)
        const gwPtsHeatmap = getPtsHeatmap(gwPoints, 'gw_pts');
        const gwPtsStyle = getHeatmapStyle(gwPtsHeatmap);
        
        // Status styling (matching stats page logic)
        let statusColor = 'var(--text-secondary)';
        let statusWeight = '400';
        let statusBgColor = 'transparent';
        
        if (isFinished && matchStatus.includes('(')) {
            const minsMatch = matchStatus.match(/\((\d+)\)/);
            if (minsMatch) {
                const mins = parseInt(minsMatch[1]);
                statusWeight = '700';
                if (mins >= 90) {
                    statusColor = '#86efac';
                    statusBgColor = 'rgba(31, 77, 46, 1.0)';
                } else if (mins >= 60) {
                    statusColor = '#fcd34d';
                    statusBgColor = 'rgba(92, 74, 31, 1.0)';
                } else {
                    statusColor = '#fca5a5';
                    statusBgColor = 'rgba(92, 31, 31, 1.0)';
                }
            } else {
                statusColor = '#22c55e';
            }
        } else if (isLiveMatch) {
            statusColor = '#ef4444';
            statusWeight = '700';
        }
        
        // Colored left border for players with news/injury
        let leftBorderStyle = 'none';
        if (item.isMyPlayer) {
            leftBorderStyle = '3px solid var(--primary-color)';
        } else if (player.news && player.news.trim() !== '') {
            const chanceOfPlaying = player.chance_of_playing_next_round;
            if (chanceOfPlaying !== null && chanceOfPlaying !== undefined) {
                if (chanceOfPlaying <= 25) {
                    leftBorderStyle = '3px solid #ef4444';
                } else if (chanceOfPlaying <= 50) {
                    leftBorderStyle = '3px solid #f97316';
                } else {
                    leftBorderStyle = '3px solid #fbbf24';
                }
            } else {
                leftBorderStyle = '3px solid #fbbf24';
            }
        }
        
        const bgColor = item.isMyPlayer ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-primary)';
        
        html += `
            <div
                class="player-row mobile-table-row"
                style="grid-template-columns: 2fr 1.2fr 1fr 0.7fr 0.7fr; cursor: pointer; padding-bottom: 3px !important; padding-top: 3px !important; border-left: ${leftBorderStyle}; background: ${bgColor};"
                data-player-id="${player.id}"
            >
                <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(player.web_name)}
                    ${item.isMyPlayer ? ' <span style="color: var(--primary-color); font-size: 0.75rem;">⭐</span>' : ''}
                </div>
                <div style="text-align: center;">
                    <span class="${getDifficultyClass(gwOpp.difficulty)}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 700; font-size: 0.6rem; min-width: 3rem; display: inline-block; text-align: center;">
                        ${gwOpp.name} (${gwOpp.isHome ? 'H' : 'A'})
                    </span>
                </div>
                <div style="text-align: center; font-size: 0.6rem; font-weight: ${statusWeight}; color: ${statusColor}; background: ${statusBgColor}; padding: 0.08rem 0.25rem; border-radius: 0.25rem;">${matchStatus}</div>
                <div style="text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${gwPoints}</div>
                <div style="text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${formatDecimal(player.form)}</div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    return html;
}

