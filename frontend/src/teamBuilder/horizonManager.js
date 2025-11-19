// ============================================================================
// HORIZON MANAGER
// Handles planning horizon changes (expand/contract gameweeks)
// ============================================================================

import { teamBuilderState } from './state.js';
import { savePlansToStorage } from '../teamBuilderHelpers.js';

/**
 * Handle planning horizon change
 * @param {Event} e - Change event from horizon selector
 * @param {Function} renderCallback - Callback to re-render UI after change
 */
export function handlePlanningHorizonChange(e, renderCallback) {
    const newHorizon = parseInt(e.target.value);

    const activePlan = teamBuilderState.getActivePlan();
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

    // Update plan in state
    teamBuilderState.updatePlan(activePlan);

    // Ensure active GW is still valid
    const activeGameweek = teamBuilderState.getActiveGameweek();
    if (activeGameweek > startGW + newHorizon - 1) {
        teamBuilderState.setActiveGameweek(startGW + newHorizon - 1);
    }

    // Save to storage
    savePlansToStorage(teamBuilderState.getPlans());

    // Re-render
    if (renderCallback) {
        renderCallback();
    }
}
