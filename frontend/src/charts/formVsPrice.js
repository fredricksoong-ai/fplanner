/**
 * Form vs Price Chart Module
 * Scatter plot showing player form relative to price
 */

import { getAllPlayers } from '../data.js';
import { getPositionShort, calculatePPM, escapeHtml } from '../utils.js';
import { createChartCard, setupChartExport, filterPlayersByPosition } from './chartHelpers.js';

/**
 * Render Form vs Price scatter plot
 * @param {HTMLElement} contentContainer - Container element for chart
 * @param {Object} echarts - ECharts instance
 * @param {string} positionFilter - Current position filter
 * @returns {Object} Chart instance
 */
export async function renderFormVsPriceChart(contentContainer, echarts, positionFilter) {
    if (!contentContainer) return null;

    contentContainer.innerHTML = createChartCard({
        title: 'Form vs Price',
        icon: '🔥',
        description: 'Find in-form bargains and spot premium players losing form. Bubble size = ownership %',
        zones: [
            { color: '#10b981', label: 'Hot Form Value (low price, high form)' },
            { color: '#3b82f6', label: 'Premium Form (high price, high form)' },
            { color: '#ef4444', label: 'Cold Trap (high price, low form - avoid!)' }
        ],
        chartId: 'form-price-chart'
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    const chartContainer = document.getElementById('form-price-chart');
    if (!chartContainer) return null;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    let players = getAllPlayers().filter(p => (p.total_points || 0) >= 10);
    players = filterPlayersByPosition(players, positionFilter);

    const myTeamPlayerIds = getUserTeamPlayerIds();

    const positions = {
        'GKP': { data: [], color: '#fbbf24', name: 'Goalkeepers' },
        'DEF': { data: [], color: '#3b82f6', name: 'Defenders' },
        'MID': { data: [], color: '#10b981', name: 'Midfielders' },
        'FWD': { data: [], color: '#ef4444', name: 'Forwards' }
    };

    const sortedByForm = [...players].sort((a, b) => (parseFloat(b.form) || 0) - (parseFloat(a.form) || 0));
    const topPlayerIds = new Set(sortedByForm.slice(0, 12).map(p => p.id));

    players.forEach(player => {
        const price = player.now_cost / 10;
        const form = parseFloat(player.form) || 0;
        const ownership = parseFloat(player.selected_by_percent) || 0;
        const position = getPositionShort(player);
        const ppm = calculatePPM(player);

        if (positions[position]) {
            positions[position].data.push({
                name: player.web_name,
                value: [price, form, ownership],
                ppm,
                isMyPlayer: myTeamPlayerIds.has(player.id),
                isTopPlayer: topPlayerIds.has(player.id),
                playerData: player
            });
        }
    });

    const option = createFormVsPriceChartOptions(positions, isDark, textColor, gridColor);

    if (!echarts) return null;
    const chartInstance = echarts.init(chartContainer);
    if (!chartInstance) return null;

    try {
        chartInstance.setOption(option);
        console.log('Form vs Price chart rendered with', players.length, 'players');
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

function createFormVsPriceChartOptions(positions, isDark, textColor, gridColor) {
    const series = Object.keys(positions).map(pos => ({
        name: positions[pos].name,
        type: 'scatter',
        symbolSize: (data) => Math.max(6, Math.min(50, Math.sqrt(data[2]) * 6)),
        symbol: (value, params) => params.data.isMyPlayer ? 'star' : 'circle',
        itemStyle: {
            color: positions[pos].color,
            opacity: 0.7,
            borderColor: (params) => params.data.isMyPlayer ? '#8b5cf6' : 'transparent',
            borderWidth: (params) => params.data.isMyPlayer ? 3 : 0
        },
        emphasis: { itemStyle: { opacity: 1, borderColor: '#fff', borderWidth: 2 } },
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
                        name: 'Hot Form Value',
                        xAxis: 3,
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
                    { xAxis: 8.5, yAxis: 10 }
                ],
                [
                    {
                        name: 'Premium Form',
                        xAxis: 8.5,
                        yAxis: 5,
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
                    { xAxis: 15, yAxis: 10 }
                ],
                [
                    {
                        name: 'Cold Trap',
                        xAxis: 8.5,
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
                    { xAxis: 15, yAxis: 5 }
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
                const defConLine = getPositionShort(player) !== 'GKP' && player.github_season?.defensive_contribution_per_90
                    ? `Def Con/90: ${player.github_season.defensive_contribution_per_90.toFixed(1)}<br/>`
                    : '';
                return `<div style="padding: 4px;">
                    <strong>${escapeHtml(data.name)}${data.isMyPlayer ? ' ⭐' : ''}</strong><br/>
                    Position: ${getPositionShort(player)}<br/>
                    Price: £${data.value[0].toFixed(1)}m<br/>
                    Form: ${data.value[1].toFixed(1)}<br/>
                    Ownership: ${data.value[2].toFixed(1)}%<br/>
                    PPM: ${data.ppm.toFixed(1)}<br/>
                    ${defConLine}
                </div>`;
            }
        },
        legend: { data: Object.values(positions).map(p => p.name), textStyle: { color: textColor }, top: 10, left: 'center' },
        grid: { left: '8%', right: '5%', bottom: '12%', top: '15%', containLabel: true },
        xAxis: {
            type: 'value',
            name: 'Price (£m)',
            nameLocation: 'middle',
            nameGap: 30,
            nameTextStyle: { color: textColor, fontWeight: 'bold' },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor, formatter: (value) => `£${value.toFixed(1)}` },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed', opacity: 0.3 } },
            min: 3,
            max: 15
        },
        yAxis: {
            type: 'value',
            name: 'Form',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: { color: textColor, fontWeight: 'bold' },
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: { color: textColor },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed', opacity: 0.3 } },
            min: 0,
            max: 10
        },
        series: series
    };
}
