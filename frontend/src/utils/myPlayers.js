import { sharedState } from '../sharedState.js';

/**
 * Build a Set of player IDs currently in the user's squad.
 * Sources sharedState first, then falls back to localStorage cache.
 */
export function getMyPlayerIdSet() {
    const ids = new Set();

    const sharedPicks = sharedState?.myTeamData?.picks?.picks;
    if (Array.isArray(sharedPicks) && sharedPicks.length > 0) {
        sharedPicks.forEach(pick => ids.add(pick.element));
        return ids;
    }

    if (typeof window === 'undefined' || !window.localStorage) {
        return ids;
    }

    const cachedTeamId = window.localStorage.getItem('fplanner_team_id');
    if (!cachedTeamId) {
        return ids;
    }

    const cachedTeamData = window.localStorage.getItem(`fplanner_team_${cachedTeamId}`);
    if (!cachedTeamData) {
        return ids;
    }

    try {
        const parsed = JSON.parse(cachedTeamData);
        const picks = parsed?.picks?.picks;
        if (Array.isArray(picks)) {
            picks.forEach(pick => ids.add(pick.element));
        }
    } catch (err) {
        console.warn('Unable to parse cached team data for ownership lookup', err);
    }

    return ids;
}

