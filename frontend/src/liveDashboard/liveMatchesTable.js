// ============================================================================
// LIVE MATCHES TABLE
// Right column showing matches where my players are playing
// ============================================================================

import { fplFixtures, fplBootstrap, getPlayerById } from '../data.js';
import { getTeamShortName } from '../utils.js';
import { escapeHtml } from '../utils.js';

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
 * Render live matches table (right column)
 * @param {Object} teamData - Team data
 * @param {number} gameweek - Gameweek number
 * @param {string} status - GW status
 * @returns {string} HTML for matches table
 */
export function renderLiveMatchesTable(teamData, gameweek, status) {
    const { picks } = teamData;
    if (!picks || !picks.picks || !fplFixtures || !fplBootstrap) {
        return '<div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; text-align: center; color: var(--text-secondary);">No fixtures data</div>';
    }
    
    // Get unique team IDs from my players
    const myTeamIds = new Set();
    picks.picks.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (player) myTeamIds.add(player.team);
    });
    
    // Filter fixtures to only those where my players are playing
    const relevantFixtures = fplFixtures
        .filter(f => f.event === gameweek && (myTeamIds.has(f.team_h) || myTeamIds.has(f.team_a)))
        .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));
    
    if (relevantFixtures.length === 0) {
        return `
            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; text-align: center; color: var(--text-secondary);">
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
    
    const headerRow = `
        <div class="mobile-table-header mobile-table-header-sticky mobile-table-dashboard-matches" style="top: calc(3.5rem + env(safe-area-inset-top));">
            <div>Match</div>
            <div style="text-align: center;">Status</div>
        </div>
    `;
    
    const rowsHtml = sortedMatches.map(fixture => {
        const homeTeamId = fixture.team_h;
        const awayTeamId = fixture.team_a;
        const homeShort = getTeamShortName(homeTeamId);
        const awayShort = getTeamShortName(awayTeamId);
        
        const homeColor = getTeamColor(homeTeamId);
        const awayColor = getTeamColor(awayTeamId);
        const homeBg = isColorDark(homeColor) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)';
        const awayBg = isColorDark(awayColor) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)';
        
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
                    font-size: 0.7rem;
                ">${homeShort}</span>
                <span style="color: var(--text-secondary); margin: 0 0.25rem;">${homeScore}-${awayScore}</span>
                <span style="
                    background: ${awayBg};
                    color: ${awayColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.7rem;
                ">${awayShort}</span>
            `;
            statusDisplay = '<span style="color: var(--text-secondary); font-size: 0.65rem;">FT</span>';
            rowStyle = 'background: var(--bg-primary); opacity: 0.6; color: var(--text-secondary);';
        } else if (fixture.started && !fixture.finished) {
            // Live: MCI 1-5 LIV with LIVE badge
            const homeScore = fixture.team_h_score ?? '-';
            const awayScore = fixture.team_a_score ?? '-';
            matchDisplay = `
                <span style="
                    background: ${homeBg};
                    color: ${homeColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.7rem;
                ">${homeShort}</span>
                <span style="margin: 0 0.25rem;">${homeScore}-${awayScore}</span>
                <span style="
                    background: ${awayBg};
                    color: ${awayColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.7rem;
                ">${awayShort}</span>
            `;
            statusDisplay = '<span style="color: #ef4444; font-weight: 700; font-size: 0.65rem;">LIVE</span>';
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
                    font-size: 0.7rem;
                ">${homeShort}</span>
                <span style="margin: 0 0.25rem; color: var(--text-secondary);">vs.</span>
                <span style="
                    background: ${awayBg};
                    color: ${awayColor};
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.2rem;
                    font-weight: 700;
                    font-size: 0.7rem;
                ">${awayShort}</span>
            `;
            statusDisplay = `<span style="color: var(--text-secondary); font-size: 0.65rem;">${dayStr} ${timeStr}</span>`;
        }
        
        return `
            <div class="mobile-table-row mobile-table-dashboard-matches" style="${rowStyle}">
                <div style="display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap;">
                    ${matchDisplay}
                </div>
                <div style="text-align: center;">
                    ${statusDisplay}
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div style="background: var(--bg-secondary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); overflow: hidden;">
            <div style="padding: 0.5rem 0.75rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                    Live Matches
                </h4>
            </div>
            ${headerRow}
            ${rowsHtml}
        </div>
    `;
}

