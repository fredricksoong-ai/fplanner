// ============================================================================
// DATA ANALYSIS OVERVIEW TAB
// Shows top performers, best value, form stars, penalty takers, and defensive standouts
// ============================================================================

import { getAllPlayers } from '../data.js';
import { getCurrentGW, calculateMinutesPercentage, sortPlayers, calculatePPM } from '../utils.js';
import { calculateFixtureDifficulty } from '../fixtures.js';
import { isMobileDevice } from '../renderMyTeamMobile.js';
import { sharedState } from '../sharedState.js';

/**
 * Render Analysis Overview tab
 * @param {string} position - Position filter ('all', 'GKP', 'DEF', 'MID', 'FWD')
 * @param {Function} renderSectionHeader - Function to render section headers
 * @param {Function} renderPositionSpecificTableMobile - Mobile table renderer
 * @param {Function} renderPositionSpecificTable - Desktop table renderer
 * @returns {string} HTML for overview tab
 */
export function renderAnalysisOverview(
    position = 'all',
    renderSectionHeader,
    renderPositionSpecificTableMobile,
    renderPositionSpecificTable
) {
    const allPlayers = getAllPlayers();
    let players = allPlayers;
    const myTeamPicks = sharedState?.myTeamData?.picks?.picks || [];
    const myPlayerIds = new Set(myTeamPicks.map(pick => pick.element));
    const isMobile = isMobileDevice();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    const top20 = sortPlayers(players, 'total_points', false).slice(0, 20);
    const bestValue = players.filter(p => calculateMinutesPercentage(p, getCurrentGW()) > 30);
    const top15Value = [...bestValue].sort((a, b) => calculatePPM(b) - calculatePPM(a)).slice(0, 15);
    const top15Form = sortPlayers(bestValue, 'form', false).slice(0, 15);

    const annotate = (list, badgeOverrides = new Map()) => list.map(player => ({
        ...player,
        __isMine: badgeOverrides.has(player.id)
            ? badgeOverrides.get(player.id) === 'my-player' || badgeOverrides.get(player.id) === 'both'
            : myPlayerIds.has(player.id),
        __isWishlist: badgeOverrides.has(player.id)
            ? badgeOverrides.get(player.id) === 'wishlist' || badgeOverrides.get(player.id) === 'both'
            : false
    }));

    // Defensive standouts (always available – use all outfield players)
    let defensiveSection = '';
    const defensiveSource = allPlayers;
    const withDefCon = defensiveSource
        .filter(p => p.element_type !== 1 && p.github_season?.defensive_contribution_per_90 !== undefined)
        .map(p => ({
            player: p,
            defCon: parseFloat(p.github_season?.defensive_contribution_per_90) || 0
        }));

    const topDefensive = withDefCon
        .sort((a, b) => b.defCon - a.defCon)
        .slice(0, 10)
        .map(entry => entry.player);

    const defensiveBadges = new Map();
    topDefensive.forEach(player => {
        defensiveBadges.set(player.id, 'my-player');
    });

    if (topDefensive.length > 0) {
        const tablePosition = 'DEF';
        const sectionLabel = 'outfield players';
        defensiveSection = `
            <div style="margin-top: 3rem;">
                ${renderSectionHeader('🛡️', 'Defensive Standouts', `Top ${sectionLabel} by defensive contribution per 90`)}
                ${isMobile ? renderPositionSpecificTableMobile(annotate(topDefensive, defensiveBadges), 'def90') : renderPositionSpecificTable(annotate(topDefensive, defensiveBadges), tablePosition)}
            </div>
        `;
    }

    return `
        <div>
            <!-- Section 1: Top Performers -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🏆', 'Top Performers', `Top ${position === 'all' ? '20 players' : '20 ' + position} by total points`)}
                ${isMobile ? renderPositionSpecificTableMobile(annotate(top20), 'total') : renderPositionSpecificTable(annotate(top20), position)}
            </div>

            <!-- Section 2: Best Value -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('💰', 'Best Value', 'Top 15 by points per million (min 30% minutes played)')}
                ${isMobile ? renderPositionSpecificTableMobile(annotate(top15Value), 'ppm') : renderPositionSpecificTable(annotate(top15Value), position)}
            </div>

            <!-- Section 3: Form Stars -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🔥', 'Form Stars', 'Top 15 by recent form (min 30% minutes played)')}
                ${isMobile ? renderPositionSpecificTableMobile(annotate(top15Form), 'form') : renderPositionSpecificTable(annotate(top15Form), position)}
            </div>
            <!-- Section 4: Defensive Standouts (if applicable) -->
            ${defensiveSection}
        </div>
    `;
}
