// ============================================================================
// LIVE MATCHES TABLE
// Showing matches where my players are playing, with same styling as Top Performers
// ============================================================================

import { fplFixtures, fplBootstrap, getPlayerById } from '../data.js';
import { getTeamShortName, escapeHtml, formatDecimal, getPtsHeatmap, getFormHeatmap, getHeatmapStyle } from '../utils.js';
import { getMatchStatus } from '../fixtures.js';
import { getActiveGW } from '../data.js';

// Team colors (from playerModal.js)
const TEAM_COLORS = {
    1: '#EF0107', 2: '#95BFE5', 3: '#DA291C', 4: '#E30613', 5: '#0057B8',
    6: '#6C1D45', 7: '#034694', 8: '#1B458F', 9: '#003399', 10: '#000000',
    11: '#FFCD00', 12: '#C8102E', 13: '#6CABDD', 14: '#DA291C', 15: '#241F20',
    16: '#DD0000', 17: '#EB172B', 18: '#132257', 19: '#7A263A', 20: '#FDB913',
    21: '#0057B8', 22: '#C8102E'
};

function getTeamColor(teamId) {
    return TEAM_COLORS[teamId] || '#666666';
}

function isColorDark(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
}

/**
 * Render live matches table (same styling as Top Performers)
 * @param {Object} teamData - Team data
 * @param {number} gameweek - Gameweek number
 * @param {string} status - GW status
 * @returns {string} HTML for matches table
 */
