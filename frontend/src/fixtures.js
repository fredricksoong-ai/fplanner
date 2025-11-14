// ============================================================================
// FIXTURES MODULE
// Handles fixture analysis, opponent lookups, and difficulty calculations
// ============================================================================

import { fplFixtures, fplBootstrap, currentGW } from './data.js';
import { getTeamByCode } from './utils.js';

// ============================================================================
// FIXTURE RETRIEVAL
// ============================================================================

/**
 * Get fixtures for a team
 * @param {number} teamId - Team ID
 * @param {number} count - Number of fixtures to return
 * @param {boolean} isPast - Get past fixtures (true) or future (false)
 * @returns {Array} Array of fixture objects
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
 * @param {number} gameweek - Gameweek number
 * @returns {Object} Opponent info {name, difficulty, isHome}
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
 * @param {number} count - Number of gameweeks to analyze
 * @returns {number} Average difficulty (1-5)
 */
export function calculateFixtureDifficulty(teamId, count = 5) {
    const fixtures = getFixtures(teamId, count, false);
    
    if (fixtures.length === 0) return 3;
    
    const totalDifficulty = fixtures.reduce((sum, f) => sum + f.difficulty, 0);
    return totalDifficulty / fixtures.length;
}

/**
 * Get fixture difficulty rating class
 * @param {number} avgDifficulty - Average difficulty (1-5)
 * @returns {string} Rating description
 */
export function getFDRClass(avgDifficulty) {
    if (avgDifficulty <= 2) return 'Excellent';
    if (avgDifficulty <= 2.5) return 'Good';
    if (avgDifficulty <= 3.5) return 'Average';
    if (avgDifficulty <= 4) return 'Tough';
    return 'Very Tough';
}

/**
 * Analyze fixture swing (improvement/deterioration)
 * @param {number} teamId - Team ID
 * @param {number} nextCount - Fixtures to analyze next
 * @param {number} afterCount - Fixtures to analyze after that
 * @returns {Object} Swing analysis
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
 * Check if team has a blank (no fixture) in upcoming gameweeks
 * @param {number} teamId - Team ID
 * @param {number} lookAhead - Number of gameweeks to check
 * @returns {Array} Array of blank gameweeks
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
 * Check if team has a double gameweek upcoming
 * @param {number} teamId - Team ID
 * @param {number} lookAhead - Number of gameweeks to check
 * @returns {Array} Array of double gameweeks
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