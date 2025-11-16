// ============================================================================
// SEARCH PAGE MODULE
// Player search and filtering functionality with advanced filters
// ============================================================================

import { getAllPlayers } from './data.js';
import { sortPlayers, calculatePPM, getTeamName } from './utils.js';
import { renderPlayerTable, attachRiskTooltipListeners } from './renderHelpers.js';
import { fplBootstrap } from './data.js';

// ============================================================================
// STATE
// ============================================================================

let currentPositionFilter = 'all';
let currentSearchQuery = '';
let advancedFiltersExpanded = false;

// Advanced filter state
let filters = {
    priceMin: 0,
    priceMax: 200,
    pointsMin: 0,
    formMin: 0,
    minutesMin: 0,
    ownershipMin: 0,
    ownershipMax: 100,
    ppmMin: 0,
    teams: [],
    availability: 'all', // 'all', 'available', 'injured', 'doubtful'
    sortBy: 'total_points',
    sortAscending: false,
    resultLimit: 100
};

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render the Search page with advanced filters
 */
export function renderSearch() {
    const container = document.getElementById('app-container');

    // Get all teams for team filter dropdown
    const teams = fplBootstrap ? fplBootstrap.teams.sort((a, b) => a.name.localeCompare(b.name)) : [];

    container.innerHTML = `
        <div style="padding: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-search"></i> Player Search
            </h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Search for players with powerful filtering and sorting options
            </p>

            <!-- Search Input -->
            <div style="margin-bottom: 1.5rem;">
                <input
                    type="text"
                    id="player-search-input"
                    placeholder="Search by player name or team..."
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

            <!-- Position Filter Buttons -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <button class="position-filter-btn" data-position="all" style="padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600; transition: all 0.2s;">All</button>
                <button class="position-filter-btn" data-position="1" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s;">GKP</button>
                <button class="position-filter-btn" data-position="2" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s;">DEF</button>
                <button class="position-filter-btn" data-position="3" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s;">MID</button>
                <button class="position-filter-btn" data-position="4" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s;">FWD</button>
            </div>

            <!-- Advanced Filters Toggle -->
            <div style="margin-bottom: 1.5rem;">
                <button
                    id="toggle-advanced-filters"
                    style="
                        padding: 0.75rem 1.5rem;
                        background: var(--bg-secondary);
                        color: var(--text-primary);
                        border: 2px solid var(--border-color);
                        border-radius: 0.5rem;
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-sliders-h"></i> Advanced Filters
                    <i class="fas fa-chevron-down" id="filter-chevron" style="margin-left: 0.5rem; font-size: 0.8rem;"></i>
                </button>
                <button
                    id="clear-all-filters"
                    style="
                        padding: 0.75rem 1.5rem;
                        background: transparent;
                        color: var(--danger-color);
                        border: 2px solid var(--danger-color);
                        border-radius: 0.5rem;
                        cursor: pointer;
                        font-weight: 600;
                        margin-left: 0.5rem;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-times"></i> Clear All
                </button>
            </div>

            <!-- Advanced Filters Panel -->
            <div
                id="advanced-filters-panel"
                style="
                    display: ${advancedFiltersExpanded ? 'block' : 'none'};
                    background: var(--bg-secondary);
                    border: 2px solid var(--border-color);
                    border-radius: 0.5rem;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                "
            >
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">

                    <!-- Price Range -->
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                            <i class="fas fa-pound-sign"></i> Price Range
                        </label>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="number" id="filter-price-min" value="${filters.priceMin / 10}" step="0.5" min="0" max="20"
                                style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);"
                                placeholder="Min">
                            <span style="color: var(--text-secondary);">-</span>
                            <input type="number" id="filter-price-max" value="${filters.priceMax / 10}" step="0.5" min="0" max="20"
                                style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);"
                                placeholder="Max">
                        </div>
                        <small style="color: var(--text-secondary); font-size: 0.75rem;">£ millions</small>
                    </div>

                    <!-- Points Minimum -->
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                            <i class="fas fa-star"></i> Min Total Points
                        </label>
                        <input type="number" id="filter-points-min" value="${filters.pointsMin}" step="5" min="0"
                            style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);"
                            placeholder="e.g., 50">
                    </div>

                    <!-- Form Minimum -->
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                            <i class="fas fa-chart-line"></i> Min Form
                        </label>
                        <input type="number" id="filter-form-min" value="${filters.formMin}" step="0.5" min="0"
                            style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);"
                            placeholder="e.g., 5.0">
                        <small style="color: var(--text-secondary); font-size: 0.75rem;">Points per game</small>
                    </div>

                    <!-- Minutes Minimum -->
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                            <i class="fas fa-clock"></i> Min Minutes
                        </label>
                        <input type="number" id="filter-minutes-min" value="${filters.minutesMin}" step="90" min="0"
                            style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);"
                            placeholder="e.g., 500">
                        <small style="color: var(--text-secondary); font-size: 0.75rem;">Total minutes played</small>
                    </div>

                    <!-- Ownership Range -->
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                            <i class="fas fa-users"></i> Ownership %
                        </label>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="number" id="filter-ownership-min" value="${filters.ownershipMin}" step="1" min="0" max="100"
                                style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);"
                                placeholder="Min">
                            <span style="color: var(--text-secondary);">-</span>
                            <input type="number" id="filter-ownership-max" value="${filters.ownershipMax}" step="1" min="0" max="100"
                                style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);"
                                placeholder="Max">
                        </div>
                    </div>

                    <!-- PPM Minimum -->
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                            <i class="fas fa-coins"></i> Min Points per £M
                        </label>
                        <input type="number" id="filter-ppm-min" value="${filters.ppmMin}" step="1" min="0"
                            style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);"
                            placeholder="e.g., 10">
                        <small style="color: var(--text-secondary); font-size: 0.75rem;">Value metric (PPM)</small>
                    </div>

                    <!-- Team Filter -->
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                            <i class="fas fa-shield-alt"></i> Teams
                        </label>
                        <select id="filter-teams" multiple size="4"
                            style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);">
                            ${teams.map(team => `<option value="${team.id}">${team.name}</option>`).join('')}
                        </select>
                        <small style="color: var(--text-secondary); font-size: 0.75rem;">Hold Ctrl/Cmd to select multiple</small>
                    </div>

                    <!-- Availability -->
                    <div>
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                            <i class="fas fa-heartbeat"></i> Availability
                        </label>
                        <select id="filter-availability"
                            style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="all">All Players</option>
                            <option value="available">Available Only</option>
                            <option value="doubtful">Doubtful</option>
                            <option value="injured">Injured/Unavailable</option>
                        </select>
                    </div>

                </div>

                <!-- Apply Filters Button -->
                <div style="margin-top: 1.5rem;">
                    <button
                        id="apply-filters"
                        style="
                            padding: 0.75rem 2rem;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 0.5rem;
                            cursor: pointer;
                            font-weight: 600;
                            transition: all 0.2s;
                        "
                    >
                        <i class="fas fa-filter"></i> Apply Filters
                    </button>
                </div>
            </div>

            <!-- Sort and Display Controls -->
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; align-items: center; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                        <i class="fas fa-sort"></i> Sort By
                    </label>
                    <select id="sort-by"
                        style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-secondary); color: var(--text-primary);">
                        <option value="total_points">Total Points</option>
                        <option value="event_points">Last GW Points</option>
                        <option value="form">Form</option>
                        <option value="now_cost">Price</option>
                        <option value="ppm">Points per £M (PPM)</option>
                        <option value="selected_by_percent">Ownership %</option>
                        <option value="minutes">Minutes</option>
                        <option value="goals_scored">Goals</option>
                        <option value="assists">Assists</option>
                        <option value="clean_sheets">Clean Sheets</option>
                        <option value="bonus">Bonus Points</option>
                        <option value="ict_index">ICT Index</option>
                    </select>
                </div>
                <div style="padding-top: 1.75rem;">
                    <button
                        id="toggle-sort-order"
                        style="
                            padding: 0.5rem 1rem;
                            background: var(--bg-secondary);
                            color: var(--text-primary);
                            border: 2px solid var(--border-color);
                            border-radius: 0.25rem;
                            cursor: pointer;
                            font-weight: 600;
                        "
                        title="Toggle sort order"
                    >
                        <i class="fas fa-arrow-down"></i> Descending
                    </button>
                </div>
                <div style="padding-top: 1.75rem;">
                    <label style="display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
                        <span>Show:</span>
                        <select id="result-limit"
                            style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; background: var(--bg-secondary); color: var(--text-primary);">
                            <option value="50">50</option>
                            <option value="100" selected>100</option>
                            <option value="200">200</option>
                            <option value="500">500</option>
                            <option value="1000">All</option>
                        </select>
                    </label>
                </div>
            </div>

            <!-- Active Filters Display -->
            <div id="active-filters" style="margin-bottom: 1rem;"></div>

            <!-- Search Results -->
            <div id="search-results">
                <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Enter a search term, select filters, or choose a position to see results</p>
            </div>
        </div>
    `;

    attachEventListeners();
}

