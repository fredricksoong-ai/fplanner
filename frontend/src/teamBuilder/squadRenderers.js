// ============================================================================
// SQUAD RENDERERS
// Team Builder projected squad table rendering
// ============================================================================

import { getPlayerById } from '../data.js';
import {
    getPositionShort,
    escapeHtml,
    formatCurrency,
    formatDecimal,
    calculatePPM,
    getTeamShortName
} from '../utils.js';
import { calculateFixtureDifficulty } from '../fixtures.js';
import { analyzePlayerRisks, hasHighRisk, renderRiskTooltip } from '../risk.js';
import { calculateProjectedSquad, validateSquad } from '../teamBuilderHelpers.js';

/**
 * Render projected squad table with validation errors
 */
export function renderProjectedSquad(plan, gameweek) {
    const { squad, bank, value } = calculateProjectedSquad(plan, gameweek);
    const validation = validateSquad(plan, gameweek);

    // Sort by position
    const sortedSquad = [...squad].sort((a, b) => {
        const playerA = getPlayerById(a.element);
        const playerB = getPlayerById(b.element);
        if (!playerA || !playerB) return 0;

        // Sort by position type, then by price
        const posOrder = { 1: 0, 2: 1, 3: 2, 4: 3 }; // GKP, DEF, MID, FWD
        const posCompare = posOrder[playerA.element_type] - posOrder[playerB.element_type];
        if (posCompare !== 0) return posCompare;

        return playerB.now_cost - playerA.now_cost;
    });

    return `
        <div style="margin-bottom: 2rem;">
            <h3 style="font-size: 1.125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                <i class="fas fa-users"></i> Projected Squad (After GW${gameweek})
            </h3>

            ${validation.errors.length > 0 ? `
                <div style="
                    background: rgba(239, 68, 68, 0.1);
                    border-left: 4px solid #ef4444;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                ">
                    <div style="font-weight: 600; color: #ef4444; margin-bottom: 0.5rem;">
                        <i class="fas fa-exclamation-triangle"></i> Validation Errors:
                    </div>
                    <ul style="margin: 0; padding-left: 1.5rem; color: #ef4444;">
                        ${validation.errors.map(err => `<li>${err}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 1rem;
                box-shadow: 0 2px 8px var(--shadow);
            ">
                <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-weight: 600; color: var(--text-primary);">Total Value:</span>
                        <span style="margin-left: 0.5rem; color: var(--text-secondary);">£${(value / 10).toFixed(1)}m</span>
                    </div>
                    <div>
                        <span style="font-weight: 600; color: var(--text-primary);">Bank:</span>
                        <span style="margin-left: 0.5rem; color: ${bank < 0 ? '#ef4444' : 'var(--text-secondary)'};">£${(bank / 10).toFixed(1)}m</span>
                    </div>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                        <thead style="background: var(--primary-color); color: white;">
                            <tr>
                                <th style="text-align: left; padding: 0.75rem 0.5rem;">Pos</th>
                                <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                                <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                                <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                                <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                                <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                                <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR (5)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedSquad.map((pick, idx) => {
                                const player = getPlayerById(pick.element);
                                if (!player) return '';

                                const rowBg = idx % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';
                                const ppm = calculatePPM(player);
                                const fdr = calculateFixtureDifficulty(player.team, 5);
                                const fdrColor = fdr <= 2.5 ? '#22c55e' : fdr <= 3.5 ? '#fb923c' : '#ef4444';

                                const risks = analyzePlayerRisks(player);
                                const riskTooltip = renderRiskTooltip(risks);
                                const hasRisk = hasHighRisk(risks);

                                return `
                                    <tr style="background: ${hasRisk ? 'rgba(239, 68, 68, 0.05)' : rowBg};">
                                        <td style="padding: 0.75rem 0.5rem; font-weight: 600;">${getPositionShort(player)}</td>
                                        <td style="padding: 0.75rem 0.5rem;">
                                            <strong>${escapeHtml(player.web_name)}</strong>
                                            ${riskTooltip ? `${riskTooltip}` : ''}
                                        </td>
                                        <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                                        <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                                        <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(player.form)}</td>
                                        <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(ppm)}</td>
                                        <td style="padding: 0.75rem 0.5rem; text-align: center;">
                                            <span style="color: ${fdrColor}; font-weight: 600;">
                                                ${fdr.toFixed(1)}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}
