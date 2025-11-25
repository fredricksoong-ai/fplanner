/**
 * Player Replacement Page
 * Shows recommended replacements and full position list
 */

import { getAllPlayers, getPlayerById } from '../data.js';
import { findReplacements } from '../transferHelpers.js';
import { getFixtures, calculateFixtureDifficulty } from '../fixtures.js';
import {
    getPositionShort,
    formatCurrency,
    escapeHtml,
    calculatePPM,
    getDifficultyClass,
    getTeamShortName,
    formatDecimal,
    getFormHeatmap,
    getHeatmapStyle
} from '../utils.js';
import { plannerState } from './state.js';
import { currentGW } from '../data.js';

/**
 * Render player replacement page
 * @param {number} playerId - Player ID to replace
 * @returns {string} HTML string
 */
export function renderPlayerReplacementPage(playerId) {
    const player = getPlayerById(playerId);
    if (!player) {
        return '<div>Player not found</div>';
    }

    const currentSquad = plannerState.getCurrentSquad();
    const initialPicks = plannerState.getInitialPicks();
    const initialBank = plannerState.getInitialBank();
    const initialValue = plannerState.getInitialValue();

    // Create picks object for findReplacements
    const picks = {
        picks: initialPicks,
        entry_history: {
            bank: initialBank,
            value: initialValue
        }
    };

    // Get recommended replacements
    const recommendations = findReplacements(player, picks, currentGW);

    // Get all players in same position
    const allPlayers = getAllPlayers();
    const positionPlayers = allPlayers.filter(p => 
        p.element_type === player.element_type && 
        p.id !== playerId &&
        !currentSquad.some(pick => pick.element === p.id)
    );

    // Sort by form (default)
    positionPlayers.sort((a, b) => {
        const formA = parseFloat(a.form) || 0;
        const formB = parseFloat(b.form) || 0;
        return formB - formA;
    });

    const next5GWs = [currentGW + 1, currentGW + 2, currentGW + 3, currentGW + 4, currentGW + 5];
    const priceDiff = player.now_cost;

    return `
        <div style="padding: 0.5rem;">
            ${renderReplacementHeader(player)}
            ${renderRecommendedReplacements(recommendations, player, next5GWs, priceDiff)}
            ${renderAllPositionPlayers(positionPlayers, player, next5GWs, priceDiff)}
        </div>
    `;
}

/**
 * Render replacement page header
 * @param {Object} player - Player being replaced
 * @returns {string} HTML string
 */
