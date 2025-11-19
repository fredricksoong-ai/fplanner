// ============================================================================
// PLAYER TABLE RENDERER
// Consolidated table rendering for desktop and mobile
// ============================================================================

import { currentGW } from '../data.js';
import { isMobileDevice, getHeatmapStyle } from '../utils.js';
import {
    getTableConfig,
    getFixtureHeaders,
    getNextFixtures
} from './tableConfigs.js';

// ============================================================================
// DESKTOP TABLE RENDERER
// ============================================================================

/**
 * Render player table for desktop
 * @param {Array} players - Players to display
 * @param {string} position - Position filter
 * @param {Set} myPlayerIds - Set of player IDs in user's team
 * @returns {string} HTML for desktop table
 */
export function renderPlayerTableDesktop(players, position, myPlayerIds = new Set()) {
    const config = getTableConfig(position);
    const fixtureHeaders = getFixtureHeaders(5);

    let html = `
        <div style="overflow-x: auto; background: var(--bg-primary); border-radius: 12px; padding: 1rem; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse; min-width: 1200px;">
                <thead style="background: var(--primary-color); color: white; position: sticky; top: 0; z-index: 1;">
                    <tr>
    `;

    // Render column headers
    config.forEach(col => {
        const align = col.align || 'center';
        html += `<th style="text-align: ${align}; padding: 0.75rem 0.5rem;">${col.label}</th>`;
    });

    // Add fixture headers
    fixtureHeaders.forEach((h, idx) => {
        const isUpcomingGW = idx === 0;
        const headerBg = isUpcomingGW ? 'background: rgba(139, 92, 246, 0.3);' : '';
        html += `<th style="text-align: center; padding: 0.5rem; ${headerBg}">${h}</th>`;
    });

    html += `
                    </tr>
                </thead>
                <tbody>
    `;

    // Render rows
    players.forEach((player, index) => {
        const isMyPlayer = myPlayerIds.has(player.id);
        const rowBg = isMyPlayer
            ? 'rgba(139, 92, 246, 0.15)'
            : (index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)');

        html += `<tr style="background: ${rowBg};">`;

        // Render cells based on configuration
        config.forEach(col => {
            html += renderTableCell(player, col, isMyPlayer);
        });

        // Add fixture cells
        const next5 = getNextFixtures(player.team, currentGW, 5);
        next5.forEach((f, fixIdx) => {
            const isUpcomingGW = fixIdx === 0;
            const fixtureHighlight = isUpcomingGW ? 'background: rgba(139, 92, 246, 0.1);' : '';
            const fdrClass = getDifficultyClass(f.difficulty);

            html += `
                <td style="padding: 0.5rem; text-align: center; ${fixtureHighlight}">
                    <span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; display: inline-block;">
                        ${f.opponent}
                    </span>
                </td>
            `;
        });

        html += `</tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

// ============================================================================
// MOBILE TABLE RENDERER
// ============================================================================

/**
 * Render player table for mobile (grid-based layout)
 * @param {Array} players - Players to display
 * @param {string} contextType - Type of context to show ('ownership', 'form', 'fixtures')
 * @param {Set} myPlayerIds - Set of player IDs in user's team
 * @returns {string} HTML for mobile table
 */
export function renderPlayerTableMobile(players, contextType = 'ownership', myPlayerIds = new Set()) {
    const contextConfig = getContextColumnConfig(contextType);

    let html = `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
    `;

    players.forEach((player, index) => {
        const isMyPlayer = myPlayerIds.has(player.id);
        const cardBg = isMyPlayer ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-primary)';

        html += `
            <div style="
                background: ${cardBg};
                border-radius: 12px;
                padding: 1rem;
                box-shadow: 0 2px 8px var(--shadow);
                border-left: 4px solid ${isMyPlayer ? '#8b5cf6' : 'transparent'};
            ">
                <!-- Player Header -->
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); margin-bottom: 0.25rem;">
                            ${player.web_name}${isMyPlayer ? ' <span style="color: #8b5cf6;">⭐</span>' : ''}
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">
                            ${getTeamShortName(player.team)} • ${getPositionShort(player)}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.125rem; font-weight: 700; color: var(--primary-color);">
                            ${formatCurrency(player.now_cost)}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${player.total_points} pts
                        </div>
                    </div>
                </div>

                <!-- Context Stats Grid -->
                <div style="display: grid; grid-template-columns: repeat(${contextConfig.length}, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
        `;

        contextConfig.forEach(col => {
            const value = col.getValue(player);
            const style = col.getStyle ? col.getStyle(player) : {};
            const bgStyle = style.background ? `background: ${style.background};` : '';
            const colorStyle = style.color ? `color: ${style.color};` : '';

            html += `
                    <div style="text-align: center;">
                        <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                            ${col.label}
                        </div>
                        <div style="font-weight: 600; font-size: 0.95rem; ${bgStyle} ${colorStyle} padding: 0.25rem; border-radius: 0.25rem;">
                            ${value}
                        </div>
                    </div>
            `;
        });

        html += `
                </div>

                <!-- Next Fixtures -->
                <div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                        Next 5 Fixtures
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        `;

        const next5 = getNextFixtures(player.team, currentGW, 5);
        next5.forEach(f => {
            const fdrClass = getDifficultyClass(f.difficulty);
            html += `
                        <span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">
                            ${f.opponent}
                        </span>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;
    });

    html += `
        </div>
    `;

    return html;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Render a single table cell based on column configuration
 * @param {Object} player - Player data
 * @param {Object} col - Column configuration
 * @param {boolean} isMyPlayer - Whether player is in user's team
 * @returns {string} HTML for table cell
 */
