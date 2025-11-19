/**
 * Team Comparison Helpers
 * Logic for comparing two teams (head-to-head analysis)
 */

/**
 * Analyze differentials between two teams
 * @param {Array} myPlayerIds - Array of player IDs in my team
 * @param {Array} rivalPlayerIds - Array of player IDs in rival team
 * @returns {Object} Differential analysis
 */
export function analyzeDifferentials(myPlayerIds, rivalPlayerIds) {
    const myPlayerIdsSet = new Set(myPlayerIds);
    const rivalPlayerIdsSet = new Set(rivalPlayerIds);

    // Find players unique to each team
    const myDifferentials = myPlayerIds.filter(id => !rivalPlayerIdsSet.has(id));
    const rivalDifferentials = rivalPlayerIds.filter(id => !myPlayerIdsSet.has(id));
    const sharedPlayers = myPlayerIds.filter(id => rivalPlayerIdsSet.has(id));

    return {
        myDifferentials,
        rivalDifferentials,
        sharedPlayers,
        sharedCount: sharedPlayers.length,
        myDifferentialCount: myDifferentials.length,
        rivalDifferentialCount: rivalDifferentials.length
    };
}

/**
 * Compare captains between two teams
 * @param {Object} myPicks - My team picks data
 * @param {Object} rivalPicks - Rival team picks data
 * @returns {Object} Captain comparison
 */
export function compareCaptains(myPicks, rivalPicks) {
    const myCaptain = myPicks.picks.find(p => p.is_captain);
    const rivalCaptain = rivalPicks.picks.find(p => p.is_captain);

    const captainsMatch = myCaptain?.element === rivalCaptain?.element;

    return {
        myCaptain,
        rivalCaptain,
        captainsMatch,
        myCaptainId: myCaptain?.element || null,
        rivalCaptainId: rivalCaptain?.element || null
    };
}

/**
 * Extract player IDs from picks
 * @param {Object} picks - Team picks data
 * @returns {Array} Array of player IDs
 */
export function extractPlayerIds(picks) {
    return picks.picks.map(p => p.element);
}

/**
 * Calculate comparison percentages
 * @param {Object} differentialAnalysis - Result from analyzeDifferentials
 * @param {number} totalSquadSize - Total squad size (usually 15)
 * @returns {Object} Percentage breakdowns
 */
export function calculateComparisonPercentages(differentialAnalysis, totalSquadSize = 15) {
    const { sharedCount, myDifferentialCount, rivalDifferentialCount } = differentialAnalysis;

    return {
        sharedPercentage: (sharedCount / totalSquadSize) * 100,
        myDifferentialPercentage: (myDifferentialCount / totalSquadSize) * 100,
        rivalDifferentialPercentage: (rivalDifferentialCount / totalSquadSize) * 100
    };
}
