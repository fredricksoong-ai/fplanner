// ============================================================================
// DATA MODULE
// Handles all API calls to backend
// ============================================================================

import { memoizeWithDependency } from './utils/memoize.js';

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

/** @type {number|null} Auto-refresh interval ID */
let autoRefreshInterval = null;

/** @type {Function|null} Callback for when data is refreshed */
let onDataRefreshCallback = null;

/** @type {Array|null} Cached enriched players array */
let cachedEnrichedPlayers = null;

/** @type {number|null} Cache key based on data timestamps */
let playersCacheKey = null;

/** Auto-refresh interval in milliseconds (2 minutes) */
const AUTO_REFRESH_INTERVAL = 2 * 60 * 1000;

/** @type {boolean} Flag to prevent concurrent refresh calls */
let isRefreshing = false;

/** @type {number} Timestamp of last refresh */
let lastRefreshTime = 0;

/** Minimum time between refresh attempts (30 seconds) */
const MIN_REFRESH_INTERVAL = 30 * 1000;

// ============================================================================
// GAMEWEEK STATUS
// ============================================================================

/** @enum {string} Gameweek status values */
export const GW_STATUS = {
    COMPLETED: 'COMPLETED',
    LIVE: 'LIVE',
    UPCOMING: 'UPCOMING',
    UNKNOWN: 'UNKNOWN'
};

/**
 * Get the status of a specific gameweek
 * @param {number} gameweek - Gameweek number to check
 * @returns {string} GW_STATUS value
 */
export function getGameweekStatus(gameweek) {
    if (!fplBootstrap || !fplBootstrap.events) {
        return GW_STATUS.UNKNOWN;
    }

    const event = fplBootstrap.events.find(e => e.id === gameweek);
    if (!event) {
        return GW_STATUS.UNKNOWN;
    }

    // If finished flag is set, it's completed
    if (event.finished) {
        return GW_STATUS.COMPLETED;
    }

    const now = new Date();
    const deadline = new Date(event.deadline_time);

    // If deadline has passed but not finished, it's live
    if (deadline <= now && !event.finished) {
        return GW_STATUS.LIVE;
    }

    // If deadline is in the future, it's upcoming
    if (deadline > now) {
        return GW_STATUS.UPCOMING;
    }

    return GW_STATUS.UNKNOWN;
}

/**
 * Check if a gameweek is currently live
 * @param {number} gameweek - Gameweek number
 * @returns {boolean} True if gameweek is live
 */
export function isGameweekLive(gameweek) {
    return getGameweekStatus(gameweek) === GW_STATUS.LIVE;
}

/**
 * Get the active gameweek (current live or next if between GWs)
 * Use this for UI display where you want to show the "current" GW to users
 * @returns {number} Active GW number
 */
export function getActiveGW() {
    if (!fplBootstrap || !fplBootstrap.events) {
        return currentGW || 1;
    }

    // Find the current event (is_current = true) - this is the live or most recent GW
    const currentEvent = fplBootstrap.events.find(e => e.is_current);
    if (currentEvent) {
        return currentEvent.id;
    }

    // Fallback to next event if no current (between GWs)
    const nextEvent = fplBootstrap.events.find(e => e.is_next);
    if (nextEvent) {
        return nextEvent.id;
    }

    // Final fallback
    return currentGW || 1;
}

/**
 * Get the next gameweek number
 * @returns {number|null} Next gameweek or null if season ended
 */
export function getNextGameweek() {
    if (!fplBootstrap || !fplBootstrap.events) {
        return null;
    }
    const nextEvent = fplBootstrap.events.find(e => e.is_next);
    return nextEvent ? nextEvent.id : null;
}

/**
 * Get gameweek event data
 * @param {number} gameweek - Gameweek number
 * @returns {Object|null} Event object or null
 */
export function getGameweekEvent(gameweek) {
    if (!fplBootstrap || !fplBootstrap.events) {
        return null;
    }
    return fplBootstrap.events.find(e => e.id === gameweek) || null;
}

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
        
        // Clear players cache when data is refreshed
        clearPlayersCache();
        
        // Detect current gameweek
        detectCurrentGW();
        
        return data;
    } catch (err) {
        console.error('❌ Failed to load FPL data:', err);
        throw err;
    }
}

