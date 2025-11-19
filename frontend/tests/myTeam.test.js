/**
 * Unit tests for My Team page logic
 * Testing pure calculation/comparison functions that can be extracted during refactoring
 */

import { describe, test, expect, beforeEach } from 'vitest';

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

/**
 * Create mock team picks data
 */
function createMockPicks(playerElements, captainId = null, viceId = null) {
  return {
    picks: playerElements.map((element, index) => ({
      element,
      position: index + 1,
      is_captain: element === captainId,
      is_vice_captain: element === viceId,
      multiplier: element === captainId ? 2 : 1
    })),
    entry_history: {
      total_points: 65,
      event_transfers: 0,
      event_transfers_cost: 0,
      points_on_bench: 8
    }
  };
}

/**
 * Create mock player data
 */
function createMockPlayer(id, overrides = {}) {
  return {
    id,
    web_name: `Player ${id}`,
    element_type: 3, // MID by default
    team: 1,
    now_cost: 80, // £8.0m
    total_points: 50,
    event_points: 6,
    selected_by_percent: '25.0',
    minutes: 720,
    form: '5.0',
    ...overrides
  };
}

// ============================================================================
// TEAM COMPARISON LOGIC TESTS
// ============================================================================

describe('Team Comparison - Differential Analysis', () => {
  test('should identify players unique to my team', () => {
    const myPlayerIds = [1, 2, 3, 4, 5];
    const rivalPlayerIds = [3, 4, 5, 6, 7];

    const myPlayerIdsSet = new Set(myPlayerIds);
    const rivalPlayerIdsSet = new Set(rivalPlayerIds);

    // My differentials: players I have that rival doesn't
    const myDifferentials = myPlayerIds.filter(id => !rivalPlayerIdsSet.has(id));

    expect(myDifferentials).toEqual([1, 2]);
    expect(myDifferentials).toHaveLength(2);
  });

  test('should identify players unique to rival team', () => {
    const myPlayerIds = [1, 2, 3, 4, 5];
    const rivalPlayerIds = [3, 4, 5, 6, 7];

    const myPlayerIdsSet = new Set(myPlayerIds);
    const rivalPlayerIdsSet = new Set(rivalPlayerIds);

    // Rival differentials: players rival has that I don't
    const rivalDifferentials = rivalPlayerIds.filter(id => !myPlayerIdsSet.has(id));

    expect(rivalDifferentials).toEqual([6, 7]);
    expect(rivalDifferentials).toHaveLength(2);
  });

  test('should identify shared players between teams', () => {
    const myPlayerIds = [1, 2, 3, 4, 5];
    const rivalPlayerIds = [3, 4, 5, 6, 7];

    const myPlayerIdsSet = new Set(myPlayerIds);
    const rivalPlayerIdsSet = new Set(rivalPlayerIds);

    // Shared players: players both teams have
    const sharedPlayers = myPlayerIds.filter(id => rivalPlayerIdsSet.has(id));

    expect(sharedPlayers).toEqual([3, 4, 5]);
    expect(sharedPlayers).toHaveLength(3);
  });

  test('should detect when captains match', () => {
    const myPicks = createMockPicks([1, 2, 3], 1);
    const rivalPicks = createMockPicks([1, 2, 4], 1);

    const myCaptain = myPicks.picks.find(p => p.is_captain);
    const rivalCaptain = rivalPicks.picks.find(p => p.is_captain);

    const captainsMatch = myCaptain?.element === rivalCaptain?.element;

    expect(captainsMatch).toBe(true);
    expect(myCaptain.element).toBe(1);
  });

  test('should detect when captains differ', () => {
    const myPicks = createMockPicks([1, 2, 3], 1);
    const rivalPicks = createMockPicks([1, 2, 4], 2);

    const myCaptain = myPicks.picks.find(p => p.is_captain);
    const rivalCaptain = rivalPicks.picks.find(p => p.is_captain);

    const captainsMatch = myCaptain?.element === rivalCaptain?.element;

    expect(captainsMatch).toBe(false);
  });

  test('should handle teams with no shared players', () => {
    const myPlayerIds = [1, 2, 3];
    const rivalPlayerIds = [4, 5, 6];

    const myPlayerIdsSet = new Set(myPlayerIds);
    const rivalPlayerIdsSet = new Set(rivalPlayerIds);

    const sharedPlayers = myPlayerIds.filter(id => rivalPlayerIdsSet.has(id));

    expect(sharedPlayers).toEqual([]);
    expect(sharedPlayers).toHaveLength(0);
  });
});

