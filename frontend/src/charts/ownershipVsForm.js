/**
 * Ownership vs Form Chart Module
 * Find differential picks with low ownership and high form
 */

import { getAllPlayers } from '../data.js';
import { getPositionShort, escapeHtml } from '../utils.js';
import {
    createChartCard,
    setupChartExport,
    filterPlayersByPosition,
    limitPlayers
} from './chartHelpers.js';

/**
 * Render Ownership vs Form scatter plot
 * @param {HTMLElement} contentContainer - Container element for chart
 * @param {Object} echarts - ECharts instance
 * @param {string} positionFilter - Current position filter
 * @returns {Object} Chart instance
 */
export async function renderOwnershipVsFormChart(contentContainer, echarts, positionFilter) {
    if (!contentContainer) return null;

    const isMobile = window.innerWidth <= 768;
    const chartHeight = isMobile ? 340 : 560;
    const chartMinHeight = isMobile ? 260 : 380;

    contentContainer.innerHTML = createChartCard({
        title: 'Ownership % vs Form',
        icon: '📊',
        description: 'Find differential picks with low ownership and high form. Bubble size = price',
        zones: [
            { color: '#10b981', label: 'Hidden Gems (low ownership, high form)' },
            { color: '#3b82f6', label: 'Template Picks (high ownership, high form)' },
            { color: '#ef4444', label: 'Avoid (high ownership, low form)' }
        ],
        chartId: 'ownership-form-chart',
        exportId: 'ownership-form-export',
        height: chartHeight,
        minHeight: chartMinHeight
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    const chartContainer = document.getElementById('ownership-form-chart');
    if (!chartContainer) return null;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    let players = getAllPlayers();
    if (positionFilter !== 'all') {
        players = players.filter(p => getPositionShort(p) === positionFilter);
    }

    players = limitPlayers(players);

    const chartData = players
        .filter(p => p.minutes > 90) // At least 90 minutes played
        .map(p => {
            const ownership = parseFloat(p.selected_by_percent) || 0;
            const form = parseFloat(p.form) || 0;
            const price = p.now_cost / 10;

            return {
                name: p.web_name,
                value: [ownership, form, price],
                playerData: p,
                isMyPlayer: false, // Can be enhanced with user team data
                ownership: ownership,
                form: form,
                price: price
            };
        })
        .filter(d => d.ownership > 0 || d.form > 0);

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

    const option = createOwnershipVsFormChartOptions(seriesByPosition, positionColors, isDark, textColor, gridColor);

    if (!echarts) return null;
    const chartInstance = echarts.init(chartContainer);
    if (!chartInstance) return null;

    try {
        chartInstance.setOption(option);
        console.log('Ownership vs Form chart rendered');
    } catch (error) {
        console.error('Error setting chart options:', error);
        return null;
    }

    setupChartExport(chartInstance, 'ownership-form-export');
    const resizeHandler = () => chartInstance?.resize();
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    return chartInstance;
}

function createOwnershipVsFormChartOptions(seriesByPosition, positionColors, isDark, textColor, gridColor) {
    const series = Object.entries(seriesByPosition).map(([position, data]) => ({
        name: position,
        type: 'scatter',
        symbolSize: (data) => {
            const price = data[2];
            return Math.max(8, Math.min(60, price * 5));
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
                        name: 'Hidden Gems',
                        xAxis: 0,
                        yAxis: 5,
                        itemStyle: { color: '#10b981' },
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
                    { xAxis: 10, yAxis: 'max' }
                ],
                [
                    {
                        name: 'Template Picks',
                        xAxis: 30,
                        yAxis: 5.5,
                        itemStyle: { color: '#3b82f6' },
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
                    { xAxis: 100, yAxis: 12 }
                ],
                [
                    {
                        name: 'Avoid',
                        xAxis: 30,
                        yAxis: 0,
                        itemStyle: { color: '#ef4444' },
                        label: {
                            show: true,
                            position: 'insideBottomRight',
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: textColor,
                            backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                            padding: [4, 8],
                            borderRadius: 4
                        }
                    },
                    { xAxis: 100, yAxis: 5 }
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
                const ownership = data.value[0];
                const form = data.value[1];
                const price = data.value[2];
                const myTeamBadge = data.isMyPlayer ? ' ⭐' : '';
                const position = getPositionShort(player);

                return `
                    <div style="padding: 4px;">
                        <strong>${escapeHtml(data.name)}${myTeamBadge}</strong><br/>
                        Position: ${position}<br/>
                        Ownership: ${ownership.toFixed(1)}%<br/>
                        Form: ${form.toFixed(1)}<br/>
                        Price: £${price.toFixed(1)}m<br/>
                        Total Points: ${player.total_points}<br/>
                        Points/90: ${player.minutes > 0 ? ((player.total_points / player.minutes) * 90).toFixed(1) : '0'}
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
            name: 'Ownership %',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: textColor, fontSize: 12 },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor, formatter: '{value}%' },
            splitLine: { lineStyle: { color: gridColor, opacity: 0.3 } },
            min: 0
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
