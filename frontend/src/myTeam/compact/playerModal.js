// ============================================================================
// PLAYER MODAL
// Detailed player stats modal with 4-quadrant layout
// ============================================================================

import { getPlayerById, fplFixtures, getActiveGW } from '../../data.js';
import {
    getPositionShort,
    getTeamShortName,
    escapeHtml,
    getCurrentGW,
    getDifficultyClass
} from '../../utils.js';
import { getMatchStatus } from '../../fixtures.js';

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
    const leagueData = activeLeagueId ? myTeamState.leagueStandingsCache.get(activeLeagueId) : null;
    const standings = leagueData?.standings?.results || [];

    myTeamState.rivalTeamCache.forEach((rivalData, entryId) => {
        if (rivalData && rivalData.picks && rivalData.picks.picks) {
            const hasPlayer = rivalData.picks.picks.some(pick => pick.element === playerId);
            if (hasPlayer) {
                // Find this entry in standings to get rank
                const standingEntry = standings.find(s => s.entry === entryId);
                // Get team name from the rival's team data
                const teamName = rivalData.team?.name || standingEntry?.entry_name || 'Unknown';
                owners.push({
                    entryId,
                    name: teamName,
                    rank: standingEntry?.rank || 0
                });
            }
        }
    });

    // Sort by rank
    owners.sort((a, b) => {
        const rankA = typeof a.rank === 'number' ? a.rank : 999;
        const rankB = typeof b.rank === 'number' ? b.rank : 999;
        return rankA - rankB;
    });

    return {
        owners,
        total: totalRivals,
        percentage: totalRivals > 0 ? ((owners.length / totalRivals) * 100).toFixed(0) : 0
    };
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
        isLive
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
        ownership, leagueOwnership, past3GW, upcomingFixtures, isLive
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

    // Ownership section (top-right)
    const ownershipHTML = `
        <div style="flex: 1; min-width: 140px;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                Ownership
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.7rem;">
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
        </div>
    `;

    // League owners section (bottom-left)
    let leagueOwnersHTML = '';
    if (leagueOwnership && leagueOwnership.owners.length > 0) {
        const ownersList = leagueOwnership.owners.map(owner => `
            <div style="display: flex; justify-content: space-between; font-size: 0.65rem; padding: 0.2rem 0;">
                <span style="color: var(--text-secondary);">#${owner.rank || '—'}</span>
                <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100px;">${escapeHtml(owner.name)}</span>
            </div>
        `).join('');

        leagueOwnersHTML = `
            <div style="flex: 1; min-width: 140px;">
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                    League Owners
                </div>
                <div style="max-height: 120px; overflow-y: auto;">
                    ${ownersList}
                </div>
            </div>
        `;
    } else {
        leagueOwnersHTML = `
            <div style="flex: 1; min-width: 140px;">
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                    League Owners
                </div>
                <div style="font-size: 0.65rem; color: var(--text-secondary);">
                    ${leagueOwnership ? 'No league owners' : 'Select a league to view'}
                </div>
            </div>
        `;
    }

    // Past 3 GW history (bottom-right top)
    let historyHTML = '';
    if (past3GW.length > 0) {
        const historyRows = past3GW.map(gw => {
            const opponentName = getTeamShortName(gw.opponent_team);
            const isHome = gw.was_home;
            const difficulty = gw.difficulty || 3;

            return `
                <div style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.65rem; padding: 0.2rem 0;">
                    <span style="color: var(--text-secondary); min-width: 2rem;">GW${gw.round}</span>
                    <span class="${getDifficultyClass(difficulty)}" style="
                        padding: 0.15rem 0.3rem;
                        border-radius: 0.2rem;
                        font-weight: 600;
                        font-size: 0.6rem;
                        min-width: 3rem;
                        text-align: center;
                    ">
                        ${opponentName} (${isHome ? 'H' : 'A'})
                    </span>
                    <span style="margin-left: auto;">${gw.minutes}'</span>
                    <span style="font-weight: 600; min-width: 2.5rem; text-align: right;">${gw.total_points} pts</span>
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

    // Next 3 fixtures (bottom-right bottom)
    let fixturesHTML = '';
    if (upcomingFixtures.length > 0) {
        const fixtureRows = upcomingFixtures.map(fixture => {
            const isHome = fixture.team_h === player.team;
            const opponentId = isHome ? fixture.team_a : fixture.team_h;
            const opponentName = getTeamShortName(opponentId);
            const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

            return `
                <div style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.65rem; padding: 0.2rem 0;">
                    <span style="color: var(--text-secondary); min-width: 2rem;">GW${fixture.event}</span>
                    <span class="${getDifficultyClass(difficulty)}" style="
                        padding: 0.15rem 0.4rem;
                        border-radius: 0.2rem;
                        font-weight: 600;
                        flex: 1;
                        text-align: center;
                    ">
                        ${opponentName} (${isHome ? 'H' : 'A'})
                    </span>
                </div>
            `;
        }).join('');

        fixturesHTML = `
            <div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                    Upcoming
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

                <!-- Content: 4-quadrant layout -->
                <div style="padding: 0.75rem;">
                    <!-- Top row: GW Stats | Ownership -->
                    <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
                        ${gwStatsHTML}
                        ${ownershipHTML}
                    </div>

                    <!-- Bottom row: League Owners | History + Fixtures -->
                    <div style="display: flex; gap: 0.75rem;">
                        ${leagueOwnersHTML}
                        <div style="flex: 1; min-width: 140px;">
                            ${historyHTML}
                            ${fixturesHTML}
                        </div>
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
