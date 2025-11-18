/**
 * Chart Helper Functions
 * Shared utilities for all chart modules
 */

/**
 * Create the HTML for a chart card
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} config.icon - Chart icon
 * @param {string} config.description - Chart description
 * @param {Array} config.zones - Optional color zones legend
 * @param {string} config.chartId - DOM element ID for chart
 * @returns {string} HTML string for chart card
 */
export function createChartCard(config) {
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

/**
 * Setup chart export button functionality
 * @param {Object} chartInstance - ECharts instance
 */
export function setupChartExport(chartInstance) {
    const exportBtn = document.getElementById('export-chart-btn');
    if (exportBtn && chartInstance) {
        exportBtn.onclick = () => {
            const url = chartInstance.getDataURL({
                pixelRatio: 2,
                backgroundColor: '#fff'
            });
            const link = document.createElement('a');
            link.download = 'fplanner-chart.png';
            link.href = url;
            link.click();
        };
    }
}

/**
 * Lazy load ECharts library
 * @returns {Promise<Object>} ECharts module
 */
export async function loadECharts() {
    if (!window.echarts) {
        const echartsModule = await import('echarts');
        window.echarts = echartsModule;
        return echartsModule;
    }
    return window.echarts;
}

/**
 * Filter players by position
 * @param {Array} players - Array of players
 * @param {string} positionFilter - Position filter ('all', 'GKP', 'DEF', 'MID', 'FWD')
 * @returns {Array} Filtered players
 */
export function filterPlayersByPosition(players, positionFilter) {
    if (positionFilter === 'all') {
        return players;
    }

    const positionMap = {
        'GKP': 1,
        'DEF': 2,
        'MID': 3,
        'FWD': 4
    };

    const elementType = positionMap[positionFilter];
    return players.filter(p => p.element_type === elementType);
}

/**
 * Get position color for charts
 * @param {number} elementType - Player position type (1-4)
 * @returns {string} Color hex code
 */
export function getPositionColor(elementType) {
    const colors = {
        1: '#FFC107', // GKP - Yellow
        2: '#00BCD4', // DEF - Cyan
        3: '#4CAF50', // MID - Green
        4: '#F44336'  // FWD - Red
    };
    return colors[elementType] || '#9E9E9E';
}

/**
 * Common ECharts configuration options
 */
export const commonChartOptions = {
    grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true
    },
    tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(50, 50, 50, 0.95)',
        borderColor: '#777',
        borderWidth: 1,
        textStyle: {
            color: '#fff',
            fontSize: 12
        },
        padding: 10
    }
};
