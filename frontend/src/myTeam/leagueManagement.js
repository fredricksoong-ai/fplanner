// ============================================================================
// LEAGUE MANAGEMENT MODULE
// Handles league selection, tabs, and UI state for My Leagues feature
// ============================================================================

import { escapeHtml } from '../utils.js';
import { shouldUseMobileLayout } from '../renderMyTeamMobile.js';
import { sharedState } from '../sharedState.js';

/**
 * Render My Leagues tab content with side menu layout
 * @param {Object} teamData - Team data from API
 * @param {Object} myTeamState - Current state object
 * @param {Function} loadLeagueStandingsForTab - Callback to load standings
 * @param {Function} renderLeagueTabs - Function to render league tabs
 * @param {Function} renderLeagueContent - Function to render league content
 * @returns {string} HTML for leagues tab
 */
export function renderLeaguesTab(teamData, myTeamState, loadLeagueStandingsForTab, renderLeagueTabs, renderLeagueContent) {
    const { team } = teamData;

    // Set active league tab to first selected league if not set
    if (myTeamState.selectedLeagues.length > 0 && !myTeamState.activeLeagueTab) {
        myTeamState.activeLeagueTab = myTeamState.selectedLeagues[0];
        sharedState.activeLeagueTab = myTeamState.activeLeagueTab;
    }

    // Use dropdown selector for both mobile and desktop (matching mobile style)
    const leagues = team.leagues?.classic || [];
    const teamId = team.id;
    const selectedLeagueId = localStorage.getItem(`fpl_selected_league_${teamId}`) || (leagues.length > 0 ? leagues[0].id.toString() : '');

    const html = `
        <div>
            <!-- League Selector -->
            <div style="margin-bottom: 0.75rem; padding-top: 0.75rem;">
                <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem; padding: 0 0.75rem;">
                    Select League
                </label>
                <select
                    id="desktop-leagues-dropdown"
                    style="
                        width: calc(100% - 1.5rem);
                        margin: 0 0.75rem;
                        padding: 0.5rem;
                        font-size: 0.85rem;
                        background: var(--bg-secondary);
                        border: 1px solid var(--border-color);
                        border-radius: 0.5rem;
                        color: var(--text-primary);
                        cursor: pointer;
                    "
                >
                    ${leagues.map(league => `
                        <option value="${league.id}" ${league.id.toString() === selectedLeagueId ? 'selected' : ''}>
                            ${escapeHtml(league.name)} (Rank: ${league.entry_rank || 'N/A'})
                        </option>
                    `).join('')}
                </select>
            </div>

            <!-- League Standings Container -->
            <div id="desktop-league-standings">
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Loading league standings...</p>
                </div>
            </div>

            <!-- Modal for team comparison -->
            <div id="comparison-modal" style="display: none;"></div>
        </div>
    `;

    // Load standings after DOM is ready
    requestAnimationFrame(async () => {
        if (selectedLeagueId) {
            await loadDesktopLeagueStandings(selectedLeagueId, myTeamState);
        }

        // Add event listener for league selector
        const dropdown = document.getElementById('desktop-leagues-dropdown');
        if (dropdown) {
            dropdown.addEventListener('change', async (e) => {
                const leagueId = e.target.value;
                localStorage.setItem(`fpl_selected_league_${teamId}`, leagueId);
                await loadDesktopLeagueStandings(leagueId, myTeamState);
            });
        }
    });

    return html;
}

/**
 * Load and render league standings for desktop view
 * @param {string} leagueId - League ID to load
 * @param {Object} myTeamState - Current state object
 */
async function loadDesktopLeagueStandings(leagueId, myTeamState) {
    // Import here to avoid circular dependency
    return import('./leagueStandings.js').then(({ loadMobileLeagueStandings }) => {
        return loadMobileLeagueStandings(leagueId, myTeamState);
    });
}

/**
 * Render league side menu (replaces old card grid)
 * @param {Object} team - Team object with leagues data
 * @param {Object} myTeamState - Current state object
 * @returns {string} HTML for league side menu
 */
