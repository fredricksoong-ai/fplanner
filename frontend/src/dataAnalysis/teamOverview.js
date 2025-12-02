// ============================================================================
// DATA ANALYSIS TEAM OVERVIEW TAB
// Shows personalized stats for the user's loaded team
// ============================================================================

import { getPlayerById } from '../data.js';
import { getCurrentGW, calculateMinutesPercentage, calculatePPM, escapeHtml } from '../utils.js';
import { calculateFixtureDifficulty } from '../fixtures.js';
import { isMobileDevice } from '../renderMyTeamMobile.js';
import { sharedState } from '../sharedState.js';
import {
    calculateBenchPoints,
    calculateSquadAverages
} from '../myTeam/teamSummaryHelpers.js';
import { initializeTeamPointsChart, disposeTeamPointsChart } from './teamPointsChart.js';

let teamPointsChartInstance = null;

/**
 * Render Team Overview tab - personalized stats for user's team
 * @param {string} position - Position filter ('all', 'GKP', 'DEF', 'MID', 'FWD')
 * @param {Function} renderSectionHeader - Function to render section headers
 * @param {Function} renderPositionSpecificTableMobile - Mobile table renderer
 * @param {Function} renderPositionSpecificTable - Desktop table renderer
 * @returns {string} HTML for team overview tab
 */
export function renderTeamOverview(
    position = 'all',
    renderSectionHeader,
    renderPositionSpecificTableMobile,
    renderPositionSpecificTable
) {
    const teamData = sharedState?.myTeamData;
    const isMobile = isMobileDevice();

    // Check if team is loaded
    if (!teamData || !teamData.picks) {
        return renderNoTeamLoaded();
    }

    const { picks, gameweek } = teamData;
    const myPicks = picks.picks;
    const currentGW = getCurrentGW();

    // Get full player data for each pick
    const myPlayers = myPicks.map(pick => {
        const player = getPlayerById(pick.element);
        return {
            ...player,
            __isMine: true,
            position: pick.position,
            is_captain: pick.is_captain,
            is_vice_captain: pick.is_vice_captain,
            multiplier: pick.multiplier
        };
    }).filter(p => p && p.id); // Filter out any missing players

    // Filter by position if needed
    let filteredPlayers = myPlayers;
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        filteredPlayers = myPlayers.filter(p => p.element_type === posMap[position]);
    }

    // Only show starters (position 1-11)
    const starters = filteredPlayers.filter(p => p.position <= 11);
    const bench = filteredPlayers.filter(p => p.position > 11);

    // Sort starters by GW points (descending) - top performers
    const topPerformers = [...starters].sort((a, b) => {
        const aPoints = (a.event_points || 0) * (a.is_captain ? 2 : 1);
        const bPoints = (b.event_points || 0) * (b.is_captain ? 2 : 1);
        return bPoints - aPoints;
    }).slice(0, 5); // Top 5

    // Sort starters by GW points (ascending) - concerns
    const concerns = [...starters].sort((a, b) => {
        const aPoints = a.event_points || 0;
        const bPoints = b.event_points || 0;
        return aPoints - bPoints;
    }).slice(0, 5); // Bottom 5

    // Calculate squad stats
    const benchPoints = calculateBenchPoints(myPlayers, gameweek);
    const { avgPPM, avgOwnership, avgMinPercent, avgFDR, highRiskCount } = calculateSquadAverages(myPlayers, gameweek);

    // Differentials in squad (< 15% owned)
    const differentials = filteredPlayers.filter(p => parseFloat(p.selected_by_percent || 0) < 15);

    // Get team history for chart
    const teamHistory = teamData?.teamHistory?.current || [];

    return `
        <div>
            <!-- Team Points Chart (replaces Summary Cards) -->
            ${teamHistory.length > 0 ? `
            <div style="margin-bottom: 2rem;">
                <div style="
                    background: var(--bg-secondary);
                    border-radius: 0.75rem;
                    padding: 1rem;
                    margin-bottom: 1rem;
                ">
                    <h3 style="
                        font-size: 0.85rem;
                        font-weight: 700;
                        color: var(--text-primary);
                        margin: 0 0 0.75rem 0;
                    ">
                        Season Progress
                    </h3>
                    <div id="team-points-chart" style="width: 100%; height: 300px;"></div>
                    <div style="
                        font-size: 0.65rem;
                        color: var(--text-tertiary);
                        margin-top: 0.5rem;
                        text-align: center;
                    ">
                        Cumulative points across gameweeks
                    </div>
                </div>
            </div>
            ` : `
            <div style="
                background: var(--bg-secondary);
                border-radius: 0.75rem;
                padding: 1.5rem;
                margin-bottom: 2rem;
                text-align: center;
                color: var(--text-secondary);
            ">
                <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                <p style="font-size: 0.85rem; margin: 0;">Team history data not available</p>
            </div>
            `}

            <!-- Section 1: Top Performers This GW -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('⭐', 'Top Performers This GW', `Your best ${topPerformers.length} players in GW${gameweek}`)}
                ${isMobile ? renderPositionSpecificTableMobile(topPerformers, 'total') : renderPositionSpecificTable(topPerformers, position)}
            </div>

            <!-- Section 2: Concerns -->
            ${concerns.length > 0 ? `
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('⚠️', 'Concerns', `Players who underperformed in GW${gameweek}`)}
                ${isMobile ? renderPositionSpecificTableMobile(concerns, 'total') : renderPositionSpecificTable(concerns, position)}
            </div>
            ` : ''}

            <!-- Section 3: Your Differentials -->
            ${differentials.length > 0 ? `
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('💎', 'Your Differentials', `${differentials.length} player${differentials.length === 1 ? '' : 's'} with <15% ownership`)}
                ${isMobile ? renderPositionSpecificTableMobile(differentials, 'ownership') : renderPositionSpecificTable(differentials, position)}
            </div>
            ` : ''}

            <!-- Section 4: Bench Analysis -->
            ${bench.length > 0 ? `
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🪑', 'Your Bench', `${bench.length} player${bench.length === 1 ? '' : 's'} | ${benchPoints} pts left on bench`)}
                ${isMobile ? renderPositionSpecificTableMobile(bench, 'total') : renderPositionSpecificTable(bench, position)}
            </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render "No team loaded" state
 * @returns {string} HTML for no team state
 */
