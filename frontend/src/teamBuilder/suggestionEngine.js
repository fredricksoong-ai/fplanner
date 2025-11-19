/**
 * Suggestion Engine Module
 * Handles auto-suggestions for transfers
 */

import { addTransfer, findSuggestedTransfers } from '../teamBuilderHelpers.js';
import { teamBuilderState } from './state.js';
import { updateActivePlan } from './planManager.js';

/**
 * Load suggestions for a gameweek (lazy-loaded on demand)
 * @param {Event} e - Click event from load suggestions button
 * @param {Function} renderSuggestionsCallback - Callback to render suggestions HTML
 */
export function handleLoadSuggestions(e, renderSuggestionsCallback) {
    const btn = e.currentTarget;
    const gw = parseInt(btn.dataset.gw);

    // Show loading state
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    btn.disabled = true;

    // Small delay to show loading state
    setTimeout(() => {
        const activePlan = teamBuilderState.getActivePlan();
        if (!activePlan) return;

        const suggestionsContent = document.getElementById(`suggestions-content-${gw}`);
        if (suggestionsContent) {
            // Call the render callback to get suggestions HTML
            const suggestionsHTML = renderSuggestionsCallback(activePlan, gw);
            suggestionsContent.innerHTML = suggestionsHTML;
            suggestionsContent.style.display = 'block';
        }

        // Hide the button after loading
        btn.style.display = 'none';

        // Re-attach event listeners for apply buttons
        document.querySelectorAll('.apply-suggestion-btn').forEach(applyBtn => {
            applyBtn.addEventListener('click', (e) => handleApplySuggestion(e, null));
        });
    }, 100);
}

/**
 * Apply a suggested transfer
 * @param {Event} e - Click event from apply suggestion button
 * @param {Function} renderCallback - Function to call after applying suggestion
 */
export function handleApplySuggestion(e, renderCallback) {
    const btn = e.currentTarget;
    const playerOutId = parseInt(btn.dataset.out);
    const playerInId = parseInt(btn.dataset.in);
    const gw = parseInt(btn.dataset.gw);

    const activePlan = teamBuilderState.getActivePlan();
    if (!activePlan) {
        alert('No active plan selected');
        return;
    }

    const result = addTransfer(activePlan, gw, playerOutId, playerInId);

    if (result.success) {
        // Update plan in state
        updateActivePlan(result.updatedPlan, renderCallback);
    } else {
        alert(`Failed to apply suggestion: ${result.error}`);
    }
}

/**
 * Generate suggestions for a gameweek
 * @param {Object} plan - Transfer plan
 * @param {number} gameweek - Gameweek number
 * @param {number} maxSuggestions - Maximum number of suggestions (default 5)
 * @returns {Array} Array of suggested transfers
 */
export function generateSuggestions(plan, gameweek, maxSuggestions = 5) {
    return findSuggestedTransfers(plan, gameweek, maxSuggestions);
}
