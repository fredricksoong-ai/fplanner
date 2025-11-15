// ============================================================================
// DATA ANALYSIS PAGE MODULE
// Provides statistical analysis and differential picks
// ============================================================================

import {
    getAllPlayers
} from './data.js';

import {
    getPositionShort,
    formatCurrency,
    formatDecimal,
    getPtsHeatmap,
    getFormHeatmap,
    getHeatmapStyle,
    getDifficultyClass,
    getCurrentGW,
    getFixtureHeaders,
    getTeamShortName,
    calculatePPM,
    sortPlayers,
    escapeHtml,
    calculateMinutesPercentage
} from './utils.js';

import {
    getFixtures,
    calculateFixtureDifficulty
} from './fixtures.js';

import {
    attachRiskTooltipListeners
} from './renderHelpers.js';

// ============================================================================
// DATA ANALYSIS PAGE
// ============================================================================

// State for Data Analysis filters
let analysisState = {
    position: 'all',
    ownershipThreshold: 5,
    fixtureFilter: false,
    momentumFilter: false
};

// Export functions to update state
export function updateOwnershipThreshold(value) {
    analysisState.ownershipThreshold = parseInt(value);
}

export function setFixtureFilter(checked) {
    analysisState.fixtureFilter = checked;
}

export function setMomentumFilter(checked) {
    analysisState.momentumFilter = checked;
}

export function renderDataAnalysis(subTab = 'overview', position = 'all') {
    const container = document.getElementById('app-container');
    analysisState.position = position;

    const tabHTML = `
        <div style="margin-bottom: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-chart-bar"></i> Data Analysis
            </h1>

            <!-- Main Tabs -->
            <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border-color); margin-bottom: 1rem;">
                <button
                    class="analysis-tab-btn"
                    data-tab="overview"
                    data-position="${position}"
                    style="
                        padding: 0.75rem 1.5rem;
                        background: ${subTab === 'overview' ? 'var(--primary-color)' : 'transparent'};
                        color: ${subTab === 'overview' ? 'white' : 'var(--text-primary)'};
                        border: none;
                        border-bottom: 3px solid ${subTab === 'overview' ? 'var(--primary-color)' : 'transparent'};
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.2s;
                    "
                >
                    Overview
                </button>
                <button
                    class="analysis-tab-btn"
                    data-tab="differentials"
                    data-position="${position}"
                    style="
                        padding: 0.75rem 1.5rem;
                        background: ${subTab === 'differentials' ? 'var(--primary-color)' : 'transparent'};
                        color: ${subTab === 'differentials' ? 'white' : 'var(--text-primary)'};
                        border: none;
                        border-bottom: 3px solid ${subTab === 'differentials' ? 'var(--primary-color)' : 'transparent'};
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.2s;
                    "
                >
                    Differentials
                </button>
            </div>

            <!-- Position Filter -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem;">
                ${['all', 'GKP', 'DEF', 'MID', 'FWD'].map(pos => `
                    <button
                        class="position-filter-btn"
                        data-tab="${subTab}"
                        data-position="${pos}"
                        style="
                            padding: 0.5rem 1rem;
                            background: ${position === pos ? 'var(--accent-color)' : 'var(--bg-secondary)'};
                            color: ${position === pos ? 'white' : 'var(--text-primary)'};
                            border: 1px solid ${position === pos ? 'var(--accent-color)' : 'var(--border-color)'};
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 500;
                            font-size: 0.875rem;
                            transition: all 0.2s;
                        "
                    >
                        ${pos === 'all' ? 'All Positions' : pos}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    let contentHTML = '';
    if (subTab === 'overview') {
        contentHTML = renderAnalysisOverview(position);
    } else {
        contentHTML = renderDifferentials(position);
    }

    container.innerHTML = `
        <div style="padding: 2rem;">
            ${tabHTML}
            ${contentHTML}
        </div>
    `;

    // Add event listeners for tab buttons
    const tabButtons = container.querySelectorAll('.analysis-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            const pos = btn.dataset.position;
            window.switchAnalysisTab(tab, pos);
        });
    });

    // Add event listeners for position filter buttons
    const positionButtons = container.querySelectorAll('.position-filter-btn');
    positionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            const pos = btn.dataset.position;
            window.switchAnalysisTab(tab, pos);
        });
    });

    // Add event listener for ownership threshold slider
    const ownershipSlider = document.getElementById('ownership-threshold-slider');
    if (ownershipSlider) {
        ownershipSlider.addEventListener('input', (e) => {
            window.updateOwnershipThreshold(e.target.value);
        });
    }

    // Add event listeners for filter checkboxes
    const fixtureCheckbox = document.getElementById('fixture-filter-checkbox');
    if (fixtureCheckbox) {
        fixtureCheckbox.addEventListener('change', (e) => {
            window.toggleFixtureFilter(e.target.checked);
        });
    }

    const momentumCheckbox = document.getElementById('momentum-filter-checkbox');
    if (momentumCheckbox) {
        momentumCheckbox.addEventListener('change', (e) => {
            window.toggleMomentumFilter(e.target.checked);
        });
    }

    attachRiskTooltipListeners();
}

