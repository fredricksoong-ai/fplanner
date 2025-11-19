// ============================================================================
// DISPLAY RENDERERS
// Team Builder info/display components (read-only rendering)
// ============================================================================

import { currentGW } from '../data.js';
import { escapeHtml } from '../utils.js';
import { teamBuilderState } from './state.js';
import { calculateProjectedSquad, validateSquad } from '../teamBuilderHelpers.js';

/**
 * Render team info card with manager details and current stats
 */
export function renderTeamInfoCard() {
    const currentTeamData = teamBuilderState.getTeamData();
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
 * Render plan tabs with active state
 */
export function renderPlanTabs() {
    const allPlans = teamBuilderState.getPlans();
    const activePlanId = teamBuilderState.getActivePlanId();

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
 * Render transfer summary cards showing totals and validation status
 */
export function renderTransferSummary(plan) {
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
 * Render planning horizon selector
 */
export function renderPlanningHorizonControl(plan) {
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
 * Render gameweek tabs with transfer counts and chip badges
 */
export function renderGameweekTabs(plan, activeGameweek) {
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
 * Render action buttons (save/delete plan)
 */
export function renderActionButtons(plan) {
    const allPlans = teamBuilderState.getPlans();
    const canDelete = allPlans.length > 1;

    return `
        <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
            <button
                id="save-plan-btn"
                style="
                    padding: 0.75rem 2rem;
                    border: none;
                    background: var(--primary-color);
                    color: white;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                "
            >
                <i class="fas fa-save"></i> Save Plan
            </button>
            <button
                id="delete-plan-btn"
                ${!canDelete ? 'disabled' : ''}
                style="
                    padding: 0.75rem 2rem;
                    border: 2px solid #ef4444;
                    background: transparent;
                    color: #ef4444;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: ${canDelete ? 'pointer' : 'not-allowed'};
                    opacity: ${canDelete ? '1' : '0.5'};
                    transition: all 0.2s;
                "
            >
                <i class="fas fa-trash"></i> Delete Plan
            </button>
        </div>
    `;
}
