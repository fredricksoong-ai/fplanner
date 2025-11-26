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
    const {
        title,
        icon,
        description,
        zones,
        chartId,
        exportId = `${chartId}-export`,
        height = 600,
        minHeight = 400
    } = config;

    const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;

    const zonesHTML = zones ? `
        <div style="
            display: flex;
            gap: ${isMobile ? '0.5rem' : '1rem'};
            flex-wrap: wrap;
            font-size: ${isMobile ? '0.7rem' : '0.75rem'};
            color: var(--text-secondary);
            margin-top: ${isMobile ? '0.5rem' : '0'};
        ">
            ${zones.map(z => `<span><span style="color: ${z.color}; font-weight: bold;">■</span> ${z.label}</span>`).join('')}
        </div>
    ` : '';

    return `
        <div style="
            background: var(--bg-primary);
            border-radius: ${isMobile ? '8px' : '12px'};
            box-shadow: 0 2px 8px var(--shadow);
            padding: ${isMobile ? '1rem' : '1.5rem'};
            margin-bottom: ${isMobile ? '1rem' : '2rem'};
            margin-left: ${isMobile ? '0.25rem' : '0'};
            margin-right: ${isMobile ? '0.25rem' : '0'};
        ">
            <div style="
                display: flex;
                flex-direction: ${isMobile ? 'column' : 'row'};
                justify-content: space-between;
                align-items: ${isMobile ? 'stretch' : 'start'};
                gap: ${isMobile ? '0.75rem' : '0'};
                margin-bottom: ${isMobile ? '0.75rem' : '0.5rem'};
            ">
                <div style="flex: 1;">
                    <h2 style="
                        font-size: ${isMobile ? '1.1rem' : '1.25rem'};
                        font-weight: 700;
                        color: var(--text-primary);
                        margin-bottom: ${isMobile ? '0.4rem' : '0.5rem'};
                        display: flex;
                        align-items: center;
                        gap: 0.4rem;
                    ">
                        <span>${icon}</span>
                        <span>${title}</span>
                    </h2>
                    <p style="
                        color: var(--text-secondary);
                        margin-bottom: 0.5rem;
                        font-size: ${isMobile ? '0.8rem' : '0.875rem'};
                        line-height: 1.4;
                    ">
                        ${description}
                    </p>
                    ${zonesHTML}
                </div>
                <button
                    id="${exportId}"
                    class="${isMobile ? 'touch-target' : ''}"
                    style="
                        padding: ${isMobile ? '0.6rem 1rem' : '0.45rem 0.85rem'};
                        background: var(--accent-color);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: ${isMobile ? '0.75rem' : '0.8rem'};
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.4rem;
                        transition: all 0.2s;
                        white-space: nowrap;
                        ${isMobile ? 'min-height: 44px; width: 100%;' : 'flex-shrink: 0;'}
                    "
                    onmouseover="this.style.opacity='0.9'"
                    onmouseout="this.style.opacity='1'"
                >
                    <i class="fas fa-download"></i>
                    <span>${isMobile ? 'Export Chart as PNG' : 'Export PNG'}</span>
                </button>
            </div>

            <!-- Chart Container -->
            <div id="${chartId}" style="
                width: 100%;
                height: ${height}px;
                min-height: ${minHeight}px;
                margin-top: ${isMobile ? '0.75rem' : '1rem'};
            "></div>
        </div>
    `;
}

/**
 * Setup chart export button functionality
 * @param {Object} chartInstance - ECharts instance
 */
export function setupChartExport(chartInstance, exportBtnId = 'export-chart-btn') {
    const exportBtn = document.getElementById(exportBtnId);
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
        const instance = echartsModule.default || echartsModule;
        window.echarts = instance;
        return instance;
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

/**
 * Limit chart dataset size for performance (default: top 50 by total points)
 * @param {Array} players
 * @param {number} limit
 * @param {Function|string} selector - function or property name
 */
export function limitPlayers(players, limit = 50, selector = (p) => p.total_points || 0) {
    if (!Array.isArray(players)) return [];
    const getValue = typeof selector === 'function'
        ? selector
        : (p) => {
            const value = selector && typeof selector === 'string' ? p[selector] : (p.total_points || 0);
            return typeof value === 'number' ? value : (parseFloat(value) || 0);
        };

    return [...players]
        .sort((a, b) => getValue(b) - getValue(a))
        .slice(0, limit);
}
