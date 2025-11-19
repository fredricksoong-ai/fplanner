// ============================================================================
// COMPACT TEAM LIST RENDERER
// Orchestrates rendering of starters and bench with header
// ============================================================================

import { getPlayerById } from '../../data.js';
import { renderCompactPlayerRow } from './compactPlayerRow.js';

/**
 * Render compact team list
 * @param {Array} players - Player picks array
 * @param {number} gwNumber - Gameweek number
 * @returns {string} HTML for team list
 */
export function renderCompactTeamList(players, gwNumber) {
    const starters = players.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
    const bench = players.filter(p => p.position > 11).sort((a, b) => a.position - b.position);

    // Compact header row (scrolls with content)
    const headerRow = `
        <div class="mobile-table-header mobile-table-team" style="text-transform: capitalize; padding-bottom: 2px !important; padding-top: 2px !important;">
            <div>Player</div>
            <div style="text-align: center;">Opp</div>
            <div style="text-align: center;">Status</div>
            <div style="text-align: center;">Pts</div>
            <div style="text-align: center;">Form</div>
        </div>
    `;

    // Starting XI
    const startersHtml = starters.map(player => {
        const fullPlayer = getPlayerById(player.element);
        if (!fullPlayer) return '';
        return renderCompactPlayerRow(player, fullPlayer, gwNumber);
    }).join('');

    // Bench
    const benchHtml = bench.map(player => {
        const fullPlayer = getPlayerById(player.element);
        if (!fullPlayer) return '';
        return renderCompactPlayerRow(player, fullPlayer, gwNumber);
    }).join('');

    return `
        <div class="mobile-table">
            ${headerRow}
            ${startersHtml}
            ${benchHtml}
        </div>
    `;
}
