// ============================================================================
// TRANSFER HELPERS MODULE
// Shared functions for finding replacements and rendering problem players
// Used by both My Team and Transfer Committee pages
// ============================================================================

import { getAllPlayers, currentGW } from './data.js';
import {
    getPositionType,
    getPositionShort,
    formatDecimal,
    formatCurrency,
    escapeHtml,
    calculatePPM,
    getFormHeatmap,
    getHeatmapStyle,
    getDifficultyClass,
    getTeamShortName,
    calculateMinutesPercentage
} from './utils.js';
import { getFixtures, calculateFixtureDifficulty } from './fixtures.js';
import { renderRiskTooltip } from './risk.js';

// ============================================================================
// PROBLEM PLAYER RENDERING
// ============================================================================

/**
 * Render a problem player row in Transfer Committee table
 * @param {Object} player - Player object
 * @param {Array} risks - Risk factors from analyzePlayerRisks
 * @param {number} idx - Row index
 * @param {Array} next5GWs - Array of next 5 gameweek numbers
 * @param {number} gameweek - Current gameweek
 * @returns {string} HTML for problem player row
 */
export function renderProblemPlayerRow(player, risks, idx, next5GWs, gameweek) {
    const posType = getPositionType(player);
    const riskTooltip = renderRiskTooltip(risks);
    const rowBg = idx % 2 === 0 ? '#f9fafb' : 'white';

    // Calculate metrics
    const ppm = calculatePPM(player);
    const ownership = parseFloat(player.selected_by_percent) || 0;
    const formHeatmap = getFormHeatmap(player.form);
    const formStyle = getHeatmapStyle(formHeatmap);

    // Position-specific xGI/xGC
    let metricValue = '';
    if (posType === 'GKP' || posType === 'DEF') {
        const xGC = player.expected_goals_conceded_per_90 || 0;
        metricValue = formatDecimal(xGC);
    } else {
        const xGI = player.expected_goal_involvements_per_90 || 0;
        metricValue = formatDecimal(xGI);
    }

    // Defensive contribution per 90
    const defCon = player.github_season?.defensive_contribution_per_90 || 0;
    const defConFormatted = formatDecimal(defCon);

    // Transfer momentum
    let transferNet = '—';
    let transferColor = 'inherit';
    if (player.github_transfers) {
        const net = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
        const prefix = net > 0 ? '+' : '';
        transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
        transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
    } else if (player.transfers_in_event !== undefined && player.transfers_out_event !== undefined) {
        const net = player.transfers_in_event - player.transfers_out_event;
        const prefix = net > 0 ? '+' : '';
        transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
        transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
    }

    // Get next 5 fixtures
    const next5Fixtures = getFixtures(player.team, 5, false);

    return `
        <tr style="background: ${rowBg};">
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${getPositionShort(player)}</td>
            <td style="padding: 0.75rem 0.75rem;">
                <strong>${escapeHtml(player.web_name)}</strong>
                ${riskTooltip ? `<span style="margin-left: 0.5rem;">${riskTooltip}</span>` : ''}
            </td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${getTeamShortName(player.team)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">±£0.0</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(ppm)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${metricValue}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${defConFormatted}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
            ${next5Fixtures.map(fix => {
                const fdrClass = getDifficultyClass(fix.difficulty);
                return `
                    <td style="padding: 0.75rem 0.5rem; text-align: center;">
                        <span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; white-space: nowrap;">
                            ${fix.opponent}
                        </span>
                    </td>
                `;
            }).join('')}
            ${next5Fixtures.length < 5 ? Array(5 - next5Fixtures.length).fill('<td style="padding: 0.75rem 0.5rem; text-align: center;">—</td>').join('') : ''}
            <td style="padding: 0.75rem 0.5rem; text-align: center;">
                <button
                    class="toggle-replacements-btn"
                    data-idx="${idx}"
                    style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        color: var(--primary-color);
                        font-size: 1rem;
                        padding: 0.25rem;
                    "
                >
                    <i id="expand-icon-${idx}" class="fas fa-chevron-down"></i>
                </button>
            </td>
        </tr>
    `;
}

/**
 * Render replacement suggestion row in Transfer Committee table
 * @param {Object} rep - Replacement object {player, score, priceDiff}
 * @param {Object} problemPlayer - Problem player being replaced
 * @param {number} problemIdx - Problem player index
 * @param {number} repIdx - Replacement index
 * @param {Array} next5GWs - Array of next 5 gameweek numbers
 * @param {number} gameweek - Current gameweek
 * @returns {string} HTML for replacement row
 */
