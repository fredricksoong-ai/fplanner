// ============================================================================
// FIXTURES MODULE
// Handles fixture analysis, opponent lookups, and difficulty calculations
// ============================================================================

import { fplFixtures, fplBootstrap, currentGW } from './data.js';
import { getTeamByCode } from './utils.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} Fixture
 * @property {string} opponent - Opponent short name with venue (e.g., 'ARS (H)', 'LIV (A)')
 * @property {number} difficulty - FPL fixture difficulty rating (1=easiest, 5=hardest)
 * @property {number} event - Gameweek number
 */

/**
 * @typedef {Object} OpponentInfo
 * @property {string} name - Opponent short name (3 letters)
 * @property {number} difficulty - Fixture difficulty (1-5)
 * @property {boolean} isHome - True if home fixture, false if away
 */

/**
 * @typedef {Object} FixtureSwing
 * @property {number} nextAvg - Average difficulty for next N fixtures
 * @property {number} afterAvg - Average difficulty after that
 * @property {number} swing - Difference (afterAvg - nextAvg)
 * @property {boolean} improving - True if fixtures getting easier (swing < -0.5)
 * @property {boolean} worsening - True if fixtures getting harder (swing > 0.5)
 */

// ============================================================================
// FIXTURE RETRIEVAL
// ============================================================================

/**
 * Get fixtures for a team (past or future)
 * @param {number} teamId - Team ID
 * @param {number} [count=3] - Number of fixtures to return
 * @param {boolean} [isPast=false] - Get past fixtures (true) or future (false)
 * @returns {Fixture[]} Array of fixture objects with opponent and difficulty
 * @example
 * getFixtures(1, 3, false) // Next 3 fixtures for team 1
 * getFixtures(5, 5, true)  // Last 5 fixtures for team 5
 */
export function getFixtures(teamId, count = 3, isPast = false) {
    // Return real fixtures if we have the data
    if (fplFixtures && fplFixtures.length > 0 && fplBootstrap && currentGW) {
        const fixtures = [];
        
        // Filter fixtures for this team using team ID
        const teamFixtures = fplFixtures.filter(f => 
            f.team_h === teamId || f.team_a === teamId
        );
        
        // Sort by gameweek
        teamFixtures.sort((a, b) => a.event - b.event);
        
        // Get past or future fixtures
        // CRITICAL: Use > (not >=) to exclude current gameweek for future fixtures
        const relevantFixtures = isPast ? 
            teamFixtures.filter(f => f.event < currentGW).slice(-count) :
            teamFixtures.filter(f => f.event > currentGW).slice(0, count);
        
        relevantFixtures.forEach(f => {
            const isHome = f.team_h === teamId;
            const opponentId = isHome ? f.team_a : f.team_h;
            const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
            
            // Get opponent short name
            const opponent = fplBootstrap.teams.find(t => t.id === opponentId);
            const opponentName = opponent ? 
                (isHome ? `${opponent.short_name} (H)` : `${opponent.short_name} (A)`) : 
                'TBD';
            
            fixtures.push({
                opponent: opponentName,
                difficulty: difficulty || 3,
                event: f.event
            });
        });
        
        return fixtures;
    }
    
    return getFallbackFixtures(count);
}

/**
 * Get fallback fixtures when data is unavailable
 * @param {number} count - Number of fixtures
 * @returns {Array} Array of placeholder fixtures
 */
function getFallbackFixtures(count) {
    const mockFixtures = [];
    for (let i = 0; i < count; i++) {
        mockFixtures.push({
            opponent: 'TBD',
            difficulty: 3,
            event: currentGW + i + 1
        });
    }
    return mockFixtures;
}

/**
 * Get opponent for a specific gameweek
 * @param {number} teamId - Team ID
 * @param {number} gameweek - Gameweek number (1-38)
 * @returns {OpponentInfo} Opponent info with name, difficulty, and venue
 * @example
 * getGWOpponent(1, 12) // { name: 'LIV', difficulty: 5, isHome: false }
 */
export function getGWOpponent(teamId, gameweek) {
    if (!fplFixtures || !fplBootstrap || !teamId || !gameweek) {
        return { name: 'TBD', difficulty: 3, isHome: false };
    }
    
    // Find fixture for this team in this gameweek
    const fixture = fplFixtures.find(f => 
        f.event === gameweek && (f.team_h === teamId || f.team_a === teamId)
    );
    
    if (!fixture) {
        return { name: 'TBD', difficulty: 3, isHome: false };
    }
    
    const isHome = fixture.team_h === teamId;
    const opponentId = isHome ? fixture.team_a : fixture.team_h;
    const opponent = fplBootstrap.teams.find(t => t.id === opponentId);
    const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;
    
    return {
        name: opponent ? opponent.short_name : 'TBD',
        difficulty: difficulty || 3,
        isHome: isHome
    };
}

