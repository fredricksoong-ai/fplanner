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

    // Chart type configurations
    const chartTypes = {
        'points-price': { icon: '💰', label: 'Points vs Price' },
        'form-price': { icon: '🔥', label: 'Form vs Price' },
        'minutes-efficiency': { icon: '⏱️', label: 'Minutes vs Efficiency' },
        'xgi-actual': { icon: '🎯', label: 'xGI vs Actual' },
        'ownership-form': { icon: '📊', label: 'Ownership vs Form' },
        'fdr-form': { icon: '🗓️', label: 'Fixtures vs Form' }
    };

    container.innerHTML = `
        <div style="padding: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-chart-line"></i> Data Visualizations
            </h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Interactive charts to help you find value picks and differentials
            </p>

            <!-- Chart Type Tabs -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 0.5rem;">
                ${Object.entries(chartTypes).map(([type, config]) => `
                    <button
                        class="chart-type-tab"
                        data-chart-type="${type}"
                        style="
                            padding: 0.75rem 1.25rem;
                            background: ${chartType === type ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                            color: ${chartType === type ? 'white' : 'var(--text-primary)'};
                            border: ${chartType === type ? 'none' : '1px solid var(--border-color)'};
                            border-radius: 0.5rem;
                            cursor: pointer;
                            font-weight: ${chartType === type ? '700' : '500'};
                            font-size: 0.875rem;
                            white-space: nowrap;
                            transition: all 0.2s;
                        "
                    >
                        ${config.icon} ${config.label}
                    </button>
                `).join('')}
            </div>

            <!-- Position Filter -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem; flex-wrap: wrap;">
                <button class="chart-position-filter" data-position="all" style="padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600; transition: all 0.2s;">
                    All Positions
                </button>
                <button class="chart-position-filter" data-position="GKP" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 0.5rem; cursor: pointer; font-weight: 500; transition: all 0.2s;">
                    GKP
                </button>
                <button class="chart-position-filter" data-position="DEF" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 0.5rem; cursor: pointer; font-weight: 500; transition: all 0.2s;">
                    DEF
                </button>
                <button class="chart-position-filter" data-position="MID" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 0.5rem; cursor: pointer; font-weight: 500; transition: all 0.2s;">
                    MID
                </button>
                <button class="chart-position-filter" data-position="FWD" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 0.5rem; cursor: pointer; font-weight: 500; transition: all 0.2s;">
                    FWD
                </button>
            </div>

            <!-- Chart Container - Dynamic content -->
            <div id="chart-content-container"></div>

            <!-- Legend -->
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: 1rem; margin-top: 1rem;">
                <div style="display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center; font-size: 0.875rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 16px; height: 16px; background: #fbbf24; border-radius: 50%;"></div>
                        <span>GKP</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 16px; height: 16px; background: #3b82f6; border-radius: 50%;"></div>
                        <span>DEF</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 16px; height: 16px; background: #10b981; border-radius: 50%;"></div>
                        <span>MID</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 16px; height: 16px; background: #ef4444; border-radius: 50%;"></div>
                        <span>FWD</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.25rem;">⭐</span>
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
    switch (currentChartType) {
        case 'points-price':
            renderPointsPriceChart();
            break;
        case 'form-price':
            renderFormPriceChart();
            break;
        case 'minutes-efficiency':
            renderMinutesEfficiencyChart();
            break;
        case 'xgi-actual':
            renderXgiActualChart();
            break;
        case 'ownership-form':
            renderOwnershipFormChart();
            break;
        case 'fdr-form':
            renderFdrFormChart();
            break;
        default:
            renderPointsPriceChart();
    }
}

// ============================================================================
// HELPER: CREATE CHART CARD
// ============================================================================

/**
 * Create the HTML for a chart card
 */
function createChartCard(config) {
    const { title, icon, description, zones, chartId } = config;

    const zonesHTML = zones ? `
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--text-secondary);">
            ${zones.map(z => `<span><span style="color: ${z.color}; font-weight: bold;">■</span> ${z.label}</span>`).join('')}
        </div>
    ` : '';

    return `
        <div style="background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <div>
                    <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                        ${icon} ${title}
                    </h2>
                    <p style="color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.875rem;">
                        ${description}
                    </p>
                    ${zonesHTML}
                </div>
                <button
                    id="export-chart-btn"
                    style="
                        padding: 0.5rem 1rem;
                        background: var(--accent-color);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        transition: opacity 0.2s;
                    "
                >
                    <i class="fas fa-download"></i>
                    Export PNG
                </button>
            </div>

            <!-- Chart Container -->
            <div id="${chartId}" style="width: 100%; height: 600px; min-height: 400px; margin-top: 1rem;"></div>
        </div>
    `;
}

// ============================================================================
// CHART: POINTS VS PRICE SCATTER
// ============================================================================

/**
 * Render Points vs Price scatter plot
 */
async function renderPointsPriceChart() {
    // Create chart card HTML
    const contentContainer = document.getElementById('chart-content-container');
    if (!contentContainer) {
        console.error('Chart content container not found');
        return;
    }

    contentContainer.innerHTML = createChartCard({
        title: 'Points vs Price',
        icon: '💰',
        description: 'Find value picks and premium performers. Bubble size = ownership %, Your team = ⭐ (star shape with purple border)',
        zones: [
            { color: '#10b981', label: 'Value Zone (low price, high points)' },
            { color: '#3b82f6', label: 'Premium Zone (high price, high points)' },
            { color: '#ef4444', label: 'Trap Zone (high price, low points - avoid!)' }
        ],
        chartId: 'points-price-chart'
    });

    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 0));

    const chartContainer = document.getElementById('points-price-chart');
    if (!chartContainer) {
        console.error('Points-price-chart container not found');
        return;
    }

    // Dispose previous chart instance
    if (currentChart) {
        currentChart.dispose();
    }

    // Define theme colors FIRST before any closures to avoid hoisting issues
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    // Get data
    let players = getAllPlayers();

    // Filter by position if needed
    if (currentPositionFilter !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[currentPositionFilter]);
    }

    // Filter out very low-point players (less than 10 points)
    // This removes bench fodder and makes the chart cleaner
    players = players.filter(p => (p.total_points || 0) >= 10);

    // Get user's team player IDs
    let myTeamPlayerIds = new Set();
    const cachedTeamId = localStorage.getItem('fplanner_team_id');
    if (cachedTeamId) {
        const cachedTeamData = localStorage.getItem(`fplanner_team_${cachedTeamId}`);
        if (cachedTeamData) {
            try {
                const teamData = JSON.parse(cachedTeamData);
                if (teamData && teamData.picks && teamData.picks.picks) {
                    myTeamPlayerIds = new Set(teamData.picks.picks.map(p => p.element));
                }
            } catch (e) {
                console.log('Could not parse cached team data');
            }
        }
    }

    // Prepare data series by position
    const positions = {
        'GKP': { data: [], color: '#fbbf24', name: 'Goalkeepers' },
        'DEF': { data: [], color: '#3b82f6', name: 'Defenders' },
        'MID': { data: [], color: '#10b981', name: 'Midfielders' },
        'FWD': { data: [], color: '#ef4444', name: 'Forwards' }
    };

    // Find top 12 players by points for labeling
    const sortedByPoints = [...players].sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
    const topPlayerIds = new Set(sortedByPoints.slice(0, 12).map(p => p.id));

    players.forEach(player => {
        const price = player.now_cost / 10; // Convert to actual price
        const points = player.total_points || 0;
        const ownership = parseFloat(player.selected_by_percent) || 0;
        const position = getPositionShort(player);
        const ppm = calculatePPM(player);
        const isMyPlayer = myTeamPlayerIds.has(player.id);
        const isTopPlayer = topPlayerIds.has(player.id);

        if (positions[position]) {
            positions[position].data.push({
                name: player.web_name,
                value: [price, points, ownership],
                ppm: ppm,
                isMyPlayer: isMyPlayer,
                isTopPlayer: isTopPlayer,
                playerData: player
            });
        }
    });

    // Create series
    const series = Object.keys(positions).map(pos => ({
        name: positions[pos].name,
        type: 'scatter',
        symbolSize: (data) => {
            // Improved ownership-based sizing using square root for better differentiation
            // Low ownership (1%) = size ~6, High ownership (50%) = size ~42
            const ownership = data[2];
            const size = Math.max(6, Math.min(50, Math.sqrt(ownership) * 6));
            return size;
        },
        symbol: (value, params) => {
            // Use star symbol for my team players
            return params.data.isMyPlayer ? 'star' : 'circle';
        },
        itemStyle: {
            color: positions[pos].color, // Keep position color for legend consistency
            opacity: 0.7,
            borderColor: (params) => {
                // Add purple border for my team players
                return params.data.isMyPlayer ? '#8b5cf6' : 'transparent';
            },
            borderWidth: (params) => {
                return params.data.isMyPlayer ? 3 : 0;
            }
        },
        emphasis: {
            itemStyle: {
                opacity: 1,
                borderColor: '#fff',
                borderWidth: 2
            }
        },
        // Add labels for top players
        label: {
            show: true,
            formatter: (params) => {
                // Only show label if this is a top player
                if (params.data.isTopPlayer) {
                    return params.data.name;
                }
                return '';
            },
            position: 'top',
            fontSize: 10,
            fontWeight: 'bold',
            color: textColor,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            padding: [2, 4],
            borderRadius: 3,
            distance: 5
        },
        // Add value zones as background regions
        markArea: pos === 'GKP' ? { // Only add zones once (on first series)
            silent: true,
            itemStyle: {
                opacity: 0.08
            },
            data: [
                // Value Zone (top-left): low price, high points - THE SWEET SPOT
                [{
                    name: 'Value Zone',
                    xAxis: 3,
                    yAxis: 120,
                    itemStyle: { color: '#10b981' } // green
                }, {
                    xAxis: 8.5,
                    yAxis: 300
                }],
                // Premium Zone (top-right): high price, high points - proven performers
                [{
                    name: 'Premium Zone',
                    xAxis: 8.5,
                    yAxis: 120,
                    itemStyle: { color: '#3b82f6' } // blue
                }, {
                    xAxis: 15,
                    yAxis: 300
                }],
                // Trap Zone (bottom-right): high price, low points - AVOID
                [{
                    name: 'Trap Zone',
                    xAxis: 8.5,
                    yAxis: 10,
                    itemStyle: { color: '#ef4444' } // red
                }, {
                    xAxis: 15,
                    yAxis: 120
                }]
            ],
            label: {
                show: true,
                position: 'inside',
                fontSize: 11,
                fontWeight: 'bold',
                color: textColor,
                opacity: 0.5
            }
        } : undefined,
        data: positions[pos].data
    }));

    // Initialize chart
    if (!echarts) {
        console.error('ECharts library not loaded');
        return;
    }
    currentChart = echarts.init(chartContainer);
    if (!currentChart) {
        console.error('Failed to initialize chart');
        return;
    }

    const option = {
        backgroundColor: 'transparent',
        textStyle: {
            color: textColor
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: isDark ? '#374151' : '#e5e7eb',
            textStyle: {
                color: textColor
            },
            formatter: (params) => {
                const data = params.data;
                const player = data.playerData;
                const price = data.value[0];
                const points = data.value[1];
                const ownership = data.value[2];
                const ppm = data.ppm;
                const myTeamBadge = data.isMyPlayer ? ' ⭐' : '';
                const position = getPositionShort(player);

                // Get DefCon for non-GKP players
                let defConLine = '';
                if (position !== 'GKP' && player.github_season?.defensive_contribution_per_90) {
                    const defCon = player.github_season.defensive_contribution_per_90;
                    defConLine = `Def Con/90: ${defCon.toFixed(1)}<br/>`;
                }

                return `
                    <div style="padding: 4px;">
                        <strong>${escapeHtml(data.name)}${myTeamBadge}</strong><br/>
                        Position: ${position}<br/>
                        Price: £${price.toFixed(1)}m<br/>
                        Points: ${points}<br/>
                        PPM: ${ppm.toFixed(1)}<br/>
                        Ownership: ${ownership.toFixed(1)}%<br/>
                        Form: ${player.form || 0}<br/>
                        ${defConLine}
                    </div>
                `;
            }
        },
        legend: {
            data: Object.values(positions).map(p => p.name),
            textStyle: {
                color: textColor
            },
            top: 10,
            left: 'center'
        },
        grid: {
            left: '8%',
            right: '5%',
            bottom: '12%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            name: 'Price (£m)',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: {
                color: textColor,
                fontWeight: 'bold'
            },
            axisLine: {
                lineStyle: {
                    color: gridColor
                }
            },
            axisLabel: {
                color: textColor,
                formatter: (value) => `£${value.toFixed(1)}`
            },
            splitLine: {
                lineStyle: {
                    color: gridColor,
                    type: 'dashed',
                    opacity: 0.3
                }
            },
            min: 3,
            max: 15
        },
        yAxis: {
            type: 'value',
            name: 'Total Points',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: {
                color: textColor,
                fontWeight: 'bold'
            },
            axisLine: {
                lineStyle: {
                    color: gridColor
                }
            },
            axisLabel: {
                color: textColor
            },
            splitLine: {
                lineStyle: {
                    color: gridColor,
                    type: 'dashed',
                    opacity: 0.3
                }
            }
        },
        series: series
    };

    try {
        currentChart.setOption(option);
        console.log('Chart rendered successfully with', players.length, 'players');
    } catch (error) {
        console.error('Error setting chart options:', error);
        return;
    }

    // Handle window resize
    const resizeHandler = () => {
        if (currentChart) {
            currentChart.resize();
        }
    };

    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    // Add export button functionality
    const exportBtn = document.getElementById('export-chart-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (currentChart) {
                try {
                    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                    const url = currentChart.getDataURL({
                        type: 'png',
                        pixelRatio: 2,
                        backgroundColor: isDark ? '#1f2937' : '#ffffff'
                    });

                    // Create download link
                    const link = document.createElement('a');
                    link.download = `fpl-points-vs-price-${new Date().toISOString().split('T')[0]}.png`;
                    link.href = url;
                    link.click();
                    console.log('Chart exported successfully');
                } catch (error) {
                    console.error('Error exporting chart:', error);
                }
            } else {
                console.error('No chart instance available for export');
            }
        });
        console.log('Export button event listener attached');
    } else {
        console.error('Export button not found');
    }
}

// ============================================================================
// CHART 2: FORM VS PRICE
// ============================================================================

async function renderFormPriceChart() {
    const contentContainer = document.getElementById('chart-content-container');
    if (!contentContainer) return;

    contentContainer.innerHTML = createChartCard({
        title: 'Form vs Price',
        icon: '🔥',
        description: 'Find in-form bargains and spot premium players losing form. Bubble size = ownership %',
        zones: [
            { color: '#10b981', label: 'Hot Form Value (low price, high form)' },
            { color: '#3b82f6', label: 'Premium Form (high price, high form)' },
            { color: '#ef4444', label: 'Cold Trap (high price, low form - avoid!)' }
        ],
        chartId: 'form-price-chart'
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    const chartContainer = document.getElementById('form-price-chart');
    if (!chartContainer) return;
    if (currentChart) currentChart.dispose();

    // Define theme colors FIRST before any closures
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    let players = getAllPlayers().filter(p => (p.total_points || 0) >= 10);
    if (currentPositionFilter !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[currentPositionFilter]);
    }

    let myTeamPlayerIds = new Set();
    const cachedTeamId = localStorage.getItem('fplanner_team_id');
    if (cachedTeamId) {
        const cachedTeamData = localStorage.getItem(`fplanner_team_${cachedTeamId}`);
        if (cachedTeamData) {
            try {
                const teamData = JSON.parse(cachedTeamData);
                if (teamData?.picks?.picks) myTeamPlayerIds = new Set(teamData.picks.picks.map(p => p.element));
            } catch (e) {}
        }
    }

    const positions = {
        'GKP': { data: [], color: '#fbbf24', name: 'Goalkeepers' },
        'DEF': { data: [], color: '#3b82f6', name: 'Defenders' },
        'MID': { data: [], color: '#10b981', name: 'Midfielders' },
        'FWD': { data: [], color: '#ef4444', name: 'Forwards' }
    };

    const sortedByForm = [...players].sort((a, b) => (parseFloat(b.form) || 0) - (parseFloat(a.form) || 0));
    const topPlayerIds = new Set(sortedByForm.slice(0, 12).map(p => p.id));

    players.forEach(player => {
        const price = player.now_cost / 10;
        const form = parseFloat(player.form) || 0;
        const ownership = parseFloat(player.selected_by_percent) || 0;
        const position = getPositionShort(player);
        const ppm = calculatePPM(player);

        if (positions[position]) {
            positions[position].data.push({
                name: player.web_name,
                value: [price, form, ownership],
                ppm,
                isMyPlayer: myTeamPlayerIds.has(player.id),
                isTopPlayer: topPlayerIds.has(player.id),
                playerData: player
            });
        }
    });

    const series = Object.keys(positions).map(pos => ({
        name: positions[pos].name,
        type: 'scatter',
        symbolSize: (data) => Math.max(6, Math.min(50, Math.sqrt(data[2]) * 6)),
        symbol: (value, params) => params.data.isMyPlayer ? 'star' : 'circle',
        itemStyle: {
            color: positions[pos].color,
            opacity: 0.7,
            borderColor: (params) => params.data.isMyPlayer ? '#8b5cf6' : 'transparent',
            borderWidth: (params) => params.data.isMyPlayer ? 3 : 0
        },
        emphasis: { itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 2 } },
        label: {
            show: true,
            formatter: (params) => params.data.isTopPlayer ? params.data.name : '',
            position: 'top',
            fontSize: 10,
            fontWeight: 'bold',
            color: textColor,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            padding: [2, 4],
            borderRadius: 3,
            distance: 5
        },
        markArea: pos === 'GKP' ? {
            silent: true,
            itemStyle: { opacity: 0.08 },
            data: [
                [{ name: 'Hot Form Value', xAxis: 3, yAxis: 5, itemStyle: { color: '#10b981' } }, { xAxis: 8.5, yAxis: 10 }],
                [{ name: 'Premium Form', xAxis: 8.5, yAxis: 5, itemStyle: { color: '#3b82f6' } }, { xAxis: 15, yAxis: 10 }],
                [{ name: 'Cold Trap', xAxis: 8.5, yAxis: 0, itemStyle: { color: '#ef4444' } }, { xAxis: 15, yAxis: 5 }]
            ],
            label: { show: true, position: 'inside', fontSize: 11, fontWeight: 'bold', color: textColor, opacity: 0.5 }
        } : undefined,
        data: positions[pos].data
    }));

    if (!echarts) return;
    currentChart = echarts.init(chartContainer);
    if (!currentChart) return;

    currentChart.setOption({
        backgroundColor: 'transparent',
        textStyle: { color: textColor },
        tooltip: {
            trigger: 'item',
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: isDark ? '#374151' : '#e5e7eb',
            textStyle: { color: textColor },
            formatter: (params) => {
                const data = params.data;
                const player = data.playerData;
                const defConLine = getPositionShort(player) !== 'GKP' && player.github_season?.defensive_contribution_per_90
                    ? `Def Con/90: ${player.github_season.defensive_contribution_per_90.toFixed(1)}<br/>`
                    : '';
                return `<div style="padding: 4px;">
                    <strong>${escapeHtml(data.name)}${data.isMyPlayer ? ' ⭐' : ''}</strong><br/>
                    Position: ${getPositionShort(player)}<br/>
                    Price: £${data.value[0].toFixed(1)}m<br/>
                    Form: ${data.value[1].toFixed(1)}<br/>
                    Ownership: ${data.value[2].toFixed(1)}%<br/>
                    PPM: ${data.ppm.toFixed(1)}<br/>
                    ${defConLine}
                </div>`;
            }
        },
        legend: { data: Object.values(positions).map(p => p.name), textStyle: { color: textColor }, top: 10, left: 'center' },
        grid: { left: '8%', right: '5%', bottom: '12%', top: '15%', containLabel: true },
        xAxis: {
            type: 'value',
            name: 'Price (£m)',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: textColor, fontWeight: 'bold' },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor, formatter: (value) => `£${value.toFixed(1)}` },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed', opacity: 0.3 } },
            min: 3,
            max: 15
        },
        yAxis: {
            type: 'value',
            name: 'Form',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: { color: textColor, fontWeight: 'bold' },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed', opacity: 0.3 } }
        },
        series
    });

    const resizeHandler = () => { if (currentChart) currentChart.resize(); };
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    const exportBtn = document.getElementById('export-chart-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (currentChart) {
                const url = currentChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: isDark ? '#1f2937' : '#ffffff' });
                const link = document.createElement('a');
                link.download = `fpl-form-vs-price-${new Date().toISOString().split('T')[0]}.png`;
                link.href = url;
                link.click();
            }
        });
    }
}

// ============================================================================
// CHART 3: MINUTES VS EFFICIENCY
// ============================================================================

async function renderMinutesEfficiencyChart() {
    const contentContainer = document.getElementById('chart-content-container');
    if (!contentContainer) return;

    contentContainer.innerHTML = createChartCard({
        title: 'Minutes % vs Points per 90',
        icon: '⏱️',
        description: 'Identify nailed-on starters with high efficiency. Bubble size = ownership %',
        zones: [
            { color: '#10b981', label: 'Nailed Performers (high minutes, high pts/90)' },
            { color: '#fbbf24', label: 'Rotation Risk (low minutes)' },
            { color: '#ef4444', label: 'Bench Fodder (low minutes, low pts/90)' }
        ],
        chartId: 'minutes-efficiency-chart'
    });

    contentContainer.innerHTML += '<div style="text-align: center; padding: 4rem; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i><br/><br/>Chart coming soon!</div>';
}

// ============================================================================
// CHART 4: XGI VS ACTUAL
// ============================================================================

async function renderXgiActualChart() {
    const contentContainer = document.getElementById('chart-content-container');
    if (!contentContainer) return;

    contentContainer.innerHTML = createChartCard({
        title: 'Expected xGI vs Actual Goal Involvements',
        icon: '🎯',
        description: 'Find unlucky players due returns or overperforming players regressing. Bubble size = ownership %',
        zones: [
            { color: '#10b981', label: 'Underperforming (below diagonal - potential buys)' },
            { color: '#3b82f6', label: 'Expected (on diagonal)' },
            { color: '#fbbf24', label: 'Overperforming (above diagonal - potential sells)' }
        ],
        chartId: 'xgi-actual-chart'
    });

    contentContainer.innerHTML += '<div style="text-align: center; padding: 4rem; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i><br/><br/>Chart coming soon!</div>';
}

// ============================================================================
// CHART 5: OWNERSHIP VS FORM
// ============================================================================

async function renderOwnershipFormChart() {
    const contentContainer = document.getElementById('chart-content-container');
    if (!contentContainer) return;

    contentContainer.innerHTML = createChartCard({
        title: 'Ownership % vs Form',
        icon: '📊',
        description: 'Find differential picks with low ownership and high form. Bubble size = price',
        zones: [
            { color: '#10b981', label: 'Hidden Gems (low ownership, high form)' },
            { color: '#3b82f6', label: 'Template Picks (high ownership, high form)' },
            { color: '#ef4444', label: 'Avoid (high ownership, low form)' }
        ],
        chartId: 'ownership-form-chart'
    });

    contentContainer.innerHTML += '<div style="text-align: center; padding: 4rem; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i><br/><br/>Chart coming soon!</div>';
}

// ============================================================================
// CHART 6: FIXTURE DIFFICULTY VS FORM
// ============================================================================

async function renderFdrFormChart() {
    const contentContainer = document.getElementById('chart-content-container');
    if (!contentContainer) return;

    contentContainer.innerHTML = createChartCard({
        title: 'Fixture Difficulty vs Form',
        icon: '🗓️',
        description: 'Target form players with easy upcoming fixtures (next 5 GWs). Bubble size = ownership %',
        zones: [
            { color: '#10b981', label: 'Prime Targets (easy fixtures, high form)' },
            { color: '#fbbf24', label: 'Fixture Swing (tough fixtures, high form)' },
            { color: '#ef4444', label: 'Avoid (tough fixtures, low form)' }
        ],
        chartId: 'fdr-form-chart'
    });

    contentContainer.innerHTML += '<div style="text-align: center; padding: 4rem; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i><br/><br/>Chart coming soon!</div>';
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
