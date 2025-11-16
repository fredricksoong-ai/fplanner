/**
 * Minutes Efficiency Chart Module
 * Analyze points per 90 minutes vs total minutes played
 */

import { getAllPlayers } from '../data.js';
import { getPositionShort, escapeHtml } from '../utils.js';
import { createChartCard, setupChartExport, filterPlayersByPosition } from './chartHelpers.js';

/**
 * Render Minutes Efficiency scatter plot
 * @param {HTMLElement} contentContainer - Container element for chart
 * @param {Object} echarts - ECharts instance
 * @param {string} positionFilter - Current position filter
 * @returns {Object} Chart instance
 */
export async function renderMinutesEfficiencyChart(contentContainer, echarts, positionFilter) {
    if (!contentContainer) return null;

    contentContainer.innerHTML = createChartCard({
        title: 'Minutes Efficiency (PP90)',
        icon: '⚡',
        description: 'Find efficient players and rotation risks. Bubble size = ownership %',
        zones: [
            { color: '#10b981', label: 'Efficient & Nailed (high PP90, high minutes)' },
            { color: '#fbbf24', label: 'Efficient Rotation Risk (high PP90, low minutes)' },
            { color: '#ef4444', label: 'Inefficient (low PP90)' }
        ],
        chartId: 'minutes-efficiency-chart'
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    const chartContainer = document.getElementById('minutes-efficiency-chart');
    if (!chartContainer) return null;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    let players = getAllPlayers().filter(p => p.minutes >= 90);
    players = filterPlayersByPosition(players, positionFilter);

    const myTeamPlayerIds = getUserTeamPlayerIds();

    const chartData = players
        .map(p => {
            const minutes = p.minutes || 0;
            const pp90 = minutes > 0 ? ((p.total_points || 0) / minutes) * 90 : 0;
            const ownership = parseFloat(p.selected_by_percent) || 0;

            return {
                name: p.web_name,
                value: [minutes, pp90, ownership],
                playerData: p,
                isMyPlayer: myTeamPlayerIds.has(p.id),
                minutes,
                pp90,
                ownership
            };
        })
        .filter(d => d.minutes > 0);

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

    // Find top PP90 players for labeling
    const sortedByPP90 = [...chartData].sort((a, b) => b.pp90 - a.pp90);
    const topPlayerIds = new Set(sortedByPP90.slice(0, 12).map(p => p.playerData.id));

    const option = createMinutesEfficiencyChartOptions(
        seriesByPosition,
        positionColors,
        topPlayerIds,
        isDark,
        textColor,
        gridColor
    );

    if (!echarts) return null;
    const chartInstance = echarts.init(chartContainer);
    if (!chartInstance) return null;

    try {
        chartInstance.setOption(option);
        console.log('Minutes Efficiency chart rendered');
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
            } catch (e) {}
        }
    }
    return myTeamPlayerIds;
}

function createMinutesEfficiencyChartOptions(seriesByPosition, positionColors, topPlayerIds, isDark, textColor, gridColor) {
    const series = Object.entries(seriesByPosition).map(([position, data]) => ({
        name: position,
        type: 'scatter',
        symbolSize: (data) => Math.max(6, Math.min(50, Math.sqrt(data[2]) * 6)),
        symbol: (value, params) => params.data.isMyPlayer ? 'star' : 'circle',
        itemStyle: {
            color: positionColors[position],
            opacity: 0.7,
            borderColor: (params) => params.data.isMyPlayer ? '#8b5cf6' : 'transparent',
            borderWidth: (params) => params.data.isMyPlayer ? 3 : 0
        },
        emphasis: {
            focus: 'series',
            itemStyle: {
                opacity: 1,
                borderColor: '#fff',
                borderWidth: 2
            }
        },
        label: {
            show: true,
            formatter: (params) => {
                const isTopPlayer = topPlayerIds.has(params.data.playerData.id);
                return isTopPlayer ? params.data.name : '';
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
        data: data
    }));

    series.push({
        name: 'Efficiency Zones',
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
                        name: 'Efficient & Nailed',
                        xAxis: 1800,
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
                    { xAxis: 3420, yAxis: 10 }
                ],
                [
                    {
                        name: 'Efficient Rotation Risk',
                        xAxis: 90,
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
                    { xAxis: 1800, yAxis: 10 }
                ],
                [
                    {
                        name: 'Inefficient',
                        xAxis: 90,
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
                    { xAxis: 3420, yAxis: 5 }
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
                const minutes = data.value[0];
                const pp90 = data.value[1];
                const ownership = data.value[2];
                const myTeamBadge = data.isMyPlayer ? ' ⭐' : '';
                const position = getPositionShort(player);

                return `
                    <div style="padding: 4px;">
                        <strong>${escapeHtml(data.name)}${myTeamBadge}</strong><br/>
                        Position: ${position}<br/>
                        Minutes: ${minutes}<br/>
                        PP90: ${pp90.toFixed(2)}<br/>
                        Total Points: ${player.total_points || 0}<br/>
                        Ownership: ${ownership.toFixed(1)}%<br/>
                        Price: £${(player.now_cost / 10).toFixed(1)}m<br/>
                        Form: ${player.form || 0}
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
            name: 'Minutes Played',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: textColor, fontSize: 12 },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: gridColor, opacity: 0.3 } },
            min: 0,
            max: 3420
        },
        yAxis: {
            type: 'value',
            name: 'Points per 90 Minutes',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: { color: textColor, fontSize: 12 },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: gridColor, opacity: 0.3 } },
            min: 0,
            max: 10
        },
        series: series
    };
}
