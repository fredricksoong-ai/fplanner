// ============================================================================
// COMPACT FIXTURES TICKER
// Horizontal scrolling fixtures list for mobile view
// Shows current/next GW fixtures in chronological order
// ============================================================================

import {
    fplFixtures as getFixturesData,
    fplBootstrap as getBootstrapData,
    getActiveGW
} from '../../data.js';

/**
 * Get team short name (3-letter code)
 * @param {Object} team - Team object from bootstrap
 * @returns {string} Team short name
 */
function getTeamShortName(team) {
    return team?.short_name || team?.name?.substring(0, 3).toUpperCase() || 'TBD';
}

/**
 * Format kickoff time for display
 * @param {Date} kickoffDate - Kickoff date
 * @returns {Object} Day abbreviation and time string
 */
function formatKickoffTime(kickoffDate) {
    const dayStr = kickoffDate.toLocaleDateString('en-GB', {
        weekday: 'short'
    });
    const timeStr = kickoffDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(':', '');
    
    return { day: dayStr, time: timeStr };
}

/**
 * Determine fixture state and styling
 * @param {Object} fixture - Fixture object
 * @returns {Object} State info with styling
 */
function getFixtureState(fixture) {
    // Check if postponed (no event assigned or no kickoff_time)
    // Note: event can be null for postponed fixtures, but they might still be in the target GW filter
    if (!fixture.event || !fixture.kickoff_time) {
        return {
            state: 'POSTPONED',
            homeDisplay: 'PP',
            awayDisplay: 'PP',
            homeScore: null,
            awayScore: null,
            bgColor: 'transparent',
            textColor: 'var(--text-secondary)',
            opacity: 0.6
        };
    }

    const isFinished = fixture.finished === true;
    const isStarted = fixture.started === true;
    const isLive = isStarted && !isFinished;

    if (isLive) {
        // LIVE state
        return {
            state: 'LIVE',
            homeDisplay: fixture.team_h_score !== null ? fixture.team_h_score : '-',
            awayDisplay: fixture.team_a_score !== null ? fixture.team_a_score : '-',
            homeScore: fixture.team_h_score,
            awayScore: fixture.team_a_score,
            bgColor: 'rgba(239, 68, 68, 0.1)',
            textColor: '#ef4444',
            opacity: 1,
            fontWeight: 'bold'
        };
    } else if (isFinished) {
        // FINISHED state
        return {
            state: 'FINISHED',
            homeDisplay: fixture.team_h_score !== null ? fixture.team_h_score : '-',
            awayDisplay: fixture.team_a_score !== null ? fixture.team_a_score : '-',
            homeScore: fixture.team_h_score,
            awayScore: fixture.team_a_score,
            bgColor: 'transparent',
            textColor: 'var(--text-secondary)',
            opacity: 0.6
        };
    } else {
        // UPCOMING state
        const kickoffDate = new Date(fixture.kickoff_time);
        const { day, time } = formatKickoffTime(kickoffDate);
        
        return {
            state: 'UPCOMING',
            homeDisplay: day,  // Day on home team line
            awayDisplay: time,  // Time on away team line
            homeScore: null,
            awayScore: null,
            bgColor: 'transparent',
            textColor: 'var(--text-primary)',
            opacity: 1
        };
    }
}

/**
 * Render a single fixture card
 * @param {Object} fixture - Fixture object
 * @param {Object} fplBootstrap - Bootstrap data
 * @param {boolean} isLast - Whether this is the last fixture card
 * @returns {string} HTML for fixture card
 */
