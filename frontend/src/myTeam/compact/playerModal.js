// ============================================================================
// PLAYER MODAL
// Detailed player stats modal with 4-quadrant layout
// ============================================================================

import { getPlayerById, fplFixtures, getActiveGW, getAllPlayers } from '../../data.js';
import {
    getPositionShort,
    getTeamShortName,
    escapeHtml,
    getCurrentGW,
    formatDecimal
} from '../../utils.js';
import { getMatchStatus } from '../../fixtures.js';
import { analyzePlayerRisks } from '../../risk.js';
import { renderOpponentBadge } from './compactStyleHelpers.js';

// Team primary colors for styling
const TEAM_COLORS = {
    1: '#EF0107',   // Arsenal
    2: '#95BFE5',   // Aston Villa
    3: '#DA291C',   // Bournemouth
    4: '#E30613',   // Brentford
    5: '#0057B8',   // Brighton
    6: '#6C1D45',   // Burnley
    7: '#034694',   // Chelsea
    8: '#1B458F',   // Crystal Palace
    9: '#003399',   // Everton
    10: '#000000',  // Fulham
    11: '#FFCD00',  // Leeds (if in league)
    12: '#C8102E',  // Liverpool
    13: '#6CABDD',  // Man City
    14: '#DA291C',  // Man United
    15: '#241F20',  // Newcastle
    16: '#DD0000',  // Nottingham Forest
    17: '#EB172B',  // Southampton/Sunderland
    18: '#132257',  // Tottenham
    19: '#7A263A',  // West Ham
    20: '#FDB913', // Wolves
    21: '#0057B8',  // Ipswich (placeholder)
    22: '#C8102E',  // Leicester (placeholder)
};

/**
 * Get team primary color
 * @param {number} teamId - Team ID
 * @returns {string} Hex color code
 */
function getTeamColor(teamId) {
    return TEAM_COLORS[teamId] || '#666666';
}

/**
 * Check if a hex color is dark (needs light background)
 * @param {string} hex - Hex color code
 * @returns {boolean} True if color is dark
 */
function isColorDark(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance (perceived brightness)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance < 0.5;
}

/**
 * Get inline styles for FDR difficulty
 * @param {number} difficulty - Fixture difficulty rating (1-5)
 * @returns {Object} Background and text color styles
 */
function getFDRStyles(difficulty) {
    const colors = {
        1: { bg: '#147d1e', color: '#ffffff' }, // Dark green (easiest)
        2: { bg: '#00ff87', color: '#000000' }, // Light green
        3: { bg: '#ebebe4', color: '#000000' }, // Gray (neutral)
        4: { bg: '#ff1751', color: '#ffffff' }, // Pink/Red
        5: { bg: '#861247', color: '#ffffff' }  // Dark red (hardest)
    };
    return colors[difficulty] || colors[3];
}

/**
 * Calculate league ownership from cached rival teams
 * @param {number} playerId - Player ID to check
 * @param {Object} myTeamState - State object with rivalTeamCache
 * @returns {Object|null} Ownership stats with owner details
 */
function calculateLeagueOwnership(playerId, myTeamState) {
    if (!myTeamState || !myTeamState.rivalTeamCache || myTeamState.rivalTeamCache.size === 0) {
        return null;
    }

    const owners = [];
    const totalRivals = myTeamState.rivalTeamCache.size;

    // Get league standings to find ranks
    const activeLeagueId = myTeamState.activeLeagueTab;
    // Try both string and number keys since Map might store either
    let leagueData = null;
    if (activeLeagueId) {
        leagueData = myTeamState.leagueStandingsCache.get(activeLeagueId) ||
                     myTeamState.leagueStandingsCache.get(String(activeLeagueId)) ||
                     myTeamState.leagueStandingsCache.get(parseInt(activeLeagueId, 10));
    }
    const standings = leagueData?.standings?.results || [];

    // Find user's own points from standings
    const myTeamId = myTeamState.teamId;
    const myStanding = standings.find(s => parseInt(s.entry, 10) === parseInt(myTeamId, 10));
    const myPoints = myStanding?.total || 0;

    myTeamState.rivalTeamCache.forEach((rivalData, entryId) => {
        if (rivalData && rivalData.picks && rivalData.picks.picks) {
            const hasPlayer = rivalData.picks.picks.some(pick => pick.element === playerId);
            if (hasPlayer) {
                // Find this entry in standings to get rank (convert to number for comparison)
                const entryIdNum = parseInt(entryId, 10);
                const standingEntry = standings.find(s => parseInt(s.entry, 10) === entryIdNum);
                // Get team name from the rival's team data
                const teamName = rivalData.team?.name || standingEntry?.entry_name || 'Unknown';
                const ownerPoints = standingEntry?.total || 0;
                const pointsGap = ownerPoints - myPoints; // positive = they're ahead
                owners.push({
                    entryId,
                    name: teamName,
                    rank: standingEntry?.rank || 0,
                    points: ownerPoints,
                    gap: pointsGap
                });
            }
        }
    });

    // Sort by rank (or by points gap if no ranks)
    owners.sort((a, b) => {
        if (a.rank > 0 && b.rank > 0) {
            return a.rank - b.rank;
        }
        // Fall back to sorting by points gap (closest competitors first)
        return Math.abs(a.gap) - Math.abs(b.gap);
    });

    return {
        owners,
        total: totalRivals,
        percentage: totalRivals > 0 ? ((owners.length / totalRivals) * 100).toFixed(0) : 0
    };
}

