// ============================================================================
// DATA ANALYSIS PAGE MODULE
// Provides statistical analysis and differential picks
// ============================================================================

import { getAllPlayers, fplBootstrap } from './data.js';
import {
    getPositionShort,
    formatCurrency,
    formatDecimal,
    getDifficultyClass,
    getCurrentGW,
    getTeamShortName,
    calculatePPM,
    sortPlayers,
    escapeHtml,
    calculateMinutesPercentage
} from './utils.js';
import {
    getFixtures,
    calculateFixtureDifficulty,
    getTeamsWithBestFixtures,
    getTeamsWithWorstFixtures
} from './fixtures.js';
import { attachRiskTooltipListeners } from './renderHelpers.js';
import { loadAndRenderInsights } from './renderInsightBanner.js';
import { isMobileDevice } from './renderMyTeamMobile.js';
import { attachPlayerRowListeners } from './renderMyTeamCompact.js';

// Data Analysis modules
import { renderAnalysisOverview as renderAnalysisOverviewModule } from './dataAnalysis/overview.js';
import { renderHiddenGems as renderHiddenGemsModule } from './dataAnalysis/hiddenGems.js';
import { renderTransferTargets as renderTransferTargetsModule } from './dataAnalysis/transferTargets.js';
import { renderTeamAnalysis as renderTeamAnalysisModule } from './dataAnalysis/teamAnalysis.js';
import { renderDifferentials as renderDifferentialsModule } from './dataAnalysis/differentials.js';
import { renderPlayerTable } from './dataAnalysis/playerTableRenderer.js';
import { getDefaultFilterState } from './dataAnalysis/filterHelpers.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// State for Data Analysis filters
let analysisState = getDefaultFilterState();

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

export function setPriceRange(range) {
    analysisState.priceRange = range;
}

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

export function renderDataAnalysis(subTab = 'overview', position = 'all') {
    const container = document.getElementById('app-container');
    const isMobile = isMobileDevice();

    // Mobile-specific sizing
    const headerSize = isMobile ? '1.25rem' : '2rem';
    const headerMargin = isMobile ? '0.5rem' : '1rem';
    const tabPadding = isMobile ? '0.5rem 0.75rem' : '0.75rem 1.5rem';
    const tabFontSize = isMobile ? '0.75rem' : '1rem';
    const positionPadding = isMobile ? '0.4rem 0.6rem' : '0.5rem 1rem';
    const positionFontSize = isMobile ? '0.75rem' : '0.875rem';

    const tabHTML = `
        <div style="margin-bottom: ${isMobile ? '1rem' : '2rem'};">
            ${!isMobile ? `<h1 style="font-size: ${headerSize}; font-weight: 700; color: var(--primary-color); margin-bottom: ${headerMargin};">
                <i class="fas fa-chart-bar"></i> Data Analysis
            </h1>` : ''}

            <!-- Main Tabs -->
            <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border-color); margin-bottom: 1rem; overflow-x: auto; flex-wrap: nowrap;">
                ${renderTabButton('overview', 'Overview', subTab, position, tabPadding, tabFontSize)}
                ${renderTabButton('hidden-gems', 'Hidden Gems', subTab, position, tabPadding, tabFontSize)}
                ${renderTabButton('transfer-targets', 'Transfer Targets', subTab, position, tabPadding, tabFontSize)}
                ${renderTabButton('differentials', 'Differentials', subTab, position, tabPadding, tabFontSize)}
                ${renderTabButton('team-analysis', 'Team Analysis', subTab, position, tabPadding, tabFontSize)}
            </div>

            <!-- Position Filter -->
            ${renderPositionFilter(position, positionPadding, positionFontSize)}

            <!-- AI Insights Container (for Overview tab) -->
            ${subTab === 'overview' ? '<div id="ai-insights-container" style="margin-bottom: 2rem;"></div>' : ''}

            <!-- Tab Content -->
            <div id="analysis-content">
                ${renderTabContent(subTab, position)}
            </div>
        </div>
    `;

    container.innerHTML = tabHTML;

    // Attach event listeners
    attachEventListeners(subTab, position);
    attachRiskTooltipListeners();
    attachPlayerRowListeners();

    // Load AI insights for overview tab
    if (subTab === 'overview') {
        loadAIInsightsForTab('overview', position);
    }
}

// ============================================================================
// TAB RENDERING HELPERS
// ============================================================================

function renderTabButton(tab, label, currentTab, position, padding, fontSize) {
    const isActive = currentTab === tab;
    return `
        <button
            class="analysis-tab-btn"
            data-tab="${tab}"
            data-position="${position}"
            style="
                padding: ${padding};
                background: ${isActive ? 'var(--primary-color)' : 'transparent'};
                color: ${isActive ? 'white' : 'var(--text-primary)'};
                border: none;
                border-bottom: 3px solid ${isActive ? 'var(--primary-color)' : 'transparent'};
                cursor: pointer;
                font-weight: 600;
                font-size: ${fontSize};
                transition: all 0.2s;
                white-space: nowrap;
            "
        >
            ${label}
        </button>
    `;
}

