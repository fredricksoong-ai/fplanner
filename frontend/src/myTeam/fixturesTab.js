/**
 * Fixtures Tab Rendering Module
 * Displays recent fixture results (desktop and mobile layouts)
 */

import {
    fplFixtures as getFixturesData,
    fplBootstrap as getBootstrapData,
    currentGW as getCurrentGW
} from '../data.js';

import { escapeHtml } from '../utils.js';

/**
 * Render fixtures tab (desktop)
 * @returns {string} HTML for fixtures tab
 */
export function renderFixturesTab() {
    const fplFixtures = getFixturesData;
    const fplBootstrap = getBootstrapData;
    const currentGW = getCurrentGW;

    if (!fplFixtures || !fplBootstrap || !currentGW) {
        return `
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; text-align: center; margin-bottom: 2rem;">
                <p style="color: var(--text-secondary);">Loading fixtures data...</p>
            </div>
        `;
    }

    // Get recent GW fixtures (current and previous GW)
    const recentFixtures = fplFixtures
        .filter(f => f.event === currentGW || f.event === currentGW - 1)
        .sort((a, b) => {
            // Sort by event (GW) descending, then by kickoff time
            if (b.event !== a.event) return b.event - a.event;
            return new Date(b.kickoff_time) - new Date(a.kickoff_time);
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

                // Status badge
                let statusBadge = '';
                if (isFinished) {
                    statusBadge = '<span style="color: #22c55e; font-weight: 600; font-size: 0.75rem;">FT</span>';
                } else if (isStarted) {
                    statusBadge = '<span style="color: #ef4444; font-weight: 600; font-size: 0.75rem;">LIVE</span>';
                }

                return `
                    <tr style="border-bottom: 1px solid var(--border-color); ${isStarted && !isFinished ? 'background: rgba(239, 68, 68, 0.05);' : ''}">
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
                            ${statusBadge}
                        </td>
                    </tr>
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
 * Render fixtures tab (mobile)
 * @returns {string} HTML for mobile fixtures tab
 */
export function renderMobileFixturesTab() {
    const fplFixtures = getFixturesData;
    const fplBootstrap = getBootstrapData;
    const currentGW = getCurrentGW;

    if (!fplFixtures || !fplBootstrap || !currentGW) {
        return `
            <div style="padding: 1rem; text-align: center;">
                <p style="color: var(--text-secondary);">Loading fixtures data...</p>
            </div>
        `;
    }

    // Get recent GW fixtures
    const recentFixtures = fplFixtures
        .filter(f => f.event === currentGW || f.event === currentGW - 1)
        .sort((a, b) => {
            if (b.event !== a.event) return b.event - a.event;
            return new Date(b.kickoff_time) - new Date(a.kickoff_time);
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

                const kickoffDate = new Date(fixture.kickoff_time);
                const timeStr = kickoffDate.toLocaleString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                let statusBadge = '';
                if (isFinished) {
                    statusBadge = '<span style="color: #22c55e; font-weight: 600; font-size: 0.65rem;">FT</span>';
                } else if (isStarted) {
                    statusBadge = '<span style="color: #ef4444; font-weight: 600; font-size: 0.65rem;">LIVE</span>';
                }

                return `
                    <div class="mobile-table-row mobile-table-fixtures" style="background: ${isStarted && !isFinished ? 'rgba(239, 68, 68, 0.05)' : 'transparent'};">
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
                            ${statusBadge}
                        </div>
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
