/**
 * Team Builder State Management
 * Centralized state for transfer planning
 */

/**
 * Team Builder application state
 */
class TeamBuilderState {
    constructor() {
        this.currentTeamData = null;
        this.allPlans = [];
        this.activePlanId = null;
        this.activeGameweek = null;
        this.planningHorizon = 3; // Default 3 GWs
        this.playerSearchModal = null;
        this.transferOutPlayerId = null; // For player selection modal
    }

    /**
     * Set current team data
     * @param {Object} teamData - Team data from API
     */
    setTeamData(teamData) {
        this.currentTeamData = teamData;
    }

    /**
     * Get current team data
     * @returns {Object|null}
     */
    getTeamData() {
        return this.currentTeamData;
    }

    /**
     * Set all plans
     * @param {Array} plans - Array of transfer plans
     */
    setPlans(plans) {
        this.allPlans = plans;
    }

    /**
     * Get all plans
     * @returns {Array}
     */
    getPlans() {
        return this.allPlans;
    }

    /**
     * Add a new plan
     * @param {Object} plan - New plan to add
     */
    addPlan(plan) {
        this.allPlans.push(plan);
    }

    /**
     * Update an existing plan
     * @param {Object} updatedPlan - Updated plan
     */
    updatePlan(updatedPlan) {
        const index = this.allPlans.findIndex(p => p.id === updatedPlan.id);
        if (index !== -1) {
            this.allPlans[index] = updatedPlan;
        }
    }

    /**
     * Remove a plan by ID
     * @param {string} planId - Plan ID to remove
     */
    removePlan(planId) {
        this.allPlans = this.allPlans.filter(p => p.id !== planId);
    }

    /**
     * Get active plan
     * @returns {Object|null}
     */
    getActivePlan() {
        return this.allPlans.find(p => p.id === this.activePlanId) || null;
    }

    /**
     * Set active plan ID
     * @param {string|null} planId - Plan ID to activate
     */
    setActivePlanId(planId) {
        this.activePlanId = planId;

        // Reset active gameweek to first GW when switching plans
        if (planId) {
            const plan = this.getActivePlan();
            if (plan && plan.gameweeks && plan.gameweeks.length > 0) {
                this.activeGameweek = plan.currentGW;
            }
        }
    }

    /**
     * Get active plan ID
     * @returns {string|null}
     */
    getActivePlanId() {
        return this.activePlanId;
    }

    /**
     * Set active gameweek
     * @param {number|null} gameweek - Gameweek number
     */
    setActiveGameweek(gameweek) {
        this.activeGameweek = gameweek;
    }

    /**
     * Get active gameweek
     * @returns {number|null}
     */
    getActiveGameweek() {
        return this.activeGameweek;
    }

    /**
     * Set planning horizon
     * @param {number} horizon - Number of gameweeks to plan
     */
    setPlanningHorizon(horizon) {
        this.planningHorizon = horizon;
    }

    /**
     * Get planning horizon
     * @returns {number}
     */
    getPlanningHorizon() {
        return this.planningHorizon;
    }

    /**
     * Set transfer out player ID (for modal)
     * @param {number|null} playerId - Player ID
     */
    setTransferOutPlayerId(playerId) {
        this.transferOutPlayerId = playerId;
    }

    /**
     * Get transfer out player ID
     * @returns {number|null}
     */
    getTransferOutPlayerId() {
        return this.transferOutPlayerId;
    }

    /**
     * Set player search modal reference
     * @param {HTMLElement|null} modal - Modal element
     */
    setPlayerSearchModal(modal) {
        this.playerSearchModal = modal;
    }

    /**
     * Get player search modal reference
     * @returns {HTMLElement|null}
     */
    getPlayerSearchModal() {
        return this.playerSearchModal;
    }

    /**
     * Reset all state
     */
    reset() {
        this.currentTeamData = null;
        this.allPlans = [];
        this.activePlanId = null;
        this.activeGameweek = null;
        this.planningHorizon = 3;
        this.playerSearchModal = null;
        this.transferOutPlayerId = null;
    }
}

// Export singleton instance
export const teamBuilderState = new TeamBuilderState();
