// ============================================================================
// RIVAL TEAM PAGE MODULE
// Renders a rival's team using the same compact view as My Team
// ============================================================================

import {
    loadMyTeam,
    isGameweekLive,
    getActiveGW,
    getPlayerById
} from './data.js';

import {
    renderCompactTeamList,
    renderMatchSchedule,
    attachPlayerRowListeners
} from './renderMyTeamCompact.js';

import { escapeHtml } from './utils.js';

import {
    calculateRankIndicator,
    calculateGWIndicator
} from './myTeam/compact/compactStyleHelpers.js';

import { sharedState } from './sharedState.js';

// State for rival team page
let rivalTeamState = {
    teamData: null,
    rivalTeamCache: sharedState.rivalTeamCache,
    selectedLeagues: [], // For league ownership comparison
    leagueStandingsCache: sharedState.leagueStandingsCache,
    captainCache: sharedState.captainCache
};

/**
 * Render rival team page
 * @param {number} rivalId - Rival team ID to load and display
 * @param {number} leagueId - League ID context (for showing league rank)
 */
export async function renderRivalTeam(rivalId, leagueId = null) {
    // Store league context for this rival view
    rivalTeamState.leagueContext = leagueId;
    const container = document.getElementById('app-container');

    if (!rivalId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 1rem; color: #ef4444;"></i>
                <p>No rival team specified</p>
                <button
                    onclick="window.navigateToPage('my-team')"
                    style="
                        margin-top: 1rem;
                        padding: 0.5rem 1rem;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                    "
                >
                    <i class="fas fa-arrow-left"></i> Back to My Team
                </button>
            </div>
        `;
        return;
    }

    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p>Loading rival team...</p>
        </div>
    `;

    try {
        // Check cache first
        let rivalTeamData;
        if (rivalTeamState.rivalTeamCache.has(rivalId)) {
            console.log(`✅ Using cached data for rival team ${rivalId}`);
            rivalTeamData = rivalTeamState.rivalTeamCache.get(rivalId);
        } else {
            // Load rival's team data
            console.log(`🔄 Loading rival team ${rivalId}...`);
            rivalTeamData = await loadMyTeam(rivalId);
            rivalTeamState.rivalTeamCache.set(rivalId, rivalTeamData);
        }

        rivalTeamState.teamData = rivalTeamData;

        // Load selected leagues from localStorage for ownership comparison
        const savedLeagues = localStorage.getItem('fplanner_selected_leagues');
        if (savedLeagues) {
            try {
                rivalTeamState.selectedLeagues = JSON.parse(savedLeagues);
            } catch (err) {
                console.error('Failed to parse saved leagues:', err);
                rivalTeamState.selectedLeagues = [];
            }
        }

        // Set league context for the rival team so compactHeader can show league info
        if (rivalTeamState.leagueContext) {
            localStorage.setItem(`fpl_selected_league_${rivalId}`, rivalTeamState.leagueContext);
        }

        // Render the rival team view
        renderRivalTeamView(rivalTeamData);

    } catch (err) {
        console.error('Failed to load rival team:', err);
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 1rem; color: #ef4444;"></i>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary);">Failed to Load Rival Team</h2>
                <p style="margin-bottom: 1rem;">${err.message}</p>
                <button
                    onclick="window.navigateToPage('my-team')"
                    style="
                        padding: 0.5rem 1rem;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                    "
                >
                    <i class="fas fa-arrow-left"></i> Back to My Team
                </button>
            </div>
        `;
    }
}

/**
 * Render the rival team view with compact components
 * @param {Object} teamData - Rival team data
 */
function renderRivalTeamView(teamData) {
    const container = document.getElementById('app-container');
    const { picks, gameweek, team } = teamData;
    const gwNumber = getActiveGW();
    const isLive = isGameweekLive();

    console.log(`🎨 Rendering rival team: ${team.name}`);

    // Sort players by position order (GK, DEF, MID, FWD, then bench)
    const sortedPicks = [...picks.picks].sort((a, b) => a.position - b.position);

    // Prepare team data for compact components
    const compactTeamData = {
        picks: picks,
        team: team,
        isLive: isLive
    };

    // Build HTML with compact view (no back button - use nav bar)
    const html = `
        <!-- Compact Header (modified for rival) -->
        ${renderRivalCompactHeader(compactTeamData, gwNumber)}

        <!-- Team List -->
        ${renderCompactTeamList(sortedPicks, gwNumber, isLive)}

        <!-- Match Schedule -->
        ${renderMatchSchedule(sortedPicks, gwNumber)}
    `;

    container.innerHTML = html;

    // Attach event listeners for player rows
    requestAnimationFrame(() => {
        attachPlayerRowListeners(rivalTeamState);
    });
}

/**
 * Render compact header for rival team (same as Team page, no league info)
 * @param {Object} teamData - Team data
 * @param {number} gwNumber - Gameweek number
 * @returns {string} HTML for header
 */
function renderRivalCompactHeader(teamData, gwNumber) {
    const { picks, team, isLive } = teamData;
    const entry = picks.entry_history;

    // Calculate GW points
    let gwPoints = entry?.points ?? 0;

    const totalPoints = team.summary_overall_points || 0;
    const overallRankNum = team.summary_overall_rank || 0;
    const gwRankNum = team.summary_event_rank || 0;
    const overallRank = overallRankNum ? overallRankNum.toLocaleString() : 'N/A';
    const gwRank = gwRankNum ? gwRankNum.toLocaleString() : 'N/A';

    // Team value and bank
    const bank = ((entry.bank || 0) / 10).toFixed(1);
    const squadValue = ((entry.value || 0) / 10 - (entry.bank || 0) / 10).toFixed(1);
    const freeTransfers = entry.event_transfers || 0;
    const transferCost = entry.event_transfers_cost || 0;

    // Calculate rank indicators (chevrons) using helpers
    const rankIndicator = calculateRankIndicator(team.id, overallRankNum);
    const gwIndicator = calculateGWIndicator(gwRankNum, overallRankNum);

    return `
        <div
            id="compact-header"
            style="
                position: sticky;
                top: calc(3.5rem + env(safe-area-inset-top));
                background: var(--bg-primary);
                z-index: 100;
                padding: 0.5rem 0;
                border-bottom: 2px solid var(--border-color);
                margin: 0;
            "
        >
            <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 0.5rem;">
                <div style="flex: 1; display: grid; gap: 0.2rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <div style="
                            background: var(--bg-tertiary);
                            border-radius: 0.3rem;
                            padding: 0.2rem 0.35rem;
                            display: flex;
                            align-items: center;
                            gap: 0.3rem;
                        ">
                            <i class="fas fa-user-friends" style="font-size: 0.7rem; color: var(--text-secondary);"></i>
                        </div>
                        <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; flex: 1;">
                            ${escapeHtml(team.name)}
                        </div>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Overall Points: ${totalPoints.toLocaleString()}
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Overall Rank: ${overallRank} <span style="color: ${rankIndicator.color};">${rankIndicator.chevron}</span>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        GW Rank: ${gwRank} <span style="color: ${gwIndicator.color};">${gwIndicator.chevron}</span>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Squad Value: £${squadValue}m + £${bank}m
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Transfers: ${freeTransfers} FT${transferCost > 0 ? ` (-${transferCost} pts)` : ''}
                    </div>
                </div>

                <div style="display: flex; align-items: stretch;">
                    <div style="
                        background: var(--bg-primary);
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        padding: 0.3rem 0.6rem;
                        text-align: center;
                        min-width: 90px;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        box-shadow: 0 1px 3px var(--shadow);
                    ">
                        <div style="font-size: 2rem; font-weight: 800; color: ${gwIndicator.color}; line-height: 1;">
                            ${gwPoints}
                        </div>
                        <div style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 0.1rem; font-weight: 600;">
                            GW ${gwNumber}${isLive ? ' <span style="color: #ef4444; animation: pulse 2s infinite;">⚽ LIVE</span>' : ''}
                        </div>
                        ${isLive ? '<style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }</style>' : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}
