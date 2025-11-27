/**
 * Points vs Price Chart Module
 * Scatter plot showing player value analysis
 */

import { getAllPlayers } from '../data.js';
import { getPositionShort, calculatePPM, escapeHtml } from '../utils.js';
import {
    createChartCard,
    setupChartExport,
    filterPlayersByPosition,
    getPositionColor,
    limitPlayers
} from './chartHelpers.js';

/**
 * Render Points vs Price scatter plot
 * @param {HTMLElement} contentContainer - Container element for chart
 * @param {Object} echarts - ECharts instance
 * @param {string} positionFilter - Current position filter
 * @returns {Object} Chart instance
 */
export async function renderPointsPriceChart(contentContainer, echarts, positionFilter) {
    if (!contentContainer) {
        console.error('Chart content container not found');
        return null;
    }

    // Create chart card HTML with mobile-optimized sizing
    const isMobile = window.innerWidth <= 768;
    const chartHeight = isMobile ? 400 : 600;
    const chartMinHeight = isMobile ? 320 : 400;

    contentContainer.innerHTML = createChartCard({
        title: 'Points vs Price',
        icon: '💰',
        description: 'Find value picks and premium performers. Bubble size = ownership %',
        zones: [
            { color: '#10b981', label: 'Value Zone (low price, high points)' },
            { color: '#3b82f6', label: 'Premium Zone (high price, high points)' },
            { color: '#ef4444', label: 'Trap Zone (high price, low points - avoid!)' }
        ],
        chartId: 'points-price-chart',
        exportId: 'points-price-export',
        height: chartHeight,
        minHeight: chartMinHeight
    });

    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 0));

    const chartContainer = document.getElementById('points-price-chart');
    if (!chartContainer) {
        console.error('Points-price-chart container not found');
        return null;
    }

    // Define theme colors
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    // Get and filter data
    let players = getAllPlayers();
    players = filterPlayersByPosition(players, positionFilter);

    // Filter out very low-point players (less than 10 points)
    players = players.filter(p => (p.total_points || 0) >= 10);
    players = limitPlayers(players);

    // Get user's team player IDs
    const myTeamPlayerIds = getUserTeamPlayerIds();

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
        const price = player.now_cost / 10;
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

    // Calculate dynamic zone boundaries
    const allPoints = players.map(p => p.total_points || 0);
    const maxPoints = Math.max(...allPoints, 50);
    const yAxisMax = Math.ceil((maxPoints + 25) / 10) * 10;
    const highPointsThreshold = Math.round(maxPoints * 0.6);

    // Calculate dynamic x-axis (price) boundaries
    const allPrices = players.map(p => p.now_cost / 10);
    const minPrice = Math.max(3, Math.floor(Math.min(...allPrices) - 0.5));
    const maxPrice = Math.ceil(Math.max(...allPrices) + 0.5);
    const midPrice = Math.round((minPrice + maxPrice) / 2);

    // Create chart options
    const option = createPointsPriceChartOptions(
        positions,
        yAxisMax,
        highPointsThreshold,
        minPrice,
        maxPrice,
        midPrice,
        isDark,
        textColor,
        gridColor
    );

    // Initialize and render chart
    if (!echarts) {
        console.error('ECharts library not loaded');
        return null;
    }

    // Dispose existing chart instance if it exists to prevent caching issues
    const existingInstance = echarts.getInstanceByDom(chartContainer);
    if (existingInstance) {
        existingInstance.dispose();
    }

    const chartInstance = echarts.init(chartContainer);
    if (!chartInstance) {
        console.error('Failed to initialize chart');
        return null;
    }

    try {
        chartInstance.setOption(option);
        console.log('Points vs Price chart rendered with', players.length, 'players');
    } catch (error) {
        console.error('Error setting chart options:', error);
        return null;
    }

    // Setup export functionality
    setupChartExport(chartInstance, 'points-price-export');

    // Handle window resize
    const resizeHandler = () => chartInstance?.resize();
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    return chartInstance;
}

/**
 * Get user's team player IDs from localStorage
 * @returns {Set} Set of player IDs
 */
function getUserTeamPlayerIds() {
    const myTeamPlayerIds = new Set();
    const cachedTeamId = localStorage.getItem('fplanner_team_id');

    if (cachedTeamId) {
        const cachedTeamData = localStorage.getItem(`fplanner_team_${cachedTeamId}`);
        if (cachedTeamData) {
            try {
                const teamData = JSON.parse(cachedTeamData);
                if (teamData?.picks?.picks) {
                    return new Set(teamData.picks.picks.map(p => p.element));
                }
            } catch (e) {
                console.log('Could not parse cached team data');
            }
        }
    }

    return myTeamPlayerIds;
}

