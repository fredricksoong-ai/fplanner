// ============================================================================
// LEAGUE STANDINGS MODULE
// Handles league standings rendering and team comparison
// ============================================================================

import { loadLeagueStandings, loadMyTeam, getPlayerById, getActiveGW, isGameweekLive, getGameweekStatus, getGameweekEvent, GW_STATUS } from '../data.js';
import { escapeHtml, formatDecimal, getPtsHeatmap, getFormHeatmap, getHeatmapStyle, calculatePPM } from '../utils.js';
import { renderTeamComparison } from './teamComparison.js';
import { shouldUseMobileLayout } from '../renderMyTeamMobile.js';
import { getGWOpponent, getMatchStatus, calculateFixtureDifficulty } from '../fixtures.js';
import { renderOpponentBadge, calculateStatusColor, calculatePlayerBgColor } from './compact/compactStyleHelpers.js';

/**
 * Calculate live team points from cached team data
 * @param {Object} teamData - Team data with picks and live_stats
 * @returns {number} Total calculated points
 */
function calculateLiveTeamPoints(teamData) {
    if (!teamData || !teamData.picks || !teamData.picks.picks) {
        return null;
    }

    const picks = teamData.picks.picks;
    const automaticSubs = teamData.picks.automatic_subs || [];

    // Create a map of automatic subs for quick lookup
    const subMap = new Map();
    automaticSubs.forEach(sub => {
        subMap.set(sub.element_in, sub.element_out);
    });

    let totalPoints = 0;
    const starting11 = picks.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);

    starting11.forEach(pick => {
        // Check if this player was subbed out
        const wasSubbedOut = Array.from(subMap.values()).includes(pick.element);
        if (wasSubbedOut) {
            // Player was subbed out, don't count their points
            return;
        }

        // Get points from live_stats
        const livePoints = pick.live_stats?.total_points ?? 0;

        // Apply captain multiplier
        if (pick.is_captain) {
            totalPoints += livePoints * 2;
        } else {
            totalPoints += livePoints;
        }
    });

    // Add points from players who were subbed in
    automaticSubs.forEach(sub => {
        const subbedInPick = picks.find(p => p.element === sub.element_in);
        if (subbedInPick && subbedInPick.live_stats) {
            const livePoints = subbedInPick.live_stats.total_points ?? 0;
            // Subs don't get captain multiplier (captain must be in starting 11)
            totalPoints += livePoints;
        }
    });

    return totalPoints;
}

/**
 * Get captain name for a league entry
 * @param {number} entryId - Team entry ID
 * @param {Object} myTeamState - Current state object with captain cache
 * @returns {Promise<string>} Captain player name
 */
async function getCaptainName(entryId, myTeamState) {
    // Initialize caches if they don't exist
    if (!myTeamState.captainCache) {
        myTeamState.captainCache = new Map();
    }

    // Check cache first
    if (myTeamState.captainCache.has(entryId)) {
        return myTeamState.captainCache.get(entryId);
    }

    try {
        // Load team data
        const teamData = await loadMyTeam(entryId);

        // Cache full team data in rivalTeamCache for league ownership calculation
        myTeamState.rivalTeamCache.set(entryId, teamData);

        // Find captain from picks
        const captainPick = teamData.picks?.picks?.find(p => p.is_captain);

        if (captainPick) {
            const player = getPlayerById(captainPick.element);
            const captainName = player ? player.web_name : 'Unknown';

            // Cache captain name
            myTeamState.captainCache.set(entryId, captainName);
            return captainName;
        }

        // No captain found
        myTeamState.captainCache.set(entryId, 'No Captain');
        return 'No Captain';
    } catch (err) {
        console.error(`Failed to load captain for entry ${entryId}:`, err);
        myTeamState.captainCache.set(entryId, '—');
        return '—';
    }
}

/**
 * Render league tabs for selected leagues
 * @param {Object} myTeamState - Current state object
 * @returns {string} HTML for league tabs
 */
