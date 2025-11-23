// ============================================================================
// RIVAL TEAM PAGE MODULE
// Renders a rival's team using the same compact view as My Team
// ============================================================================

import {
    loadMyTeam,
    isGameweekLive,
    getActiveGW
} from './data.js';

import {
    renderCompactHeader,
    renderCompactTeamList,
    renderMatchSchedule,
    attachPlayerRowListeners
} from './renderMyTeamCompact.js';

import { sharedState } from './sharedState.js';

// State for rival team page
let rivalTeamState = {
    teamData: null,
    rivalTeamCache: sharedState.rivalTeamCache
};

/**
 * Render rival team page
 * @param {number} rivalId - Rival team ID to load and display
 */
export async function renderRivalTeam(rivalId) {
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

    // Build HTML with back button and compact view
    const html = `
        <!-- Back Navigation -->
        <div style="
            position: sticky;
            top: env(safe-area-inset-top);
            background: var(--bg-primary);
            z-index: 200;
            padding: 0.5rem 1rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        ">
            <button
                id="back-to-leagues-btn"
                onclick="window.navigateToPage('my-team'); setTimeout(() => { const event = new CustomEvent('switchToLeagues'); window.dispatchEvent(event); }, 100);"
                style="
                    background: transparent;
                    border: 1px solid var(--border-color);
                    border-radius: 0.3rem;
                    padding: 0.4rem 0.6rem;
                    color: var(--text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    font-size: 0.8rem;
                "
            >
                <i class="fas fa-arrow-left"></i>
                <span>Back to Leagues</span>
            </button>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">
                Viewing rival team
            </div>
        </div>

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
 * Render compact header for rival team (without change team button)
 * @param {Object} teamData - Team data
 * @param {number} gwNumber - Gameweek number
 * @returns {string} HTML for header
 */
function renderRivalCompactHeader(teamData, gwNumber) {
    // Use the standard compact header but we'll modify the team name display
    const headerHtml = renderCompactHeader(teamData, gwNumber, false);

    // Replace the change team button with a rival indicator
    return headerHtml.replace(
        /<button\s+id="change-team-btn"[\s\S]*?<\/button>/,
        `<div style="
            background: var(--bg-tertiary);
            border-radius: 0.3rem;
            padding: 0.2rem 0.35rem;
            display: flex;
            align-items: center;
            gap: 0.3rem;
        ">
            <i class="fas fa-user-friends" style="font-size: 0.7rem; color: var(--text-secondary);"></i>
        </div>`
    );
}
