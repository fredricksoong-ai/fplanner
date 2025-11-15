// ============================================================================
// RENDER HELPERS MODULE
// Shared rendering utilities used across multiple page modules
// ============================================================================

import {
    getFixtureHeaders,
    getPastGWHeaders,
    getTeamShortName,
    calculatePPM,
    escapeHtml,
    formatDecimal,
    formatCurrency,
    formatPercent,
    getPtsHeatmap,
    getFormHeatmap,
    getHeatmapStyle,
    getDifficultyClass,
    getCurrentGW
} from './utils.js';

import {
    getFixtures
} from './fixtures.js';

import {
    analyzePlayerRisks,
    renderRiskTooltip,
    hasHighRisk
} from './risk.js';

// ============================================================================
// PLAYER TABLE RENDERING
// ============================================================================

/**
 * Render a player table with stats and fixtures
 * @param {Array} players - Array of player objects
 * @param {string} fixtureMode - 'next5' or 'past3next3'
 * @returns {string} HTML string for player table
 */
export function renderPlayerTable(players, fixtureMode = 'next5') {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }

    let fixtureHeaders = [];
    if (fixtureMode === 'next5') {
        fixtureHeaders = getFixtureHeaders(5, 1);
    } else if (fixtureMode === 'past3next3') {
        fixtureHeaders = [...getPastGWHeaders(3), ...getFixtureHeaders(3, 1)];
    }

    let html = `
        <div style="overflow-x: auto; background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead style="background: var(--primary-color); color: white;">
                    <tr>
                        <th style="text-align: left; padding: 0.75rem 1rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 1rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Mins</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Own %</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Price</th>
                        ${fixtureHeaders.map(h => `<th style="text-align: center; padding: 0.5rem;">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    players.forEach((player, index) => {
        const rowBg = index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';
        const risks = analyzePlayerRisks(player);
        const riskTooltip = renderRiskTooltip(risks);
        const hasHighSeverity = hasHighRisk(risks);

        const ppm = calculatePPM(player);
        const ptsHeatmap = getPtsHeatmap(player.total_points, 'pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);
        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);
        const ppmHeatmap = getPtsHeatmap(ppm, 'value');
        const ppmStyle = getHeatmapStyle(ppmHeatmap);

        let fixtures = [];
        if (fixtureMode === 'next5') {
            fixtures = getFixtures(player.team_code, 10, false).filter(f => f.event > getCurrentGW()).slice(0, 5);
        } else if (fixtureMode === 'past3next3') {
            const past3 = getFixtures(player.team_code, 3, true);
            const next3 = getFixtures(player.team_code, 10, false).filter(f => f.event > getCurrentGW()).slice(0, 3);
            fixtures = [...past3, ...next3];
        }

        html += `
            <tr style="background: ${hasHighSeverity ? 'rgba(220, 38, 38, 0.05)' : rowBg};">
                <td style="padding: 0.75rem 1rem;">
                    <strong>${escapeHtml(player.web_name)}</strong>
                    ${riskTooltip ? `<span style="margin-left: 0.5rem;">${riskTooltip}</span>` : ''}
                </td>
                <td style="padding: 0.75rem 1rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 1rem; text-align: center;">${player.minutes || 0}</td>
                <td style="padding: 0.75rem 1rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">
                    ${player.total_points || 0}
                </td>
                <td style="padding: 0.75rem 1rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                    ${formatDecimal(player.form)}
                </td>
                <td style="padding: 0.75rem 1rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">
                    ${formatDecimal(ppm)}
                </td>
                <td style="padding: 0.75rem 1rem; text-align: center;">${formatPercent(player.selected_by_percent)}</td>
                <td style="padding: 0.75rem 1rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                ${fixtures.map(f => `
                    <td style="padding: 0.5rem; text-align: center;">
                        <span class="${getDifficultyClass(f.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; display: inline-block;">
                            ${f.opponent}
                        </span>
                    </td>
                `).join('')}
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

// ============================================================================
// RISK TOOLTIP LISTENERS
// ============================================================================

/**
 * Attach hover listeners to risk tooltip indicators
 * Must be called after rendering any content with risk tooltips
 */
export function attachRiskTooltipListeners() {
    // Add hover listeners to risk indicators
    setTimeout(() => {
        const riskIndicators = document.querySelectorAll('.risk-indicator');
        riskIndicators.forEach(indicator => {
            const tooltip = indicator.querySelector('.risk-tooltip');
            if (tooltip) {
                indicator.addEventListener('mouseenter', () => {
                    tooltip.style.display = 'block';
                });
                indicator.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });
            }
        });
    }, 100);
}
