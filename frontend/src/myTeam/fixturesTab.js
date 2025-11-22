/**
 * Fixtures Tab Rendering Module
 * Displays recent fixture results (desktop and mobile layouts)
 */

import {
    fplFixtures as getFixturesData,
    fplBootstrap as getBootstrapData,
    getActiveGW,
    getAllPlayers,
    isGameweekLive
} from '../data.js';

import { 
    escapeHtml, 
    getPositionShort,
    formatDecimal
} from '../utils.js';
import { getMatchStatus } from '../fixtures.js';

/**
 * Get top performers for a fixture (both teams)
 * @param {Object} fixture - Fixture object
 * @param {number} gameweek - Gameweek number
 * @param {boolean} isLive - Whether GW is live
 * @returns {Object} Top performers for home and away teams
 */
function getFixtureTopPerformers(fixture, gameweek, isLive) {
    const allPlayers = getAllPlayers();
    if (!allPlayers || allPlayers.length === 0) {
        return { home: [], away: [] };
    }

    // Filter players by team
    const homePlayers = allPlayers.filter(p => p.team === fixture.team_h);
    const awayPlayers = allPlayers.filter(p => p.team === fixture.team_a);

    // Get GW stats for each player
    const getPlayerGWStats = (player) => {
        const liveStats = player.live_stats;
        const gwStats = player.github_gw || {};
        
        // For live GWs, use live_stats if available
        // For finished GWs, use github_gw if available, otherwise event_points
        let gwPoints = 0;
        let minutes = 0;
        let goals = 0;
        let assists = 0;
        let bonus = 0;
        let bps = 0;
        
        if (isLive && liveStats) {
            // Live stats available during live GW
            gwPoints = liveStats.total_points || 0;
            minutes = liveStats.minutes || 0;
            goals = liveStats.goals_scored || 0;
            assists = liveStats.assists || 0;
            bonus = liveStats.provisional_bonus ?? liveStats.bonus ?? 0;
            bps = liveStats.bps || 0;
        } else if (gwStats.gw === gameweek || gwStats.total_points !== undefined) {
            // GitHub GW stats (finished GW)
            gwPoints = gwStats.total_points || 0;
            minutes = gwStats.minutes || 0;
            goals = gwStats.goals_scored || 0;
            assists = gwStats.assists || 0;
            bonus = gwStats.bonus || 0;
            bps = gwStats.bps || 0;
        } else if (player.event_points !== undefined && !isLive) {
            // Fallback to bootstrap event_points (only if GW is finished)
            gwPoints = player.event_points || 0;
            // For event_points, we don't have detailed stats, so skip if no points
            if (gwPoints === 0) return null;
        } else {
            // No stats available for this GW
            return null;
        }

        // Only return if player has points or meaningful stats
        if (gwPoints === 0 && minutes === 0 && goals === 0 && assists === 0) {
            return null;
        }

        return {
            player,
            points: gwPoints,
            minutes,
            goals,
            assists,
            bonus,
            bps
        };
    };

    // Process home and away players
    const homePerformers = homePlayers
        .map(getPlayerGWStats)
        .filter(p => p !== null)
        .sort((a, b) => b.points - a.points || b.bps - a.bps)
        .slice(0, 5); // Top 5 per team

    const awayPerformers = awayPlayers
        .map(getPlayerGWStats)
        .filter(p => p !== null)
        .sort((a, b) => b.points - a.points || b.bps - a.bps)
        .slice(0, 5); // Top 5 per team

    return {
        home: homePerformers,
        away: awayPerformers
    };
}

/**
 * Render player stats for a fixture (expandable section)
 * @param {Object} fixture - Fixture object
 * @param {number} gameweek - Gameweek number
 * @param {boolean} isLive - Whether GW is live
 * @param {boolean} isFinished - Whether fixture is finished
 * @param {boolean} isDesktop - Whether desktop layout
 * @param {Object} fplBootstrap - Bootstrap data for team names
 * @returns {string} HTML for player stats section
 */