/**
 * Create chart options for Points vs Price chart
 * @param {Object} positions - Position data
 * @param {number} yAxisMax - Y-axis maximum value
 * @param {number} highPointsThreshold - Threshold for high points
 * @param {number} minPrice - Minimum price for x-axis
 * @param {number} maxPrice - Maximum price for x-axis
 * @param {number} midPrice - Midpoint price for zone boundaries
 * @param {boolean} isDark - Dark theme flag
 * @param {string} textColor - Text color
 * @param {string} gridColor - Grid color
 * @returns {Object} ECharts option object
 */
function createPointsPriceChartOptions(positions, yAxisMax, highPointsThreshold, minPrice, maxPrice, midPrice, isDark, textColor, gridColor) {
    // Create series
    const series = Object.keys(positions).map(pos => ({
        name: positions[pos].name,
        type: 'scatter',
        symbolSize: (data) => {
            const ownership = data[2];
            return Math.max(6, Math.min(50, Math.sqrt(ownership) * 6));
        },
        symbol: (value, params) => params.data.isMyPlayer ? 'star' : 'circle',
        itemStyle: {
            color: positions[pos].color,
            opacity: 0.7,
            borderColor: (params) => params.data.isMyPlayer ? '#8b5cf6' : 'transparent',
            borderWidth: (params) => params.data.isMyPlayer ? 3 : 0
        },
        emphasis: {
            itemStyle: {
                opacity: 1,
                borderColor: '#fff',
                borderWidth: 2
            }
        },
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
        data: positions[pos].data
    }));

    // Add value zones as a separate series
    series.unshift({
        name: 'Value Zones',
        type: 'scatter',
        silent: true,
        symbolSize: 0,
        itemStyle: { opacity: 0 },
        data: [],
        z: -1,
        markArea: {
            silent: true,
            itemStyle: { opacity: 0.15 },
            data: [
                [
                    {
                        name: 'Value Zone',
                        xAxis: minPrice,
                        yAxis: highPointsThreshold,
                        itemStyle: { color: '#10b981' },
                        label: createZoneLabel(textColor, isDark, 'insideTopLeft')
                    },
                    { xAxis: midPrice, yAxis: yAxisMax }
                ],
                [
                    {
                        name: 'Premium Zone',
                        xAxis: midPrice,
                        yAxis: highPointsThreshold,
                        itemStyle: { color: '#3b82f6' },
                        label: createZoneLabel(textColor, isDark, 'insideTopRight')
                    },
                    { xAxis: maxPrice, yAxis: yAxisMax }
                ],
                [
                    {
                        name: 'Trap Zone',
                        xAxis: midPrice,
                        yAxis: 10,
                        itemStyle: { color: '#ef4444' },
                        label: createZoneLabel(textColor, isDark, 'insideBottomRight')
                    },
                    { xAxis: maxPrice, yAxis: highPointsThreshold }
                ]
            ]
        }
    });

    return {
        backgroundColor: 'transparent',
        textStyle: { color: textColor },
        tooltip: {
            trigger: 'item',
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderColor: isDark ? '#374151' : '#e5e7eb',
            textStyle: { color: textColor },
            formatter: createTooltipFormatter
        },
        legend: {
            data: Object.values(positions).map(p => p.name),
            textStyle: { color: textColor },
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
            nameTextStyle: { color: textColor, fontWeight: 'bold' },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor, formatter: (value) => `£${value.toFixed(1)}` },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed', opacity: 0.3 } },
            min: minPrice,
            max: maxPrice
        },
        yAxis: {
            type: 'value',
            name: 'Total Points',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: { color: textColor, fontWeight: 'bold' },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed', opacity: 0.3 } },
            min: 0,
            max: yAxisMax
        },
        series: series
    };
}

/**
 * Create zone label configuration
 * @param {string} textColor - Text color
 * @param {boolean} isDark - Dark theme flag
 * @param {string} position - Label position
 * @returns {Object} Label configuration
 */
function createZoneLabel(textColor, isDark, position) {
    return {
        show: true,
        position: position,
        fontSize: 11,
        fontWeight: 'bold',
        color: textColor,
        backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
        padding: [4, 8],
        borderRadius: 4
    };
}

/**
 * Create tooltip formatter function
 * @param {Object} params - Chart parameters
 * @returns {string} Formatted HTML tooltip
 */
function createTooltipFormatter(params) {
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
