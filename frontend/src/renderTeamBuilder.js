// ============================================================================
// TEAM BUILDER PAGE MODULE
// Multi-gameweek transfer planner with validation and auto-suggestions
// ============================================================================

import { loadMyTeam, currentGW } from './data.js';
import { attachRiskTooltipListeners } from './renderHelpers.js';
import { loadPlansFromStorage } from './teamBuilderHelpers.js';

// Team Builder modules - State & Logic
import { teamBuilderState } from './teamBuilder/state.js';
import {
    handleNewPlan,
    handleSavePlan,
    handleDeletePlan,
    initializePlansFromStorage
} from './teamBuilder/planManager.js';
import {
    handleRemoveTransfer,
    openPlayerSelectModal
} from './teamBuilder/transferManager.js';
import {
    handleLoadSuggestions,
    handleApplySuggestion
} from './teamBuilder/suggestionEngine.js';
import { handleChipChange } from './teamBuilder/chipManager.js';

// Team Builder modules - Renderers
import {
    renderTeamInfoCard,
    renderPlanTabs,
    renderTransferSummary,
    renderPlanningHorizonControl,
    renderGameweekTabs,
    renderActionButtons
} from './teamBuilder/displayRenderers.js';
import {
    renderGameweekContent,
    renderAutoSuggestions
} from './teamBuilder/transferRenderers.js';
import { renderProjectedSquad } from './teamBuilder/squadRenderers.js';

// Team Builder modules - Modals & Horizon
import {
    showSquadSelectionModal,
    showReplacementSelectionModal
} from './teamBuilder/playerModals.js';
import { handlePlanningHorizonChange } from './teamBuilder/horizonManager.js';

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
        const currentTeamData = await loadMyTeam(cachedTeamId);

        // Initialize state with team data
        teamBuilderState.setTeamData(currentTeamData);

        // Load saved plans from storage
        const loadedPlans = loadPlansFromStorage();

        // Filter plans to match current team (in case user switched teams)
        const validPlans = loadedPlans.filter(plan => {
            // Check if plan's snapshot matches current team structure
            return plan.currentTeamSnapshot.picks.length === 15;
        });

        // Initialize plans in state using the planManager module
        initializePlansFromStorage(validPlans);

        // Create a default plan if none exist
        if (validPlans.length === 0) {
            handleNewPlan(renderTeamBuilderContent);
        } else {
            // Set active gameweek
            teamBuilderState.setActiveGameweek(currentGW + 1);
        }

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

// Export for use in playerModals.js
export function renderTeamBuilderContent() {
    const container = document.getElementById('app-container');
    const activePlan = teamBuilderState.getActivePlan();
    const activeGameweek = teamBuilderState.getActiveGameweek();

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
            ${renderGameweekTabs(activePlan, activeGameweek)}

            <!-- Active Gameweek Content -->
            ${renderGameweekContent(activePlan, activeGameweek)}

            <!-- Projected Squad -->
            ${renderProjectedSquad(activePlan, activeGameweek)}

            <!-- Action Buttons -->
            ${renderActionButtons(activePlan)}
        </div>
    `;

    container.innerHTML = html;

    // Attach event listeners
    attachEventListeners();
    attachRiskTooltipListeners();
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
            teamBuilderState.setActivePlanId(btn.dataset.planId);
            renderTeamBuilderContent();
        });
    });

    // New plan button
    const newPlanBtn = document.getElementById('new-plan-btn');
    if (newPlanBtn) {
        newPlanBtn.addEventListener('click', () => {
            handleNewPlan(renderTeamBuilderContent);
        });
    }

    // Gameweek tabs
    document.querySelectorAll('.gw-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            teamBuilderState.setActiveGameweek(parseInt(btn.dataset.gw));
            renderTeamBuilderContent();
        });
    });

    // Add transfer button
    const addTransferBtn = document.getElementById('add-transfer-btn');
    if (addTransferBtn) {
        addTransferBtn.addEventListener('click', () => {
            openPlayerSelectModal(null, showSquadSelectionModal, showReplacementSelectionModal);
        });
    }

    // Remove transfer buttons
    document.querySelectorAll('.remove-transfer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleRemoveTransfer(e, renderTeamBuilderContent);
        });
    });

    // Load suggestions buttons (lazy-load)
    document.querySelectorAll('.load-suggestions-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleLoadSuggestions(e, renderAutoSuggestions);
        });
    });

    // Apply suggestion buttons
    document.querySelectorAll('.apply-suggestion-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleApplySuggestion(e, renderTeamBuilderContent);
        });
    });

    // Chip selectors
    document.querySelectorAll('.chip-select').forEach(select => {
        select.addEventListener('change', (e) => {
            handleChipChange(e, renderTeamBuilderContent);
        });
    });

    // Planning horizon select
    const horizonSelect = document.getElementById('planning-horizon-select');
    if (horizonSelect) {
        horizonSelect.addEventListener('change', (e) => {
            handlePlanningHorizonChange(e, renderTeamBuilderContent);
        });
    }

    // Save plan button
    const savePlanBtn = document.getElementById('save-plan-btn');
    if (savePlanBtn) {
        savePlanBtn.addEventListener('click', () => {
            handleSavePlan();
        });
    }

    // Delete plan button
    const deletePlanBtn = document.getElementById('delete-plan-btn');
    if (deletePlanBtn) {
        deletePlanBtn.addEventListener('click', () => {
            handleDeletePlan(renderTeamBuilderContent);
        });
    }
}