function renderFixturePlayerStats(fixture, gameweek, isLive, isFinished, isDesktop, fplBootstrap) {
    // Only show for finished or live fixtures
    if (!isFinished && !isLive) {
        return '';
    }

    const performers = getFixtureTopPerformers(fixture, gameweek, isLive);
    
    // Don't show if no performers
    if (performers.home.length === 0 && performers.away.length === 0) {
        return '';
    }

    const renderPlayerRow = (performer) => {
        const { player, points, minutes, goals, assists, bonus, bps } = performer;
        const position = getPositionShort(player);
        
        return `
            <div style="
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.4rem 0.5rem;
                background: var(--bg-primary);
                border-radius: 0.25rem;
                font-size: 0.65rem;
                border-left: 2px solid var(--primary-color);
            ">
                <div style="font-weight: 700; min-width: 2.5rem; color: var(--primary-color);">${points}</div>
                <div style="font-weight: 600; color: var(--text-secondary); min-width: 2rem;">${position}</div>
                <div style="flex: 1; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(player.web_name)}</div>
                ${goals > 0 ? `<div style="color: #22c55e; font-weight: 700; min-width: 1.5rem; text-align: center;">⚽${goals}</div>` : ''}
                ${assists > 0 ? `<div style="color: #3b82f6; font-weight: 700; min-width: 1.5rem; text-align: center;">🎯${assists}</div>` : ''}
                ${bonus > 0 ? `<div style="color: #fbbf24; font-weight: 700; min-width: 1.5rem; text-align: center;">⭐${bonus}</div>` : ''}
                ${minutes > 0 ? `<div style="color: var(--text-secondary); font-size: 0.6rem; min-width: 2rem; text-align: right;">${minutes}'</div>` : ''}
            </div>
        `;
    };

    const homeStatsHTML = performers.home.length > 0 
        ? performers.home.map(renderPlayerRow).join('')
        : '<div style="padding: 0.5rem; color: var(--text-secondary); font-size: 0.65rem; text-align: center;">No stats</div>';

    const awayStatsHTML = performers.away.length > 0
        ? performers.away.map(renderPlayerRow).join('')
        : '<div style="padding: 0.5rem; color: var(--text-secondary); font-size: 0.65rem; text-align: center;">No stats</div>';

    const homeTeam = fplBootstrap?.teams?.find(t => t.id === fixture.team_h);
    const awayTeam = fplBootstrap?.teams?.find(t => t.id === fixture.team_a);

    return `
        <div id="fixture-stats-${fixture.id}" style="
            display: none;
            background: var(--bg-primary);
            border-top: 2px solid var(--border-color);
            padding: 0.75rem;
        ">
            <div style="
                display: grid;
                grid-template-columns: ${isDesktop ? '1fr 1fr' : '1fr'};
                gap: 0.75rem;
            ">
                <div>
                    <div style="
                        font-size: 0.7rem;
                        font-weight: 700;
                        color: var(--text-secondary);
                        margin-bottom: 0.5rem;
                        text-transform: uppercase;
                    ">
                        ${homeTeam?.short_name || 'Home'}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        ${homeStatsHTML}
                    </div>
                </div>
                <div>
                    <div style="
                        font-size: 0.7rem;
                        font-weight: 700;
                        color: var(--text-secondary);
                        margin-bottom: 0.5rem;
                        text-transform: uppercase;
                    ">
                        ${awayTeam?.short_name || 'Away'}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        ${awayStatsHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render fixtures tab (desktop)
 * @returns {string} HTML for fixtures tab
 */
export function renderFixturesTab() {
    const fplFixtures = getFixturesData;
    const fplBootstrap = getBootstrapData;
    const currentGW = getActiveGW();

    if (!fplFixtures || !fplBootstrap || !currentGW) {
        return `
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; text-align: center; margin-bottom: 2rem;">
                <p style="color: var(--text-secondary);">Loading fixtures data...</p>
            </div>
        `;
    }

    // Check if current GW is finished
    const currentEvent = fplBootstrap?.events?.find(e => e.id === currentGW);
    const isCurrentGWFinished = currentEvent?.finished || false;
    const nextGW = currentGW + 1;
    
    // Get fixtures: if current GW finished, include next GW at top
    const gwToShow = isCurrentGWFinished ? [nextGW, currentGW, currentGW - 1] : [currentGW, currentGW - 1];
    const recentFixtures = fplFixtures
        .filter(f => gwToShow.includes(f.event))
        .sort((a, b) => {
            // Sort by event (GW) descending, then by kickoff time ascending (chronological)
            if (b.event !== a.event) return b.event - a.event;
            return new Date(a.kickoff_time) - new Date(b.kickoff_time);
        });

    // Group fixtures by GW
    const fixturesByGW = {};
    recentFixtures.forEach(f => {
        if (!fixturesByGW[f.event]) {
            fixturesByGW[f.event] = [];
        }
        fixturesByGW[f.event].push(f);
    });

    const gwSections = Object.keys(fixturesByGW)
        .sort((a, b) => b - a) // Sort GWs descending
        .map(gw => {
            const fixtures = fixturesByGW[gw];

            const fixturesHTML = fixtures.map(fixture => {
                const homeTeam = fplBootstrap.teams.find(t => t.id === fixture.team_h);
                const awayTeam = fplBootstrap.teams.find(t => t.id === fixture.team_a);

                const homeScore = fixture.team_h_score !== null ? fixture.team_h_score : '-';
                const awayScore = fixture.team_a_score !== null ? fixture.team_a_score : '-';
                const isFinished = fixture.finished;
                const isStarted = fixture.started;
                const isLive = isStarted && !isFinished;
                const canShowStats = isFinished || isLive; // Only show stats for finished or live fixtures

                // Format kickoff time
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

                // Status badge - use getMatchStatus for consistency
                // Get a sample player from one of the teams to use getMatchStatus
                const sampleHomePlayer = getAllPlayers().find(p => p.team === fixture.team_h);
                let statusBadge = '';
                
                if (isFinished) {
                    // Try to get minutes from a player who played
                    let minutes = null;
                    if (sampleHomePlayer) {
                        const matchStatus = getMatchStatus(fixture.team_h, fixture.event, sampleHomePlayer);
                        const minutesMatch = matchStatus.match(/\((\d+)\)/);
                        if (minutesMatch) {
                            minutes = parseInt(minutesMatch[1]);
                        }
                    }
                    statusBadge = minutes !== null 
                        ? `<span style="color: #22c55e; font-weight: 600; font-size: 0.75rem;">FT (${minutes})</span>`
                        : '<span style="color: #22c55e; font-weight: 600; font-size: 0.75rem;">FT</span>';
                } else if (isStarted && !isFinished) {
                    statusBadge = '<span style="color: #ef4444; font-weight: 600; font-size: 0.75rem;">LIVE</span>';
                }

                // Expand/collapse icon if stats available
                const expandIcon = canShowStats 
                    ? '<i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 0.5rem; transition: transform 0.2s;"></i>'
                    : '';

                const statsSection = canShowStats 
                    ? renderFixturePlayerStats(fixture, fixture.event, isLive, isFinished, true, fplBootstrap)
                    : '';

                return `
                    <tr 
                        class="fixture-row" 
                        data-fixture-id="${fixture.id}"
                        data-can-expand="${canShowStats}"
                        style="
                            border-bottom: 1px solid var(--border-color); 
                            ${isLive ? 'background: rgba(239, 68, 68, 0.05);' : ''}
                            ${canShowStats ? 'cursor: pointer;' : ''}
                        "
                    >
                        <td style="padding: 1rem 0.75rem; color: var(--text-secondary); font-size: 0.875rem; white-space: nowrap;">
                            ${timeStr}
                        </td>
                        <td style="padding: 1rem 0.75rem; text-align: right; font-weight: 600;">
                            ${escapeHtml(homeTeam?.name || 'TBD')}
                        </td>
                        <td style="padding: 1rem 0.75rem; text-align: center; font-weight: 700; font-size: 1.125rem; min-width: 80px;">
                            <span style="color: ${isFinished ? 'var(--text-primary)' : 'var(--text-secondary)'};">
                                ${homeScore} - ${awayScore}
                            </span>
                        </td>
                        <td style="padding: 1rem 0.75rem; text-align: left; font-weight: 600;">
                            ${escapeHtml(awayTeam?.name || 'TBD')}
                        </td>
                        <td style="padding: 1rem 0.75rem; text-align: center;">
                            ${statusBadge}${expandIcon}
                        </td>
                    </tr>
                    ${canShowStats ? `<tr><td colspan="5" style="padding: 0;">${statsSection}</td></tr>` : ''}
                `;
            }).join('');

            return `
                <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                        <i class="fas fa-calendar-alt"></i> Gameweek ${gw}
                    </h3>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                            <thead style="background: var(--primary-color); color: white;">
                                <tr>
                                    <th style="text-align: left; padding: 0.75rem; border-radius: 6px 0 0 0;">Kickoff</th>
                                    <th style="text-align: right; padding: 0.75rem;">Home</th>
                                    <th style="text-align: center; padding: 0.75rem;">Score</th>
                                    <th style="text-align: left; padding: 0.75rem;">Away</th>
                                    <th style="text-align: center; padding: 0.75rem; border-radius: 0 6px 0 0;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${fixturesHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');

    return gwSections || `
        <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; text-align: center; margin-bottom: 2rem;">
            <p style="color: var(--text-secondary);">No recent fixtures found.</p>
        </div>
    `;
}

/**
 * Attach event listeners for expandable fixture rows (desktop)
 */
export function attachFixtureRowListeners() {
    // Use event delegation on the fixtures container
    const fixturesContainer = document.getElementById('app-container');
    if (!fixturesContainer) return;

    fixturesContainer.addEventListener('click', (e) => {
        const row = e.target.closest('.fixture-row');
        if (!row) return;

        const canExpand = row.getAttribute('data-can-expand') === 'true';
        if (!canExpand) return;

        const fixtureId = row.getAttribute('data-fixture-id');
        if (!fixtureId) return;

        toggleFixtureStats(fixtureId);
    });
}

/**
 * Toggle fixture stats visibility
 */
function toggleFixtureStats(fixtureId) {
    const statsDiv = document.getElementById('fixture-stats-' + fixtureId);
    const row = document.querySelector(`[data-fixture-id="${fixtureId}"]`);
    if (!statsDiv || !row) return;

    const icon = row.querySelector('.fa-chevron-down');
    const isVisible = statsDiv.style.display !== 'none';
    
    statsDiv.style.display = isVisible ? 'none' : 'block';
    if (icon) {
        icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

/**
 * Render fixtures tab (mobile)
 * @returns {string} HTML for mobile fixtures tab
 */
export function renderMobileFixturesTab() {
    const fplFixtures = getFixturesData;
    const fplBootstrap = getBootstrapData;
    const currentGW = getActiveGW();

    if (!fplFixtures || !fplBootstrap || !currentGW) {
        return `
            <div style="padding: 1rem; text-align: center;">
                <p style="color: var(--text-secondary);">Loading fixtures data...</p>
            </div>
        `;
    }

    // Check if current GW is finished
    const currentEvent = fplBootstrap?.events?.find(e => e.id === currentGW);
    const isCurrentGWFinished = currentEvent?.finished || false;
    const nextGW = currentGW + 1;
    
    // Get fixtures: if current GW finished, include next GW at top
    const gwToShow = isCurrentGWFinished ? [nextGW, currentGW, currentGW - 1] : [currentGW, currentGW - 1];
    const recentFixtures = fplFixtures
        .filter(f => gwToShow.includes(f.event))
        .sort((a, b) => {
            // Sort by event (GW) descending, then by kickoff time ascending (chronological)
            if (b.event !== a.event) return b.event - a.event;
            return new Date(a.kickoff_time) - new Date(b.kickoff_time);
        });

    // Group fixtures by GW
    const fixturesByGW = {};
    recentFixtures.forEach(f => {
        if (!fixturesByGW[f.event]) {
            fixturesByGW[f.event] = [];
        }
        fixturesByGW[f.event].push(f);
    });

    const gwSections = Object.keys(fixturesByGW)
        .sort((a, b) => b - a)
        .map(gw => {
            const fixtures = fixturesByGW[gw];

            const fixturesHTML = fixtures.map(fixture => {
                const homeTeam = fplBootstrap.teams.find(t => t.id === fixture.team_h);
                const awayTeam = fplBootstrap.teams.find(t => t.id === fixture.team_a);

                const homeScore = fixture.team_h_score !== null ? fixture.team_h_score : '-';
                const awayScore = fixture.team_a_score !== null ? fixture.team_a_score : '-';
                const isFinished = fixture.finished;
                const isStarted = fixture.started;
                const isLive = isStarted && !isFinished;
                const canShowStats = isFinished || isLive; // Only show stats for finished or live fixtures

                const kickoffDate = new Date(fixture.kickoff_time);
                const timeStr = kickoffDate.toLocaleString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                // Status badge - use getMatchStatus for consistency
                const sampleHomePlayer = getAllPlayers().find(p => p.team === fixture.team_h);
                let statusBadge = '';
                
                if (isFinished) {
                    // Try to get minutes from a player who played
                    let minutes = null;
                    if (sampleHomePlayer) {
                        const matchStatus = getMatchStatus(fixture.team_h, fixture.event, sampleHomePlayer);
                        const minutesMatch = matchStatus.match(/\((\d+)\)/);
                        if (minutesMatch) {
                            minutes = parseInt(minutesMatch[1]);
                        }
                    }
                    statusBadge = minutes !== null 
                        ? `<span style="color: #22c55e; font-weight: 600; font-size: 0.65rem;">FT (${minutes})</span>`
                        : '<span style="color: #22c55e; font-weight: 600; font-size: 0.65rem;">FT</span>';
                } else if (isStarted && !isFinished) {
                    statusBadge = '<span style="color: #ef4444; font-weight: 600; font-size: 0.65rem;">LIVE</span>';
                }

                // Expand/collapse icon if stats available
                const expandIcon = canShowStats 
                    ? '<i class="fas fa-chevron-down" style="font-size: 0.6rem; margin-left: 0.25rem; transition: transform 0.2s;"></i>'
                    : '';

                return `
                    <div>
                        <div 
                            class="mobile-table-row mobile-table-fixtures fixture-row-mobile" 
                            data-fixture-id="${fixture.id}"
                            data-can-expand="${canShowStats}"
                            style="
                                background: ${isLive ? 'rgba(239, 68, 68, 0.05)' : 'transparent'};
                                ${canShowStats ? 'cursor: pointer;' : ''}
                            "
                        >
                            <div style="color: var(--text-secondary); font-size: 0.6rem; white-space: nowrap;">${timeStr.split(',')[1] || timeStr}</div>
                            <div style="text-align: right; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${homeTeam?.short_name || 'TBD'}
                            </div>
                            <div style="text-align: center; font-weight: 700; color: ${isFinished ? 'var(--text-primary)' : 'var(--text-secondary)'};">
                                ${homeScore}-${awayScore}
                            </div>
                            <div style="text-align: left; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${awayTeam?.short_name || 'TBD'}
                            </div>
                            <div style="text-align: center;">
                                ${statusBadge}${expandIcon}
                            </div>
                        </div>
                        ${canShowStats ? renderFixturePlayerStats(fixture, fixture.event, isLive, isFinished, false, fplBootstrap) : ''}
                    </div>
                `;
            }).join('');

            // Mobile header row
            const headerRow = `
                <div class="mobile-table-header mobile-table-header-sticky mobile-table-header-purple mobile-table-fixtures" style="top: calc(3.5rem + env(safe-area-inset-top));">
                    <div>Time</div>
                    <div style="text-align: right;">Home</div>
                    <div style="text-align: center;">Score</div>
                    <div style="text-align: left;">Away</div>
                    <div style="text-align: center;">Status</div>
                </div>
            `;

            return `
                <div style="margin-bottom: 1rem;">
                    <div style="padding: 0.5rem 0.75rem; background: var(--bg-secondary); margin-bottom: 0.25rem;">
                        <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                            <i class="fas fa-calendar-alt"></i> Gameweek ${gw}
                        </h4>
                    </div>
                    ${headerRow}
                    ${fixturesHTML}
                </div>
            `;
        }).join('');

    return gwSections || `
        <div style="padding: 2rem; text-align: center;">
            <p style="color: var(--text-secondary);">No recent fixtures found.</p>
        </div>
    `;
}

/**
 * Attach event listeners for expandable fixture rows (mobile)
 */
export function attachMobileFixtureRowListeners() {
    // Use event delegation on the fixtures container
    const fixturesContainer = document.getElementById('app-container');
    if (!fixturesContainer) return;

    fixturesContainer.addEventListener('click', (e) => {
        const row = e.target.closest('.fixture-row-mobile');
        if (!row) return;

        const canExpand = row.getAttribute('data-can-expand') === 'true';
        if (!canExpand) return;

        const fixtureId = row.getAttribute('data-fixture-id');
        if (!fixtureId) return;

        toggleFixtureStats(fixtureId);
    });
}
