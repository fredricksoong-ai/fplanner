// ============================================================================
// TEAM BUILDER PAGE MODULE
// Multi-gameweek transfer planner with validation and auto-suggestions
// ============================================================================

import { loadMyTeam, getPlayerById, getAllPlayers, currentGW } from './data.js';
import {
    getPositionShort,
    getPositionType,
    formatCurrency,
    formatDecimal,
    escapeHtml,
    calculatePPM,
    getTeamShortName,
    getDifficultyClass
} from './utils.js';
import { getFixtures } from './fixtures.js';
import { analyzePlayerRisks, hasHighRisk, renderRiskTooltip } from './risk.js';
import { attachRiskTooltipListeners } from './renderHelpers.js';
import {
    createNewPlan,
    calculateProjectedSquad,
    addTransfer,
    removeTransfer,
    validateSquad,
    setChip,
    findSuggestedTransfers,
    savePlansToStorage,
    loadPlansFromStorage,
    deletePlanFromStorage,
    getAvailableChips
} from './teamBuilderHelpers.js';

// ============================================================================
// STATE
// ============================================================================

let currentTeamData = null;
let allPlans = [];
let activePlanId = null;
let activeGameweek = null;
let planningHorizon = 3; // Default 3 GWs
let playerSearchModal = null;
let transferOutPlayerId = null; // For player selection modal

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render Team Builder page
 */
