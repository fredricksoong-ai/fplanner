// ============================================================================
// PLANNER PAGE MODULE
// Mobile-focused planning tool for FPL managers
// ============================================================================

import {
    loadMyTeam,
    getPlayerById,
    getAllPlayers,
    getActiveGW,
    currentGW,
    fplBootstrap
} from './data.js';

import { analyzePlayerRisks, hasHighRisk, hasMediumRisk } from './risk.js';
import { getFixtures, calculateFixtureDifficulty } from './fixtures.js';
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
} from './utils.js';

// Planner modules
import { sharedState } from './sharedState.js';
import { plannerState } from './planner/state.js';
import { calculateTeamMetrics, calculateProjectedTeamMetrics } from './planner/metrics.js';
import { renderMetricIndicators } from './planner/indicators.js';
import { renderCostSummary, getCurrentCostSummary } from './planner/costCalculator.js';
import { attachPlannerListeners } from './planner/eventHandlers.js';
import { getLeagueComparisonMetrics } from './planner/leagueComparison.js';

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render the Planner page
 */
export async function renderPlanner() {
    const container = document.getElementById('app-container');
    const teamId = localStorage.getItem('fplanner_team_id');

    if (!teamId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 1rem; color: #ef4444;"></i>
                <p>No team ID configured</p>
                <button
                    onclick="window.navigateToPage('my-team')"
                    style="
                        margin-top: 1rem;
                        padding: 0.5rem 1rem;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                    "
                >
                    <i class="fas fa-arrow-left"></i> Go to Team
                </button>
            </div>
        `;
        return;
    }

    // Show loading
    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p>Loading planner...</p>
        </div>
    `;

    try {
        const teamData = await loadMyTeam(teamId);
        sharedState.updateTeamData(teamData);
        const numericTeamId = parseInt(teamId, 10);
        if (!Number.isNaN(numericTeamId)) {
            sharedState.teamId = numericTeamId;
        }
        const gwNumber = currentGW; // Use currentGW (last finished) to match getFixtures()

        // Get player data
        const picks = teamData.picks.picks || [];
        const myPlayers = picks.map(pick => {
            const player = getPlayerById(pick.element);
            return { ...player, pick };
        }).filter(p => p.id);

        // Initialize planner state with original team data
        const bank = teamData.picks.entry_history?.bank || 0;
        const value = teamData.picks.entry_history?.value || 1000;
        plannerState.initialize(myPlayers, picks, bank, value);

        // Get current squad (with changes applied)
        const currentSquad = plannerState.getCurrentSquad();
        const currentPlayers = currentSquad.map(pick => {
            const player = getPlayerById(pick.element);
            return player ? { ...player, pick } : null;
        }).filter(p => p !== null);

        // Identify players with risks and categorize by severity (use current players)
        const riskPlayerMap = new Map(); // playerId -> {risks, highestSeverity}
        let highCount = 0, mediumCount = 0, lowCount = 0;

        currentPlayers.forEach(player => {
            const risks = analyzePlayerRisks(player);
            if (risks.length > 0) {
                // Determine highest severity
                const hasHigh = risks.some(r => r.severity === 'high');
                const hasMedium = risks.some(r => r.severity === 'medium');
                const highestSeverity = hasHigh ? 'high' : (hasMedium ? 'medium' : 'low');

                riskPlayerMap.set(player.id, { risks, highestSeverity });

                // Count by severity
                if (hasHigh) highCount++;
                else if (hasMedium) mediumCount++;
                else lowCount++;
            }
        });

        // Calculate metrics
        const originalMetrics = calculateTeamMetrics(picks, gwNumber);
        const changes = plannerState.getChanges();
        const projectedMetrics = calculateProjectedTeamMetrics(picks, changes, gwNumber);
        
        const costSummary = getCurrentCostSummary();

        // Build page HTML
        let leagueComparison = null;
        try {
            leagueComparison = await getLeagueComparisonMetrics(numericTeamId, projectedMetrics, gwNumber);
        } catch (err) {
            console.warn('Planner league comparison unavailable:', err.message || err);
        }

        const html = `
            <div style="padding: 0.5rem;">
                ${renderPlannerHeader(gwNumber, highCount, mediumCount, lowCount)}
                ${renderMetricIndicators(originalMetrics, projectedMetrics, leagueComparison)}
                ${renderCostSummary(costSummary)}
                ${renderUnifiedFixtureTable(currentPlayers, riskPlayerMap, teamData.picks, gwNumber)}
            </div>
        `;

        container.innerHTML = html;
        
        // Attach event listeners (new modular handlers)
        attachPlannerListeners();
        
        // Attach old expandable replacement listeners (for backward compatibility)

    } catch (err) {
        console.error('Failed to load planner:', err);
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; color: #ef4444;"></i>
                <p>Failed to load planner data</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem;">${err.message}</p>
            </div>
        `;
    }
}

// ============================================================================
// HEADER
// ============================================================================

function renderPlannerHeader(gwNumber, highCount, mediumCount, lowCount) {
    const totalIssues = highCount + mediumCount + lowCount;

    return `
        <div style="
            position: sticky;
            top: calc(3.5rem + env(safe-area-inset-top));
            background: var(--bg-primary);
            z-index: 100;
            padding: 0.5rem 0;
            border-bottom: 2px solid var(--border-color);
            margin-bottom: 0.5rem;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                        <i class="fas fa-calendar-check" style="margin-right: 0.5rem; color: var(--accent-color);"></i>
                        Planner
                    </h1>
                    <p style="font-size: 0.7rem; color: var(--text-secondary); margin: 0.2rem 0 0 0;">
                        GW ${gwNumber + 1} → GW ${gwNumber + 5}
                        ${totalIssues > 0 ? `
                            <span style="margin-left: 0.5rem;">
                                ${highCount > 0 ? `<span style="color: #ef4444;">🔴 ${highCount}</span>` : ''}
                                ${mediumCount > 0 ? `<span style="color: #fb923c; margin-left: 0.3rem;">🟠 ${mediumCount}</span>` : ''}
                                ${lowCount > 0 ? `<span style="color: #eab308; margin-left: 0.3rem;">🟡 ${lowCount}</span>` : ''}
                            </span>
                        ` : ''}
                    </p>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// UNIFIED FIXTURE TABLE
// ============================================================================

function renderUnifiedFixtureTable(myPlayers, riskPlayerMap, picks, gwNumber) {
    const next5GWs = [gwNumber + 1, gwNumber + 2, gwNumber + 3, gwNumber + 4, gwNumber + 5];

    // Sort by position then by fixture difficulty
    const sortedPlayers = [...myPlayers].sort((a, b) => {
        if (a.element_type !== b.element_type) return a.element_type - b.element_type;
        const aFDR = calculateFixtureDifficulty(a.team, 5);
        const bFDR = calculateFixtureDifficulty(b.team, 5);
        return aFDR - bFDR;
    });

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
                            ${next5GWs.map(gw => `<th style="text-align: center; padding: 0.5rem; min-width: 60px;">GW${gw}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedPlayers.map((player, idx) => {
                            const riskData = riskPlayerMap.get(player.id);
                            const hasRisk = !!riskData;
                            const risks = riskData?.risks || [];
                            const severity = riskData?.highestSeverity || null;

                            // Determine border color based on severity
                            let borderColor = '';
                            if (severity === 'high') borderColor = '#ef4444';
                            else if (severity === 'medium') borderColor = '#fb923c';
                            else if (severity === 'low') borderColor = '#eab308';

                            const next5Fixtures = getFixtures(player.team, 5, false);
                            const avgFDR = calculateFixtureDifficulty(player.team, 5);
                            const formHeatmap = getFormHeatmap(player.form);
                            const formStyle = getHeatmapStyle(formHeatmap);
                            const rowBg = idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)';
                            const fdrColor = avgFDR <= 2.5 ? '#22c55e' : avgFDR <= 3.5 ? '#eab308' : '#ef4444';

                            // Check if player has been modified
                            const isModified = plannerState.isPlayerModified(player.id);
                            const modifiedStyle = isModified ? 'border: 2px solid var(--primary-color);' : '';
                            
                            return `
                                <tr class="planner-player-row" style="background: ${rowBg}; ${hasRisk ? `border-left: 4px solid ${borderColor};` : ''} ${modifiedStyle}" data-player-id="${player.id}">
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
                                            ${isModified ? `
                                                <button
                                                    class="player-reset-btn"
                                                    data-player-id="${player.id}"
                                                    style="
                                                        background: var(--bg-tertiary);
                                                        border: none;
                                                        cursor: pointer;
                                                        color: var(--text-primary);
                                                        padding: 0.15rem 0.3rem;
                                                        margin-left: 0.3rem;
                                                        border-radius: 4px;
                                                        font-size: 0.6rem;
                                                    "
                                                    title="Reset this change"
                                                >
                                                    ↻
                                                </button>
                                            ` : ''}
                                        </div>
                                        ${hasRisk ? `<div style="font-size: 0.6rem; color: ${borderColor}; margin-top: 0.1rem;">${risks[0]?.message || 'Issue'}</div>` : ''}
                                        ${isModified ? `<div style="font-size: 0.6rem; color: var(--primary-color); margin-top: 0.1rem;">Modified</div>` : ''}
                                    </td>
                                    <td style="text-align: center; padding: 0.5rem; color: ${fdrColor}; font-weight: 700;">
                                        ${avgFDR.toFixed(1)}
                                    </td>
                                    <td style="text-align: center; padding: 0.5rem; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                                        ${formatDecimal(player.form)}
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

// ============================================================================
// OLD SECTIONS (KEPT FOR REFERENCE - CAN BE REMOVED)
// ============================================================================

function renderProblemPlayersSection_OLD(myPlayers, picks, gwNumber) {
    // Find problem players
    const problemPlayers = [];
    myPlayers.forEach(player => {
        const risks = analyzePlayerRisks(player);
        if (hasHighRisk(risks) || hasMediumRisk(risks)) {
            problemPlayers.push({ player, risks });
        }
    });

    if (problemPlayers.length === 0) {
        return `
            <div style="
                background: var(--bg-secondary);
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 0.5rem;
                border-left: 3px solid #22c55e;
            ">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-check-circle" style="color: #22c55e;"></i>
                    <span style="font-size: 0.85rem; color: var(--text-primary); font-weight: 600;">No problem players</span>
                </div>
            </div>
        `;
    }

    const next5GWs = [gwNumber + 1, gwNumber + 2, gwNumber + 3, gwNumber + 4, gwNumber + 5];

    return `
        <div style="
            background: var(--bg-secondary);
            border-radius: 8px;
            margin-bottom: 0.5rem;
            border-left: 3px solid #fb923c;
        ">
            <div
                id="planner-problems-header"
                style="
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                "
            >
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-exclamation-triangle" style="color: #fb923c;"></i>
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">
                        Problem Players (${problemPlayers.length})
                    </span>
                </div>
                <i id="planner-problems-chevron" class="fas fa-chevron-down" style="font-size: 0.7rem; color: var(--text-secondary);"></i>
            </div>
            <div id="planner-problems-content" style="display: none;">
                ${renderProblemPlayersTable(problemPlayers, picks, next5GWs, gwNumber)}
            </div>
        </div>
    `;
}

function renderProblemPlayersTable(problemPlayers, picks, next5GWs, gwNumber) {
    let html = `
        <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
            <table style="width: 100%; font-size: 0.75rem; border-collapse: collapse;">
                <thead style="background: var(--bg-tertiary);">
                    <tr>
                        <th style="position: sticky; left: 0; background: var(--bg-tertiary); z-index: 10; text-align: left; padding: 0.5rem; min-width: 140px;">Player</th>
                        <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Issue</th>
                        <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Form</th>
                        ${next5GWs.map(gw => `<th style="text-align: center; padding: 0.5rem; min-width: 60px;">GW${gw}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    problemPlayers.forEach(({ player, risks }, idx) => {
        const next5Fixtures = getFixtures(player.team, 5, false);
        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);
        const primaryRisk = risks[0];
        const rowBg = idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)';

        html += `
            <tr style="background: ${rowBg};" data-problem-idx="${idx}">
                <td style="
                    position: sticky;
                    left: 0;
                    background: ${rowBg};
                    z-index: 5;
                    padding: 0.5rem;
                    border-right: 1px solid var(--border-color);
                ">
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                        <span style="font-size: 0.65rem; color: var(--text-secondary);">${getPositionShort(player)}</span>
                        <strong style="font-size: 0.75rem;">${escapeHtml(player.web_name)}</strong>
                    </div>
                    <div style="font-size: 0.6rem; color: var(--text-secondary);">
                        ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)}
                    </div>
                </td>
                <td style="text-align: center; padding: 0.5rem;">
                    <span title="${primaryRisk.details}" style="cursor: help;">
                        ${primaryRisk.icon}
                    </span>
                </td>
                <td style="text-align: center; padding: 0.5rem; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                    ${formatDecimal(player.form)}
                </td>
                ${next5Fixtures.map(fix => {
                    const fdrClass = getDifficultyClass(fix.difficulty);
                    return `
                        <td style="text-align: center; padding: 0.5rem;">
                            <span class="${fdrClass}" style="padding: 0.2rem 0.3rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; white-space: nowrap;">
                                ${fix.opponent}
                            </span>
                        </td>
                    `;
                }).join('')}
                ${next5Fixtures.length < 5 ? Array(5 - next5Fixtures.length).fill('<td style="text-align: center; padding: 0.5rem;">—</td>').join('') : ''}
            </tr>
            <tr id="problem-replacements-${idx}" style="display: none;">
                <td colspan="${7}" style="padding: 0; background: var(--bg-tertiary);">
                    <div id="problem-replacements-content-${idx}" style="padding: 0.5rem;">
                        <div style="text-align: center; color: var(--text-secondary); font-size: 0.7rem;">
                            Loading replacements...
                        </div>
                    </div>
                </td>
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
// FIXTURE TICKER
// ============================================================================

function renderFixtureTicker(myPlayers, gwNumber) {
    const next5GWs = [gwNumber + 1, gwNumber + 2, gwNumber + 3, gwNumber + 4, gwNumber + 5];

    // Sort by position then by fixture difficulty
    const sortedPlayers = [...myPlayers].sort((a, b) => {
        if (a.element_type !== b.element_type) return a.element_type - b.element_type;
        const aFDR = calculateFixtureDifficulty(a.team, 5);
        const bFDR = calculateFixtureDifficulty(b.team, 5);
        return aFDR - bFDR;
    });

    return `
        <div style="
            background: var(--bg-secondary);
            border-radius: 8px;
            margin-bottom: 0.5rem;
            border-left: 3px solid var(--primary-color);
        ">
            <div
                id="planner-ticker-header"
                style="
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                "
            >
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-calendar-alt" style="color: var(--primary-color);"></i>
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">
                        Fixture Ticker
                    </span>
                </div>
                <i id="planner-ticker-chevron" class="fas fa-chevron-down" style="font-size: 0.7rem; color: var(--text-secondary);"></i>
            </div>
            <div id="planner-ticker-content" style="display: none;">
                <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    <table style="width: 100%; font-size: 0.75rem; border-collapse: collapse;">
                        <thead style="background: var(--bg-tertiary);">
                            <tr>
                                <th style="position: sticky; left: 0; background: var(--bg-tertiary); z-index: 10; text-align: left; padding: 0.5rem; min-width: 140px;">Player</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">FDR</th>
                                ${next5GWs.map(gw => `<th style="text-align: center; padding: 0.5rem; min-width: 60px;">GW${gw}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedPlayers.map((player, idx) => {
                                const next5Fixtures = getFixtures(player.team, 5, false);
                                const avgFDR = calculateFixtureDifficulty(player.team, 5);
                                const rowBg = idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)';
                                const fdrColor = avgFDR <= 2.5 ? '#22c55e' : avgFDR <= 3.5 ? '#eab308' : '#ef4444';

                                return `
                                    <tr style="background: ${rowBg};">
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
                                        </td>
                                        <td style="text-align: center; padding: 0.5rem; color: ${fdrColor}; font-weight: 700;">
                                            ${avgFDR.toFixed(1)}
                                        </td>
                                        ${next5Fixtures.map(fix => {
                                            const fdrClass = getDifficultyClass(fix.difficulty);
                                            return `
                                                <td style="text-align: center; padding: 0.5rem;">
                                                    <span class="${fdrClass}" style="padding: 0.2rem 0.3rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; white-space: nowrap;">
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
        </div>
    `;
}

// ============================================================================
// TRANSFER TARGETS
// ============================================================================

function renderTransferTargets(myPlayers, picks, gwNumber) {
    const allPlayers = getAllPlayers();
    const myPlayerIds = new Set(myPlayers.map(p => p.id));
    const bank = picks.entry_history.bank || 0;

    // Find top transfer targets by position
    const targets = {
        2: [], // DEF
        3: [], // MID
        4: []  // FWD
    };

    allPlayers.forEach(player => {
        if (myPlayerIds.has(player.id)) return;
        if (player.element_type < 2) return; // Skip GKs for now

        const form = parseFloat(player.form) || 0;
        const avgFDR = calculateFixtureDifficulty(player.team, 5);
        const ppm = calculatePPM(player);

        // Score based on form, fixtures, and value
        const score = (form * 5) + ((5 - avgFDR) * 4) + (ppm * 3);

        if (form >= 3 && avgFDR <= 3) {
            targets[player.element_type].push({ player, score, avgFDR });
        }
    });

    // Sort and take top 3 per position
    Object.keys(targets).forEach(pos => {
        targets[pos].sort((a, b) => b.score - a.score);
        targets[pos] = targets[pos].slice(0, 3);
    });

    const allTargets = [...targets[2], ...targets[3], ...targets[4]];

    if (allTargets.length === 0) {
        return `
            <div style="
                background: var(--bg-secondary);
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 0.5rem;
                border-left: 3px solid #3b82f6;
            ">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-search" style="color: #3b82f6;"></i>
                    <span style="font-size: 0.85rem; color: var(--text-primary);">No strong transfer targets found</span>
                </div>
            </div>
        `;
    }

    const next5GWs = [gwNumber + 1, gwNumber + 2, gwNumber + 3, gwNumber + 4, gwNumber + 5];

    return `
        <div style="
            background: var(--bg-secondary);
            border-radius: 8px;
            margin-bottom: 0.5rem;
            border-left: 3px solid #3b82f6;
        ">
            <div
                id="planner-targets-header"
                style="
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                "
            >
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-bullseye" style="color: #3b82f6;"></i>
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">
                        Transfer Targets (${allTargets.length})
                    </span>
                </div>
                <i id="planner-targets-chevron" class="fas fa-chevron-down" style="font-size: 0.7rem; color: var(--text-secondary);"></i>
            </div>
            <div id="planner-targets-content" style="display: none;">
                <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    <table style="width: 100%; font-size: 0.75rem; border-collapse: collapse;">
                        <thead style="background: var(--bg-tertiary);">
                            <tr>
                                <th style="position: sticky; left: 0; background: var(--bg-tertiary); z-index: 10; text-align: left; padding: 0.5rem; min-width: 140px;">Player</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">Form</th>
                                <th style="text-align: center; padding: 0.5rem; min-width: 60px;">FDR</th>
                                ${next5GWs.map(gw => `<th style="text-align: center; padding: 0.5rem; min-width: 60px;">GW${gw}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${allTargets.map(({ player, avgFDR }, idx) => {
                                const next5Fixtures = getFixtures(player.team, 5, false);
                                const formHeatmap = getFormHeatmap(player.form);
                                const formStyle = getHeatmapStyle(formHeatmap);
                                const rowBg = idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)';
                                const fdrColor = avgFDR <= 2.5 ? '#22c55e' : avgFDR <= 3.5 ? '#eab308' : '#ef4444';
                                const ownership = parseFloat(player.selected_by_percent) || 0;

                                return `
                                    <tr style="background: ${rowBg};">
                                        <td style="
                                            position: sticky;
                                            left: 0;
                                            background: ${rowBg};
                                            z-index: 5;
                                            padding: 0.5rem;
                                            border-right: 1px solid var(--border-color);
                                        ">
                                            <div style="display: flex; align-items: center; gap: 0.3rem;">
                                                <span style="font-size: 0.65rem; color: var(--text-secondary);">${getPositionShort(player)}</span>
                                                <strong style="font-size: 0.75rem;">${escapeHtml(player.web_name)}</strong>
                                            </div>
                                            <div style="font-size: 0.6rem; color: var(--text-secondary);">
                                                ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)} • ${ownership.toFixed(0)}%
                                            </div>
                                        </td>
                                        <td style="text-align: center; padding: 0.5rem; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                                            ${formatDecimal(player.form)}
                                        </td>
                                        <td style="text-align: center; padding: 0.5rem; color: ${fdrColor}; font-weight: 700;">
                                            ${avgFDR.toFixed(1)}
                                        </td>
                                        ${next5Fixtures.map(fix => {
                                            const fdrClass = getDifficultyClass(fix.difficulty);
                                            return `
                                                <td style="text-align: center; padding: 0.5rem;">
                                                    <span class="${fdrClass}" style="padding: 0.2rem 0.3rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; white-space: nowrap;">
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
        </div>
    `;
}

