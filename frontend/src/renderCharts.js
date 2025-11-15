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
let echarts = null; // Lazy-loaded ECharts instance
let currentChart = null; // Current chart instance for cleanup

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render the Charts page
 */
export async function renderCharts() {
    const container = document.getElementById('app-container');

    container.innerHTML = `
        <div style="padding: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-chart-line"></i> Data Visualizations
            </h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Interactive charts to help you find value picks and differentials
            </p>

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

            <!-- Chart Card -->
            <div style="background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); padding: 1.5rem; margin-bottom: 2rem;">
                <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                    💰 Points vs Price
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.875rem;">
                    Find value picks and premium performers. Bubble size = ownership %, Your team = ⭐
                </p>

                <!-- Chart Container -->
                <div id="points-price-chart" style="width: 100%; height: 600px; min-height: 400px;"></div>
            </div>

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

            // Re-render chart
            renderPointsPriceChart();
        });
    });

    // Lazy load ECharts and render chart
    if (!echarts) {
        echarts = await import('echarts');
    }

    renderPointsPriceChart();
}

// ============================================================================
// CHART: POINTS VS PRICE SCATTER
// ============================================================================

/**
 * Render Points vs Price scatter plot
 */
async function renderPointsPriceChart() {
    const chartContainer = document.getElementById('points-price-chart');
    if (!chartContainer) return;

    // Dispose previous chart instance
    if (currentChart) {
        currentChart.dispose();
    }

    // Get data
    let players = getAllPlayers();

    // Filter by position if needed
    if (currentPositionFilter !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[currentPositionFilter]);
    }

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

    players.forEach(player => {
        const price = player.now_cost / 10; // Convert to actual price
        const points = player.total_points || 0;
        const ownership = parseFloat(player.selected_by_percent) || 0;
        const position = getPositionShort(player);
        const ppm = calculatePPM(player);
        const isMyPlayer = myTeamPlayerIds.has(player.id);

        if (positions[position]) {
            positions[position].data.push({
                name: player.web_name,
                value: [price, points, ownership],
                ppm: ppm,
                isMyPlayer: isMyPlayer,
                playerData: player
            });
        }
    });

    // Create series
    const series = Object.keys(positions).map(pos => ({
        name: positions[pos].name,
        type: 'scatter',
        symbolSize: (data) => {
            // Size based on ownership, min 8, max 40
            const ownership = data[2];
            const size = Math.max(8, Math.min(40, ownership * 2));
            return size;
        },
        itemStyle: {
            color: (params) => {
                // Highlight my team players with purple star
                return params.data.isMyPlayer ? '#8b5cf6' : positions[pos].color;
            },
            opacity: 0.7
        },
        emphasis: {
            itemStyle: {
                opacity: 1,
                borderColor: '#fff',
                borderWidth: 2
            }
        },
        data: positions[pos].data
    }));

    // Initialize chart
    currentChart = echarts.init(chartContainer);

    // Get theme colors
    const isDark = document.documentElement.classList.contains('dark-theme');
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

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

                return `
                    <div style="padding: 4px;">
                        <strong>${escapeHtml(data.name)}${myTeamBadge}</strong><br/>
                        Position: ${getPositionShort(player)}<br/>
                        Price: £${price.toFixed(1)}m<br/>
                        Points: ${points}<br/>
                        PPM: ${ppm.toFixed(1)}<br/>
                        Ownership: ${ownership.toFixed(1)}%<br/>
                        Form: ${player.form || 0}
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
            left: '5%',
            right: '4%',
            bottom: '10%',
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

    currentChart.setOption(option);

    // Handle window resize
    const resizeHandler = () => {
        if (currentChart) {
            currentChart.resize();
        }
    };

    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);
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
