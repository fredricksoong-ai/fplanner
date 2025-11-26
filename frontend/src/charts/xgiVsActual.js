/**
 * xGI vs Actual Goals + Assists Chart Module
 * Compare expected goal involvement with actual output (attackers only)
 */

import { getAllPlayers } from '../data.js';
import { getPositionShort, escapeHtml } from '../utils.js';
import { createChartCard, setupChartExport, limitPlayers } from './chartHelpers.js';

/**
 * Render xGI vs Actual scatter plot
 * @param {HTMLElement} contentContainer - Container element for chart
 * @param {Object} echarts - ECharts instance
 * @param {string} positionFilter - Current position filter
 * @returns {Object} Chart instance
 */
export async function renderXgiVsActualChart(contentContainer, echarts, positionFilter) {
    if (!contentContainer) return null;

    const isMobile = window.innerWidth <= 768;
    const chartHeight = isMobile ? 340 : 560;
    const chartMinHeight = isMobile ? 260 : 380;

    contentContainer.innerHTML = createChartCard({
        title: 'xGI vs Actual Goals + Assists',
        icon: '🎯',
        description: 'Find attackers over/underperforming their xGI. Bubble size = minutes played',
        zones: [
            { color: '#10b981', label: 'Overperforming (actual > xGI)' },
            { color: '#ef4444', label: 'Underperforming (actual < xGI)' }
        ],
        chartId: 'xgi-actual-chart',
        exportId: 'xgi-actual-export',
        height: chartHeight,
        minHeight: chartMinHeight
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    const chartContainer = document.getElementById('xgi-actual-chart');
    if (!chartContainer) return null;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    let players = getAllPlayers()
        .filter(p => {
            const pos = getPositionShort(p);
            return (pos === 'MID' || pos === 'FWD') && p.minutes >= 90;
        });

    if (positionFilter !== 'all' && (positionFilter === 'MID' || positionFilter === 'FWD')) {
        players = players.filter(p => getPositionShort(p) === positionFilter);
    }

    players = limitPlayers(players, 50, (p) => (parseFloat(p.expected_goals || 0) + parseFloat(p.expected_assists || 0)));

    const chartData = players
        .map(p => {
            const xGI = (parseFloat(p.expected_goals || 0) + parseFloat(p.expected_assists || 0));
            const actual = (p.goals_scored || 0) + (p.assists || 0);
            const minutes = p.minutes || 0;

            return {
                name: p.web_name,
                value: [xGI, actual, minutes],
                playerData: p,
                xGI,
                actual,
                minutes
            };
        })
        .filter(d => d.xGI > 0 || d.actual > 0);

    const positionColors = {
        'MID': '#3b82f6',
        'FWD': '#ef4444'
    };

    const seriesByPosition = {};
    chartData.forEach(player => {
        const position = getPositionShort(player.playerData);
        if (!seriesByPosition[position]) {
            seriesByPosition[position] = [];
        }
        seriesByPosition[position].push(player);
    });

    const option = createXgiVsActualChartOptions(seriesByPosition, positionColors, isDark, textColor, gridColor);

    if (!echarts) return null;
    const chartInstance = echarts.init(chartContainer);
    if (!chartInstance) return null;

    try {
        chartInstance.setOption(option);
        console.log('xGI vs Actual chart rendered');
    } catch (error) {
        console.error('Error setting chart options:', error);
        return null;
    }

    setupChartExport(chartInstance, 'xgi-actual-export');
    const resizeHandler = () => chartInstance?.resize();
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    return chartInstance;
}

function createXgiVsActualChartOptions(seriesByPosition, positionColors, isDark, textColor, gridColor) {
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
                const xGI = data.value[0];
                const actual = data.value[1];
                const minutes = data.value[2];
                const diff = actual - xGI;
                const position = getPositionShort(player);

                return `
                    <div style="padding: 4px;">
                        <strong>${escapeHtml(data.name)}</strong><br/>
                        Position: ${position}<br/>
                        xGI: ${xGI.toFixed(1)}<br/>
                        Actual G+A: ${actual}<br/>
                        Difference: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}<br/>
                        Minutes: ${minutes}<br/>
                        Price: £${(player.now_cost / 10).toFixed(1)}m
                    </div>
                `;
            }
        },
        legend: {
            data: ['MID', 'FWD'],
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
            name: 'Expected Goals Involvement (xGI)',
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
            name: 'Actual Goals + Assists',
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