// ============================================================================
// TEAM SUMMARY CALCULATIONS TESTS
// ============================================================================

describe('Team Summary - Bench Points Calculation', () => {
  test('should calculate bench points correctly', () => {
    const players = [
      { position: 1, element: 1, points: 6 },
      { position: 12, element: 2, points: 5 }, // Bench
      { position: 13, element: 3, points: 3 }, // Bench
      { position: 14, element: 4, points: 0 }, // Bench
      { position: 15, element: 5, points: 2 }  // Bench
    ];

    const benchPlayers = players.filter(p => p.position > 11);
    const benchPoints = benchPlayers.reduce((sum, p) => sum + p.points, 0);

    expect(benchPoints).toBe(10);
    expect(benchPlayers).toHaveLength(4);
  });

  test('should return zero when bench scores no points', () => {
    const players = [
      { position: 12, element: 2, points: 0 },
      { position: 13, element: 3, points: 0 },
      { position: 14, element: 4, points: 0 },
      { position: 15, element: 5, points: 0 }
    ];

    const benchPlayers = players.filter(p => p.position > 11);
    const benchPoints = benchPlayers.reduce((sum, p) => sum + p.points, 0);

    expect(benchPoints).toBe(0);
  });

  test('should only count bench players (position > 11)', () => {
    const players = [
      { position: 11, element: 1, points: 10 }, // Starting 11
      { position: 12, element: 2, points: 5 },  // Bench
      { position: 13, element: 3, points: 3 }   // Bench
    ];

    const benchPlayers = players.filter(p => p.position > 11);
    const benchPoints = benchPlayers.reduce((sum, p) => sum + p.points, 0);

    expect(benchPoints).toBe(8);
    expect(benchPlayers).not.toContainEqual(expect.objectContaining({ position: 11 }));
  });
});

describe('Team Summary - Squad Averages', () => {
  test('should calculate average PPM correctly', () => {
    const ppmValues = [2.5, 3.0, 2.0, 4.0, 1.5];
    const avgPPM = ppmValues.reduce((sum, val) => sum + val, 0) / ppmValues.length;

    expect(avgPPM).toBeCloseTo(2.6, 1);
  });

  test('should calculate average ownership correctly', () => {
    const ownershipValues = [25.0, 50.0, 10.0, 75.0, 30.0];
    const avgOwnership = ownershipValues.reduce((sum, val) => sum + val, 0) / ownershipValues.length;

    expect(avgOwnership).toBe(38.0);
  });

  test('should calculate average minutes percentage correctly', () => {
    const minutesPercentages = [90, 80, 70, 60, 50];
    const avgMinPercent = minutesPercentages.reduce((sum, val) => sum + val, 0) / minutesPercentages.length;

    expect(avgMinPercent).toBe(70);
  });

  test('should handle empty squad correctly', () => {
    const emptySquad = [];
    const avgPPM = emptySquad.length > 0
      ? emptySquad.reduce((sum, val) => sum + val, 0) / emptySquad.length
      : 0;

    expect(avgPPM).toBe(0);
  });

  test('should handle squad with single player', () => {
    const singlePlayerPPM = [3.5];
    const avgPPM = singlePlayerPPM.reduce((sum, val) => sum + val, 0) / singlePlayerPPM.length;

    expect(avgPPM).toBe(3.5);
  });
});

