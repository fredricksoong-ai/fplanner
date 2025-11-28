// ============================================================================
// PLAYER MODAL
// Detailed player stats modal with 4-quadrant layout
// ============================================================================

import { getPlayerById, fplFixtures, getActiveGW, getAllPlayers } from '../../data.js';
import { getGlassmorphism, getShadow, getAnimationCurve, getAnimationDuration, getMobileBorderRadius } from '../../styles/mobileDesignSystem.js';
import {
    getPositionShort,
    getTeamShortName,
    escapeHtml,
    getCurrentGW,
    formatDecimal
} from '../../utils.js';
import { getMatchStatus } from '../../fixtures.js';
import { analyzePlayerRisks } from '../../risk.js';
import { renderOpponentBadge } from './compactStyleHelpers.js';
import { isWishlisted, toggleWishlist } from '../../wishlist/store.js';
import { getMyPlayerIdSet } from '../../utils/myPlayers.js';

/**
 * Check if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

// Team primary colors for styling
const TEAM_COLORS = {
    1: '#EF0107',   // Arsenal
    2: '#95BFE5',   // Aston Villa
    3: '#DA291C',   // Bournemouth
    4: '#E30613',   // Brentford
    5: '#0057B8',   // Brighton
    6: '#6C1D45',   // Burnley
    7: '#034694',   // Chelsea
    8: '#1B458F',   // Crystal Palace
    9: '#003399',   // Everton
    10: '#000000',  // Fulham
    11: '#FFCD00',  // Leeds (if in league)
    12: '#C8102E',  // Liverpool
    13: '#6CABDD',  // Man City
    14: '#DA291C',  // Man United
    15: '#241F20',  // Newcastle
    16: '#DD0000',  // Nottingham Forest
    17: '#EB172B',  // Southampton/Sunderland
    18: '#132257',  // Tottenham
    19: '#7A263A',  // West Ham
    20: '#FDB913', // Wolves
    21: '#0057B8',  // Ipswich (placeholder)
    22: '#C8102E',  // Leicester (placeholder)
};

/**
 * Get team primary color
 * @param {number} teamId - Team ID
 * @returns {string} Hex color code
 */
function getTeamColor(teamId) {
    return TEAM_COLORS[teamId] || '#666666';
}

/**
 * Check if a hex color is dark (needs light background)
 * @param {string} hex - Hex color code
 * @returns {boolean} True if color is dark
 */
function isColorDark(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance (perceived brightness)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance < 0.5;
}

/**
 * Get inline styles for FDR difficulty
 * @param {number} difficulty - Fixture difficulty rating (1-5)
 * @returns {Object} Background and text color styles
 */
function getFDRStyles(difficulty) {
    const colors = {
        1: { bg: '#147d1e', color: '#ffffff' }, // Dark green (easiest)
        2: { bg: '#00ff87', color: '#000000' }, // Light green
        3: { bg: '#ebebe4', color: '#000000' }, // Gray (neutral)
        4: { bg: '#ff1751', color: '#ffffff' }, // Pink/Red
        5: { bg: '#861247', color: '#ffffff' }  // Dark red (hardest)
    };
    return colors[difficulty] || colors[3];
}

/**
 * Get fixture difficulty for a team in a specific GW
 * @param {number} teamId - Team ID
 * @param {number} opponentId - Opponent team ID
 * @param {number} gwNumber - Gameweek number
 * @param {boolean} isHome - Whether team played at home
 * @returns {number} Difficulty rating 1-5
 */
function getFixtureDifficulty(teamId, opponentId, gwNumber, isHome) {
    if (!fplFixtures || fplFixtures.length === 0) return 3;

    const fixture = fplFixtures.find(f =>
        f.event === gwNumber &&
        ((f.team_h === teamId && f.team_a === opponentId) ||
         (f.team_a === teamId && f.team_h === opponentId))
    );

    if (!fixture) return 3;

    // Return difficulty from the team's perspective
    if (isHome) {
        return fixture.team_h_difficulty || 3;
    } else {
        return fixture.team_a_difficulty || 3;
    }
}

/**
 * Calculate league ownership from cached rival teams
 * @param {number} playerId - Player ID to check
 * @param {Object} myTeamState - State object with rivalTeamCache
 * @returns {Object|null} Ownership stats with owner details
 */