function renderPositionFilter(position, padding, fontSize) {
    const positions = ['all', 'GKP', 'DEF', 'MID', 'FWD'];
    const labels = { 'all': 'All', 'GKP': 'GKP', 'DEF': 'DEF', 'MID': 'MID', 'FWD': 'FWD' };

    return `
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
            ${positions.map(pos => {
                const isActive = position === pos;
                return `
                    <button
                        class="position-filter-btn"
                        data-position="${pos}"
                        style="
                            padding: ${padding};
                            background: ${isActive ? 'var(--accent-color)' : 'var(--bg-secondary)'};
                            color: ${isActive ? 'white' : 'var(--text-primary)'};
                            border: 1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-color)'};
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 500;
                            font-size: ${fontSize};
                            transition: all 0.2s;
                        "
                    >
                        ${labels[pos]}
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function renderTabContent(subTab, position) {
    switch (subTab) {
        case 'overview':
            return renderAnalysisOverview(position);
        case 'hidden-gems':
            return renderHiddenGems(position);
        case 'transfer-targets':
            return renderTransferTargets(position);
        case 'differentials':
            return renderDifferentials(position);
        case 'team-analysis':
            return renderTeamAnalysis(position);
        default:
            return renderAnalysisOverview(position);
    }
}

// ============================================================================
// TAB CONTENT WRAPPERS
// ============================================================================

function renderAnalysisOverview(position = 'all') {
    return renderAnalysisOverviewModule(
        position,
        renderSectionHeader,
        renderPlayerTable,
        renderPlayerTable
    );
}

function renderDifferentials(position = 'all') {
    // Get cached myTeamData from localStorage
    const myTeamCache = localStorage.getItem('fplanner_my_team_data');
    const myPlayerIds = new Set();

    if (myTeamCache) {
        try {
            const teamData = JSON.parse(myTeamCache);
            teamData.picks.picks.forEach(pick => myPlayerIds.add(pick.element));
        } catch (e) {
            console.error('Failed to parse my team cache:', e);
        }
    }

    return renderDifferentialsModule(position, analysisState, renderSectionHeader, myPlayerIds);
}

function renderHiddenGems(position = 'all') {
    return renderHiddenGemsModule(
        position,
        renderSectionHeader,
        renderPlayerTable,
        renderPlayerTable
    );
}

function renderTransferTargets(position = 'all') {
    return renderTransferTargetsModule(
        position,
        renderSectionHeader,
        renderPlayerTable,
        renderPlayerTable
    );
}

function renderTeamAnalysis(position = 'all') {
    return renderTeamAnalysisModule(
        position,
        renderSectionHeader,
        renderTeamTable
    );
}

// ============================================================================
// TEAM TABLE RENDERERS (Not yet extracted to modules)
// ============================================================================