export function renderLeagueSideMenu(team, myTeamState) {
    if (!team.leagues || !team.leagues.classic || team.leagues.classic.length === 0) {
        return `
            <div style="text-align: center; padding: 1rem;">
                <i class="fas fa-info-circle" style="font-size: 1.5rem; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;"></i>
                <p style="color: var(--text-secondary); font-size: 0.875rem;">No leagues found. Join a league first!</p>
            </div>
        `;
    }

    const leagues = team.leagues.classic;

    // Sort leagues by entry_rank (user's rank in league)
    const sortedLeagues = [...leagues].sort((a, b) => {
        if (!a.entry_rank) return 1;
        if (!b.entry_rank) return -1;
        return a.entry_rank - b.entry_rank;
    });

    return `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${sortedLeagues.map(league => {
                const isSelected = myTeamState.selectedLeagues.includes(league.id);
                const canSelect = isSelected || myTeamState.selectedLeagues.length < 3;

                return `
                    <div
                        class="league-menu-item ${canSelect ? 'selectable' : 'disabled'}"
                        data-league-id="${league.id}"
                        style="
                            background: ${isSelected ? 'var(--primary-color)' : 'var(--bg-primary)'};
                            color: ${isSelected ? 'white' : 'var(--text-primary)'};
                            padding: 0.875rem;
                            border-radius: 8px;
                            border: 2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'};
                            cursor: ${canSelect ? 'pointer' : 'not-allowed'};
                            transition: all 0.2s;
                            opacity: ${canSelect ? '1' : '0.5'};
                            display: flex;
                            align-items: center;
                            gap: 0.75rem;
                        "
                    >
                        <div>
                            <i class="fas fa-${isSelected ? 'check-square' : 'square'}" style="font-size: 1.25rem;"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(league.name)}">
                                ${escapeHtml(league.name)}
                            </div>
                            <div style="font-size: 0.75rem; opacity: 0.8;">
                                Rank: ${league.entry_rank ? league.entry_rank.toLocaleString() : 'N/A'}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <p style="color: var(--text-secondary); font-size: 0.75rem; text-align: center;" id="league-selection-count">
                ${myTeamState.selectedLeagues.length}/3 leagues selected
            </p>
        </div>
    `;
}

/**
 * Toggle league selection (with dynamic tab management)
 * @param {number} leagueId - League ID to toggle
 * @param {Object} myTeamState - Current state object
 * @param {Function} updateLeagueMenuItemUI - Callback to update menu item UI
 * @param {Function} updateLeagueSelectionCount - Callback to update selection count
 * @param {Function} updateLeagueTabsUI - Callback to update tabs UI
 * @param {Function} updateLeagueContentUI - Callback to update content UI
 * @param {Function} loadLeagueStandingsForTab - Callback to load standings
 */
export function toggleLeagueSelection(
    leagueId,
    myTeamState,
    updateLeagueMenuItemUI,
    updateLeagueSelectionCount,
    updateLeagueTabsUI,
    updateLeagueContentUI,
    loadLeagueStandingsForTab
) {
    console.log(`🔄 Toggle league selection: ${leagueId}`);

    const index = myTeamState.selectedLeagues.indexOf(leagueId);
    const wasSelected = index > -1;

    if (wasSelected) {
        // Deselect - remove from selected leagues
        myTeamState.selectedLeagues.splice(index, 1);
        console.log(`➖ Deselected league ${leagueId}`);

        // If this was the active tab, switch to another tab or clear
        if (myTeamState.activeLeagueTab === leagueId) {
            myTeamState.activeLeagueTab = myTeamState.selectedLeagues[0] || null;
            sharedState.activeLeagueTab = myTeamState.activeLeagueTab;
            console.log(`🔄 Active tab changed to: ${myTeamState.activeLeagueTab}`);
        }
    } else {
        // Select (if under limit)
        if (myTeamState.selectedLeagues.length >= 3) {
            console.warn('⚠️ Already at max 3 leagues');
            return; // Already at max, do nothing
        }
        myTeamState.selectedLeagues.push(leagueId);
        console.log(`✅ Selected league ${leagueId}`);

        // Set newly selected league as active tab
        myTeamState.activeLeagueTab = leagueId;
        sharedState.activeLeagueTab = leagueId;
        console.log(`🎯 Set as active tab: ${leagueId}`);
    }

    // Save to localStorage
    localStorage.setItem('fplanner_selected_leagues', JSON.stringify(myTeamState.selectedLeagues));

    // Update UI: menu item, tabs, and content
    updateLeagueMenuItemUI(leagueId, !wasSelected);
    updateLeagueSelectionCount();
    updateLeagueTabsUI();
    updateLeagueContentUI();

    // Load data for newly selected league
    if (!wasSelected && !myTeamState.leagueStandingsCache.has(leagueId)) {
        console.log(`📥 Loading data for league ${leagueId}...`);
        loadLeagueStandingsForTab(leagueId);
    }
}

/**
 * Update a single league menu item's UI without re-rendering
 * @param {number} leagueId - League ID to update
 * @param {boolean} isSelected - Whether league is selected
 * @param {Object} myTeamState - Current state object
 */
export function updateLeagueMenuItemUI(leagueId, isSelected, myTeamState) {
    const menuItem = document.querySelector(`.league-menu-item[data-league-id="${leagueId}"]`);
    if (!menuItem) return;

    // Update menu item styling
    menuItem.style.background = isSelected ? 'var(--primary-color)' : 'var(--bg-primary)';
    menuItem.style.color = isSelected ? 'white' : 'var(--text-primary)';
    menuItem.style.borderColor = isSelected ? 'var(--primary-color)' : 'var(--border-color)';

    // Update icon
    const icon = menuItem.querySelector('i.fas');
    if (icon) {
        icon.className = isSelected ? 'fas fa-check-square' : 'fas fa-square';
    }

    // Update all menu items' selectability
    const allMenuItems = document.querySelectorAll('.league-menu-item');
    allMenuItems.forEach(item => {
        const itemId = parseInt(item.dataset.leagueId);
        const itemIsSelected = myTeamState.selectedLeagues.includes(itemId);
        const canSelect = itemIsSelected || myTeamState.selectedLeagues.length < 3;

        item.classList.toggle('selectable', canSelect);
        item.classList.toggle('disabled', !canSelect);
        item.style.cursor = canSelect ? 'pointer' : 'not-allowed';
        item.style.opacity = canSelect ? '1' : '0.5';
    });
}

/**
 * Update league selection count text
 */
export function updateLeagueSelectionCount(myTeamState) {
    const countText = document.getElementById('league-selection-count');
    if (countText) {
        countText.textContent = `${myTeamState.selectedLeagues.length}/3 leagues selected`;
    }
}

/**
 * Switch to a specific league tab
 * @param {number} leagueId - League ID to switch to
 * @param {Object} myTeamState - Current state object
 * @param {Function} updateLeagueTabsUI - Callback to update tabs UI
 * @param {Function} updateLeagueContentUI - Callback to update content UI
 * @param {Function} loadLeagueStandingsForTab - Callback to load standings
 */
export function switchLeagueTab(leagueId, myTeamState, updateLeagueTabsUI, updateLeagueContentUI, loadLeagueStandingsForTab) {
    myTeamState.activeLeagueTab = leagueId;
    sharedState.activeLeagueTab = leagueId;

    // Update tabs styling
    updateLeagueTabsUI();

    // Update content
    updateLeagueContentUI();

    // Load data if not cached
    if (!myTeamState.leagueStandingsCache.has(leagueId)) {
        loadLeagueStandingsForTab(leagueId);
    }
}

/**
 * Attach event listeners to league tabs
 * @param {Function} switchLeagueTab - Callback to switch tabs
 */
export function attachLeagueTabListeners(switchLeagueTab) {
    const tabButtons = document.querySelectorAll('.league-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const leagueId = parseInt(e.currentTarget.dataset.leagueId);
            switchLeagueTab(leagueId);
        });
    });
}
