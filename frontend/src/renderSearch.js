// ============================================================================
// SEARCH PAGE MODULE
// Player search and filtering functionality
// ============================================================================

import { getAllPlayers } from './data.js';
import { sortPlayers } from './utils.js';
import { renderPlayerTable, attachRiskTooltipListeners } from './renderHelpers.js';

// ============================================================================
// STATE
// ============================================================================

let currentPositionFilter = 'all';
let currentSearchQuery = '';

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render the Search page
 */
export function renderSearch() {
    const container = document.getElementById('app-container');

    container.innerHTML = `
        <div style="padding: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-search"></i> Player Search
            </h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Search for players by name or filter by position
            </p>

            <div style="margin-bottom: 2rem;">
                <input
                    type="text"
                    id="player-search-input"
                    placeholder="Search players..."
                    style="
                        width: 100%;
                        padding: 1rem;
                        border: 2px solid var(--border-color);
                        border-radius: 8px;
                        font-size: 1rem;
                        background: var(--bg-secondary);
                        color: var(--text-primary);
                    "
                >
            </div>

            <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem;">
                <button class="position-filter-btn" data-position="all" style="padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600; transition: all 0.2s;">All</button>
                <button class="position-filter-btn" data-position="1" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s;">GKP</button>
                <button class="position-filter-btn" data-position="2" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s;">DEF</button>
                <button class="position-filter-btn" data-position="3" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s;">MID</button>
                <button class="position-filter-btn" data-position="4" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s;">FWD</button>
            </div>

            <div id="search-results">
                <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Enter a search term or select a position</p>
            </div>
        </div>
    `;

    // Add event listeners
    const searchInput = document.getElementById('player-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => window.performPlayerSearch());
    }

    const positionButtons = document.querySelectorAll('.position-filter-btn');
    positionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const position = btn.dataset.position;
            window.filterByPosition(position === 'all' ? 'all' : parseInt(position));
        });
    });
}

// ============================================================================
// SEARCH HELPERS
// ============================================================================

/**
 * Update search results based on current filters
 */
function updateSearchResults() {
    const resultsContainer = document.getElementById('search-results');

    if (!currentSearchQuery && currentPositionFilter === 'all') {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Enter a search term or select a position</p>';
        return;
    }

    let players = getAllPlayers();

    // Filter by position
    if (currentPositionFilter !== 'all') {
        players = players.filter(p => p.element_type == currentPositionFilter);
    }

    // Filter by search query
    if (currentSearchQuery) {
        players = players.filter(p =>
            p.web_name.toLowerCase().includes(currentSearchQuery) ||
            p.first_name.toLowerCase().includes(currentSearchQuery) ||
            p.second_name.toLowerCase().includes(currentSearchQuery)
        );
    }

    // Sort by total points
    players = sortPlayers(players, 'total_points', false).slice(0, 50);

    if (players.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No players found</p>';
        return;
    }

    // Get user's team player IDs for highlighting
    let myTeamPlayerIds = [];
    const cachedTeamId = localStorage.getItem('fplanner_team_id');
    if (cachedTeamId) {
        const cachedTeamData = localStorage.getItem(`fplanner_team_${cachedTeamId}`);
        if (cachedTeamData) {
            try {
                const teamData = JSON.parse(cachedTeamData);
                if (teamData && teamData.picks && teamData.picks.picks) {
                    myTeamPlayerIds = teamData.picks.picks.map(p => p.element);
                }
            } catch (e) {
                console.log('Could not parse cached team data for highlighting');
            }
        }
    }

    resultsContainer.innerHTML = `
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Found ${players.length} player${players.length !== 1 ? 's' : ''}</p>
        ${renderPlayerTable(players, 'next5', myTeamPlayerIds)}
    `;

    attachRiskTooltipListeners();
}

// ============================================================================
// GLOBAL WINDOW FUNCTIONS
// ============================================================================

/**
 * Perform player search based on input
 */
window.performPlayerSearch = function() {
    const input = document.getElementById('player-search-input');
    currentSearchQuery = input.value.toLowerCase().trim();
    updateSearchResults();
};

/**
 * Filter players by position
 */
window.filterByPosition = function(position) {
    currentPositionFilter = position;

    // Update button styles
    document.querySelectorAll('.position-filter-btn').forEach(btn => {
        if (btn.dataset.position == position) {
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'var(--bg-secondary)';
            btn.style.color = 'var(--text-primary)';
        }
    });

    updateSearchResults();
};