function renderAnalysisOverview(position = 'all') {
    let players = getAllPlayers();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    const top20 = sortPlayers(players, 'total_points', false).slice(0, 20);
    const bestValue = players.filter(p => calculateMinutesPercentage(p, getCurrentGW()) > 30);
    const top15Value = sortPlayers(bestValue, 'ppm', false).slice(0, 15);
    const top15Form = sortPlayers(bestValue, 'form', false).slice(0, 15);

    // Defensive standouts (for outfield players only)
    let defensiveSection = '';
    if (position === 'DEF' || position === 'MID' || position === 'FWD') {
        const withDefCon = players.filter(p => p.github_season && p.github_season.defensive_contribution_per_90);
        const topDefensive = withDefCon.sort((a, b) =>
            b.github_season.defensive_contribution_per_90 - a.github_season.defensive_contribution_per_90
        ).slice(0, 10);

        if (topDefensive.length > 0) {
            defensiveSection = `
                <div style="margin-top: 3rem;">
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                        🛡️ Defensive Standouts
                    </h2>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                        Top ${position === 'all' ? 'outfield players' : position} by defensive contribution per 90
                    </p>
                    ${renderPositionSpecificTable(topDefensive, position)}
                </div>
            `;
        }
    }

    return `
        <div>
            <!-- Section 1: Top Performers -->
            <div style="margin-bottom: 3rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                    🏆 Top Performers
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Top ${position === 'all' ? '20 players' : '20 ' + position} by total points
                </p>
                ${renderPositionSpecificTable(top20, position)}
            </div>

            <!-- Section 2: Best Value -->
            <div style="margin-bottom: 3rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                    💰 Best Value
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Top 15 by points per million (min 30% minutes played)
                </p>
                ${renderPositionSpecificTable(top15Value, position)}
            </div>

            <!-- Section 3: Form Stars -->
            <div style="margin-bottom: 3rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                    🔥 Form Stars
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Top 15 by recent form (min 30% minutes played)
                </p>
                ${renderPositionSpecificTable(top15Form, position)}
            </div>

            <!-- Section 4: Defensive Standouts (if applicable) -->
            ${defensiveSection}
        </div>
    `;
}

