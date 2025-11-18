/**
 * Tests for extracted My Team helper modules
 * Testing the modular functions that were extracted from renderMyTeam.js
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
    calculateBenchPoints,
    calculateSquadAverages,
    classifyFixtureDifficulty,
    classifyRiskLevel,
    classifyMinutesPercentage,
    classifyOwnership,
    classifyBenchPoints
} from '../../src/myTeam/teamSummaryHelpers.js';

import {
    analyzeDifferentials,
    compareCaptains,
    extractPlayerIds,
    calculateComparisonPercentages
} from '../../src/myTeam/teamComparisonHelpers.js';

// ============================================================================
// TEAM SUMMARY HELPERS TESTS
// ============================================================================

describe('teamSummaryHelpers - classifyFixtureDifficulty', () => {
    test('should classify as excellent for FDR <= 2.5', () => {
        const result = classifyFixtureDifficulty(2.3);

        expect(result.severity).toBe('excellent');
        expect(result.color).toBe('#22c55e');
        expect(result.label).toContain('Excellent');
    });

    test('should classify as average for FDR between 2.5 and 3.5', () => {
        const result = classifyFixtureDifficulty(3.0);

        expect(result.severity).toBe('average');
        expect(result.color).toBe('#fb923c');
        expect(result.label).toBe('Average fixtures');
    });

    test('should classify as tough for FDR > 3.5', () => {
        const result = classifyFixtureDifficulty(4.0);

        expect(result.severity).toBe('tough');
        expect(result.color).toBe('#ef4444');
        expect(result.label).toContain('Tough');
    });

    test('should handle boundary values correctly', () => {
        expect(classifyFixtureDifficulty(2.5).severity).toBe('excellent');
        expect(classifyFixtureDifficulty(2.51).severity).toBe('average');
        expect(classifyFixtureDifficulty(3.5).severity).toBe('average');
        expect(classifyFixtureDifficulty(3.51).severity).toBe('tough');
    });
});

describe('teamSummaryHelpers - classifyRiskLevel', () => {
    test('should classify as stable when count is 0', () => {
        const result = classifyRiskLevel(0);

        expect(result.severity).toBe('stable');
        expect(result.color).toBe('#22c55e');
        expect(result.label).toContain('stable');
    });

    test('should classify as monitor when count is 1-2', () => {
        const result1 = classifyRiskLevel(1);
        const result2 = classifyRiskLevel(2);

        expect(result1.severity).toBe('monitor');
        expect(result2.severity).toBe('monitor');
        expect(result1.label).toContain('Monitor');
    });

    test('should classify as action when count > 2', () => {
        const result = classifyRiskLevel(3);

        expect(result.severity).toBe('action');
        expect(result.color).toBe('#ef4444');
        expect(result.label).toContain('Action');
    });
});

describe('teamSummaryHelpers - classifyMinutesPercentage', () => {
    test('should classify as regular for >= 70%', () => {
        const result = classifyMinutesPercentage(75);

        expect(result.severity).toBe('regular');
        expect(result.color).toBe('#22c55e');
        expect(result.label).toContain('Regular');
    });

    test('should classify as mixed for 50-70%', () => {
        const result = classifyMinutesPercentage(60);

        expect(result.severity).toBe('mixed');
        expect(result.color).toBe('#fb923c');
        expect(result.label).toBe('Mixed rotation');
    });

    test('should classify as high-rotation for < 50%', () => {
        const result = classifyMinutesPercentage(40);

        expect(result.severity).toBe('high-rotation');
        expect(result.color).toBe('#ef4444');
        expect(result.label).toContain('rotation risk');
    });
});

describe('teamSummaryHelpers - classifyOwnership', () => {
    test('should classify as template for > 50%', () => {
        const result = classifyOwnership(55);

        expect(result.isTemplate).toBe(true);
        expect(result.label).toBe('Template heavy');
    });

    test('should classify as differential for <= 50%', () => {
        const result = classifyOwnership(45);

        expect(result.isTemplate).toBe(false);
        expect(result.label).toBe('Differential picks');
    });

    test('should handle boundary (50%) as differential', () => {
        const result = classifyOwnership(50);

        expect(result.isTemplate).toBe(false);
    });
});

describe('teamSummaryHelpers - classifyBenchPoints', () => {
    test('should show warning for points > 0', () => {
        const result = classifyBenchPoints(8);

        expect(result.hasWarning).toBe(true);
        expect(result.color).toBe('#ef4444');
        expect(result.label).toContain('wasted');
    });

    test('should show no warning for 0 points', () => {
        const result = classifyBenchPoints(0);

        expect(result.hasWarning).toBe(false);
        expect(result.color).toBe('#22c55e');
        expect(result.label).toContain('No wasted');
    });
});

// ============================================================================
// TEAM COMPARISON HELPERS TESTS
// ============================================================================

describe('teamComparisonHelpers - analyzeDifferentials', () => {
    test('should correctly identify all differential categories', () => {
        const myPlayerIds = [1, 2, 3, 4, 5];
        const rivalPlayerIds = [3, 4, 5, 6, 7];

        const result = analyzeDifferentials(myPlayerIds, rivalPlayerIds);

        expect(result.myDifferentials).toEqual([1, 2]);
        expect(result.rivalDifferentials).toEqual([6, 7]);
        expect(result.sharedPlayers).toEqual([3, 4, 5]);
        expect(result.sharedCount).toBe(3);
        expect(result.myDifferentialCount).toBe(2);
        expect(result.rivalDifferentialCount).toBe(2);
    });

    test('should handle teams with no shared players', () => {
        const myPlayerIds = [1, 2, 3];
        const rivalPlayerIds = [4, 5, 6];

        const result = analyzeDifferentials(myPlayerIds, rivalPlayerIds);

        expect(result.sharedPlayers).toEqual([]);
        expect(result.sharedCount).toBe(0);
        expect(result.myDifferentialCount).toBe(3);
        expect(result.rivalDifferentialCount).toBe(3);
    });

    test('should handle identical teams', () => {
        const playerIds = [1, 2, 3, 4, 5];

        const result = analyzeDifferentials(playerIds, playerIds);

        expect(result.sharedPlayers).toEqual(playerIds);
        expect(result.myDifferentials).toEqual([]);
        expect(result.rivalDifferentials).toEqual([]);
    });
});

describe('teamComparisonHelpers - compareCaptains', () => {
    test('should detect matching captains', () => {
        const myPicks = {
            picks: [
                { element: 1, is_captain: true },
                { element: 2, is_captain: false }
            ]
        };
        const rivalPicks = {
            picks: [
                { element: 1, is_captain: true },
                { element: 3, is_captain: false }
            ]
        };

        const result = compareCaptains(myPicks, rivalPicks);

        expect(result.captainsMatch).toBe(true);
        expect(result.myCaptainId).toBe(1);
        expect(result.rivalCaptainId).toBe(1);
    });

    test('should detect different captains', () => {
        const myPicks = {
            picks: [
                { element: 1, is_captain: true },
                { element: 2, is_captain: false }
            ]
        };
        const rivalPicks = {
            picks: [
                { element: 3, is_captain: true },
                { element: 1, is_captain: false }
            ]
        };

        const result = compareCaptains(myPicks, rivalPicks);

        expect(result.captainsMatch).toBe(false);
        expect(result.myCaptainId).toBe(1);
        expect(result.rivalCaptainId).toBe(3);
    });

    test('should handle missing captains', () => {
        const myPicks = { picks: [{ element: 1, is_captain: false }] };
        const rivalPicks = { picks: [{ element: 2, is_captain: false }] };

        const result = compareCaptains(myPicks, rivalPicks);

        // When both captains are undefined, they "match" (both missing)
        expect(result.captainsMatch).toBe(true);
        expect(result.myCaptainId).toBe(null);
        expect(result.rivalCaptainId).toBe(null);
    });
});

describe('teamComparisonHelpers - extractPlayerIds', () => {
    test('should extract all player IDs from picks', () => {
        const picks = {
            picks: [
                { element: 1, position: 1 },
                { element: 2, position: 2 },
                { element: 3, position: 3 }
            ]
        };

        const result = extractPlayerIds(picks);

        expect(result).toEqual([1, 2, 3]);
        expect(result).toHaveLength(3);
    });

    test('should handle empty picks', () => {
        const picks = { picks: [] };

        const result = extractPlayerIds(picks);

        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
    });
});

describe('teamComparisonHelpers - calculateComparisonPercentages', () => {
    test('should calculate percentages correctly', () => {
        const analysis = {
            sharedCount: 5,
            myDifferentialCount: 10,
            rivalDifferentialCount: 10
        };

        const result = calculateComparisonPercentages(analysis, 15);

        expect(result.sharedPercentage).toBeCloseTo(33.33, 1);
        expect(result.myDifferentialPercentage).toBeCloseTo(66.67, 1);
        expect(result.rivalDifferentialPercentage).toBeCloseTo(66.67, 1);
    });

    test('should handle 100% shared team', () => {
        const analysis = {
            sharedCount: 15,
            myDifferentialCount: 0,
            rivalDifferentialCount: 0
        };

        const result = calculateComparisonPercentages(analysis, 15);

        expect(result.sharedPercentage).toBe(100);
        expect(result.myDifferentialPercentage).toBe(0);
        expect(result.rivalDifferentialPercentage).toBe(0);
    });

    test('should handle 0% shared team', () => {
        const analysis = {
            sharedCount: 0,
            myDifferentialCount: 15,
            rivalDifferentialCount: 15
        };

        const result = calculateComparisonPercentages(analysis, 15);

        expect(result.sharedPercentage).toBe(0);
        expect(result.myDifferentialPercentage).toBe(100);
        expect(result.rivalDifferentialPercentage).toBe(100);
    });
});