export async function renderTeamBuilder() {
    const container = document.getElementById('app-container');

    // Check if we have a cached team
    const cachedTeamId = localStorage.getItem('fplanner_team_id');

    if (!cachedTeamId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem;">
                <h2 style="color: var(--text-primary); margin-bottom: 1rem;">Team Builder</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Please load your team from the "My Team" page first.
                </p>
                <button
                    onclick="window.location.hash = '#my-team'"
                    style="
                        padding: 1rem 2rem;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                    "
                >
                    <i class="fas fa-arrow-left" style="margin-right: 0.5rem;"></i>Go to My Team
                </button>
            </div>
        `;
        return;
    }

    // Load team data
    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p>Loading Team Builder...</p>
        </div>
    `;

    try {
        currentTeamData = await loadMyTeam(cachedTeamId);

        // Load saved plans
        allPlans = loadPlansFromStorage();

        // Filter plans to match current team (in case user switched teams)
        allPlans = allPlans.filter(plan => {
            // Check if plan's snapshot matches current team structure
            return plan.currentTeamSnapshot.picks.length === 15;
        });

        // Create a default plan if none exist
        if (allPlans.length === 0) {
            const defaultPlan = createNewPlan('Plan A', currentTeamData, planningHorizon);
            allPlans.push(defaultPlan);
            savePlansToStorage(allPlans);
        }

        // Set active plan
        activePlanId = allPlans[0].id;
        activeGameweek = currentGW + 1;

        renderTeamBuilderContent();
    } catch (err) {
        console.error('Failed to load team builder:', err);
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem;">
                <h2 style="color: var(--text-primary); margin-bottom: 1rem;">Error Loading Team</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Failed to load your team. Please try again.
                </p>
                <button
                    onclick="window.location.hash = '#my-team'"
                    style="
                        padding: 1rem 2rem;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                    "
                >
                    <i class="fas fa-arrow-left" style="margin-right: 0.5rem;"></i>Go to My Team
                </button>
            </div>
        `;
    }
}

/**
 * Render main Team Builder content
 */
function renderTeamBuilderContent() {
    const container = document.getElementById('app-container');
    const activePlan = allPlans.find(p => p.id === activePlanId);

    if (!activePlan) {
        console.error('No active plan found');
        return;
    }

    const html = `
        <div class="team-builder">
            <!-- Header -->
            <div style="margin-bottom: 2rem;">
                <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 0.5rem;">
                    <i class="fas fa-chess"></i> Team Builder
                </h1>
                <p style="color: var(--text-secondary);">
                    Plan your transfers ahead with free transfer tracking and validation
                </p>
            </div>

            <!-- Team Info Card -->
            ${renderTeamInfoCard()}

            <!-- Plan Tabs -->
            ${renderPlanTabs()}

            <!-- Transfer Summary Cards -->
            ${renderTransferSummary(activePlan)}

            <!-- Planning Horizon Control -->
            ${renderPlanningHorizonControl(activePlan)}

            <!-- Gameweek Tabs -->
            ${renderGameweekTabs(activePlan)}

            <!-- Active Gameweek Content -->
            ${renderGameweekContent(activePlan, activeGameweek)}

            <!-- Projected Squad -->
            ${renderProjectedSquad(activePlan, activeGameweek)}

            <!-- Action Buttons -->
            ${renderActionButtons()}
        </div>
    `;

    container.innerHTML = html;

    // Attach event listeners
    attachEventListeners();
    attachRiskTooltipListeners();
}

// ============================================================================
// COMPONENT RENDERERS
// ============================================================================

/**
 * Render team info card
 */
function renderTeamInfoCard() {
    const team = currentTeamData.team;
    const entry = currentTeamData.picks.entry_history;

    return `
        <div style="
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
            padding: 1.5rem 2rem;
            border-radius: 12px;
            color: white;
            box-shadow: 0 4px 12px var(--shadow);
            margin-bottom: 2rem;
        ">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                <div>
                    <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.25rem;">Manager</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">${escapeHtml(team.player_first_name)} ${escapeHtml(team.player_last_name)}</div>
                    <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">${escapeHtml(team.name)}</div>
                </div>
                <div>
                    <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.25rem;">Current GW</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">GW${currentGW}</div>
                    <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">Planning from GW${currentGW + 1}</div>
                </div>
                <div>
                    <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.25rem;">Team Value</div>
                    <div style="font-size: 1.25rem; font-weight: 700;">£${(entry.value / 10).toFixed(1)}m</div>
                    <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">Bank: £${(entry.bank / 10).toFixed(1)}m</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render plan tabs
 */
function renderPlanTabs() {
    const tabs = allPlans.map(plan => {
        const isActive = plan.id === activePlanId;
        return `
            <button
                class="plan-tab"
                data-plan-id="${plan.id}"
                style="
                    padding: 0.75rem 1.5rem;
                    border: none;
                    background: ${isActive ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                    color: ${isActive ? 'white' : 'var(--text-primary)'};
                    font-weight: ${isActive ? '700' : '500'};
                    border-radius: 8px 8px 0 0;
                    cursor: pointer;
                    transition: all 0.2s;
                "
            >
                ${escapeHtml(plan.name)}
            </button>
        `;
    }).join('');

    return `
        <div style="margin-bottom: 2rem;">
            <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border-color);">
                ${tabs}
                <button
                    id="new-plan-btn"
                    style="
                        padding: 0.75rem 1.5rem;
                        border: 2px dashed var(--border-color);
                        background: transparent;
                        color: var(--text-secondary);
                        font-weight: 500;
                        border-radius: 8px 8px 0 0;
                        cursor: pointer;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-plus"></i> New Plan
                </button>
            </div>
        </div>
    `;
}

/**
 * Render transfer summary cards
 */
function renderTransferSummary(plan) {
    // Calculate totals across all gameweeks
    let totalTransfers = 0;
    let totalPointsHit = 0;
    let totalFreeTransfers = 0;

    Object.values(plan.gameweekPlans).forEach(gwPlan => {
        totalTransfers += gwPlan.transfers.length;
        totalPointsHit += gwPlan.pointsHit;
        totalFreeTransfers += gwPlan.freeTransfers;
    });

    // Get projected squad for last GW
    const lastGW = Math.max(...Object.keys(plan.gameweekPlans).map(Number));
    const projected = calculateProjectedSquad(plan, lastGW);
    const validation = validateSquad(plan, lastGW);

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <!-- Total Transfers -->
            <div style="
                background: var(--bg-primary);
                padding: 1.5rem;
                border-radius: 12px;
                border-left: 4px solid var(--primary-color);
                box-shadow: 0 2px 8px var(--shadow);
            ">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                    Planned Transfers
                </div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">
                    ${totalTransfers}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    ${totalFreeTransfers} free, ${totalTransfers - totalFreeTransfers} extra
                </div>
            </div>

            <!-- Points Hit -->
            <div style="
                background: var(--bg-primary);
                padding: 1.5rem;
                border-radius: 12px;
                border-left: 4px solid ${totalPointsHit < 0 ? '#ef4444' : '#22c55e'};
                box-shadow: 0 2px 8px var(--shadow);
            ">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                    Points Hit
                </div>
                <div style="font-size: 2rem; font-weight: 700; color: ${totalPointsHit < 0 ? '#ef4444' : 'var(--text-primary)'};">
                    ${totalPointsHit}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    ${totalPointsHit === 0 ? '✓ No hits taken' : `${Math.abs(totalPointsHit / 4)} extra transfer${Math.abs(totalPointsHit / 4) !== 1 ? 's' : ''}`}
                </div>
            </div>

            <!-- Remaining Budget -->
            <div style="
                background: var(--bg-primary);
                padding: 1.5rem;
                border-radius: 12px;
                border-left: 4px solid ${projected.bank < 0 ? '#ef4444' : '#22c55e'};
                box-shadow: 0 2px 8px var(--shadow);
            ">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                    Remaining Budget
                </div>
                <div style="font-size: 2rem; font-weight: 700; color: ${projected.bank < 0 ? '#ef4444' : 'var(--text-primary)'};">
                    £${Math.abs(projected.bank / 10).toFixed(1)}m
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    ${projected.bank < 0 ? '⚠️ Over budget!' : 'In the bank'}
                </div>
            </div>

            <!-- Validation Status -->
            <div style="
                background: var(--bg-primary);
                padding: 1.5rem;
                border-radius: 12px;
                border-left: 4px solid ${validation.valid ? '#22c55e' : '#ef4444'};
                box-shadow: 0 2px 8px var(--shadow);
            ">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                    Squad Status
                </div>
                <div style="font-size: 2rem; font-weight: 700; color: ${validation.valid ? '#22c55e' : '#ef4444'};">
                    ${validation.valid ? '✓' : '✗'}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    ${validation.valid ? 'Valid squad' : `${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''}`}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render planning horizon control
 */
function renderPlanningHorizonControl(plan) {
    return `
        <div style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
            <label style="font-weight: 600; color: var(--text-primary);">
                Planning Horizon:
            </label>
            <select
                id="planning-horizon-select"
                style="
                    padding: 0.5rem 1rem;
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    font-size: 1rem;
                    cursor: pointer;
                "
            >
                ${[3, 4, 5, 6, 7, 8].map(n => `
                    <option value="${n}" ${plan.planningHorizon === n ? 'selected' : ''}>
                        ${n} Gameweeks
                    </option>
                `).join('')}
            </select>
            <span style="color: var(--text-secondary); font-size: 0.875rem;">
                (GW${plan.startGW} to GW${plan.startGW + plan.planningHorizon - 1})
            </span>
        </div>
    `;
}

/**
 * Render gameweek tabs
 */
function renderGameweekTabs(plan) {
    const gameweeks = Object.keys(plan.gameweekPlans).sort((a, b) => a - b);

    const tabs = gameweeks.map(gw => {
        const gwNum = parseInt(gw);
        const isActive = gwNum === activeGameweek;
        const gwPlan = plan.gameweekPlans[gw];
        const transferCount = gwPlan.transfers.length;

        return `
            <button
                class="gw-tab"
                data-gw="${gwNum}"
                style="
                    padding: 0.75rem 1.5rem;
                    border: 2px solid ${isActive ? 'var(--primary-color)' : 'var(--border-color)'};
                    background: ${isActive ? 'var(--primary-color)' : 'var(--bg-primary)'};
                    color: ${isActive ? 'white' : 'var(--text-primary)'};
                    font-weight: ${isActive ? '700' : '500'};
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                "
            >
                GW${gwNum}
                ${transferCount > 0 ? `
                    <span style="
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        background: ${gwPlan.pointsHit < 0 ? '#ef4444' : '#22c55e'};
                        color: white;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.75rem;
                        font-weight: 700;
                    ">
                        ${transferCount}
                    </span>
                ` : ''}
                ${gwPlan.chipUsed ? `
                    <span style="
                        display: block;
                        font-size: 0.65rem;
                        opacity: 0.9;
                        margin-top: 2px;
                    ">
                        ${gwPlan.chipUsed.toUpperCase()}
                    </span>
                ` : ''}
            </button>
        `;
    }).join('');

    return `
        <div style="margin-bottom: 2rem;">
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${tabs}
            </div>
        </div>
    `;
}

/**
 * Render gameweek content (transfers + suggestions)
 */
function renderGameweekContent(plan, gameweek) {
    const gwPlan = plan.gameweekPlans[gameweek];
    if (!gwPlan) return '';

    const usedChips = currentTeamData.team.chips || [];
    const availableChips = getAvailableChips(currentTeamData);

    return `
        <div style="margin-bottom: 2rem;">
            <!-- Chip Selection -->
            ${renderChipSelector(plan, gameweek, availableChips, usedChips)}

            <!-- Transfer List -->
            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 2px 8px var(--shadow);
                margin-bottom: 1rem;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.125rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                        Transfers for GW${gameweek}
                    </h3>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span style="font-size: 0.875rem; color: var(--text-secondary);">
                            Free Transfers: <strong>${gwPlan.freeTransfers}</strong>
                        </span>
                        ${gwPlan.pointsHit < 0 ? `
                            <span style="font-size: 0.875rem; color: #ef4444; font-weight: 600;">
                                ${gwPlan.pointsHit} pts
                            </span>
                        ` : ''}
                    </div>
                </div>

                ${gwPlan.transfers.length === 0 ? `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-exchange-alt" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p>No transfers planned for this gameweek</p>
                    </div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${gwPlan.transfers.map((transfer, idx) => renderTransferRow(transfer, idx, gameweek)).join('')}
                    </div>
                `}

                <button
                    id="add-transfer-btn"
                    style="
                        width: 100%;
                        padding: 0.75rem;
                        margin-top: 1rem;
                        border: 2px dashed var(--border-color);
                        background: var(--bg-secondary);
                        color: var(--text-primary);
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-plus"></i> Add Transfer
                </button>
            </div>

            <!-- Auto-Suggestions -->
            ${renderAutoSuggestions(plan, gameweek)}
        </div>
    `;
}

/**
 * Render chip selector dropdown
 */
function renderChipSelector(plan, gameweek, availableChips, usedChips) {
    const gwPlan = plan.gameweekPlans[gameweek];
    const currentChip = gwPlan.chipUsed;

    return `
        <div style="margin-bottom: 1rem;">
            <label style="font-weight: 600; color: var(--text-primary); margin-right: 0.5rem;">
                Chip:
            </label>
            <select
                id="chip-select-${gameweek}"
                class="chip-select"
                data-gw="${gameweek}"
                style="
                    padding: 0.5rem 1rem;
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    cursor: pointer;
                "
            >
                <option value="">None</option>
                ${availableChips.map(chip => `
                    <option value="${chip}" ${currentChip === chip ? 'selected' : ''}>
                        ${chip.charAt(0).toUpperCase() + chip.slice(1)}
                    </option>
                `).join('')}
            </select>
            ${currentChip ? `
                <span style="margin-left: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">
                    ${currentChip === 'wildcard' || currentChip === 'freehit' ? '✓ Unlimited transfers' : ''}
                </span>
            ` : ''}
        </div>
    `;
}

/**
 * Render a single transfer row
 */
function renderTransferRow(transfer, index, gameweek) {
    const playerOut = getPlayerById(transfer.out);
    const playerIn = getPlayerById(transfer.in);

    if (!playerOut || !playerIn) return '';

    const priceDiff = playerIn.now_cost - playerOut.now_cost;
    const diffSign = priceDiff >= 0 ? '+' : '';
    const diffColor = priceDiff < 0 ? '#22c55e' : '#ef4444';

    return `
        <div style="
            display: grid;
            grid-template-columns: 1fr auto 1fr auto;
            gap: 1rem;
            align-items: center;
            padding: 1rem;
            background: var(--bg-secondary);
            border-radius: 8px;
        ">
            <!-- Player Out -->
            <div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">OUT</div>
                <div style="font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(playerOut.web_name)}
                </div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                    ${getTeamShortName(playerOut.team)} • ${formatCurrency(playerOut.now_cost)}
                </div>
            </div>

            <!-- Arrow -->
            <div>
                <i class="fas fa-arrow-right" style="color: var(--primary-color); font-size: 1.25rem;"></i>
            </div>

            <!-- Player In -->
            <div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">IN</div>
                <div style="font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(playerIn.web_name)}
                </div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                    ${getTeamShortName(playerIn.team)} • ${formatCurrency(playerIn.now_cost)}
                </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                <div style="font-size: 0.875rem; font-weight: 600; color: ${diffColor};">
                    ${diffSign}£${Math.abs(priceDiff / 10).toFixed(1)}m
                </div>
                <button
                    class="remove-transfer-btn"
                    data-gw="${gameweek}"
                    data-index="${index}"
                    style="
                        padding: 0.25rem 0.75rem;
                        background: #ef4444;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 0.75rem;
                        cursor: pointer;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
        </div>
    `;
}

/**
 * Render auto-suggestions panel
 */
function renderAutoSuggestions(plan, gameweek) {
    const suggestions = findSuggestedTransfers(plan, gameweek, 5);

    if (suggestions.length === 0) {
        return '';
    }

    const priorityColor = {
        high: '#ef4444',
        medium: '#fb923c',
        low: '#3b82f6'
    };

    return `
        <div style="
            background: var(--bg-primary);
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px var(--shadow);
            border-left: 4px solid #3b82f6;
        ">
            <h3 style="font-size: 1.125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                <i class="fas fa-lightbulb"></i> Suggested Transfers
            </h3>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${suggestions.map((sug, idx) => `
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 1rem;
                        background: var(--bg-secondary);
                        border-radius: 8px;
                        border-left: 3px solid ${priorityColor[sug.priority]};
                    ">
                        <div style="flex: 1;">
                            <div style="font-size: 0.75rem; color: ${priorityColor[sug.priority]}; font-weight: 600; text-transform: uppercase; margin-bottom: 0.25rem;">
                                ${sug.type} • ${sug.priority} priority
                            </div>
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">
                                ${escapeHtml(sug.playerOut.web_name)} → ${escapeHtml(sug.playerIn.web_name)}
                            </div>
                            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                ${sug.reason}
                            </div>
                        </div>
                        <button
                            class="apply-suggestion-btn"
                            data-out="${sug.playerOut.id}"
                            data-in="${sug.playerIn.id}"
                            data-gw="${gameweek}"
                            style="
                                padding: 0.5rem 1rem;
                                background: var(--primary-color);
                                color: white;
                                border: none;
                                border-radius: 6px;
                                font-size: 0.875rem;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.2s;
                                white-space: nowrap;
                            "
                        >
                            <i class="fas fa-check"></i> Apply
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render projected squad table
 */
function renderProjectedSquad(plan, gameweek) {
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

/**
 * Render action buttons
 */
function renderActionButtons() {
    return `
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button
                id="delete-plan-btn"
                style="
                    padding: 0.75rem 1.5rem;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                "
            >
                <i class="fas fa-trash"></i> Delete Plan
            </button>
            <button
                id="save-plan-btn"
                style="
                    padding: 0.75rem 1.5rem;
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                "
            >
                <i class="fas fa-save"></i> Save Changes
            </button>
        </div>
    `;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Attach all event listeners
 */
function attachEventListeners() {
    // Plan tabs
    document.querySelectorAll('.plan-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activePlanId = btn.dataset.planId;
            renderTeamBuilderContent();
        });
    });

    // New plan button
    const newPlanBtn = document.getElementById('new-plan-btn');
    if (newPlanBtn) {
        newPlanBtn.addEventListener('click', handleNewPlan);
    }

    // Gameweek tabs
    document.querySelectorAll('.gw-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activeGameweek = parseInt(btn.dataset.gw);
            renderTeamBuilderContent();
        });
    });

    // Add transfer button
    const addTransferBtn = document.getElementById('add-transfer-btn');
    if (addTransferBtn) {
        addTransferBtn.addEventListener('click', () => openPlayerSelectModal(null));
    }

    // Remove transfer buttons
    document.querySelectorAll('.remove-transfer-btn').forEach(btn => {
        btn.addEventListener('click', handleRemoveTransfer);
    });

    // Apply suggestion buttons
    document.querySelectorAll('.apply-suggestion-btn').forEach(btn => {
        btn.addEventListener('click', handleApplySuggestion);
    });

    // Chip selectors
    document.querySelectorAll('.chip-select').forEach(select => {
        select.addEventListener('change', handleChipChange);
    });

    // Planning horizon select
    const horizonSelect = document.getElementById('planning-horizon-select');
    if (horizonSelect) {
        horizonSelect.addEventListener('change', handlePlanningHorizonChange);
    }

    // Save plan button
    const savePlanBtn = document.getElementById('save-plan-btn');
    if (savePlanBtn) {
        savePlanBtn.addEventListener('click', handleSavePlan);
    }

    // Delete plan button
    const deletePlanBtn = document.getElementById('delete-plan-btn');
    if (deletePlanBtn) {
        deletePlanBtn.addEventListener('click', handleDeletePlan);
    }
}

/**
 * Handle new plan creation
 */
function handleNewPlan() {
    const planName = prompt('Enter plan name:', `Plan ${String.fromCharCode(65 + allPlans.length)}`);
    if (!planName) return;

    const activePlan = allPlans.find(p => p.id === activePlanId);
    const horizon = activePlan ? activePlan.planningHorizon : 3;

    const newPlan = createNewPlan(planName, currentTeamData, horizon);
    allPlans.push(newPlan);
    activePlanId = newPlan.id;

    savePlansToStorage(allPlans);
    renderTeamBuilderContent();
}

/**
 * Handle remove transfer
 */
function handleRemoveTransfer(e) {
    const btn = e.currentTarget;
    const gw = parseInt(btn.dataset.gw);
    const index = parseInt(btn.dataset.index);

    const activePlan = allPlans.find(p => p.id === activePlanId);
    if (!activePlan) return;

    const updatedPlan = removeTransfer(activePlan, gw, index);

    // Update plan in array
    const planIndex = allPlans.findIndex(p => p.id === activePlanId);
    allPlans[planIndex] = updatedPlan;

    savePlansToStorage(allPlans);
    renderTeamBuilderContent();
}

/**
 * Handle apply suggestion
 */
function handleApplySuggestion(e) {
    const btn = e.currentTarget;
    const playerOutId = parseInt(btn.dataset.out);
    const playerInId = parseInt(btn.dataset.in);
    const gw = parseInt(btn.dataset.gw);

    const activePlan = allPlans.find(p => p.id === activePlanId);
    if (!activePlan) return;

    const result = addTransfer(activePlan, gw, playerOutId, playerInId);

    if (result.success) {
        // Update plan in array
        const planIndex = allPlans.findIndex(p => p.id === activePlanId);
        allPlans[planIndex] = result.updatedPlan;

        savePlansToStorage(allPlans);
        renderTeamBuilderContent();
    } else {
        alert(`Failed to add transfer: ${result.error}`);
    }
}

/**
 * Handle chip change
 */
function handleChipChange(e) {
    const select = e.currentTarget;
    const gw = parseInt(select.dataset.gw);
    const chipName = select.value || null;

    const activePlan = allPlans.find(p => p.id === activePlanId);
    if (!activePlan) return;

    const usedChips = currentTeamData.team.chips || [];
    const result = setChip(activePlan, gw, chipName, usedChips);

    if (result.success) {
        // Update plan in array
        const planIndex = allPlans.findIndex(p => p.id === activePlanId);
        allPlans[planIndex] = result.updatedPlan;

        savePlansToStorage(allPlans);
        renderTeamBuilderContent();
    } else {
        alert(`Failed to set chip: ${result.error}`);
        select.value = activePlan.gameweekPlans[gw].chipUsed || '';
    }
}

/**
 * Handle planning horizon change
 */
function handlePlanningHorizonChange(e) {
    const newHorizon = parseInt(e.target.value);

    const activePlan = allPlans.find(p => p.id === activePlanId);
    if (!activePlan) return;

    // Update plan horizon
    const startGW = activePlan.startGW;
    const oldHorizon = activePlan.planningHorizon;

    // Add new GWs if expanding
    if (newHorizon > oldHorizon) {
        for (let i = oldHorizon; i < newHorizon; i++) {
            const gw = startGW + i;
            activePlan.gameweekPlans[gw] = {
                transfers: [],
                freeTransfers: 0,
                pointsHit: 0,
                chipUsed: null
            };
        }
    }
    // Remove GWs if contracting
    else if (newHorizon < oldHorizon) {
        for (let i = newHorizon; i < oldHorizon; i++) {
            const gw = startGW + i;
            delete activePlan.gameweekPlans[gw];
        }
    }

    activePlan.planningHorizon = newHorizon;
    activePlan.modified = new Date().toISOString();

    // Update plan in array
    const planIndex = allPlans.findIndex(p => p.id === activePlanId);
    allPlans[planIndex] = activePlan;

    // Ensure active GW is still valid
    if (activeGameweek > startGW + newHorizon - 1) {
        activeGameweek = startGW + newHorizon - 1;
    }

    savePlansToStorage(allPlans);
    renderTeamBuilderContent();
}

/**
 * Handle save plan
 */
function handleSavePlan() {
    savePlansToStorage(allPlans);
    alert('Plan saved successfully!');
}

/**
 * Handle delete plan
 */
function handleDeletePlan() {
    if (allPlans.length === 1) {
        alert('Cannot delete the last plan. Create a new plan first.');
        return;
    }

    const confirmed = confirm('Are you sure you want to delete this plan?');
    if (!confirmed) return;

    deletePlanFromStorage(activePlanId);
    allPlans = allPlans.filter(p => p.id !== activePlanId);

    activePlanId = allPlans[0].id;

    renderTeamBuilderContent();
}

/**
 * Open player selection modal
 * @param {number|null} playerOutId - If null, show all squad players to select from
 */
function openPlayerSelectModal(playerOutId) {
    transferOutPlayerId = playerOutId;

    // Show modal with player search
    const activePlan = allPlans.find(p => p.id === activePlanId);
    if (!activePlan) return;

    const { squad, bank } = calculateProjectedSquad(activePlan, activeGameweek - 1);

    // If no player selected yet, show squad to pick from
    if (!playerOutId) {
        showSquadSelectionModal(squad);
    } else {
        // Show replacement options
        const playerOut = getPlayerById(playerOutId);
        if (!playerOut) return;

        showReplacementSelectionModal(playerOut, squad, bank);
    }
}

/**
 * Show squad selection modal (pick player to transfer out)
 */
function showSquadSelectionModal(squad) {
    const modalHtml = `
        <div id="player-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        ">
            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 2rem;
                max-width: 800px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                        Select Player to Transfer Out
                    </h3>
                    <button
                        id="close-modal-btn"
                        style="
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            color: var(--text-secondary);
                            cursor: pointer;
                        "
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div style="display: grid; gap: 0.5rem;">
                    ${squad.map(pick => {
                        const player = getPlayerById(pick.element);
                        if (!player) return '';

                        return `
                            <button
                                class="select-player-out-btn"
                                data-player-id="${player.id}"
                                style="
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    padding: 1rem;
                                    background: var(--bg-secondary);
                                    border: 2px solid var(--border-color);
                                    border-radius: 8px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    text-align: left;
                                "
                            >
                                <div>
                                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">
                                        ${escapeHtml(player.web_name)}
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                        ${getPositionShort(player)} • ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Form: ${formatDecimal(player.form)}</div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">PPM: ${formatDecimal(calculatePPM(player))}</div>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Attach event listeners
    document.getElementById('close-modal-btn').addEventListener('click', closePlayerModal);
    document.querySelectorAll('.select-player-out-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = parseInt(btn.dataset.playerId);
            closePlayerModal();
            openPlayerSelectModal(playerId);
        });

        btn.addEventListener('mouseenter', e => {
            e.currentTarget.style.borderColor = 'var(--primary-color)';
        });
        btn.addEventListener('mouseleave', e => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
        });
    });
}

