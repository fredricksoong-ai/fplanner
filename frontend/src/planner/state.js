/**
 * Planner State Management
 * In-memory state for sandbox team changes (no persistence)
 */

/**
 * Planner state object
 */
class PlannerState {
    constructor() {
        this.initialSquad = null; // Original team snapshot (for AI insights)
        this.initialPicks = null; // Original picks data
        this.changes = []; // Array of {out: playerId, in: playerId, timestamp}
        this.initialBank = 0; // Original bank balance
        this.initialValue = 0; // Original team value
        this.teamSignature = null;
    }

    /**
     * Initialize state with original team data
     * @param {Array} picks - Original team picks
     * @param {number} bank - Original bank balance
     * @param {number} value - Original team value
     */
    initialize(initialSquad, picks, bank, value) {
        const newSignature = this.createTeamSignature(picks);

        // Only initialize if state is empty or the underlying team changed
        if (this.teamSignature && this.teamSignature === newSignature) {
            return;
        }

        this.initialSquad = initialSquad.map(p => ({ ...p })); // Deep copy
        this.initialPicks = picks.map(p => ({ ...p })); // Deep copy
        this.initialBank = bank;
        this.initialValue = value;
        this.changes = [];
        this.teamSignature = newSignature;
    }

    /**
     * Create signature for a squad (used to detect changes)
     */
    createTeamSignature(picks) {
        if (!picks || picks.length === 0) return null;
        const sorted = picks
            .map(pick => pick.element)
            .sort((a, b) => a - b);
        return sorted.join('-');
    }

    /**
     * Check if planner state has been initialized
     */
    isInitialized() {
        return Array.isArray(this.initialPicks) && this.initialPicks.length > 0;
    }

    /**
     * Get initial squad (for AI insights)
     * @returns {Array} Original squad
     */
    getInitialSquad() {
        return this.initialSquad;
    }

    /**
     * Get initial picks
     * @returns {Array} Original picks
     */
    getInitialPicks() {
        return this.initialPicks;
    }

    /**
     * Get all changes made
     * @returns {Array} Changes array
     */
    getChanges() {
        return this.changes;
    }

    /**
     * Add a change (swap player out for player in)
     * @param {number} playerOutId - Player being removed
     * @param {number} playerInId - Player being added
     */
    addChange(playerOutId, playerInId) {
        // Remove any existing change for this player out
        this.changes = this.changes.filter(c => c.out !== playerOutId);
        
        // Add new change
        this.changes.push({
            out: playerOutId,
            in: playerInId,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Remove a specific change
     * @param {number} playerOutId - Player ID to reset
     */
    removeChange(playerOutId) {
        this.changes = this.changes.filter(c => c.out !== playerOutId);
    }

    /**
     * Get change for a specific player
     * @param {number} playerId - Player ID
     * @returns {Object|null} Change object or null
     */
    getChangeForPlayer(playerId) {
        return this.changes.find(c => c.out === playerId) || null;
    }

    /**
     * Check if a player has been modified
     * @param {number} playerId - Player ID
     * @returns {boolean} True if modified
     */
    isPlayerModified(playerId) {
        return this.changes.some(c => c.out === playerId);
    }

    /**
     * Get current squad (with changes applied)
     * @returns {Array} Current squad picks
     */
    getCurrentSquad() {
        if (!this.initialPicks) return [];
        
        const currentSquad = this.initialPicks.map(pick => ({ ...pick }));
        
        // Apply changes
        this.changes.forEach(change => {
            const outIndex = currentSquad.findIndex(p => p.element === change.out);
            if (outIndex >= 0) {
                // Replace player
                currentSquad[outIndex] = {
                    ...currentSquad[outIndex],
                    element: change.in
                };
            }
        });
        
        return currentSquad;
    }

    /**
     * Reset all changes
     */
    resetAll() {
        this.changes = [];
    }

    /**
     * Reset state completely
     */
    clear() {
        this.initialSquad = null;
        this.initialPicks = null;
        this.changes = [];
        this.initialBank = 0;
        this.initialValue = 0;
    }

    /**
     * Get initial bank balance
     * @returns {number} Bank balance
     */
    getInitialBank() {
        return this.initialBank;
    }

    /**
     * Get initial team value
     * @returns {number} Team value
     */
    getInitialValue() {
        return this.initialValue;
    }
}

// Export singleton instance
export const plannerState = new PlannerState();