export function renderLeagueTabs(myTeamState) {
    if (myTeamState.selectedLeagues.length === 0) {
        return '';
    }

    // Get team data to access league names
    const teamLeagues = myTeamState.teamData?.team?.leagues?.classic || [];

    return `
        <div class="league-tabs-container" style="display: flex; gap: 0.25rem; background: var(--bg-secondary); padding: 0.5rem; border-bottom: 2px solid var(--border-color);">
            ${myTeamState.selectedLeagues.map((leagueId, index) => {
                const isActive = myTeamState.activeLeagueTab === leagueId;

                // Try to get league name from team data first (immediate), then from standings cache
                const teamLeague = teamLeagues.find(l => l.id === leagueId);
                const leagueData = myTeamState.leagueStandingsCache.get(leagueId);
                const leagueName = teamLeague?.name || leagueData?.league?.name || `League ${index + 1}`;

                return `
                    <button
                        class="league-tab-btn"
                        data-league-id="${leagueId}"
                        style="
                            padding: 0.75rem 1.25rem;
                            background: ${isActive ? 'var(--primary-color)' : 'var(--bg-primary)'};
                            color: ${isActive ? 'white' : 'var(--text-primary)'};
                            border: none;
                            border-radius: 6px 6px 0 0;
                            cursor: pointer;
                            font-weight: ${isActive ? '600' : '500'};
                            font-size: 0.875rem;
                            transition: all 0.2s;
                            white-space: nowrap;
                            max-width: 200px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        "
                        title="${escapeHtml(leagueName)}"
                    >
                        <i class="fas fa-trophy" style="margin-right: 0.5rem; font-size: 0.75rem;"></i>
                        ${escapeHtml(leagueName)}
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render content for the active league tab
 * @param {Object} myTeamState - Current state object
 * @returns {Promise<string>} HTML for league content
 */
export async function renderLeagueContent(myTeamState) {
    if (myTeamState.selectedLeagues.length === 0) {
        return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem;">
                <i class="fas fa-hand-pointer" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                    No Leagues Selected
                </h3>
                <p style="color: var(--text-secondary); max-width: 400px;">
                    Select up to 3 leagues from the sidebar to view detailed standings and compare with rivals.
                </p>
            </div>
        `;
    }

    if (!myTeamState.activeLeagueTab) {
        return `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Loading...</p>
            </div>
        `;
    }

    // Check if data is cached
    if (myTeamState.leagueStandingsCache.has(myTeamState.activeLeagueTab)) {
        const leagueData = myTeamState.leagueStandingsCache.get(myTeamState.activeLeagueTab);
        return await renderLeagueStandings(leagueData, myTeamState);
    }

    // Show loading state
    return `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p>Loading league standings...</p>
        </div>
    `;
}

/**
 * Update league tabs UI (dynamically add/remove tabs)
 * @param {Object} myTeamState - Current state object
 * @param {Function} attachLeagueTabListeners - Callback to attach tab listeners
 */
export function updateLeagueTabsUI(myTeamState, attachLeagueTabListeners) {
    // Find the tabs container
    const tabsContainer = document.querySelector('.league-tabs-container');
    if (!tabsContainer) {
        console.warn('⚠️ League tabs container not found');
        return;
    }

    // Re-render tabs HTML
    const newTabsHTML = renderLeagueTabs(myTeamState);

    if (newTabsHTML) {
        // Parse the new HTML to get just the buttons
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newTabsHTML;
        const newButtons = tempDiv.querySelector('.league-tabs-container').innerHTML;
        tabsContainer.innerHTML = newButtons;
        tabsContainer.style.display = 'flex'; // Make sure it's visible
        console.log('✅ Updated league tabs UI');
    } else {
        // No selected leagues, clear tabs
        tabsContainer.innerHTML = '';
        tabsContainer.style.display = 'none';
        console.log('🔄 Cleared league tabs (no selections)');
    }

    // Re-attach event listeners for new tabs
    attachLeagueTabListeners();
}

/**
 * Update league content UI (show content for active tab)
 * @param {Object} myTeamState - Current state object
 */
export async function updateLeagueContentUI(myTeamState) {
    const contentContainer = document.getElementById('league-content-container');
    if (!contentContainer) return;

    const html = await renderLeagueContent(myTeamState);
    contentContainer.innerHTML = html;

    // Attach event listeners for mobile rival rows
    if (shouldUseMobileLayout()) {
        attachMobileRivalListeners(myTeamState);
    }
}

// Cache expiration time in milliseconds (5 minutes)
const LEAGUE_CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Check if cached league data is still valid (not expired)
 * @param {Object} cachedData - Cached data with timestamp
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(cachedData) {
    if (!cachedData || !cachedData._timestamp) return false;
    const age = Date.now() - cachedData._timestamp;
    return age < LEAGUE_CACHE_EXPIRATION;
}

/**
 * Load standings for a specific league tab (with caching)
 * @param {number} leagueId - League ID to load
 * @param {Object} myTeamState - Current state object
 * @param {Function} updateLeagueContentUI - Callback to update content UI
 * @param {Function} updateLeagueTabsUI - Callback to update tabs UI
 */
export async function loadLeagueStandingsForTab(leagueId, myTeamState, updateLeagueContentUI, updateLeagueTabsUI) {
    const contentContainer = document.getElementById('league-content-container');
    if (!contentContainer) return;

    // Check if this is still the active tab
    if (myTeamState.activeLeagueTab !== leagueId) {
        console.log(`⏭️ Skipping load for league ${leagueId} (no longer active)`);
        return;
    }

    // Check cache first - only use if not expired
    const cachedData = myTeamState.leagueStandingsCache.get(leagueId);
    if (cachedData && isCacheValid(cachedData)) {
        console.log(`✅ Using cached data for league ${leagueId}`);
        updateLeagueContentUI();
        return;
    }

    // Cache expired or not present, need to fetch fresh data
    if (cachedData) {
        console.log(`🔄 Cache expired for league ${leagueId}, refreshing...`);
    }

    // Show loading state
    contentContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p>Loading league standings...</p>
        </div>
    `;

    try {
        // Fetch and cache with timestamp
        const data = await loadLeagueStandings(leagueId);
        data._timestamp = Date.now();
        myTeamState.leagueStandingsCache.set(leagueId, data);

        // Update content if still active tab
        if (myTeamState.activeLeagueTab === leagueId) {
            updateLeagueContentUI();
            updateLeagueTabsUI(); // Update tab name with fetched league name
        }

    } catch (err) {
        console.error(`Failed to load league ${leagueId}:`, err);

        // Show error if still active tab
        if (myTeamState.activeLeagueTab === leagueId) {
            contentContainer.innerHTML = `
                <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; text-align: center;">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary);">Failed to load league standings. Please try again.</p>
                </div>
            `;
        }
    }
}

/**
 * Load and render league standings for mobile view
 * @param {string} leagueId - League ID to load
 * @param {Object} myTeamState - Current state object
 */
export async function loadMobileLeagueStandings(leagueId, myTeamState) {
    // Support both mobile and desktop containers
    const container = document.getElementById('mobile-league-standings') || document.getElementById('desktop-league-standings');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p>Loading standings...</p>
        </div>
    `;

    try {
        // Fetch and cache with timestamp
        const leagueData = await loadLeagueStandings(leagueId);
        leagueData._timestamp = Date.now();
        myTeamState.leagueStandingsCache.set(leagueId, leagueData);

        const html = await renderLeagueStandings(leagueData, myTeamState);
        container.innerHTML = html;

        // Attach event listeners for mobile rival rows
        attachMobileRivalListeners(myTeamState);
    } catch (err) {
        console.error('Failed to load league standings:', err);
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--danger-color); margin-bottom: 1rem; display: block;"></i>
                <p style="color: var(--text-secondary);">Failed to load standings</p>
                <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem;">${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

/**
 * Render league standings table (with richer data)
 * @param {Object} leagueData - League standings data
 * @param {Object} myTeamState - Current state object
 * @returns {Promise<string>} HTML for league standings
 */
export async function renderLeagueStandings(leagueData, myTeamState) {
    const { league, standings } = leagueData;
    const results = standings.results;

    if (!results || results.length === 0) {
        return `
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; text-align: center; margin-bottom: 2rem;">
                <p style="color: var(--text-secondary);">No standings data available for ${escapeHtml(league.name)}</p>
            </div>
        `;
    }

    // Find user's entry in standings
    const userTeamId = parseInt(localStorage.getItem('fplanner_team_id'));
    const userEntry = results.find(r => r.entry === userTeamId);

    // Check if GW is live
    const activeGW = getActiveGW();
    const isLive = isGameweekLive(activeGW);

    // Calculate statistics (use live points if available)
    const leaderPoints = results[0]?.total || 0;
    const userPoints = userEntry?.total || 0;
    
    // Check if mobile layout
    const useMobile = shouldUseMobileLayout();

    // Load captain data for mobile view (needed for rendering)
    let captainNames = [];
    if (useMobile) {
        // Load captain data for all entries in parallel
        const captainPromises = results.slice(0, 50).map(entry => getCaptainName(entry.entry, myTeamState));
        captainNames = await Promise.all(captainPromises);
    }

    // Get GW average from gameweek event data (same source as scorecard)
    const gwEvent = getGameweekEvent(activeGW);
    const avgGWPoints = gwEvent?.average_entry_score || 0;
    console.log(`League standings - GW ${activeGW} average: ${avgGWPoints}`);

    // Helper function to get chip abbreviation
    function getChipAbbreviation(activeChip) {
        if (!activeChip) return '';
        const chipMap = {
            'freehit': 'FH',
            'wildcard': 'WC',
            'bboost': 'BB',
            'benchboost': 'BB',
            'triplecaptain': 'TC',
            '3xc': 'TC'
        };
        return chipMap[activeChip] || '';
    }

    // Helper function to format number compactly (50.2k, 2.1M)
    function formatCompactNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }

    // Helper function to get chips used abbreviations (excluding active chip)
    function getChipsUsedAbbreviations(teamData) {
        if (!teamData || !teamData.picks || !teamData.picks.chips) {
            console.log('No chips data available:', teamData?.picks?.chips);
            return '';
        }

        console.log('Chips array:', teamData.picks.chips);

        const chipsUsed = teamData.picks.chips
            .filter(chip => {
                const isPlayed = chip.event !== null && chip.event !== undefined;
                console.log(`Chip ${chip.name}: event=${chip.event}, played=${isPlayed}`);
                return isPlayed;
            })
            .map(chip => {
                const chipMap = {
                    'freehit': 'FH',
                    'wildcard': 'WC',
                    'bboost': 'BB',
                    'benchboost': 'BB',
                    'triplecaptain': 'TC',
                    '3xc': 'TC'
                };
                return chipMap[chip.name] || '';
            })
            .filter(abbr => abbr !== '');

        console.log('Chips used abbreviations:', chipsUsed.join(' '));
        return chipsUsed.join(' ');
    }

    // Helper function to count players played
    // If Bench Boost is active: count all 15 players
    // Otherwise: only count starting 11
    function countPlayersPlayed(teamData) {
        if (!teamData || !teamData.picks || !teamData.picks.picks) return null;

        const activeChip = teamData.picks?.active_chip;
        const isBenchBoost = activeChip === 'bboost' || activeChip === 'benchboost';

        let played = 0;
        teamData.picks.picks.forEach(pick => {
            // Only count starting 11 unless Bench Boost is active
            if (!isBenchBoost && pick.position > 11) {
                return;
            }

            const minutes = pick.live_stats?.minutes ?? 0;
            if (minutes > 0) {
                played++;
            }
        });

        return played;
    }

    /**
     * Calculate column-relative heatmap style
     * If values are too close (range < 20% of max), highlight highest/lowest only
     * Otherwise use proper heatmap based on value distribution
     * @param {number|null} value - Current value
     * @param {Array} allValues - All values in the column (excluding null)
     * @param {boolean} inverted - If true, lower is better (e.g., FDR)
     * @returns {Object} Style object with color only (no background)
     */
    function getColumnRelativeHeatmap(value, allValues, inverted = false) {
        if (value === null || allValues.length === 0) {
            return { color: 'var(--text-secondary)' };
        }

        const validValues = allValues.filter(v => v !== null);
        if (validValues.length === 0) {
            return { color: 'var(--text-secondary)' };
        }

        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        const range = max - min;

        // If range is too small (< 20% of max), just highlight highest/lowest
        const threshold = max * 0.2;
        if (range < threshold && validValues.length > 1) {
            if (inverted) {
                // Lower is better - highlight lowest in green, highest in red
                if (value === min) return { color: '#22c55e' }; // Green for lowest
                if (value === max) return { color: '#ef4444' }; // Red for highest
            } else {
                // Higher is better - highlight highest in green, lowest in red
                if (value === max) return { color: '#22c55e' }; // Green for highest
                if (value === min) return { color: '#ef4444' }; // Red for lowest
            }
            return { color: 'var(--text-primary)' };
        }

        // Otherwise use percentile-based heatmap
        const percentile = ((value - min) / range) * 100;
        
        if (inverted) {
            // Lower is better (FDR)
            if (percentile <= 25) return { color: '#22c55e' }; // Green for lowest 25%
            if (percentile <= 50) return { color: '#eab308' }; // Yellow for 25-50%
            if (percentile <= 75) return { color: '#f97316' }; // Orange for 50-75%
            return { color: '#ef4444' }; // Red for highest 25%
        } else {
            // Higher is better (xPts, xGI, Form, PPM, Own%)
            if (percentile >= 75) return { color: '#22c55e' }; // Green for top 25%
            if (percentile >= 50) return { color: '#eab308' }; // Yellow for 50-75%
            if (percentile >= 25) return { color: '#f97316' }; // Orange for 25-50%
            return { color: '#ef4444' }; // Red for bottom 25%
        }
    }

    /**
     * Calculate team-level metrics from starting 11 picks
     * @param {Object} teamData - Team data with picks
     * @param {number} gameweek - Current gameweek
     * @returns {Object} Team metrics
     */
    function calculateTeamMetrics(teamData, gameweek) {
        if (!teamData || !teamData.picks || !teamData.picks.picks) {
            return {
                xPts: null,
                xGI: null,
                avgForm: null,
                avgPPM: null,
                avgOwnership: null,
                avgFDR: null
            };
        }

        // Get starting 11 only
        const starting11 = teamData.picks.picks
            .filter(p => p.position <= 11)
            .map(pick => getPlayerById(pick.element))
            .filter(Boolean);

        if (starting11.length === 0) {
            return {
                xPts: null,
                xGI: null,
                avgForm: null,
                avgPPM: null,
                avgOwnership: null,
                avgFDR: null
            };
        }

        // Calculate metrics
        let totalXPts = 0;
        let totalXGI = 0;
        let totalForm = 0;
        let totalPPM = 0;
        let totalOwnership = 0;
        let totalFDR = 0;

        starting11.forEach(player => {
            // Expected points (ep_next)
            totalXPts += parseFloat(player.ep_next) || 0;
            
            // Expected goal involvements per 90
            totalXGI += parseFloat(player.expected_goal_involvements_per_90) || 0;
            
            // Form
            totalForm += parseFloat(player.form) || 0;
            
            // PPM
            totalPPM += calculatePPM(player);
            
            // Ownership
            totalOwnership += parseFloat(player.selected_by_percent) || 0;
            
            // FDR (next 5 GWs)
            totalFDR += calculateFixtureDifficulty(player.team, 5);
        });

        const count = starting11.length;

        return {
            xPts: count > 0 ? totalXPts : null,
            xGI: count > 0 ? totalXGI / count : null,
            avgForm: count > 0 ? totalForm / count : null,
            avgPPM: count > 0 ? totalPPM / count : null,
            avgOwnership: count > 0 ? totalOwnership / count : null,
            avgFDR: count > 0 ? totalFDR / count : null
        };
    }

    if (useMobile) {
        // Table-based layout with sticky first column and horizontal scroll (matching mobile Team page)
        const headerRow = `
            <div style="
                background: var(--bg-secondary);
                border-radius: 8px;
                overflow: hidden;
                margin-bottom: 0.5rem;
            ">
                <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    <table style="width: 100%; font-size: 0.7rem; border-collapse: collapse;">
                        <thead style="background: var(--bg-tertiary);">
                            <tr>
                                <th style="position: sticky; left: 0; background: var(--bg-tertiary); z-index: 10; text-align: left; padding: 0.5rem; min-width: 120px;">Team</th>
                                ${isLive ? '<th style="text-align: center; padding: 0.5rem; min-width: 50px;">Played</th>' : ''}
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">GW Pts</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 70px;">Total</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">xPts</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">xGI</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Form</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">PPM</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Own%</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">FDR</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        // First pass: collect all team metrics to calculate column-relative heatmaps
        const allMetrics = results.slice(0, 50).map((entry, index) => {
            const cachedTeamData = myTeamState.rivalTeamCache?.get(entry.entry);
            return calculateTeamMetrics(cachedTeamData, activeGW);
        });

        // Extract column values for heatmapping
        const allXPts = allMetrics.map(m => m.xPts).filter(v => v !== null);
        const allXGI = allMetrics.map(m => m.xGI).filter(v => v !== null);
        const allForm = allMetrics.map(m => m.avgForm).filter(v => v !== null);
        const allPPM = allMetrics.map(m => m.avgPPM).filter(v => v !== null);
        const allOwnership = allMetrics.map(m => m.avgOwnership).filter(v => v !== null);
        const allFDR = allMetrics.map(m => m.avgFDR).filter(v => v !== null);

        const rowsHtml = results.slice(0, 50).map((entry, index) => {
            const captainName = captainNames[index];
            const isUser = entry.entry === userTeamId;

            // Get GW points - use live points if available, otherwise event_total
            let gwPoints = entry.event_total || 0;
            let totalPoints = entry.total; // Season total
            const cachedTeamData = myTeamState.rivalTeamCache?.get(entry.entry);
            if (isLive && cachedTeamData && cachedTeamData.isLive) {
                const livePoints = calculateLiveTeamPoints(cachedTeamData);
                if (livePoints !== null) {
                    gwPoints = livePoints;
                }
                // Use live_total_points if available (backend calculates this)
                const liveTotal = cachedTeamData.picks?.entry_history?.live_total_points;
                if (liveTotal !== null && liveTotal !== undefined) {
                    totalPoints = liveTotal;
                }
            }

            // Get user's live total points for gap calculation
            let userTotalPoints = userPoints;
            if (isLive && userEntry) {
                const userCachedData = myTeamState.rivalTeamCache?.get(userTeamId);
                if (userCachedData && userCachedData.isLive) {
                    const userLiveTotal = userCachedData.picks?.entry_history?.live_total_points;
                    if (userLiveTotal !== null && userLiveTotal !== undefined) {
                        userTotalPoints = userLiveTotal;
                    }
                }
            }

            // Calculate gap to user - use live total points if available, otherwise regular total
            let gapText = '—';
            let gapColor = 'var(--text-secondary)';
            if (!isUser && userEntry) {
                const gap = userTotalPoints - totalPoints;
                if (gap > 0) {
                    gapText = `+${gap}`;
                    gapColor = '#22c55e'; // Green when user is ahead
                } else if (gap < 0) {
                    gapText = gap.toString();
                    gapColor = '#ef4444'; // Red when user is behind
                }
            }

            // Get overall rank from cached team data
            let overallRank = '—';
            if (cachedTeamData?.picks?.entry_history?.overall_rank) {
                overallRank = formatCompactNumber(cachedTeamData.picks.entry_history.overall_rank);
            }

            // Get chips used (excluding active chip)
            const chipsUsed = getChipsUsedAbbreviations(cachedTeamData);

            // Get active chip
            const activeChip = cachedTeamData?.picks?.active_chip;
            const activeChipName = getChipAbbreviation(activeChip);

            // Count players played (only during live GW)
            let playersPlayedText = '';
            if (isLive && cachedTeamData) {
                const playedCount = countPlayersPlayed(cachedTeamData);
                if (playedCount !== null) {
                    playersPlayedText = playedCount.toString();
                }
            }

            // GW points color coding (matching scorecard logic)
            let gwBgColor = 'transparent';
            let gwTextColor = 'var(--text-primary)';

            if (avgGWPoints > 0) {
                const diff = gwPoints - avgGWPoints;

                if (diff >= 15) {
                    // Exceptional - Purple (improved readability)
                    gwBgColor = 'rgba(147, 51, 234, 0.15)'; // Lighter background for better readability
                    gwTextColor = '#9333ea';
                } else if (diff >= 5) {
                    // Above average - Green
                    gwBgColor = 'rgba(34, 197, 94, 0.2)';
                    gwTextColor = '#22c55e';
                } else if (diff >= -4) {
                    // On average - Yellow
                    gwBgColor = 'rgba(234, 179, 8, 0.2)';
                    gwTextColor = '#eab308';
                } else {
                    // Below average - Red
                    gwBgColor = 'rgba(239, 68, 68, 0.2)';
                    gwTextColor = '#ef4444';
                }
            }

            // Get team metrics (already calculated in first pass)
            const teamMetrics = allMetrics[index];

            // Column-relative heatmap styles (no background, just color)
            const xPtsStyle = getColumnRelativeHeatmap(teamMetrics.xPts, allXPts, false);
            const xGIStyle = getColumnRelativeHeatmap(teamMetrics.xGI, allXGI, false);
            const formStyle = getColumnRelativeHeatmap(teamMetrics.avgForm, allForm, false);
            const ppmStyle = getColumnRelativeHeatmap(teamMetrics.avgPPM, allPPM, false);
            const ownStyle = getColumnRelativeHeatmap(teamMetrics.avgOwnership, allOwnership, false);
            const fdrStyle = getColumnRelativeHeatmap(teamMetrics.avgFDR, allFDR, true); // Inverted (lower is better)

            // Build chip badge if active chip exists
            let chipBadge = '';
            if (activeChipName) {
                chipBadge = `<span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: #000000; color: #e5e7eb; margin-left: 0.3rem;">${activeChipName}</span>`;
            }

            // Build Line 2: [Manager Name] • [Captain]
            let line2 = escapeHtml(entry.player_name);
            if (captainName && captainName !== '—' && captainName !== 'No Captain') {
                line2 += ` • ${escapeHtml(captainName)}`;
            }

            // Build Line 3: [Chips Played] • [Overall Rank]
            let line3 = chipsUsed || '—';
            if (overallRank && overallRank !== '—') {
                line3 += ` • ${overallRank}`;
            }

            // Row background for sticky column (no tint for user, use 👤 emoji instead)
            const rowBg = index % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)';
            const stickyColumnBg = rowBg;

            return `
                <tr style="background: ${rowBg}; ${!isUser ? 'cursor: pointer;' : ''}" 
                    class="${!isUser ? 'mobile-rival-team-row' : ''}"
                    data-rival-id="${entry.entry}"
                    data-league-id="${leagueData.league.id}">
                    <!-- Sticky Team Column -->
                    <td style="
                        position: sticky;
                        left: 0;
                        background: ${stickyColumnBg};
                        z-index: 5;
                        padding: 0.5rem;
                        border-right: 1px solid var(--border-color);
                        min-height: 3rem;
                    ">
                        <div style="display: flex; flex-direction: column; gap: 0.1rem;">
                            <!-- Line 1: [Rank] [Team Name] [👤 Badge] [Chip Badge] -->
                            <div style="display: flex; align-items: center; gap: 0.3rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden;">
                                <span style="font-size: 0.6rem; color: var(--text-secondary);">${entry.rank}</span>
                                <span style="font-size: 0.7rem; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(entry.entry_name)}</span>
                                ${isUser ? '<span style="font-size: 0.7rem;">👤</span>' : ''}
                                ${chipBadge}
                            </div>
                            <!-- Line 2: [Manager Name] • [Captain] -->
                            <div style="font-size: 0.6rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${line2}
                            </div>
                            <!-- Line 3: [Chips Played] • [Overall Rank] -->
                            <div style="font-size: 0.6rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${line3}
                                ${!isUser ? ' <i class="fas fa-eye" style="font-size: 0.55rem; opacity: 0.6;"></i>' : ''}
                            </div>
                        </div>
                    </td>
                    ${isLive ? `<td style="text-align: center; padding: 0.5rem; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">${playersPlayedText || '—'}</td>` : ''}
                    <td style="text-align: center; padding: 0.5rem;">
                        <span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: ${gwBgColor}; color: ${gwTextColor};">${gwPoints}</span>
                    </td>
                    <td style="text-align: center; padding: 0.5rem; font-weight: 600; font-size: 0.7rem;">
                        ${totalPoints.toLocaleString()}${!isUser && gapText !== '—' ? `<sup style="font-size: 0.5rem; color: ${gapColor}; margin-left: 0.1rem; font-weight: 600;">${gapText}</sup>` : ''}
                    </td>
                    <td style="text-align: center; padding: 0.5rem; font-weight: 600; font-size: 0.65rem; color: ${xPtsStyle.color};">
                        ${teamMetrics.xPts !== null ? Math.round(teamMetrics.xPts) : '—'}
                    </td>
                    <td style="text-align: center; padding: 0.5rem; font-weight: 600; font-size: 0.65rem; color: ${xGIStyle.color};">
                        ${teamMetrics.xGI !== null ? formatDecimal(teamMetrics.xGI) : '—'}
                    </td>
                    <td style="text-align: center; padding: 0.5rem; font-weight: 600; font-size: 0.65rem; color: ${formStyle.color};">
                        ${teamMetrics.avgForm !== null ? formatDecimal(teamMetrics.avgForm) : '—'}
                    </td>
                    <td style="text-align: center; padding: 0.5rem; font-weight: 600; font-size: 0.65rem; color: ${ppmStyle.color};">
                        ${teamMetrics.avgPPM !== null ? formatDecimal(teamMetrics.avgPPM) : '—'}
                    </td>
                    <td style="text-align: center; padding: 0.5rem; font-weight: 600; font-size: 0.65rem; color: ${ownStyle.color};">
                        ${teamMetrics.avgOwnership !== null ? formatDecimal(teamMetrics.avgOwnership) + '%' : '—'}
                    </td>
                    <td style="text-align: center; padding: 0.5rem; font-weight: 600; font-size: 0.65rem; color: ${fdrStyle.color};">
                        ${teamMetrics.avgFDR !== null ? formatDecimal(teamMetrics.avgFDR) : '—'}
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div style="margin-bottom: 0.75rem; background: var(--bg-secondary); padding: 0.5rem 0.75rem;">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">
                    <i class="fas fa-trophy"></i> ${escapeHtml(league.name)}
                </h4>
                <p style="font-size: 0.7rem; color: var(--text-secondary);">
                    ${standings.has_next ? `Top ${results.length}` : `${results.length} entries`}
                </p>
            </div>
            ${headerRow}
            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Desktop: Use mobile table format (removed desktop HTML table)
    return `
        <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); margin-bottom: 2rem;">
            <div style="margin-bottom: 1rem;">
                <h4 style="font-size: 1.125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                    <i class="fas fa-trophy"></i> ${escapeHtml(league.name)}
                </h4>
                <p style="font-size: 0.875rem; color: var(--text-secondary);">
                    ${standings.has_next ? `Showing top ${results.length} entries` : `${results.length} entries total`}
                </p>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                    <thead style="background: var(--primary-color); color: white;">
                        <tr>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Rank</th>
                            <th style="text-align: left; padding: 0.75rem 0.75rem;">Manager</th>
                            <th style="text-align: left; padding: 0.75rem 0.75rem;">Team</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Total</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;" title="Points gap to you">Gap</th>
                            ${isLive ? '<th style="text-align: center; padding: 0.75rem 0.5rem;" title="Players played / Total">Played</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${results.slice(0, 50).map((entry, index) => {
                            const isUser = entry.entry === userTeamId;
                            const rowBg = isUser ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-primary)';
                            const rankChange = entry.last_rank - entry.rank;
                            const rankChangeIcon = rankChange > 0 ? '▲' : rankChange < 0 ? '▼' : '━';
                            const rankChangeColor = rankChange > 0 ? '#22c55e' : rankChange < 0 ? '#ef4444' : 'var(--text-secondary)';

                            const fromLeader = entry.total - leaderPoints;
                            const fromLeaderText = fromLeader === 0 ? '—' : fromLeader.toLocaleString();

                            // Get GW points - use live points if available, otherwise event_total
                            let gwPoints = entry.event_total || 0;
                            let totalPoints = entry.total; // Season total
                            const cachedTeamData = myTeamState.rivalTeamCache?.get(entry.entry);
                            if (isLive && cachedTeamData && cachedTeamData.isLive) {
                                const livePoints = calculateLiveTeamPoints(cachedTeamData);
                                if (livePoints !== null) {
                                    gwPoints = livePoints;
                                }
                                // Use live_total_points if available (backend calculates this)
                                const liveTotal = cachedTeamData.picks?.entry_history?.live_total_points;
                                if (liveTotal !== null && liveTotal !== undefined) {
                                    totalPoints = liveTotal;
                                }
                            }
                            
                            // Get user's live total points for gap calculation
                            let userTotalPoints = userPoints;
                            if (isLive && userEntry) {
                                const userCachedData = myTeamState.rivalTeamCache?.get(userTeamId);
                                if (userCachedData && userCachedData.isLive) {
                                    const userLiveTotal = userCachedData.picks?.entry_history?.live_total_points;
                                    if (userLiveTotal !== null && userLiveTotal !== undefined) {
                                        userTotalPoints = userLiveTotal;
                                    }
                                }
                            }

                            // Calculate gap to user - use live total points if available, otherwise regular total
                            let gapText = '—';
                            let gapColor = 'var(--text-secondary)';
                            if (!isUser && userEntry) {
                                const gap = userTotalPoints - totalPoints;
                                if (gap > 0) {
                                    gapText = `+${gap}`;
                                    gapColor = '#ef4444';
                                } else if (gap < 0) {
                                    gapText = gap.toString();
                                    gapColor = '#22c55e';
                                }
                            }
                            // GW points color coding (matching scorecard logic)
                            let gwBgColor = 'transparent';
                            let gwTextColor = 'inherit';

                            if (avgGWPoints > 0) {
                                const diff = gwPoints - avgGWPoints;

                                if (diff >= 15) {
                                    // Exceptional - Purple
                                    gwBgColor = 'rgba(147, 51, 234, 0.15)';
                                    gwTextColor = '#9333ea';
                                } else if (diff >= 5) {
                                    // Above average - Green
                                    gwBgColor = 'rgba(34, 197, 94, 0.15)';
                                    gwTextColor = '#22c55e';
                                } else if (diff >= -4) {
                                    // On average - Yellow
                                    gwBgColor = 'rgba(234, 179, 8, 0.15)';
                                    gwTextColor = '#eab308';
                                } else {
                                    // Below average - Red
                                    gwBgColor = 'rgba(239, 68, 68, 0.15)';
                                    gwTextColor = '#ef4444';
                                }
                            }

                            return `
                                <tr
                                    class="${!isUser ? 'rival-team-row' : ''}"
                                    data-rival-id="${entry.entry}"
                                    data-league-id="${standings.league.id}"
                                    style="background: ${rowBg}; ${isUser ? 'border-left: 4px solid var(--primary-color);' : ''} ${!isUser ? 'cursor: pointer;' : ''}"
                                >
                                    <td style="padding: 0.75rem 0.5rem; text-align: center;">
                                        <div style="font-weight: 600;">${entry.rank.toLocaleString()}</div>
                                        <div style="font-size: 0.75rem; color: ${rankChangeColor};">
                                            ${rankChange !== 0 ? rankChangeIcon + ' ' + Math.abs(rankChange) : rankChangeIcon}
                                        </div>
                                    </td>
                                    <td style="padding: 0.75rem 0.75rem;">
                                        <strong>${escapeHtml(entry.player_name)}</strong>
                                        ${isUser ? ' <span style="color: var(--primary-color); font-weight: 700;">(You)</span>' : ''}
                                        ${!isUser ? ' <i class="fas fa-eye" style="margin-left: 0.5rem; color: var(--text-secondary); font-size: 0.75rem;"></i>' : ''}
                                    </td>
                                    <td style="padding: 0.75rem 0.75rem;">
                                        ${escapeHtml(entry.entry_name)}
                                        ${(() => {
                                            const cachedTeamData = myTeamState.rivalTeamCache?.get(entry.entry);
                                            const activeChip = cachedTeamData?.picks?.active_chip;
                                            const chipAbbr = getChipAbbreviation(activeChip);
                                            return chipAbbr ? ` <span style="color: var(--primary-color); font-weight: 600;">(${chipAbbr})</span>` : '';
                                        })()}
                                    </td>
                                    <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600; background: ${gwBgColor}; color: ${gwTextColor};">
                                        ${gwPoints}
                                    </td>
                                    <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${totalPoints.toLocaleString()}</td>
                                    <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; font-weight: 600; color: ${gapColor};">
                                        ${gapText}
                                    </td>
                                    ${isLive ? `<td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: var(--text-secondary);">
                                        ${(() => {
                                            const cachedTeamData = myTeamState.rivalTeamCache?.get(entry.entry);
                                            const playedCount = cachedTeamData ? countPlayersPlayed(cachedTeamData) : null;
                                            return playedCount !== null ? playedCount : '—';
                                        })()}
                                    </td>` : ''}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            ${standings.has_next ? `
                <div style="margin-top: 1rem; text-align: center;">
                    <p style="font-size: 0.875rem; color: var(--text-secondary);">
                        <i class="fas fa-info-circle"></i> Showing top 50 entries
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Attach event listeners for mobile rival team rows
 * @param {Object} myTeamState - Current state object
 */
export function attachMobileRivalListeners(myTeamState) {
    const mobileRivalRows = document.querySelectorAll('.mobile-rival-team-row');

    mobileRivalRows.forEach(row => {
        row.addEventListener('click', () => {
            const rivalId = parseInt(row.getAttribute('data-rival-id'));
            const leagueId = parseInt(row.getAttribute('data-league-id'));
            if (rivalId) {
                // Navigate to rival team page with league context
                window.navigateToRival(rivalId, leagueId || null);
            }
        });
    });
}

/**
 * Show rival team in mobile-friendly modal
 * @param {number} rivalId - Rival team ID
 * @param {Object} myTeamState - Current state object
 */
export async function showMobileRivalTeam(rivalId, myTeamState) {
    console.log(`Loading rival team ${rivalId} for mobile view...`);

    // Get or create modal
    let modal = document.getElementById('mobile-rival-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mobile-rival-modal';
        document.body.appendChild(modal);
    }

    // Show loading modal
    modal.style.display = 'block';
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            z-index: 2000;
            overflow-y: auto;
            padding: 1rem;
        ">
            <div style="text-align: center; color: white; margin-top: 50%;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
                <p style="font-size: 1rem;">Loading rival team...</p>
            </div>
        </div>
    `;

    try {
        // Check cache first
        let rivalTeamData;
        if (myTeamState.rivalTeamCache.has(rivalId)) {
            console.log(`✅ Using cached data for rival team ${rivalId}`);
            rivalTeamData = myTeamState.rivalTeamCache.get(rivalId);
        } else {
            // Load rival's team data
            rivalTeamData = await loadMyTeam(rivalId);
            myTeamState.rivalTeamCache.set(rivalId, rivalTeamData);
        }

        // Render rival team modal
        modal.innerHTML = renderMobileRivalModal(rivalTeamData, myTeamState);

        // Add close handler
        const closeBtn = modal.querySelector('.close-rival-modal-btn');
        const overlay = modal.querySelector('.rival-modal-overlay');

        const closeModal = () => {
            modal.style.display = 'none';
            modal.innerHTML = '';
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

    } catch (err) {
        console.error('Failed to load rival team:', err);
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                z-index: 2000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
            ">
                <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 12px; text-align: center; max-width: 400px;">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Failed to load rival team.</p>
                    <button
                        class="close-rival-modal-btn"
                        style="
                            padding: 0.5rem 1rem;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 0.875rem;
                        "
                    >
                        Close
                    </button>
                </div>
            </div>
        `;

        const closeBtn = modal.querySelector('.close-rival-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                modal.innerHTML = '';
            });
        }
    }
}

