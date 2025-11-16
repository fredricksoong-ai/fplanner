// ============================================================================
// DATA MODULE
// Handles all API calls to backend
// ============================================================================

/**
 * @typedef {Object} FPLDataResponse
 * @property {Object} bootstrap - FPL bootstrap data (events, teams, elements)
 * @property {Array} fixtures - FPL fixtures data
 * @property {Object} github - GitHub CSV enriched data
 * @property {Object} meta - Cache metadata
 */

/**
 * @typedef {Object} TeamData
 * @property {Object} team - Team information (name, manager, etc.)
 * @property {Object} picks - Team picks and entry history
 * @property {number} gameweek - Current gameweek
 */

// Backend API base URL (proxied by Vite to localhost:3001)
const API_BASE = '/api';

// ============================================================================
// GLOBAL DATA STORAGE
// Module-level variables for shared data access across the application
// ============================================================================

/** @type {Object|null} FPL bootstrap data (events, teams, elements/players) */
export let fplBootstrap = null;

/** @type {Array|null} FPL fixtures data with difficulty ratings */
export let fplFixtures = null;

/** @type {Object|null} GitHub CSV enriched data (season stats, GW stats, transfers) */
export let githubData = null;

/** @type {number|null} Current gameweek number (latest finished GW) */
export let currentGW = null;

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Load all FPL data from backend (bootstrap, fixtures, GitHub enrichments)
 * Updates module-level variables: fplBootstrap, fplFixtures, githubData, currentGW
 * @param {string} [queryParams=''] - Optional query params (e.g., '?refresh=true' to bypass cache)
 * @returns {Promise<FPLDataResponse>} Combined data object from backend
 * @throws {Error} If API request fails or returns non-OK status
 * @example
 * await loadFPLData(); // Load with cache
 * await loadFPLData('?refresh=true'); // Force refresh
 */
export async function loadFPLData(queryParams = '') {
    console.log('🔄 Loading FPL data from backend...');
    
    try {
        const response = await fetch(`${API_BASE}/fpl-data${queryParams}`);
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('✅ FPL data loaded from backend');
        console.log(`   Bootstrap: ${data.bootstrap ? 'loaded' : 'missing'}`);
        console.log(`   Fixtures: ${data.fixtures ? 'loaded' : 'missing'}`);
        console.log(`   GitHub: ${data.github ? 'loaded' : 'missing'}`);
        console.log(`   Cache age: ${Math.round(data.meta.bootstrap_age / 1000)}s`);
        
        // Store in module-level variables
        fplBootstrap = data.bootstrap;
        fplFixtures = data.fixtures;
        githubData = data.github;
        
        // Detect current gameweek
        detectCurrentGW();
        
        return data;
    } catch (err) {
        console.error('❌ Failed to load FPL data:', err);
        throw err;
    }
}

/**
 * Load user's team data from FPL API
 * @param {number} teamId - FPL team ID (1-10 digits)
 * @returns {Promise<TeamData>} Team data with picks and entry history
 * @throws {Error} If team ID is invalid or API request fails
 * @example
 * const teamData = await loadMyTeam(123456);
 * console.log(teamData.team.name); // Team name
 * console.log(teamData.picks.entry_history.total_points); // GW points
 */
export async function loadMyTeam(teamId) {
    console.log(`🔄 Loading team ${teamId}...`);

    try {
        const response = await fetch(`${API_BASE}/team/${teamId}`);

        if (!response.ok) {
            throw new Error(`Failed to load team ${teamId}`);
        }

        const data = await response.json();

        console.log(`✅ Team ${teamId} loaded`);
        console.log(`   Manager: ${data.team.player_first_name} ${data.team.player_last_name}`);
        console.log(`   Team: ${data.team.name}`);
        console.log(`   GW${data.gameweek}: ${data.picks.entry_history.total_points} pts`);

        return data;
    } catch (err) {
        console.error(`❌ Failed to load team:`, err);
        throw err;
    }
}

/**
 * Load league standings from FPL API
 * @param {number} leagueId - FPL league ID
 * @param {number} [page=1] - Page number for pagination (default: 1)
 * @returns {Promise<Object>} League data with standings
 * @throws {Error} If league ID is invalid or API request fails
 * @example
 * const leagueData = await loadLeagueStandings(12345);
 * console.log(leagueData.league.name); // League name
 * console.log(leagueData.standings.results); // Array of standings
 */
export async function loadLeagueStandings(leagueId, page = 1) {
    console.log(`🔄 Loading league ${leagueId} (page ${page})...`);

    try {
        const response = await fetch(`${API_BASE}/leagues/${leagueId}?page=${page}`);

        if (!response.ok) {
            throw new Error(`Failed to load league ${leagueId}`);
        }

        const data = await response.json();

        console.log(`✅ League ${leagueId} loaded`);
        console.log(`   Name: ${data.league.name}`);
        console.log(`   Entries: ${data.standings.results.length}`);

        return data;
    } catch (err) {
        console.error(`❌ Failed to load league:`, err);
        throw err;
    }
}

/**
 * Detect current gameweek from bootstrap data
 * Sets the module-level currentGW variable to latest finished gameweek
 * @private
 */
