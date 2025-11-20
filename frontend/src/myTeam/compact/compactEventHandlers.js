// ============================================================================
// COMPACT EVENT HANDLERS
// Event listener management for mobile compact view
// ============================================================================

import { showPlayerModal } from './playerModal.js';

/**
 * Attach click listeners to player rows
 * @param {Object} myTeamState - Optional state object for league ownership
 */
export function attachPlayerRowListeners(myTeamState = null) {
    const playerRows = document.querySelectorAll('.player-row');
    playerRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking on risk indicator
            if (e.target.closest('.risk-indicator')) {
                return;
            }
            const playerId = parseInt(row.dataset.playerId);
            if (playerId) {
                showPlayerModal(playerId, myTeamState);
            }
        });
    });
}
