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

import { renderFixturePlayerStats } from '../fixturesTab.js';
import { escapeHtml } from '../../utils.js';
import { getGlassmorphism, getShadow, getMobileBorderRadius } from '../../styles/mobileDesignSystem.js';

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

    const homeShort = getTeamShortName(homeTeam);
    const awayShort = getTeamShortName(awayTeam);
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

    return `
        <div 
            class="fixture-card-ticker" 
            data-fixture-id="${fixture.id}"
            data-can-expand="${canShowStats}"
            style="
                min-width: 45px;
                flex-shrink: 0;
                background: ${cardBackground};
                border-radius: 0;
                padding: 0.1rem 0.2rem;
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 0rem 0.2rem;
                align-items: center;
                cursor: pointer;
                transition: background 0.2s ease;
                border-right: 0px solid var(--border-color);
            "
        >
            <div style="
                font-size: 0.5rem;
                font-weight: 600;
                color: ${state.textColor};
                opacity: ${state.opacity};
                text-align: left;
                line-height: 1.1;
            ">
                ${homeShort}
            </div>
            <div style="
                font-size: 0.5rem;
                font-weight: ${state.fontWeight || '600'};
                color: ${state.textColor};
                opacity: ${state.opacity};
                text-align: left;
                line-height: 1.1;
            ">
                ${state.homeDisplay}
            </div>
            <div style="
                font-size: 0.5rem;
                font-weight: 600;
                color: ${state.textColor};
                opacity: ${state.opacity};
                text-align: left;
                line-height: 1.1;
            ">
                ${awayShort}
            </div>
            <div style="
                font-size: 0.5rem;
                font-weight: ${state.fontWeight || '600'};
                color: ${state.textColor};
                opacity: ${state.opacity};
                text-align: left;
                line-height: 1.1;
            ">
                ${state.awayDisplay}
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
    console.log('🔍 showFixtureModal called with fixtureId:', fixtureId);
    
    // Make function globally available for onclick handlers
    if (typeof window !== 'undefined') {
        window.showFixtureModal = showFixtureModal;
    }
    
    const fplFixtures = getFixturesData;
    const fplBootstrap = getBootstrapData();

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

    // Get glassmorphism effects
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const glassEffect = getGlassmorphism(isDark, 'heavy');
    const shadow = getShadow('modal');
    const radius = getMobileBorderRadius('xlarge');

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
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
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
                        color: var(--text-secondary);
                        font-size: 0.875rem;
                        text-align: center;
                    ">
                        Fixture ID: ${fixtureId}
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
 * Show fixture info modal for upcoming fixtures
 * @param {number} fixtureId - Fixture ID
 */
function showFixtureInfoModal(fixtureId) {
    const fplFixtures = getFixturesData;
    const fplBootstrap = getBootstrapData();

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
    const fplBootstrap = getBootstrapData();
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
            } else {
                console.warn('Fixture cards not found after retries');
            }
            return;
        }

        console.log(`✅ Found ${fixtureCards.length} fixture cards, attaching listeners...`);

        // Attach click listener to each fixture card (same pattern as player rows)
        fixtureCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const fixtureId = parseInt(card.dataset.fixtureId);
                console.log('✅ Fixture card clicked, ID:', fixtureId);
                
                if (fixtureId) {
                    showFixtureModal(fixtureId);
                }
            });
        });

        console.log('✅ Fixture ticker listeners attached successfully');
    };

    tryAttach();
}