describe('Team Summary - Fixture Difficulty Average', () => {
  test('should calculate average FDR correctly', () => {
    const fdrValues = [2.0, 3.0, 2.5, 4.0, 1.5];
    const avgFDR = fdrValues.reduce((sum, val) => sum + val, 0) / fdrValues.length;

    expect(avgFDR).toBeCloseTo(2.6, 1);
  });

  test('should classify FDR as excellent (<=2.5)', () => {
    const avgFDR = 2.3;
    const classification = avgFDR <= 2.5 ? 'excellent' : avgFDR <= 3.5 ? 'average' : 'tough';

    expect(classification).toBe('excellent');
  });

  test('should classify FDR as average (>2.5 and <=3.5)', () => {
    const avgFDR = 3.0;
    const classification = avgFDR <= 2.5 ? 'excellent' : avgFDR <= 3.5 ? 'average' : 'tough';

    expect(classification).toBe('average');
  });

  test('should classify FDR as tough (>3.5)', () => {
    const avgFDR = 4.0;
    const classification = avgFDR <= 2.5 ? 'excellent' : avgFDR <= 3.5 ? 'average' : 'tough';

    expect(classification).toBe('tough');
  });
});

describe('Team Summary - High Risk Player Counting', () => {
  test('should count high risk players correctly', () => {
    const players = [
      { hasHighRisk: true },
      { hasHighRisk: false },
      { hasHighRisk: true },
      { hasHighRisk: true },
      { hasHighRisk: false }
    ];

    const highRiskCount = players.filter(p => p.hasHighRisk).length;

    expect(highRiskCount).toBe(3);
  });

  test('should return zero when no high risk players', () => {
    const players = [
      { hasHighRisk: false },
      { hasHighRisk: false },
      { hasHighRisk: false }
    ];

    const highRiskCount = players.filter(p => p.hasHighRisk).length;

    expect(highRiskCount).toBe(0);
  });

  test('should classify risk level based on count', () => {
    const testCases = [
      { count: 0, expected: 'stable' },
      { count: 1, expected: 'monitor' },
      { count: 2, expected: 'monitor' },
      { count: 3, expected: 'action' },
      { count: 5, expected: 'action' }
    ];

    testCases.forEach(({ count, expected }) => {
      const riskLevel = count > 2 ? 'action' : count > 0 ? 'monitor' : 'stable';
      expect(riskLevel).toBe(expected);
    });
  });
});

// ============================================================================
// TEAM VALIDATION TESTS
// ============================================================================

describe('Team Validation', () => {
  test('should validate starting 11 positions (1-11)', () => {
    const players = [
      { position: 1 },
      { position: 5 },
      { position: 11 }
    ];

    const starting11 = players.filter(p => p.position >= 1 && p.position <= 11);

    expect(starting11).toHaveLength(3);
  });

  test('should validate bench positions (12-15)', () => {
    const players = [
      { position: 12 },
      { position: 13 },
      { position: 14 },
      { position: 15 }
    ];

    const bench = players.filter(p => p.position >= 12 && p.position <= 15);

    expect(bench).toHaveLength(4);
  });

  test('should validate squad has exactly one captain', () => {
    const picks = createMockPicks([1, 2, 3, 4, 5], 2);

    const captains = picks.picks.filter(p => p.is_captain);

    expect(captains).toHaveLength(1);
    expect(captains[0].element).toBe(2);
  });

  test('should validate squad has exactly one vice captain', () => {
    const picks = createMockPicks([1, 2, 3, 4, 5], 2, 3);

    const viceCaptains = picks.picks.filter(p => p.is_vice_captain);

    expect(viceCaptains).toHaveLength(1);
    expect(viceCaptains[0].element).toBe(3);
  });

  test('should validate captain has 2x multiplier', () => {
    const picks = createMockPicks([1, 2, 3], 1);

    const captain = picks.picks.find(p => p.is_captain);

    expect(captain.multiplier).toBe(2);
  });

  test('should validate non-captains have 1x multiplier', () => {
    const picks = createMockPicks([1, 2, 3, 4], 1);

    const nonCaptains = picks.picks.filter(p => !p.is_captain);

    nonCaptains.forEach(player => {
      expect(player.multiplier).toBe(1);
    });
  });
});