// ============================================================================
// SEARCH HELPERS
// ============================================================================

/**
 * Attach all event listeners for search page
 */
function attachEventListeners() {
    // Search input
    const searchInput = document.getElementById('player-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => window.performPlayerSearch());
    }

    // Position buttons
    const positionButtons = document.querySelectorAll('.position-filter-btn');
    positionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const position = btn.dataset.position;
            window.filterByPosition(position === 'all' ? 'all' : parseInt(position));
        });
    });

    // Advanced filters toggle
    const toggleBtn = document.getElementById('toggle-advanced-filters');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleAdvancedFilters);
    }

    // Clear all filters
    const clearBtn = document.getElementById('clear-all-filters');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllFilters);
    }

    // Apply filters button
    const applyBtn = document.getElementById('apply-filters');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyAdvancedFilters);
    }

    // Sort controls
    const sortSelect = document.getElementById('sort-by');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            filters.sortBy = e.target.value;
            updateSearchResults();
        });
    }

    const sortOrderBtn = document.getElementById('toggle-sort-order');
    if (sortOrderBtn) {
        sortOrderBtn.addEventListener('click', toggleSortOrder);
    }

    // Result limit
    const limitSelect = document.getElementById('result-limit');
    if (limitSelect) {
        limitSelect.addEventListener('change', (e) => {
            filters.resultLimit = parseInt(e.target.value);
            updateSearchResults();
        });
    }
}

