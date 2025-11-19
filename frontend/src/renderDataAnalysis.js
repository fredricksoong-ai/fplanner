// ============================================================================
// DATA ANALYSIS PAGE MODULE
// Provides statistical analysis and differential picks
// ============================================================================

import {
    getAllPlayers,
    fplBootstrap
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
    calculateFixtureDifficulty,
    getTeamsWithBestFixtures,
    getTeamsWithWorstFixtures,
    getGWOpponent,
    getMatchStatus
} from './fixtures.js';

import {
    attachRiskTooltipListeners
} from './renderHelpers.js';

import {
    loadAndRenderInsights
} from './renderInsightBanner.js';

import {
    isMobileDevice
} from './renderMyTeamMobile.js';

import {
    attachPlayerRowListeners
} from './renderMyTeamCompact.js';

// ============================================================================
// DATA ANALYSIS PAGE
// ============================================================================

// State for Data Analysis filters
let analysisState = {
    position: 'all',
    ownershipThreshold: 5,
    fixtureFilter: false,
    momentumFilter: false,
    priceRange: 'all' // 'all', 'budget' (<6.0m), 'mid' (6.0-9.0m), 'premium' (>9.0m)
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

export function setPriceRange(range) {
    analysisState.priceRange = range;
}

export function renderDataAnalysis(subTab = 'overview', position = 'all') {
    const container = document.getElementById('app-container');
    analysisState.position = position;
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
                <button
                    class="analysis-tab-btn"
                    data-tab="overview"
                    data-position="${position}"
                    style="
                        padding: ${tabPadding};
                        background: ${subTab === 'overview' ? 'var(--primary-color)' : 'transparent'};
                        color: ${subTab === 'overview' ? 'white' : 'var(--text-primary)'};
                        border: none;
                        border-bottom: 3px solid ${subTab === 'overview' ? 'var(--primary-color)' : 'transparent'};
                        cursor: pointer;
                        font-weight: 600;
                        font-size: ${tabFontSize};
                        transition: all 0.2s;
                        white-space: nowrap;
                    "
                >
                    Overview
                </button>
                <button
                    class="analysis-tab-btn"
                    data-tab="hidden-gems"
                    data-position="${position}"
                    style="
                        padding: ${tabPadding};
                        background: ${subTab === 'hidden-gems' ? 'var(--primary-color)' : 'transparent'};
                        color: ${subTab === 'hidden-gems' ? 'white' : 'var(--text-primary)'};
                        border: none;
                        border-bottom: 3px solid ${subTab === 'hidden-gems' ? 'var(--primary-color)' : 'transparent'};
                        cursor: pointer;
                        font-weight: 600;
                        font-size: ${tabFontSize};
                        transition: all 0.2s;
                        white-space: nowrap;
                    "
                >
                    Hidden Gems
                </button>
                <button
                    class="analysis-tab-btn"
                    data-tab="transfer-targets"
                    data-position="${position}"
                    style="
                        padding: ${tabPadding};
                        background: ${subTab === 'transfer-targets' ? 'var(--primary-color)' : 'transparent'};
                        color: ${subTab === 'transfer-targets' ? 'white' : 'var(--text-primary)'};
                        border: none;
                        border-bottom: 3px solid ${subTab === 'transfer-targets' ? 'var(--primary-color)' : 'transparent'};
                        cursor: pointer;
                        font-weight: 600;
                        font-size: ${tabFontSize};
                        transition: all 0.2s;
                        white-space: nowrap;
                    "
                >
                    Transfer Targets
                </button>
                <button
                    class="analysis-tab-btn"
                    data-tab="team-analysis"
                    data-position="${position}"
                    style="
                        padding: ${tabPadding};
                        background: ${subTab === 'team-analysis' ? 'var(--primary-color)' : 'transparent'};
                        color: ${subTab === 'team-analysis' ? 'white' : 'var(--text-primary)'};
                        border: none;
                        border-bottom: 3px solid ${subTab === 'team-analysis' ? 'var(--primary-color)' : 'transparent'};
                        cursor: pointer;
                        font-weight: 600;
                        font-size: ${tabFontSize};
                        transition: all 0.2s;
                        white-space: nowrap;
                    "
                >
                    Team Analysis
                </button>
            </div>

            ${!isMobile ? `<!-- Position Filter -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: ${isMobile ? '1rem' : '2rem'}; flex-wrap: wrap;">
                ${['all', 'GKP', 'DEF', 'MID', 'FWD'].map(pos => `
                    <button
                        class="position-filter-btn"
                        data-tab="${subTab}"
                        data-position="${pos}"
                        style="
                            padding: ${positionPadding};
                            background: ${position === pos ? 'var(--accent-color)' : 'var(--bg-secondary)'};
                            color: ${position === pos ? 'white' : 'var(--text-primary)'};
                            border: 1px solid ${position === pos ? 'var(--accent-color)' : 'var(--border-color)'};
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 500;
                            font-size: ${positionFontSize};
                            transition: all 0.2s;
                        "
                    >
                        ${pos === 'all' ? 'All Positions' : pos}
                    </button>
                `).join('')}
            </div>` : ''}
        </div>
    `;

    let contentHTML = '';
    if (subTab === 'overview') {
        contentHTML = renderAnalysisOverview(position);
    } else if (subTab === 'hidden-gems') {
        contentHTML = renderHiddenGems(position);
    } else if (subTab === 'transfer-targets') {
        contentHTML = renderTransferTargets(position);
    } else if (subTab === 'team-analysis') {
        contentHTML = renderTeamAnalysis(position);
    } else {
        contentHTML = renderAnalysisOverview(position);
    }

    const containerPadding = isMobile ? 'padding: 1rem;' : 'padding: 2rem;';

    container.innerHTML = `
        <div style="${containerPadding}">
            ${tabHTML}

            <!-- AI Insights Container -->
            <div id="ai-insights-container"></div>

            ${contentHTML}
        </div>
    `;

    // Load AI insights for current tab
    loadAIInsightsForTab(subTab, position);

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

    // Add event listeners for price range buttons
    const priceRangeButtons = container.querySelectorAll('.price-range-btn');
    priceRangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            window.togglePriceRange(btn.dataset.range);
        });
    });

    // Attach player row click listeners for mobile tables
    attachPlayerRowListeners();

    attachRiskTooltipListeners();
}

function renderAnalysisOverview(position = 'all') {
    let players = getAllPlayers();
    const isMobile = isMobileDevice();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    const top20 = sortPlayers(players, 'total_points', false).slice(0, 20);
    const bestValue = players.filter(p => calculateMinutesPercentage(p, getCurrentGW()) > 30);
    const top15Value = sortPlayers(bestValue, 'ppm', false).slice(0, 15);
    const top15Form = sortPlayers(bestValue, 'form', false).slice(0, 15);

    // Penalty takers (exclude GKP)
    const penaltyTakers = players.filter(p =>
        p.penalties_order === 1 && p.element_type !== 1
    ).sort((a, b) => calculateFixtureDifficulty(a.team, 5) - calculateFixtureDifficulty(b.team, 5));

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
                    ${renderSectionHeader('🛡️', 'Defensive Standouts', `Top ${position === 'all' ? 'outfield players' : position} by defensive contribution per 90`)}
                    ${isMobile ? renderPositionSpecificTableMobile(topDefensive, 'def90') : renderPositionSpecificTable(topDefensive, position)}
                </div>
            `;
        }
    }

    return `
        <div>
            <!-- Section 1: Top Performers -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🏆', 'Top Performers', `Top ${position === 'all' ? '20 players' : '20 ' + position} by total points`)}
                ${isMobile ? renderPositionSpecificTableMobile(top20, 'total') : renderPositionSpecificTable(top20, position)}
            </div>

            <!-- Section 2: Best Value -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('💰', 'Best Value', 'Top 15 by points per million (min 30% minutes played)')}
                ${isMobile ? renderPositionSpecificTableMobile(top15Value, 'ppm') : renderPositionSpecificTable(top15Value, position)}
            </div>

            <!-- Section 3: Form Stars -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🔥', 'Form Stars', 'Top 15 by recent form (min 30% minutes played)')}
                ${isMobile ? renderPositionSpecificTableMobile(top15Form, 'ppm') : renderPositionSpecificTable(top15Form, position)}
            </div>

            <!-- Section 4: Penalty Takers -->
            ${penaltyTakers.length > 0 ? `
                <div style="margin-top: 3rem;">
                    ${renderSectionHeader('⚽', 'Penalty Takers', 'First-choice penalty takers sorted by upcoming fixture difficulty')}
                    ${isMobile ? renderPositionSpecificTableMobile(penaltyTakers.slice(0, 15), 'penalty') : renderPositionSpecificTable(penaltyTakers.slice(0, 15), position)}
                </div>
            ` : ''}

            <!-- Section 5: Defensive Standouts (if applicable) -->
            ${defensiveSection}
        </div>
    `;
}

