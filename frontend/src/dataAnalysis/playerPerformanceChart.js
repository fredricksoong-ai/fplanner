/**
 * Player Performance Chart
 * Simple chart showing weekly points for all players in the team
 */

import { loadECharts } from '../charts/chartHelpers.js';
import { getGWOpponent } from '../fixtures.js';
import { getCurrentGW, getPositionShort } from '../utils.js';

// Position colors
const POSITION_COLORS = {
    1: '#FFC107', // GKP - Yellow
    2: '#00BCD4', // DEF - Cyan/Blue
    3: '#4CAF50', // MID - Green
    4: '#F44336'  // FWD - Red
};

/**
 * Fetch player history data
 * @param {number} playerId - Player ID
 * @returns {Promise<Array|null>} Player history array or null if error
 */
async function fetchPlayerHistory(playerId) {
    try {
        const response = await fetch(`/api/history/player/${playerId}/ownership`);
        if (!response.ok) {
            console.warn(`Failed to fetch history for player ${playerId}`);
            return null;
        }
        const data = await response.json();
        return data.gameweeks || [];
    } catch (err) {
        console.error(`Error fetching history for player ${playerId}:`, err);
        return null;
    }
}

/**
 * Prepare player history data for all players
 * @param {Array} players - Array of player objects
 * @returns {Promise<Array>} Array of {player, history} objects
 */
async function preparePlayerHistoryData(players) {
    const promises = players.map(async (player) => {
        const history = await fetchPlayerHistory(player.id);
        return {
            player,
            history: history || []
        };
    });
    
    return Promise.all(promises);
}

/**
 * Get all unique gameweeks from player data
 * @param {Array} playerData - Array of {player, history} objects
 * @param {number} currentGW - Current gameweek
 * @returns {Array} Sorted array of gameweek numbers
 */
function getAllGameweeks(playerData, currentGW) {
    const gameweeksSet = new Set();
    
    playerData.forEach(({ history }) => {
        if (history && history.length > 0) {
            history.forEach(entry => {
                if (entry.gameweek && entry.gameweek <= currentGW) {
                    gameweeksSet.add(entry.gameweek);
                }
            });
        }
    });
    
    return Array.from(gameweeksSet).sort((a, b) => a - b);
}

/**
 * Get maximum single week score for Y-axis scaling
 * @param {Array} playerData - Array of {player, history} objects
 * @returns {number} Maximum points scored in a single gameweek
 */
function getMaxSingleWeekScore(playerData) {
    let maxScore = 15; // Default minimum
    
    playerData.forEach(({ history }) => {
        if (history && history.length > 0) {
            history.forEach(entry => {
                const points = entry.gw_points || 0;
                if (points > maxScore) {
                    maxScore = points;
                }
            });
        }
    });
    
    return Math.max(maxScore, 15); // At least 15 for readability
}

/**
 * Create and render the player performance chart
 * @param {string} containerId - DOM element ID
 * @param {Array} players - Array of player objects
 * @param {number} currentGW - Current gameweek
 * @returns {Promise<Object>} ECharts instance
 */