/**
 * Toggle advanced filters panel
 */
function toggleAdvancedFilters() {
    advancedFiltersExpanded = !advancedFiltersExpanded;
    const panel = document.getElementById('advanced-filters-panel');
    const chevron = document.getElementById('filter-chevron');

    if (panel) {
        panel.style.display = advancedFiltersExpanded ? 'block' : 'none';
    }

    if (chevron) {
        chevron.className = advancedFiltersExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }
}

/**
 * Apply advanced filters from UI inputs
 */
function applyAdvancedFilters() {
    // Read all filter values from UI
    filters.priceMin = parseFloat(document.getElementById('filter-price-min')?.value || 0) * 10;
    filters.priceMax = parseFloat(document.getElementById('filter-price-max')?.value || 20) * 10;
    filters.pointsMin = parseFloat(document.getElementById('filter-points-min')?.value || 0);
    filters.formMin = parseFloat(document.getElementById('filter-form-min')?.value || 0);
    filters.minutesMin = parseFloat(document.getElementById('filter-minutes-min')?.value || 0);
    filters.ownershipMin = parseFloat(document.getElementById('filter-ownership-min')?.value || 0);
    filters.ownershipMax = parseFloat(document.getElementById('filter-ownership-max')?.value || 100);
    filters.ppmMin = parseFloat(document.getElementById('filter-ppm-min')?.value || 0);
    filters.availability = document.getElementById('filter-availability')?.value || 'all';

    // Get selected teams
    const teamSelect = document.getElementById('filter-teams');
    if (teamSelect) {
        filters.teams = Array.from(teamSelect.selectedOptions).map(opt => parseInt(opt.value));
    }

    updateSearchResults();
}

