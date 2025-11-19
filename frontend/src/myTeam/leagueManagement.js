// ============================================================================
// LEAGUE MANAGEMENT MODULE
// Handles league selection, tabs, and UI state for My Leagues feature
// ============================================================================

import { escapeHtml } from '../utils.js';
import { shouldUseMobileLayout } from '../renderMyTeamMobile.js';

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
    }

    const useMobile = shouldUseMobileLayout();

    const html = `
        <div style="display: ${useMobile ? 'flex' : 'grid'}; ${useMobile ? 'flex-direction: column;' : 'grid-template-columns: 300px 1fr;'} gap: 1.5rem; ${useMobile ? '' : 'height: calc(100vh - 300px);'}">
            <!-- Left Sidebar: League Selection -->
            <div id="league-selection-sidebar" style="background: var(--bg-secondary); padding: ${useMobile ? '1rem' : '1.5rem'}; border-radius: 12px; ${useMobile ? '' : 'overflow-y: auto;'}">
                <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                    <i class="fas fa-trophy"></i> Your Leagues
                </h3>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">
                    Select up to 3 leagues to track
                </p>
                ${renderLeagueSideMenu(team, myTeamState)}
            </div>

            <!-- Right Content: League Tabs and Standings -->
            <div style="display: flex; flex-direction: column; background: var(--bg-primary); border-radius: 12px; overflow: hidden; ${useMobile ? 'min-height: 400px' : ''}">
                ${renderLeagueTabs(myTeamState)}
                <div id="league-content-container" style="flex: 1; overflow-y: auto; padding: ${useMobile ? '1rem' : '1.5rem'};">
                    ${renderLeagueContent(myTeamState)}
                </div>
            </div>

            <!-- Modal for team comparison -->
            <div id="comparison-modal" style="display: none;"></div>
        </div>
    `;

    // Load standings after DOM is ready
    requestAnimationFrame(() => {
        if (myTeamState.activeLeagueTab) {
            loadLeagueStandingsForTab(myTeamState.activeLeagueTab);
        }
    });

    return html;
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