export function renderLiveMatchesTable(teamData, gameweek, status) {
    const { picks } = teamData;
    if (!picks || !picks.picks || !fplFixtures || !fplBootstrap) {
        return '<div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; text-align: center; color: var(--text-secondary); margin-bottom: 1rem;">No fixtures data</div>';
    }
    
    const currentGW = getActiveGW();
    const isLive = status === 'LIVE';
    
    // Get map of team -> players from my team
    const myTeamIds = new Set();
    const teamToPlayers = new Map(); // teamId -> [{player, pick}]
    
    picks.picks.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (player) {
            myTeamIds.add(player.team);
            if (!teamToPlayers.has(player.team)) {
                teamToPlayers.set(player.team, []);
            }
            teamToPlayers.get(player.team).push({ player, pick });
        }
    });
    
    // Filter fixtures to only those where my players are playing
    const relevantFixtures = fplFixtures
        .filter(f => f.event === gameweek && (myTeamIds.has(f.team_h) || myTeamIds.has(f.team_a)))
        .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));
    
    if (relevantFixtures.length === 0) {
        return `
            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; text-align: center; color: var(--text-secondary); margin-bottom: 1rem;">
                No matches for this GW
            </div>
        `;
    }
    
    // Separate live and finished matches
    const liveMatches = relevantFixtures.filter(f => f.started && !f.finished);
    const finishedMatches = relevantFixtures.filter(f => f.finished);
    const upcomingMatches = relevantFixtures.filter(f => !f.started && !f.finished);
    
    // Sort: live first, then upcoming, then finished
    const sortedMatches = [...liveMatches, ...upcomingMatches, ...finishedMatches];
    
    // Header row (same as Top Performers: Match, Opp, Status, Pts, Form, Players)
    let html = `
        <div style="background: var(--bg-secondary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); overflow: hidden; margin-bottom: 1rem;">
            <div style="padding: 0.5rem 0.75rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                    Live Matches
                </h4>
            </div>
            <div class="mobile-table">
                <div class="mobile-table-header" style="grid-template-columns: 2fr 1fr 0.7fr 0.7fr 1.5fr; padding-bottom: 2px !important; padding-top: 2px !important;">
                    <div>Match</div>
                    <div style="text-align: center;">Status</div>
                    <div style="text-align: center;">Pts</div>
                    <div style="text-align: center;">Form</div>
                    <div style="text-align: center;">Players</div>
                </div>
    `;
    
    // Render rows (same styling as Top Performers)
    sortedMatches.forEach(fixture => {
        const homeTeamId = fixture.team_h;
        const awayTeamId = fixture.team_a;
        const homeShort = getTeamShortName(homeTeamId);
        const awayShort = getTeamShortName(awayTeamId);
        
        const homeColor = getTeamColor(homeTeamId);
        const awayColor = getTeamColor(awayTeamId);
        const homeBg = isColorDark(homeColor) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)';
        const awayBg = isColorDark(awayColor) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)';
        
        // Get my players in this match (both teams)
        const homePlayers = teamToPlayers.get(homeTeamId) || [];
        const awayPlayers = teamToPlayers.get(awayTeamId) || [];
        const matchPlayers = [...homePlayers, ...awayPlayers];
        
        // Calculate total points and average form from my players in this match
        let totalPoints = 0;
        let totalForm = 0;
        const playerNames = [];
        
        matchPlayers.forEach(({ player, pick }) => {
            const gwPoints = isLive ? (player.live_stats?.total_points || 0) : (player.event_points || 0);
            const mult = pick.is_captain ? 2 : 1;
            totalPoints += gwPoints * mult;
            totalForm += parseFloat(player.form) || 0;
            
            const name = pick.is_captain ? `${player.web_name} (C)` : 
                        pick.is_vice_captain ? `${player.web_name} (VC)` : 
                        player.web_name;
            playerNames.push(name);
        });
        
        const avgForm = matchPlayers.length > 0 ? totalForm / matchPlayers.length : 0;
        const playersList = playerNames.length > 0 ? playerNames.join(', ') : '—';
        
        // Match display (same format as before)
        let matchDisplay = '';
        let statusDisplay = '';
        let rowStyle = 'background: var(--bg-primary);';
        
        if (fixture.finished) {
            // Finished: MCI 1-5 LIV (grey)
            const homeScore = fixture.team_h_score ?? '-';
            const awayScore = fixture.team_a_score ?? '-';
            matchDisplay = `
                <span style="
                    background: ${homeBg};
                    color: ${homeColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.6rem;
                ">${homeShort}</span>
                <span style="color: var(--text-secondary); margin: 0 0.25rem; font-size: 0.6rem;">${homeScore}-${awayScore}</span>
                <span style="
                    background: ${awayBg};
                    color: ${awayColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.6rem;
                ">${awayShort}</span>
            `;
            statusDisplay = '<span style="color: var(--text-secondary); font-size: 0.6rem;">FT</span>';
            rowStyle = 'background: var(--bg-primary); opacity: 0.6; color: var(--text-secondary);';
        } else if (fixture.started && !fixture.finished) {
            // Live: MCI 1-5 LIV
            const homeScore = fixture.team_h_score ?? '-';
            const awayScore = fixture.team_a_score ?? '-';
            matchDisplay = `
                <span style="
                    background: ${homeBg};
                    color: ${homeColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.6rem;
                ">${homeShort}</span>
                <span style="margin: 0 0.25rem; font-size: 0.6rem;">${homeScore}-${awayScore}</span>
                <span style="
                    background: ${awayBg};
                    color: ${awayColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.6rem;
                ">${awayShort}</span>
            `;
            statusDisplay = '<span style="color: #ef4444; font-weight: 700; font-size: 0.6rem;">LIVE</span>';
        } else {
            // Upcoming: MUN vs. BOU Sat 2200 (SGT)
            const kickoffDate = new Date(fixture.kickoff_time);
            const sgtTime = new Date(kickoffDate.getTime() + (8 * 60 * 60 * 1000));
            const dayStr = sgtTime.toLocaleString('en-SG', { 
                timeZone: 'Asia/Singapore',
                weekday: 'short' 
            });
            const timeStr = sgtTime.toLocaleString('en-SG', {
                timeZone: 'Asia/Singapore',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(':', '');
            
            matchDisplay = `
                <span style="
                    background: ${homeBg};
                    color: ${homeColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.6rem;
                ">${homeShort}</span>
                <span style="margin: 0 0.25rem; color: var(--text-secondary); font-size: 0.6rem;">vs.</span>
                <span style="
                    background: ${awayBg};
                    color: ${awayColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.6rem;
                ">${awayShort}</span>
            `;
            statusDisplay = `<span style="color: var(--text-secondary); font-size: 0.6rem;">${dayStr} ${timeStr}</span>`;
        }
        
        // Points and Form styling (same as Top Performers)
        const ptsHeatmap = getPtsHeatmap(totalPoints, 'gw_pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);
        const formHeatmap = getFormHeatmap(avgForm);
        const formStyle = getHeatmapStyle(formHeatmap);
        
        // Status styling (same as Top Performers)
        let statusColor = 'var(--text-secondary)';
        let statusWeight = '400';
        let statusBgColor = 'transparent';
        
        if (fixture.finished) {
            statusColor = '#22c55e';
            statusWeight = '700';
        } else if (fixture.started && !fixture.finished) {
            statusColor = '#ef4444';
            statusWeight = '700';
        }
        
        html += `
            <div
                class="mobile-table-row"
                style="grid-template-columns: 2fr 1fr 0.7fr 0.7fr 1.5fr; padding-bottom: 3px !important; padding-top: 3px !important; ${rowStyle}"
            >
                <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 0.25rem;">
                    ${matchDisplay}
                </div>
                <div style="text-align: center; font-size: 0.6rem; font-weight: ${statusWeight}; color: ${statusColor}; background: ${statusBgColor}; padding: 0.08rem 0.25rem; border-radius: 0.25rem;">${statusDisplay}</div>
                <div style="text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${totalPoints}</div>
                <div style="text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${formatDecimal(avgForm)}</div>
                <div style="text-align: center; font-size: 0.6rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(playersList)}">${escapeHtml(playersList)}</div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    return html;
}
