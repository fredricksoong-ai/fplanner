// ============================================================================
// DATA ANALYSIS PAGE MODULE
// Provides statistical analysis and differential picks
// ============================================================================

import {
    getAllPlayers,
    fplBootstrap,
    getActiveGW
} from './data.js';

import { sharedState } from './sharedState.js';

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

import { analyzePlayerRisks } from './risk.js';

import { debounce } from './utils/debounce.js';

import {
    loadAndRenderInsights
} from './renderInsightBanner.js';

import {
    isMobileDevice
} from './renderMyTeamMobile.js';

import {
    attachPlayerRowListeners
} from './renderMyTeamCompact.js';

import { calculateStatusColor } from './myTeam/compact/compactStyleHelpers.js';

import { renderAnalysisOverview as renderAnalysisOverviewModule } from './dataAnalysis/overview.js';
import { renderHiddenGems as renderHiddenGemsModule } from './dataAnalysis/hiddenGems.js';
import { renderTransferTargets as renderTransferTargetsModule } from './dataAnalysis/transferTargets.js';
import { renderTeamAnalysis as renderTeamAnalysisModule } from './dataAnalysis/teamAnalysis.js';
import { renderChartsSkeleton, initializeChartsTab } from './dataAnalysis/chartsTab.js';
import { getMyPlayerIdSet } from './utils/myPlayers.js';
import { isWishlisted } from './wishlist/store.js';
import { buildManagerSnapshot } from './aiManagerSnapshot.js';
import { getSegmentedControlStyles } from './styles/mobileDesignSystem.js';

