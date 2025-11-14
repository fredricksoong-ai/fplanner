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
 * Enrich FPL player data with GitHub stats
 * @param {Array} fplPlayers - Players from bootstrap
 * @returns {Array} Enriched players
 */
export function enrichPlayerData(fplPlayers) {
    if (!githubData) {
        console.warn('⚠️ GitHub data not available for enrichment');
        return fplPlayers;
    }
    
    console.log(`🔄 Enriching ${fplPlayers.length} players with GitHub data...`);
    
    const enriched = fplPlayers.map(player => {
        // Find matching player in GitHub data by name
        const githubPlayer = githubData.find(gp => 
            gp.name === player.web_name || 
            gp.name === `${player.first_name} ${player.second_name}`
        );
        
        if (githubPlayer) {
            return {
                ...player,
                // Add GitHub-specific stats
                expected_goal_involvements: githubPlayer.xGI || player.expected_goal_involvements || 0,
                expected_goal_involvements_per_90: githubPlayer.xGI_per_90 || 0,
                expected_goals_conceded: githubPlayer.xGC || 0,
                expected_goals_conceded_per_90: githubPlayer.xGC_per_90 || 0,
                defensive_contribution: githubPlayer.defensive_contribution || 0,
                defensive_contribution_per_90: githubPlayer.defensive_contribution_per_90 || 0
            };
        }
        
        return player;
    });
    
    const enrichedCount = enriched.filter(p => p.expected_goal_involvements_per_90).length;
    console.log(`✅ Enriched ${enrichedCount}/${fplPlayers.length} players with GitHub stats`);
    
    return enriched;
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