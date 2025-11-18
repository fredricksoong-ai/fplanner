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
                    Not good enough bro
                </div>
            `;
            return;
        }

        const position = userEntry.rank;
        const totalEntries = leagueData.standings.results.length;

        // Calculate gaps - F1 style (positive = ahead, negative = behind)
        const aboveEntry = leagueData.standings.results.find(e => e.rank === position - 1);
        const belowEntry = leagueData.standings.results.find(e => e.rank === position + 1);

        // Gap to person above (negative if behind)
        const gapAbove = aboveEntry ? userEntry.total - aboveEntry.total : null;
        // Gap to person below (positive if ahead)
        const gapBelow = belowEntry ? userEntry.total - belowEntry.total : null;

        // Build gap display with F1-style +/- format
        let gapDisplay = '';
        if (gapAbove !== null) {
            const gapAboveStr = gapAbove >= 0 ? `+${gapAbove}` : `${gapAbove}`;
            const gapAboveColor = gapAbove >= 0 ? '#22c55e' : '#ef4444';
            gapDisplay += `<span style="color: ${gapAboveColor};">${gapAboveStr}</span>`;
        }
        if (gapBelow !== null) {
            const gapBelowStr = gapBelow >= 0 ? `+${gapBelow}` : `${gapBelow}`;
            const gapBelowColor = gapBelow >= 0 ? '#22c55e' : '#ef4444';
            if (gapDisplay) gapDisplay += ' / ';
            gapDisplay += `<span style="color: ${gapBelowColor};">${gapBelowStr}</span>`;
        }
        if (!gapDisplay) {
            gapDisplay = '-';
        }

        // Get ordinal suffix for position
        const getOrdinalSuffix = (n) => {
            const s = ['th', 'st', 'nd', 'rd'];
            const v = n % 100;
            return s[(v - 20) % 10] || s[v] || s[0];
        };
        const ordinal = getOrdinalSuffix(position);
        const positionDisplay = `${position}<sup style="font-size: 0.5rem;">${ordinal}</sup>`;

        // Render league info
        placeholder.innerHTML = `
            <div style="font-size: 0.65rem; color: var(--text-secondary); line-height: 1.4;">
                <div style="margin-bottom: 0.15rem; font-weight: 600; color: var(--text-primary);">
                    League Position: ${positionDisplay} out of ${totalEntries}
                </div>
                <div>
                    Points Gap: ${gapDisplay}
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