function renderDifferentials(position = 'all') {
    let players = getAllPlayers();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    // Apply filters
    const differentials = players.filter(p => {
        const ownership = parseFloat(p.selected_by_percent) || 0;
        if (ownership >= analysisState.ownershipThreshold) return false;

        // Position-specific thresholds
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        if (position === 'GKP' || p.element_type === 1) {
            if (minPercentage <= 50 && (p.saves || 0) <= 20) return false;
        } else if (position === 'DEF' || p.element_type === 2) {
            if (minPercentage <= 40 && (!p.github_season || p.github_season.defensive_contribution_per_90 <= 3.0)) return false;
        } else {
            if (minPercentage <= 30 || parseFloat(p.form) <= 3) return false;
        }

        // Fixture filter
        if (analysisState.fixtureFilter) {
            const fdr = calculateFixtureDifficulty(p.team, 5);
            if (fdr > 3.0) return false;
        }

        // Momentum filter
        if (analysisState.momentumFilter && p.github_transfers) {
            const netTransfers = p.github_transfers.transfers_in - p.github_transfers.transfers_out;
            if (netTransfers <= 0) return false;
        }

        return true;
    });

    const sortedDiffs = sortPlayers(differentials, 'total_points', false).slice(0, 20);

    return `
        <div>
            <!-- Filters -->
            <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
                <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">Filters</h3>

                <!-- Ownership Slider -->
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">
                        Ownership Threshold: <span id="ownership-value">${analysisState.ownershipThreshold}%</span>
                    </label>
                    <input
                        type="range"
                        id="ownership-threshold-slider"
                        min="1"
                        max="10"
                        value="${analysisState.ownershipThreshold}"
                        style="width: 100%; max-width: 300px;"
                    />
                </div>

                <!-- Checkboxes -->
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input
                            type="checkbox"
                            id="fixture-filter-checkbox"
                            ${analysisState.fixtureFilter ? 'checked' : ''}
                        />
                        <span>Only good fixtures (FDR ≤ 3.0)</span>
                    </label>

                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input
                            type="checkbox"
                            id="momentum-filter-checkbox"
                            ${analysisState.momentumFilter ? 'checked' : ''}
                        />
                        <span>Only positive momentum (ΔT > 0)</span>
                    </label>
                </div>
            </div>

            <!-- Results -->
            <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                🎯 Differential Picks
            </h2>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Found ${sortedDiffs.length} ${position === 'all' ? 'players' : position} matching criteria
            </p>
            ${sortedDiffs.length > 0 ? renderPositionSpecificTable(sortedDiffs, position) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No differentials found matching criteria. Try adjusting filters.</div>'}
        </div>
    `;
}

/**
 * Render position-specific table with appropriate columns
 */