/**
 * Load enriched bootstrap data with live stats merged into elements
 * This is the preferred way to load data during live GWs as all players get live_stats
 * @returns {Promise<Object>} Enriched bootstrap data
 * @throws {Error} If API request fails
 * @example
 * const data = await loadEnrichedBootstrap();
 * const player = data.elements.find(p => p.id === 123);
 * console.log(player.live_stats?.total_points); // Live points if GW is live
 */
/**
 * Check if we can refresh (not already refreshing and enough time has passed)
 * @returns {boolean} True if refresh is allowed
 */
function canRefresh() {
    if (isRefreshing) {
        console.log('⏸️ Refresh already in progress, skipping...');
        return false;
    }

    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;
    
    if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
        const waitTime = Math.ceil((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000);
        console.log(`⏸️ Too soon to refresh, please wait ${waitTime}s...`);
        return false;
    }

    return true;
}

export async function loadEnrichedBootstrap(force = false) {
    // Check if we can refresh (unless forced)
    if (!force && !canRefresh()) {
        throw new Error('Refresh already in progress or too soon to refresh again');
    }

    // Set refreshing flag
    isRefreshing = true;
    lastRefreshTime = Date.now();

    console.log('🔄 Loading enriched bootstrap data...');

    try {
        const response = await fetch(`${API_BASE}/bootstrap/enriched`);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('429 Too many requests. Please wait before refreshing.');
            }
            throw new Error(`Failed to load enriched bootstrap (${response.status})`);
        }

        const data = await response.json();

        console.log('✅ Enriched bootstrap loaded');
        console.log(`   GW${data.meta.gameweek}: ${data.meta.gwStatus}`);
        console.log(`   Live: ${data.meta.isLive}`);
        if (data.meta.liveDataAge !== null) {
            console.log(`   Live data age: ${data.meta.liveDataAge}s`);
        }

        // Update module-level bootstrap with enriched data
        fplBootstrap = data;
        
        // Clear players cache when enriched data is loaded
        clearPlayersCache();
        
        detectCurrentGW();

        return data;
    } catch (err) {
        console.error('❌ Failed to load enriched bootstrap:', err);
        throw err;
    } finally {
        // Clear refreshing flag after a short delay to prevent rapid successive calls
        setTimeout(() => {
            isRefreshing = false;
        }, 1000);
    }
}

/**
 * Load live gameweek data (real-time player stats during matches)
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object>} Live data with player stats
 * @throws {Error} If API request fails
 * @example
 * const liveData = await loadLiveData(12);
 * console.log(liveData.elements); // Array of player live stats
 */
export async function loadLiveData(gameweek) {
    console.log(`🔄 Loading live data for GW${gameweek}...`);

    try {
        const response = await fetch(`${API_BASE}/live/${gameweek}`);

        if (!response.ok) {
            throw new Error(`Failed to load live data for GW${gameweek}`);
        }

        const data = await response.json();

        console.log(`✅ Live data loaded for GW${gameweek}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Players: ${data.elements.length}`);

        return data;
    } catch (err) {
        console.error(`❌ Failed to load live data:`, err);
        throw err;
    }
}

// ============================================================================
// AUTO-REFRESH
// ============================================================================

/**
 * Start auto-refresh polling during live GW
 * Automatically refreshes enriched bootstrap data every 2 minutes
 * @param {Function} [onRefresh] - Callback when data is refreshed
 * @example
 * startAutoRefresh(() => {
 *     console.log('Data refreshed!');
 *     renderMyTeam(); // Re-render UI
 * });
 */
