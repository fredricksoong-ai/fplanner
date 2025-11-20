// ============================================================================
// SHARED STATE MODULE
// Global state that persists across page navigation
// ============================================================================

/**
 * Shared state object for cross-page data sharing
 * This allows caches populated on one page to be available on others
 */
export const sharedState = {
    // Team ID
    teamId: null,

    // League data
    activeLeagueTab: null,
    leagueStandingsCache: new Map(), // leagueId -> standings data
    rivalTeamCache: new Map(), // entryId -> team data
    captainCache: new Map(), // entryId -> captain name

    // My team data
    myTeamData: null,

    /**
     * Reset all caches (e.g., when switching teams)
     */
    reset() {
        this.teamId = null;
        this.activeLeagueTab = null;
        this.leagueStandingsCache.clear();
        this.rivalTeamCache.clear();
        this.captainCache.clear();
        this.myTeamData = null;
    },

    /**
     * Get state object compatible with myTeamState interface
     * Used by player modal and other components
     */
    getTeamState() {
        return {
            teamId: this.teamId,
            activeLeagueTab: this.activeLeagueTab,
            leagueStandingsCache: this.leagueStandingsCache,
            rivalTeamCache: this.rivalTeamCache,
            captainCache: this.captainCache
        };
    }
};
