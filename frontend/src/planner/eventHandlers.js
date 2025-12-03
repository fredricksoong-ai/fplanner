/**
 * Planner Event Handlers
 * Centralized event handlers for planner interactions
 */

import { plannerState } from './state.js';
import { renderPlanner } from '../renderPlanner.js';
import { showPlayerModal, closePlayerModal } from '../myTeam/compact/playerModal.js';
import { sharedState } from '../sharedState.js';

/**
 * Handle player click - navigate to replacement page
 * @param {number} playerId - Player ID clicked
 */
export function handlePlayerClick(playerId) {
    closePlayerModal();
    window.location.hash = `#planner/replace/${playerId}`;
}

/**
 * Handle replacement selection - apply swap
 * @param {number} playerOutId - Player being removed
 * @param {number} playerInId - Player being added
 */
export function handleReplacementSelect(playerOutId, playerInId) {
    // Add change to state
    plannerState.addChange(playerOutId, playerInId);
    
    // Navigate back to planner
    window.location.hash = '#planner';
    
    // Re-render planner to show changes
    setTimeout(() => {
        renderPlanner();
    }, 100);
}

/**
 * Handle individual player reset
 * @param {number} playerId - Player ID to reset
 */
export function handlePlayerReset(playerId) {
    plannerState.removeChange(playerId);
    renderPlanner();
}

/**
 * Handle global reset - clear all changes
 */
export function handleGlobalReset() {
    plannerState.resetAll();
    renderPlanner();
}

/**
 * Attach event listeners for replacement page
 */
export function attachReplacementPageListeners() {
    // Back button
    const backBtn = document.getElementById('replacement-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.hash = '#planner';
        });
    }

    // Replacement player rows
    const replacementRows = document.querySelectorAll('.replacement-player-row');
    replacementRows.forEach(row => {
        row.addEventListener('click', () => {
            const playerInId = parseInt(row.dataset.playerId);
            const playerOutId = parseInt(row.dataset.originalId);
            handleReplacementSelect(playerOutId, playerInId);
        });
    });
}

/**
 * Attach event listeners for planner page
 */
export function attachPlannerListeners() {
    const playerRows = document.querySelectorAll('.planner-player-row');
    const wishlistRows = document.querySelectorAll('.planner-wishlist-row');
    const guillotineRows = document.querySelectorAll('.planner-guillotine-row');
    const myTeamState = sharedState.getTeamState();

    playerRows.forEach(row => {
        const playerId = parseInt(row.dataset.playerId);
        if (!playerId) {
            return;
        }
        row.style.cursor = 'pointer';
        row.addEventListener('click', (e) => {
            if (e.target.closest('.player-reset-btn')) {
                return;
            }
            showPlayerModal(playerId, myTeamState, {
                primaryAction: {
                    label: 'Replace',
                    color: 'var(--accent-color)',
                    onClick: () => handlePlayerClick(playerId)
                }
            });
        });
    });

    wishlistRows.forEach(row => {
        const playerId = parseInt(row.dataset.playerId);
        if (!playerId) return;
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            showPlayerModal(playerId, myTeamState);
        });
    });

    guillotineRows.forEach(row => {
        const playerId = parseInt(row.dataset.playerId);
        if (!playerId) return;
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            showPlayerModal(playerId, myTeamState, {
                primaryAction: {
                    label: 'Replace',
                    color: 'var(--accent-color)',
                    onClick: () => handlePlayerClick(playerId)
                }
            });
        });
    });

    // Individual player reset buttons
    const resetButtons = document.querySelectorAll('.player-reset-btn');
    resetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const playerId = parseInt(btn.dataset.playerId);
            handlePlayerReset(playerId);
        });
    });

    // Global reset button
    const resetAllBtn = document.getElementById('planner-reset-all-btn');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', () => {
            handleGlobalReset();
        });
    }
}