/**
 * Clear all filters and reset to defaults
 */
function clearAllFilters() {
    // Reset state
    currentPositionFilter = 'all';
    currentSearchQuery = '';
    filters = {
        priceMin: 0,
        priceMax: 200,
        pointsMin: 0,
        formMin: 0,
        minutesMin: 0,
        ownershipMin: 0,
        ownershipMax: 100,
        ppmMin: 0,
        teams: [],
        availability: 'all',
        sortBy: 'total_points',
        sortAscending: false,
        resultLimit: 100
    };

    // Reset UI
    const searchInput = document.getElementById('player-search-input');
    if (searchInput) searchInput.value = '';

    // Reset position buttons
    document.querySelectorAll('.position-filter-btn').forEach(btn => {
        if (btn.dataset.position === 'all') {
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'var(--bg-secondary)';
            btn.style.color = 'var(--text-primary)';
        }
    });

    // Re-render to reset all filter inputs
    renderSearch();
}

/**
 * Toggle sort order between ascending and descending
 */
function toggleSortOrder() {
    filters.sortAscending = !filters.sortAscending;

    const btn = document.getElementById('toggle-sort-order');
    if (btn) {
        btn.innerHTML = filters.sortAscending
            ? '<i class="fas fa-arrow-up"></i> Ascending'
            : '<i class="fas fa-arrow-down"></i> Descending';
    }

    updateSearchResults();
}

/**
 * Update search results based on all current filters
 */
