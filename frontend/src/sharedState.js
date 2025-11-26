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
    leagueMetricsCache: new Map(), // key(leagueId+gw) -> aggregated metrics
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
        this.leagueMetricsCache.clear();
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
            leagueMetricsCache: this.leagueMetricsCache,
            rivalTeamCache: this.rivalTeamCache,
            captainCache: this.captainCache
        };
    },

    /**
     * Persist freshly loaded team data so other pages (Planner, Stats, etc.)
     * can reuse it without reloading from the API.
     * @param {Object} teamData
     */
    updateTeamData(teamData) {
        if (!teamData || !teamData.team) {
            return;
        }

        this.myTeamData = teamData;

        const rawId = teamData.team.id ?? teamData.team.entry ?? teamData.team.entry_id;
        if (!rawId) {
            return;
        }

        const numericId = parseInt(rawId, 10);
        this.teamId = Number.isNaN(numericId) ? rawId : numericId;

        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        try {
            window.localStorage.setItem('fplanner_team_id', String(rawId));
            window.localStorage.setItem(`fplanner_team_${rawId}`, JSON.stringify(teamData));
        } catch (err) {
            console.warn('Failed to cache team data for reuse', err);
        }
    }
};
