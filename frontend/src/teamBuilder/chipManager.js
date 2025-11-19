/**
 * Chip Manager Module
 * Handles chip selection and management
 */

import { setChip, getAvailableChips } from '../teamBuilderHelpers.js';
import { teamBuilderState } from './state.js';
import { updateActivePlan } from './planManager.js';

/**
 * Handle chip selection change
 * @param {Event} e - Change event from chip select dropdown
 * @param {Function} renderCallback - Function to call after chip change
 */
export function handleChipChange(e, renderCallback) {
    const select = e.currentTarget;
    const gw = parseInt(select.dataset.gw);
    const chipName = select.value || null;

    const activePlan = teamBuilderState.getActivePlan();
    const currentTeamData = teamBuilderState.getTeamData();

    if (!activePlan) {
        alert('No active plan selected');
        return;
    }

    if (!currentTeamData) {
        alert('Team data not loaded');
        return;
    }

    // Get used chips from current team
    const usedChips = currentTeamData.team?.chips || [];

    // Attempt to set the chip
    const result = setChip(activePlan, gw, chipName, usedChips);

    if (result.success) {
        // Update plan in state
        updateActivePlan(result.updatedPlan, renderCallback);
    } else {
        // Revert selection on error
        alert(`Failed to set chip: ${result.error}`);

        // Find the gameweek and restore previous chip value
        const gameweekData = activePlan.gameweeks.find(g => g.gw === gw);
        if (gameweekData) {
            select.value = gameweekData.chip || '';
        }
    }
}

/**
 * Get available chips for the current team
 * @returns {Array} Array of available chip objects
 */
export function getTeamAvailableChips() {
    const currentTeamData = teamBuilderState.getTeamData();

    if (!currentTeamData) {
        return [];
    }

    return getAvailableChips(currentTeamData);
}

/**
 * Get used chips from current team data
 * @returns {Array} Array of used chip names
 */
export function getUsedChips() {
    const currentTeamData = teamBuilderState.getTeamData();

    if (!currentTeamData || !currentTeamData.team) {
        return [];
    }

    return currentTeamData.team.chips || [];
}

/**
 * Check if a chip is available for use
 * @param {string} chipName - Name of the chip
 * @param {Object} plan - Transfer plan
 * @returns {boolean} True if chip can be used
 */
export function isChipAvailable(chipName, plan) {
    const usedChips = getUsedChips();

    // Check if chip already used by team
    if (usedChips.includes(chipName)) {
        return false;
    }

    // Check if chip already used in plan
    const chipUsedInPlan = plan.gameweeks.some(gw => gw.chip === chipName);
    if (chipUsedInPlan) {
        return false;
    }

    return true;
}