export function renderReplacementRow(rep, problemPlayer, problemIdx, repIdx, next5GWs, gameweek) {
    const player = rep.player;
    const priceDiff = rep.priceDiff;
    const posType = getPositionType(player);

    // Calculate metrics
    const ppm = calculatePPM(player);
    const ownership = parseFloat(player.selected_by_percent) || 0;
    const formHeatmap = getFormHeatmap(player.form);
    const formStyle = getHeatmapStyle(formHeatmap);

    // Position-specific xGI/xGC
    let metricValue = '';
    if (posType === 'GKP' || posType === 'DEF') {
        const xGC = player.expected_goals_conceded_per_90 || 0;
        metricValue = formatDecimal(xGC);
    } else {
        const xGI = player.expected_goal_involvements_per_90 || 0;
        metricValue = formatDecimal(xGI);
    }

    // Defensive contribution per 90
    const defCon = player.github_season?.defensive_contribution_per_90 || 0;
    const defConFormatted = formatDecimal(defCon);

    // Transfer momentum
    let transferNet = '—';
    let transferColor = 'inherit';
    if (player.github_transfers) {
        const net = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
        const prefix = net > 0 ? '+' : '';
        transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
        transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
    } else if (player.transfers_in_event !== undefined && player.transfers_out_event !== undefined) {
        const net = player.transfers_in_event - player.transfers_out_event;
        const prefix = net > 0 ? '+' : '';
        transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
        transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
    }

    // Price difference styling
    const diffSign = priceDiff >= 0 ? '+' : '';
    const diffColor = priceDiff < 0 ? '#22c55e' : '#ef4444';

    // Get next 5 fixtures
    const next5Fixtures = getFixtures(player.team, 5, false);

    return `
        <tr
            id="rep-${problemIdx}-${repIdx}"
            class="replacement-row"
            data-problem="${problemIdx}"
            style="display: none; background: rgba(229, 231, 235, 0.8);"
        >
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${getPositionShort(player)}</td>
            <td style="padding: 0.75rem 0.75rem; padding-left: 2rem;">
                <span style="color: var(--text-tertiary); font-size: 0.875rem; margin-right: 0.5rem;">${repIdx + 1}.</span>
                <strong>${escapeHtml(player.web_name)}</strong>
            </td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${getTeamShortName(player.team)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; color: ${diffColor}; font-weight: 600;">${diffSign}£${Math.abs(priceDiff / 10).toFixed(1)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(ppm)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${metricValue}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${defConFormatted}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
            ${next5Fixtures.map(fix => {
                const fdrClass = getDifficultyClass(fix.difficulty);
                return `
                    <td style="padding: 0.75rem 0.5rem; text-align: center;">
                        <span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; white-space: nowrap;">
                            ${fix.opponent}
                        </span>
                    </td>
                `;
            }).join('')}
            ${next5Fixtures.length < 5 ? Array(5 - next5Fixtures.length).fill('<td style="padding: 0.75rem 0.5rem; text-align: center;">—</td>').join('') : ''}
            <td style="padding: 0.75rem 0.5rem; text-align: center;"></td>
        </tr>
    `;
}

// ============================================================================
// REPLACEMENT FINDING LOGIC
// ============================================================================

/**
 * Find replacement suggestions for a problem player
 * @param {Object} problemPlayer - The player to replace
 * @param {Object} picks - Team picks data with entry_history
 * @param {number} gameweek - Current gameweek
 * @returns {Array} Top 5 replacement suggestions {player, score, priceDiff}
 */
export function findReplacements(problemPlayer, picks, gameweek) {
    console.log(`   🔍 Finding replacements for ${problemPlayer.web_name}...`);

    const allPlayers = getAllPlayers();
    const teamValue = picks.entry_history.value || 1000;
    const bank = picks.entry_history.bank || 0;
    const maxBudget = problemPlayer.now_cost + bank;

    const myPlayerIds = new Set(picks.picks.map(p => p.element));

    // Filter candidates
    const candidates = allPlayers.filter(p => {
        return p.element_type === problemPlayer.element_type &&
               p.id !== problemPlayer.id &&
               p.now_cost <= maxBudget &&
               !myPlayerIds.has(p.id);
    });

    console.log(`   📊 Found ${candidates.length} candidates for position ${problemPlayer.element_type}`);

    // Score each candidate
    const scored = candidates.map(c => {
        const score = scoreReplacement(c);
        return {
            player: c,
            score: score,
            priceDiff: c.now_cost - problemPlayer.now_cost
        };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    const top5 = scored.slice(0, 5);
    console.log(`   ⭐ Top 5 replacements:`, top5.map(r => `${r.player.web_name} (${r.score.toFixed(0)})`));

    return top5;
}

/**
 * Score a replacement candidate
 * @param {Object} candidate - Player object to score
 * @returns {number} Composite score (0-100)
 */
function scoreReplacement(candidate) {
    let score = 0;

    // 1. Form (0-30 points)
    const form = parseFloat(candidate.form) || 0;
    score += Math.min(30, form * 5);

    // 2. Fixture Difficulty (0-25 points)
    const avgFDR = calculateFixtureDifficulty(candidate.team, 5);
    score += Math.max(0, (5 - avgFDR) * 5); // Inverted: lower FDR = higher score

    // 3. Points Per Million (0-20 points)
    const ppm = calculatePPM(candidate);
    score += Math.min(20, ppm * 10);

    // 4. Minutes Played (0-15 points)
    const minutesPct = calculateMinutesPercentage(candidate, currentGW);
    score += Math.min(15, minutesPct / 6.67);

    // 5. Transfer Trends (0-10 points)
    let netTransfers = 0;
    if (candidate.github_transfers) {
        netTransfers = candidate.github_transfers.transfers_in - candidate.github_transfers.transfers_out;
    } else if (candidate.transfers_in_event !== undefined && candidate.transfers_out_event !== undefined) {
        netTransfers = candidate.transfers_in_event - candidate.transfers_out_event;
    }
    score += Math.min(10, Math.max(0, netTransfers / 10000));

    return score;
}

// ============================================================================
// GLOBAL WINDOW FUNCTIONS
// ============================================================================

/**
 * Toggle replacement suggestions for a problem player
 */
window.toggleReplacements = function(idx) {
    const rows = document.querySelectorAll(`.replacement-row[data-problem="${idx}"]`);
    const icon = document.getElementById(`expand-icon-${idx}`);

    if (rows.length === 0) {
        console.log(`   ⚠️ No replacement rows found for problem ${idx}`);
        return;
    }

    const isHidden = rows[0].style.display === 'none';
    rows.forEach(row => {
        row.style.display = isHidden ? 'table-row' : 'none';
    });

    if (icon) {
        if (isHidden) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }
};