function renderTeamTableMobile(teamAnalysis) {
    const fixtures = getFixtures();

    return `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${teamAnalysis.map((team, index) => {
                const nextFixtures = [];
                for (let i = 1; i <= 5; i++) {
                    const gw = getCurrentGW() + i;
                    const fixture = fixtures.find(f =>
                        f.event === gw && (f.team_h === team.team.id || f.team_a === team.team.id)
                    );

                    if (fixture) {
                        const isHome = fixture.team_h === team.team.id;
                        const opponentId = isHome ? fixture.team_a : fixture.team_h;
                        const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

                        const opponent = fplBootstrap.teams.find(t => t.id === opponentId);
                        const opponentShort = opponent ? opponent.short_name : '?';

                        nextFixtures.push({
                            opponent: `${isHome ? '' : '@'}${opponentShort}`,
                            difficulty: difficulty
                        });
                    } else {
                        nextFixtures.push({ opponent: '—', difficulty: 3 });
                    }
                }

                return `
                    <div style="
                        background: var(--bg-primary);
                        border-radius: 12px;
                        padding: 1rem;
                        box-shadow: 0 2px 8px var(--shadow);
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                            <div>
                                <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); margin-bottom: 0.25rem;">
                                    ${team.team.name}
                                </div>
                                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                    FDR(5): <span class="${getDifficultyClass(Math.round(team.fdr5))}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${team.fdr5.toFixed(1)}</span>
                                </div>
                            </div>
                            <div style="text-align: right; font-size: 0.75rem; color: var(--text-secondary);">
                                <div>Best: ${escapeHtml(team.bestPlayer?.web_name || 'N/A')}</div>
                                <div>${formatCurrency(team.bestPlayer?.now_cost || 0)}</div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${nextFixtures.map(f => `
                                <span class="${getDifficultyClass(f.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">
                                    ${f.opponent}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderTeamTable(teamAnalysis) {
    const fixtures = getFixtures();
    const fixtureHeaders = [];
    for (let i = 1; i <= 5; i++) {
        const gw = getCurrentGW() + i;
        const gwFixtures = fixtures.filter(f => f.event === gw);
        if (gwFixtures.length > 0) {
            fixtureHeaders.push(`GW${gw}`);
        } else {
            fixtureHeaders.push(`—`);
        }
    }

    let html = `
        <div style="overflow-x: auto; background: var(--bg-primary); border-radius: 12px; padding: 1rem; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead style="background: var(--primary-color); color: white;">
                    <tr>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Best Player</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(3)</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
    `;

    fixtureHeaders.forEach(h => {
        html += `<th style="text-align: center; padding: 0.5rem;">${h}</th>`;
    });

    html += `
                    </tr>
                </thead>
                <tbody>
    `;

    teamAnalysis.forEach((team, index) => {
        const rowBg = index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';

        const nextFixtures = [];
        for (let i = 1; i <= 5; i++) {
            const gw = getCurrentGW() + i;
            const fixture = fixtures.find(f =>
                f.event === gw && (f.team_h === team.team.id || f.team_a === team.team.id)
            );

            if (fixture) {
                const isHome = fixture.team_h === team.team.id;
                const opponentId = isHome ? fixture.team_a : fixture.team_h;
                const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

                const opponent = fplBootstrap.teams.find(t => t.id === opponentId);
                const opponentShort = opponent ? opponent.short_name : '?';

                nextFixtures.push({
                    opponent: `${isHome ? '' : '@'}${opponentShort}`,
                    difficulty: difficulty
                });
            } else {
                nextFixtures.push({ opponent: '—', difficulty: 3 });
            }
        }

        html += `
            <tr style="background: ${rowBg};">
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">${team.team.name}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${escapeHtml(team.bestPlayer?.web_name || 'N/A')}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(team.bestPlayer?.now_cost || 0)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${getDifficultyClass(Math.round(team.fdr3))}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${team.fdr3.toFixed(1)}</span></td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${getDifficultyClass(Math.round(team.fdr5))}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${team.fdr5.toFixed(1)}</span></td>
        `;

        nextFixtures.forEach(f => {
            html += `
                <td style="padding: 0.5rem; text-align: center;">
                    <span class="${getDifficultyClass(f.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">
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

// ============================================================================
// HELPERS
// ============================================================================

function renderSectionHeader(icon, title, description) {
    return `
        <div style="
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
            padding: 1.5rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            color: white;
            box-shadow: 0 4px 12px var(--shadow);
        ">
            <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem 0;">
                ${icon} ${title}
            </h2>
            <p style="margin: 0; opacity: 0.9; font-size: 0.95rem;">${description}</p>
        </div>
    `;
}

// ============================================================================
// AI INSIGHTS
// ============================================================================

async function loadAIInsightsForTab(tab, position) {
    if (tab !== 'overview') {
        const container = document.getElementById('ai-insights-container');
        if (container) container.innerHTML = '';
        return;
    }

    const allPlayers = getAllPlayers();
    let players = allPlayers;

    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = allPlayers.filter(p => p.element_type === posMap[position]);
    }

    const topPlayers = sortPlayers(players, 'total_points', false).slice(0, 20);

    const playerData = {
        topPerformers: topPlayers.map(p => ({
            name: p.web_name,
            team: getTeamShortName(p.team),
            price: formatCurrency(p.now_cost),
            points: p.total_points,
            form: parseFloat(p.form) || 0,
            ownership: parseFloat(p.selected_by_percent) || 0,
            ppm: calculatePPM(p),
            fdr: calculateFixtureDifficulty(p.team, 5)
        }))
    };

    await loadAndRenderInsights('data-analysis', tab, position, playerData);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function attachEventListeners(currentTab, currentPosition) {
    // Tab switching
    document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            const position = btn.dataset.position;
            renderDataAnalysis(tab, position);
        });
    });

    // Position filtering
    document.querySelectorAll('.position-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const position = btn.dataset.position;
            renderDataAnalysis(currentTab, position);
        });
    });

    // Differentials filters
    const ownershipSlider = document.getElementById('ownership-threshold-slider');
    if (ownershipSlider) {
        ownershipSlider.addEventListener('input', (e) => {
            document.getElementById('ownership-value').textContent = e.target.value + '%';
            updateOwnershipThreshold(e.target.value);
            renderDataAnalysis('differentials', currentPosition);
        });
    }

    const priceRangeBtns = document.querySelectorAll('.price-range-btn');
    priceRangeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setPriceRange(btn.dataset.range);
            renderDataAnalysis('differentials', currentPosition);
        });
    });

    const fixtureCheckbox = document.getElementById('fixture-filter-checkbox');
    if (fixtureCheckbox) {
        fixtureCheckbox.addEventListener('change', (e) => {
            setFixtureFilter(e.target.checked);
            renderDataAnalysis('differentials', currentPosition);
        });
    }

    const momentumCheckbox = document.getElementById('momentum-filter-checkbox');
    if (momentumCheckbox) {
        momentumCheckbox.addEventListener('change', (e) => {
            setMomentumFilter(e.target.checked);
            renderDataAnalysis('differentials', currentPosition);
        });
    }
}