export function startAutoRefresh(onRefresh = null) {
    // Stop any existing interval
    stopAutoRefresh();

    onDataRefreshCallback = onRefresh;

    // Check if we should auto-refresh (only during live GW)
    const activeGW = getActiveGW();
    const status = getGameweekStatus(activeGW);

    if (status !== GW_STATUS.LIVE) {
        console.log(`ℹ️ Auto-refresh not started (GW${activeGW} is ${status})`);
        return;
    }

    console.log(`🔄 Starting auto-refresh for live GW${activeGW} (every ${AUTO_REFRESH_INTERVAL / 1000}s)`);

    // Track last refresh time to prevent rapid-fire requests
    let lastRefreshTime = 0;
    const MIN_REFRESH_INTERVAL = 120000; // 2 minutes minimum (same as AUTO_REFRESH_INTERVAL)
    
    autoRefreshInterval = setInterval(async () => {
        try {
            // Check if still live before refreshing
            const currentStatus = getGameweekStatus(getActiveGW());
            if (currentStatus !== GW_STATUS.LIVE) {
                console.log('ℹ️ GW no longer live, stopping auto-refresh');
                stopAutoRefresh();
                return;
            }

            // Client-side throttling: Don't refresh if already refreshing or too soon
            if (!canRefresh()) {
                return; // Skip this cycle
            }

            console.log('🔄 Auto-refreshing enriched bootstrap...');
            await loadEnrichedBootstrap();

            if (onDataRefreshCallback) {
                onDataRefreshCallback();
            }
        } catch (err) {
            // Handle rate limit errors gracefully
            if (err.message && err.message.includes('429')) {
                console.warn('⚠️ Rate limit hit, stopping auto-refresh. Please refresh manually.');
                stopAutoRefresh();
            } else if (err.message && err.message.includes('already in progress')) {
                // Skip if already refreshing (handled by canRefresh)
                return;
            } else {
                console.error('❌ Auto-refresh failed:', err);
            }
        }
    }, AUTO_REFRESH_INTERVAL);
}

/**
 * Stop auto-refresh polling
 */
export function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏹️ Auto-refresh stopped');
    }
}

/**
 * Check if auto-refresh is currently active
 * @returns {boolean} True if auto-refresh is running
 */
export function isAutoRefreshActive() {
    return autoRefreshInterval !== null;
}

/**
 * Get live stats for a specific player
 * @param {number} playerId - Player element ID
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object|null>} Player's live stats or null if not found
 */
export async function getPlayerLiveStats(playerId, gameweek) {
    try {
        const liveData = await loadLiveData(gameweek);
        const playerStats = liveData.elements.find(e => e.id === playerId);
        return playerStats || null;
    } catch (err) {
        console.error(`❌ Failed to get live stats for player ${playerId}:`, err);
        return null;
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
 * Load transfer history for a team
 * @param {string|number} teamId - Team ID
 * @returns {Promise<Array>} Array of transfers
 */
export async function loadTransferHistory(teamId) {
    console.log(`🔄 Loading transfer history for team ${teamId}...`);

    try {
        const response = await fetch(`${API_BASE}/team/${teamId}/transfers`);

        if (!response.ok) {
            throw new Error(`Failed to load transfer history for team ${teamId}`);
        }

        const data = await response.json();

        console.log(`✅ Transfer history loaded (${data.count} transfers)`);

        return data.transfers || [];
    } catch (err) {
        console.error(`❌ Failed to load transfer history:`, err);
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
 * Memoized to avoid re-processing all players on every call
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

    // Generate cache key based on data state
    // Cache invalidates when bootstrap or github data changes
    const bootstrapTimestamp = fplBootstrap.events?.[0]?.id || 0;
    const githubTimestamp = githubData?.currentGW || 0;
    const currentKey = `${bootstrapTimestamp}-${githubTimestamp}-${currentGW || 0}`;

    // Return cached data if available and valid
    if (cachedEnrichedPlayers && playersCacheKey === currentKey) {
        return cachedEnrichedPlayers;
    }

    // Process and cache
    const enriched = enrichPlayerData([...fplBootstrap.elements]); // Create copy to avoid mutating original
    cachedEnrichedPlayers = enriched;
    playersCacheKey = currentKey;

    return enriched;
}

/**
 * Clear the players cache (called when data is refreshed)
 * @private
 */
function clearPlayersCache() {
    cachedEnrichedPlayers = null;
    playersCacheKey = null;
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