// ============================================================================
// FIXTURE DIFFICULTY ANALYSIS
// ============================================================================

/**
 * Calculate average fixture difficulty over next N gameweeks
 * @param {number} teamId - Team ID
 * @param {number} [count=5] - Number of gameweeks to analyze
 * @returns {number} Average difficulty rating (1-5, defaults to 3 if no fixtures)
 * @example
 * calculateFixtureDifficulty(1, 5) // 2.4 (good fixtures)
 */
export function calculateFixtureDifficulty(teamId, count = 5) {
    const fixtures = getFixtures(teamId, count, false);

    if (fixtures.length === 0) return 3;

    const totalDifficulty = fixtures.reduce((sum, f) => sum + f.difficulty, 0);
    return totalDifficulty / fixtures.length;
}

/**
 * Get fixture difficulty rating classification
 * @param {number} avgDifficulty - Average difficulty (1-5)
 * @returns {'Excellent'|'Good'|'Average'|'Tough'|'Very Tough'} Rating description
 * @example
 * getFDRClass(1.8) // 'Excellent'
 * getFDRClass(4.2) // 'Very Tough'
 */
export function getFDRClass(avgDifficulty) {
    if (avgDifficulty <= 2) return 'Excellent';
    if (avgDifficulty <= 2.5) return 'Good';
    if (avgDifficulty <= 3.5) return 'Average';
    if (avgDifficulty <= 4) return 'Tough';
    return 'Very Tough';
}

/**
 * Analyze fixture swing (improvement/deterioration over time)
 * @param {number} teamId - Team ID
 * @param {number} [nextCount=3] - Fixtures to analyze next (immediate)
 * @param {number} [afterCount=3] - Fixtures to analyze after that
 * @returns {FixtureSwing} Swing analysis with averages and trend flags
 * @example
 * const swing = analyzeFixtureSwing(1, 3, 3);
 * // { nextAvg: 3.5, afterAvg: 2.2, swing: -1.3, improving: true, worsening: false }
 */
export function analyzeFixtureSwing(teamId, nextCount = 3, afterCount = 3) {
    const next = getFixtures(teamId, nextCount, false);
    const after = getFixtures(teamId, afterCount, false).slice(nextCount);
    
    const nextAvg = next.reduce((sum, f) => sum + f.difficulty, 0) / next.length;
    const afterAvg = after.reduce((sum, f) => sum + f.difficulty, 0) / after.length;
    
    const swing = afterAvg - nextAvg;
    
    return {
        nextAvg: nextAvg,
        afterAvg: afterAvg,
        swing: swing,
        improving: swing < -0.5, // Getting easier
        worsening: swing > 0.5   // Getting harder
    };
}

// ============================================================================
// FIXTURE COMPARISON
// ============================================================================

/**
 * Compare fixtures between two teams
 * @param {number} teamId1 - First team ID
 * @param {number} teamId2 - Second team ID
 * @param {number} count - Number of fixtures to compare
 * @returns {Object} Comparison result
 */
export function compareFixtures(teamId1, teamId2, count = 5) {
    const team1Fixtures = getFixtures(teamId1, count, false);
    const team2Fixtures = getFixtures(teamId2, count, false);
    
    const team1Avg = calculateFixtureDifficulty(teamId1, count);
    const team2Avg = calculateFixtureDifficulty(teamId2, count);
    
    return {
        team1: {
            fixtures: team1Fixtures,
            avgDifficulty: team1Avg,
            rating: getFDRClass(team1Avg)
        },
        team2: {
            fixtures: team2Fixtures,
            avgDifficulty: team2Avg,
            rating: getFDRClass(team2Avg)
        },
        betterFixtures: team1Avg < team2Avg ? 'team1' : 'team2',
        difference: Math.abs(team1Avg - team2Avg)
    };
}

/**
 * Get teams with best fixtures
 * @param {number} count - Number of teams to return
 * @param {number} fixtureCount - Number of fixtures to analyze
 * @returns {Array} Teams sorted by fixture difficulty (easiest first)
 */
export function getTeamsWithBestFixtures(count = 5, fixtureCount = 5) {
    if (!fplBootstrap) return [];
    
    const teamAnalysis = fplBootstrap.teams.map(team => {
        const avgDifficulty = calculateFixtureDifficulty(team.code, fixtureCount);
        return {
            team: team,
            avgDifficulty: avgDifficulty,
            rating: getFDRClass(avgDifficulty)
        };
    });
    
    // Sort by difficulty (easiest first)
    teamAnalysis.sort((a, b) => a.avgDifficulty - b.avgDifficulty);
    
    return teamAnalysis.slice(0, count);
}

