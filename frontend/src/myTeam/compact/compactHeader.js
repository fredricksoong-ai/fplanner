// ============================================================================
// COMPACT HEADER RENDERER
// Team info, GW points, rank, and captain/vice info for mobile view
// ============================================================================

import { getPlayerById, loadTransferHistory, getActiveGW, getGameweekEvent, getAllPlayers } from '../../data.js';
import { escapeHtml } from '../../utils.js';
import { getGWOpponents } from '../../fixtures.js';
import {
    renderOpponentBadges,
    calculateRankIndicator,
    calculateGWIndicator
} from './compactStyleHelpers.js';
import { getGlassmorphism, getShadow, getAnimationCurve, getAnimationDuration, getMobileBorderRadius } from '../../styles/mobileDesignSystem.js';

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
 * Apply frosted glass effect to header on scroll (enhanced shadow on scroll)
 * Header now always has glass effect, but shadow intensifies on scroll
 */
export function attachHeaderScrollEffect() {
    const header = document.getElementById('compact-header');
    if (!header) return;

    const handleScroll = () => {
        const scrollY = window.scrollY || window.pageYOffset;
        const threshold = 10; // Start intensifying shadow after scrolling 10px

        if (scrollY > threshold) {
            // Intensify shadow on scroll for more depth
            const shadowMedium = getShadow('medium');
            const duration = getAnimationDuration('fast');
            const curve = getAnimationCurve('standard');

            header.style.boxShadow = shadowMedium;
            header.style.transition = `all ${duration} ${curve}`;
        } else {
            // Lighter shadow when at top
            const shadowLow = getShadow('low');
            header.style.boxShadow = shadowLow;
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
 * Calculate GW FDR (average fixture difficulty for current GW)
 * @param {Object} teamData - Team data with picks
 * @param {number} gwNumber - Current gameweek number
 * @returns {number|null} Average FDR or null if unavailable
 */
function calculateGWFDR(teamData, gwNumber) {
    if (!teamData || !teamData.picks || !teamData.picks.picks) return null;

    // Get starting 11 only
    const starting11 = teamData.picks.picks
        .filter(p => p.position <= 11)
        .map(pick => getPlayerById(pick.element))
        .filter(Boolean);

    if (starting11.length === 0) return null;

    let totalFDR = 0;
    let count = 0;

    starting11.forEach(player => {
        const opps = getGWOpponents(player.team, gwNumber);
        opps.forEach(oppInfo => {
            if (oppInfo && oppInfo.difficulty) {
                totalFDR += oppInfo.difficulty;
                count++;
            }
        });
    });

    return count > 0 ? totalFDR / count : null;
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

    // Calculate GW FDR
    const gwFDR = calculateGWFDR(teamData, gwNumber);

    // Calculate GW expected points
    const expectedPoints = calculateGWExpectedPoints(teamData);
    const expectedBadge = getExpectedPointsBadge(gwPoints, expectedPoints);

    // Count players played
    const playersPlayed = countPlayersPlayed(teamData);

    // Get GW average from event data
    const gwEvent = getGameweekEvent(gwNumber);
    const gwAverage = gwEvent?.average_entry_score || 0;
    const pointsColor = calculatePointsColor(gwPoints, gwAverage);

    // Get overall and GW ranks
    const overallRankNum = team.summary_overall_rank || 0;
    const gwRankNum = team.summary_event_rank || 0;
    const overallRank = overallRankNum ? overallRankNum.toLocaleString() : 'N/A';
    const gwRank = gwRankNum ? gwRankNum.toLocaleString() : 'N/A';
    
    // Calculate rank indicators
    const previousGWRank = entry?.previous_gw_rank || null;
    const rankIndicator = calculateRankIndicator(team.id, overallRankNum, previousGWRank);
    const gwIndicator = calculateGWIndicator(gwRankNum, overallRankNum);

    // Get glassmorphism effects for components
    const isDark = isDarkMode();
    const glassEffectLight = getGlassmorphism(isDark, 'light');
    const shadowLow = getShadow('low');
    const shadowMedium = getShadow('medium');
    const animationDuration = getAnimationDuration('fast');
    const animationCurve = getAnimationCurve('standard');
    const springCurve = getAnimationCurve('spring');
    const borderRadius = getMobileBorderRadius('medium');

    // League info is now in manager modal, not in compact header

    return `
        <div
            id="compact-header"
            style="
                position: sticky;
                top: calc(3.5rem + env(safe-area-inset-top)); /* Keeps this box sticky just below the top app bar */
                backdrop-filter: ${glassEffectLight.backdropFilter};
                -webkit-backdrop-filter: ${glassEffectLight.WebkitBackdropFilter};
                background: ${glassEffectLight.background};
                border-bottom: ${glassEffectLight.border};
                z-index: 100;
                padding: 0.5rem 0;
                margin: 0;
                box-shadow: ${shadowLow};
                transition: all ${animationDuration} ${animationCurve};
            "
        >
            <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 0.5rem;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 0.2rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <button
                            id="change-team-btn"
                            style="
                                backdrop-filter: ${glassEffectLight.backdropFilter};
                                -webkit-backdrop-filter: ${glassEffectLight.WebkitBackdropFilter};
                                background: ${glassEffectLight.background};
                                border: ${glassEffectLight.border};
                                border-radius: ${borderRadius};
                                padding: 0.2rem 0.35rem;
                                color: var(--text-secondary);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all ${animationDuration} ${springCurve};
                                box-shadow: ${shadowLow};
                            "
                            title="Change Team"
                        >
                        </button>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary); line-height: 1.4;">
                        GW Rank: <span style="color: ${gwIndicator.color};">${gwRank} ${gwIndicator.chevron}</span>
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
            const captainOpps = getGWOpponents(captainPlayer.team, gwNumber);
            const oppBadges = renderOpponentBadges(captainOpps, 'normal');
            captainInfo = `${captainPlayer.web_name} vs. ${oppBadges}`;
        }
    }

    if (vicePick) {
        const vicePlayer = getPlayerById(vicePick.element);
        if (vicePlayer) {
            const viceOpps = getGWOpponents(vicePlayer.team, gwNumber);
            const oppBadges = renderOpponentBadges(viceOpps, 'normal');
            viceInfo = `${vicePlayer.web_name} vs. ${oppBadges}`;
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
        container.innerHTML = '<div style="font-size: 9px; color: var(--text-secondary); text-align: center;">No transfers this GW</div>';
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
        <div style="display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 0.25rem; padding-bottom: 0.25rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border-color); font-size: 9px; color: var(--text-secondary); text-transform: uppercase;">
            <div>Out</div>
            <div style="text-align: right;">Pts</div>
            <div>In</div>
            <div style="text-align: right;">Pts</div>
        </div>
        ${transferRows}
        <div style="margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid var(--border-color);">
            ${transferCost > 0 ? `
                <div style="display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 9px;">
                    <span>Transfer Cost:</span>
                    <span style="color: #ef4444; font-weight: 600;">-${transferCost}</span>
                </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-weight: 700;">
                <span style="color: var(--text-secondary); font-size: 9px;">Net Points:</span>
                <span style="color: ${netColor}; font-size: 9px;">${netSymbol}${netWithCost}</span>
            </div>
        </div>
    `;
}
