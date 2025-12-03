// ============================================================================
// COMPACT HEADER RENDERER
// Team info, GW points, rank, and captain/vice info for mobile view
// ============================================================================

import { getPlayerById, loadTransferHistory, getActiveGW, getGameweekEvent, getAllPlayers } from '../../data.js';
import { escapeHtml } from '../../utils.js';
import { getGWOpponent } from '../../fixtures.js';
import {
    renderOpponentBadge,
    calculateRankIndicator,
    calculateGWIndicator
} from './compactStyleHelpers.js';
import { getGlassmorphism, getShadow, getAnimationCurve, getAnimationDuration } from '../../styles/mobileDesignSystem.js';

// Cache for transfer history
let transferHistoryCache = new Map();

/**
 * Check if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Apply frosted glass effect to header on scroll
 */
export function attachHeaderScrollEffect() {
    const header = document.getElementById('compact-header');
    if (!header) return;

    const handleScroll = () => {
        const scrollY = window.scrollY || window.pageYOffset;
        const threshold = 10; // Start applying effect after scrolling 10px

        if (scrollY > threshold) {
            const glass = getGlassmorphism(isDarkMode(), 'light');
            const duration = getAnimationDuration('fast');
            const curve = getAnimationCurve('standard');

            header.style.backdropFilter = glass.backdropFilter;
            header.style.webkitBackdropFilter = glass.WebkitBackdropFilter;
            header.style.background = glass.background;
            header.style.borderBottom = `1px solid ${glass.border.split(' ').pop()}`;
            header.style.transition = `all ${duration} ${curve}`;
            header.style.boxShadow = getShadow('low');
        } else {
            header.style.backdropFilter = 'none';
            header.style.webkitBackdropFilter = 'none';
            header.style.background = 'var(--bg-primary)';
            header.style.borderBottom = '2px solid var(--border-color)';
            header.style.boxShadow = 'none';
        }
    };

    // Attach scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check
    handleScroll();
}

/**
 * Calculate color for GW points based on difference from average
 * @param {number} points - User's GW points
 * @param {number} average - GW average points
 * @returns {string} Color hex code
 */
function calculatePointsColor(points, average) {
    if (!average || average === 0) return 'var(--text-primary)';

    const diff = points - average;

    if (diff >= 15) return '#9333ea'; // Exceptional - Purple
    if (diff >= 5) return '#22c55e';  // Above average - Green
    if (diff >= -4) return '#eab308'; // On average - Yellow
    return '#ef4444';                 // Below average - Red
}

/**
 * Count players who have played (minutes > 0)
 * @param {Object} teamData - Team data with picks
 * @returns {number} Number of players who have played
 */
function countPlayersPlayed(teamData) {
    if (!teamData || !teamData.picks || !teamData.picks.picks) return 0;

    const activeChip = teamData.picks?.active_chip;
    const isBenchBoost = activeChip === 'bboost' || activeChip === 'benchboost';

    let played = 0;
    teamData.picks.picks.forEach(pick => {
        // Only count starting 11 unless Bench Boost is active
        if (!isBenchBoost && pick.position > 11) {
            return;
        }

        // Check minutes from live_stats first
        const minutes = pick.live_stats?.minutes;
        if (minutes !== null && minutes !== undefined && minutes > 0) {
            played++;
        } else {
            // Fallback: check if player has points (indicates they played)
            const player = getPlayerById(pick.element);
            if (player && (player.event_points > 0 || (player.live_stats && player.live_stats.total_points > 0))) {
                played++;
            }
        }
    });

    return played;
}

/**
 * Calculate GW expected points (try ep_this first, fallback to ep_next)
 * @param {Object} teamData - Team data with picks
 * @returns {number|null} Expected points or null if unavailable
 */
function calculateGWExpectedPoints(teamData) {
    if (!teamData || !teamData.picks || !teamData.picks.picks) return null;

    // Get starting 11 only
    const starting11 = teamData.picks.picks
        .filter(p => p.position <= 11)
        .map(pick => getPlayerById(pick.element))
        .filter(Boolean);

    if (starting11.length === 0) return null;

    let totalXPts = 0;
    let hasEpThis = false;

    starting11.forEach(player => {
        // Try ep_this first
        const epThis = player.ep_this ? parseFloat(player.ep_this) : null;
        if (epThis !== null) {
            totalXPts += epThis;
            hasEpThis = true;
        } else {
            // Fallback to ep_next
            totalXPts += parseFloat(player.ep_next) || 0;
        }
    });

    return totalXPts > 0 ? totalXPts : null;
}

