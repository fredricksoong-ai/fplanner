/**
 * xGC vs Actual Goals Conceded Chart Module
 * Compare expected goals conceded with actual (defenders and goalkeepers only)
 */

import { getAllPlayers } from '../data.js';
import { getPositionShort, escapeHtml } from '../utils.js';
import { createChartCard, setupChartExport } from './chartHelpers.js';

/**
 * Render xGC vs Actual scatter plot
 * @param {HTMLElement} contentContainer - Container element for chart
 * @param {Object} echarts - ECharts instance
 * @param {string} positionFilter - Current position filter
 * @returns {Object} Chart instance
 */
export async function renderXgcVsActualChart(contentContainer, echarts, positionFilter) {
    if (!contentContainer) return null;

    contentContainer.innerHTML = createChartCard({
        title: 'xGC vs Actual Goals Conceded',
        icon: '🛡️',
        description: 'Find defensive assets over/underperforming their xGC. Bubble size = minutes played',
        zones: [
            { color: '#10b981', label: 'Strong Defense (actual < xGC)' },
            { color: '#ef4444', label: 'Weak Defense (actual > xGC)' }
        ],
        chartId: 'xgc-actual-chart'
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    const chartContainer = document.getElementById('xgc-actual-chart');
    if (!chartContainer) return null;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    let players = getAllPlayers()
        .filter(p => {
            const pos = getPositionShort(p);
            return (pos === 'GKP' || pos === 'DEF') && p.minutes >= 90;
        });

    if (positionFilter !== 'all' && (positionFilter === 'GKP' || positionFilter === 'DEF')) {
        players = players.filter(p => getPositionShort(p) === positionFilter);
    }

    const chartData = players
        .map(p => {
            const xGC = parseFloat(p.expected_goals_conceded || 0);
            const actual = p.goals_conceded || 0;
            const minutes = p.minutes || 0;

            return {
                name: p.web_name,
                value: [xGC, actual, minutes],
                playerData: p,
                xGC,
                actual,
                minutes
            };
        })
        .filter(d => d.xGC > 0 || d.actual > 0);

    const positionColors = {
        'GKP': '#fbbf24',
        'DEF': '#3b82f6'
    };

    const seriesByPosition = {};
    chartData.forEach(player => {
        const position = getPositionShort(player.playerData);
        if (!seriesByPosition[position]) {
            seriesByPosition[position] = [];
        }
        seriesByPosition[position].push(player);
    });

    const option = createXgcVsActualChartOptions(seriesByPosition, positionColors, isDark, textColor, gridColor);

    if (!echarts) return null;
    const chartInstance = echarts.init(chartContainer);
    if (!chartInstance) return null;

    try {
        chartInstance.setOption(option);
        console.log('xGC vs Actual chart rendered');
    } catch (error) {
        console.error('Error setting chart options:', error);
        return null;
    }

    setupChartExport(chartInstance);
    const resizeHandler = () => chartInstance?.resize();
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    return chartInstance;
}

function createXgcVsActualChartOptions(seriesByPosition, positionColors, isDark, textColor, gridColor) {
    const series = Object.entries(seriesByPosition).map(([position, data]) => ({
        name: position,
        type: 'scatter',
        symbolSize: (data) => Math.max(8, Math.min(60, data[2] / 40)),
        itemStyle: {
            color: positionColors[position],
            opacity: 0.7
        },
        emphasis: {
            focus: 'series',
            label: {
                show: true,
                formatter: (param) => param.data.name,
                position: 'top'
            }
        },
        data: data
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
                const xGC = data.value[0];
                const actual = data.value[1];
                const minutes = data.value[2];
                const diff = actual - xGC;
                const position = getPositionShort(player);

                return `
                    <div style="padding: 4px;">
                        <strong>${escapeHtml(data.name)}</strong><br/>
                        Position: ${position}<br/>
                        xGC: ${xGC.toFixed(1)}<br/>
                        Actual Conceded: ${actual}<br/>
                        Difference: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}<br/>
                        Minutes: ${minutes}<br/>
                        Clean Sheets: ${player.clean_sheets || 0}<br/>
                        Price: £${(player.now_cost / 10).toFixed(1)}m
                    </div>
                `;
            }
        },
        legend: {
            data: ['GKP', 'DEF'],
            top: 10,
            textStyle: { color: textColor }
        },
        grid: {
            left: '10%',
            right: '10%',
            bottom: '15%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            name: 'Expected Goals Conceded (xGC)',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: textColor, fontSize: 12 },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: gridColor, opacity: 0.3 } },
            min: 0
        },
        yAxis: {
            type: 'value',
            name: 'Actual Goals Conceded',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: { color: textColor, fontSize: 12 },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: gridColor, opacity: 0.3 } },
            min: 0
        },
        series: series
    };
}
