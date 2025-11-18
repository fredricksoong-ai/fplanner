/**
 * Fixture Difficulty vs Form Chart Module
 * Target players with easy fixtures and good form
 */

import { getAllPlayers } from '../data.js';
import { getPositionShort, escapeHtml } from '../utils.js';
import { calculateFixtureDifficulty } from '../fixtures.js';
import { createChartCard, setupChartExport } from './chartHelpers.js';

/**
 * Render Fixture Difficulty vs Form scatter plot
 * @param {HTMLElement} contentContainer - Container element for chart
 * @param {Object} echarts - ECharts instance
 * @param {string} positionFilter - Current position filter
 * @returns {Object} Chart instance
 */
export async function renderFixturesVsFormChart(contentContainer, echarts, positionFilter) {
    if (!contentContainer) return null;

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

    await new Promise(resolve => setTimeout(resolve, 0));
    const chartContainer = document.getElementById('fdr-form-chart');
    if (!chartContainer) return null;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    let players = getAllPlayers();
    if (positionFilter !== 'all') {
        players = players.filter(p => getPositionShort(p) === positionFilter);
    }

    const chartData = players
        .filter(p => p.minutes > 90)
        .map(p => {
            const avgFDR = calculateFixtureDifficulty(p.team, 5);
            const form = parseFloat(p.form) || 0;
            const ownership = parseFloat(p.selected_by_percent) || 0;

            return {
                name: p.web_name,
                value: [avgFDR, form, ownership],
                playerData: p,
                isMyPlayer: false,
                avgFDR: avgFDR,
                form: form,
                ownership: ownership
            };
        })
        .filter(d => d.avgFDR > 0 || d.form > 0);

    const positionColors = {
        'GKP': '#fbbf24',
        'DEF': '#10b981',
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

    const option = createFixturesVsFormChartOptions(seriesByPosition, positionColors, isDark, textColor, gridColor);

    if (!echarts) return null;
    const chartInstance = echarts.init(chartContainer);
    if (!chartInstance) return null;

    try {
        chartInstance.setOption(option);
        console.log('Fixtures vs Form chart rendered');
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

function createFixturesVsFormChartOptions(seriesByPosition, positionColors, isDark, textColor, gridColor) {
    const series = Object.entries(seriesByPosition).map(([position, data]) => ({
        name: position,
        type: 'scatter',
        symbolSize: (data) => {
            const ownership = data[2];
            return Math.max(8, Math.min(60, ownership * 3));
        },
        emphasis: {
            focus: 'series',
            label: {
                show: true,
                formatter: (param) => param.data.name,
                position: 'top'
            }
        },
        itemStyle: {
            color: positionColors[position],
            opacity: 0.7,
            borderColor: (params) => params.data.isMyPlayer ? '#fff' : positionColors[position],
            borderWidth: (params) => params.data.isMyPlayer ? 3 : 1
        },
        data: data
    }));

    series.push({
        name: 'Value Zones',
        type: 'scatter',
        silent: true,
        symbolSize: 0,
        itemStyle: { opacity: 0 },
        data: [],
        markArea: {
            silent: true,
            itemStyle: { opacity: 0.08 },
            data: [
                [
                    {
                        name: 'Prime Targets',
                        xAxis: 1,
                        yAxis: 5,
                        itemStyle: { color: '#10b981' },
                        label: {
                            show: true,
                            position: 'insideTopRight',
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: textColor,
                            backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                            padding: [4, 8],
                            borderRadius: 4
                        }
                    },
                    { xAxis: 3, yAxis: 'max' }
                ],
                [
                    {
                        name: 'Fixture Swing',
                        xAxis: 3.5,
                        yAxis: 5,
                        itemStyle: { color: '#fbbf24' },
                        label: {
                            show: true,
                            position: 'insideTopLeft',
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: textColor,
                            backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                            padding: [4, 8],
                            borderRadius: 4
                        }
                    },
                    { xAxis: 5, yAxis: 12 }
                ],
                [
                    {
                        name: 'Avoid',
                        xAxis: 3.5,
                        yAxis: 0,
                        itemStyle: { color: '#ef4444' },
                        label: {
                            show: true,
                            position: 'insideBottomLeft',
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: textColor,
                            backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                            padding: [4, 8],
                            borderRadius: 4
                        }
                    },
                    { xAxis: 5, yAxis: 5 }
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
            formatter: (params) => {
                const data = params.data;
                const player = data.playerData;
                const avgFDR = data.value[0];
                const form = data.value[1];
                const ownership = data.value[2];
                const position = getPositionShort(player);

                return `
                    <div style="padding: 4px;">
                        <strong>${escapeHtml(data.name)}</strong><br/>
                        Position: ${position}<br/>
                        Avg FDR (5 GWs): ${avgFDR.toFixed(1)}<br/>
                        Form: ${form.toFixed(1)}<br/>
                        Ownership: ${ownership.toFixed(1)}%<br/>
                        Price: £${(player.now_cost / 10).toFixed(1)}m<br/>
                        Total Points: ${player.total_points}
                    </div>
                `;
            }
        },
        legend: {
            data: ['GKP', 'DEF', 'MID', 'FWD'],
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
            name: 'Fixture Difficulty (lower = easier)',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: textColor, fontSize: 12 },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: gridColor, opacity: 0.3 } },
            min: 1,
            max: 5,
            inverse: true
        },
        yAxis: {
            type: 'value',
            name: 'Form',
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
