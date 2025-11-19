// ============================================================================
// PLAYER TABLE RENDERER
// Consolidated table rendering for desktop and mobile
// ============================================================================

import { currentGW } from '../data.js';
import {
    formatCurrency,
    formatDecimal,
    getTeamShortName,
    getPositionShort,
    getDifficultyClass,
    calculatePPM,
    calculateMinutesPercentage,
    getPtsHeatmap,
    getFormHeatmap,
    getHeatmapStyle,
    escapeHtml
} from '../utils.js';
import { getGWOpponent, getMatchStatus, calculateFixtureDifficulty } from '../fixtures.js';
import { isMobileDevice } from '../renderMyTeamMobile.js';
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
// MOBILE TABLE RENDERER (ORIGINAL DESIGN)
// ============================================================================

/**
 * Render player table for mobile - ORIGINAL TABLE-BASED DESIGN
 * @param {Array} players - Players to display
 * @param {string} contextColumn - Context column type
 * @returns {string} HTML for mobile table
 */
export function renderPlayerTableMobile(players, contextColumn = 'total') {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }

    // Limit to top 15 for mobile
    const mobilePlayers = players.slice(0, 15);

    // Context column header and value function
    const contextConfig = {
        'total': {
            header: 'Total',
            getValue: (p) => p.total_points,
            getHeatmap: (p) => {
                const pts = p.total_points || 0;
                if (pts >= 100) return 'heat-dark-green';
                if (pts >= 70) return 'heat-light-green';
                if (pts >= 40) return 'heat-yellow';
                if (pts >= 20) return 'heat-red';
                return 'heat-gray';
            }
        },
        'ppm': {
            header: 'PPM',
            getValue: (p) => formatDecimal(calculatePPM(p)),
            getHeatmap: (p) => {
                const ppm = calculatePPM(p);
                if (ppm >= 6) return 'heat-dark-green';
                if (ppm >= 5) return 'heat-light-green';
                if (ppm >= 4) return 'heat-yellow';
                if (ppm >= 3) return 'heat-red';
                return 'heat-gray';
            }
        },
        'ownership': {
            header: 'Own%',
            getValue: (p) => `${(parseFloat(p.selected_by_percent) || 0).toFixed(1)}%`,
            getHeatmap: (p) => {
                const own = parseFloat(p.selected_by_percent) || 0;
                if (own >= 30) return 'heat-red';
                if (own >= 15) return 'heat-yellow';
                if (own >= 5) return 'heat-light-green';
                if (own > 0) return 'heat-dark-green';
                return 'heat-gray';
            }
        },
        'transfers': {
            header: 'ΔT',
            getValue: (p) => {
                if (!p.github_transfers) return '—';
                const net = p.github_transfers.transfers_in - p.github_transfers.transfers_out;
                const prefix = net > 0 ? '+' : '';
                return `${prefix}${(net / 1000).toFixed(0)}k`;
            },
            getColor: (p) => {
                if (!p.github_transfers) return 'inherit';
                const net = p.github_transfers.transfers_in - p.github_transfers.transfers_out;
                return net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
            }
        },
        'xg-variance': {
            header: 'G-xG',
            getValue: (p) => {
                const variance = (p.goals_scored || 0) - (parseFloat(p.expected_goals) || 0);
                return variance > 0 ? `+${formatDecimal(variance)}` : formatDecimal(variance);
            },
            getHeatmap: (p) => {
                const variance = (p.goals_scored || 0) - (parseFloat(p.expected_goals) || 0);
                if (variance >= 2) return 'heat-dark-green';
                if (variance >= 1) return 'heat-light-green';
                if (variance >= -1) return 'heat-yellow';
                if (variance >= -2) return 'heat-red';
                return 'heat-gray';
            }
        },
        'xg': {
            header: 'xG',
            getValue: (p) => formatDecimal(parseFloat(p.expected_goals) || 0),
            getHeatmap: (p) => {
                const xg = parseFloat(p.expected_goals) || 0;
                if (xg >= 4) return 'heat-dark-green';
                if (xg >= 2.5) return 'heat-light-green';
                if (xg >= 1.5) return 'heat-yellow';
                if (xg >= 0.5) return 'heat-red';
                return 'heat-gray';
            }
        },
        'bonus': {
            header: 'Bonus',
            getValue: (p) => p.bonus || 0,
            getHeatmap: (p) => {
                const bonus = p.bonus || 0;
                if (bonus >= 10) return 'heat-dark-green';
                if (bonus >= 5) return 'heat-light-green';
                if (bonus >= 2) return 'heat-yellow';
                if (bonus >= 1) return 'heat-red';
                return 'heat-gray';
            }
        },
        'def90': {
            header: 'Def/90',
            getValue: (p) => formatDecimal(p.github_season?.defensive_contribution_per_90 || 0),
            getHeatmap: (p) => {
                const def = p.github_season?.defensive_contribution_per_90 || 0;
                if (def >= 5) return 'heat-dark-green';
                if (def >= 4) return 'heat-light-green';
                if (def >= 3) return 'heat-yellow';
                if (def >= 2) return 'heat-red';
                return 'heat-gray';
            }
        },
        'fdr5': {
            header: 'FDR(5)',
            getValue: (p) => formatDecimal(calculateFixtureDifficulty(p.team, 5)),
            getClass: (p) => getDifficultyClass(Math.round(calculateFixtureDifficulty(p.team, 5)))
        },
        'penalty': { header: 'PK', getValue: (p) => p.penalties_order === 1 ? '⚽' : '—' }
    };

    const config = contextConfig[contextColumn] || contextConfig.total;

    // Header row
    let html = `
        <div class="mobile-table">
            <div class="mobile-table-header" style="grid-template-columns: 2fr 1.2fr 1fr 0.7fr 0.7fr 0.8fr; padding-bottom: 2px !important; padding-top: 2px !important;">
                <div>Player</div>
                <div style="text-align: center;">Opp</div>
                <div style="text-align: center;">Status</div>
                <div style="text-align: center;">Pts</div>
                <div style="text-align: center;">Form</div>
                <div style="text-align: center;">${config.header}</div>
            </div>
    `;

    // Render rows
    mobilePlayers.forEach((player) => {
        const gwOpp = getGWOpponent(player.team, currentGW);
        const matchStatus = getMatchStatus(player.team, currentGW, player);
        const isLive = matchStatus === 'LIVE';
        const isFinished = matchStatus.startsWith('FT');

        // Points (GW points)
        const gwPoints = player.event_points || 0;
        const ptsHeatmap = getPtsHeatmap(gwPoints, 'gw_pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);

        // Form
        const formHeatmap = getFormHeatmap(parseFloat(player.form) || 0);
        const formStyle = getHeatmapStyle(formHeatmap);

        // Status styling
        let statusColor = 'var(--text-secondary)';
        let statusWeight = '400';
        let statusBgColor = 'transparent';

        if (isFinished && matchStatus.includes('(')) {
            const minsMatch = matchStatus.match(/\((\d+)\)/);
            if (minsMatch) {
                const mins = parseInt(minsMatch[1]);
                statusWeight = '700';
                if (mins >= 90) {
                    statusColor = '#86efac';
                    statusBgColor = 'rgba(31, 77, 46, 1.0)';
                } else if (mins >= 60) {
                    statusColor = '#fcd34d';
                    statusBgColor = 'rgba(92, 74, 31, 1.0)';
                } else {
                    statusColor = '#fca5a5';
                    statusBgColor = 'rgba(92, 31, 31, 1.0)';
                }
            } else {
                statusColor = '#22c55e';
            }
        } else if (isLive) {
            statusColor = '#ef4444';
            statusWeight = '700';
        }

        // Context column value and styling
        const contextValue = config.getValue(player);

        let contextDivStyle = 'text-align: center;';
        let contextContent = contextValue;

        if (config.getClass) {
            const contextClass = config.getClass(player);
            contextContent = `<span class="${contextClass}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 700; font-size: 0.6rem; display: inline-block;">${contextValue}</span>`;
        } else if (config.getHeatmap) {
            const heatmap = config.getHeatmap(player);
            const heatmapStyle = getHeatmapStyle(heatmap);
            contextDivStyle = `text-align: center; background: ${heatmapStyle.background}; color: ${heatmapStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;`;
        } else if (config.getColor) {
            const contextColor = config.getColor(player);
            contextDivStyle = `text-align: center; color: ${contextColor}; font-weight: 700; font-size: 0.7rem;`;
        } else {
            contextDivStyle = 'text-align: center; font-size: 0.7rem;';
        }

        html += `
            <div
                class="player-row mobile-table-row"
                style="grid-template-columns: 2fr 1.2fr 1fr 0.7fr 0.7fr 0.8fr; cursor: pointer; padding-bottom: 3px !important; padding-top: 3px !important;"
                data-player-id="${player.id}"
            >
                <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(player.web_name)}
                </div>
                <div style="text-align: center;">
                    <span class="${getDifficultyClass(gwOpp.difficulty)}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 700; font-size: 0.6rem; min-width: 3rem; display: inline-block; text-align: center;">
                        ${gwOpp.name} (${gwOpp.isHome ? 'H' : 'A'})
                    </span>
                </div>
                <div style="text-align: center; font-size: 0.6rem; font-weight: ${statusWeight}; color: ${statusColor}; background: ${statusBgColor}; padding: 0.08rem 0.25rem; border-radius: 0.25rem;">${matchStatus}</div>
                <div style="text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${gwPoints}</div>
                <div style="text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${formatDecimal(player.form)}</div>
                <div style="${contextDivStyle}">${contextContent}</div>
            </div>
        `;
    });

    html += `</div>`;
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

    if (col.fontSize) {
        cellStyle += ` font-size: ${col.fontSize};`;
    }

    if (col.bold) {
        cellStyle += ` font-weight: 600;`;
    }

    if (col.hasHeatmap && col.heatmapKey) {
        const heatmapStyle = getHeatmapStyle(player[col.heatmapKey], col.heatmapKey);
        if (heatmapStyle) {
            cellStyle += ` background: ${heatmapStyle.background}; color: ${heatmapStyle.color}; font-weight: 600;`;
        }
    }

    if (col.getColor) {
        const color = col.getColor(player);
        cellStyle += ` color: ${color};`;
    }

    let cellContent;
    if (col.renderCell) {
        cellContent = col.renderCell(player, isMyPlayer);
    } else {
        cellContent = col.getValue(player);
    }

    return `<td style="${cellStyle}">${cellContent}</td>`;
}

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
        contextType = 'total',
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
