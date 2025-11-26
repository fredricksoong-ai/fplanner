// ============================================================================
// CHARTS PAGE MODULE
// Interactive data visualizations using Apache ECharts
// ============================================================================

import { getAllPlayers } from './data.js';
import {
    getPositionShort,
    calculatePPM,
    escapeHtml,
    formatCurrency,
    formatPercent,
    getCurrentGW
} from './utils.js';
import { calculateFixtureDifficulty } from './fixtures.js';
import { renderPointsPriceChart } from './charts/pointsVsPrice.js';
import { renderFormVsPriceChart } from './charts/formVsPrice.js';
import { renderOwnershipVsFormChart } from './charts/ownershipVsForm.js';
import { renderFixturesVsFormChart } from './charts/fixturesVsForm.js';
import { renderIctVsPointsChart } from './charts/ictVsPoints.js';
import { renderXgiVsActualChart } from './charts/xgiVsActual.js';
import { renderXgcVsActualChart } from './charts/xgcVsActual.js';
import { renderMinutesEfficiencyChart } from './charts/minutesEfficiency.js';

// ============================================================================
// STATE
// ============================================================================

let currentPositionFilter = 'all';
let currentChartType = 'points-price'; // Current chart being displayed
let echarts = null; // Lazy-loaded ECharts instance
let currentChart = null; // Current chart instance for cleanup

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render the Charts page
 */