/**
 * Get top 5 comparison players (same position, not in my team, sorted by form)
 * @param {Object} player - Current player
 * @param {Object} myTeamState - State with team data
 * @returns {Array} Top 5 comparison players
 */
function getComparisonPlayers(player, myTeamState) {
    const allPlayers = getAllPlayers();
    if (!allPlayers || allPlayers.length === 0) return [];

    // Get my team's player IDs
    let myPlayerIds = new Set();
    const cachedTeamId = localStorage.getItem('fplanner_team_id');
    if (cachedTeamId) {
        const cachedTeamData = localStorage.getItem(`fplanner_team_${cachedTeamId}`);
        if (cachedTeamData) {
            try {
                const teamData = JSON.parse(cachedTeamData);
                if (teamData && teamData.picks && teamData.picks.picks) {
                    myPlayerIds = new Set(teamData.picks.picks.map(p => p.element));
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

    // Filter: same position, not in my team, not the current player
    const samePosition = allPlayers.filter(p =>
        p.element_type === player.element_type &&
        p.id !== player.id &&
        !myPlayerIds.has(p.id)
    );

    // Sort by form descending
    samePosition.sort((a, b) => (parseFloat(b.form) || 0) - (parseFloat(a.form) || 0));

    // Return top 5
    return samePosition.slice(0, 5);
}

/**
 * Fetch player history from API
 * @param {number} playerId - Player ID
 * @returns {Promise<Object>} Player history data
 */
async function fetchPlayerHistory(playerId) {
    try {
        const response = await fetch(`/api/player/${playerId}/summary`);
        if (!response.ok) throw new Error('Failed to fetch player summary');
        return await response.json();
    } catch (err) {
        console.error('Failed to fetch player history:', err);
        return { history: [], fixtures: [] };
    }
}

/**
 * Show player modal with details
 * @param {number} playerId - Player ID
 * @param {Object} myTeamState - Optional state object for league ownership
 */
export async function showPlayerModal(playerId, myTeamState = null) {
    const player = getPlayerById(playerId);
    if (!player) return;

    const currentGW = getCurrentGW();
    const activeGW = getActiveGW(); // For UI display (Past/Upcoming)
    const team = getTeamShortName(player.team);
    const position = getPositionShort(player);
    const price = (player.now_cost / 10).toFixed(1);

    // Show loading modal first
    showLoadingModal(player, team, position, price);

    // Fetch player history
    const playerSummary = await fetchPlayerHistory(playerId);

    // Get GW stats from GitHub data
    const gwStats = player.github_gw || {};
    const gwPoints = player.event_points || 0;
    const minutes = gwStats.minutes || 0;
    const bps = gwStats.bps || 0;
    const goals = gwStats.goals_scored || 0;
    const assists = gwStats.assists || 0;
    const xG = gwStats.expected_goals ? parseFloat(gwStats.expected_goals).toFixed(2) : '0.00';
    const xA = gwStats.expected_assists ? parseFloat(gwStats.expected_assists).toFixed(2) : '0.00';

    // Check if player's match is live
    const matchStatus = getMatchStatus(player.team, activeGW, player);
    const isLive = matchStatus === 'LIVE';

    // Ownership stats
    const ownership = parseFloat(player.selected_by_percent) || 0;
    const leagueOwnership = calculateLeagueOwnership(playerId, myTeamState);

    // Past 3 GW history (exclude current active GW since it's shown in top-left)
    const history = playerSummary.history || [];
    // Filter to only GWs before the active GW, then take last 3
    const pastHistory = history.filter(h => h.round < activeGW);
    const past3GW = pastHistory.slice(-3).reverse();

    // Next 3 fixtures (after active GW)
    const upcomingFixtures = getUpcomingFixturesAfterGW(player, activeGW).slice(0, 3);

    // Get risk factors for this player
    const risks = analyzePlayerRisks(player);

    // Get comparison players (same position, not in my team, sorted by form)
    const comparisonPlayers = getComparisonPlayers(player, myTeamState);

    // Build modal HTML
    const modalHTML = buildModalHTML({
        player,
        team,
        position,
        price,
        currentGW: activeGW,  // Use activeGW for display
        gwPoints,
        minutes,
        bps,
        goals,
        assists,
        xG,
        xA,
        ownership,
        leagueOwnership,
        past3GW,
        upcomingFixtures,
        isLive,
        risks,
        comparisonPlayers
    });

    // Update modal content
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.innerHTML = modalHTML;
        attachModalListeners();
    }
}

/**
 * Show loading state modal
 */
function showLoadingModal(player, team, position, price) {
    // Remove existing modal
    const existingModal = document.getElementById('player-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const loadingHTML = `
        <div id="player-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        ">
            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                max-width: 500px;
                width: 100%;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <!-- Header -->
                <div style="
                    padding: 0.75rem 1rem;
                    border-bottom: 2px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                        ${escapeHtml(player.web_name)} <span style="color: var(--text-secondary); font-weight: 400;">• ${team} • ${position} • £${price}m</span>
                    </div>
                    <button
                        id="close-player-modal"
                        style="
                            background: transparent;
                            border: none;
                            font-size: 1.5rem;
                            color: var(--text-secondary);
                            cursor: pointer;
                            padding: 0;
                            width: 2rem;
                            height: 2rem;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        "
                    >
                        ×
                    </button>
                </div>
                <div style="padding: 3rem; text-align: center;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--text-secondary);"></i>
                    <p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.75rem;">Loading player data...</p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', loadingHTML);
    attachModalListeners();
}

/**
 * Build the full modal HTML
 */
function buildModalHTML(data) {
    const {
        player, team, position, price, currentGW,
        gwPoints, minutes, bps, goals, assists, xG, xA,
        ownership, leagueOwnership, past3GW, upcomingFixtures, isLive,
        risks, comparisonPlayers
    } = data;

    // LIVE indicator styles
    const liveIndicator = isLive ? `
        <span style="
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            padding: 0.1rem 0.35rem;
            border-radius: 0.25rem;
            font-size: 0.55rem;
            font-weight: 700;
            margin-left: 0.5rem;
            animation: pulse 2s infinite;
        ">
            <span style="width: 6px; height: 6px; background: #ef4444; border-radius: 50%; animation: pulse 1s infinite;"></span>
            LIVE
        </span>
    ` : '';

    // GW Stats section (top-left)
    const gwStatsHTML = `
        <div style="flex: 1; min-width: 140px;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                GW ${currentGW} Stats${liveIndicator}
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.7rem;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Points</span>
                    <span style="font-weight: 600;">${gwPoints}${isLive ? '*' : ''}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Minutes</span>
                    <span style="font-weight: 600;">${minutes}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">BPS</span>
                    <span style="font-weight: 600;">${bps}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Goals</span>
                    <span style="font-weight: 600;">${goals}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Assists</span>
                    <span style="font-weight: 600;">${assists}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">xG</span>
                    <span style="font-weight: 600;">${xG}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">xA</span>
                    <span style="font-weight: 600;">${xA}</span>
                </div>
            </div>
        </div>
    `;

    // Player Comparison section (top-right) - Top 5 same position players by form
    let comparisonHTML = `
        <div style="flex: 1; min-width: 140px;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                Alternatives
            </div>
    `;

    if (comparisonPlayers && comparisonPlayers.length > 0) {
        comparisonHTML += `<div style="display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.6rem;">`;
        comparisonPlayers.forEach(cp => {
            const cpGwPts = cp.event_points || 0;
            const cpPrice = (cp.now_cost / 10).toFixed(1);
            comparisonHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.15rem 0; gap: 0.25rem;">
                    <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(cp.web_name)}</span>
                    <span style="font-weight: 600; min-width: 2rem; text-align: right;">${cpGwPts} Pts</span>
                    <span style="color: var(--text-secondary); min-width: 2.5rem; text-align: right;">£${cpPrice}m</span>
                </div>
            `;
        });
        comparisonHTML += `</div>`;
    } else {
        comparisonHTML += `<div style="font-size: 0.65rem; color: var(--text-secondary);">No alternatives found</div>`;
    }
    comparisonHTML += `</div>`;

    // Merged Ownership + League Owners section (bottom-left)
    let ownershipAndLeagueHTML = `
        <div style="flex: 1; min-width: 140px;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                Ownership
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.7rem; margin-bottom: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Overall</span>
                    <span style="font-weight: 600;">${ownership.toFixed(1)}%</span>
                </div>
                ${leagueOwnership ? `
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">League</span>
                    <span style="font-weight: 600;">${leagueOwnership.owners.length}/${leagueOwnership.total} (${leagueOwnership.percentage}%)</span>
                </div>
                ` : ''}
            </div>
    `;

    // Add league owners list if available
    if (leagueOwnership && leagueOwnership.owners.length > 0) {
        ownershipAndLeagueHTML += `
            <div style="font-size: 0.65rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.25rem; text-transform: uppercase;">
                League Owners
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.1rem;">
        `;
        leagueOwnership.owners.forEach(owner => {
            // Show rank if available, otherwise show points gap
            let statusDisplay = '';
            let statusColor = 'var(--text-secondary)';
            if (owner.rank && owner.rank > 0) {
                statusDisplay = `#${owner.rank}`;
            } else if (owner.gap !== undefined) {
                // Show points gap with color coding
                if (owner.gap > 0) {
                    statusDisplay = `+${owner.gap}`;
                    statusColor = '#ef4444'; // Red - they're ahead
                } else if (owner.gap < 0) {
                    statusDisplay = `${owner.gap}`;
                    statusColor = '#22c55e'; // Green - we're ahead
                } else {
                    statusDisplay = '0';
                }
            } else {
                statusDisplay = '—';
            }
            ownershipAndLeagueHTML += `
                <div style="display: flex; justify-content: space-between; font-size: 0.6rem; padding: 0.15rem 0;">
                    <span style="color: ${statusColor}; min-width: 2.5rem; font-weight: 600;">${statusDisplay}</span>
                    <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; text-align: right;">${escapeHtml(owner.name)}</span>
                </div>
            `;
        });
        ownershipAndLeagueHTML += `</div>`;
    } else if (!leagueOwnership) {
        ownershipAndLeagueHTML += `
            <div style="font-size: 0.6rem; color: var(--text-secondary);">
                View Team page for league data
            </div>
        `;
    }
    ownershipAndLeagueHTML += `</div>`;

    // Risk indicator HTML - show all risk statements
    let riskHTML = '';
    if (risks && risks.length > 0) {
        const riskItems = risks.map(r => `${r.icon} ${r.message}`).join(' • ');
        riskHTML = `
            <div style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 0.25rem;">
                ${riskItems}
            </div>
        `;
    }

    // Injury/News banner - using FPL API data
    let injuryBannerHTML = '';
    if (player.news && player.news.trim() !== '') {
        const chanceOfPlaying = player.chance_of_playing_next_round;
        let bannerColor = '#fbbf24'; // Yellow default
        let bgColor = 'rgba(251, 191, 36, 0.15)';

        // Red for 0-25%, Orange for 26-50%, Yellow for 51-75%
        if (chanceOfPlaying !== null && chanceOfPlaying !== undefined) {
            if (chanceOfPlaying <= 25) {
                bannerColor = '#ef4444';
                bgColor = 'rgba(239, 68, 68, 0.15)';
            } else if (chanceOfPlaying <= 50) {
                bannerColor = '#f97316';
                bgColor = 'rgba(249, 115, 22, 0.15)';
            }
        }

        injuryBannerHTML = `
            <div style="
                background: ${bgColor};
                border-left: 3px solid ${bannerColor};
                padding: 0.5rem 0.75rem;
                margin-bottom: 0.75rem;
                border-radius: 0 0.25rem 0.25rem 0;
            ">
                <div style="font-size: 0.65rem; color: ${bannerColor}; font-weight: 600;">
                    ${escapeHtml(player.news)}
                </div>
            </div>
        `;
    }

    // Past 3 GW history (bottom-right top)
    let historyHTML = '';
    if (past3GW.length > 0) {
        const historyRows = past3GW.map(gw => {
            const opponentName = getTeamShortName(gw.opponent_team);
            const opponent = {
                name: opponentName,
                isHome: gw.was_home,
                difficulty: gw.difficulty || 3
            };

            return `
                <div style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.6rem; padding: 0.2rem 0;">
                    <span style="color: var(--text-secondary); min-width: 2rem;">GW${gw.round}</span>
                    ${renderOpponentBadge(opponent, 'small')}
                    <span style="margin-left: auto;">${gw.minutes}'</span>
                    <span style="font-weight: 600; min-width: 2rem; text-align: right;">${gw.total_points} pts</span>
                </div>
            `;
        }).join('');

        historyHTML = `
            <div style="margin-bottom: 0.75rem;">
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                    Past 3 GWs
                </div>
                ${historyRows}
            </div>
        `;
    }

    // Next 3 GWs fixtures (bottom-right bottom)
    let fixturesHTML = '';
    if (upcomingFixtures.length > 0) {
        const fixtureRows = upcomingFixtures.map(fixture => {
            const isHome = fixture.team_h === player.team;
            const opponentId = isHome ? fixture.team_a : fixture.team_h;
            const opponentName = getTeamShortName(opponentId);
            const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;
            const opponent = {
                name: opponentName,
                isHome: isHome,
                difficulty: difficulty || 3
            };

            // Format date in Singapore time
            let dateStr = '';
            if (fixture.kickoff_time) {
                const kickoff = new Date(fixture.kickoff_time);
                dateStr = kickoff.toLocaleString('en-SG', {
                    timeZone: 'Asia/Singapore',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).replace(',', '');
            }

            return `
                <div style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.6rem; padding: 0.2rem 0;">
                    <span style="color: var(--text-secondary); min-width: 2rem;">GW${fixture.event}</span>
                    ${renderOpponentBadge(opponent, 'small')}
                    <span style="color: var(--text-secondary); font-size: 0.55rem; margin-left: auto;">${dateStr}</span>
                </div>
            `;
        }).join('');

        fixturesHTML = `
            <div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                    Next 3 GWs
                </div>
                ${fixtureRows}
            </div>
        `;
    }

    return `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        ">
            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                max-width: 500px;
                width: 100%;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <!-- Header -->
                <div style="
                    padding: 0.75rem 1rem;
                    border-bottom: 2px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                ">
                    <div>
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                            ${escapeHtml(player.web_name)} <span style="font-weight: 400;">• </span><span style="
                                background: ${isColorDark(getTeamColor(player.team)) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)'};
                                color: ${getTeamColor(player.team)};
                                padding: 0.1rem 0.35rem;
                                border-radius: 0.2rem;
                                font-weight: 700;
                                font-size: 0.75rem;
                            ">${team}</span><span style="color: var(--text-secondary); font-weight: 400;"> • ${position} • £${price}m</span>
                        </div>
                        ${riskHTML}
                    </div>
                    <button
                        id="close-player-modal"
                        style="
                            background: transparent;
                            border: none;
                            font-size: 1.5rem;
                            color: var(--text-secondary);
                            cursor: pointer;
                            padding: 0;
                            width: 2rem;
                            height: 2rem;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        "
                    >
                        ×
                    </button>
                </div>

                <!-- Content: 4-quadrant layout -->
                <div style="padding: 0.75rem;">
                    <!-- Injury/News Banner -->
                    ${injuryBannerHTML}

                    <!-- Top row: GW Stats | Ownership + League Owners -->
                    <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
                        ${gwStatsHTML}
                        ${ownershipAndLeagueHTML}
                    </div>

                    <!-- Bottom row: History + Fixtures | Alternatives -->
                    <div style="display: flex; gap: 0.75rem;">
                        <div style="flex: 1; min-width: 140px;">
                            ${historyHTML}
                            ${fixturesHTML}
                        </div>
                        ${comparisonHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Attach modal event listeners
 */
function attachModalListeners() {
    const closeBtn = document.getElementById('close-player-modal');
    const modal = document.getElementById('player-modal');

    if (closeBtn) {
        closeBtn.addEventListener('click', closePlayerModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'player-modal') {
                closePlayerModal();
            }
        });
    }
}

/**
 * Close player modal
 */
export function closePlayerModal() {
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Get upcoming fixtures for a player after a specific GW
 * @param {Object} player - Player object
 * @param {number} afterGW - Get fixtures after this GW
 * @returns {Array} Upcoming fixtures
 */
function getUpcomingFixturesAfterGW(player, afterGW) {
    if (!fplFixtures || fplFixtures.length === 0) {
        return [];
    }

    // Use afterGW or fallback
    const gw = afterGW || getActiveGW() || 1;

    return fplFixtures
        .filter(f => f.event && f.event > gw)  // After the specified GW
        .filter(f => f.team_h === player.team || f.team_a === player.team)
        .sort((a, b) => a.event - b.event)
        .slice(0, 5);
}