function updateSearchResults() {
    const resultsContainer = document.getElementById('search-results');

    let players = getAllPlayers();
    let totalPlayers = players.length;

    // Filter by position
    if (currentPositionFilter !== 'all') {
        players = players.filter(p => p.element_type == currentPositionFilter);
    }

    // Filter by search query (name OR team)
    if (currentSearchQuery) {
        players = players.filter(p => {
            const teamName = getTeamName(p.team).toLowerCase();
            return (
                p.web_name.toLowerCase().includes(currentSearchQuery) ||
                p.first_name.toLowerCase().includes(currentSearchQuery) ||
                p.second_name.toLowerCase().includes(currentSearchQuery) ||
                teamName.includes(currentSearchQuery)
            );
        });
    }

    // Apply advanced filters
    players = players.filter(p => {
        // Price range
        if (p.now_cost < filters.priceMin || p.now_cost > filters.priceMax) return false;

        // Points minimum
        if ((p.total_points || 0) < filters.pointsMin) return false;

        // Form minimum
        if (parseFloat(p.form || 0) < filters.formMin) return false;

        // Minutes minimum
        if ((p.minutes || 0) < filters.minutesMin) return false;

        // Ownership range
        const ownership = parseFloat(p.selected_by_percent || 0);
        if (ownership < filters.ownershipMin || ownership > filters.ownershipMax) return false;

        // PPM minimum
        const ppm = calculatePPM(p);
        if (ppm < filters.ppmMin) return false;

        // Team filter
        if (filters.teams.length > 0 && !filters.teams.includes(p.team)) return false;

        // Availability filter
        if (filters.availability !== 'all') {
            if (filters.availability === 'available') {
                // Available = status 'a' AND (no injury OR 100% chance)
                if (p.status !== 'a' || (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 100)) {
                    return false;
                }
            } else if (filters.availability === 'doubtful') {
                // Doubtful = chance_of_playing_next_round between 1 and 99
                if (!p.chance_of_playing_next_round || p.chance_of_playing_next_round >= 100 || p.chance_of_playing_next_round <= 0) {
                    return false;
                }
            } else if (filters.availability === 'injured') {
                // Injured = status not 'a' OR chance_of_playing_next_round is 0
                if (p.status === 'a' && (p.chance_of_playing_next_round === null || p.chance_of_playing_next_round > 0)) {
                    return false;
                }
            }
        }

        return true;
    });

    // Sort players
    if (filters.sortBy === 'ppm') {
        // Custom sort for PPM (calculated field)
        players.sort((a, b) => {
            const ppmA = calculatePPM(a);
            const ppmB = calculatePPM(b);
            return filters.sortAscending ? ppmA - ppmB : ppmB - ppmA;
        });
    } else {
        // Standard field sort
        players = sortPlayers(players, filters.sortBy, filters.sortAscending);
    }

    // Apply result limit
    const displayLimit = filters.resultLimit >= 1000 ? players.length : filters.resultLimit;
    const limitedPlayers = players.slice(0, displayLimit);

    // Display active filters
    displayActiveFilters(totalPlayers, players.length);

    if (limitedPlayers.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No players found matching your filters</p>';
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
        <div style="color: var(--text-secondary); margin-bottom: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem; border-left: 4px solid var(--primary-color);">
            <strong style="color: var(--primary-color);">${limitedPlayers.length}</strong> player${limitedPlayers.length !== 1 ? 's' : ''} shown
            ${players.length > displayLimit ? ` (of ${players.length} matching)` : ''}
            ${players.length < totalPlayers ? ` • <span style="color: var(--warning-color);">${totalPlayers - players.length} filtered out</span>` : ''}
        </div>
        ${renderPlayerTable(limitedPlayers, 'next5', myTeamPlayerIds)}
    `;

    attachRiskTooltipListeners();
}

/**
 * Display active filter badges
 */
function displayActiveFilters(totalPlayers, filteredCount) {
    const container = document.getElementById('active-filters');
    if (!container) return;

    const badges = [];

    // Position filter
    if (currentPositionFilter !== 'all') {
        const posNames = {1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD'};
        badges.push(`Position: ${posNames[currentPositionFilter]}`);
    }

    // Search query
    if (currentSearchQuery) {
        badges.push(`Search: "${currentSearchQuery}"`);
    }

    // Price range
    if (filters.priceMin > 0 || filters.priceMax < 200) {
        badges.push(`Price: £${(filters.priceMin/10).toFixed(1)}m - £${(filters.priceMax/10).toFixed(1)}m`);
    }

    // Points
    if (filters.pointsMin > 0) {
        badges.push(`Min Points: ${filters.pointsMin}`);
    }

    // Form
    if (filters.formMin > 0) {
        badges.push(`Min Form: ${filters.formMin}`);
    }

    // Minutes
    if (filters.minutesMin > 0) {
        badges.push(`Min Minutes: ${filters.minutesMin}`);
    }

    // Ownership
    if (filters.ownershipMin > 0 || filters.ownershipMax < 100) {
        badges.push(`Ownership: ${filters.ownershipMin}% - ${filters.ownershipMax}%`);
    }

    // PPM
    if (filters.ppmMin > 0) {
        badges.push(`Min PPM: ${filters.ppmMin}`);
    }

    // Teams
    if (filters.teams.length > 0) {
        const teamNames = filters.teams.map(id => {
            const team = fplBootstrap.teams.find(t => t.id === id);
            return team ? team.short_name : id;
        }).join(', ');
        badges.push(`Teams: ${teamNames}`);
    }

    // Availability
    if (filters.availability !== 'all') {
        const availLabels = {
            available: 'Available Only',
            doubtful: 'Doubtful',
            injured: 'Injured/Unavailable'
        };
        badges.push(`Status: ${availLabels[filters.availability]}`);
    }

    if (badges.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem; border: 1px solid var(--border-color);">
            <strong style="color: var(--text-primary); margin-right: 0.5rem;">Active Filters:</strong>
            ${badges.map(badge => `
                <span style="
                    padding: 0.25rem 0.75rem;
                    background: var(--primary-color);
                    color: white;
                    border-radius: 1rem;
                    font-size: 0.85rem;
                    font-weight: 600;
                ">${badge}</span>
            `).join('')}
        </div>
    `;
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