/**
 * Render mobile rival team modal
 * @param {Object} rivalTeamData - Rival's team data
 * @param {Object} myTeamState - User's team state (for comparing shared players)
 * @returns {string} HTML for mobile rival modal
 */
function renderMobileRivalModal(rivalTeamData, myTeamState = null) {
    const { team, picks } = rivalTeamData;
    const teamName = team?.name || 'Rival Team';
    const managerName = team?.player_first_name && team?.player_last_name
        ? `${team.player_first_name} ${team.player_last_name}`
        : 'Manager';

    // Get current gameweek (use getActiveGW for display)
    const gwNumber = getActiveGW() || 1;

    // Get user's player IDs for comparison
    const myPlayerIds = new Set();
    if (myTeamState?.teamData?.picks?.picks) {
        myTeamState.teamData.picks.picks.forEach(pick => {
            myPlayerIds.add(pick.element);
        });
    }

    // Get starters and bench
    const starters = picks?.picks?.filter(p => p.position <= 11) || [];
    const bench = picks?.picks?.filter(p => p.position > 11) || [];

    // Find captain and vice captain
    const captain = starters.find(p => p.is_captain);
    const viceCaptain = starters.find(p => p.is_vice_captain);

    const captainPlayer = captain ? getPlayerById(captain.element) : null;
    const vicePlayer = viceCaptain ? getPlayerById(viceCaptain.element) : null;

    // Render player row matching Team table style
    const renderPlayerRow = (pick, index, isBenchSection = false) => {
        const player = getPlayerById(pick.element);
        if (!player) return '';

        const isCaptain = pick.is_captain;
        const isVice = pick.is_vice_captain;
        const isBench = pick.position > 11;
        const isMyPlayer = myPlayerIds.has(player.id); // Check if player is in user's team

        let captainBadge = '';
        if (isCaptain) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.7rem;">(C)</span>';
        if (isVice) captainBadge = ' <span style="color: var(--text-primary); font-weight: 700; font-size: 0.7rem;">(VC)</span>';

        // Player badges (👤 for shared players, ⭐ for wishlisted)
        const badges = [];
        if (isMyPlayer) badges.push('👤');
        const badgeMarkup = badges.length > 0 ? ` <span style="font-size: 0.65rem;">${badges.join(' ')}</span>` : '';

        // Get opponent and match status
        const gwOpp = getGWOpponent(player.team, gwNumber);
        const matchStatus = getMatchStatus(player.team, gwNumber, player);
        const statusColors = calculateStatusColor(matchStatus);

        // Calculate points with captain multiplier
        const gwPoints = player.event_points || 0;
        const displayPoints = isCaptain ? (gwPoints * 2) : gwPoints;

        // Get heatmap styles for points and form
        const ptsHeatmap = getPtsHeatmap(displayPoints, 'gw_pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);
        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);

        // Background color
        const bgColor = calculatePlayerBgColor(isCaptain, isVice, isBench);

        // Border style - thick after last starter
        const borderStyle = pick.position === 11 ? '3px solid var(--border-color)' : '1px solid var(--border-color)';

        return `
            <div
                class="mobile-table-row mobile-table-team"
                style="
                background: ${bgColor};
                border-bottom: ${borderStyle};
                padding-bottom: 3px !important;
                padding-top: 3px !important;
            ">
                <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(player.web_name)}${captainBadge}${badgeMarkup}
                </div>
                <div style="text-align: center;">
                    ${renderOpponentBadge(gwOpp, 'small')}
                </div>
                <div style="text-align: center; padding: 0.5rem;">
                    <span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: ${statusColors.statusBgColor}; color: ${statusColors.statusColor}; white-space: nowrap;">${matchStatus}</span>
                </div>
                <div style="text-align: center; padding: 0.5rem;">
                    <span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: ${ptsStyle.background}; color: ${ptsStyle.color};">${displayPoints}</span>
                </div>
                <div style="text-align: center; padding: 0.5rem;">
                    <span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: ${formStyle.background}; color: ${formStyle.color};">${formatDecimal(player.form)}</span>
                </div>
            </div>
        `;
    };

    return `
        <div class="rival-modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            z-index: 2000;
            overflow-y: auto;
        ">
            <div style="
                max-width: 600px;
                margin: 0 auto;
                padding: 1rem;
                min-height: 100%;
                display: flex;
                flex-direction: column;
            ">
                <!-- Header -->
                <div style="
                    background: var(--bg-primary);
                    padding: 1rem;
                    border-radius: 12px 12px 0 0;
                    border-bottom: 2px solid var(--border-color);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <h3 class="heading-section" style="margin: 0;">
                            ${escapeHtml(teamName)}
                        </h3>
                        <button class="close-rival-modal-btn" style="
                            background: transparent;
                            border: none;
                            color: var(--text-secondary);
                            font-size: 1.5rem;
                            cursor: pointer;
                            padding: 0;
                            width: 2rem;
                            height: 2rem;
                            line-height: 1;
                        ">
                            ×
                        </button>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">
                        Managed by ${escapeHtml(managerName)}
                    </p>
                    ${captainPlayer ? `
                        <div style="margin-top: 0.75rem; padding: 0.5rem; background: var(--bg-secondary); border-radius: 6px; font-size: 0.7rem;">
                            <div style="color: var(--text-secondary);">
                                Captain: <span style="color: var(--text-primary); font-weight: 600;">${escapeHtml(captainPlayer.web_name)}</span>
                            </div>
                            ${vicePlayer ? `
                                <div style="color: var(--text-secondary); margin-top: 0.25rem;">
                                    Vice: <span style="color: var(--text-primary); font-weight: 600;">${escapeHtml(vicePlayer.web_name)}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>

                <!-- Team List -->
                <div style="background: var(--bg-primary); padding: 0; border-radius: 0 0 12px 12px;">
                    <!-- Column Headers - matching Team table -->
                    <div class="mobile-table-header mobile-table-team" style="padding: 0.5rem;">
                        <div>Player</div>
                        <div style="text-align: center;">Opp</div>
                        <div style="text-align: center;">Status</div>
                        <div style="text-align: center;">Pts</div>
                        <div style="text-align: center;">Form</div>
                    </div>

                    <!-- Starters -->
                    ${starters.map((pick, idx) => renderPlayerRow(pick, idx)).join('')}

                    ${bench.length > 0 ? `
                        <!-- Bench -->
                        ${bench.map((pick, idx) => renderPlayerRow(pick, idx, true)).join('')}
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Load and compare rival team (with modal and caching)
 * @param {number} rivalId - Rival team ID
 * @param {Object} myTeamState - Current state object
 */
export async function loadAndCompareRivalTeam(rivalId, myTeamState) {
    console.log(`Loading rival team ${rivalId} for comparison...`);

    // Update state
    myTeamState.comparisonRivalId = rivalId;

    // Get or create modal
    let modal = document.getElementById('comparison-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'comparison-modal';
        document.body.appendChild(modal);
    }

    // Show loading modal
    modal.style.display = 'block';
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <div style="text-align: center; color: white;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p style="font-size: 1.125rem;">Loading rival team for comparison...</p>
            </div>
        </div>
    `;

    try {
        // Check cache first
        let rivalTeamData;
        if (myTeamState.rivalTeamCache.has(rivalId)) {
            console.log(`✅ Using cached data for rival team ${rivalId}`);
            rivalTeamData = myTeamState.rivalTeamCache.get(rivalId);
        } else {
            // Load rival's team data
            rivalTeamData = await loadMyTeam(rivalId);
            myTeamState.rivalTeamCache.set(rivalId, rivalTeamData);
        }

        myTeamState.comparisonRivalData = rivalTeamData;

        // Render comparison in modal
        modal.innerHTML = renderComparisonModal(myTeamState.teamData, rivalTeamData);

        // Add click handler to close modal when clicking overlay
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'comparison-modal-overlay') {
                closeComparisonModal();
            }
        });

    } catch (err) {
        console.error('Failed to load rival team:', err);
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="background: var(--bg-primary); padding: 2rem; border-radius: 12px; text-align: center; max-width: 400px;">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Failed to load rival team. Please try again.</p>
                    <button
                        class="close-modal-btn"
                        style="
                            padding: 0.5rem 1rem;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                        "
                    >
                        Close
                    </button>
                </div>
            </div>
        `;
    }
}

/**
 * Close comparison modal
 */
export function closeComparisonModal() {
    const modal = document.getElementById('comparison-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
}

/**
 * Render comparison modal wrapper
 * @param {Object} myTeamData - User's team data
 * @param {Object} rivalTeamData - Rival's team data
 * @returns {string} HTML for comparison modal
 */
export function renderComparisonModal(myTeamData, rivalTeamData) {
    return `
        <div
            id="comparison-modal-overlay"
            style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 1000;
                overflow-y: auto;
                padding: 2rem;
            "
        >
            <div style="
                max-width: 1400px;
                margin: 0 auto;
                background: var(--bg-primary);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                position: relative;
            ">
                ${renderTeamComparison(myTeamData, rivalTeamData)}
            </div>
        </div>
    `;
}
