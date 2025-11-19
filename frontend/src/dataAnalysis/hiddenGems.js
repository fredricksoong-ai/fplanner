// ============================================================================
// DATA ANALYSIS HIDDEN GEMS TAB
// Shows xG overperformers, underperformers, bonus magnets, and differentials
// ============================================================================

import { getAllPlayers } from '../data.js';
import { getCurrentGW, calculateMinutesPercentage } from '../utils.js';
import { isMobileDevice } from '../renderMyTeamMobile.js';

/**
 * Render Hidden Gems tab
 * @param {string} position - Position filter ('all', 'GKP', 'DEF', 'MID', 'FWD')
 * @param {Function} renderSectionHeader - Function to render section headers
 * @param {Function} renderPositionSpecificTableMobile - Mobile table renderer
 * @param {Function} renderPositionSpecificTable - Desktop table renderer
 * @returns {string} HTML for hidden gems tab
 */
export function renderHiddenGems(
    position = 'all',
    renderSectionHeader,
    renderPositionSpecificTableMobile,
    renderPositionSpecificTable
) {
    let players = getAllPlayers();
    const isMobile = isMobileDevice();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    // Filter players with enough minutes and data
    const activePlayers = players.filter(p => {
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        return minPercentage > 30;
    });

    // xG Overperformers (actual goals > expected)
    const overperformers = activePlayers.filter(p => {
        const xG = parseFloat(p.expected_goals) || 0;
        const actualGoals = p.goals_scored || 0;
        return actualGoals > xG + 1; // At least 1 goal over expected
    }).sort((a, b) => {
        const aVariance = (a.goals_scored || 0) - (parseFloat(a.expected_goals) || 0);
        const bVariance = (b.goals_scored || 0) - (parseFloat(b.expected_goals) || 0);
        return bVariance - aVariance;
    }).slice(0, 15);

    // xG Underperformers (expected > actual, likely to bounce back)
    const underperformers = activePlayers.filter(p => {
        const xG = parseFloat(p.expected_goals) || 0;
        const actualGoals = p.goals_scored || 0;
        const xGI = parseFloat(p.expected_goal_involvements) || 0;
        return xG > 2 && (xG - actualGoals) > 1.5; // High xG but underperforming
    }).sort((a, b) => {
        const aVariance = (parseFloat(a.expected_goals) || 0) - (a.goals_scored || 0);
        const bVariance = (parseFloat(b.expected_goals) || 0) - (b.goals_scored || 0);
        return bVariance - aVariance;
    }).slice(0, 15);

    // Bonus magnets (high BPS per 90, if available via github_season)
    const bonusMagnets = activePlayers.filter(p => {
        return p.bonus && p.bonus > 0;
    }).sort((a, b) => b.bonus - a.bonus).slice(0, 15);

    // Differentials (low ownership < 10%, good form, playing regularly)
    const differentials = activePlayers.filter(p => {
        const ownership = parseFloat(p.selected_by_percent) || 0;
        const form = parseFloat(p.form) || 0;
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());

        return ownership < 10 && ownership > 0 && form > 3 && minPercentage > 40;
    }).sort((a, b) => b.total_points - a.total_points).slice(0, 15);

    return `
        <div>
            <!-- Section 1: xG Overperformers -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🔥', 'xG Overperformers', 'Players scoring more than expected (hot streak, may not be sustainable)')}
                ${overperformers.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(overperformers, 'xg-variance') : renderPositionSpecificTable(overperformers, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No overperformers found</div>'}
            </div>

            <!-- Section 2: xG Underperformers -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('📈', 'xG Underperformers (Bounce-back Candidates)', 'High xG but low actual goals - likely to return to form')}
                ${underperformers.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(underperformers, 'xg') : renderPositionSpecificTable(underperformers, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No underperformers found</div>'}
            </div>

            <!-- Section 3: Bonus Magnets -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🎁', 'Bonus Magnets', 'Players with high bonus points (valuable for tight gameweeks)')}
                ${bonusMagnets.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(bonusMagnets, 'bonus') : renderPositionSpecificTable(bonusMagnets, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No bonus magnets found</div>'}
            </div>

            <!-- Section 4: Differentials -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('💎', 'Differentials (<10% Owned)', 'Low ownership players in good form - differential picks to gain rank')}
                ${differentials.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(differentials, 'ownership') : renderPositionSpecificTable(differentials, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No differentials found</div>'}
            </div>
        </div>
    `;
}