/**
 * Check if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

function getNetTransfersValue(player) {
    if (player?.github_transfers) {
        return player.github_transfers.transfers_in - player.github_transfers.transfers_out;
    }
    if (typeof player?.transfers_in_event === 'number' && typeof player?.transfers_out_event === 'number') {
        return player.transfers_in_event - player.transfers_out_event;
    }
    return null;
}

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

let activeAnalysisTab = 'overview';
let wishlistListenerAttached = false;

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
    activeAnalysisTab = subTab;
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
            ${!isMobile ? `<h1 style="font-size: ${headerSize}; font-weight: 700; color: var(--text-primary); margin-bottom: ${headerMargin};">
                <i class="fas fa-chart-bar"></i> Data Analysis
            </h1>` : ''}

            <!-- Main Tabs (iOS-style Segmented Control) -->
            <div style="margin-bottom: 1rem; overflow-x: auto; display: flex; justify-content: ${isMobile ? 'flex-start' : 'center'};">
                ${(() => {
                    const segStyles = getSegmentedControlStyles(isDarkMode(), isMobile);
                    const tabs = [
                        { id: 'overview', label: 'Overview' },
                        { id: 'hidden-gems', label: 'Hidden Gems' },
                        { id: 'transfer-targets', label: 'Transfers' },
                        { id: 'team-analysis', label: 'Teams' },
                        { id: 'charts', label: 'Charts' }
                    ];

                    const containerStyle = Object.entries(segStyles.container)
                        .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`)
                        .join('; ');

                    return `
                        <div style="${containerStyle}">
                            ${tabs.map(tab => {
                                const isActive = subTab === tab.id;
                                const buttonStyle = Object.entries({
                                    ...segStyles.button,
                                    ...(isActive ? segStyles.activeButton : {})
                                })
                                .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`)
                                .join('; ');

                                return `
                                    <button
                                        class="analysis-tab-btn"
                                        data-tab="${tab.id}"
                                        data-position="${position}"
                                        style="${buttonStyle}"
                                        onmousedown="this.style.transform='scale(0.95)'"
                                        onmouseup="this.style.transform='scale(1)'"
                                        onmouseleave="this.style.transform='scale(1)'"
                                        ontouchstart="this.style.transform='scale(0.95)'"
                                        ontouchend="this.style.transform='scale(1)'"
                                    >
                                        ${tab.label}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    `;
                })()}
            </div>

            ${!isMobile ? `<!-- Position Filter -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: ${isMobile ? '1rem' : '2rem'}; flex-wrap: wrap;">
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
                            border-radius: 0.5rem;
                            cursor: pointer;
                            font-weight: 500;
                            font-size: 0.75rem;
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
    } else if (subTab === 'charts') {
        contentHTML = renderChartsSkeleton(position);
    } else {
        contentHTML = renderAnalysisOverview(position);
    }

    const containerPadding = isMobile ? 'padding: 0.75rem;' : 'padding: 2rem;';

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

    // Add debounced event listener for ownership threshold slider
    const ownershipSlider = document.getElementById('ownership-threshold-slider');
    if (ownershipSlider) {
        // Update display immediately, but debounce the re-render
        ownershipSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('ownership-value').textContent = `${value}%`;
        });
        
        // Debounce the actual filter update and re-render (300ms)
        const debouncedUpdate = debounce((value) => {
            window.updateOwnershipThreshold(value);
        }, 300);
        
        ownershipSlider.addEventListener('input', (e) => {
            debouncedUpdate(e.target.value);
        });
    }

    // Add debounced event listeners for filter checkboxes
    const fixtureCheckbox = document.getElementById('fixture-filter-checkbox');
    if (fixtureCheckbox) {
        const debouncedToggle = debounce((checked) => {
            window.toggleFixtureFilter(checked);
        }, 300);
        
        fixtureCheckbox.addEventListener('change', (e) => {
            debouncedToggle(e.target.checked);
        });
    }

    const momentumCheckbox = document.getElementById('momentum-filter-checkbox');
    if (momentumCheckbox) {
        const debouncedToggle = debounce((checked) => {
            window.toggleMomentumFilter(checked);
        }, 300);
        
        momentumCheckbox.addEventListener('change', (e) => {
            debouncedToggle(e.target.checked);
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
    // Pass shared state for league ownership in player modal
    attachPlayerRowListeners(sharedState.getTeamState());

    attachRiskTooltipListeners();

    // Add event delegation for "Load More" buttons
    container.addEventListener('click', (e) => {
        const loadMoreBtn = e.target.closest('.load-more-players-btn');
        if (loadMoreBtn) {
            const totalCount = parseInt(loadMoreBtn.dataset.totalCount);
            const currentCount = parseInt(loadMoreBtn.dataset.currentCount);
            const loadMore = 20; // Load 20 more items
            
            // Update the count
            const newCount = Math.min(currentCount + loadMore, totalCount);
            loadMoreBtn.dataset.currentCount = newCount;
            
            // Re-render the table with more items
            const hash = window.location.hash.slice(1);
            const parts = hash.split('/');
            const tab = parts[1] || 'overview';
            const position = parts[2] || 'all';
            
            // Temporarily store the desired count
            window._tempPlayerLimit = newCount;
            
            // Re-render
            renderDataAnalysis(tab, position);
        }
    });

    if (typeof window !== 'undefined' && !wishlistListenerAttached) {
        window.addEventListener('wishlist-updated', () => {
            if (window.location.hash.startsWith('#data-analysis')) {
                renderDataAnalysis(activeAnalysisTab, analysisState.position);
            }
        });
        wishlistListenerAttached = true;
    }

    if (subTab === 'charts') {
        initializeChartsTab(position);
    }
}

function renderAnalysisOverview(position = 'all') {
    return renderAnalysisOverviewModule(
        position,
        renderSectionHeader,
        renderPositionSpecificTableMobile,
        renderPositionSpecificTable
    );
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
            <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 2rem;">
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
                                border-radius: 0.5rem;
                                cursor: pointer;
                                font-weight: 500;
                                font-size: 0.75rem;
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
                                border-radius: 0.5rem;
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
                                border-radius: 0.5rem;
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
                                border-radius: 0.5rem;
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
    return renderHiddenGemsModule(
        position,
        renderSectionHeader,
        renderPositionSpecificTableMobile,
        renderPositionSpecificTable
    );
}

function renderTransferTargets(position = 'all') {
    return renderTransferTargetsModule(
        position,
        renderSectionHeader,
        renderPositionSpecificTableMobile,
        renderPositionSpecificTable
    );
}

function renderTeamAnalysis(position = 'all') {
    return renderTeamAnalysisModule(
        position,
        renderSectionHeader,
        renderTeamTable
    );
}

function renderTeamTableMobile(teamAnalysis) {
    const currentGW = getActiveGW(); // Use active GW for upcoming fixtures
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
        <div style="overflow-x: auto; background: var(--bg-secondary); border-radius: 0.75rem; box-shadow: 0 2px 8px var(--shadow);">
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

        const activeGW = getActiveGW();
        const next5 = getFixtures(ta.team.id, 10, false).filter(f => f.event > activeGW).slice(0, 5);

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
    const titleSize = isMobile ? '1rem' : '1.5rem';
    const descSize = isMobile ? '0.7rem' : '1rem';
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
 * @param {string} contextColumn - Type of context column: 'total', 'ppm', 'ownership', 'transfers', 'xg-variance', 'xg', 'bonus', 'form', 'def90', 'fdr5', 'penalty'
 */