export async function initializePlayerPerformanceChart(containerId, players, currentGW) {
    try {
        if (!players || players.length === 0) {
            console.error('No players provided for player performance chart');
            return null;
        }

        const echarts = await loadECharts();
        const chartDom = document.getElementById(containerId);

        if (!chartDom) {
            console.error(`Chart container #${containerId} not found`);
            return null;
        }

        // Dispose existing chart if any
        const existingChart = echarts.getInstanceByDom(chartDom);
        if (existingChart) {
            existingChart.dispose();
        }

        // Prepare player data
        const playerData = await preparePlayerHistoryData(players);
        const validPlayerData = playerData.filter(pd => pd.history && pd.history.length > 0);
        
        if (validPlayerData.length === 0) {
            console.warn('No player history data available');
            return null;
        }

        // Get all gameweeks
        const allGameweeks = getAllGameweeks(validPlayerData, currentGW);
        
        if (allGameweeks.length === 0) {
            console.warn('No gameweek data available');
            return null;
        }

        // Get max score for Y-axis
        const maxScore = getMaxSingleWeekScore(validPlayerData);
        const yAxisPadding = Math.ceil(maxScore * 0.1);

        // Theme detection
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e5e7eb' : '#374151';
        const gridColor = isDark ? '#334155' : '#e5e7eb';
        const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';

        // Create series for each player
        const series = validPlayerData.map(({ player, history }) => {
            const positionColor = POSITION_COLORS[player.element_type] || '#9E9E9E';
            const position = getPositionShort(player);
            
            // Prepare data points
            const pointsData = allGameweeks.map(gw => {
                const entry = history.find(h => h.gameweek === gw);
                return entry ? (entry.gw_points || 0) : null;
            });

            return {
                name: player.web_name,
                type: 'line',
                data: pointsData,
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                lineStyle: {
                    color: positionColor,
                    width: 2
                },
                itemStyle: {
                    color: positionColor
                },
                emphasis: {
                    focus: 'series',
                    lineStyle: {
                        width: 3
                    }
                }
            };
        });

        // Chart configuration
        const option = {
            grid: {
                left: '10%',
                right: '8%',
                top: '18%',
                bottom: '12%',
                containLabel: false
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: tooltipBg,
                borderColor: gridColor,
                textStyle: {
                    color: textColor,
                    fontSize: 12
                },
                confine: true,
                position: function(point, params, dom, rect, size) {
                    const [x, y] = point;
                    const [width, height] = size.viewSize;
                    const tooltipWidth = size.contentSize[0];
                    const tooltipHeight = size.contentSize[1];
                    
                    if (x < tooltipWidth) {
                        return [x + 20, y];
                    }
                    if (x + tooltipWidth > width) {
                        return [x - tooltipWidth - 20, y];
                    }
                    return [x - tooltipWidth / 2, y - tooltipHeight - 10];
                },
                formatter: function(params) {
                    const firstParam = params[0];
                    const idx = firstParam.dataIndex;
                    const gw = allGameweeks[idx];
                    const gwLabel = `GW${gw}`;
                    
                    let result = `<strong>${gwLabel}</strong><br/>`;
                    
                    params.forEach(param => {
                        const points = param.value;
                        if (points !== null && points !== undefined) {
                            const player = validPlayerData.find(({ player }) => player.web_name === param.seriesName);
                            if (player) {
                                const oppInfo = getGWOpponent(player.player.team, gw);
                                const venue = oppInfo.isHome ? 'H' : 'A';
                                const position = getPositionShort(player.player);
                                const positionColor = POSITION_COLORS[player.player.element_type] || '#9E9E9E';
                                
                                result += `<span style="color: ${positionColor};">●</span> ${param.seriesName} (${position}): <strong>${points}</strong> pts vs ${oppInfo.name} (${venue})<br/>`;
                            }
                        }
                    });
                    
                    return result;
                }
            },
            legend: {
                show: false // Hide legend for now - too many players
            },
            xAxis: {
                type: 'category',
                data: allGameweeks.map(gw => `GW${gw}`),
                axisLabel: {
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: 11,
                    interval: Math.max(0, Math.floor(allGameweeks.length / 10))
                },
                axisLine: {
                    lineStyle: {
                        color: gridColor
                    }
                },
                axisTick: {
                    show: true,
                    alignWithLabel: true,
                    lineStyle: {
                        color: gridColor,
                        opacity: 0.3
                    },
                    length: 4
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: gridColor,
                        type: 'dashed',
                        opacity: 0.2
                    }
                }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: maxScore + yAxisPadding,
                axisLabel: {
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: 11,
                    formatter: '{value}'
                },
                splitLine: {
                    lineStyle: {
                        color: gridColor,
                        type: 'dashed',
                        opacity: 0.2
                    }
                },
                axisLine: {
                    show: false
                },
                axisTick: {
                    show: false
                }
            },
            series: series
        };

        const chart = echarts.init(chartDom);
        chart.setOption(option);

        // Handle window resize
        const resizeHandler = () => {
            chart.resize();
        };
        window.addEventListener('resize', resizeHandler);
        chart._resizeHandler = resizeHandler;

        return chart;
    } catch (err) {
        console.error('Failed to initialize player performance chart:', err);
        return null;
    }
}

/**
 * Cleanup chart instance
 * @param {Object} chartInstance - ECharts instance
 */
export function disposePlayerPerformanceChart(chartInstance) {
    if (!chartInstance) return;
    
    // Remove resize listener
    if (chartInstance._resizeHandler) {
        window.removeEventListener('resize', chartInstance._resizeHandler);
    }
    
    chartInstance.dispose();
}

