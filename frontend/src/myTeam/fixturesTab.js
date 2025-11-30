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

    // Get the active GW for comparison
    const activeGW = getActiveGW();

    // Get GW stats for each player
    const getPlayerGWStats = (player) => {
        const liveStats = player.live_stats;
        const gwStats = player.github_gw || {};

        // For live GWs, use live_stats if available
        // For finished GWs, use github_gw if GW matches, otherwise event_points only for current GW
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
        } else if (gwStats.gw === gameweek) {
            // GitHub GW stats (must match the fixture's GW)
            gwPoints = gwStats.total_points || 0;
            minutes = gwStats.minutes || 0;
            goals = gwStats.goals_scored || 0;
            assists = gwStats.assists || 0;
            bonus = gwStats.bonus || 0;
            bps = gwStats.bps || 0;
        } else if (player.event_points !== undefined && !isLive && gameweek === activeGW) {
            // Fallback to bootstrap event_points only if fixture matches current active GW
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

    const allPlayers = getAllPlayers();
    if (!allPlayers || allPlayers.length === 0) {
        return '';
    }

    // Get all players from both teams
    const fixturePlayers = allPlayers.filter(p =>
        p.team === fixture.team_h || p.team === fixture.team_a
    );

    // Extract stats for each player
    const getPlayerStats = (player) => {
        const liveStats = player.live_stats;
        const gwStats = player.github_gw || {};

        let stats = {
            player,
            teamId: player.team,
            points: 0,
            minutes: 0,
            goals: 0,
            assists: 0,
            bonus: 0,
            bps: 0,
            yellowCards: 0,
            redCards: 0,
            saves: 0,
            penaltiesSaved: 0,
            penaltiesMissed: 0,
            cleanSheets: 0,
            goalsConceded: 0,
            ownGoals: 0
        };

        // Prefer live_stats if available (has bonus data during/after match)
        if (liveStats && liveStats.minutes > 0) {
            stats.points = liveStats.total_points || 0;
            stats.minutes = liveStats.minutes || 0;
            stats.goals = liveStats.goals_scored || 0;
            stats.assists = liveStats.assists || 0;
            stats.bonus = liveStats.bonus || liveStats.provisional_bonus || 0;
            stats.bps = liveStats.bps || 0;
            stats.yellowCards = liveStats.yellow_cards || 0;
            stats.redCards = liveStats.red_cards || 0;
            stats.saves = liveStats.saves || 0;
            stats.penaltiesSaved = liveStats.penalties_saved || 0;
            stats.penaltiesMissed = liveStats.penalties_missed || 0;
            stats.cleanSheets = liveStats.clean_sheets || 0;
            stats.goalsConceded = liveStats.goals_conceded || 0;
            stats.ownGoals = liveStats.own_goals || 0;
        } else if (gwStats.gw === gameweek) {
            stats.points = gwStats.total_points || 0;
            stats.minutes = gwStats.minutes || 0;
            stats.goals = gwStats.goals_scored || 0;
            stats.assists = gwStats.assists || 0;
            stats.bonus = gwStats.bonus || 0;
            stats.bps = gwStats.bps || 0;
            stats.yellowCards = gwStats.yellow_cards || 0;
            stats.redCards = gwStats.red_cards || 0;
            stats.saves = gwStats.saves || 0;
            stats.penaltiesSaved = gwStats.penalties_saved || 0;
            stats.penaltiesMissed = gwStats.penalties_missed || 0;
            stats.cleanSheets = gwStats.clean_sheets || 0;
            stats.goalsConceded = gwStats.goals_conceded || 0;
            stats.ownGoals = gwStats.own_goals || 0;
        }

        return stats;
    };

    const playerStats = fixturePlayers.map(getPlayerStats);

    // Helper to render a stat section
    const renderSection = (title, content) => {
        if (!content) return '';
        return `
            <div style="
                background: var(--bg-secondary);
                border-radius: 6px;
                padding: 0.625rem;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                border: 1px solid var(--border-color);
            ">
                <div style="
                    font-size: 0.625rem;
                    font-weight: 700;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                ">
                    ${title}
                </div>
                <div style="font-size: 0.7rem;">
                    ${content}
                </div>
            </div>
        `;
    };

    // Helper to render player item
    const renderPlayerItem = (name, value, color = 'var(--text-primary)') => {
        return `<div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.25rem 0;
            gap: 0.5rem;
        ">
            <span style="
                color: var(--text-primary);
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            ">${escapeHtml(name)}</span>
            <span style="
                font-weight: 700;
                color: ${color};
                flex-shrink: 0;
            ">${value}</span>
        </div>`;
    };

    // Goals
    const goalScorers = playerStats.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals);
    const goalsHtml = goalScorers.length > 0
        ? goalScorers.map(p => renderPlayerItem(p.player.web_name, p.goals, '#22c55e')).join('')
        : '<div style="color: var(--text-secondary); text-align: center;">-</div>';

    // Assists
    const assisters = playerStats.filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists);
    const assistsHtml = assisters.length > 0
        ? assisters.map(p => renderPlayerItem(p.player.web_name, p.assists, '#3b82f6')).join('')
        : '<div style="color: var(--text-secondary); text-align: center;">-</div>';

    // Bonus Points
    const bonusPlayers = playerStats.filter(p => p.bonus > 0).sort((a, b) => b.bonus - a.bonus);
    const bonusHtml = bonusPlayers.length > 0
        ? bonusPlayers.map(p => renderPlayerItem(p.player.web_name, p.bonus, '#fbbf24')).join('')
        : '<div style="color: var(--text-secondary); text-align: center;">-</div>';

    // Cards
    const cardedPlayers = playerStats.filter(p => p.yellowCards > 0 || p.redCards > 0)
        .sort((a, b) => (b.redCards * 2 + b.yellowCards) - (a.redCards * 2 + a.yellowCards));
    const cardsHtml = cardedPlayers.length > 0
        ? cardedPlayers.map(p => {
            let cardStr = '';
            if (p.yellowCards > 0) cardStr += `🟨${p.yellowCards > 1 ? p.yellowCards : ''}`;
            if (p.redCards > 0) cardStr += `🟥${p.redCards > 1 ? p.redCards : ''}`;
            return renderPlayerItem(p.player.web_name, cardStr);
        }).join('')
        : '<div style="color: var(--text-secondary); text-align: center;">-</div>';

    // BPS Rankings (top 10)
    const bpsRanked = playerStats.filter(p => p.bps > 0).sort((a, b) => b.bps - a.bps).slice(0, 10);
    const bpsHtml = bpsRanked.length > 0
        ? bpsRanked.map(p => renderPlayerItem(p.player.web_name, p.bps, '#a78bfa')).join('')
        : '<div style="color: var(--text-secondary); text-align: center;">-</div>';

    // Defensive Contributions (clean sheets, own goals)
    const defPlayers = playerStats.filter(p => p.cleanSheets > 0 || p.ownGoals > 0);
    let defHtml = '';
    if (defPlayers.length > 0) {
        const csPlayers = defPlayers.filter(p => p.cleanSheets > 0);
        const ogPlayers = defPlayers.filter(p => p.ownGoals > 0);
        if (csPlayers.length > 0) {
            defHtml += csPlayers.map(p => renderPlayerItem(p.player.web_name, 'CS', '#22c55e')).join('');
        }
        if (ogPlayers.length > 0) {
            defHtml += ogPlayers.map(p => renderPlayerItem(p.player.web_name, `OG ${p.ownGoals}`, '#ef4444')).join('');
        }
    }
    if (!defHtml) defHtml = '<div style="color: var(--text-secondary); text-align: center;">-</div>';

    // Saves
    const savers = playerStats.filter(p => p.saves > 0).sort((a, b) => b.saves - a.saves);
    const savesHtml = savers.length > 0
        ? savers.map(p => renderPlayerItem(p.player.web_name, p.saves, '#06b6d4')).join('')
        : '<div style="color: var(--text-secondary); text-align: center;">-</div>';

    // Penalties
    const penPlayers = playerStats.filter(p => p.penaltiesSaved > 0 || p.penaltiesMissed > 0);
    let penHtml = '';
    if (penPlayers.length > 0) {
        penPlayers.forEach(p => {
            if (p.penaltiesSaved > 0) {
                penHtml += renderPlayerItem(p.player.web_name, `Saved ${p.penaltiesSaved}`, '#22c55e');
            }
            if (p.penaltiesMissed > 0) {
                penHtml += renderPlayerItem(p.player.web_name, `Missed ${p.penaltiesMissed}`, '#ef4444');
            }
        });
    }
    if (!penHtml) penHtml = '<div style="color: var(--text-secondary); text-align: center;">-</div>';

    return `
        <div id="fixture-stats-${fixture.id}" style="
            display: none;
            background: var(--bg-primary);
            border-top: 1px solid var(--border-color);
            padding: 0.875rem 0.75rem;
            opacity: 0;
            max-height: 0;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        ">
            <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.625rem;
            ">
                ${renderSection('Goals', goalsHtml)}
                ${renderSection('Assists', assistsHtml)}
                ${renderSection('Bonus Points', bonusHtml)}
                ${renderSection('Cards', cardsHtml)}
                ${renderSection('BPS', bpsHtml)}
                ${renderSection('Def. Contributions', defHtml)}
                ${renderSection('Saves', savesHtml)}
                ${renderSection('Penalties', penHtml)}
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
                            ${isLive ? 'background: rgba(239, 68, 68, 0.08);' : ''}
                            ${canShowStats ? 'cursor: pointer;' : ''}
                            transition: all 0.2s ease;
                        "
                        onmouseover="if(this.dataset.canExpand === 'true') this.style.background = '${isLive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 255, 136, 0.05)'}'"
                        onmouseout="this.style.background = '${isLive ? 'rgba(239, 68, 68, 0.08)' : 'transparent'}'"
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
                <div style="
                    background: var(--bg-secondary);
                    padding: 1.5rem;
                    border-radius: 12px;
                    margin-bottom: 2rem;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    border: 1px solid var(--border-color);
                ">
                    <h3 style="
                        font-size: 1.25rem;
                        font-weight: 700;
                        color: var(--text-primary);
                        margin-bottom: 1rem;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    ">
                        <i class="fas fa-calendar-alt" style="color: var(--primary-color);"></i>
                        <span>Gameweek ${gw}</span>
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
 * Toggle fixture stats visibility with smooth animation
 */
function toggleFixtureStats(fixtureId) {
    const statsDiv = document.getElementById('fixture-stats-' + fixtureId);
    if (!statsDiv) {
        console.warn(`Fixture stats div not found for fixture ${fixtureId}`);
        return;
    }

    const row = document.querySelector(`[data-fixture-id="${fixtureId}"]`);
    if (!row) {
        console.warn(`Fixture row not found for fixture ${fixtureId}`);
        return;
    }

    const icon = row.querySelector('.fa-chevron-down');
    const isVisible = statsDiv.style.display === 'block';

    if (isVisible) {
        // Collapse
        statsDiv.style.opacity = '0';
        statsDiv.style.maxHeight = '0';
        setTimeout(() => {
            statsDiv.style.display = 'none';
        }, 300); // Match transition duration
    } else {
        // Expand
        statsDiv.style.display = 'block';
        // Force reflow
        statsDiv.offsetHeight;
        statsDiv.style.opacity = '1';
        statsDiv.style.maxHeight = '2000px'; // Large enough for content
    }

    if (icon) {
        icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

// Store toggle function globally so event listeners can access it
window.toggleFixtureStats = toggleFixtureStats;

/**
 * Attach event listeners for expandable fixture rows (desktop)
 */
export function attachFixtureRowListeners() {
    // Remove existing listener if any to prevent duplicates
    const fixturesContainer = document.getElementById('app-container');
    if (!fixturesContainer) {
        console.warn('App container not found for fixture listeners');
        return;
    }

    // Use event delegation - attach once to the container
    // Check if listener is already attached
    if (fixturesContainer.hasAttribute('data-fixture-listeners-attached')) {
        return; // Already attached
    }
    
    fixturesContainer.setAttribute('data-fixture-listeners-attached', 'true');
    
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

            const fixturesByDate = fixtures.reduce((acc, fixture) => {
                const kickoffDate = new Date(fixture.kickoff_time);
                const dateLabel = kickoffDate.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                });
                const dateKey = new Date(
                    kickoffDate.getFullYear(),
                    kickoffDate.getMonth(),
                    kickoffDate.getDate()
                ).getTime();

                if (!acc[dateKey]) {
                    acc[dateKey] = {
                        label: dateLabel,
                        dateValue: dateKey,
                        fixtures: []
                    };
                }

                acc[dateKey].fixtures.push({
                    fixture,
                    kickoffDate
                });

                return acc;
            }, {});

            const dateSections = Object.values(fixturesByDate)
                .sort((a, b) => a.dateValue - b.dateValue)
                .map(section => {
                    section.fixtures.sort((a, b) => a.kickoffDate - b.kickoffDate);

                    const rows = section.fixtures.map(({ fixture, kickoffDate }) => {
                        const homeTeam = fplBootstrap.teams.find(t => t.id === fixture.team_h);
                        const awayTeam = fplBootstrap.teams.find(t => t.id === fixture.team_a);

                        const homeScore = fixture.team_h_score !== null ? fixture.team_h_score : '-';
                        const awayScore = fixture.team_a_score !== null ? fixture.team_a_score : '-';
                        const isFinished = fixture.finished;
                        const isStarted = fixture.started;
                        const isLive = isStarted && !isFinished;
                        const canShowStats = isFinished || isLive;

                        const timeStr = kickoffDate.toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        });

                        let statusBadge = '';
                        if (isFinished) {
                            const fixtureMinutes = typeof fixture.minutes === 'number' && fixture.minutes > 0
                                ? fixture.minutes
                                : null;
                            statusBadge = `<span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: rgba(34, 197, 94, 0.2); color: #22c55e;">FT${fixtureMinutes ? ` (${fixtureMinutes})` : ''}</span>`;
                        } else if (isStarted && !isFinished) {
                            statusBadge = '<span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 3px; font-weight: 600; font-size: 0.65rem; background: rgba(239, 68, 68, 0.2); color: #ef4444;">LIVE</span>';
                        }

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
                                        background: ${isLive ? 'rgba(239, 68, 68, 0.08)' : 'transparent'};
                                        ${canShowStats ? 'cursor: pointer;' : ''}
                                        padding: 0.55rem 0.75rem;
                                        transition: all 0.2s ease;
                                        border-bottom: 1px solid ${isLive ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-color)'};
                                    "
                                    onmouseover="if(this.dataset.canExpand === 'true') this.style.background = '${isLive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 255, 136, 0.05)'}'"
                                    onmouseout="this.style.background = '${isLive ? 'rgba(239, 68, 68, 0.08)' : 'transparent'}'"
                                >
                                    <div style="
                                        color: var(--text-secondary);
                                        font-size: 0.625rem;
                                        white-space: nowrap;
                                        font-weight: 500;
                                    ">${timeStr}</div>
                                    <div style="
                                        text-align: right;
                                        font-weight: 600;
                                        white-space: nowrap;
                                        overflow: hidden;
                                        text-overflow: ellipsis;
                                        font-size: 0.75rem;
                                    ">
                                        ${homeTeam?.short_name || 'TBD'}
                                    </div>
                                    <div style="
                                        text-align: center;
                                        font-weight: 700;
                                        font-size: 0.875rem;
                                        color: ${isFinished ? 'var(--text-primary)' : 'var(--text-secondary)'};
                                    ">
                                        ${homeScore}-${awayScore}
                                    </div>
                                    <div style="
                                        text-align: left;
                                        font-weight: 600;
                                        white-space: nowrap;
                                        overflow: hidden;
                                        text-overflow: ellipsis;
                                        font-size: 0.75rem;
                                    ">
                                        ${awayTeam?.short_name || 'TBD'}
                                    </div>
                                    <div style="
                                        text-align: center;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        gap: 0.25rem;
                                    ">
                                        ${statusBadge}${expandIcon}
                                    </div>
                                </div>
                                ${canShowStats ? renderFixturePlayerStats(fixture, fixture.event, isLive, isFinished, false, fplBootstrap) : ''}
                            </div>
                        `;
                    }).join('');

                    return `
                        <div style="margin-bottom: 0.75rem;">
                            <div style="
                                font-size: 0.7rem;
                                font-weight: 700;
                                color: var(--text-secondary);
                                text-transform: uppercase;
                                letter-spacing: 0.05em;
                                padding: 0.35rem 0.75rem;
                                background: var(--bg-secondary);
                            ">
                                ${section.label}
                            </div>
                            ${rows}
                        </div>
                    `;
                }).join('');

            return `
                <div style="margin-bottom: 1.25rem;">
                    <div style="
                        padding: 0.75rem 1rem;
                        background: var(--bg-secondary);
                        margin-bottom: 0.5rem;
                        border-radius: 8px;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    ">
                        <h4 style="
                            font-size: 0.95rem;
                            font-weight: 700;
                            color: var(--text-primary);
                            display: flex;
                            align-items: center;
                            gap: 0.5rem;
                        ">
                            <i class="fas fa-calendar-alt" style="color: var(--primary-color);"></i>
                            <span>Gameweek ${gw}</span>
                        </h4>
                    </div>
                    ${dateSections}
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
    // Remove existing listener if any to prevent duplicates
    const fixturesContainer = document.getElementById('app-container');
    if (!fixturesContainer) {
        console.warn('App container not found for mobile fixture listeners');
        return;
    }

    // Use event delegation - attach once to the container
    // Check if listener is already attached
    if (fixturesContainer.hasAttribute('data-fixture-mobile-listeners-attached')) {
        return; // Already attached
    }
    
    fixturesContainer.setAttribute('data-fixture-mobile-listeners-attached', 'true');
    
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