function renderReplacementHeader(player) {
    return `
        <div style="
            position: sticky;
            top: calc(3.5rem + env(safe-area-inset-top));
            background: var(--bg-primary);
            z-index: 100;
            padding: 0.75rem 0;
            border-bottom: 2px solid var(--border-color);
            margin-bottom: 0.75rem;
        ">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <button
                    id="replacement-back-btn"
                    style="
                        background: none;
                        border: none;
                        color: var(--text-primary);
                        font-size: 1.2rem;
                        cursor: pointer;
                        padding: 0.25rem;
                    "
                >
                    <i class="fas fa-arrow-left"></i>
                </button>
                <div>
                    <h1 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                        Replace: ${escapeHtml(player.web_name)}
                    </h1>
                    <p style="font-size: 0.7rem; color: var(--text-secondary); margin: 0.2rem 0 0 0;">
                        ${getPositionShort(player)} • ${formatCurrency(player.now_cost)}
                    </p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render recommended replacements section
 * @param {Array} recommendations - Recommended replacements
 * @param {Object} originalPlayer - Original player
 * @param {Array} next5GWs - Next 5 gameweeks
 * @param {number} originalPrice - Original player price
 * @returns {string} HTML string
 */
function renderRecommendedReplacements(recommendations, originalPlayer, next5GWs, originalPrice) {
    if (recommendations.length === 0) {
        return '';
    }

    return `
        <div style="margin-bottom: 1.5rem;">
            <h2 style="
                font-size: 0.9rem;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 0.75rem;
            ">
                <i class="fas fa-star" style="color: var(--primary-color); margin-right: 0.5rem;"></i>
                Recommended Replacements
            </h2>
            ${renderReplacementTable(recommendations.map(r => r.player), originalPlayer, next5GWs, originalPrice, true)}
        </div>
    `;
}

/**
 * Render all position players section
 * @param {Array} players - All players in position
 * @param {Object} originalPlayer - Original player
 * @param {Array} next5GWs - Next 5 gameweeks
 * @param {number} originalPrice - Original player price
 * @returns {string} HTML string
 */
function renderAllPositionPlayers(players, originalPlayer, next5GWs, originalPrice) {
    return `
        <div>
            <h2 style="
                font-size: 0.9rem;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 0.75rem;
            ">
                All ${getPositionShort(originalPlayer)} Players
            </h2>
            ${renderReplacementTable(players, originalPlayer, next5GWs, originalPrice, false)}
        </div>
    `;
}

/**
 * Render replacement table (using existing table styling)
 * @param {Array} players - Players to display
 * @param {Object} originalPlayer - Original player
 * @param {Array} next5GWs - Next 5 gameweeks
 * @param {number} originalPrice - Original player price
 * @param {boolean} isRecommended - Whether this is recommended section
 * @returns {string} HTML string
 */
function renderReplacementTable(players, originalPlayer, next5GWs, originalPrice, isRecommended) {
    if (players.length === 0) {
        return `
            <div style="
                text-align: center;
                padding: 2rem;
                color: var(--text-secondary);
                font-size: 0.85rem;
            ">
                No players found
            </div>
        `;
    }

    return `
        <div style="
            background: var(--bg-secondary);
            border-radius: 8px;
            overflow: hidden;
        ">
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <table style="width: 100%; font-size: 0.75rem; border-collapse: collapse;">
                    <thead style="background: var(--bg-tertiary);">
                        <tr>
                            <th style="position: sticky; left: 0; background: var(--bg-tertiary); z-index: 10; text-align: left; padding: 0.5rem; min-width: 140px;">Player</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">FDR</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Form</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 70px;">Price</th>
                            <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Diff</th>
                            ${next5GWs.map(gw => `<th style="text-align: center; padding: 0.5rem; min-width: 60px;">GW${gw}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((player, idx) => {
                            const next5Fixtures = getFixtures(player.team, 5, false);
                            const avgFDR = calculateFixtureDifficulty(player.team, 5);
                            const formHeatmap = getFormHeatmap(player.form);
                            const formStyle = getHeatmapStyle(formHeatmap);
                            const rowBg = idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)';
                            const fdrColor = avgFDR <= 2.5 ? '#22c55e' : avgFDR <= 3.5 ? '#eab308' : '#ef4444';
                            const priceDiff = player.now_cost - originalPrice;
                            const diffSign = priceDiff >= 0 ? '+' : '';
                            const diffColor = priceDiff <= 0 ? '#22c55e' : '#ef4444';

                            return `
                                <tr 
                                    class="replacement-player-row"
                                    data-player-id="${player.id}"
                                    data-original-id="${originalPlayer.id}"
                                    style="
                                        background: ${rowBg};
                                        cursor: pointer;
                                        transition: background 0.2s;
                                    "
                                    onmouseover="this.style.background='var(--bg-tertiary)'"
                                    onmouseout="this.style.background='${rowBg}'"
                                >
                                    <td style="
                                        position: sticky;
                                        left: 0;
                                        background: ${rowBg};
                                        z-index: 5;
                                        padding: 0.5rem;
                                        border-right: 1px solid var(--border-color);
                                    ">
                                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                                            <span style="font-size: 0.6rem; color: var(--text-secondary);">${getPositionShort(player)}</span>
                                            <strong style="font-size: 0.7rem;">${escapeHtml(player.web_name)}</strong>
                                        </div>
                                        <div style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 0.1rem;">
                                            ${getTeamShortName(player.team)}
                                        </div>
                                    </td>
                                    <td style="text-align: center; padding: 0.5rem; color: ${fdrColor}; font-weight: 700;">
                                        ${avgFDR.toFixed(1)}
                                    </td>
                                    <td style="text-align: center; padding: 0.5rem; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                                        ${formatDecimal(player.form)}
                                    </td>
                                    <td style="text-align: center; padding: 0.5rem;">
                                        ${formatCurrency(player.now_cost)}
                                    </td>
                                    <td style="text-align: center; padding: 0.5rem; color: ${diffColor}; font-weight: 600;">
                                        ${diffSign}£${Math.abs(priceDiff / 10).toFixed(1)}m
                                    </td>
                                    ${next5Fixtures.map(fix => {
                                        const fdrClass = getDifficultyClass(fix.difficulty);
                                        return `
                                            <td style="text-align: center; padding: 0.5rem;">
                                                <span class="${fdrClass}" style="display: inline-block; width: 52px; padding: 0.2rem 0.3rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; text-align: center;">
                                                    ${fix.opponent}
                                                </span>
                                            </td>
                                        `;
                                    }).join('')}
                                    ${next5Fixtures.length < 5 ? Array(5 - next5Fixtures.length).fill('<td style="text-align: center; padding: 0.5rem;">—</td>').join('') : ''}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

