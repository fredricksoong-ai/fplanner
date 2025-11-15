// ============================================================================
// DATA MODULE
// Handles all API calls to backend
// ============================================================================

// Backend API base URL
const API_BASE = '/api'; // Vite proxy will route to localhost:3001

// Global data storage (replaces global variables from MVP)
export let fplBootstrap = null;
export let fplFixtures = null;
export let githubData = null;
export let currentGW = null;

/**
 * Load all FPL data from backend
 * @param {string} queryParams - Optional query params (e.g., '?refresh=true')
 * @returns {Promise<Object>} Combined data object
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
 * Load user's team data
 * @param {number} teamId - FPL team ID
 * @returns {Promise<Object>} Team data
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
 * Detect current gameweek from bootstrap data
 */
function detectCurrentGW() {
    if (!fplBootstrap) {
        console.warn('⚠️ Cannot detect GW: bootstrap data missing');
        currentGW = 1;
        return;
    }
    
    const currentEvent = fplBootstrap.events.find(e => e.is_current);
    const nextEvent = fplBootstrap.events.find(e => e.is_next);
    
    if (currentEvent) {
        currentGW = currentEvent.id;
    } else if (nextEvent) {
        currentGW = nextEvent.id - 1;
    } else {
        currentGW = 1;
    }
    
    console.log(`📅 Current GW detected: ${currentGW}`);
}

/**
 * Enrich FPL player data with GitHub CSV data (3-source enrichment)
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
 * Enrich all players with GitHub data
 * @param {Array} players - Array of player objects
 * @returns {Array} Enriched players array
 */
function enrichPlayerData(players) {
    if (!players || !Array.isArray(players)) {
        return [];
    }

    // Enrich each player with GitHub data
    players.forEach(player => {
        enrichPlayerWithGithubData(player, githubData);
    });

    return players;
}

/**
 * Get all players with enriched data
 * @returns {Array} Enriched players array
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
 * @param {number} playerId - Player ID
 * @returns {Object|null} Player object
 */
export function getPlayerById(playerId) {
    if (!fplBootstrap) return null;
    return fplBootstrap.elements.find(p => p.id === playerId);
}

/**
 * Get team by ID
 * @param {number} teamId - Team ID
 * @returns {Object|null} Team object
 */
export function getTeamById(teamId) {
    if (!fplBootstrap) return null;
    return fplBootstrap.teams.find(t => t.id === teamId);
}

/**
 * Force refresh data from backend
 * @returns {Promise<Object>} Fresh data
 */
export async function refreshData() {
    console.log('🔄 Force refreshing data...');
    return loadFPLData('?refresh=true');
}