export async function renderCharts(chartType = 'points-price') {
    const container = document.getElementById('app-container');
    currentChartType = chartType;

    // Detect mobile
    const isMobile = window.innerWidth <= 768;

    // Chart type configurations
    const chartTypes = {
        'points-price': { icon: '💰', label: 'Points vs Price', shortLabel: 'Points/Price' },
        'form-price': { icon: '🔥', label: 'Form vs Price', shortLabel: 'Form/Price' },
        'ownership-form': { icon: '📊', label: 'Ownership vs Form', shortLabel: 'Own/Form' },
        'fdr-form': { icon: '🗓️', label: 'Fixtures vs Form', shortLabel: 'Fix/Form' },
        'xgi-actual': { icon: '🎯', label: 'xGI vs Actual', shortLabel: 'xGI' },
        'xgc-actual': { icon: '🛡️', label: 'xGC vs Actual', shortLabel: 'xGC' },
        'ict-points': { icon: '📈', label: 'ICT vs Points', shortLabel: 'ICT' },
        'minutes-efficiency': { icon: '⚡', label: 'Minutes Efficiency', shortLabel: 'Minutes' }
    };

    container.innerHTML = `
        <div style="padding: ${isMobile ? '1rem 0.75rem' : '2rem'};">
            <h1 style="
                font-size: ${isMobile ? '1.5rem' : '2rem'};
                font-weight: 700;
                color: var(--primary-color);
                margin-bottom: ${isMobile ? '0.5rem' : '1rem'};
                padding: 0 ${isMobile ? '0.25rem' : '0'};
            ">
                <i class="fas fa-chart-line"></i> ${isMobile ? 'Charts' : 'Data Visualizations'}
            </h1>
            <p style="
                color: var(--text-secondary);
                margin-bottom: ${isMobile ? '1rem' : '2rem'};
                font-size: ${isMobile ? '0.8rem' : '1rem'};
                padding: 0 ${isMobile ? '0.25rem' : '0'};
            ">
                ${isMobile ? 'Find value picks & differentials' : 'Interactive charts to help you find value picks and differentials'}
            </p>

            <!-- Chart Type Tabs -->
            <div style="
                display: flex;
                gap: ${isMobile ? '0.4rem' : '0.5rem'};
                margin-bottom: 1rem;
                overflow-x: auto;
                padding: 0 ${isMobile ? '0.25rem' : '0'} 0.75rem;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: thin;
            ">
                ${Object.entries(chartTypes).map(([type, config]) => `
                    <button
                        class="chart-type-tab touch-target"
                        data-chart-type="${type}"
                        style="
                            padding: ${isMobile ? '0.6rem 0.9rem' : '0.75rem 1.25rem'};
                            background: ${chartType === type ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                            color: ${chartType === type ? 'white' : 'var(--text-primary)'};
                            border: ${chartType === type ? 'none' : '1px solid var(--border-color)'};
                            border-radius: ${isMobile ? '6px' : '0.5rem'};
                            cursor: pointer;
                            font-weight: ${chartType === type ? '700' : '500'};
                            font-size: ${isMobile ? '0.75rem' : '0.875rem'};
                            white-space: nowrap;
                            transition: all 0.2s;
                            min-height: ${isMobile ? '44px' : 'auto'};
                            display: flex;
                            align-items: center;
                            gap: 0.3rem;
                            box-shadow: ${chartType === type ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'};
                        "
                    >
                        <span>${config.icon}</span>
                        <span>${isMobile ? config.shortLabel : config.label}</span>
                    </button>
                `).join('')}
            </div>

            <!-- Position Filter -->
            <div style="
                display: grid;
                grid-template-columns: ${isMobile ? 'repeat(5, 1fr)' : 'repeat(5, auto)'};
                gap: ${isMobile ? '0.4rem' : '0.5rem'};
                margin-bottom: ${isMobile ? '1rem' : '2rem'};
                padding: 0 ${isMobile ? '0.25rem' : '0'};
            ">
                <button class="chart-position-filter touch-target" data-position="all" style="
                    padding: ${isMobile ? '0.6rem 0.5rem' : '0.5rem 1rem'};
                    background: ${currentPositionFilter === 'all' ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                    color: ${currentPositionFilter === 'all' ? 'white' : 'var(--text-primary)'};
                    border: ${currentPositionFilter === 'all' ? 'none' : '1px solid var(--border-color)'};
                    border-radius: ${isMobile ? '6px' : '0.5rem'};
                    cursor: pointer;
                    font-weight: ${currentPositionFilter === 'all' ? '600' : '500'};
                    font-size: ${isMobile ? '0.7rem' : '0.875rem'};
                    transition: all 0.2s;
                    min-height: ${isMobile ? '44px' : 'auto'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    ${isMobile ? 'All' : 'All Positions'}
                </button>
                <button class="chart-position-filter touch-target" data-position="GKP" style="
                    padding: ${isMobile ? '0.6rem 0.5rem' : '0.5rem 1rem'};
                    background: ${currentPositionFilter === 'GKP' ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                    color: ${currentPositionFilter === 'GKP' ? 'white' : 'var(--text-primary)'};
                    border: ${currentPositionFilter === 'GKP' ? 'none' : '1px solid var(--border-color)'};
                    border-radius: ${isMobile ? '6px' : '0.5rem'};
                    cursor: pointer;
                    font-weight: ${currentPositionFilter === 'GKP' ? '600' : '500'};
                    font-size: ${isMobile ? '0.7rem' : '0.875rem'};
                    transition: all 0.2s;
                    min-height: ${isMobile ? '44px' : 'auto'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    GKP
                </button>
                <button class="chart-position-filter touch-target" data-position="DEF" style="
                    padding: ${isMobile ? '0.6rem 0.5rem' : '0.5rem 1rem'};
                    background: ${currentPositionFilter === 'DEF' ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                    color: ${currentPositionFilter === 'DEF' ? 'white' : 'var(--text-primary)'};
                    border: ${currentPositionFilter === 'DEF' ? 'none' : '1px solid var(--border-color)'};
                    border-radius: ${isMobile ? '6px' : '0.5rem'};
                    cursor: pointer;
                    font-weight: ${currentPositionFilter === 'DEF' ? '600' : '500'};
                    font-size: ${isMobile ? '0.7rem' : '0.875rem'};
                    transition: all 0.2s;
                    min-height: ${isMobile ? '44px' : 'auto'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    DEF
                </button>
                <button class="chart-position-filter touch-target" data-position="MID" style="
                    padding: ${isMobile ? '0.6rem 0.5rem' : '0.5rem 1rem'};
                    background: ${currentPositionFilter === 'MID' ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                    color: ${currentPositionFilter === 'MID' ? 'white' : 'var(--text-primary)'};
                    border: ${currentPositionFilter === 'MID' ? 'none' : '1px solid var(--border-color)'};
                    border-radius: ${isMobile ? '6px' : '0.5rem'};
                    cursor: pointer;
                    font-weight: ${currentPositionFilter === 'MID' ? '600' : '500'};
                    font-size: ${isMobile ? '0.7rem' : '0.875rem'};
                    transition: all 0.2s;
                    min-height: ${isMobile ? '44px' : 'auto'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    MID
                </button>
                <button class="chart-position-filter touch-target" data-position="FWD" style="
                    padding: ${isMobile ? '0.6rem 0.5rem' : '0.5rem 1rem'};
                    background: ${currentPositionFilter === 'FWD' ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                    color: ${currentPositionFilter === 'FWD' ? 'white' : 'var(--text-primary)'};
                    border: ${currentPositionFilter === 'FWD' ? 'none' : '1px solid var(--border-color)'};
                    border-radius: ${isMobile ? '6px' : '0.5rem'};
                    cursor: pointer;
                    font-weight: ${currentPositionFilter === 'FWD' ? '600' : '500'};
                    font-size: ${isMobile ? '0.7rem' : '0.875rem'};
                    transition: all 0.2s;
                    min-height: ${isMobile ? '44px' : 'auto'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    FWD
                </button>
            </div>

            <!-- Chart Container - Dynamic content -->
            <div id="chart-content-container"></div>

            <!-- Legend -->
            <div class="card-secondary" style="
                border-radius: 8px;
                margin-top: 1rem;
                padding: ${isMobile ? '0.75rem' : '1rem'};
            ">
                <div style="
                    display: grid;
                    grid-template-columns: ${isMobile ? 'repeat(2, 1fr)' : 'repeat(5, auto)'};
                    gap: ${isMobile ? '0.75rem' : '2rem'};
                    justify-content: ${isMobile ? 'stretch' : 'center'};
                    font-size: ${isMobile ? '0.75rem' : '0.875rem'};
                ">
                    <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: ${isMobile ? 'flex-start' : 'center'};">
                        <div style="width: ${isMobile ? '14px' : '16px'}; height: ${isMobile ? '14px' : '16px'}; background: #fbbf24; border-radius: 50%; flex-shrink: 0;"></div>
                        <span>GKP</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: ${isMobile ? 'flex-start' : 'center'};">
                        <div style="width: ${isMobile ? '14px' : '16px'}; height: ${isMobile ? '14px' : '16px'}; background: #3b82f6; border-radius: 50%; flex-shrink: 0;"></div>
                        <span>DEF</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: ${isMobile ? 'flex-start' : 'center'};">
                        <div style="width: ${isMobile ? '14px' : '16px'}; height: ${isMobile ? '14px' : '16px'}; background: #10b981; border-radius: 50%; flex-shrink: 0;"></div>
                        <span>MID</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: ${isMobile ? 'flex-start' : 'center'};">
                        <div style="width: ${isMobile ? '14px' : '16px'}; height: ${isMobile ? '14px' : '16px'}; background: #ef4444; border-radius: 50%; flex-shrink: 0;"></div>
                        <span>FWD</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: ${isMobile ? 'flex-start' : 'center'}; ${isMobile ? 'grid-column: span 2;' : ''}">
                        <span style="font-size: ${isMobile ? '1.1rem' : '1.25rem'};">⭐</span>
                        <span>Your Team</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners to chart type tabs
    const chartTypeTabs = container.querySelectorAll('.chart-type-tab');
    chartTypeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const newChartType = tab.dataset.chartType;
            window.renderCharts(newChartType);
        });
    });

    // Add event listeners for position filters
    const filterButtons = container.querySelectorAll('.chart-position-filter');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentPositionFilter = btn.dataset.position;

            // Update button styles
            filterButtons.forEach(b => {
                if (b.dataset.position === currentPositionFilter) {
                    b.style.background = 'var(--primary-color)';
                    b.style.color = 'white';
                    b.style.border = 'none';
                } else {
                    b.style.background = 'var(--bg-secondary)';
                    b.style.color = 'var(--text-primary)';
                    b.style.border = '1px solid var(--border-color)';
                }
            });

            // Re-render current chart
            renderCurrentChart();
        });
    });

    // Lazy load ECharts
    if (!echarts) {
        echarts = await import('echarts');
    }

    // Render the selected chart
    renderCurrentChart();

    // Make renderCharts globally accessible for tab switching
    window.renderCharts = renderCharts;
}

// ============================================================================
// CHART ROUTER
// ============================================================================

/**
 * Render the currently selected chart type
 */
function renderCurrentChart() {
    // Get container for modular charts
    const contentContainer = document.getElementById('chart-content-container');

    switch (currentChartType) {
        case 'points-price':
            renderModularChart(contentContainer, 'points-price');
            break;
        case 'form-price':
            renderModularChart(contentContainer, 'form-price');
            break;
        case 'ownership-form':
            renderModularChart(contentContainer, 'ownership-form');
            break;
        case 'xgi-actual':
            renderModularChart(contentContainer, 'xgi-actual');
            break;
        case 'xgc-actual':
            renderModularChart(contentContainer, 'xgc-actual');
            break;
        case 'ict-points':
            renderModularChart(contentContainer, 'ict-points');
            break;
        case 'fdr-form':
            renderModularChart(contentContainer, 'fdr-form');
            break;
        default:
            renderModularChart(contentContainer, 'points-price');
    }
}

/**
 * Render modular chart (new architecture)
 * Disposes old chart and creates new one using modular approach
 */
async function renderModularChart(contentContainer, chartType) {
    // Dispose previous chart instance
    if (currentChart) {
        currentChart.dispose();
        currentChart = null;
    }

    // Load ECharts if not already loaded
    if (!echarts) {
        try {
            const echartsModule = await import('echarts');
            echarts = echartsModule;
        } catch (error) {
            console.error('Failed to load ECharts:', error);
            return;
        }
    }

    // Call the appropriate modular chart render function
    switch (chartType) {
        case 'points-price':
            currentChart = await renderPointsPriceChart(contentContainer, echarts, currentPositionFilter);
            break;
        case 'form-price':
            currentChart = await renderFormVsPriceChart(contentContainer, echarts, currentPositionFilter);
            break;
        case 'ownership-form':
            currentChart = await renderOwnershipVsFormChart(contentContainer, echarts, currentPositionFilter);
            break;
        case 'fdr-form':
            currentChart = await renderFixturesVsFormChart(contentContainer, echarts, currentPositionFilter);
            break;
        case 'ict-points':
            currentChart = await renderIctVsPointsChart(contentContainer, echarts, currentPositionFilter);
            break;
        case 'xgi-actual':
            currentChart = await renderXgiVsActualChart(contentContainer, echarts, currentPositionFilter);
            break;
        case 'xgc-actual':
            currentChart = await renderXgcVsActualChart(contentContainer, echarts, currentPositionFilter);
            break;
        case 'minutes-efficiency':
            currentChart = await renderMinutesEfficiencyChart(contentContainer, echarts, currentPositionFilter);
            break;
        default:
            currentChart = await renderPointsPriceChart(contentContainer, echarts, currentPositionFilter);
    }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup chart instances when navigating away
 */
export function cleanupCharts() {
    if (currentChart) {
        currentChart.dispose();
        currentChart = null;
    }
}