function calculateLeagueOwnership(playerId, myTeamState) {
    if (!myTeamState || !myTeamState.rivalTeamCache || myTeamState.rivalTeamCache.size === 0) {
        return null;
    }

    const owners = [];
    const totalRivals = myTeamState.rivalTeamCache.size;

    // Get league standings to find ranks
    const activeLeagueId = myTeamState.activeLeagueTab;
    // Try both string and number keys since Map might store either
    let leagueData = null;
    if (activeLeagueId) {
        leagueData = myTeamState.leagueStandingsCache.get(activeLeagueId) ||
                     myTeamState.leagueStandingsCache.get(String(activeLeagueId)) ||
                     myTeamState.leagueStandingsCache.get(parseInt(activeLeagueId, 10));
    }
    const standings = leagueData?.standings?.results || [];

    // Find user's own points from standings
    const myTeamId = myTeamState.teamId;
    const myStanding = standings.find(s => parseInt(s.entry, 10) === parseInt(myTeamId, 10));
    const myPoints = myStanding?.total || 0;

    myTeamState.rivalTeamCache.forEach((rivalData, entryId) => {
        if (rivalData && rivalData.picks && rivalData.picks.picks) {
            const hasPlayer = rivalData.picks.picks.some(pick => pick.element === playerId);
            if (hasPlayer) {
                // Find this entry in standings - try both number and string comparison
                const standingEntry = standings.find(s =>
                    s.entry === entryId ||
                    s.entry === Number(entryId) ||
                    String(s.entry) === String(entryId)
                );
                // Get team name from the rival's team data
                const teamName = rivalData.team?.name || standingEntry?.entry_name || 'Unknown';
                const ownerPoints = standingEntry?.total || 0;
                const pointsGap = ownerPoints - myPoints; // positive = they're ahead
                owners.push({
                    entryId,
                    name: teamName,
                    rank: standingEntry?.rank || 0,
                    points: ownerPoints,
                    gap: pointsGap
                });
            }
        }
    });

    // Sort by rank (or by points gap if no ranks)
    owners.sort((a, b) => {
        if (a.rank > 0 && b.rank > 0) {
            return a.rank - b.rank;
        }
        // Fall back to sorting by points gap (closest competitors first)
        return Math.abs(a.gap) - Math.abs(b.gap);
    });

    return {
        owners,
        total: totalRivals,
        percentage: totalRivals > 0 ? ((owners.length / totalRivals) * 100).toFixed(0) : 0
    };
}

/**
 * Get top 5 comparison players (same position, not in my team, sorted by form)
 * @param {Object} player - Current player
 * @param {Object} myTeamState - State with team data
 * @returns {Array} Top 5 comparison players
 */