/**
 * Get Over/Under/On badge for expected points comparison
 * @param {number} actualPoints - Actual GW points
 * @param {number} expectedPoints - Expected GW points
 * @returns {Object} Badge text, background color, and text color
 */
function getExpectedPointsBadge(actualPoints, expectedPoints) {
    if (expectedPoints === null || expectedPoints === 0) {
        return { text: '', background: '', color: '' };
    }

    if (actualPoints > expectedPoints) {
        return { text: 'Over', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }; // Green
    } else if (actualPoints < expectedPoints) {
        return { text: 'Under', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }; // Red
    } else {
        return { text: 'On', background: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }; // Yellow
    }
}

/**
 * Render ultra-compact header with team info and GW card
 * @param {Object} teamData - Team data with picks and team info
 * @param {number} gwNumber - Current gameweek number
 * @param {boolean} isAutoRefreshActive - Whether auto-refresh is active
 * @returns {string} HTML for compact header
 */
export function renderCompactHeader(teamData, gwNumber, isAutoRefreshActive = false) {
    const { picks, team, isLive } = teamData;
    const entry = picks.entry_history;

    // Calculate GW points from entry_history.points
    // This is the definitive source from the picks endpoint
    let gwPoints = entry?.points ?? 0;

    const totalPoints = team.summary_overall_points || 0;

    // Team value and bank from entry_history (GW-specific)
    const teamValue = ((entry.value || 0) / 10).toFixed(1);
    const bank = ((entry.bank || 0) / 10).toFixed(1);
    const squadValue = ((entry.value || 0) / 10 - (entry.bank || 0) / 10).toFixed(1);
    const freeTransfers = entry.event_transfers || 0;
    const transferCost = entry.event_transfers_cost || 0;

    // Count players played
    const playersPlayed = countPlayersPlayed(teamData);

    // Calculate GW expected points
    const expectedPoints = calculateGWExpectedPoints(teamData);
    const expectedBadge = getExpectedPointsBadge(gwPoints, expectedPoints);

    // Get GW average from event data
    const gwEvent = getGameweekEvent(gwNumber);
    const gwAverage = gwEvent?.average_entry_score || 0;
    const pointsColor = calculatePointsColor(gwPoints, gwAverage);

    // Get selected league info
    const selectedLeagueId = localStorage.getItem(`fpl_selected_league_${team.id}`);
    let leagueInfo = '';

    if (selectedLeagueId && selectedLeagueId !== 'null') {
        // Store league data in a data attribute for later rendering
        leagueInfo = `
            <div id="league-info-placeholder" data-team-id="${team.id}" data-league-id="${selectedLeagueId}" style="margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid var(--border-color);">
                <div style="font-size: 0.65rem; color: var(--text-secondary);">Loading league...</div>
            </div>
        `;
    }

    return `
        <div
            id="compact-header"
            style="
                position: sticky;
                top: calc(3.5rem + env(safe-area-inset-top)); /* Keeps this box sticky just below the top app bar */
                background: var(--bg-primary);
                z-index: 100;
                padding: 0.5rem 0;
                border-bottom: 2px solid var(--border-color);
                margin: 0;
            "
        >
            <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 0.5rem;">
                <div style="flex: 1; display: grid; gap: 0.2rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <button
                            id="change-team-btn"
                            style="
                                background: transparent;
                                border: 1px solid var(--border-color);
                                border-radius: 0.5rem;
                                padding: 0.2rem 0.35rem;
                                color: var(--text-secondary);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.2s;
                            "
                            title="Change Team"
                        >
                            <i class="fas fa-exchange-alt" style="font-size: 0.7rem;"></i>
                        </button>
                        <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; flex: 1;">
                            ${escapeHtml(team.name)}
                        </div>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Squad Value: £${squadValue}m + £${bank}m
                    </div>

                    <div
                        id="transfers-row"
                        data-team-id="${team.id}"
                        data-transfer-cost="${transferCost}"
                        style="font-size: 0.7rem; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: 0.25rem; user-select: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation;"
                    >
                        <span>Transfers: ${freeTransfers}${transferCost > 0 ? ` <span style="color: #ef4444;">(-${transferCost} pts)</span>` : ''}</span>
                        <i class="fas fa-chevron-down" id="transfers-chevron" style="font-size: 0.55rem; transition: transform 0.2s; pointer-events: none;"></i>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        No. of Players Played: ${playersPlayed}
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.3rem;">
                        <span>GW Expected Pts: ${expectedPoints !== null ? Math.round(expectedPoints) : 'N/A'}</span>
                        ${expectedBadge.text ? `<span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: ${expectedBadge.background}; color: ${expectedBadge.color};">${expectedBadge.text}</span>` : ''}
                    </div>
                    <div id="transfers-details" style="display: none; font-size: 0.65rem; padding-top: 0.25rem; margin-top: 0.25rem; border-top: 1px dashed var(--border-color);">
                        <div style="color: var(--text-secondary); text-align: center;">Loading transfers...</div>
                    </div>
                </div>

                <div style="display: flex; align-items: stretch;">
                    <div id="gw-points-card" style="
                        background: var(--bg-primary);
                        border: 1px solid var(--border-color);
                        border-radius: 0.5rem;
                        padding: 0.3rem 0.6rem;
                        text-align: center;
                        min-width: 175px;
                        display: flex;
                        flex-direction: column;
                        justify-content: right;
                        box-shadow: ${getShadow('low')};
                    ">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <div style="font-size: 2rem; font-weight: 800; color: ${pointsColor}; line-height: 1;">
                                ${gwPoints}
                            </div>
                            <span style="color: var(--text-secondary);">•</span>
                            <div style="font-size: 2rem; font-weight: 800; color: var(--text-secondary); line-height: 1;">
                                ${totalPoints.toLocaleString()}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 0.1rem;">
                            <div style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 600;">
                                GW ${gwNumber}
                            </div>
                            ${gwAverage > 0 ? `
                                <div style="font-size: 0.55rem; color: var(--text-secondary);">
                                    Avg: ${gwAverage}
                                </div>
                            ` : ''}
                        </div>
                        ${isLive ? `
                            <div style="font-size: 0.6rem; color: #ef4444; margin-top: 0.1rem; animation: pulse 2s infinite; font-weight: 600;">
                                ⚽ LIVE
                            </div>
                            <style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }</style>
                        ` : ''}
                        ${leagueInfo}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Get captain and vice captain info with opponent badges
 * @param {Array} picks - Player picks array
 * @param {number} gwNumber - Gameweek number
 * @returns {Object} Captain and vice info HTML
 */
function getCaptainViceInfo(picks, gwNumber) {
    const captainPick = picks.find(p => p.is_captain);
    const vicePick = picks.find(p => p.is_vice_captain);

    let captainInfo = 'None';
    let viceInfo = 'None';

    if (captainPick) {
        const captainPlayer = getPlayerById(captainPick.element);
        if (captainPlayer) {
            const captainOpp = getGWOpponent(captainPlayer.team, gwNumber);
            const oppBadge = renderOpponentBadge(captainOpp, 'normal');
            captainInfo = `${captainPlayer.web_name} vs. ${oppBadge}`;
        }
    }

    if (vicePick) {
        const vicePlayer = getPlayerById(vicePick.element);
        if (vicePlayer) {
            const viceOpp = getGWOpponent(vicePlayer.team, gwNumber);
            const oppBadge = renderOpponentBadge(viceOpp, 'normal');
            viceInfo = `${vicePlayer.web_name} vs. ${oppBadge}`;
        }
    }

    return { captainInfo, viceInfo };
}

// Store the handler reference to allow removal
let transfersRowHandler = null;
let isProcessing = false;

/**
 * Attach event listeners for expandable transfers
 */
export function attachTransferListeners() {
    const transfersRow = document.getElementById('transfers-row');
    if (!transfersRow) return;

    // Remove existing listener if it exists
    if (transfersRowHandler) {
        transfersRow.removeEventListener('click', transfersRowHandler);
        transfersRow.removeEventListener('touchend', transfersRowHandler);
    }

    // Create the handler function
    transfersRowHandler = async (e) => {
        // Prevent double-firing
        if (isProcessing) return;
        isProcessing = true;

        // For touch events, prevent the click from also firing
        if (e.type === 'touchend') {
            e.preventDefault();
        }

        const detailsDiv = document.getElementById('transfers-details');
        const chevron = document.getElementById('transfers-chevron');
        const teamId = transfersRow.dataset.teamId;
        const transferCost = parseInt(transfersRow.dataset.transferCost) || 0;

        if (!detailsDiv) {
            isProcessing = false;
            return;
        }

        const isVisible = detailsDiv.style.display !== 'none';

        if (isVisible) {
            // Collapse
            detailsDiv.style.display = 'none';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        } else {
            // Expand
            detailsDiv.style.display = 'block';
            if (chevron) chevron.style.transform = 'rotate(180deg)';

            // Load transfer history if not cached
            if (!transferHistoryCache.has(teamId)) {
                try {
                    const transfers = await loadTransferHistory(teamId);
                    transferHistoryCache.set(teamId, transfers);
                    renderTransferDetails(detailsDiv, transfers, transferCost);
                } catch (err) {
                    detailsDiv.innerHTML = '<div style="color: #ef4444;">Failed to load transfers</div>';
                }
            } else {
                renderTransferDetails(detailsDiv, transferHistoryCache.get(teamId), transferCost);
            }
        }

        // Reset processing flag after a short delay
        setTimeout(() => {
            isProcessing = false;
        }, 300);
    };

    // Attach both click and touchend for better mobile support
    transfersRow.addEventListener('click', transfersRowHandler);
    transfersRow.addEventListener('touchend', transfersRowHandler, { passive: false });
}

/**
 * Render transfer details in the expandable section
 * @param {HTMLElement} container - Container element
 * @param {Array} transfers - Transfer history array
 * @param {number} transferCost - Transfer cost (hits)
 */
function renderTransferDetails(container, transfers, transferCost = 0) {
    const currentGW = getActiveGW();

    // Filter to current GW transfers
    const gwTransfers = transfers.filter(t => t.event === currentGW);

    if (gwTransfers.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); text-align: center;">No transfers this GW</div>';
        return;
    }

    let totalPointsDiff = 0;

    const transferRows = gwTransfers.map(transfer => {
        const playerIn = getPlayerById(transfer.element_in);
        const playerOut = getPlayerById(transfer.element_out);

        if (!playerIn || !playerOut) return '';

        // Get GW points for both players
        const inPoints = playerIn.live_stats?.total_points ?? playerIn.event_points ?? 0;
        const outPoints = playerOut.live_stats?.total_points ?? playerOut.event_points ?? 0;
        totalPointsDiff += (inPoints - outPoints);

        return `
            <div style="display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 0.25rem; padding: 0.2rem 0; align-items: center;">
                <div style="color: var(--text-primary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(playerOut.web_name)}</div>
                <div style="color: #ef4444; font-weight: 700; text-align: right; min-width: 1.5rem;">${outPoints}</div>
                <div style="color: var(--text-primary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(playerIn.web_name)}</div>
                <div style="color: #22c55e; font-weight: 700; text-align: right; min-width: 1.5rem;">${inPoints}</div>
            </div>
        `;
    }).join('');

    // Calculate net with transfer cost
    const netWithCost = totalPointsDiff - transferCost;
    const netColor = netWithCost > 0 ? '#22c55e' : netWithCost < 0 ? '#ef4444' : 'var(--text-secondary)';
    const netSymbol = netWithCost > 0 ? '+' : '';

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 0.25rem; padding-bottom: 0.25rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border-color); font-size: 0.55rem; color: var(--text-secondary); text-transform: uppercase;">
            <div>Out</div>
            <div style="text-align: right;">Pts</div>
            <div>In</div>
            <div style="text-align: right;">Pts</div>
        </div>
        ${transferRows}
        <div style="margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid var(--border-color);">
            ${transferCost > 0 ? `
                <div style="display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 0.6rem;">
                    <span>Transfer Cost:</span>
                    <span style="color: #ef4444; font-weight: 600;">-${transferCost}</span>
                </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-weight: 700;">
                <span style="color: var(--text-secondary); font-size: 0.6rem;">Net Points:</span>
                <span style="color: ${netColor};">${netSymbol}${netWithCost}</span>
            </div>
        </div>
    `;
}
