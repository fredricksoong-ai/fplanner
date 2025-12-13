// ============================================================================
// COMPACT FIXTURES TICKER
// Horizontal scrolling fixtures list for mobile view
// Shows current/next GW fixtures in chronological order
// ============================================================================

import {
    fplFixtures as getFixturesData,
    fplBootstrap as getBootstrapData,
    getActiveGW,
    getAllPlayers,
    isGameweekLive
} from '../../data.js';

import { renderFixturePlayerStats } from '../fixturesTab.js';
import { escapeHtml, getDifficultyClass } from '../../utils.js';
import { getGlassmorphism, getShadow, getMobileBorderRadius } from '../../styles/mobileDesignSystem.js';
import { getMatchStatus } from '../../fixtures.js';
import { renderTeamLogo } from '../../utils/teamLogos.js';

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
            middleDisplay: 'PP',
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
        const homeScore = fixture.team_h_score !== null ? fixture.team_h_score : '-';
        const awayScore = fixture.team_a_score !== null ? fixture.team_a_score : '-';
        return {
            state: 'LIVE',
            middleDisplay: `${homeScore}-${awayScore}`,
            homeScore: fixture.team_h_score,
            awayScore: fixture.team_a_score,
            bgColor: 'rgba(239, 68, 68, 0.1)',
            textColor: '#ef4444',
            opacity: 1,
            fontWeight: 'bold'
        };
    } else if (isFinished) {
        // FINISHED state
        const homeScore = fixture.team_h_score !== null ? fixture.team_h_score : '-';
        const awayScore = fixture.team_a_score !== null ? fixture.team_a_score : '-';
        return {
            state: 'FINISHED',
            middleDisplay: `${homeScore}-${awayScore}`,
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
            middleDisplay: `${day} ${time}`,  // Combined day and time
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
 * @param {boolean} isEven - Whether this is an even-indexed fixture (for alternating backgrounds)
 * @returns {string} HTML for fixture card
 */
function renderFixtureCard(fixture, fplBootstrap, isLast = false, isEven = false) {
    // Safety check for teams array
    if (!fplBootstrap?.teams || !Array.isArray(fplBootstrap.teams)) {
        return '';
    }

    const homeTeam = fplBootstrap.teams.find(t => t.id === fixture.team_h);
    const awayTeam = fplBootstrap.teams.find(t => t.id === fixture.team_a);

    if (!homeTeam || !awayTeam) {
        return '';
    }

    const state = getFixtureState(fixture);

    // Check if fixture has stats (live or finished)
    const isFinished = fixture.finished === true;
    const isStarted = fixture.started === true;
    const isLive = isStarted && !isFinished;
    const canShowStats = isFinished || isLive;

    // Apply state-based background - use base for upcoming, keep live red, alternating for finished
    let cardBackground;
    if (state.state === 'LIVE') {
        cardBackground = 'rgba(239, 68, 68, 0.1)';
    } else {
        // Apply alternating for all non-live fixtures (upcoming, finished, postponed)
        cardBackground = isEven ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)';
    }

    // Render team logos (fallback to short names if logos not available)
    const homeLogo = renderTeamLogo(homeTeam, { size: 20 });
    const awayLogo = renderTeamLogo(awayTeam, { size: 20 });

    // Set width based on fixture state
    // Upcoming needs more space for "SAT 2300" format
    // Live/Finished/Postponed are shorter (scores like "1-1" or "PP")
    const cardWidth = state.state === 'UPCOMING' ? '130px' : '100px';

    return `
        <div 
            class="fixture-card-ticker" 
            data-fixture-id="${fixture.id}"
            data-can-expand="${canShowStats}"
            style="
                width: ${cardWidth};
                min-width: ${cardWidth};
                flex-shrink: 0;
                background: ${cardBackground};
                border-radius: 0;
                padding: 0.3rem 0.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                cursor: pointer;
                transition: background 0.2s ease;
                border-right: 0px solid var(--border-color);
            "
        >
            <!-- Home Logo -->
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            ">
                ${homeLogo}
            </div>
            
            <!-- Middle Display (Date/Time, Score, or PP) -->
            <div style="
                font-size: 0.5rem;
                font-weight: ${state.fontWeight || '600'};
                color: ${state.textColor};
                opacity: ${state.opacity};
                text-align: center;
                white-space: nowrap;
                flex-shrink: 0;
            ">
                ${state.middleDisplay}
            </div>
            
            <!-- Away Logo -->
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            ">
                ${awayLogo}
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

    // Sort by state priority, then chronologically within each state
    // Priority: UPCOMING < LIVE < FINISHED < POSTPONED
    fixtures.sort((a, b) => {
        const stateA = getFixtureState(a);
        const stateB = getFixtureState(b);
        
        // Define state priority: UPCOMING < LIVE < FINISHED < POSTPONED
        const statePriority = {
            'UPCOMING': 1,
            'LIVE': 2,
            'FINISHED': 3,
            'POSTPONED': 4
        };
        
        const priorityA = statePriority[stateA.state] || 99;
        const priorityB = statePriority[stateB.state] || 99;
        
        // If different states, sort by priority
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        
        // Same state - sort chronologically by kickoff_time
        if (a.kickoff_time && b.kickoff_time) {
            return new Date(a.kickoff_time) - new Date(b.kickoff_time);
        }
        
        // Fixtures with kickoff_time come before those without
        if (a.kickoff_time && !b.kickoff_time) return -1;
        if (!a.kickoff_time && b.kickoff_time) return 1;
        
        // Both postponed/no time, maintain original order
        return 0;
    });

    // If no fixtures found, try current GW as fallback
    if (fixtures.length === 0 && targetGW !== currentGW) {
        fixtures = fplFixtures.filter(f => f.event === currentGW);
        fixtures.sort((a, b) => {
            const stateA = getFixtureState(a);
            const stateB = getFixtureState(b);
            
            // Define state priority: UPCOMING < LIVE < FINISHED < POSTPONED
            const statePriority = {
                'UPCOMING': 1,
                'LIVE': 2,
                'FINISHED': 3,
                'POSTPONED': 4
            };
            
            const priorityA = statePriority[stateA.state] || 99;
            const priorityB = statePriority[stateB.state] || 99;
            
            // If different states, sort by priority
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            
            // Same state - sort chronologically by kickoff_time
            if (a.kickoff_time && b.kickoff_time) {
                return new Date(a.kickoff_time) - new Date(b.kickoff_time);
            }
            
            // Fixtures with kickoff_time come before those without
            if (a.kickoff_time && !b.kickoff_time) return -1;
            if (!a.kickoff_time && b.kickoff_time) return 1;
            
            // Both postponed/no time, maintain original order
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
            const isEven = index % 2 === 0;
            return renderFixtureCard(fixture, fplBootstrap, isLast, isEven);
        })
        .join('');

    // Make showFixtureModal globally available
    if (typeof window !== 'undefined') {
        window.showFixtureModal = showFixtureModal;
    }

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

/**
 * Show fixture modal (basic structure)
 * @param {number} fixtureId - Fixture ID
 */
export function showFixtureModal(fixtureId) {
    try {
        const fplFixtures = getFixturesData;
        const fplBootstrap = getBootstrapData;

        if (!fplFixtures || !fplBootstrap) {
            console.warn('Cannot show fixture modal: data not available');
            return;
        }

        // Find the fixture
        const fixture = fplFixtures.find(f => f.id === fixtureId);
        
        if (!fixture) {
            console.warn(`Fixture ${fixtureId} not found`);
            return;
        }

        const homeTeam = fplBootstrap.teams.find(t => t.id === fixture.team_h);
        const awayTeam = fplBootstrap.teams.find(t => t.id === fixture.team_a);

        if (!homeTeam || !awayTeam) {
            console.warn('Teams not found for fixture');
            return;
        }

    // Determine fixture state
    const isFinished = fixture.finished === true;
    const isStarted = fixture.started === true;
    const isLive = isStarted && !isFinished;
    const isPostponed = !fixture.event || !fixture.kickoff_time;
    const gameweek = fixture.event || getActiveGW();
    const isGWLive = isGameweekLive(gameweek);

    // Get glassmorphism effects
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const glassEffect = getGlassmorphism(isDark, 'heavy');
    const shadow = getShadow('modal');
    const radius = getMobileBorderRadius('xlarge');

    // Build header content based on state
    let headerContent = '';
    let mainContent = '';

    if (isPostponed) {
        // Postponed fixture
        const homeLogo = renderTeamLogo(homeTeam, { size: 32 });
        const awayLogo = renderTeamLogo(awayTeam, { size: 32 });
        
        headerContent = `
            <div style="text-align: center; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    ${homeLogo}
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">
                        ${escapeHtml(homeTeam.name)} vs ${escapeHtml(awayTeam.name)}
                    </div>
                    ${awayLogo}
                </div>
                <div style="color: var(--text-secondary); font-size: 0.875rem;">
                    Postponed
                </div>
            </div>
        `;
        mainContent = `
            <div style="text-align: center; color: var(--text-secondary); font-size: 0.875rem; padding: 2rem 0;">
                This fixture has been postponed.
            </div>
        `;
    } else if (isLive || isFinished) {
        // Live or finished fixture - show score and stats
        const homeScore = fixture.team_h_score !== null ? fixture.team_h_score : '-';
        const awayScore = fixture.team_a_score !== null ? fixture.team_a_score : '-';
        
        // Get live status (minutes played)
        let statusBadge = '';
        if (isLive) {
            const allPlayers = getAllPlayers();
            const samplePlayer = allPlayers.find(p => p.team === fixture.team_h);
            if (samplePlayer) {
                const matchStatus = getMatchStatus(fixture.team_h, gameweek, samplePlayer);
                statusBadge = `<span style="color: #ef4444; font-weight: 600; font-size: 0.75rem;">${matchStatus}</span>`;
            } else {
                statusBadge = '<span style="color: #ef4444; font-weight: 600; font-size: 0.75rem;">LIVE</span>';
            }
        } else if (isFinished) {
            statusBadge = '<span style="color: #22c55e; font-weight: 600; font-size: 0.75rem;">FT</span>';
        }

        const homeLogo = renderTeamLogo(homeTeam, { size: 32 });
        const awayLogo = renderTeamLogo(awayTeam, { size: 32 });

        headerContent = `
            <div style="text-align: center; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    ${homeLogo}
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                        ${escapeHtml(homeTeam.name)} vs ${escapeHtml(awayTeam.name)}
                    </div>
                    ${awayLogo}
                </div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 0.5rem;">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">
                        ${homeScore}
                    </div>
                    <div style="font-size: 1rem; color: var(--text-secondary);">-</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">
                        ${awayScore}
                    </div>
                </div>
                ${statusBadge ? `<div style="margin-top: 0.5rem;">${statusBadge}</div>` : ''}
            </div>
        `;

        // Get player stats
        const playerStatsHTML = renderFixturePlayerStats(fixture, gameweek, isGWLive, isFinished, false, fplBootstrap);
        // Remove the display:none and transition styles from the stats section since we're showing it directly
        const statsContent = playerStatsHTML.replace(/display:\s*none[^;]*;?/g, '').replace(/opacity:\s*0[^;]*;?/g, '').replace(/max-height:\s*0[^;]*;?/g, '').replace(/transition:[^;]*;?/g, '');
        
        mainContent = statsContent || `
            <div style="text-align: center; color: var(--text-secondary); font-size: 0.875rem; padding: 2rem 0;">
                Stats will be available after the match starts.
            </div>
        `;
    } else {
        // Upcoming fixture - show kickoff time and difficulty
        const kickoffDate = new Date(fixture.kickoff_time);
        const now = new Date();
        const isToday = kickoffDate.toDateString() === now.toDateString();
        
        const timeStr = kickoffDate.toLocaleString('en-GB', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const homeDifficulty = fixture.team_h_difficulty || 3;
        const awayDifficulty = fixture.team_a_difficulty || 3;
        
        const homeLogo = renderTeamLogo(homeTeam, { size: 32 });
        const awayLogo = renderTeamLogo(awayTeam, { size: 32 });

        headerContent = `
            <div style="text-align: center; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    ${homeLogo}
                    <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">
                        ${escapeHtml(homeTeam.name)} vs ${escapeHtml(awayTeam.name)}
                    </div>
                    ${awayLogo}
                </div>
                <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.75rem;">
                    ${isToday ? 'Today' : timeStr}
                </div>
            </div>
        `;

        mainContent = `
            <div style="background: var(--bg-secondary); border-radius: 0.5rem; padding: 1rem;">
                <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase;">
                    Fixture Difficulty
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-primary); font-size: 0.875rem;">${escapeHtml(homeTeam.name)} (H)</span>
                    <span class="${getDifficultyClass(homeDifficulty)}" style="
                        display: inline-block;
                        width: 1.5rem;
                        height: 1.5rem;
                        border-radius: 0.25rem;
                        text-align: center;
                        line-height: 1.5rem;
                        font-weight: 700;
                        font-size: 0.75rem;
                    ">${homeDifficulty}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-primary); font-size: 0.875rem;">${escapeHtml(awayTeam.name)} (A)</span>
                    <span class="${getDifficultyClass(awayDifficulty)}" style="
                        display: inline-block;
                        width: 1.5rem;
                        height: 1.5rem;
                        border-radius: 0.25rem;
                        text-align: center;
                        line-height: 1.5rem;
                        font-weight: 700;
                        font-size: 0.75rem;
                    ">${awayDifficulty}</span>
                </div>
            </div>
        `;
    }

    // Create or get modal
    let modal = document.getElementById('fixture-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fixture-modal';
        document.body.appendChild(modal);
    }

    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="fixture-modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            z-index: 2000;
            overflow-y: auto;
        ">
            <div style="
                max-width: 600px;
                margin: 0 auto;
                padding: 1rem;
                min-height: 100%;
                display: flex;
                flex-direction: column;
            ">
                <!-- Modal Content -->
                <div style="
                    backdrop-filter: ${glassEffect.backdropFilter};
                    -webkit-backdrop-filter: ${glassEffect.WebkitBackdropFilter};
                    background: ${glassEffect.background};
                    border: ${glassEffect.border};
                    padding: 1rem;
                    border-radius: ${radius};
                    box-shadow: ${shadow};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div style="flex: 1;">
                            ${headerContent}
                        </div>
                        <button class="close-fixture-modal-btn" style="
                            background: transparent;
                            border: none;
                            color: var(--text-secondary);
                            font-size: 1.5rem;
                            cursor: pointer;
                            padding: 0;
                            width: 2rem;
                            height: 2rem;
                            line-height: 1;
                            flex-shrink: 0;
                        ">
                            ×
                        </button>
                    </div>
                    ${mainContent}
                </div>
            </div>
        </div>
    `;

    // Add close handlers
    const closeBtn = modal.querySelector('.close-fixture-modal-btn');
    const overlay = modal.querySelector('.fixture-modal-overlay');

    const closeModal = () => {
        modal.style.display = 'none';
        modal.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    } catch (error) {
        console.error('Error in showFixtureModal:', error);
    }
}