function renderFixtureCard(fixture, fplBootstrap, isLast = false) {
    // Safety check for teams array
    if (!fplBootstrap?.teams || !Array.isArray(fplBootstrap.teams)) {
        return '';
    }

    const homeTeam = fplBootstrap.teams.find(t => t.id === fixture.team_h);
    const awayTeam = fplBootstrap.teams.find(t => t.id === fixture.team_a);

    if (!homeTeam || !awayTeam) {
        return '';
    }

    const homeShort = getTeamShortName(homeTeam);
    const awayShort = getTeamShortName(awayTeam);
    const state = getFixtureState(fixture);

    return `
        <div class="fixture-card" style="
            min-width: 55px;
            flex-shrink: 0;
            background: ${state.bgColor};
            border-radius: 0.4rem;
            padding: 0.25rem 0.2rem;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.1rem;
            ${!isLast ? 'border-right: 1px solid var(--border-color);' : ''}
        ">
            <div style="
                font-size: 0.5rem;
                font-weight: 600;
                color: ${state.textColor};
                opacity: ${state.opacity};
                text-align: left;
                line-height: 1.1;
                width: 100%;
            ">
                ${homeShort} ${state.homeDisplay}
            </div>
            <div style="
                font-size: 0.5rem;
                font-weight: 600;
                color: ${state.textColor};
                opacity: ${state.opacity};
                text-align: left;
                line-height: 1.1;
                width: 100%;
            ">
                ${awayShort} ${state.awayDisplay}
            </div>
        </div>
    `;
}

/**
 * Render fixtures ticker component
 * Shows current/next GW fixtures in horizontal scrolling row
 * @returns {string} HTML for fixtures ticker
 */
export function renderFixturesTicker() {
    try {
        const fplFixtures = getFixturesData; // This is a variable, not a function
        const fplBootstrap = getBootstrapData; // This is a variable, not a function
        const currentGW = getActiveGW();

        if (!fplFixtures || !fplBootstrap || !currentGW) {
            return '';
        }

        // Check if events array exists
        if (!fplBootstrap.events || !Array.isArray(fplBootstrap.events)) {
            return '';
        }

        // Check if fixtures is an array
        if (!Array.isArray(fplFixtures)) {
            return '';
        }

        // Determine which GW to show
        const currentEvent = fplBootstrap.events.find(e => e.id === currentGW);
        const isCurrentGWFinished = currentEvent?.finished || false;
        const targetGW = isCurrentGWFinished ? currentGW + 1 : currentGW;

        // Get fixtures for target GW
        // Include fixtures with event matching targetGW
        // Include postponed fixtures (event === null) if they're for the target GW
        let fixtures = fplFixtures.filter(f => f.event === targetGW);

    // Sort chronologically (postponed fixtures without kickoff_time go to end)
    fixtures.sort((a, b) => {
        // If both have kickoff_time, sort by time
        if (a.kickoff_time && b.kickoff_time) {
            return new Date(a.kickoff_time) - new Date(b.kickoff_time);
        }
        // Fixtures with kickoff_time come before those without
        if (a.kickoff_time && !b.kickoff_time) return -1;
        if (!a.kickoff_time && b.kickoff_time) return 1;
        // Both postponed, maintain original order
        return 0;
    });

    // If no fixtures found, try current GW as fallback
    if (fixtures.length === 0 && targetGW !== currentGW) {
        fixtures = fplFixtures.filter(f => f.event === currentGW);
        fixtures.sort((a, b) => {
            if (a.kickoff_time && b.kickoff_time) {
                return new Date(a.kickoff_time) - new Date(b.kickoff_time);
            }
            if (a.kickoff_time && !b.kickoff_time) return -1;
            if (!a.kickoff_time && b.kickoff_time) return 1;
            return 0;
        });
    }

    // If still no fixtures, return empty
    if (fixtures.length === 0) {
        return '';
    }

    // Render fixture cards
    const fixtureCards = fixtures
        .map((fixture, index) => {
            const isLast = index === fixtures.length - 1;
            return renderFixtureCard(fixture, fplBootstrap, isLast);
        })
        .join('');

    return `
        <div class="fixtures-ticker-container" style="
            width: 100%;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            padding: 0.4rem 0;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE/Edge */
        ">
            <div class="fixtures-ticker" style="
                display: flex;
                flex-direction: row;
                gap: 0;
                min-width: max-content;
            ">
                ${fixtureCards}
            </div>
        </div>
        <style>
            .fixtures-ticker-container::-webkit-scrollbar {
                display: none; /* Chrome/Safari */
            }
            </style>
    `;
    } catch (error) {
        console.error('Error rendering fixtures ticker:', error);
        // Return empty string on error to prevent breaking the page
        return '';
    }
}