// ============================================================================
// OWNERSHIP ANALYSIS TESTS
// ============================================================================

describe('Ownership Analysis', () => {
  test('should classify team as template heavy (>50% avg ownership)', () => {
    const avgOwnership = 55.0;
    const isTemplate = avgOwnership > 50;

    expect(isTemplate).toBe(true);
  });

  test('should classify team as differential (<=50% avg ownership)', () => {
    const avgOwnership = 35.0;
    const isTemplate = avgOwnership > 50;

    expect(isTemplate).toBe(false);
  });

  test('should handle boundary case (exactly 50%)', () => {
    const avgOwnership = 50.0;
    const isTemplate = avgOwnership > 50;

    expect(isTemplate).toBe(false);
  });
});

// ============================================================================
// MINUTES PERCENTAGE CLASSIFICATION TESTS
// ============================================================================

describe('Minutes Percentage Classification', () => {
  test('should classify as regular starters (>=70%)', () => {
    const avgMinPercent = 75;
    const status = avgMinPercent >= 70 ? 'regular' : avgMinPercent >= 50 ? 'mixed' : 'high-rotation';

    expect(status).toBe('regular');
  });

  test('should classify as mixed rotation (>=50% and <70%)', () => {
    const avgMinPercent = 60;
    const status = avgMinPercent >= 70 ? 'regular' : avgMinPercent >= 50 ? 'mixed' : 'high-rotation';

    expect(status).toBe('mixed');
  });

  test('should classify as high rotation (<50%)', () => {
    const avgMinPercent = 40;
    const status = avgMinPercent >= 70 ? 'regular' : avgMinPercent >= 50 ? 'mixed' : 'high-rotation';

    expect(status).toBe('high-rotation');
  });
});

// ============================================================================
// BENCH POINTS WARNING TESTS
// ============================================================================

describe('Bench Points Warning', () => {
  test('should show warning when bench points > 0', () => {
    const benchPoints = 8;
    const hasWarning = benchPoints > 0;

    expect(hasWarning).toBe(true);
  });

  test('should not show warning when bench points = 0', () => {
    const benchPoints = 0;
    const hasWarning = benchPoints > 0;

    expect(hasWarning).toBe(false);
  });
});

// ============================================================================
// INTEGRATION: FULL COMPARISON ANALYSIS
// ============================================================================

describe('Full Team Comparison Analysis', () => {
  test('should perform complete head-to-head analysis', () => {
    const myPlayerIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const rivalPlayerIds = [1, 2, 3, 12, 13, 14, 15, 16, 17, 18, 19];

    const myPlayerIdsSet = new Set(myPlayerIds);
    const rivalPlayerIdsSet = new Set(rivalPlayerIds);

    const myDifferentials = myPlayerIds.filter(id => !rivalPlayerIdsSet.has(id));
    const rivalDifferentials = rivalPlayerIds.filter(id => !myPlayerIdsSet.has(id));
    const sharedPlayers = myPlayerIds.filter(id => rivalPlayerIdsSet.has(id));

    // Analysis
    expect(sharedPlayers).toHaveLength(3); // Players 1, 2, 3
    expect(myDifferentials).toHaveLength(8); // Players 4-11
    expect(rivalDifferentials).toHaveLength(8); // Players 12-19
    expect(myPlayerIds.length).toBe(rivalPlayerIds.length); // Same squad size
  });

  test('should calculate comparison percentages', () => {
    const sharedCount = 5;
    const totalSquadSize = 15;
    const sharedPercentage = (sharedCount / totalSquadSize) * 100;

    expect(sharedPercentage).toBeCloseTo(33.33, 1);
  });
});
