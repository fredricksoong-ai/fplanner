/**
 * Transfer Manager Module
 * Handles transfer operations and player selection
 */

import { addTransfer, removeTransfer, calculateProjectedSquad } from '../teamBuilderHelpers.js';
import { teamBuilderState } from './state.js';
import { updateActivePlan } from './planManager.js';

/**
 * Handle removing a transfer from the plan
 * @param {Event} e - Click event from remove button
 * @param {Function} renderCallback - Function to call after removal
 */
export function handleRemoveTransfer(e, renderCallback) {
    const btn = e.currentTarget;
    const gw = parseInt(btn.dataset.gw);
    const index = parseInt(btn.dataset.index);

    const activePlan = teamBuilderState.getActivePlan();
    if (!activePlan) return;

    const result = removeTransfer(activePlan, gw, index);

    if (result.success) {
        // Update plan in state
        updateActivePlan(result.updatedPlan, renderCallback);
    } else {
        alert(`Failed to remove transfer: ${result.error}`);
    }
}

/**
 * Handle confirming a transfer (player out -> player in)
 * @param {number} playerOutId - Player being transferred out
 * @param {number} playerInId - Player being transferred in
 * @param {Function} renderCallback - Function to call after transfer
 */
export function handleConfirmTransfer(playerOutId, playerInId, renderCallback) {
    const activePlan = teamBuilderState.getActivePlan();
    const activeGameweek = teamBuilderState.getActiveGameweek();

    if (!activePlan) {
        alert('No active plan selected');
        return;
    }

    const result = addTransfer(activePlan, activeGameweek, playerOutId, playerInId);

    if (result.success) {
        // Update plan in state and save
        updateActivePlan(result.updatedPlan, () => {
            closePlayerModal();
            if (renderCallback) {
                renderCallback();
            }
        });
    } else {
        alert(`Failed to add transfer: ${result.error}`);
    }
}

/**
 * Open player selection modal
 * @param {number|null} playerOutId - Player to transfer out (null to select from squad first)
 * @param {Function} showSquadCallback - Callback to show squad selection modal
 * @param {Function} showReplacementCallback - Callback to show replacement modal
 */
export function openPlayerSelectModal(playerOutId, showSquadCallback, showReplacementCallback) {
    const activePlan = teamBuilderState.getActivePlan();
    const activeGameweek = teamBuilderState.getActiveGameweek();

    if (!activePlan) {
        alert('No active plan selected');
        return;
    }

    // Store the player out ID in state
    teamBuilderState.setTransferOutPlayerId(playerOutId);

    // Calculate projected squad for the previous gameweek
    const { squad, bank } = calculateProjectedSquad(activePlan, activeGameweek - 1);

    // If no player selected yet, show squad to pick from
    if (!playerOutId) {
        showSquadCallback(squad);
    } else {
        // Show replacement options
        const playerOut = squad.find(p => p.element === playerOutId);
        if (!playerOut) {
            alert('Player not found in projected squad');
            return;
        }
        showReplacementCallback(playerOut, squad, bank);
    }
}

/**
 * Close the player selection modal
 */
export function closePlayerModal() {
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.remove();
    }
    teamBuilderState.setTransferOutPlayerId(null);
}

/**
 * Get the current transfer out player ID
 * @returns {number|null}
 */
export function getTransferOutPlayerId() {
    return teamBuilderState.getTransferOutPlayerId();
}
