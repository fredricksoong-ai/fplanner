/**
 * Plan Manager Module
 * Handles CRUD operations for transfer plans
 */

import {
    createNewPlan,
    savePlansToStorage,
    deletePlanFromStorage
} from '../teamBuilderHelpers.js';
import { teamBuilderState } from './state.js';

/**
 * Create a new transfer plan
 * @param {Function} renderCallback - Function to call after plan creation
 * @returns {Object|null} The new plan or null if cancelled
 */
export function handleNewPlan(renderCallback) {
    const currentTeamData = teamBuilderState.getTeamData();
    const allPlans = teamBuilderState.getPlans();
    const activePlan = teamBuilderState.getActivePlan();

    // Prompt for plan name
    const planName = prompt('Enter plan name:', `Plan ${String.fromCharCode(65 + allPlans.length)}`);
    if (!planName) return null;

    // Use existing plan's horizon if available, otherwise default to 3
    const horizon = activePlan ? activePlan.planningHorizon : 3;

    // Create new plan
    const newPlan = createNewPlan(planName, currentTeamData, horizon);

    // Add to state
    teamBuilderState.addPlan(newPlan);
    teamBuilderState.setActivePlanId(newPlan.id);

    // Save to storage
    savePlansToStorage(teamBuilderState.getPlans());

    // Re-render
    if (renderCallback) {
        renderCallback();
    }

    return newPlan;
}

/**
 * Save current plans to storage
 * @returns {boolean} Success status
 */
export function handleSavePlan() {
    const allPlans = teamBuilderState.getPlans();
    savePlansToStorage(allPlans);
    alert('Plan saved successfully!');
    return true;
}

/**
 * Delete the currently active plan
 * @param {Function} renderCallback - Function to call after deletion
 * @returns {boolean} Success status
 */
export function handleDeletePlan(renderCallback) {
    const allPlans = teamBuilderState.getPlans();
    const activePlanId = teamBuilderState.getActivePlanId();

    // Prevent deleting last plan
    if (allPlans.length === 1) {
        alert('Cannot delete the last plan. Create a new plan first.');
        return false;
    }

    // Confirm deletion
    const confirmed = confirm('Are you sure you want to delete this plan?');
    if (!confirmed) return false;

    // Delete from storage
    deletePlanFromStorage(activePlanId);

    // Remove from state
    teamBuilderState.removePlan(activePlanId);

    // Set active to first remaining plan
    const remainingPlans = teamBuilderState.getPlans();
    if (remainingPlans.length > 0) {
        teamBuilderState.setActivePlanId(remainingPlans[0].id);
    }

    // Re-render
    if (renderCallback) {
        renderCallback();
    }

    return true;
}

/**
 * Update active plan and save to storage
 * @param {Object} updatedPlan - The updated plan object
 * @param {Function} renderCallback - Function to call after update
 */
export function updateActivePlan(updatedPlan, renderCallback) {
    // Update in state
    teamBuilderState.updatePlan(updatedPlan);

    // Save to storage
    savePlansToStorage(teamBuilderState.getPlans());

    // Re-render
    if (renderCallback) {
        renderCallback();
    }
}

/**
 * Load plans from storage into state
 * @param {Array} plans - Plans loaded from storage
 */
export function initializePlansFromStorage(plans) {
    teamBuilderState.setPlans(plans);

    // Set first plan as active if none selected
    if (plans.length > 0 && !teamBuilderState.getActivePlanId()) {
        teamBuilderState.setActivePlanId(plans[0].id);
    }
}
