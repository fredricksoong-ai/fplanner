/**
 * Team Comparison Rendering Module
 * Head-to-head comparison view for rival teams
 */

import { getPlayerById } from '../data.js';
import {
    getPositionShort,
    getTeamShortName,
    formatCurrency,
    escapeHtml
} from '../utils.js';
import {
    analyzeDifferentials,
    compareCaptains,
    extractPlayerIds
} from './teamComparisonHelpers.js';

/**
 * Render team comparison view (side-by-side)
 * @param {Object} myTeamData - My team data
 * @param {Object} rivalTeamData - Rival team data
 * @returns {string} HTML for team comparison
 */
export function renderTeamComparison(myTeamData, rivalTeamData) {
    const { picks: myPicks, team: myTeam, gameweek } = myTeamData;
    const { picks: rivalPicks, team: rivalTeam } = rivalTeamData;

    // Use extracted helper functions
    const myPlayerIdsArray = extractPlayerIds(myPicks);
    const rivalPlayerIdsArray = extractPlayerIds(rivalPicks);
    const analysis = analyzeDifferentials(myPlayerIdsArray, rivalPlayerIdsArray);
    const captainComparison = compareCaptains(myPicks, rivalPicks);

    // Convert back to Sets for filtering
    const myPlayerIds = new Set(myPlayerIdsArray);
    const rivalPlayerIds = new Set(rivalPlayerIdsArray);

    // Filter picks for rendering
    const myDifferentials = myPicks.picks.filter(p => !rivalPlayerIds.has(p.element));
    const rivalDifferentials = rivalPicks.picks.filter(p => !myPlayerIds.has(p.element));
    const sharedPlayers = myPicks.picks.filter(p => rivalPlayerIds.has(p.element));

    const { myCaptain, rivalCaptain, captainsMatch } = captainComparison;

    return `
        <div style="padding: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                    <i class="fas fa-compress-arrows-alt"></i> Team Comparison
                </h2>
                <button
                    class="close-modal-btn"
                    style="
                        padding: 0.5rem 1rem;
                        background: var(--bg-secondary);
                        color: var(--text-secondary);
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-times"></i> Close
                </button>
            </div>

        <!-- Team Headers -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
            <!-- Your Team -->
            <div style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%); padding: 1.5rem; border-radius: 12px; color: white;">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">
                    <i class="fas fa-user"></i> ${escapeHtml(myTeam.player_first_name)} ${escapeHtml(myTeam.player_last_name)}
                </h3>
                <p style="opacity: 0.9; margin-bottom: 0.5rem;">${escapeHtml(myTeam.name)}</p>
                <p style="font-size: 0.875rem; opacity: 0.8;">GW${gameweek}: ${myPicks.entry_history.total_points} pts | Total: ${myTeam.summary_overall_points?.toLocaleString() || 0} pts</p>
            </div>

            <!-- Rival Team -->
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 1.5rem; border-radius: 12px; color: white;">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">
                    <i class="fas fa-users"></i> ${escapeHtml(rivalTeam.player_first_name)} ${escapeHtml(rivalTeam.player_last_name)}
                </h3>
                <p style="opacity: 0.9; margin-bottom: 0.5rem;">${escapeHtml(rivalTeam.name)}</p>
                <p style="font-size: 0.875rem; opacity: 0.8;">GW${gameweek}: ${rivalPicks.entry_history.total_points} pts | Total: ${rivalTeam.summary_overall_points?.toLocaleString() || 0} pts</p>
            </div>
        </div>

        <!-- Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px var(--shadow);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Shared Players</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${sharedPlayers.length}</div>
            </div>
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px var(--shadow);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Your Differentials</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${myDifferentials.length}</div>
            </div>
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px var(--shadow);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Their Differentials</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #ef4444;">${rivalDifferentials.length}</div>
            </div>
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px var(--shadow);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Captain Match</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: ${captainsMatch ? '#22c55e' : '#fb923c'};">
                    ${captainsMatch ? 'Same' : 'Different'}
                </div>
            </div>
        </div>

        <!-- Side-by-Side Teams -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            ${renderComparisonTeamColumn(myPicks, 'Your Team', myPlayerIds, rivalPlayerIds, myCaptain, gameweek, '#3b82f6')}
            ${renderComparisonTeamColumn(rivalPicks, 'Rival Team', rivalPlayerIds, myPlayerIds, rivalCaptain, gameweek, '#ef4444')}
        </div>
        </div>
    `;
}

