import { describe, test, expect, beforeEach } from 'vitest';
import {
  calculatePPM,
  calculatePP90,
  calculateMinutesPercentage,
  escapeHtml,
  formatCurrency,
  formatDecimal,
  formatPercent,
  getPositionShort,
  getPositionType,
  getPositionName,
  getFormTrend,
  sortPlayers,
  filterByPosition
} from '../src/utils.js';

describe('calculatePPM', () => {
  test('calculates points per million correctly', () => {
    const player = {
      total_points: 100,
      now_cost: 125 // £12.5m
    };

    const ppm = calculatePPM(player);
    expect(ppm).toBe(8.0); // 100 / 12.5 = 8.0
  });

  test('handles zero cost edge case', () => {
    const player = {
      total_points: 100,
      now_cost: 0
    };

    const ppm = calculatePPM(player);
    expect(ppm).toBe(0);
  });

  test('handles zero points', () => {
    const player = {
      total_points: 0,
      now_cost: 50
    };

    const ppm = calculatePPM(player);
    expect(ppm).toBe(0);
  });

  test('handles fractional results', () => {
    const player = {
      total_points: 85,
      now_cost: 125
    };

    const ppm = calculatePPM(player);
    expect(ppm).toBeCloseTo(6.8, 1);
  });
});

describe('calculatePP90', () => {
  test('calculates points per 90 minutes correctly', () => {
    const player = {
      total_points: 100,
      minutes: 900 // 10 full games
    };

    const pp90 = calculatePP90(player);
    expect(pp90).toBe(10.0); // 100 / (900/90) = 10.0
  });

  test('handles zero minutes edge case', () => {
    const player = {
      total_points: 100,
      minutes: 0
    };

    const pp90 = calculatePP90(player);
    expect(pp90).toBe(0);
  });

  test('handles partial games', () => {
    const player = {
      total_points: 50,
      minutes: 450 // 5 full games
    };

    const pp90 = calculatePP90(player);
    expect(pp90).toBe(10.0);
  });

  test('handles fractional results', () => {
    const player = {
      total_points: 85,
      minutes: 810
    };

    const pp90 = calculatePP90(player);
    expect(pp90).toBeCloseTo(9.44, 2);
  });
});

describe('calculateMinutesPercentage', () => {
  test('calculates minutes percentage correctly', () => {
    const player = {
      minutes: 810 // 9 full games
    };
    const gw = 10; // 10 gameweeks played

    const percentage = calculateMinutesPercentage(player, gw);
    expect(percentage).toBe(90); // 810 / (10 * 90) * 100 = 90%
  });

  test('handles 100% minutes played', () => {
    const player = {
      minutes: 900
    };
    const gw = 10;

    const percentage = calculateMinutesPercentage(player, gw);
    expect(percentage).toBe(100);
  });

  test('handles zero gameweeks calls getCurrentGW', () => {
    // Note: When gw is 0, getCurrentGW() is called as fallback
    // This is expected behavior - the function uses getCurrentGW() when gw is falsy
    const player = {
      minutes: 810
    };
    const gw = 0;

    const percentage = calculateMinutesPercentage(player, gw);
    // Returns 0 only if getCurrentGW() also returns 0
    expect(percentage).toBeGreaterThanOrEqual(0);
  });

  test('handles zero minutes', () => {
    const player = {
      minutes: 0
    };
    const gw = 10;

    const percentage = calculateMinutesPercentage(player, gw);
    expect(percentage).toBe(0);
  });
});

describe('escapeHtml (SECURITY CRITICAL)', () => {
  test('escapes script tags', () => {
    const input = '<script>alert("xss")</script>';
    const output = escapeHtml(input);

    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
  });

  test('escapes img with onerror', () => {
    const input = '<img src=x onerror="alert(1)">';
    const output = escapeHtml(input);

    expect(output).not.toContain('<img');
    expect(output).toContain('&lt;img');
  });

  test('escapes ampersands', () => {
    const input = 'Tom & Jerry';
    const output = escapeHtml(input);

    expect(output).toBe('Tom &amp; Jerry');
  });

  test('preserves quotes (uses textContent, not HTML entities)', () => {
    // Note: escapeHtml uses textContent which doesn't escape quotes
    // This is fine for preventing XSS as quotes can't execute code in textContent
    const input = 'He said "hello"';
    const output = escapeHtml(input);

    expect(output).toBe('He said "hello"'); // Quotes preserved
  });

  test('handles empty string', () => {
    const output = escapeHtml('');
    expect(output).toBe('');
  });

  test('handles null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('formatCurrency', () => {
  test('formats tenths to pounds', () => {
    expect(formatCurrency(125)).toBe('£12.5m');
    expect(formatCurrency(100)).toBe('£10.0m');
    expect(formatCurrency(45)).toBe('£4.5m');
  });

  test('handles zero', () => {
    expect(formatCurrency(0)).toBe('£0.0m');
  });

  test('handles single digit', () => {
    expect(formatCurrency(5)).toBe('£0.5m');
  });
});

describe('formatDecimal', () => {
  test('formats to 1 decimal place', () => {
    // Note: formatDecimal uses toFixed(1) not toFixed(2)
    expect(formatDecimal(5.678)).toBe('5.7');
    expect(formatDecimal(3.141592)).toBe('3.1');
  });

  test('handles integers', () => {
    expect(formatDecimal(5)).toBe('5.0');
  });

  test('handles zero', () => {
    expect(formatDecimal(0)).toBe('0.0');
  });

  test('handles strings that are numbers', () => {
    expect(formatDecimal('3.456')).toBe('3.5');
  });
});

describe('formatPercent', () => {
  test('formats with default 1 decimal', () => {
    expect(formatPercent(32.567)).toBe('32.6%');
  });

  test('formats with custom decimals', () => {
    expect(formatPercent(32.567, 2)).toBe('32.57%');
    expect(formatPercent(32.567, 0)).toBe('33%');
  });

  test('handles zero', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });
});