/**
 * Show replacement selection modal (pick player to transfer in)
 */
function showReplacementSelectionModal(playerOut, squad, bank) {
    const allPlayers = getAllPlayers();
    const maxBudget = playerOut.now_cost + bank;
    const squadPlayerIds = new Set(squad.map(p => p.element));

    // Filter candidates
    const candidates = allPlayers.filter(p => {
        return p.element_type === playerOut.element_type &&
               p.id !== playerOut.id &&
               p.now_cost <= maxBudget &&
               !squadPlayerIds.has(p.id);
    });

    // Sort by PPM
    candidates.sort((a, b) => calculatePPM(b) - calculatePPM(a));

    const modalHtml = `
        <div id="player-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        ">
            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 2rem;
                max-width: 900px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div>
                        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">
                            Select Replacement for ${escapeHtml(playerOut.web_name)}
                        </h3>
                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">
                            Budget: £${(maxBudget / 10).toFixed(1)}m • ${candidates.length} options
                        </p>
                    </div>
                    <button
                        id="close-modal-btn"
                        style="
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            color: var(--text-secondary);
                            cursor: pointer;
                        "
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div style="margin-bottom: 1rem;">
                    <input
                        type="text"
                        id="player-search-input"
                        placeholder="Search players..."
                        style="
                            width: 100%;
                            padding: 0.75rem;
                            border: 2px solid var(--border-color);
                            border-radius: 8px;
                            background: var(--bg-secondary);
                            color: var(--text-primary);
                            font-size: 1rem;
                        "
                    >
                </div>

                <div id="player-list" style="display: grid; gap: 0.5rem; max-height: 400px; overflow-y: auto;">
                    ${candidates.slice(0, 50).map(player => {
                        const priceDiff = player.now_cost - playerOut.now_cost;
                        const diffSign = priceDiff >= 0 ? '+' : '';
                        const diffColor = priceDiff < 0 ? '#22c55e' : '#ef4444';

                        return `
                            <button
                                class="select-player-in-btn"
                                data-player-id="${player.id}"
                                data-search="${escapeHtml(player.web_name).toLowerCase()}"
                                style="
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    padding: 1rem;
                                    background: var(--bg-secondary);
                                    border: 2px solid var(--border-color);
                                    border-radius: 8px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    text-align: left;
                                "
                            >
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">
                                        ${escapeHtml(player.web_name)}
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                        ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)} • Form: ${formatDecimal(player.form)}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.875rem; font-weight: 600; color: ${diffColor}; margin-bottom: 0.25rem;">
                                        ${diffSign}£${Math.abs(priceDiff / 10).toFixed(1)}m
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                        PPM: ${formatDecimal(calculatePPM(player))}
                                    </div>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Attach event listeners
    document.getElementById('close-modal-btn').addEventListener('click', closePlayerModal);

    // Search functionality
    const searchInput = document.getElementById('player-search-input');
    searchInput.addEventListener('input', e => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.select-player-in-btn').forEach(btn => {
            const searchText = btn.dataset.search;
            btn.style.display = searchText.includes(query) ? 'flex' : 'none';
        });
    });

    // Select player in
    document.querySelectorAll('.select-player-in-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerInId = parseInt(btn.dataset.playerId);
            handleConfirmTransfer(transferOutPlayerId, playerInId);
        });

        btn.addEventListener('mouseenter', e => {
            e.currentTarget.style.borderColor = 'var(--primary-color)';
        });
        btn.addEventListener('mouseleave', e => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
        });
    });
}

/**
 * Handle confirm transfer
 */
function handleConfirmTransfer(playerOutId, playerInId) {
    const activePlan = allPlans.find(p => p.id === activePlanId);
    if (!activePlan) return;

    const result = addTransfer(activePlan, activeGameweek, playerOutId, playerInId);

    if (result.success) {
        // Update plan in array
        const planIndex = allPlans.findIndex(p => p.id === activePlanId);
        allPlans[planIndex] = result.updatedPlan;

        savePlansToStorage(allPlans);
        closePlayerModal();
        renderTeamBuilderContent();
    } else {
        alert(`Failed to add transfer: ${result.error}`);
    }
}

/**
 * Close player modal
 */
function closePlayerModal() {
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.remove();
    }
    transferOutPlayerId = null;
}