function renderTableCell(player, col, isMyPlayer) {
    const align = col.align || 'center';
    let cellStyle = `padding: 0.75rem 0.5rem; text-align: ${align};`;

    // Add font size if specified
    if (col.fontSize) {
        cellStyle += ` font-size: ${col.fontSize};`;
    }

    // Add bold if specified
    if (col.bold) {
        cellStyle += ` font-weight: 600;`;
    }

    // Add heatmap styling if configured
    if (col.hasHeatmap && col.heatmapKey) {
        const heatmapStyle = getHeatmapStyle(player[col.heatmapKey], col.heatmapKey);
        if (heatmapStyle) {
            cellStyle += ` background: ${heatmapStyle.background}; color: ${heatmapStyle.color}; font-weight: 600;`;
        }
    }

    // Add color if specified
    if (col.getColor) {
        const color = col.getColor(player);
        cellStyle += ` color: ${color};`;
    }

    // Use custom render function if provided
    let cellContent;
    if (col.renderCell) {
        cellContent = col.renderCell(player, isMyPlayer);
    } else {
        cellContent = col.getValue(player);
    }

    return `<td style="${cellStyle}">${cellContent}</td>`;
}

/**
 * Get context column configuration for mobile view
 * @param {string} contextType - 'ownership', 'form', or 'fixtures'
 * @returns {Array} Context column configuration
 */
function getContextColumnConfig(contextType) {
    const configs = {
        ownership: [
            {
                label: 'PPM',
                getValue: (p) => formatDecimal(calculatePPM(p)),
                getStyle: (p) => getHeatmapStyle(calculatePPM(p), 'ppm')
            },
            {
                label: 'Own%',
                getValue: (p) => `${(parseFloat(p.selected_by_percent) || 0).toFixed(1)}%`
            },
            {
                label: 'Form',
                getValue: (p) => formatDecimal(p.form),
                getStyle: (p) => getHeatmapStyle(parseFloat(p.form), 'form')
            }
        ],
        form: [
            {
                label: 'Form',
                getValue: (p) => formatDecimal(p.form),
                getStyle: (p) => getHeatmapStyle(parseFloat(p.form), 'form')
            },
            {
                label: 'Min%',
                getValue: (p) => `${calculateMinutesPercentage(p, currentGW).toFixed(0)}%`
            },
            {
                label: 'ΔT',
                getValue: (p) => {
                    const net = (p.transfers_in_event || 0) - (p.transfers_out_event || 0);
                    return net >= 0 ? `+${net}` : net.toString();
                },
                getStyle: (p) => {
                    const net = (p.transfers_in_event || 0) - (p.transfers_out_event || 0);
                    const color = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'var(--text-secondary)';
                    return { color };
                }
            }
        ],
        fixtures: [
            {
                label: 'FDR(5)',
                getValue: (p) => calculateFixtureDifficulty(p.team, 5).toFixed(1)
            },
            {
                label: 'PPM',
                getValue: (p) => formatDecimal(calculatePPM(p)),
                getStyle: (p) => getHeatmapStyle(calculatePPM(p), 'ppm')
            },
            {
                label: 'Form',
                getValue: (p) => formatDecimal(p.form),
                getStyle: (p) => getHeatmapStyle(parseFloat(p.form), 'form')
            }
        ]
    };

    return configs[contextType] || configs.ownership;
}

/**
 * Import required utility functions (to be imported at top when integrated)
 */
import {
    formatCurrency,
    formatDecimal,
    getTeamShortName,
    getPositionShort,
    getDifficultyClass,
    calculatePPM,
    calculateMinutesPercentage
} from '../utils.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Render player table (automatically chooses desktop or mobile)
 * @param {Array} players - Players to display
 * @param {string} position - Position filter
 * @param {Object} options - Rendering options
 * @returns {string} HTML for table
 */
export function renderPlayerTable(players, position, options = {}) {
    const {
        contextType = 'ownership',
        myPlayerIds = new Set(),
        forceMobile = false,
        forceDesktop = false
    } = options;

    const mobile = forceMobile || (isMobileDevice() && !forceDesktop);

    if (mobile) {
        return renderPlayerTableMobile(players, contextType, myPlayerIds);
    } else {
        return renderPlayerTableDesktop(players, position, myPlayerIds);
    }
}