function renderNoTeamLoaded() {
    const isMobile = isMobileDevice();
    const padding = isMobile ? '2rem 1rem' : '4rem 2rem';

    return `
        <div style="
            text-align: center;
            padding: ${padding};
            background: var(--bg-secondary);
            border-radius: 0.75rem;
            margin: 2rem auto;
            max-width: 600px;
        ">
            <i class="fas fa-users" style="
                font-size: 4rem;
                color: var(--text-secondary);
                margin-bottom: 1rem;
                display: block;
            "></i>

            <h3 style="
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 1rem;
            ">
                Load Your Team First
            </h3>

            <p style="
                color: var(--text-secondary);
                margin-bottom: 2rem;
                line-height: 1.6;
            ">
                The Overview tab shows personalized stats for your FPL team.
                Load your team from the Team page to see your performance insights.
            </p>

            <button
                onclick="window.location.hash = '#my-team'"
                style="
                    padding: 0.75rem 1.5rem;
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: 0.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                "
                onmouseover="this.style.background='var(--primary-hover)'"
                onmouseout="this.style.background='var(--primary-color)'"
            >
                <i class="fas fa-arrow-right"></i> Go to Team Page
            </button>
        </div>
    `;
}

/**
 * Render squad health summary cards
 */
function renderSquadHealthCards(benchPoints, avgPPM, avgOwnership, avgFDR, highRiskCount, avgMinPercent) {
    const isMobile = isMobileDevice();
    const gridCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(150px, 1fr))';

    // Determine colors based on thresholds
    const benchColor = benchPoints >= 15 ? '#ef4444' : benchPoints >= 8 ? '#f97316' : '#10b981';
    const riskColor = highRiskCount >= 3 ? '#ef4444' : highRiskCount >= 1 ? '#f97316' : '#10b981';
    const fdrColor = avgFDR <= 2.5 ? '#10b981' : avgFDR <= 3.5 ? '#fbbf24' : '#ef4444';
    const minutesColor = avgMinPercent >= 70 ? '#10b981' : avgMinPercent >= 50 ? '#fbbf24' : '#ef4444';

    return `
        <div style="
            display: grid;
            grid-template-columns: ${gridCols};
            gap: 0.75rem;
            margin-bottom: 1rem;
        ">
            <!-- Bench Points -->
            <div style="
                background: var(--bg-secondary);
                padding: 1rem;
                border-radius: 0.5rem;
                border-left: 3px solid ${benchColor};
            ">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.25rem;">
                    Bench Pts
                </div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                    ${benchPoints}
                </div>
            </div>

            <!-- Average PPM -->
            <div style="
                background: var(--bg-secondary);
                padding: 1rem;
                border-radius: 0.5rem;
                border-left: 3px solid var(--primary-color);
            ">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.25rem;">
                    Avg PPM
                </div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                    ${avgPPM.toFixed(1)}
                </div>
            </div>

            <!-- Average Ownership -->
            <div style="
                background: var(--bg-secondary);
                padding: 1rem;
                border-radius: 0.5rem;
                border-left: 3px solid var(--accent-color);
            ">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.25rem;">
                    Avg Own%
                </div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                    ${avgOwnership.toFixed(1)}%
                </div>
            </div>

            <!-- FDR -->
            <div style="
                background: var(--bg-secondary);
                padding: 1rem;
                border-radius: 0.5rem;
                border-left: 3px solid ${fdrColor};
            ">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.25rem;">
                    FDR (5)
                </div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                    ${avgFDR.toFixed(1)}
                </div>
            </div>

            <!-- High Risk Count -->
            <div style="
                background: var(--bg-secondary);
                padding: 1rem;
                border-radius: 0.5rem;
                border-left: 3px solid ${riskColor};
            ">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.25rem;">
                    High Risk
                </div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                    ${highRiskCount}
                </div>
            </div>

            <!-- Minutes % -->
            <div style="
                background: var(--bg-secondary);
                padding: 1rem;
                border-radius: 0.5rem;
                border-left: 3px solid ${minutesColor};
            ">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.25rem;">
                    Avg Min%
                </div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                    ${avgMinPercent.toFixed(0)}%
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize chart after render
 */
export function initializeTeamOverviewChart() {
    const teamData = sharedState?.myTeamData;
    const teamHistory = teamData?.teamHistory?.current || [];
    
    if (teamHistory.length > 0) {
        // Dispose existing chart
        if (teamPointsChartInstance) {
            disposeTeamPointsChart(teamPointsChartInstance);
            teamPointsChartInstance = null;
        }
        
        // Initialize new chart
        setTimeout(async () => {
            try {
                teamPointsChartInstance = await initializeTeamPointsChart('team-points-chart', teamHistory);
            } catch (err) {
                console.error('Failed to initialize team points chart:', err);
            }
        }, 100);
    }
}

/**
 * Cleanup chart on unmount
 */
export function cleanupTeamOverviewChart() {
    if (teamPointsChartInstance) {
        disposeTeamPointsChart(teamPointsChartInstance);
        teamPointsChartInstance = null;
    }
}