/**
 * Show fixture info modal for upcoming fixtures
 * @param {number} fixtureId - Fixture ID
 */
function showFixtureInfoModal(fixtureId) {
    const fplFixtures = getFixturesData;
    const fplBootstrap = getBootstrapData;

    if (!fplFixtures || !fplBootstrap) {
        console.warn('Cannot show fixture modal: data not available');
        return;
    }

    // Find the fixture
    const fixture = fplFixtures.find(f => f.id === fixtureId);
    if (!fixture) {
        console.warn(`Fixture ${fixtureId} not found`);
        return;
    }

    const homeTeam = fplBootstrap.teams.find(t => t.id === fixture.team_h);
    const awayTeam = fplBootstrap.teams.find(t => t.id === fixture.team_a);

    if (!homeTeam || !awayTeam || !fixture.kickoff_time) {
        console.warn('Fixture data incomplete');
        return;
    }

    const kickoffDate = new Date(fixture.kickoff_time);
    const dateStr = kickoffDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const timeStr = kickoffDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // Get glassmorphism effects
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const glassEffect = getGlassmorphism(isDark, 'heavy');
    const shadow = getShadow('modal');
    const radius = getMobileBorderRadius('xlarge');

    // Create or get modal
    let modal = document.getElementById('fixture-stats-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fixture-stats-modal';
        document.body.appendChild(modal);
    }

    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="fixture-modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            z-index: 2000;
            overflow-y: auto;
        ">
            <div style="
                max-width: 600px;
                margin: 0 auto;
                padding: 1rem;
                min-height: 100%;
                display: flex;
                flex-direction: column;
            ">
                <!-- Header -->
                <div style="
                    backdrop-filter: ${glassEffect.backdropFilter};
                    -webkit-backdrop-filter: ${glassEffect.WebkitBackdropFilter};
                    background: ${glassEffect.background};
                    border: ${glassEffect.border};
                    padding: 1rem;
                    border-radius: ${radius};
                    box-shadow: ${shadow};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <h3 style="
                            font-size: 1rem;
                            font-weight: 700;
                            color: var(--text-primary);
                            margin: 0;
                        ">
                            ${escapeHtml(homeTeam.name)} vs ${escapeHtml(awayTeam.name)}
                        </h3>
                        <button class="close-fixture-modal-btn" style="
                            background: transparent;
                            border: none;
                            color: var(--text-secondary);
                            font-size: 1.5rem;
                            cursor: pointer;
                            padding: 0;
                            width: 2rem;
                            height: 2rem;
                            line-height: 1;
                        ">
                            ×
                        </button>
                    </div>
                    <div style="
                        text-align: center;
                        color: var(--text-secondary);
                        font-size: 0.875rem;
                        margin-top: 1rem;
                    ">
                        <div style="margin-bottom: 0.5rem;">${dateStr}</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${timeStr}</div>
                    </div>
                    <div style="
                        text-align: center;
                        color: var(--text-secondary);
                        font-size: 0.75rem;
                        margin-top: 1rem;
                        font-style: italic;
                    ">
                        Match stats will be available once the game starts
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add close handlers
    const closeBtn = modal.querySelector('.close-fixture-modal-btn');
    const overlay = modal.querySelector('.fixture-modal-overlay');

    const closeModal = () => {
        modal.style.display = 'none';
        modal.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

/**
 * Show fixture stats in a modal
 * @param {number} fixtureId - Fixture ID
 */
export function showFixtureStatsModal(fixtureId) {
    const fplFixtures = getFixturesData;
    const fplBootstrap = getBootstrapData;
    const currentGW = getActiveGW();

    if (!fplFixtures || !fplBootstrap || !currentGW) {
        console.warn('Cannot show fixture modal: data not available');
        return;
    }

    // Find the fixture
    const fixture = fplFixtures.find(f => f.id === fixtureId);
    if (!fixture) {
        console.warn(`Fixture ${fixtureId} not found`);
        return;
    }

    const homeTeam = fplBootstrap.teams.find(t => t.id === fixture.team_h);
    const awayTeam = fplBootstrap.teams.find(t => t.id === fixture.team_a);

    if (!homeTeam || !awayTeam) {
        console.warn('Teams not found for fixture');
        return;
    }

    const isFinished = fixture.finished === true;
    const isStarted = fixture.started === true;
    const isLive = isStarted && !isFinished;
    const canShowStats = isFinished || isLive;

    if (!canShowStats) {
        // Fallback to info modal if stats not available
        showFixtureInfoModal(fixtureId);
        return;
    }

    const homeScore = fixture.team_h_score !== null ? fixture.team_h_score : '-';
    const awayScore = fixture.team_a_score !== null ? fixture.team_a_score : '-';

    // Get glassmorphism effects
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const glassEffect = getGlassmorphism(isDark, 'heavy');
    const shadow = getShadow('modal');
    const radius = getMobileBorderRadius('xlarge');

    // Render fixture stats
    const statsHTML = renderFixturePlayerStats(fixture, fixture.event || currentGW, isLive, isFinished, false, fplBootstrap);

    // Extract the inner content from the stats div (remove wrapper div with hidden styles)
    // The function returns a div with id="fixture-stats-{id}" that has display:none
    // We want to extract just the inner grid content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = statsHTML;
    const statsDiv = tempDiv.querySelector(`#fixture-stats-${fixture.id}`);
    const statsContent = statsDiv ? statsDiv.innerHTML : statsHTML;

    // Create or get modal
    let modal = document.getElementById('fixture-stats-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fixture-stats-modal';
        document.body.appendChild(modal);
    }

    const homeShort = getTeamShortName(homeTeam);
    const awayShort = getTeamShortName(awayTeam);

    let statusBadge = '';
    if (isFinished) {
        const fixtureMinutes = typeof fixture.minutes === 'number' && fixture.minutes > 0
            ? fixture.minutes
            : null;
        statusBadge = `<span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: rgba(34, 197, 94, 0.2); color: #22c55e;">FT${fixtureMinutes ? ` (${fixtureMinutes})` : ''}</span>`;
    } else if (isLive) {
        statusBadge = '<span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: rgba(239, 68, 68, 0.2); color: #ef4444;">LIVE</span>';
    }

    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="fixture-modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            z-index: 2000;
            overflow-y: auto;
        ">
            <div style="
                max-width: 600px;
                margin: 0 auto;
                padding: 1rem;
                min-height: 100%;
                display: flex;
                flex-direction: column;
            ">
                <!-- Header -->
                <div style="
                    backdrop-filter: ${glassEffect.backdropFilter};
                    -webkit-backdrop-filter: ${glassEffect.WebkitBackdropFilter};
                    background: ${glassEffect.background};
                    border: ${glassEffect.border};
                    padding: 1rem;
                    border-radius: ${radius} ${radius} 0 0;
                    border-bottom: ${glassEffect.border};
                    box-shadow: ${shadow};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <h3 style="
                            font-size: 1rem;
                            font-weight: 700;
                            color: var(--text-primary);
                            margin: 0;
                        ">
                            ${escapeHtml(homeTeam.name)} vs ${escapeHtml(awayTeam.name)}
                        </h3>
                        <button class="close-fixture-modal-btn" style="
                            background: transparent;
                            border: none;
                            color: var(--text-secondary);
                            font-size: 1.5rem;
                            cursor: pointer;
                            padding: 0;
                            width: 2rem;
                            height: 2rem;
                            line-height: 1;
                        ">
                            ×
                        </button>
                    </div>
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 1rem;
                        font-size: 1.25rem;
                        font-weight: 700;
                        color: var(--text-primary);
                    ">
                        <span>${homeShort}</span>
                        <span>${homeScore} - ${awayScore}</span>
                        <span>${awayShort}</span>
                    </div>
                    ${statusBadge ? `<div style="text-align: center; margin-top: 0.5rem;">${statusBadge}</div>` : ''}
                </div>
                <!-- Stats Content -->
                <div style="
                    backdrop-filter: ${glassEffect.backdropFilter};
                    -webkit-backdrop-filter: ${glassEffect.WebkitBackdropFilter};
                    background: ${glassEffect.background};
                    border: ${glassEffect.border};
                    padding: 1rem;
                    border-radius: 0 0 ${radius} ${radius};
                    box-shadow: ${shadow};
                    flex: 1;
                ">
                    ${statsContent}
                </div>
            </div>
        </div>
    `;

    // Add close handlers
    const closeBtn = modal.querySelector('.close-fixture-modal-btn');
    const overlay = modal.querySelector('.fixture-modal-overlay');

    const closeModal = () => {
        modal.style.display = 'none';
        modal.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

/**
 * Attach click listeners to fixture cards in the ticker
 * Follows the same pattern as attachPlayerRowListeners
 */
export function attachFixtureTickerListeners() {
    // Retry mechanism in case DOM isn't ready yet
    const tryAttach = (attempt = 0) => {
        const fixtureCards = document.querySelectorAll('.fixture-card-ticker');
        
        if (fixtureCards.length === 0) {
            if (attempt < 10) {
                // Retry after a short delay
                setTimeout(() => tryAttach(attempt + 1), 100);
            }
            return;
        }

        // Attach click listener to each fixture card
        fixtureCards.forEach((card) => {
            card.addEventListener('click', (e) => {
                const fixtureId = parseInt(card.dataset.fixtureId);
                
                if (fixtureId && !isNaN(fixtureId)) {
                    showFixtureModal(fixtureId);
                }
                
                e.stopPropagation();
            });
        });
    };

    tryAttach();
}