function renderPositionSpecificTableMobile(players, contextColumn = 'total') {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }

    const currentGW = getActiveGW(); // Use active GW for status/opponent display
    const myPlayerIds = getMyPlayerIdSet();

    // Limit to top 20 for mobile initially (can be expanded with load more)
    // Check if there's a temporary limit set (from load more button)
    const initialCount = window._tempPlayerLimit || 20;
    const mobilePlayers = players.slice(0, initialCount);
    const hasMore = players.length > initialCount;

    // Context column header and value function
    const contextConfig = {
        'total': {
            header: 'Total',
            getValue: (p) => p.total_points,
            getHeatmap: (p) => {
                // Total points heatmap (0-200 range)
                const pts = p.total_points || 0;
                if (pts >= 100) return 'heat-dark-green';
                if (pts >= 70) return 'heat-light-green';
                if (pts >= 40) return 'heat-yellow';
                if (pts >= 20) return 'heat-red';
                return 'heat-gray';
            }
        },
        'ppm': {
            header: 'PPM',
            getValue: (p) => formatDecimal(calculatePPM(p)),
            getHeatmap: (p) => {
                // PPM heatmap (points per million)
                const ppm = calculatePPM(p);
                if (ppm >= 6) return 'heat-dark-green';
                if (ppm >= 5) return 'heat-light-green';
                if (ppm >= 4) return 'heat-yellow';
                if (ppm >= 3) return 'heat-red';
                return 'heat-gray';
            }
        },
        'ownership': {
            header: 'Own%',
            getValue: (p) => `${(parseFloat(p.selected_by_percent) || 0).toFixed(1)}%`,
            getHeatmap: (p) => {
                // Ownership heatmap (inverted - lower is better for differentials)
                const own = parseFloat(p.selected_by_percent) || 0;
                if (own >= 30) return 'heat-red';
                if (own >= 15) return 'heat-yellow';
                if (own >= 5) return 'heat-light-green';
                if (own > 0) return 'heat-dark-green';
                return 'heat-gray';
            }
        },
        'transfers': {
            header: 'ΔT',
            getValue: (p) => {
                const net = getNetTransfersValue(p);
                if (net === null) return '—';
                const prefix = net > 0 ? '+' : '';
                return `${prefix}${(net / 1000).toFixed(0)}k`;
            },
            getColor: (p) => {
                const net = getNetTransfersValue(p);
                if (net === null) return 'inherit';
                return net > 0 ? 'var(--success-color)' : net < 0 ? 'var(--danger-color)' : 'inherit';
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
                if (variance >= 2) return 'heat-dark-green';
                if (variance >= 1) return 'heat-light-green';
                if (variance >= -1) return 'heat-yellow';
                if (variance >= -2) return 'heat-red';
                return 'heat-gray';
            }
        },
        'xg': {
            header: 'xG',
            getValue: (p) => formatDecimal(parseFloat(p.expected_goals) || 0),
            getHeatmap: (p) => {
                // xG heatmap
                const xg = parseFloat(p.expected_goals) || 0;
                if (xg >= 4) return 'heat-dark-green';
                if (xg >= 2.5) return 'heat-light-green';
                if (xg >= 1.5) return 'heat-yellow';
                if (xg >= 0.5) return 'heat-red';
                return 'heat-gray';
            }
        },
        'bonus': {
            header: 'Bonus',
            getValue: (p) => p.bonus || 0,
            getHeatmap: (p) => {
                // Bonus points heatmap
                const bonus = p.bonus || 0;
                if (bonus >= 10) return 'heat-dark-green';
                if (bonus >= 5) return 'heat-light-green';
                if (bonus >= 2) return 'heat-yellow';
                if (bonus >= 1) return 'heat-red';
                return 'heat-gray';
            }
        },
        'form': {
            header: 'Form',
            getValue: (p) => formatDecimal(parseFloat(p.form) || 0),
            getHeatmap: (p) => {
                const value = parseFloat(p.form) || 0;
                return getFormHeatmap(value);
            }
        },
        'def90': {
            header: 'Def/90',
            getValue: (p) => formatDecimal(p.github_season?.defensive_contribution_per_90 || 0),
            getHeatmap: (p) => {
                // Defensive contribution per 90 heatmap
                const def = p.github_season?.defensive_contribution_per_90 || 0;
                if (def >= 5) return 'heat-dark-green';
                if (def >= 4) return 'heat-light-green';
                if (def >= 3) return 'heat-yellow';
                if (def >= 2) return 'heat-red';
                return 'heat-gray';
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

    // Horizontal scrolling table (matching Team page design)
    let html = `
        <div style="
            background: var(--bg-secondary);
            border-radius: 0.75rem;
            overflow: hidden;
            margin-bottom: 0.5rem;
        ">
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                <table style="width: 100%; font-size: 0.7rem; border-collapse: collapse;">
                    <thead style="background: var(--bg-tertiary);">
                        <tr>
                            <th style="position: sticky; left: 0; background: var(--bg-tertiary); z-index: 11; text-align: left; padding: 0.4rem; min-width: 140px; border-right: 2px solid var(--border-color); box-shadow: 2px 0 4px rgba(0,0,0,0.1);">Player</th>
                            <th style="text-align: center; padding: 0.4rem; min-width: 60px;">Opp</th>
                            <th style="text-align: center; padding: 0.4rem; min-width: 60px;">Status</th>
                            <th style="text-align: center; padding: 0.4rem; min-width: 60px;">GW Pts</th>
                            <th style="text-align: center; padding: 0.4rem; min-width: 60px;">Total</th>
                            <th style="text-align: center; padding: 0.4rem; min-width: 60px;">Form</th>
                            <th style="text-align: center; padding: 0.4rem; min-width: 60px;">${config.header}</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    // Render rows
    mobilePlayers.forEach((player, idx) => {
        const gwOpp = getGWOpponent(player.team, currentGW);
        const matchStatus = getMatchStatus(player.team, currentGW, player);
        const isMyPlayer = Boolean(player.__isMine || myPlayerIds.has(player.id));

        // Risk analysis
        const risks = analyzePlayerRisks(player);

        // Determine border color based on risk severity
        const hasHighRisk = risks.some(r => r.severity === 'high');
        const hasMediumRisk = risks.some(r => r.severity === 'medium');
        const hasLowRisk = risks.length > 0;

        let borderColor = '';
        if (hasHighRisk) borderColor = 'var(--danger-color)';
        else if (hasMediumRisk) borderColor = 'var(--warning-color)';
        else if (hasLowRisk) borderColor = '#eab308';

        // Points (GW points)
        const gwPoints = player.event_points || 0;
        const ptsHeatmap = getPtsHeatmap(gwPoints, 'gw_pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);

        // Total points
        const totalPoints = player.total_points || 0;
        const totalPtsHeatmap = getPtsHeatmap(totalPoints, 'pts');
        const totalPtsStyle = getHeatmapStyle(totalPtsHeatmap);

        // Form
        const formHeatmap = getFormHeatmap(parseFloat(player.form) || 0);
        const formStyle = getHeatmapStyle(formHeatmap);

        // Status styling - use calculateStatusColor for consistency
        const statusColors = calculateStatusColor(matchStatus);

        // Context column value and styling
        const contextValue = config.getValue(player);

        // Build context column styling and content
        let contextCellContent = '';
        let contextCellStyle = 'text-align: center; padding: 0.5rem;';

        if (config.getClass) {
            // Use difficulty class (for FDR) - pill style
            const contextClass = config.getClass(player);
            contextCellContent = `<span class="${contextClass}" style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.65rem;">${contextValue}</span>`;
        } else if (config.getHeatmap) {
            // Use heatmap - full cell background
            const heatmap = config.getHeatmap(player);
            const heatmapStyle = getHeatmapStyle(heatmap);
            contextCellStyle = `text-align: center; padding: 0.5rem; background: ${heatmapStyle.background}; color: ${heatmapStyle.color}; font-weight: 600;`;
            contextCellContent = contextValue;
        } else if (config.getColor) {
            // Use custom color with pill (for transfers)
            const contextColor = config.getColor(player);
            const net = getNetTransfersValue(player);
            const background = net > 0 ? 'rgba(0, 255, 136, 0.2)' : net < 0 ? 'rgba(220, 38, 38, 0.2)' : 'transparent';
            contextCellContent = `<span style="display: inline-block; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.65rem; background: ${background}; color: ${contextColor};">${contextValue}</span>`;
        } else {
            // Default styling
            contextCellContent = contextValue;
        }

        const isWishlistedPlayer = isWishlisted(player.id);
        const rowBg = getRowHighlightColor(idx);
        const stickyColumnBg = rowBg;
        const playerBadges = getPlayerBadgesMarkup(isMyPlayer, isWishlistedPlayer, '0.7rem');
        const rowBorder = borderColor
            ? `border-left: 4px solid ${borderColor};`
            : '';

        html += `
            <tr
                class="player-row"
                style="background: ${rowBg}; ${rowBorder} cursor: pointer;"
                data-player-id="${player.id}"
            >
                <td style="
                    position: sticky;
                    left: 0;
                    background: ${stickyColumnBg};
                    z-index: 9;
                    padding: 0.5rem;
                    border-right: 2px solid var(--border-color);
                    min-height: 3rem;
                    box-shadow: 2px 0 4px rgba(0,0,0,0.1);
                ">
                    <div style="display: flex; flex-direction: column; gap: 0.1rem;">
                        <!-- Line 1: Position + Name + Badges -->
                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                            <span style="font-size: 0.6rem; color: var(--text-secondary);">${getPositionShort(player)}</span>
                            <strong style="font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(player.web_name)}</strong>${playerBadges}
                        </div>
                        <!-- Line 2: Team • Price • Own% • Form -->
                        <div style="font-size: 0.6rem; color: var(--text-secondary); white-space: nowrap;">
                            ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)} • ${(parseFloat(player.selected_by_percent) || 0).toFixed(1)}% • <span style="background: ${formStyle.background}; color: ${formStyle.color}; padding: 0.1rem 0.25rem; border-radius: 0.25rem; font-weight: 600;">${formatDecimal(player.form)}</span>
                        </div>
                        <!-- Line 3: Risk context (if any) -->
                        ${risks.length > 0 ? `<div style="font-size: 0.6rem; color: ${borderColor}; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(risks[0]?.message || 'Issue')}</div>` : `<div style="height: 0.8rem;"></div>`}
                    </div>
                </td>
                <td style="text-align: center; padding: 0.5rem;">
                    <span class="${getDifficultyClass(gwOpp.difficulty)}" style="display: inline-block; width: 52px; padding: 0.2rem 0.3rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.6rem; text-align: center;">
                        ${gwOpp.name} (${gwOpp.isHome ? 'H' : 'A'})
                    </span>
                </td>
                <td style="text-align: center; padding: 0.5rem; font-size: 0.6rem; font-weight: ${statusColors.statusWeight}; color: ${statusColors.statusColor}; background: ${statusColors.statusBgColor}; border-radius: 0.25rem; white-space: nowrap;">
                    ${matchStatus}
                </td>
                <td style="text-align: center; padding: 0.5rem; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; border-radius: 0.25rem;">
                    ${gwPoints}
                </td>
                <td style="text-align: center; padding: 0.5rem; background: ${totalPtsStyle.background}; color: ${totalPtsStyle.color}; font-weight: 700; border-radius: 0.25rem;">
                    ${totalPoints}
                </td>
                <td style="text-align: center; padding: 0.5rem; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                    ${formatDecimal(player.form)}
                </td>
                <td style="${contextCellStyle}">${contextCellContent}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Add "Load More" button if there are more items (mobile only)
    if (hasMore && isMobileDevice()) {
        const remaining = players.length - initialCount;
        html += `
            <div style="text-align: center; padding: 1rem; margin-top: 0.5rem;">
                <button
                    class="load-more-players-btn"
                    data-total-count="${players.length}"
                    data-current-count="${initialCount}"
                    style="
                        padding: 0.5rem 1rem;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 0.5rem;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 0.75rem;
                    "
                >
                    Load More (${remaining} remaining)
                </button>
            </div>
        `;
    }
    
    return html;
}

/**
 * Render position-specific table with appropriate columns
 */
function renderPositionSpecificTable(players, position = 'all') {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }

    const currentGW = getActiveGW(); // Use active GW for upcoming fixtures
    const myPlayerIds = getMyPlayerIdSet();

    // Get next 5 fixtures headers
    const fixtureHeaders = getFixtureHeaders(5, 1);

    // Build table based on position
    let html = `
        <div style="overflow-x: auto; background: var(--bg-secondary); border-radius: 0.75rem; box-shadow: 0 2px 8px var(--shadow);">
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
        const isMyPlayer = Boolean(player.__isMine || myPlayerIds.has(player.id));
        const isWishlistedPlayer = isWishlisted(player.id);

        const rowBg = getRowHighlightColor(index);
        const playerBadges = getPlayerBadgesMarkup(isMyPlayer, isWishlistedPlayer);
        const rowBorder = '';

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
            transferColor = net > 0 ? 'var(--success-color)' : net < 0 ? 'var(--danger-color)' : 'inherit';
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

        html += `<tr style="background: ${rowBg}; border-bottom: 1px solid var(--border-color); ${rowBorder}">`;

        // Position-specific columns
        if (position === 'GKP') {
            const saves90 = player.github_season?.saves_per_90 || 0;
            const cs90 = player.github_season?.clean_sheets_per_90 || 0;
            const xGC90 = player.expected_goals_conceded_per_90 || 0;
            const cs = player.clean_sheets || 0;

            html += `
                <td style="padding: 0.75rem 0.5rem; display: flex; align-items: center; gap: 0.3rem;">
                    <strong>${escapeHtml(player.web_name)}</strong>${playerBadges}
                </td>
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
                <td style="padding: 0.75rem 0.5rem; display: flex; align-items: center; gap: 0.3rem;">
                    <strong>${escapeHtml(player.web_name)}</strong>${playerBadges}
                </td>
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
                <td style="padding: 0.75rem 0.5rem; display: flex; align-items: center; gap: 0.3rem;">
                        <strong>${escapeHtml(player.web_name)}</strong>${playerBadges}
                </td>
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
                <td style="padding: 0.75rem 0.5rem; display: flex; align-items: center; gap: 0.3rem;">
                    <strong>${escapeHtml(player.web_name)}</strong>${playerBadges}
                </td>
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

const MY_PLAYER_TINT = 'var(--bg-secondary)';
const WISHLIST_TINT = 'var(--bg-primary)';
const COMBINED_TINT = 'var(--bg-secondary)';

function getRowHighlightColor(index) {
    const base = index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';
    return base;
}

function getPlayerBadgesMarkup(isMyPlayer, isWishlisted, fontSize = '0.75rem') {
    const badges = [];
    if (isMyPlayer) badges.push('👤');
    if (isWishlisted) badges.push('⭐️');
    if (!badges.length) return '';
    return ` <span style="font-size: ${fontSize};">${badges.join(' ')}</span>`;
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

    const managerSnapshot = buildManagerSnapshot();
    if (managerSnapshot) {
        contextData.managerSnapshot = managerSnapshot;
        console.log('🤖 AI Insights: manager snapshot attached', {
            ownedPlayers: managerSnapshot.squad.length,
            bankMillions: managerSnapshot.budget?.bankMillions,
            activeChip: managerSnapshot.chips?.active
        });
    }

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
