// ============================================================================
// PLAYER MODAL
// Detailed player stats modal with upcoming fixtures
// ============================================================================

import { getPlayerById } from '../../data.js';
import {
    getPositionShort,
    getTeamShortName,
    formatDecimal,
    escapeHtml,
    getCurrentGW,
    getDifficultyClass
} from '../../utils.js';
import { getFixtures } from '../../fixtures.js';

/**
 * Calculate league ownership from cached rival teams
 * @param {number} playerId - Player ID to check
 * @param {Object} myTeamState - State object with rivalTeamCache
 * @returns {Object|null} Ownership stats or null if no data
 */
function calculateLeagueOwnership(playerId, myTeamState) {
    if (!myTeamState || !myTeamState.rivalTeamCache || myTeamState.rivalTeamCache.size === 0) {
        return null;
    }

    let ownersCount = 0;
    const totalRivals = myTeamState.rivalTeamCache.size;

    myTeamState.rivalTeamCache.forEach((rivalData) => {
        if (rivalData && rivalData.picks && rivalData.picks.picks) {
            const hasPlayer = rivalData.picks.picks.some(pick => pick.element === playerId);
            if (hasPlayer) {
                ownersCount++;
            }
        }
    });

    return {
        owners: ownersCount,
        total: totalRivals
    };
}

/**
 * Show player modal with details
 * @param {number} playerId - Player ID
 * @param {Object} myTeamState - Optional state object for league ownership
 */
export function showPlayerModal(playerId, myTeamState = null) {
    const player = getPlayerById(playerId);
    if (!player) return;

    const currentGW = getCurrentGW();
    const team = getTeamShortName(player.team);
    const position = getPositionShort(player);
    const price = (player.now_cost / 10).toFixed(1);

    // Get GW stats
    const gwPoints = player.event_points || 0;
    const totalPoints = player.total_points || 0;

    // Get form & ownership
    const form = formatDecimal(player.form) || '0.0';
    const ownership = parseFloat(player.selected_by_percent) || 0;

    // Get GitHub GW stats (BPS, minutes, xG, xA, etc.)
    const gwStats = player.github_gw || {};
    const bps = gwStats.bps || 0;
    const minutes = gwStats.minutes || 0;
    const goals = gwStats.goals_scored || 0;
    const assists = gwStats.assists || 0;
    const cleanSheets = gwStats.clean_sheets || 0;
    const saves = gwStats.saves || 0;
    const xG = gwStats.expected_goals ? parseFloat(gwStats.expected_goals).toFixed(2) : '0.00';
    const xA = gwStats.expected_assists ? parseFloat(gwStats.expected_assists).toFixed(2) : '0.00';

    // Calculate league ownership from cached rivals
    const leagueOwnership = calculateLeagueOwnership(playerId, myTeamState);

    // Get next 5 fixtures
    const upcomingFixtures = getUpcomingFixtures(player, currentGW);
    const fixturesHTML = renderUpcomingFixtures(upcomingFixtures);

    // Build stats table rows
    const statsRows = [
        { label: `GW ${currentGW} Points`, value: gwPoints },
        { label: 'Total Points', value: totalPoints },
        { label: 'BPS', value: bps },
        { label: 'Minutes', value: minutes },
        { label: 'Form', value: form },
        { label: 'Goals', value: goals },
        { label: 'Assists', value: assists },
        { label: 'Clean Sheets', value: cleanSheets },
        { label: 'Saves', value: saves },
        { label: 'xG', value: xG },
        { label: 'xA', value: xA },
        { label: 'Ownership', value: `${ownership.toFixed(1)}%` }
    ];

    // Add league ownership if available
    if (leagueOwnership) {
        statsRows.push({
            label: 'League Ownership',
            value: `${leagueOwnership.owners}/${leagueOwnership.total}`
        });
    }

    const statsTableHTML = statsRows.map(row => `
        <div class="mobile-table-row" style="grid-template-columns: 1fr 1fr;">
            <div style="color: var(--text-secondary);">${row.label}</div>
            <div style="text-align: right; font-weight: 600; color: var(--text-primary);">${row.value}</div>
        </div>
    `).join('');

    // Enhanced modal with player details
    const modalHTML = `
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
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <!-- Header -->
                <div style="
                    padding: 1rem;
                    border-bottom: 2px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                ">
                    <div style="flex: 1;">
                        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.3rem 0;">
                            ${escapeHtml(player.web_name)}
                        </h3>
                        <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.875rem; color: var(--text-secondary);">
                            <span>${team}</span>
                            <span>•</span>
                            <span>${position}</span>
                            <span>•</span>
                            <span style="font-weight: 600; color: var(--text-primary);">£${price}m</span>
                        </div>
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

                <!-- Content -->
                <div style="padding: 0;">
                    <!-- Stats Table -->
                    <div class="mobile-table" style="border-radius: 0;">
                        <div class="mobile-table-header" style="grid-template-columns: 1fr 1fr; text-transform: capitalize;">
                            <div>Stat</div>
                            <div style="text-align: right;">Value</div>
                        </div>
                        ${statsTableHTML}
                    </div>

                    <!-- Upcoming Fixtures -->
                    <div style="
                        background: var(--bg-secondary);
                        border-top: 1px solid var(--border-color);
                        padding: 0.75rem;
                    ">
                        <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                            Next 5 Fixtures
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${fixturesHTML}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('player-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    document.getElementById('close-player-modal').addEventListener('click', closePlayerModal);
    document.getElementById('player-modal').addEventListener('click', (e) => {
        if (e.target.id === 'player-modal') {
            closePlayerModal();
        }
    });
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
 * Get upcoming fixtures for a player
 * @param {Object} player - Player object
 * @param {number} currentGW - Current gameweek
 * @returns {Array} Upcoming fixtures
 */
function getUpcomingFixtures(player, currentGW) {
    const allFixtures = getFixtures();
    return allFixtures
        .filter(f => f.event && f.event >= currentGW)
        .filter(f => f.team_h === player.team || f.team_a === player.team)
        .sort((a, b) => a.event - b.event)
        .slice(0, 5);
}

/**
 * Render upcoming fixtures HTML
 * @param {Array} fixtures - Fixtures array
 * @returns {string} HTML for fixtures
 */
function renderUpcomingFixtures(fixtures) {
    if (fixtures.length === 0) {
        return '<div style="text-align: center; color: var(--text-secondary); font-size: 0.75rem; padding: 0.5rem;">No upcoming fixtures available</div>';
    }

    return fixtures.map(fixture => {
        const isHome = fixture.team_h === fixture.team;
        const opponentId = isHome ? fixture.team_a : fixture.team_h;
        const opponentName = getTeamShortName(opponentId);
        const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

        return `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="font-size: 0.7rem; color: var(--text-secondary); min-width: 2.5rem;">
                    GW${fixture.event}
                </div>
                <span class="${getDifficultyClass(difficulty)}" style="
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    font-weight: 600;
                    font-size: 0.75rem;
                    flex: 1;
                    text-align: center;
                ">
                    ${opponentName} (${isHome ? 'H' : 'A'})
                </span>
            </div>
        `;
    }).join('');
}