function detectCurrentGW() {
    if (!fplBootstrap) {
        console.warn('⚠️ Cannot detect GW: bootstrap data missing');
        currentGW = 1;
        return;
    }

    // Find the latest FINISHED game week (not is_current which could be in-progress)
    const finishedEvents = fplBootstrap.events.filter(e => e.finished);
    const latestFinishedGW = finishedEvents.length > 0
        ? Math.max(...finishedEvents.map(e => e.id))
        : 1;

    currentGW = latestFinishedGW;

    console.log(`📅 Latest Finished GW detected: ${currentGW}`);
}

/**
 * Enrich FPL player data with GitHub CSV data (3-source enrichment)
 * Adds github_season, github_gw, and github_transfers properties to player
 * @private
 * @param {import('./utils.js').Player} player - Player object to enrich
 * @param {Object} githubData - GitHub CSV data with seasonStats, currentGWStats, nextGWStats
 */
function enrichPlayerWithGithubData(player, githubData) {
    if (!githubData) {
        return;
    }
    
    // 1. Enrich with SEASON stats (always available)
    if (githubData.seasonStats && githubData.seasonStats.length > 0) {
        const seasonPlayer = githubData.seasonStats.find(g => g.id === player.id);
        if (seasonPlayer) {
            player.github_season = {
                form: seasonPlayer.form,
                value_form: seasonPlayer.value_form,
                value_season: seasonPlayer.value_season,
                ict_index: seasonPlayer.ict_index,
                defensive_contribution: seasonPlayer.defensive_contribution,
                defensive_contribution_per_90: seasonPlayer.defensive_contribution_per_90,
                dreamteam_count: seasonPlayer.dreamteam_count,
                saves_per_90: seasonPlayer.saves_per_90,
                clean_sheets_per_90: seasonPlayer.clean_sheets_per_90
            };
        }
    }
    
    // 2. Enrich with CURRENT GW stats (if finished)
    if (githubData.isFinished && githubData.currentGWStats && githubData.currentGWStats.length > 0) {
        const gwPlayer = githubData.currentGWStats.find(g => g.id === player.id);
        if (gwPlayer) {
            player.github_gw = {
                gw: githubData.currentGW,
                minutes: gwPlayer.minutes,
                total_points: gwPlayer.total_points,
                goals_scored: gwPlayer.goals_scored,
                assists: gwPlayer.assists,
                clean_sheets: gwPlayer.clean_sheets,
                goals_conceded: gwPlayer.goals_conceded,
                bonus: gwPlayer.bonus,
                bps: gwPlayer.bps,
                saves: gwPlayer.saves,
                expected_goals: gwPlayer.expected_goals,
                expected_assists: gwPlayer.expected_assists,
                expected_goal_involvements: gwPlayer.expected_goal_involvements,
                defensive_contribution: gwPlayer.defensive_contribution
            };
        }
    }
    
    // 3. Enrich with NEXT GW stats (for latest transfers)
    if (githubData.nextGWStats && githubData.nextGWStats.length > 0) {
        const nextGWPlayer = githubData.nextGWStats.find(g => g.id === player.id);
        if (nextGWPlayer) {
            player.github_transfers = {
                gw: githubData.currentGW + 1,
                transfers_in: nextGWPlayer.transfers_in_event,
                transfers_out: nextGWPlayer.transfers_out_event
            };
        }
    }
}

/**
 * Enrich all players with GitHub CSV data
 * @private
 * @param {Array<import('./utils.js').Player>} players - Array of player objects
 * @returns {Array<import('./utils.js').Player>} Enriched players array (same array, mutated)
 */
function enrichPlayerData(players) {
    if (!players || !Array.isArray(players)) {
        return [];
    }

    // Enrich each player with GitHub data (mutates player objects)
    players.forEach(player => {
        enrichPlayerWithGithubData(player, githubData);
    });

    return players;
}

// ============================================================================
// PUBLIC DATA ACCESS FUNCTIONS
// ============================================================================

/**
 * Get all players with enriched data (FPL + GitHub stats)
 * @returns {Array<import('./utils.js').Player>} All players with github_season, github_gw, github_transfers
 * @example
 * const players = getAllPlayers();
 * const topScorers = players.sort((a, b) => b.total_points - a.total_points).slice(0, 10);
 */
export function getAllPlayers() {
    if (!fplBootstrap) {
        console.warn('⚠️ Bootstrap data not loaded yet');
        return [];
    }

    return enrichPlayerData(fplBootstrap.elements);
}

/**
 * Get player by ID
 * @param {number} playerId - Player ID from FPL API
 * @returns {import('./utils.js').Player|null} Player object or null if not found
 */
export function getPlayerById(playerId) {
    if (!fplBootstrap) return null;
    return fplBootstrap.elements.find(p => p.id === playerId);
}

/**
 * Get team by ID
 * @param {number} teamId - Team ID from FPL API
 * @returns {import('./utils.js').Team|null} Team object or null if not found
 */
export function getTeamById(teamId) {
    if (!fplBootstrap) return null;
    return fplBootstrap.teams.find(t => t.id === teamId);
}

/**
 * Force refresh all data from backend (bypasses cache)
 * @returns {Promise<FPLDataResponse>} Fresh data from FPL API
 * @example
 * await refreshData(); // Bypass cache and fetch latest data
 */
export async function refreshData() {
    console.log('🔄 Force refreshing data...');
    return loadFPLData('?refresh=true');
}