/**
 * Get teams with worst fixtures
 * @param {number} count - Number of teams to return
 * @param {number} fixtureCount - Number of fixtures to analyze
 * @returns {Array} Teams sorted by fixture difficulty (hardest first)
 */
export function getTeamsWithWorstFixtures(count = 5, fixtureCount = 5) {
    if (!fplBootstrap) return [];
    
    const teamAnalysis = fplBootstrap.teams.map(team => {
        const avgDifficulty = calculateFixtureDifficulty(team.code, fixtureCount);
        return {
            team: team,
            avgDifficulty: avgDifficulty,
            rating: getFDRClass(avgDifficulty)
        };
    });
    
    // Sort by difficulty (hardest first)
    teamAnalysis.sort((a, b) => b.avgDifficulty - a.avgDifficulty);
    
    return teamAnalysis.slice(0, count);
}

// ============================================================================
// BLANK GAMEWEEK DETECTION
// ============================================================================

/**
 * Check if team has blank gameweeks (no fixtures) upcoming
 * @param {number} teamId - Team ID
 * @param {number} [lookAhead=10] - Number of gameweeks to check ahead
 * @returns {number[]} Array of gameweek numbers where team has no fixture
 * @example
 * getBlankGameweeks(1, 10) // [15, 28] (team has blanks in GW15 and GW28)
 */
export function getBlankGameweeks(teamId, lookAhead = 10) {
    if (!fplFixtures || !fplBootstrap || !teamId) return [];

    const blanks = [];

    for (let gw = currentGW + 1; gw <= currentGW + lookAhead && gw <= 38; gw++) {
        const hasFixture = fplFixtures.some(f =>
            f.event === gw && (f.team_h === teamId || f.team_a === teamId)
        );

        if (!hasFixture) {
            blanks.push(gw);
        }
    }

    return blanks;
}

/**
 * @typedef {Object} DoubleGameweek
 * @property {number} gameweek - Gameweek number
 * @property {number} fixtures - Number of fixtures (usually 2)
 */

/**
 * Check if team has double gameweeks (multiple fixtures) upcoming
 * @param {number} teamId - Team ID
 * @param {number} [lookAhead=10] - Number of gameweeks to check ahead
 * @returns {DoubleGameweek[]} Array of double gameweek objects
 * @example
 * getDoubleGameweeks(1, 10) // [{ gameweek: 26, fixtures: 2 }]
 */
export function getDoubleGameweeks(teamId, lookAhead = 10) {
    if (!fplFixtures || !fplBootstrap || !teamId) return [];
    
    const doubles = [];
    
    for (let gw = currentGW + 1; gw <= currentGW + lookAhead && gw <= 38; gw++) {
        const fixturesInGW = fplFixtures.filter(f => 
            f.event === gw && (f.team_h === teamId || f.team_a === teamId)
        );
        
        if (fixturesInGW.length > 1) {
            doubles.push({
                gameweek: gw,
                fixtures: fixturesInGW.length
            });
        }
    }
    
    return doubles;
}

// ============================================================================
// FIXTURE FORMATTING
// ============================================================================

/**
 * Format fixture for display
 * @param {Object} fixture - Fixture object
 * @returns {string} Formatted fixture string
 */
export function formatFixture(fixture) {
    if (!fixture || !fixture.opponent) return 'TBD';
    return fixture.opponent;
}

/**
 * Get fixture display with difficulty color
 * @param {Object} fixture - Fixture object
 * @returns {string} HTML string with styled fixture
 */
export function getFixtureHTML(fixture) {
    if (!fixture || !fixture.opponent) {
        return '<span style="color: var(--text-secondary);">TBD</span>';
    }
    
    const diffClass = getDifficultyClass(fixture.difficulty);
    
    return `
        <span class="${diffClass}" style="
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.875rem;
            font-weight: 600;
            display: inline-block;
        ">
            ${fixture.opponent}
        </span>
    `;
}

function getDifficultyClass(difficulty) {
    if (difficulty === 1) return 'fixture-diff-1';
    if (difficulty === 2) return 'fixture-diff-2';
    if (difficulty === 3) return 'fixture-diff-3';
    if (difficulty === 4) return 'fixture-diff-4';
    if (difficulty === 5) return 'fixture-diff-5';
    return 'fixture-diff-3';
}