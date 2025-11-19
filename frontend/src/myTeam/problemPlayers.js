// ============================================================================
// PROBLEM PLAYERS MODULE
// Identifies and suggests replacements for problematic players
// ============================================================================

import { getPlayerById } from '../data.js';
import { analyzePlayerRisks, hasHighRisk } from '../risk.js';
import { findReplacements, renderProblemPlayerRow, renderReplacementRow } from '../transferHelpers.js';

/**
 * Render Problem Players section (Transfer Committee integration)
 * @param {Array} allPlayers - All player picks
 * @param {Array} picks - User's current picks
 * @param {number} gameweek - Current gameweek
 * @returns {string} HTML for problem players section
 */
export function renderProblemPlayersSection(allPlayers, picks, gameweek) {
    // Find problem players
    const problemPlayers = [];
    allPlayers.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (!player) return;

        const risks = analyzePlayerRisks(player);
        if (hasHighRisk(risks) || risks.some(r => r.severity === 'medium')) {
            problemPlayers.push({
                pick: pick,
                player: player,
                risks: risks
            });
        }
    });

    // If no problem players, don't show the section
    if (problemPlayers.length === 0) {
        return '';
    }

    // Next 5 gameweeks for fixture columns
    const next5GWs = [gameweek + 1, gameweek + 2, gameweek + 3, gameweek + 4, gameweek + 5];

    let html = `
        <div class="mb-8" style="
            background: var(--bg-primary);
            border-radius: 12px;
            box-shadow: 0 2px 8px var(--shadow);
            border: 2px solid #fb923c;
        ">
            <div
                id="problem-players-header"
                style="
                padding: 1rem 1.5rem;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div>
                    <h3 style="font-size: 1.125rem; font-weight: 700; color: #fb923c; margin-bottom: 0.25rem;">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>Problem Players
                    </h3>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">
                        ${problemPlayers.length} player${problemPlayers.length !== 1 ? 's' : ''} flagged for review. Click to view replacement suggestions.
                    </p>
                </div>
                <div>
                    <i id="problem-players-icon" class="fas fa-chevron-down" style="color: var(--text-secondary); font-size: 1.25rem;"></i>
                </div>
            </div>

            <div id="problem-players-content" style="display: none; padding: 1.5rem; overflow-x: auto;">
                <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                    <thead style="background: var(--primary-color); color: white;">
                        <tr>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Pos</th>
                            <th style="text-align: left; padding: 0.75rem 0.75rem;">Player</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Team</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Diff</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">xGI/xGC</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">DefCon/90</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Net Δ</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[0]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[1]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[2]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[3]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[4]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;"></th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    // Render problem players with replacements
    problemPlayers.forEach((problem, idx) => {
        const { player, risks } = problem;
        const replacements = findReplacements(player, picks, gameweek);

        html += renderProblemPlayerRow(player, risks, idx, next5GWs, gameweek);

        replacements.forEach((rep, repIdx) => {
            html += renderReplacementRow(rep, player, idx, repIdx, next5GWs, gameweek);
        });
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    return html;
}

/**
 * Toggle Problem Players section visibility
 * Should be called from window.toggleProblemPlayers
 */
export function toggleProblemPlayersVisibility() {
    const content = document.getElementById('problem-players-content');
    const icon = document.getElementById('problem-players-icon');

    if (!content || !icon) return;

    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';

    if (isHidden) {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}
