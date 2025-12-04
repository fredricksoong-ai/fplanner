// ============================================================================
// COMPACT SCHEDULE RENDERER
// Match schedule section (collapsible) for GW fixtures
// ============================================================================

import { getPlayerById } from '../../data.js';
import { getFixtures } from '../../fixtures.js';
import { getTeamShortName } from '../../utils.js';
import { getGlassmorphism, getShadow, getMobileBorderRadius } from '../../styles/mobileDesignSystem.js';

/**
 * Render match schedule section (collapsible)
 * @param {Array} players - Player picks array
 * @param {number} gwNumber - Gameweek number
 * @returns {string} HTML for match schedule
 */
export function renderMatchSchedule(players, gwNumber) {
    const fixtures = getFixtures();
    const gwFixtures = fixtures.filter(f => f.event === gwNumber);

    // Get unique team IDs from player squad
    const teamIds = new Set(players.map(p => {
        const player = getPlayerById(p.element);
        return player ? player.team : null;
    }).filter(Boolean));

    // Filter fixtures for squad teams
    const squadFixtures = gwFixtures.filter(f =>
        teamIds.has(f.team_h) || teamIds.has(f.team_a)
    );

    if (squadFixtures.length === 0) {
        return '';
    }

    // Sort by kickoff time
    squadFixtures.sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));

    // Get glassmorphism effects
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const glassEffect = getGlassmorphism(isDark, 'light');
    const shadow = getShadow('low');
    const radius = getMobileBorderRadius('medium');

    const fixturesHtml = squadFixtures.map(fixture => {
        const homeTeam = getTeamShortName(fixture.team_h);
        const awayTeam = getTeamShortName(fixture.team_a);

        // Convert to SGT (UTC+8)
        const kickoffDate = new Date(fixture.kickoff_time);
        const sgtTime = new Date(kickoffDate.getTime() + (8 * 60 * 60 * 1000));
        const timeStr = sgtTime.toLocaleString('en-SG', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        return `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.5rem 0;
                border-bottom: 1px solid var(--border-color);
                font-size: 0.75rem;
            ">
                <span style="color: var(--text-secondary); min-width: 100px;">${timeStr}</span>
                <span style="font-weight: 600;">${homeTeam} vs ${awayTeam}</span>
            </div>
        `;
    }).join('');

    return `
        <div style="margin-bottom: 0.5rem;">
            <details style="
                backdrop-filter: ${glassEffect.backdropFilter};
                -webkit-backdrop-filter: ${glassEffect.WebkitBackdropFilter};
                background: ${glassEffect.background};
                border: ${glassEffect.border};
                border-radius: ${radius};
                overflow: hidden;
                box-shadow: ${shadow};
            ">
                <summary style="
                    padding: 0.5rem 0.75rem;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.8rem;
                    color: var(--text-primary);
                    user-select: none;
                ">
                    <i class="fas fa-calendar-alt" style="margin-right: 0.5rem;"></i>
                    GW${gwNumber} Fixtures (SGT)
                </summary>
                <div style="padding: 0 0.75rem 0.5rem 0.75rem;">
                    ${fixturesHtml}
                </div>
            </details>
        </div>
    `;
}