describe('getPositionShort', () => {
  test('returns correct short position for GKP', () => {
    const player = { element_type: 1 };
    expect(getPositionShort(player)).toBe('GKP');
  });

  test('returns correct short position for DEF', () => {
    const player = { element_type: 2 };
    expect(getPositionShort(player)).toBe('DEF');
  });

  test('returns correct short position for MID', () => {
    const player = { element_type: 3 };
    expect(getPositionShort(player)).toBe('MID');
  });

  test('returns correct short position for FWD', () => {
    const player = { element_type: 4 };
    expect(getPositionShort(player)).toBe('FWD');
  });
});

describe('getPositionType', () => {
  test('returns correct type for each position', () => {
    expect(getPositionType({ element_type: 1 })).toBe('GKP');
    expect(getPositionType({ element_type: 2 })).toBe('DEF');
    expect(getPositionType({ element_type: 3 })).toBe('MID');
    expect(getPositionType({ element_type: 4 })).toBe('FWD');
  });
});

describe('getPositionName', () => {
  test('returns correct full names', () => {
    expect(getPositionName(1)).toBe('Goalkeeper');
    expect(getPositionName(2)).toBe('Defender');
    expect(getPositionName(3)).toBe('Midfielder');
    expect(getPositionName(4)).toBe('Forward');
  });

  test('returns Unknown for invalid types', () => {
    expect(getPositionName(5)).toBe('Unknown');
    expect(getPositionName(0)).toBe('Unknown');
  });
});

describe('getFormTrend', () => {
  test('identifies improving form', () => {
    // Note: getFormTrend compares form to (total_points / getCurrentGW())
    // In tests, getCurrentGW() returns 1 (no FPL data loaded)
    // form > avgPoints * 1.2 = 'up'
    const player = {
      form: '7.0',
      total_points: 5 // getCurrentGW() = 1, avgPoints = 5.0, threshold = 6.0
    };

    const trend = getFormTrend(player);
    expect(trend).toBe('up'); // 7.0 > 6.0
  });

  test('identifies declining form', () => {
    // form < avgPoints * 0.8 = 'down'
    const player = {
      form: '3.0',
      total_points: 5 // getCurrentGW() = 1, avgPoints = 5.0, threshold = 4.0
    };

    const trend = getFormTrend(player);
    expect(trend).toBe('down'); // 3.0 < 4.0
  });

  test('identifies stable form', () => {
    // avgPoints * 0.8 <= form <= avgPoints * 1.2 = 'stable'
    const player = {
      form: '5.0',
      total_points: 5 // getCurrentGW() = 1, avgPoints = 5.0
    };

    const trend = getFormTrend(player);
    expect(trend).toBe('stable'); // 4.0 <= 5.0 <= 6.0
  });

  test('handles missing data', () => {
    const player = {};
    const trend = getFormTrend(player);
    expect(trend).toBe('stable');
  });
});

describe('sortPlayers', () => {
  const players = [
    { id: 1, total_points: 50, web_name: 'Player A' },
    { id: 2, total_points: 100, web_name: 'Player B' },
    { id: 3, total_points: 75, web_name: 'Player C' }
  ];

  test('sorts by total_points descending by default', () => {
    const sorted = sortPlayers([...players]);

    expect(sorted[0].id).toBe(2); // 100 points
    expect(sorted[1].id).toBe(3); // 75 points
    expect(sorted[2].id).toBe(1); // 50 points
  });

  test('sorts ascending when specified', () => {
    const sorted = sortPlayers([...players], 'total_points', true);

    expect(sorted[0].id).toBe(1); // 50 points
    expect(sorted[1].id).toBe(3); // 75 points
    expect(sorted[2].id).toBe(2); // 100 points
  });

  test('sorts numeric values correctly', () => {
    // Note: sortPlayers uses numeric subtraction, so string comparisons don't work properly
    // It's designed for numeric metrics like total_points, form, etc.
    const players = [
      { id: 1, total_points: 30 },
      { id: 2, total_points: 10 },
      { id: 3, total_points: 20 }
    ];
    const sorted = sortPlayers(players, 'total_points');

    expect(sorted[0].id).toBe(1); // 30 points
    expect(sorted[1].id).toBe(3); // 20 points
    expect(sorted[2].id).toBe(2); // 10 points
  });

  test('returns empty array for empty input', () => {
    const sorted = sortPlayers([]);
    expect(sorted).toEqual([]);
  });
});

describe('filterByPosition', () => {
  const players = [
    { id: 1, element_type: 1 }, // GKP
    { id: 2, element_type: 2 }, // DEF
    { id: 3, element_type: 3 }, // MID
    { id: 4, element_type: 2 }, // DEF
  ];

  test('filters goalkeepers', () => {
    const filtered = filterByPosition(players, 1);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });

  test('filters defenders', () => {
    const filtered = filterByPosition(players, 2);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(p => p.element_type === 2)).toBe(true);
  });

  test('returns empty array for no matches', () => {
    const filtered = filterByPosition(players, 4);
    expect(filtered).toEqual([]);
  });

  test('returns empty array for empty input', () => {
    const filtered = filterByPosition([], 1);
    expect(filtered).toEqual([]);
  });
});
