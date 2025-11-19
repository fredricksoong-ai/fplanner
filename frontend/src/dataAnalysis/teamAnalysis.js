// ============================================================================
// DATA ANALYSIS TEAM ANALYSIS TAB
// Shows teams with best/worst fixtures and best attack/defense
// ============================================================================

import { getAllPlayers, fplBootstrap } from '../data.js';
import { calculateFixtureDifficulty } from '../fixtures.js';

/**
 * Render Team Analysis tab
 * @param {string} position - Position filter (not used for team analysis)
 * @param {Function} renderSectionHeader - Function to render section headers
 * @param {Function} renderTeamTable - Team table renderer
 * @returns {string} HTML for team analysis tab
 */
export function renderTeamAnalysis(
    position = 'all',
    renderSectionHeader,
    renderTeamTable
) {
    if (!fplBootstrap || !fplBootstrap.teams) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Team data not available</div>';
    }

    // Get all teams with fixture analysis
    const teamAnalysis = fplBootstrap.teams.map(team => {
        const fdr3 = calculateFixtureDifficulty(team.id, 3);
        const fdr5 = calculateFixtureDifficulty(team.id, 5);

        // Find best player from this team
        const teamPlayers = getAllPlayers().filter(p => p.team === team.id);
        const bestPlayer = teamPlayers.sort((a, b) => b.total_points - a.total_points)[0];

        return {
            team,
            fdr3,
            fdr5,
            bestPlayer,
            strength: team.strength,
            strengthAttackHome: team.strength_attack_home,
            strengthAttackAway: team.strength_attack_away,
            strengthDefenceHome: team.strength_defence_home,
            strengthDefenceAway: team.strength_defence_away
        };
    });

    // Best fixtures (next 5)
    const bestFixtures = [...teamAnalysis].sort((a, b) => a.fdr5 - b.fdr5).slice(0, 10);

    // Worst fixtures (next 5)
    const worstFixtures = [...teamAnalysis].sort((a, b) => b.fdr5 - a.fdr5).slice(0, 10);

    // Best attack teams
    const bestAttack = [...teamAnalysis].sort((a, b) =>
        (b.team.strength_attack_home + b.team.strength_attack_away) -
        (a.team.strength_attack_home + a.team.strength_attack_away)
    ).slice(0, 10);

    // Best defense teams
    const bestDefense = [...teamAnalysis].sort((a, b) =>
        (b.team.strength_defence_home + b.team.strength_defence_away) -
        (a.team.strength_defence_home + a.team.strength_defence_away)
    ).slice(0, 10);

    return `
        <div>
            <!-- Section 1: Best Fixtures -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('✅', 'Teams with Best Fixtures (Next 5 GWs)', '')}
                ${renderTeamTable(bestFixtures)}
            </div>

            <!-- Section 2: Worst Fixtures -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('❌', 'Teams with Worst Fixtures (Next 5 GWs)', '')}
                ${renderTeamTable(worstFixtures)}
            </div>

            <!-- Section 3: Best Attack -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('⚔️', 'Best Attack Teams', '')}
                ${renderTeamTable(bestAttack)}
            </div>

            <!-- Section 4: Best Defense -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🛡️', 'Best Defense Teams', '')}
                ${renderTeamTable(bestDefense)}
            </div>
        </div>
    `;
}