function renderPositionSpecificTable(players, position = 'all') {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }

    const currentGW = getCurrentGW();

    // Get my team's player IDs from cache
    let myPlayerIds = new Set();
    const cachedTeamId = localStorage.getItem('fplanner_team_id');
    if (cachedTeamId) {
        const cachedTeamData = localStorage.getItem(`fplanner_team_${cachedTeamId}`);
        if (cachedTeamData) {
            try {
                const teamData = JSON.parse(cachedTeamData);
                if (teamData && teamData.picks && teamData.picks.picks) {
                    myPlayerIds = new Set(teamData.picks.picks.map(p => p.element));
                }
            } catch (e) {
                console.log('Could not parse cached team data for highlighting');
            }
        }
    }

    // Get next 5 fixtures headers
    const fixtureHeaders = getFixtureHeaders(5, 1);

    // Build table based on position
    let html = `
        <div style="overflow-x: auto; background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead style="background: var(--primary-color); color: white;">
                    <tr>
    `;

    // Position-specific column headers
    if (position === 'GKP') {
        // GKP: Player, Team, Price, Pts, PPM, Own%, Min%, Form, Saves/90, CS/90, xGC/90, CS, ΔT, FDR(5), Fix 1-5
        html += `
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Min%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Saves/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">CS/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">xGC/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">CS</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
        `;
    } else if (position === 'DEF') {
        // DEF: Player, Team, Price, Pts, PPM, Own%, Min%, Form, Def/90, CS, xGC/90, G+A, ΔT, FDR(5), Fix 1-5
        html += `
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Min%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Def/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">CS</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">xGC/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">G+A</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
        `;
    } else if (position === 'MID' || position === 'FWD') {
        // MID/FWD: Player, Team, Price, Pts, PPM, Own%, Min%, Form, Def/90, Goals, Assists, xGI/90, PK, ΔT, FDR(5), Fix 1-5
        html += `
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Min%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Def/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Goals</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Assists</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">xGI/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PK</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
        `;
    } else {
        // ALL: Simplified view with position column
        html += `
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Pos</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Min%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
        `;
    }

    // Add fixture headers
    fixtureHeaders.forEach((h, idx) => {
        const isUpcomingGW = idx === 0;
        const headerBg = isUpcomingGW ? 'background: rgba(139, 92, 246, 0.3);' : '';
        html += `<th style="text-align: center; padding: 0.5rem; ${headerBg}">${h}</th>`;
    });

    html += `
                    </tr>
                </thead>
                <tbody>
    `;

    // Render rows
    players.forEach((player, index) => {
        // Check if player is in my team
        const isMyPlayer = myPlayerIds.has(player.id);

        // Highlight my players with soft purple background (more visible now)
        const rowBg = isMyPlayer ? 'rgba(139, 92, 246, 0.15)' : (index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)');

        // Calculate common metrics
        const ppm = calculatePPM(player);
        const minPercentage = calculateMinutesPercentage(player, currentGW);
        const ownership = parseFloat(player.selected_by_percent) || 0;
        const fdr5 = calculateFixtureDifficulty(player.team, 5);
        const fdrClass = getDifficultyClass(Math.round(fdr5));

        // Transfer momentum
        let transferNet = '—';
        let transferColor = 'inherit';
        if (player.github_transfers) {
            const net = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
            const prefix = net > 0 ? '+' : '';
            transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
            transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
        }

        // Heatmaps
        const ptsHeatmap = getPtsHeatmap(player.total_points, 'pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);
        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);
        const ppmHeatmap = getPtsHeatmap(ppm, 'value');
        const ppmStyle = getHeatmapStyle(ppmHeatmap);

        // Get fixtures
        const next5 = getFixtures(player.team, 10, false).filter(f => f.event > currentGW).slice(0, 5);

        html += `<tr style="background: ${rowBg};">`;

        // Position-specific columns
        if (position === 'GKP') {
            const saves90 = player.github_season?.saves_per_90 || 0;
            const cs90 = player.github_season?.clean_sheets_per_90 || 0;
            const xGC90 = player.expected_goals_conceded_per_90 || 0;
            const cs = player.clean_sheets || 0;

            html += `
                <td style="padding: 0.75rem 0.5rem;"><strong>${escapeHtml(player.web_name)}</strong>${isMyPlayer ? ' <span style="color: #8b5cf6; font-size: 0.75rem;">⭐</span>' : ''}</td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">${player.total_points}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${minPercentage.toFixed(0)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(saves90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(cs90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatDecimal(xGC90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${cs}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(fdr5)}</span></td>
            `;
        } else if (position === 'DEF') {
            const def90 = player.github_season?.defensive_contribution_per_90 || 0;
            const cs = player.clean_sheets || 0;
            const xGC90 = player.expected_goals_conceded_per_90 || 0;
            const ga = (player.goals_scored || 0) + (player.assists || 0);

            html += `
                <td style="padding: 0.75rem 0.5rem;"><strong>${escapeHtml(player.web_name)}</strong>${isMyPlayer ? ' <span style="color: #8b5cf6; font-size: 0.75rem;">⭐</span>' : ''}</td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">${player.total_points}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${minPercentage.toFixed(0)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(def90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${cs}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatDecimal(xGC90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${ga}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(fdr5)}</span></td>
            `;
        } else if (position === 'MID' || position === 'FWD') {
            const def90 = player.github_season?.defensive_contribution_per_90 || 0;
            const goals = player.goals_scored || 0;
            const assists = player.assists || 0;
            const xGI90 = player.expected_goal_involvements_per_90 || 0;
            const pk = player.penalties_order === 1 ? '⚽' : '—';

            html += `
                <td style="padding: 0.75rem 0.5rem;"><strong>${escapeHtml(player.web_name)}</strong>${isMyPlayer ? ' <span style="color: #8b5cf6; font-size: 0.75rem;">⭐</span>' : ''}</td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">${player.total_points}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${minPercentage.toFixed(0)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(def90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${goals}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${assists}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatDecimal(xGI90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${pk}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(fdr5)}</span></td>
            `;
        } else {
            // ALL positions - simplified view
            html += `
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">${getPositionShort(player)}</td>
                <td style="padding: 0.75rem 0.5rem;"><strong>${escapeHtml(player.web_name)}</strong>${isMyPlayer ? ' <span style="color: #8b5cf6; font-size: 0.75rem;">⭐</span>' : ''}</td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">${player.total_points}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${minPercentage.toFixed(0)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(fdr5)}</span></td>
            `;
        }

        // Add fixtures
        next5.forEach((f, fixIdx) => {
            // Highlight first fixture (next GW) with soft purple for ALL players
            const isUpcomingGW = fixIdx === 0;
            const fixtureHighlight = isUpcomingGW ? 'background: rgba(139, 92, 246, 0.1);' : '';

            html += `
                <td style="padding: 0.5rem; text-align: center; ${fixtureHighlight}">
                    <span class="${getDifficultyClass(f.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; display: inline-block;">
                        ${f.opponent}
                    </span>
                </td>
            `;
        });

        html += `</tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}
