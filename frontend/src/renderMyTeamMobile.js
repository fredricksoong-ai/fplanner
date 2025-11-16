/**
 * Mobile-optimized components for My Team page
 * Provides card-based layouts optimized for touch and smaller screens
 */

import {
    getPositionShort,
    formatCurrency,
    formatDecimal,
    getPtsHeatmap,
    getFormHeatmap,
    getHeatmapStyle,
    getDifficultyClass,
    getTeamShortName,
    calculatePPM,
    escapeHtml
} from './utils.js';

import {
    getGWOpponent
} from './fixtures.js';

import {
    hasHighRisk,
    renderRiskTooltip
} from './risk.js';

/**
 * Detect if user is on mobile device
 * @returns {boolean}
 */
export function isMobileDevice() {
    return window.innerWidth <= 767;
}

/**
 * Render player card for mobile (swipeable)
 * @param {Object} player - Player data
 * @param {Object} fullPlayer - Full player data from API
 * @param {number} gwNumber - Current gameweek number
 * @returns {string} HTML for player card
 */
export function renderMobilePlayerCard(player, fullPlayer, gwNumber) {
    const opponent = getGWOpponent(fullPlayer.team, gwNumber);
    const posShort = getPositionShort(fullPlayer.element_type);
    const ppm = calculatePPM(fullPlayer.total_points, fullPlayer.now_cost);
    const ptsColor = getHeatmapStyle(getPtsHeatmap(fullPlayer.event_points));
    const formColor = getHeatmapStyle(getFormHeatmap(parseFloat(fullPlayer.form)));
    const risks = fullPlayer.risks || [];
    const isHighRisk = hasHighRisk(risks);

    // Captain/Vice-captain indicator
    let captainBadge = '';
    if (player.is_captain) {
        captainBadge = '<span style="background: var(--secondary-color); color: var(--primary-color); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 700; margin-left: 0.5rem;">C</span>';
    } else if (player.is_vice_captain) {
        captainBadge = '<span style="background: var(--bg-tertiary); color: var(--text-secondary); padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem;">VC</span>';
    }

    // Playing status (benched or playing)
    const isStarter = player.position <= 11;
    const positionLabel = isStarter ? `Starting (${posShort})` : `Bench (${posShort})`;

    return `
        <div class="mobile-card no-select" style="
            background: ${isStarter ? 'var(--bg-secondary)' : 'var(--bg-tertiary)'};
            opacity: ${isStarter ? '1' : '0.7'};
            position: relative;
        ">
            <!-- High Risk Indicator -->
            ${isHighRisk ? `
                <div style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--danger-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 700;">
                    <i class="fas fa-exclamation-triangle"></i> Risk
                </div>
            ` : ''}

            <!-- Player Header -->
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); margin-bottom: 0.25rem;">
                        ${escapeHtml(fullPlayer.web_name)}${captainBadge}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        ${getTeamShortName(fullPlayer.team)} • ${positionLabel}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Price</div>
                    <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary);">
                        ${formatCurrency(fullPlayer.now_cost)}
                    </div>
                </div>
            </div>

            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.75rem;">
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.25rem;">GW Pts</div>
                    <div style="font-size: 1.25rem; font-weight: 700; ${ptsColor}">
                        ${fullPlayer.event_points}
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Form</div>
                    <div style="font-size: 1.25rem; font-weight: 700; ${formColor}">
                        ${formatDecimal(fullPlayer.form)}
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.25rem;">PPM</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">
                        ${formatDecimal(ppm)}
                    </div>
                </div>
            </div>

            <!-- Next Opponent -->
            ${opponent ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 0.5rem;">
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">
                        Next: ${opponent.isHome ? 'vs' : '@'} ${getTeamShortName(opponent.opponentTeam)}
                    </span>
                    <span class="${getDifficultyClass(opponent.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 600;">
                        FDR ${opponent.difficulty}
                    </span>
                </div>
            ` : `
                <div style="text-align: center; padding: 0.5rem; font-size: 0.75rem; color: var(--text-secondary);">
                    No upcoming fixture
                </div>
            `}

            <!-- Risk Warnings (if any) -->
            ${risks.length > 0 ? `
                <div style="margin-top: 0.75rem; padding: 0.5rem; background: rgba(220, 38, 38, 0.1); border-left: 3px solid var(--danger-color); border-radius: 0.25rem;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 0.25rem;"></i>Warnings:
                    </div>
                    ${risks.map(risk => `
                        <div style="font-size: 0.7rem; color: var(--text-primary); margin-left: 1rem;">
                            • ${risk.category}: ${risk.message}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render mobile-optimized team summary
 * @param {Array} players - Array of players
 * @param {number} gwNumber - Current gameweek
 * @param {Object} entryHistory - Entry history data
 * @returns {string} HTML for mobile team summary
 */
export function renderMobileTeamSummary(players, gwNumber, entryHistory) {
    const gwPoints = entryHistory.event_points || 0;
    const totalPoints = entryHistory.total_points || 0;
    const gwRank = entryHistory.rank ? entryHistory.rank.toLocaleString() : 'N/A';
    const overallRank = entryHistory.overall_rank ? entryHistory.overall_rank.toLocaleString() : 'N/A';

    // Calculate bench points
    const benchPlayers = players.filter(p => p.position > 11);
    const benchPoints = benchPlayers.reduce((sum, p) => {
        const player = window.fplData?.elements?.find(el => el.id === p.element);
        return sum + (player?.event_points || 0);
    }, 0);

    return `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;">
            <!-- GW Points -->
            <div class="mobile-card" style="background: linear-gradient(135deg, var(--primary-color), var(--accent-color)); color: white;">
                <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.25rem;">GW${gwNumber} Points</div>
                <div style="font-size: 2rem; font-weight: 700;">${gwPoints}</div>
                <div style="font-size: 0.7rem; opacity: 0.8;">Rank: ${gwRank}</div>
            </div>

            <!-- Overall Points -->
            <div class="mobile-card" style="background: var(--bg-secondary);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Overall</div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">${totalPoints}</div>
                <div style="font-size: 0.7rem; color: var(--text-secondary);">Rank: ${overallRank}</div>
            </div>

            <!-- Bench Points (Pain Indicator) -->
            ${benchPoints > 0 ? `
                <div class="mobile-card" style="background: var(--bg-secondary); border: 2px solid var(--warning-color);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                        <i class="fas fa-couch"></i> Bench Points
                    </div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--warning-color);">${benchPoints}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary);">Could have scored more!</div>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render mobile-optimized manager info
 * @param {Object} teamData - Team data object
 * @returns {string} HTML for mobile manager info
 */
export function renderMobileManagerInfo(teamData) {
    const { team, gameweek } = teamData;

    return `
        <div class="mobile-card" style="text-align: center; background: var(--bg-secondary);">
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                ${escapeHtml(team.player_first_name)} ${escapeHtml(team.player_last_name)}
            </div>
            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                ${escapeHtml(team.name)}
            </div>
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--bg-primary); border-radius: 1rem;">
                <i class="fas fa-futbol" style="color: var(--secondary-color);"></i>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">
                    Gameweek <strong style="color: var(--text-primary);">${gameweek}</strong>
                </span>
            </div>
        </div>
    `;
}

/**
 * Render swipeable player cards (starting XI and bench separately)
 * @param {Array} players - Array of players
 * @param {number} gwNumber - Current gameweek
 * @returns {string} HTML for swipeable player cards
 */
export function renderSwipeablePlayerCards(players, gwNumber) {
    const starters = players.filter(p => p.position <= 11);
    const bench = players.filter(p => p.position > 11);

    return `
        <!-- Starting XI -->
        <div style="margin-bottom: 2rem;">
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">
                <i class="fas fa-users"></i> Starting XI
            </h3>
            <div class="swipeable scroll-mobile">
                ${starters.map(player => {
                    const fullPlayer = window.fplData?.elements?.find(el => el.id === player.element);
                    if (!fullPlayer) return '';
                    return `<div style="min-width: 280px; max-width: 280px;">${renderMobilePlayerCard(player, fullPlayer, gwNumber)}</div>`;
                }).join('')}
            </div>
        </div>

        <!-- Bench -->
        <div>
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">
                <i class="fas fa-couch"></i> Bench
            </h3>
            <div class="swipeable scroll-mobile">
                ${bench.map(player => {
                    const fullPlayer = window.fplData?.elements?.find(el => el.id === player.element);
                    if (!fullPlayer) return '';
                    return `<div style="min-width: 280px; max-width: 280px;">${renderMobilePlayerCard(player, fullPlayer, gwNumber)}</div>`;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Check if mobile optimizations should be applied
 * @returns {boolean}
 */
export function shouldUseMobileLayout() {
    return isMobileDevice();
}
