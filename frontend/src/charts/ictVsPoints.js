/**
 * ICT Index vs Points Chart Module
 * Compare ICT Index with actual FPL points
 */

import { getAllPlayers } from '../data.js';
import { getPositionShort, calculatePPM, escapeHtml } from '../utils.js';
import {
    createChartCard,
    setupChartExport,
    filterPlayersByPosition,
    limitPlayers
} from './chartHelpers.js';

/**
 * Render ICT Index vs Points scatter plot
 * @param {HTMLElement} contentContainer - Container element for chart
 * @param {Object} echarts - ECharts instance
 * @param {string} positionFilter - Current position filter
 * @returns {Object} Chart instance
 */
export async function renderIctVsPointsChart(contentContainer, echarts, positionFilter) {
    if (!contentContainer) return null;

    const isMobile = window.innerWidth <= 768;
    const chartHeight = isMobile ? 340 : 560;
    const chartMinHeight = isMobile ? 260 : 380;

    contentContainer.innerHTML = createChartCard({
        title: 'ICT Index vs Points',
        icon: '📈',
        description: 'Compare ICT Index with actual FPL points. Bubble size = ownership %',
        chartId: 'ict-points-chart',
        exportId: 'ict-points-export',
        height: chartHeight,
        minHeight: chartMinHeight
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    const chartContainer = document.getElementById('ict-points-chart');
    if (!chartContainer) return null;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    let players = getAllPlayers().filter(p => (p.total_points || 0) >= 10);
    players = filterPlayersByPosition(players, positionFilter);
    players = limitPlayers(players);

    const positions = {
        'GKP': { data: [], color: '#fbbf24', name: 'Goalkeepers' },
        'DEF': { data: [], color: '#3b82f6', name: 'Defenders' },
        'MID': { data: [], color: '#10b981', name: 'Midfielders' },
        'FWD': { data: [], color: '#ef4444', name: 'Forwards' }
    };

    players.forEach(player => {
        const ict = parseFloat(player.ict_index) || 0;
        const points = player.total_points || 0;
        const ownership = parseFloat(player.selected_by_percent) || 0;
        const position = getPositionShort(player);

        if (positions[position] && ict > 0) {
            positions[position].data.push({
                name: player.web_name,
                value: [ict, points, ownership],
                playerData: player
            });
        }
    });

    const option = createIctVsPointsChartOptions(positions, isDark, textColor, gridColor);

    if (!echarts) return null;
    const chartInstance = echarts.init(chartContainer);
    if (!chartInstance) return null;

    try {
        chartInstance.setOption(option);
        console.log('ICT vs Points chart rendered');
    } catch (error) {
        console.error('Error setting chart options:', error);
        return null;
    }

    setupChartExport(chartInstance, 'ict-points-export');
    const resizeHandler = () => chartInstance?.resize();
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    return chartInstance;
}

function createIctVsPointsChartOptions(positions, isDark, textColor, gridColor) {
    const series = Object.keys(positions).map(pos => ({
        name: positions[pos].name,
        type: 'scatter',
        symbolSize: (data) => Math.max(6, Math.min(50, Math.sqrt(data[2]) * 6)),
        itemStyle: {
            color: positions[pos].color,
            opacity: 0.7
        },
        emphasis: { itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 2 } },
        data: positions[pos].data
    }));

    return {
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
                const ict = data.value[0];
                const points = data.value[1];
                const ownership = data.value[2];
                const position = getPositionShort(player);
                const ppm = calculatePPM(player);

                return `
                    <div style="padding: 4px;">
                        <strong>${escapeHtml(data.name)}</strong><br/>
                        Position: ${position}<br/>
                        ICT Index: ${ict.toFixed(1)}<br/>
                        Points: ${points}<br/>
                        PPM: ${ppm.toFixed(1)}<br/>
                        Ownership: ${ownership.toFixed(1)}%<br/>
                        Price: £${(player.now_cost / 10).toFixed(1)}m
                    </div>
                `;
            }
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
            name: 'ICT Index',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: textColor, fontWeight: 'bold' },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed', opacity: 0.3 } }
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
            min: 0
        },
        series: series
    };
}