/**
 * Render a single team column for comparison
 * @param {Object} picks - Team picks
 * @param {string} title - Column title
 * @param {Set} ownPlayerIds - Own team player IDs
 * @param {Set} otherPlayerIds - Other team player IDs
 * @param {Object} captain - Captain pick
 * @param {number} gameweek - Current gameweek
 * @param {string} accentColor - Accent color for styling
 * @returns {string} HTML for team column
 */
function renderComparisonTeamColumn(picks, title, ownPlayerIds, otherPlayerIds, captain, gameweek, accentColor) {
    const players = picks.picks.sort((a, b) => a.position - b.position);

    return `
        <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <h4 class="heading-section" style="margin-bottom: 1rem; border-bottom: 2px solid ${accentColor}; padding-bottom: 0.5rem;">
                ${title}
            </h4>
            <div style="font-size: 0.875rem;">
                ${players.map((pick, index) => {
                    const player = getPlayerById(pick.element);
                    if (!player) return '';

                    const isShared = otherPlayerIds.has(pick.element);
                    const isDifferential = !isShared;
                    const isCaptain = pick.is_captain;
                    const isVice = pick.is_vice_captain;
                    const isBench = pick.position > 11;

                    const bgColor = isDifferential ? `rgba(${accentColor === '#3b82f6' ? '59, 130, 246' : '239, 68, 68'}, 0.1)` :
                                    isShared ? 'rgba(34, 197, 94, 0.1)' : 'transparent';

                    // Colored left border for players with news/injury
                    let leftBorderStyle = 'none';
                    if (player.news && player.news.trim() !== '') {
                        const chanceOfPlaying = player.chance_of_playing_next_round;
                        if (chanceOfPlaying !== null && chanceOfPlaying !== undefined) {
                            if (chanceOfPlaying <= 25) {
                                leftBorderStyle = '3px solid #ef4444'; // Red
                            } else if (chanceOfPlaying <= 50) {
                                leftBorderStyle = '3px solid #f97316'; // Orange
                            } else {
                                leftBorderStyle = '3px solid #fbbf24'; // Yellow
                            }
                        } else {
                            leftBorderStyle = '3px solid #fbbf24'; // Yellow default for news
                        }
                    }

                    // Separator between starting 11 and bench
                    const separator = index === 11 ? `<div style="border-top: 2px solid var(--border-color); margin: 0.5rem 0;"></div>` : '';

                    return `
                        ${separator}
                        <div style="background: ${bgColor}; padding: 0.5rem; border-radius: 6px; margin-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center; border-left: ${leftBorderStyle}; ${isBench ? 'opacity: 0.6;' : ''}">
                            <div style="flex: 1;">
                                <span style="font-weight: 600;">${escapeHtml(player.web_name)}</span>
                                ${isCaptain ? ' <span style="color: var(--primary-color); font-weight: 700;">(C)</span>' : ''}
                                ${isVice ? ' <span style="color: var(--text-secondary); font-weight: 700;">(VC)</span>' : ''}
                                <br>
                                <span style="font-size: 0.75rem; color: var(--text-secondary);">
                                    ${getPositionShort(player)} | ${getTeamShortName(player.team)}
                                </span>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600;">${player.event_points || 0} pts</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary);">${formatCurrency(player.now_cost)}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}
