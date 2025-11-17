/**
 * League Info Helper
 * Handles fetching and rendering league position data for mobile compact header
 */

import { loadLeagueStandings } from './data.js';

/**
 * Load and render league info into the placeholder
 */
export async function loadAndRenderLeagueInfo() {
    const placeholder = document.getElementById('league-info-placeholder');
    if (!placeholder) return;

    const teamId = parseInt(placeholder.dataset.teamId, 10);
    const leagueId = parseInt(placeholder.dataset.leagueId, 10);

    if (!teamId || !leagueId) return;

    try {
        const leagueData = await loadLeagueStandings(leagueId);

        // Find user's position in standings
        const userEntry = leagueData.standings.results.find(entry => entry.entry === teamId);

        if (!userEntry) {
            placeholder.innerHTML = `
                <div style="font-size: 0.65rem; color: var(--text-secondary);">
                    Not in this league
                </div>
            `;
            return;
        }

        const position = userEntry.rank;
        const totalEntries = leagueData.standings.results.length;
        const leagueName = leagueData.league.name;

        // Calculate gaps
        const aboveEntry = leagueData.standings.results.find(e => e.rank === position - 1);
        const belowEntry = leagueData.standings.results.find(e => e.rank === position + 1);

        const gapAbove = aboveEntry ? userEntry.total - aboveEntry.total : 0;
        const gapBelow = belowEntry ? belowEntry.total - userEntry.total : 0;

        // Build gap display - always show gaps if they exist
        let gapDisplay = '';
        if (position > 1 && gapAbove < 0) {
            // Chase gap (points behind leader)
            gapDisplay += `<span style="color: #ef4444;">↑${Math.abs(gapAbove)}</span>`;
        }
        if (position < totalEntries && gapBelow > 0) {
            // Buffer gap (points ahead of person below)
            if (gapDisplay) gapDisplay += ' / ';
            gapDisplay += `<span style="color: #22c55e;">↓${gapBelow}</span>`;
        }
        if (position === 1 && gapBelow > 0) {
            // In first place - show how far ahead of 2nd place
            gapDisplay = `<span style="color: #22c55e;">↓${gapBelow} ahead</span>`;
        }
        if (!gapDisplay) {
            gapDisplay = '-';
        }

        // Calculate league average
        const totalPoints = leagueData.standings.results.reduce((sum, e) => sum + e.total, 0);
        const leagueAvg = Math.round(totalPoints / totalEntries);
        const vsAvg = userEntry.total - leagueAvg;
        const vsAvgDisplay = vsAvg >= 0
            ? `<span style="color: #22c55e;">+${vsAvg}</span>`
            : `<span style="color: #ef4444;">${vsAvg}</span>`;

        // Render league info
        placeholder.innerHTML = `
            <div style="font-size: 0.65rem; color: var(--text-secondary); line-height: 1.3;">
                <div style="margin-bottom: 0.1rem; font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(leagueName.length > 18 ? leagueName.substring(0, 18) + '...' : leagueName)}: ${position}/${totalEntries}
                </div>
                <div style="display: flex; gap: 0.75rem;">
                    <span>Gap: ${gapDisplay}</span>
                    <span>Avg: ${vsAvgDisplay}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load league info:', error);
        placeholder.innerHTML = `
            <div style="font-size: 0.65rem; color: var(--text-secondary);">
                Failed to load
            </div>
        `;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Initialize league selector dropdown
 */
export async function initializeLeagueSelector(teamId) {
    const selector = document.getElementById('mobile-league-selector');
    if (!selector) return;

    try {
        // Fetch team data to get leagues
        const response = await fetch(`/api/team/${teamId}`);
        const data = await response.json();
        const leagues = data.team?.leagues?.classic || [];

        // Get currently selected league
        const selectedLeagueId = localStorage.getItem(`fpl_selected_league_${teamId}`);

        // Populate dropdown
        selector.innerHTML = `
            <option value="">Select a league...</option>
            ${leagues.map(league => `
                <option value="${league.id}" ${selectedLeagueId == league.id ? 'selected' : ''}>
                    ${escapeHtml(league.name)}
                </option>
            `).join('')}
        `;

        // Add change handler
        selector.addEventListener('change', async (e) => {
            const leagueId = e.target.value;

            if (leagueId) {
                localStorage.setItem(`fpl_selected_league_${teamId}`, leagueId);
                console.log('✅ League selected:', leagueId);
            } else {
                localStorage.removeItem(`fpl_selected_league_${teamId}`);
                console.log('✅ League selection cleared');
            }

            // Reload the page to update league info
            window.location.reload();
        });
    } catch (error) {
        console.error('Failed to load leagues for selector:', error);
        selector.innerHTML = '<option value="">Failed to load leagues</option>';
    }
}