function getComparisonPlayers(player, myTeamState) {
    const allPlayers = getAllPlayers();
    if (!allPlayers || allPlayers.length === 0) return [];

    // Get my team's player IDs
    let myPlayerIds = new Set();
    const cachedTeamId = localStorage.getItem('fplanner_team_id');
    if (cachedTeamId) {
        const cachedTeamData = localStorage.getItem(`fplanner_team_${cachedTeamId}`);
        if (cachedTeamData) {
            try {
                const teamData = JSON.parse(cachedTeamData);
                if (teamData && teamData.picks && teamData.picks.picks) {
                    myPlayerIds = new Set(teamData.picks.picks.map(p => p.element));
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

    // Filter: same position, not in my team, not the current player
    const samePosition = allPlayers.filter(p =>
        p.element_type === player.element_type &&
        p.id !== player.id &&
        !myPlayerIds.has(p.id)
    );

    // Sort by form descending
    samePosition.sort((a, b) => (parseFloat(b.form) || 0) - (parseFloat(a.form) || 0));

    // Return top 5
    return samePosition.slice(0, 5);
}

const PLAYER_SUMMARY_TTL = 5 * 60 * 1000; // 5 minutes
const playerSummaryCache = new Map();

function getCachedPlayerSummary(playerId) {
    const cached = playerSummaryCache.get(playerId);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > PLAYER_SUMMARY_TTL) {
        playerSummaryCache.delete(playerId);
        return null;
    }

    return cached.data;
}

function setPlayerSummaryCache(playerId, data) {
    playerSummaryCache.set(playerId, {
        data,
        timestamp: Date.now()
    });
}

/**
 * Fetch player history from API with memoization
 * @param {number} playerId - Player ID
 * @returns {Promise<Object>} Player history data
 */
async function fetchPlayerHistory(playerId) {
    const cached = getCachedPlayerSummary(playerId);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(`/api/player/${playerId}/summary`);
        if (!response.ok) throw new Error('Failed to fetch player summary');
        const data = await response.json();
        setPlayerSummaryCache(playerId, data);
        return data;
    } catch (err) {
        console.error('Failed to fetch player history:', err);

        // Return stale cache if available, otherwise empty defaults
        const fallback = playerSummaryCache.get(playerId)?.data;
        return fallback || { history: [], fixtures: [] };
    }
}

/**
 * Calculate points breakdown from live_stats or github_gw data
 * @param {Object} player - Player object
 * @param {Object} liveStats - Live stats object (if GW is live)
 * @param {Object} gwStats - GitHub GW stats (if GW is finished)
 * @returns {Object} Points breakdown object with all components
 */
function calculateGWPointsBreakdown(player, liveStats, gwStats) {
    const position = getPositionShort(player);
    const positionType = player.element_type; // 1=GKP, 2=DEF, 3=MID, 4=FWD
    
    // Use live_stats if available, otherwise fall back to github_gw
    const stats = liveStats || gwStats || {};
    const minutes = stats.minutes || 0;
    
    const breakdown = {};
    
    // [Minutes] Appearance points: 1pt (<60min), 2pts (60+min)
    if (minutes > 0) {
        breakdown.minutes = {
            label: 'Minutes',
            value: minutes >= 60 ? 2 : 1,
            points: minutes >= 60 ? 2 : 1
        };
    }
    
    // [Goals] Goal points: position_multiplier × goals_scored
    const goals = stats.goals_scored || 0;
    if (goals > 0) {
        const goalMultiplier = positionType === 1 ? 10 : (positionType === 2 ? 6 : (positionType === 3 ? 5 : 4));
        breakdown.goals = {
            label: 'Goals',
            value: goals,
            points: goals * goalMultiplier
        };
    }
    
    // [Assists] Assist points: assists × 3
    const assists = stats.assists || 0;
    if (assists > 0) {
        breakdown.assists = {
            label: 'Assists',
            value: assists,
            points: assists * 3
        };
    }
    
    // [Clean Sheet] Clean sheet points: position_multiplier × clean_sheets
    const cleanSheets = stats.clean_sheets || 0;
    if (cleanSheets > 0) {
        const csMultiplier = (positionType === 1 || positionType === 2) ? 4 : (positionType === 3 ? 1 : 0);
        if (csMultiplier > 0) {
            breakdown.cleanSheet = {
                label: 'Clean Sheet',
                value: cleanSheets,
                points: cleanSheets * csMultiplier
            };
        }
    }
    
    // [Saves] Saves points (GKP only): Math.floor(saves / 3)
    const saves = stats.saves || 0;
    if (positionType === 1 && saves > 0) {
        const savesPoints = Math.floor(saves / 3);
        if (savesPoints > 0) {
            breakdown.saves = {
                label: 'Saves',
                value: saves,
                points: savesPoints
            };
        }
    }
    
    // [PK Save] Penalty saves (GKP only): penalties_saved × 5
    const penaltiesSaved = stats.penalties_saved || 0;
    if (positionType === 1 && penaltiesSaved > 0) {
        breakdown.pkSave = {
            label: 'PK Save',
            value: penaltiesSaved,
            points: penaltiesSaved * 5
        };
    }
    
    // [DEFCON] Defensive contributions: DEF (10 DCs = 2pts), MID/FWD (12 DCs = 2pts)
    // Calculate from individual defensive action fields
    let defCon = 0;
    let defConPoints = 0;
    
    if (positionType === 2 || positionType === 3 || positionType === 4) {
        // For DEF: clearances + blocks + interceptions + tackles
        // For MID/FWD: clearances + blocks + interceptions + tackles + recoveries
        const clearances = stats.clearances || 0;
        const blocks = stats.blocks || 0;
        const interceptions = stats.interceptions || 0;
        const tackles = stats.tackles || 0;
        const recoveries = stats.recoveries || 0;
        
        if (positionType === 2) {
            // DEF: CBIT (10 = 2pts)
            defCon = clearances + blocks + interceptions + tackles;
            if (defCon >= 10) {
                defConPoints = 2;
            }
        } else {
            // MID/FWD: CBIRT (12 = 2pts)
            defCon = clearances + blocks + interceptions + tackles + recoveries;
            if (defCon >= 12) {
                defConPoints = 2;
            }
        }
        
        // Only show if points were earned (threshold reached)
        if (defConPoints > 0) {
            breakdown.defCon = {
                label: 'DEFCON',
                value: defCon,
                points: defConPoints
            };
        }
    }
    
    // [PK Miss] Penalty misses: penalties_missed × -2
    const penaltiesMissed = stats.penalties_missed || 0;
    if (penaltiesMissed > 0) {
        breakdown.pkMiss = {
            label: 'PK Miss',
            value: penaltiesMissed,
            points: penaltiesMissed * -2
        };
    }
    
    // [Conceded] Goals conceded (GKP/DEF only): Math.floor(goals_conceded / 2) × -1
    const goalsConceded = stats.goals_conceded || 0;
    if ((positionType === 1 || positionType === 2) && goalsConceded > 0) {
        const concededPoints = Math.floor(goalsConceded / 2) * -1;
        if (concededPoints < 0) {
            breakdown.conceded = {
                label: 'Conceded',
                value: goalsConceded,
                points: concededPoints
            };
        }
    }
    
    // [Yellow Cards] Yellow cards: yellow_cards × -1
    const yellowCards = stats.yellow_cards || 0;
    if (yellowCards > 0) {
        breakdown.yellowCards = {
            label: 'Yellow Cards',
            value: yellowCards,
            points: yellowCards * -1
        };
    }
    
    // [Red Cards] Red cards: red_cards × -3
    const redCards = stats.red_cards || 0;
    if (redCards > 0) {
        breakdown.redCards = {
            label: 'Red Cards',
            value: redCards,
            points: redCards * -3
        };
    }
    
    // [Own Goal] Own goals: own_goals × -2
    const ownGoals = stats.own_goals || 0;
    if (ownGoals > 0) {
        breakdown.ownGoal = {
            label: 'Own Goal',
            value: ownGoals,
            points: ownGoals * -2
        };
    }
    
    // [Bonus] Bonus points: bonus or provisional_bonus (1-3 points)
    const bonus = liveStats?.provisional_bonus ?? liveStats?.bonus ?? stats.bonus ?? 0;
    if (bonus > 0) {
        breakdown.bonus = {
            label: 'Bonus',
            value: bonus,
            points: bonus
        };
    }
    
    return breakdown;
}

/**
 * Inject modal animation keyframes
 */
function injectModalAnimations() {
    if (document.getElementById('player-modal-animations')) return;

    const style = document.createElement('style');
    style.id = 'player-modal-animations';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }

        @keyframes slideDown {
            from {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            to {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show player modal with details
 * @param {number} playerId - Player ID
 * @param {Object} myTeamState - Optional state object for league ownership
 */
export async function showPlayerModal(playerId, myTeamState = null, options = {}) {
    // Inject animations
    injectModalAnimations();

    const player = getPlayerById(playerId);
    if (!player) return;

    const currentGW = getCurrentGW();
    const activeGW = getActiveGW(); // For UI display (Past/Upcoming)
    const team = getTeamShortName(player.team);
    const position = getPositionShort(player);
    const price = (player.now_cost / 10).toFixed(1);

    // Show loading modal first
    showLoadingModal(player, team, position, price);

    // Fetch player history
    const playerSummary = await fetchPlayerHistory(playerId);

    // Get live stats from enriched bootstrap (available on all players during live GW)
    const liveStats = player.live_stats;
    const hasLiveStats = !!liveStats;

    // Get GW stats - prioritize live_stats during live GW, otherwise use github_gw for finished GWs
    // Only use github_gw if not in live state or if live_stats not available
    const gwStats = (!hasLiveStats && player.github_gw) ? player.github_gw : {};

    // Calculate GW points from live stats or fallback sources
    let gwPoints = liveStats?.total_points ?? gwStats.total_points ?? player.event_points ?? 0;

    // Only use minutes if match has started/finished
    let minutes = null;
    if (liveStats?.minutes !== null && liveStats?.minutes !== undefined) {
        minutes = liveStats.minutes;
    } else if (!hasLiveStats && gwStats.minutes !== null && gwStats.minutes !== undefined) {
        minutes = gwStats.minutes;
    }
    
    const bps = liveStats?.bps ?? gwStats.bps ?? 0;
    
    // Calculate points breakdown - always pass liveStats if available, it takes priority
    const pointsBreakdown = calculateGWPointsBreakdown(player, liveStats, hasLiveStats ? {} : gwStats);
    
    const xG = gwStats.expected_goals ? parseFloat(gwStats.expected_goals).toFixed(2) : '0.00';
    const xA = gwStats.expected_assists ? parseFloat(gwStats.expected_assists).toFixed(2) : '0.00';

    // Check if player's match is live
    const matchStatus = getMatchStatus(player.team, activeGW, player);
    const isLive = matchStatus.startsWith('LIVE');

    // Ownership stats
    const ownership = parseFloat(player.selected_by_percent) || 0;
    const leagueOwnership = calculateLeagueOwnership(playerId, myTeamState);

    // Past 3 GW history (exclude current active GW since it's shown in top-left)
    const history = playerSummary.history || [];
    // Filter to only GWs before the active GW, then take last 3
    const pastHistory = history.filter(h => h.round < activeGW);
    const past3GW = pastHistory.slice(-3).reverse();

    // Next 3 fixtures (after active GW)
    const upcomingFixtures = getUpcomingFixturesAfterGW(player, activeGW).slice(0, 3);

    // Get risk factors for this player
    const risks = analyzePlayerRisks(player);

    // Get comparison players (same position, not in my team, sorted by form)
    const comparisonPlayers = getComparisonPlayers(player, myTeamState);
    const myPlayerIds = getMyPlayerIdSet();
    const isMyPlayer = myPlayerIds.has(playerId);
    const canWishlist = !isMyPlayer;
    const wishlistActive = canWishlist && isWishlisted(playerId);

    // Build modal HTML
    const modalHTML = buildModalHTML({
        player,
        team,
        position,
        price,
        currentGW: activeGW,  // Use activeGW for display
        gwPoints,
        minutes: minutes ?? 0,
        bps,
        xG,
        xA,
        pointsBreakdown,
        ownership,
        leagueOwnership,
        past3GW,
        upcomingFixtures,
        isLive,
        risks,
        comparisonPlayers,
        actionConfig: options.primaryAction || null,
        canWishlist,
        wishlistActive
    });

    // Update modal content
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.innerHTML = modalHTML;
        attachModalListeners({
            actionConfig: options.primaryAction || null,
            wishlistConfig: canWishlist ? { playerId, isActive: wishlistActive } : null
        });
    }
}

/**
 * Show loading state modal
 */
function showLoadingModal(player, team, position, price) {
    // Remove existing modal
    const existingModal = document.getElementById('player-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const shadow = getShadow('modal');
    const radius = getMobileBorderRadius('xlarge');
    const animationCurve = getAnimationCurve('decelerate');
    const animationDuration = getAnimationDuration('modal');

    const loadingHTML = `
        <div id="player-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            animation: fadeIn ${animationDuration} ${animationCurve};
        ">
            <div style="
                background: var(--bg-primary);
                border-radius: ${radius};
                max-width: 500px;
                width: 100%;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: ${shadow};
                animation: slideUp ${animationDuration} ${animationCurve};
            ">
                <!-- Header -->
                <div style="
                    padding: 0.75rem 1rem;
                    border-bottom: 2px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                        ${escapeHtml(player.web_name)} <span style="color: var(--text-secondary); font-weight: 400;">• ${team} • ${position} • £${price}m</span>
                    </div>
                    <button
                        id="close-player-modal"
                        style="
                            background: transparent;
                            border: none;
                            font-size: 1.5rem;
                            color: var(--text-secondary);
                            cursor: pointer;
                            padding: 0;
                            width: 2rem;
                            height: 2rem;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        "
                    >
                        ×
                    </button>
                </div>
                <div style="padding: 3rem; text-align: center;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--text-secondary);"></i>
                    <p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.75rem;">Loading player data...</p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', loadingHTML);
    attachModalListeners();
}

/**
 * Build the full modal HTML
 */
function buildModalHTML(data) {
    const {
        player, team, position, price, currentGW,
        gwPoints, minutes, bps, xG, xA,
        pointsBreakdown,
        ownership, leagueOwnership, past3GW, upcomingFixtures, isLive,
        risks, comparisonPlayers,
        actionConfig,
        canWishlist = false,
        wishlistActive = false
    } = data;

    // LIVE indicator styles
    const liveIndicator = isLive ? `
        <span style="
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            padding: 0.1rem 0.35rem;
            border-radius: 0.25rem;
            font-size: 0.55rem;
            font-weight: 700;
            margin-left: 0.5rem;
            animation: pulse 2s infinite;
        ">
            <span style="width: 6px; height: 6px; background: #ef4444; border-radius: 50%; animation: pulse 1s infinite;"></span>
            LIVE
        </span>
    ` : '';

    const wishlistButtonHTML = canWishlist ? `
        <button
            id="player-modal-wishlist-btn"
            data-active="${wishlistActive ? 'true' : 'false'}"
            style="
                background: transparent;
                border: none;
                cursor: pointer;
                color: ${wishlistActive ? '#facc15' : 'var(--text-secondary)'};
                font-size: 1.1rem;
                padding: 0.15rem;
                display: flex;
                align-items: center;
                justify-content: center;
            "
            title="${wishlistActive ? 'Remove from wishlist' : 'Add to wishlist'}"
        >
            <i class="${wishlistActive ? 'fas' : 'far'} fa-star"></i>
        </button>
    ` : '';

    // GW Stats section (top-left) - Points Breakdown
    let gwStatsHTML = `
        <div style="flex: 1; min-width: 140px;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                GW ${currentGW} Stats${liveIndicator}
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.7rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--border-color);">
                    <span style="color: var(--text-secondary); font-weight: 600;">Total Points</span>
                    <span style="font-weight: 700; font-size: 0.8rem;">${gwPoints}${isLive ? '*' : ''}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.65rem;">
    `;
    
    // Display points breakdown (only show fields with values)
    const breakdownItems = Object.entries(pointsBreakdown);
    
    if (breakdownItems.length > 0) {
        breakdownItems.forEach(([key, item]) => {
            const isPositive = item.points > 0;
            const pointColor = isPositive ? '#22c55e' : '#ef4444';
            const prefix = isPositive ? '+' : '';
            
            gwStatsHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-secondary);">${item.label}</span>
                    <span style="color: ${pointColor}; font-weight: 600;">${prefix}${item.points}</span>
                </div>
            `;
        });
    } else {
        gwStatsHTML += `
            <div style="color: var(--text-secondary); font-size: 0.6rem;">
                No stats available yet
            </div>
        `;
    }
    
    // Add supporting stats at bottom (minutes, BPS, xG/xA)
    if (minutes > 0 || bps > 0 || parseFloat(xG) > 0 || parseFloat(xA) > 0) {
        gwStatsHTML += `
                </div>
                <div style="margin-top: 0.25rem; padding-top: 0.25rem; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.6rem; color: var(--text-secondary);">
        `;
        
        if (minutes > 0) {
            gwStatsHTML += `
                <div style="display: flex; justify-content: space-between;">
                    <span>Minutes</span>
                    <span style="font-weight: 500;">${minutes}</span>
                </div>
            `;
        }
        
        if (bps > 0) {
            gwStatsHTML += `
                <div style="display: flex; justify-content: space-between;">
                    <span>BPS</span>
                    <span style="font-weight: 500;">${bps}</span>
                </div>
            `;
        }
        
        if (parseFloat(xG) > 0 || parseFloat(xA) > 0) {
            gwStatsHTML += `
                <div style="display: flex; justify-content: space-between;">
                    <span>xG/xA</span>
                    <span style="font-weight: 500;">${xG}/${xA}</span>
                </div>
            `;
        }
        
        gwStatsHTML += `</div>`;
    } else {
        gwStatsHTML += `</div>`;
    }
    
    gwStatsHTML += `
            </div>
        </div>
    `;

    // Player Comparison section (top-right) - Top 5 same position players by form
    let comparisonHTML = `
        <div style="flex: 1; min-width: 140px;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                Alternatives
            </div>
    `;

    if (comparisonPlayers && comparisonPlayers.length > 0) {
        comparisonHTML += `<div style="display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.6rem;">`;
        comparisonPlayers.forEach(cp => {
            const cpGwPts = cp.event_points || 0;
            const cpPrice = (cp.now_cost / 10).toFixed(1);
            comparisonHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.15rem 0; gap: 0.25rem;">
                    <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(cp.web_name)}</span>
                    <span style="font-weight: 600; min-width: 2rem; text-align: right;">${cpGwPts} Pts</span>
                    <span style="color: var(--text-secondary); min-width: 2.5rem; text-align: right;">£${cpPrice}m</span>
                </div>
            `;
        });
        comparisonHTML += `</div>`;
    } else {
        comparisonHTML += `<div style="font-size: 0.65rem; color: var(--text-secondary);">No alternatives found</div>`;
    }
    comparisonHTML += `</div>`;

    // Merged Ownership + League Owners section (bottom-left)
    let ownershipAndLeagueHTML = `
        <div style="flex: 1; min-width: 140px;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                Ownership
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.7rem; margin-bottom: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Overall</span>
                    <span style="font-weight: 600;">${ownership.toFixed(1)}%</span>
                </div>
                ${leagueOwnership ? `
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">League</span>
                    <span style="font-weight: 600;">${leagueOwnership.owners.length}/${leagueOwnership.total} (${leagueOwnership.percentage}%)</span>
                </div>
                ` : ''}
            </div>
    `;

    // Add league owners list if available
    if (leagueOwnership && leagueOwnership.owners.length > 0) {
        ownershipAndLeagueHTML += `
            <div style="font-size: 0.65rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.25rem; text-transform: uppercase;">
                League Owners
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.1rem;">
        `;
        leagueOwnership.owners.forEach(owner => {
            ownershipAndLeagueHTML += `
                <div style="font-size: 0.6rem; padding: 0.15rem 0;">
                    <span style="font-weight: 500;">${escapeHtml(owner.name)}</span>
                </div>
            `;
        });
        ownershipAndLeagueHTML += `</div>`;
    } else if (!leagueOwnership) {
        ownershipAndLeagueHTML += `
            <div style="font-size: 0.6rem; color: var(--text-secondary);">
                View Team page for league data
            </div>
        `;
    }
    ownershipAndLeagueHTML += `</div>`;

    // Risk indicator HTML - show all risk statements
    let riskHTML = '';
    if (risks && risks.length > 0) {
        const riskItems = risks.map(r => `${r.icon} ${r.message}`).join(' • ');
        riskHTML = `
            <div style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 0.25rem;">
                ${riskItems}
            </div>
        `;
    }

    // Injury/News banner - using FPL API data
    let injuryBannerHTML = '';
    if (player.news && player.news.trim() !== '') {
        const chanceOfPlaying = player.chance_of_playing_next_round;
        let bannerColor = '#fbbf24'; // Yellow default
        let bgColor = 'rgba(251, 191, 36, 0.15)';

        // Red for 0-25%, Orange for 26-50%, Yellow for 51-75%
        if (chanceOfPlaying !== null && chanceOfPlaying !== undefined) {
            if (chanceOfPlaying <= 25) {
                bannerColor = '#ef4444';
                bgColor = 'rgba(239, 68, 68, 0.15)';
            } else if (chanceOfPlaying <= 50) {
                bannerColor = '#f97316';
                bgColor = 'rgba(249, 115, 22, 0.15)';
            }
        }

        injuryBannerHTML = `
            <div style="
                background: ${bgColor};
                border-left: 3px solid ${bannerColor};
                padding: 0.5rem 0.75rem;
                margin-bottom: 0.75rem;
                border-radius: 0 0.25rem 0.25rem 0;
            ">
                <div style="font-size: 0.65rem; color: ${bannerColor}; font-weight: 600;">
                    ${escapeHtml(player.news)}
                </div>
            </div>
        `;
    }

    // Past 3 GW history (bottom-right top)
    let historyHTML = '';
    if (past3GW.length > 0) {
        const historyRows = past3GW.map(gw => {
            const opponentName = getTeamShortName(gw.opponent_team);
            // Look up actual difficulty from fixtures data
            const difficulty = getFixtureDifficulty(player.team, gw.opponent_team, gw.round, gw.was_home);
            const opponent = {
                name: opponentName,
                isHome: gw.was_home,
                difficulty: difficulty
            };

            return `
                <div style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.6rem; padding: 0.2rem 0;">
                    <span style="color: var(--text-secondary); min-width: 2rem;">GW${gw.round}</span>
                    ${renderOpponentBadge(opponent, 'small')}
                    <span style="margin-left: auto;">${gw.minutes}'</span>
                    <span style="font-weight: 600; min-width: 2rem; text-align: right;">${gw.total_points} pts</span>
                </div>
            `;
        }).join('');

        historyHTML = `
            <div style="margin-bottom: 0.75rem;">
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                    Past 3 GWs
                </div>
                ${historyRows}
            </div>
        `;
    }

    // Next 3 GWs fixtures (bottom-right bottom)
    let fixturesHTML = '';
    if (upcomingFixtures.length > 0) {
        const fixtureRows = upcomingFixtures.map(fixture => {
            const isHome = fixture.team_h === player.team;
            const opponentId = isHome ? fixture.team_a : fixture.team_h;
            const opponentName = getTeamShortName(opponentId);
            const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;
            const opponent = {
                name: opponentName,
                isHome: isHome,
                difficulty: difficulty || 3
            };

            // Format date in Singapore time
            let dateStr = '';
            if (fixture.kickoff_time) {
                const kickoff = new Date(fixture.kickoff_time);
                dateStr = kickoff.toLocaleString('en-SG', {
                    timeZone: 'Asia/Singapore',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).replace(',', '');
            }

            return `
                <div style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.6rem; padding: 0.2rem 0;">
                    <span style="color: var(--text-secondary); min-width: 2rem;">GW${fixture.event}</span>
                    ${renderOpponentBadge(opponent, 'small')}
                    <span style="color: var(--text-secondary); font-size: 0.55rem; margin-left: auto;">${dateStr}</span>
                </div>
            `;
        }).join('');

        fixturesHTML = `
            <div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; text-transform: uppercase;">
                    Next 3 GWs
                </div>
                ${fixtureRows}
            </div>
        `;
    }

    const shadow = getShadow('modal');
    const radius = getMobileBorderRadius('xlarge');
    const animationCurve = getAnimationCurve('decelerate');
    const animationDuration = getAnimationDuration('modal');

    return `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            animation: fadeIn ${animationDuration} ${animationCurve};
        ">
            <div style="
                background: var(--bg-primary);
                border-radius: ${radius};
                max-width: 500px;
                width: 100%;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: ${shadow};
                animation: slideUp ${animationDuration} ${animationCurve};
            ">
                <!-- Header -->
                <div style="
                    padding: 0.75rem 1rem;
                    border-bottom: 2px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 0.65rem;
                ">
                    <div>
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                            ${escapeHtml(player.web_name)} <span style="font-weight: 400;">• </span><span style="
                                background: ${isColorDark(getTeamColor(player.team)) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)'};
                                color: ${getTeamColor(player.team)};
                                padding: 0.1rem 0.35rem;
                                border-radius: 0.2rem;
                                font-weight: 700;
                                font-size: 0.75rem;
                            ">${team}</span><span style="color: var(--text-secondary); font-weight: 400;"> • ${position} • £${price}m</span>
                        </div>
                        ${riskHTML}
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        ${wishlistButtonHTML}
                        <button
                            id="close-player-modal"
                            style="
                                background: transparent;
                                border: none;
                                font-size: 1.5rem;
                                color: var(--text-secondary);
                                cursor: pointer;
                                padding: 0;
                                width: 2rem;
                                height: 2rem;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            "
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div style="padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div>
                        ${injuryBannerHTML}
                        <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
                            ${gwStatsHTML}
                            ${ownershipAndLeagueHTML}
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                            <div style="flex: 1; min-width: 140px;">
                                ${historyHTML}
                                ${fixturesHTML}
                            </div>
                            ${comparisonHTML}
                        </div>
                    </div>
                    ${actionConfig ? `
                        <div style="display: flex; justify-content: flex-end;">
                            <button
                                id="player-modal-primary-btn"
                                style="
                                    background: ${actionConfig.color || 'var(--primary-color)'};
                                    color: white;
                                    border: none;
                                    border-radius: 999px;
                                    padding: 0.5rem 0.9rem;
                                    font-weight: 600;
                                    font-size: 0.8rem;
                                    cursor: pointer;
                                    min-width: 5rem;
                                    box-shadow: ${getShadow('medium')};
                                    transition: all ${getAnimationDuration('standard')} ${getAnimationCurve('spring')};
                                    transform: scale(1);
                                "
                                onmousedown="this.style.transform='scale(0.95)'"
                                onmouseup="this.style.transform='scale(1)'"
                                onmouseleave="this.style.transform='scale(1)'"
                                ontouchstart="this.style.transform='scale(0.95)'"
                                ontouchend="this.style.transform='scale(1)'"
                            >
                                ${escapeHtml(actionConfig.label || 'Action')}
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Attach modal event listeners
 */
function attachModalListeners(config = {}) {
    const { actionConfig = null, wishlistConfig = null } = config;
    const closeBtn = document.getElementById('close-player-modal');
    const modal = document.getElementById('player-modal');
    const primaryBtn = document.getElementById('player-modal-primary-btn');
    const wishlistBtn = document.getElementById('player-modal-wishlist-btn');

    if (closeBtn) {
        closeBtn.addEventListener('click', closePlayerModal);
    }

    if (primaryBtn && actionConfig?.onClick) {
        primaryBtn.addEventListener('click', () => {
            if (primaryBtn.disabled) return;
            primaryBtn.disabled = true;
            actionConfig.onClick();
        });
    }

    if (wishlistBtn && wishlistConfig) {
        wishlistBtn.addEventListener('click', () => {
            const nextState = toggleWishlist(wishlistConfig.playerId);
            updateWishlistButtonState(wishlistBtn, !!nextState);
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'player-modal') {
                closePlayerModal();
            }
        });
    }
}

function updateWishlistButtonState(button, active) {
    button.dataset.active = active ? 'true' : 'false';
    button.style.color = active ? '#facc15' : 'var(--text-secondary)';
    const icon = button.querySelector('i');
    if (icon) {
        icon.className = `${active ? 'fas' : 'far'} fa-star`;
    }
}

/**
 * Close player modal with animation
 */
export function closePlayerModal() {
    const modal = document.getElementById('player-modal');
    if (!modal) return;

    const animationDuration = getAnimationDuration('modal');
    const animationCurve = getAnimationCurve('accelerate');

    // Add exit animations
    modal.style.animation = `fadeOut ${animationDuration} ${animationCurve}`;
    const content = modal.querySelector('div');
    if (content) {
        content.style.animation = `slideDown ${animationDuration} ${animationCurve}`;
    }

    // Remove after animation completes
    setTimeout(() => {
        modal.remove();
    }, parseInt(animationDuration));
}

/**
 * Get upcoming fixtures for a player after a specific GW
 * @param {Object} player - Player object
 * @param {number} afterGW - Get fixtures after this GW
 * @returns {Array} Upcoming fixtures
 */
function getUpcomingFixturesAfterGW(player, afterGW) {
    if (!fplFixtures || fplFixtures.length === 0) {
        return [];
    }

    // Use afterGW or fallback
    const gw = afterGW || getActiveGW() || 1;

    return fplFixtures
        .filter(f => f.event && f.event > gw)  // After the specified GW
        .filter(f => f.team_h === player.team || f.team_a === player.team)
        .sort((a, b) => a.event - b.event)
        .slice(0, 5);
}