function renderDifferentials(position = 'all') {
    let players = getAllPlayers();
    const isMobile = isMobileDevice();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    // Apply filters
    const differentials = players.filter(p => {
        const ownership = parseFloat(p.selected_by_percent) || 0;
        if (ownership >= analysisState.ownershipThreshold) return false;

        // Price range filter
        const price = p.now_cost / 10; // Convert to millions
        if (analysisState.priceRange === 'budget' && price >= 6.0) return false;
        if (analysisState.priceRange === 'mid' && (price < 6.0 || price >= 9.0)) return false;
        if (analysisState.priceRange === 'premium' && price < 9.0) return false;

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

                <!-- Price Range Filter -->
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Price Range</label>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button
                            class="price-range-btn"
                            data-range="all"
                            style="
                                padding: 0.5rem 1rem;
                                background: ${analysisState.priceRange === 'all' ? 'var(--accent-color)' : 'var(--bg-primary)'};
                                color: ${analysisState.priceRange === 'all' ? 'white' : 'var(--text-primary)'};
                                border: 1px solid ${analysisState.priceRange === 'all' ? 'var(--accent-color)' : 'var(--border-color)'};
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: 500;
                                font-size: 0.875rem;
                            "
                        >All Prices</button>
                        <button
                            class="price-range-btn"
                            data-range="budget"
                            style="
                                padding: 0.5rem 1rem;
                                background: ${analysisState.priceRange === 'budget' ? 'var(--accent-color)' : 'var(--bg-primary)'};
                                color: ${analysisState.priceRange === 'budget' ? 'white' : 'var(--text-primary)'};
                                border: 1px solid ${analysisState.priceRange === 'budget' ? 'var(--accent-color)' : 'var(--border-color)'};
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: 500;
                                font-size: 0.875rem;
                            "
                        >Budget (<£6.0m)</button>
                        <button
                            class="price-range-btn"
                            data-range="mid"
                            style="
                                padding: 0.5rem 1rem;
                                background: ${analysisState.priceRange === 'mid' ? 'var(--accent-color)' : 'var(--bg-primary)'};
                                color: ${analysisState.priceRange === 'mid' ? 'white' : 'var(--text-primary)'};
                                border: 1px solid ${analysisState.priceRange === 'mid' ? 'var(--accent-color)' : 'var(--border-color)'};
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: 500;
                                font-size: 0.875rem;
                            "
                        >Mid-range (£6-9m)</button>
                        <button
                            class="price-range-btn"
                            data-range="premium"
                            style="
                                padding: 0.5rem 1rem;
                                background: ${analysisState.priceRange === 'premium' ? 'var(--accent-color)' : 'var(--bg-primary)'};
                                color: ${analysisState.priceRange === 'premium' ? 'white' : 'var(--text-primary)'};
                                border: 1px solid ${analysisState.priceRange === 'premium' ? 'var(--accent-color)' : 'var(--border-color)'};
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: 500;
                                font-size: 0.875rem;
                            "
                        >Premium (>£9.0m)</button>
                    </div>
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
            ${renderSectionHeader('🎯', 'Differential Picks', `Found ${sortedDiffs.length} ${position === 'all' ? 'players' : position} matching criteria`)}
            ${sortedDiffs.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(sortedDiffs, 'ownership') : renderPositionSpecificTable(sortedDiffs, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No differentials found matching criteria. Try adjusting filters.</div>'}
        </div>
    `;
}

function renderHiddenGems(position = 'all') {
    let players = getAllPlayers();
    const isMobile = isMobileDevice();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    // Filter players with enough minutes and data
    const activePlayers = players.filter(p => {
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        return minPercentage > 30;
    });

    // xG Overperformers (actual goals > expected)
    const overperformers = activePlayers.filter(p => {
        const xG = parseFloat(p.expected_goals) || 0;
        const actualGoals = p.goals_scored || 0;
        return actualGoals > xG + 1; // At least 1 goal over expected
    }).sort((a, b) => {
        const aVariance = (a.goals_scored || 0) - (parseFloat(a.expected_goals) || 0);
        const bVariance = (b.goals_scored || 0) - (parseFloat(b.expected_goals) || 0);
        return bVariance - aVariance;
    }).slice(0, 15);

    // xG Underperformers (expected > actual, likely to bounce back)
    const underperformers = activePlayers.filter(p => {
        const xG = parseFloat(p.expected_goals) || 0;
        const actualGoals = p.goals_scored || 0;
        const xGI = parseFloat(p.expected_goal_involvements) || 0;
        return xG > 2 && (xG - actualGoals) > 1.5; // High xG but underperforming
    }).sort((a, b) => {
        const aVariance = (parseFloat(a.expected_goals) || 0) - (a.goals_scored || 0);
        const bVariance = (parseFloat(b.expected_goals) || 0) - (b.goals_scored || 0);
        return bVariance - aVariance;
    }).slice(0, 15);

    // Bonus magnets (high BPS per 90, if available via github_season)
    const bonusMagnets = activePlayers.filter(p => {
        return p.bonus && p.bonus > 0;
    }).sort((a, b) => b.bonus - a.bonus).slice(0, 15);

    // Differentials (low ownership < 10%, good form, playing regularly)
    const differentials = activePlayers.filter(p => {
        const ownership = parseFloat(p.selected_by_percent) || 0;
        const form = parseFloat(p.form) || 0;
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());

        return ownership < 10 && ownership > 0 && form > 3 && minPercentage > 40;
    }).sort((a, b) => b.total_points - a.total_points).slice(0, 15);

    return `
        <div>
            <!-- Section 1: xG Overperformers -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🔥', 'xG Overperformers', 'Players scoring more than expected (hot streak, may not be sustainable)')}
                ${overperformers.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(overperformers, 'xg-variance') : renderPositionSpecificTable(overperformers, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No overperformers found</div>'}
            </div>

            <!-- Section 2: xG Underperformers -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('📈', 'xG Underperformers (Bounce-back Candidates)', 'High xG but low actual goals - likely to return to form')}
                ${underperformers.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(underperformers, 'xg') : renderPositionSpecificTable(underperformers, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No underperformers found</div>'}
            </div>

            <!-- Section 3: Bonus Magnets -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🎁', 'Bonus Magnets', 'Players with high bonus points (valuable for tight gameweeks)')}
                ${bonusMagnets.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(bonusMagnets, 'bonus') : renderPositionSpecificTable(bonusMagnets, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No bonus magnets found</div>'}
            </div>

            <!-- Section 4: Differentials -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('💎', 'Differentials (<10% Owned)', 'Low ownership players in good form - differential picks to gain rank')}
                ${differentials.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(differentials, 'ownership') : renderPositionSpecificTable(differentials, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No differentials found</div>'}
            </div>
        </div>
    `;
}

function renderTransferTargets(position = 'all') {
    let players = getAllPlayers();
    const isMobile = isMobileDevice();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    // Rising stars (positive momentum + good fixtures + good form)
    const risingStars = players.filter(p => {
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        if (minPercentage < 30) return false;

        const form = parseFloat(p.form) || 0;
        const fdr5 = calculateFixtureDifficulty(p.team, 5);

        let hasPositiveMomentum = false;
        if (p.github_transfers) {
            const net = p.github_transfers.transfers_in - p.github_transfers.transfers_out;
            hasPositiveMomentum = net > 0;
        }

        return form > 4 && fdr5 <= 3.0 && hasPositiveMomentum;
    }).sort((a, b) => {
        const aNet = a.github_transfers ? (a.github_transfers.transfers_in - a.github_transfers.transfers_out) : 0;
        const bNet = b.github_transfers ? (b.github_transfers.transfers_in - b.github_transfers.transfers_out) : 0;
        return bNet - aNet;
    }).slice(0, 20);

    // Sell candidates (negative momentum + bad fixtures + poor form)
    const sellCandidates = players.filter(p => {
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        const ownership = parseFloat(p.selected_by_percent) || 0;
        if (minPercentage < 20 || ownership < 2) return false;

        const form = parseFloat(p.form) || 0;
        const fdr5 = calculateFixtureDifficulty(p.team, 5);

        let hasNegativeMomentum = false;
        if (p.github_transfers) {
            const net = p.github_transfers.transfers_in - p.github_transfers.transfers_out;
            hasNegativeMomentum = net < -10000; // Significant negative transfers
        }

        return (form < 3 || fdr5 >= 4.0) && hasNegativeMomentum;
    }).sort((a, b) => {
        const aNet = a.github_transfers ? (a.github_transfers.transfers_in - a.github_transfers.transfers_out) : 0;
        const bNet = b.github_transfers ? (b.github_transfers.transfers_in - b.github_transfers.transfers_out) : 0;
        return aNet - bNet;
    }).slice(0, 20);

    // Fixture turnarounds (bad fixtures now, good fixtures soon)
    const fixtureTurnarounds = players.filter(p => {
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        if (minPercentage < 30) return false;

        const next3FDR = calculateFixtureDifficulty(p.team, 3);
        // Would need to calculate next 3 after that for swing
        // For now, just use players with improving fixtures
        return next3FDR <= 2.5;
    }).sort((a, b) => {
        const aFDR = calculateFixtureDifficulty(a.team, 5);
        const bFDR = calculateFixtureDifficulty(b.team, 5);
        return aFDR - bFDR;
    }).slice(0, 15);

    return `
        <div>
            <!-- Section 1: Rising Stars -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('⭐', 'Rising Stars', 'High form + good fixtures + positive transfer momentum')}
                ${risingStars.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(risingStars, 'transfers') : renderPositionSpecificTable(risingStars, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No rising stars found</div>'}
            </div>

            <!-- Section 2: Sell Candidates -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('📉', 'Sell Candidates', 'Poor form or bad fixtures + negative transfer momentum')}
                ${sellCandidates.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(sellCandidates, 'transfers') : renderPositionSpecificTable(sellCandidates, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No sell candidates found</div>'}
            </div>

            <!-- Section 3: Fixture Turnarounds -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🔄', 'Fixture Turnarounds', 'Players with improving fixtures (good time to buy before price rises)')}
                ${fixtureTurnarounds.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(fixtureTurnarounds, 'fdr5') : renderPositionSpecificTable(fixtureTurnarounds, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No fixture turnarounds found</div>'}
            </div>
        </div>
    `;
}

function renderTeamAnalysis(position = 'all') {
    if (!fplBootstrap || !fplBootstrap.teams) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Team data not available</div>';
    }

    // Get all teams with fixture analysis
    const teamAnalysis = fplBootstrap.teams.map(team => {
        const fdr3 = calculateFixtureDifficulty(team.id, 3);
        const fdr5 = calculateFixtureDifficulty(team.id, 5);

        // Find best player from this team
        const teamPlayers = getAllPlayers().filter(p => p.team === team.id);
        const bestPlayer = teamPlayers.sort((a, b) => b.total_points - a.total_points)[0];

        return {
            team,
            fdr3,
            fdr5,
            bestPlayer,
            strength: team.strength,
            strengthAttackHome: team.strength_attack_home,
            strengthAttackAway: team.strength_attack_away,
            strengthDefenceHome: team.strength_defence_home,
            strengthDefenceAway: team.strength_defence_away
        };
    });

    // Best fixtures (next 5)
    const bestFixtures = [...teamAnalysis].sort((a, b) => a.fdr5 - b.fdr5).slice(0, 10);

    // Worst fixtures (next 5)
    const worstFixtures = [...teamAnalysis].sort((a, b) => b.fdr5 - a.fdr5).slice(0, 10);

    // Best attack teams
    const bestAttack = [...teamAnalysis].sort((a, b) =>
        (b.team.strength_attack_home + b.team.strength_attack_away) -
        (a.team.strength_attack_home + a.team.strength_attack_away)
    ).slice(0, 10);

    // Best defense teams
    const bestDefense = [...teamAnalysis].sort((a, b) =>
        (b.team.strength_defence_home + b.team.strength_defence_away) -
        (a.team.strength_defence_home + a.team.strength_defence_away)
    ).slice(0, 10);

    return `
        <div>
            <!-- Section 1: Best Fixtures -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('✅', 'Teams with Best Fixtures (Next 5 GWs)', '')}
                ${renderTeamTable(bestFixtures)}
            </div>

            <!-- Section 2: Worst Fixtures -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('❌', 'Teams with Worst Fixtures (Next 5 GWs)', '')}
                ${renderTeamTable(worstFixtures)}
            </div>

            <!-- Section 3: Best Attack -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('⚔️', 'Best Attack Teams', '')}
                ${renderTeamTable(bestAttack)}
            </div>

            <!-- Section 4: Best Defense -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🛡️', 'Best Defense Teams', '')}
                ${renderTeamTable(bestDefense)}
            </div>
        </div>
    `;
}

function renderTeamTableMobile(teamAnalysis) {
    const currentGW = getCurrentGW();
    const fixtureHeaders = getFixtureHeaders(5, 1);

    let html = `
        <div class="mobile-table">
            <!-- Header Row -->
            <div class="mobile-table-header" style="grid-template-columns: 1fr 0.7fr 1.15fr 1.15fr 1.15fr 1.15fr 1.15fr; padding-bottom: 2px !important; padding-top: 2px !important;">
                <div style="text-align: left;">Team</div>
                <div style="text-align: center;">FDR(5)</div>
                ${fixtureHeaders.map(h => `<div style="text-align: center;">${h}</div>`).join('')}
            </div>
    `;

    teamAnalysis.forEach((ta, index) => {
        const fdr5Class = getDifficultyClass(Math.round(ta.fdr5));
        const next5 = getFixtures(ta.team.id, 10, false).filter(f => f.event > currentGW).slice(0, 5);

        // Pad if less than 5 fixtures
        while (next5.length < 5) {
            next5.push({ opponent: '—', difficulty: 0 });
        }

        html += `
            <div class="mobile-table-row" style="grid-template-columns: 1fr 0.7fr 1.15fr 1.15fr 1.15fr 1.15fr 1.15fr; padding-bottom: 3px !important; padding-top: 3px !important;">
                <div style="text-align: left; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${getTeamShortName(ta.team.id)}</div>
                <div style="text-align: center;"><span class="${fdr5Class}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 700; font-size: 0.6rem; display: inline-block;">${formatDecimal(ta.fdr5)}</span></div>
                ${next5.map(f => `
                    <div style="text-align: center;">${f.opponent !== '—' ? `<span class="${getDifficultyClass(f.difficulty)}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 700; font-size: 0.6rem; display: inline-block; white-space: nowrap;">${f.opponent}</span>` : '<span style="color: var(--text-tertiary);">—</span>'}</div>
                `).join('')}
            </div>
        `;
    });

    html += `</div>`;

    return html;
}

function renderTeamTable(teamAnalysis) {
    const isMobile = isMobileDevice();

    // Use mobile table on mobile devices
    if (isMobile) {
        return renderTeamTableMobile(teamAnalysis);
    }

    // Desktop table
    const fixtureHeaders = getFixtureHeaders(5, 1);

    let html = `
        <div style="overflow-x: auto; background: var(--bg-secondary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead style="background: var(--primary-color); color: white;">
                    <tr>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Best Player</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(3)</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
                        ${fixtureHeaders.map(h => `<th style="text-align: center; padding: 0.5rem;">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    teamAnalysis.forEach((ta, index) => {
        const rowBg = index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';
        const fdr3Class = getDifficultyClass(Math.round(ta.fdr3));
        const fdr5Class = getDifficultyClass(Math.round(ta.fdr5));

        const bestPlayerName = ta.bestPlayer ? escapeHtml(ta.bestPlayer.web_name) : '—';
        const bestPlayerPrice = ta.bestPlayer ? formatCurrency(ta.bestPlayer.now_cost) : '—';
        const bestPlayerPts = ta.bestPlayer ? ta.bestPlayer.total_points : '—';

        const currentGW = getCurrentGW();
        const next5 = getFixtures(ta.team.id, 10, false).filter(f => f.event > currentGW).slice(0, 5);

        html += `
            <tr style="background: ${rowBg}; border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.75rem 0.5rem;"><strong>${escapeHtml(ta.team.name)}</strong></td>
                <td style="padding: 0.75rem 0.5rem;">${bestPlayerName}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${bestPlayerPrice}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${bestPlayerPts}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdr3Class}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(ta.fdr3)}</span></td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdr5Class}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(ta.fdr5)}</span></td>
        `;

        next5.forEach((f) => {
            html += `
                <td style="padding: 0.5rem; text-align: center;">
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

/**
 * Helper to render section headers with mobile-friendly sizing
 * @param {string} icon - Emoji icon
 * @param {string} title - Section title
 * @param {string} description - Section description
 * @returns {string} HTML for section header
 */
function renderSectionHeader(icon, title, description) {
    const isMobile = isMobileDevice();
    const titleSize = isMobile ? '1.125rem' : '1.5rem';
    const descSize = isMobile ? '0.8rem' : '1rem';
    const marginBottom = isMobile ? '1rem' : '2rem';

    return `
        <h2 style="font-size: ${titleSize}; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
            ${icon} ${title}
        </h2>
        <p style="color: var(--text-secondary); margin-bottom: ${marginBottom}; font-size: ${descSize};">
            ${description}
        </p>
    `;
}

/**
 * Render mobile-optimized table with context column
 * Base columns: Player | Opp | Status | Pts | Form | [Context]
 * @param {Array} players - Array of player objects
 * @param {string} contextColumn - Type of context column: 'total', 'ppm', 'ownership', 'transfers', 'xg-variance', 'xg', 'bonus', 'def90', 'fdr5', 'penalty'
 */
function renderPositionSpecificTableMobile(players, contextColumn = 'total') {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }

    const currentGW = getCurrentGW();

    // Limit to top 15 for mobile
    const mobilePlayers = players.slice(0, 15);

    // Context column header and value function
    const contextConfig = {
        'total': {
            header: 'Total',
            getValue: (p) => p.total_points,
            getHeatmap: (p) => {
                // Total points heatmap (0-200 range)
                const pts = p.total_points || 0;
                if (pts >= 100) return 'dark-green';
                if (pts >= 70) return 'light-green';
                if (pts >= 40) return 'yellow';
                if (pts >= 20) return 'red';
                return 'gray';
            }
        },
        'ppm': {
            header: 'PPM',
            getValue: (p) => formatDecimal(calculatePPM(p)),
            getHeatmap: (p) => {
                // PPM heatmap (points per million)
                const ppm = calculatePPM(p);
                if (ppm >= 6) return 'dark-green';
                if (ppm >= 5) return 'light-green';
                if (ppm >= 4) return 'yellow';
                if (ppm >= 3) return 'red';
                return 'gray';
            }
        },
        'ownership': {
            header: 'Own%',
            getValue: (p) => `${(parseFloat(p.selected_by_percent) || 0).toFixed(1)}%`,
            getHeatmap: (p) => {
                // Ownership heatmap (inverted - lower is better for differentials)
                const own = parseFloat(p.selected_by_percent) || 0;
                if (own >= 30) return 'red';
                if (own >= 15) return 'yellow';
                if (own >= 5) return 'light-green';
                if (own > 0) return 'dark-green';
                return 'gray';
            }
        },
        'transfers': {
            header: 'ΔT',
            getValue: (p) => {
                if (!p.github_transfers) return '—';
                const net = p.github_transfers.transfers_in - p.github_transfers.transfers_out;
                const prefix = net > 0 ? '+' : '';
                return `${prefix}${(net / 1000).toFixed(0)}k`;
            },
            getColor: (p) => {
                if (!p.github_transfers) return 'inherit';
                const net = p.github_transfers.transfers_in - p.github_transfers.transfers_out;
                return net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
            }
        },
        'xg-variance': {
            header: 'G-xG',
            getValue: (p) => {
                const variance = (p.goals_scored || 0) - (parseFloat(p.expected_goals) || 0);
                return variance > 0 ? `+${formatDecimal(variance)}` : formatDecimal(variance);
            },
            getHeatmap: (p) => {
                // Variance heatmap (positive is good, negative is bad)
                const variance = (p.goals_scored || 0) - (parseFloat(p.expected_goals) || 0);
                if (variance >= 2) return 'dark-green';
                if (variance >= 1) return 'light-green';
                if (variance >= -1) return 'yellow';
                if (variance >= -2) return 'red';
                return 'gray';
            }
        },
        'xg': {
            header: 'xG',
            getValue: (p) => formatDecimal(parseFloat(p.expected_goals) || 0),
            getHeatmap: (p) => {
                // xG heatmap
                const xg = parseFloat(p.expected_goals) || 0;
                if (xg >= 4) return 'dark-green';
                if (xg >= 2.5) return 'light-green';
                if (xg >= 1.5) return 'yellow';
                if (xg >= 0.5) return 'red';
                return 'gray';
            }
        },
        'bonus': {
            header: 'Bonus',
            getValue: (p) => p.bonus || 0,
            getHeatmap: (p) => {
                // Bonus points heatmap
                const bonus = p.bonus || 0;
                if (bonus >= 10) return 'dark-green';
                if (bonus >= 5) return 'light-green';
                if (bonus >= 2) return 'yellow';
                if (bonus >= 1) return 'red';
                return 'gray';
            }
        },
        'def90': {
            header: 'Def/90',
            getValue: (p) => formatDecimal(p.github_season?.defensive_contribution_per_90 || 0),
            getHeatmap: (p) => {
                // Defensive contribution per 90 heatmap
                const def = p.github_season?.defensive_contribution_per_90 || 0;
                if (def >= 5) return 'dark-green';
                if (def >= 4) return 'light-green';
                if (def >= 3) return 'yellow';
                if (def >= 2) return 'red';
                return 'gray';
            }
        },
        'fdr5': {
            header: 'FDR(5)',
            getValue: (p) => formatDecimal(calculateFixtureDifficulty(p.team, 5)),
            getClass: (p) => getDifficultyClass(Math.round(calculateFixtureDifficulty(p.team, 5)))
        },
        'penalty': { header: 'PK', getValue: (p) => p.penalties_order === 1 ? '⚽' : '—' }
    };

    const config = contextConfig[contextColumn] || contextConfig.total;

    // Header row
    let html = `
        <div class="mobile-table">
            <div class="mobile-table-header" style="grid-template-columns: 2fr 1.2fr 1fr 0.7fr 0.7fr 0.8fr; padding-bottom: 2px !important; padding-top: 2px !important;">
                <div>Player</div>
                <div style="text-align: center;">Opp</div>
                <div style="text-align: center;">Status</div>
                <div style="text-align: center;">Pts</div>
                <div style="text-align: center;">Form</div>
                <div style="text-align: center;">${config.header}</div>
            </div>
    `;

    // Render rows
    mobilePlayers.forEach((player) => {
        const gwOpp = getGWOpponent(player.team, currentGW);
        const matchStatus = getMatchStatus(player.team, currentGW, player);
        const isLive = matchStatus === 'LIVE';
        const isFinished = matchStatus.startsWith('FT');

        // Points (GW points)
        const gwPoints = player.event_points || 0;
        const ptsHeatmap = getPtsHeatmap(gwPoints);
        const ptsStyle = getHeatmapStyle(ptsHeatmap);

        // Form
        const formHeatmap = getFormHeatmap(parseFloat(player.form) || 0);
        const formStyle = getHeatmapStyle(formHeatmap);

        // Status styling (matching My Team logic)
        let statusColor = 'var(--text-secondary)';
        let statusWeight = '400';
        let statusBgColor = 'transparent';

        if (isFinished && matchStatus.includes('(')) {
            // Extract minutes from "FT (90)" format
            const minsMatch = matchStatus.match(/\((\d+)\)/);
            if (minsMatch) {
                const mins = parseInt(minsMatch[1]);
                statusWeight = '700';
                if (mins >= 90) {
                    statusColor = '#86efac'; // Soft green
                    statusBgColor = 'rgba(31, 77, 46, 1.0)';
                } else if (mins >= 60) {
                    statusColor = '#fcd34d'; // Soft yellow/orange
                    statusBgColor = 'rgba(92, 74, 31, 1.0)';
                } else {
                    statusColor = '#fca5a5'; // Soft red
                    statusBgColor = 'rgba(92, 31, 31, 1.0)';
                }
            } else {
                statusColor = '#22c55e'; // FT but no minutes data
            }
        } else if (isLive) {
            statusColor = '#ef4444';
            statusWeight = '700';
        }

        // Context column value and styling
        const contextValue = config.getValue(player);

        // Render context column with appropriate styling
        let contextHTML = '';
        if (config.getClass) {
            // Use difficulty class (for FDR)
            const contextClass = config.getClass(player);
            contextHTML = `<span class="${contextClass}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 700; font-size: 0.6rem; display: inline-block;">${contextValue}</span>`;
        } else if (config.getHeatmap) {
            // Use heatmap (for total, ppm, ownership, etc.)
            const heatmap = config.getHeatmap(player);
            const heatmapStyle = getHeatmapStyle(heatmap);
            contextHTML = `<span style="background: ${heatmapStyle.background}; color: ${heatmapStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem; display: inline-block;">${contextValue}</span>`;
        } else if (config.getColor) {
            // Use custom color (for transfers)
            const contextColor = config.getColor(player);
            contextHTML = `<span style="color: ${contextColor}; font-weight: 700; font-size: 0.7rem;">${contextValue}</span>`;
        } else {
            // Default styling
            contextHTML = contextValue;
        }

        html += `
            <div
                class="player-row mobile-table-row"
                style="grid-template-columns: 2fr 1.2fr 1fr 0.7fr 0.7fr 0.8fr; cursor: pointer; padding-bottom: 3px !important; padding-top: 3px !important;"
                data-player-id="${player.id}"
            >
                <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(player.web_name)}
                </div>
                <div style="text-align: center;">
                    <span class="${getDifficultyClass(gwOpp.difficulty)}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 700; font-size: 0.6rem; min-width: 3rem; display: inline-block; text-align: center;">
                        ${gwOpp.name} (${gwOpp.isHome ? 'H' : 'A'})
                    </span>
                </div>
                <div style="text-align: center; font-size: 0.6rem; font-weight: ${statusWeight}; color: ${statusColor}; background: ${statusBgColor}; padding: 0.08rem 0.25rem; border-radius: 0.25rem;">${matchStatus}</div>
                <div style="text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${gwPoints}</div>
                <div style="text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 700; padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-size: 0.6rem;">${formatDecimal(player.form)}</div>
                <div style="text-align: center;">${contextHTML}</div>
            </div>
        `;
    });

    html += `</div>`;
    return html;
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
        <div style="overflow-x: auto; background: var(--bg-secondary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
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

        html += `<tr style="background: ${rowBg}; border-bottom: 1px solid var(--border-color);">`;

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

/**
 * Load AI insights for current tab
 */
async function loadAIInsightsForTab(tab, position) {
    // Only load AI insights for Overview tab
    if (tab !== 'overview') {
        // Clear AI insights container for other tabs
        const container = document.getElementById('ai-insights-container');
        if (container) {
            container.innerHTML = '';
        }
        return;
    }

    const isMobile = isMobileDevice();
    const currentGW = getCurrentGW();
    const players = getAllPlayers();

    // Prepare comprehensive data for all 5 AI categories
    let filteredPlayers = players;
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        filteredPlayers = players.filter(p => p.element_type === posMap[position]);
    }

    // 1. Overview data: Top performers and form players
    const topPerformers = sortPlayers(filteredPlayers, 'total_points', false)
        .slice(0, 15)
        .map(p => ({
            name: p.web_name,
            position: getPositionShort(p),
            points: p.total_points,
            form: parseFloat(p.form) || 0,
            ppm: calculatePPM(p),
            ownership: parseFloat(p.selected_by_percent) || 0,
            price: p.now_cost / 10
        }));

    // 2. Hidden Gems: Low ownership (<5%) but good form/value
    const hiddenGems = filteredPlayers
        .filter(p => {
            const ownership = parseFloat(p.selected_by_percent) || 0;
            const form = parseFloat(p.form) || 0;
            const minutesPerc = calculateMinutesPercentage(p, currentGW);
            return ownership < 5 && form > 3 && minutesPerc > 50;
        })
        .slice(0, 15)
        .map(p => ({
            name: p.web_name,
            position: getPositionShort(p),
            ownership: parseFloat(p.selected_by_percent) || 0,
            form: parseFloat(p.form) || 0,
            ppm: calculatePPM(p),
            price: p.now_cost / 10
        }));

    // 3. Differentials: Low ownership (<15%) with high upside
    const differentials = filteredPlayers
        .filter(p => {
            const ownership = parseFloat(p.selected_by_percent) || 0;
            return ownership < 15 && ownership > 0;
        })
        .slice(0, 15)
        .map(p => ({
            name: p.web_name,
            position: getPositionShort(p),
            ownership: parseFloat(p.selected_by_percent) || 0,
            form: parseFloat(p.form) || 0,
            ppm: calculatePPM(p),
            price: p.now_cost / 10,
            transfersIn: p.transfers_in_event || 0,
            transfersOut: p.transfers_out_event || 0
        }));

    // 4. Transfer Targets: Best value + fixtures
    const bestValue = filteredPlayers.filter(p => calculateMinutesPercentage(p, currentGW) > 50);
    const transferTargets = sortPlayers(bestValue, 'ppm', false)
        .slice(0, 15)
        .map(p => ({
            name: p.web_name,
            position: getPositionShort(p),
            ppm: calculatePPM(p),
            form: parseFloat(p.form) || 0,
            ownership: parseFloat(p.selected_by_percent) || 0,
            price: p.now_cost / 10,
            points: p.total_points
        }));

    // 5. Team Analysis: Teams with best/worst fixtures in next 5 games
    const teamsWithBestFixtures = getTeamsWithBestFixtures(10, 5);
    const teamsWithWorstFixtures = getTeamsWithWorstFixtures(10, 5);

    const contextData = {
        overview: {
            topPerformers,
            positionFilter: position,
            totalPlayers: filteredPlayers.length
        },
        hiddenGems,
        differentials,
        transferTargets,
        teamAnalysis: {
            bestFixtures: teamsWithBestFixtures,
            worstFixtures: teamsWithWorstFixtures,
            currentGW
        }
    };

    // Build context for AI
    const context = {
        page: 'data-analysis',
        tab: 'overview',  // Always overview for AI insights
        position: position,
        gameweek: currentGW,
        data: contextData
    };

    // Load and render insights
    await loadAndRenderInsights(context, 'ai-insights-container', isMobile);
}
