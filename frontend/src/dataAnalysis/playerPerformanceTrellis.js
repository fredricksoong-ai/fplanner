/**
 * Player Performance Chart
 * Shows weekly points performance for all 15 players in a single chart with position-based legend
 */

import { loadECharts } from '../charts/chartHelpers.js';
import { getGWOpponent } from '../fixtures.js';
import { getCurrentGW } from '../utils.js';
import { getPositionShort } from '../utils.js';

// Position colors matching chartHelpers.js
const POSITION_COLORS = {
    1: '#FFC107', // GKP - Yellow
    2: '#00BCD4', // DEF - Cyan/Blue
    3: '#4CAF50', // MID - Green
    4: '#F44336'  // FWD - Red
};

const POSITION_NAMES = {
    1: 'GKP',
    2: 'DEF',
    3: 'MID',
    4: 'FWD'
};

/**
 * Fetch player history data
 * @param {number} playerId - Player ID
 * @returns {Promise<Object|null>} Player history data or null if error
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
 * Calculate running average PPG from GW_1
 * @param {Array} playerHistory - Array of {gameweek, gw_points, ...}
 * @param {number} currentGW - Current gameweek
 * @returns {Map<number, number>} Map of gameweek -> average PPG so far
 */
function calculateAveragePPG(playerHistory, currentGW) {
    const avgMap = new Map();
    if (!playerHistory || playerHistory.length === 0) return avgMap;

    // Sort by gameweek
    const sorted = [...playerHistory].sort((a, b) => a.gameweek - b.gameweek);
    
    let cumulativePoints = 0;
    let gameweeksPlayed = 0;

    for (const entry of sorted) {
        if (entry.gameweek > currentGW) break;
        
        const points = entry.gw_points || 0;
        cumulativePoints += points;
        gameweeksPlayed++;
        
        if (gameweeksPlayed > 0) {
            const avg = cumulativePoints / gameweeksPlayed;
            avgMap.set(entry.gameweek, avg);
        }
    }

    return avgMap;
}

/**
 * Prepare player history data for all players
 * @param {Array} players - Array of player objects
 * @returns {Promise<Array>} Array of {player, history, avgPPG} objects
 */
async function preparePlayerHistoryData(players) {
    const currentGW = getCurrentGW();
    
    // Fetch all player histories in parallel
    const promises = players.map(async (player) => {
        const history = await fetchPlayerHistory(player.id);
        const avgPPG = history ? calculateAveragePPG(history, currentGW) : new Map();
        return {
            player,
            history: history || [],
            avgPPG
        };
    });

    return Promise.all(promises);
}

/**
 * Get all gameweeks that have data across all players
 * @param {Array} playerData - Array of {player, history, avgPPG}
 * @param {number} currentGW - Current gameweek
 * @returns {Array<number>} Sorted array of gameweek numbers
 */
function getAllGameweeks(playerData, currentGW) {
    const gwSet = new Set();
    
    for (const { history } of playerData) {
        if (!history) continue;
        for (const entry of history) {
            if (entry.gameweek && entry.gameweek <= currentGW) {
                gwSet.add(entry.gameweek);
            }
        }
    }

    return Array.from(gwSet).sort((a, b) => a - b);
}

/**
 * Get maximum single-week score across all players
 * @param {Array} playerData - Array of {player, history, avgPPG}
 * @returns {number} Maximum points in a single gameweek
 */
function getMaxSingleWeekScore(playerData) {
    let max = 0;
    
    for (const { history } of playerData) {
        if (!history) continue;
        for (const entry of history) {
            const points = entry.gw_points || 0;
            if (points > max) {
                max = points;
            }
        }
    }

    // Round up to nearest 5, with minimum of 10
    return Math.max(10, Math.ceil(max / 5) * 5);
}

/**
 * Group players by position for legend
 * @param {Array} playerData - Array of {player, history, avgPPG}
 * @returns {Object} Grouped by position: { 1: [...], 2: [...], etc. }
 */
function groupPlayersByPosition(playerData) {
    const grouped = { 1: [], 2: [], 3: [], 4: [] };
    
    playerData.forEach(({ player, history, avgPPG }) => {
        const posType = player.element_type;
        if (grouped[posType]) {
            grouped[posType].push({ player, history, avgPPG });
        }
    });
    
    return grouped;
}

/**
 * Get top and bottom performers from latest gameweek
 * @param {Array} playerData - Array of {player, history, avgPPG}
 * @param {Array} allGameweeks - Array of gameweek numbers
 * @returns {Object} { topPlayers: Set<playerId>, bottomPlayers: Set<playerId>, latestGW: number }
 */
function getTopBottomPerformers(playerData, allGameweeks) {
    if (!allGameweeks || allGameweeks.length === 0) {
        return { topPlayers: new Set(), bottomPlayers: new Set(), latestGW: null };
    }
    
    const latestGW = Math.max(...allGameweeks);
    
    // Get points for latest gameweek for each player
    const playerPoints = playerData
        .map(({ player, history }) => {
            const entry = history.find(h => h.gameweek === latestGW);
            return {
                playerId: player.id,
                player,
                points: entry ? (entry.gw_points || 0) : 0,
                playerName: player.web_name
            };
        })
        .filter(p => p.points >= 0); // Include all players (even 0 points)
    
    if (playerPoints.length === 0) {
        return { topPlayers: new Set(), bottomPlayers: new Set(), latestGW };
    }
    
    // Sort by points (descending)
    playerPoints.sort((a, b) => b.points - a.points);
    
    // Get top 3 and bottom 3 (handle duplicates at boundaries)
    const top3 = playerPoints.slice(0, 3).map(p => p.playerId);
    const bottom3 = playerPoints.slice(-3).map(p => p.playerId);
    
    return {
        topPlayers: new Set(top3),
        bottomPlayers: new Set(bottom3),
        latestGW
    };
}

/**
 * Initialize Player Performance Chart (Single Chart)
 * @param {string} containerId - DOM element ID
 * @param {Array} players - Array of 15 player objects
 * @param {number} currentGW - Current gameweek
 * @returns {Promise<Object>} ECharts instance
 */
export async function initializePlayerPerformanceTrellis(containerId, players, currentGW) {
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

        const chart = echarts.init(chartDom);

        // Prepare player data
        const playerData = await preparePlayerHistoryData(players);
        
        // Filter out players with no history
        const validPlayerData = playerData.filter(pd => pd.history && pd.history.length > 0);
        
        if (validPlayerData.length === 0) {
            // Show empty state message
            chart.setOption({
                graphic: [{
                    type: 'text',
                    left: 'center',
                    top: 'center',
                    style: {
                        text: 'No player history data available',
                        fill: '#64748b',
                        fontSize: 14
                    }
                }]
            });
            return chart;
        }

        // Get all gameweeks and max score
        const allGameweeks = getAllGameweeks(validPlayerData, currentGW);
        const maxScore = getMaxSingleWeekScore(validPlayerData);

        // Identify top 3 and bottom 3 performers from latest gameweek
        const { topPlayers, bottomPlayers, latestGW } = getTopBottomPerformers(validPlayerData, allGameweeks);

        // Theme detection
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e5e7eb' : '#374151';
        const gridColor = isDark ? '#334155' : '#e5e7eb';
        const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';

        // Group players by position
        const groupedPlayers = groupPlayersByPosition(validPlayerData);
        
        // Create series array - one line per player
        const series = [];
        const legendData = [];
        
        // Process each position group
        [1, 2, 3, 4].forEach(posType => {
            const playersInPosition = groupedPlayers[posType] || [];
            if (playersInPosition.length === 0) return;
            
            const positionName = POSITION_NAMES[posType];
            const positionColor = POSITION_COLORS[posType];
            
            // Add position to legend
            legendData.push(positionName);
            
            // Add each player's line
            playersInPosition.forEach(({ player, history, avgPPG }) => {
                const position = getPositionShort(player);
                
                // Prepare data for this player
                const pointsData = allGameweeks.map(gw => {
                    const entry = history.find(h => h.gameweek === gw);
                    return entry ? (entry.gw_points || 0) : null;
                });

                // Check if this player should have a label
                const isTopPerformer = topPlayers.has(player.id);
                const isBottomPerformer = bottomPlayers.has(player.id);
                const showLabel = isTopPerformer || isBottomPerformer;
                
                // Find the last data point for label positioning
                let lastDataIndex = pointsData.length - 1;
                while (lastDataIndex >= 0 && pointsData[lastDataIndex] === null) {
                    lastDataIndex--;
                }
                
                const lastPoints = lastDataIndex >= 0 ? pointsData[lastDataIndex] : 0;

                // Main points line series
                series.push({
                    name: player.web_name,
                    type: 'line',
                    data: pointsData,
                    smooth: false,
                    symbol: 'circle',
                    symbolSize: 5,
                    lineStyle: {
                        color: positionColor,
                        width: 2,
                        opacity: 0.8
                    },
                    itemStyle: {
                        color: positionColor
                    },
                    // Don't show in legend - we'll use position-based legend
                    showInLegend: false,
                    // Add markPoint for top/bottom performers at last gameweek
                    markPoint: (showLabel && lastDataIndex >= 0 && latestGW) ? {
                        symbol: 'none',
                        label: {
                            show: true,
                            formatter: player.web_name,
                            fontSize: 10,
                            fontWeight: 'bold',
                            color: positionColor,
                            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                            padding: [4, 8],
                            borderRadius: 4,
                            borderColor: positionColor,
                            borderWidth: 1.5,
                            position: isTopPerformer ? 'top' : 'bottom',
                            offset: isTopPerformer ? [0, -10] : [0, 10]
                        },
                        data: [{
                            name: 'Latest',
                            coord: [lastDataIndex, lastPoints],
                            value: lastPoints
                        }],
                        tooltip: {
                            show: false
                        }
                    } : undefined,
                    tooltip: {
                        trigger: 'item',
                        formatter: function(params) {
                            const gwIndex = params.dataIndex;
                            const gw = allGameweeks[gwIndex];
                            const points = params.value;
                            const oppInfo = getGWOpponent(player.team, gw);
                            const venue = oppInfo.isHome ? 'H' : 'A';
                            
                            return `
                                <div style="padding: 4px;">
                                    <strong>${player.web_name} (${position})</strong><br/>
                                    GW${gw}: <strong>${points}</strong> pts<br/>
                                    vs ${oppInfo.name} (${venue})
                                </div>
                            `;
                        },
                        backgroundColor: tooltipBg,
                        borderColor: gridColor,
                        textStyle: { color: textColor, fontSize: 11 }
                    },
                    z: 10
                });

                // Average PPG trend line (hidden from legend, no labels)
                const avgData = allGameweeks.map(gw => {
                    const avg = avgPPG.get(gw);
                    return avg !== undefined ? avg : null;
                });

                series.push({
                    name: `${player.web_name} - Avg`,
                    type: 'line',
                    data: avgData,
                    smooth: false,
                    symbol: 'none',
                    lineStyle: {
                        color: positionColor,
                        type: 'dashed',
                        width: 1,
                        opacity: 0.4
                    },
                    tooltip: {
                        show: false
                    },
                    label: {
                        show: false
                    },
                    z: 5,
                    showInLegend: false,
                    legendHoverLink: false
                });
            });
        });

        // Y-axis padding
        const yAxisPadding = maxScore * 0.1;

        // Build position to players mapping for legend click handling
        const positionToPlayersMap = new Map();
        [1, 2, 3, 4].forEach(posType => {
            const playersInPosition = groupedPlayers[posType] || [];
            const playerNames = playersInPosition.map(({ player }) => ({
                name: player.web_name,
                avgName: `${player.web_name} - Avg`
            }));
            positionToPlayersMap.set(POSITION_NAMES[posType], playerNames);
        });

        // Create dummy series for position legend (one per position for legend display)
        const positionLegendSeries = legendData.map(posName => {
            const posType = Object.keys(POSITION_NAMES).find(k => POSITION_NAMES[k] === posName);
            const positionColor = POSITION_COLORS[posType] || '#9E9E9E';
            
            return {
                name: posName,
                type: 'line',
                data: [],
                lineStyle: {
                    color: positionColor,
                    width: 0
                },
                itemStyle: {
                    color: positionColor
                },
                symbol: 'none',
                // This series only exists for legend display
                silent: true
            };
        });

        // Add position legend series to series array (at the end)
        series.push(...positionLegendSeries);

        const option = {
            backgroundColor: 'transparent',
            textStyle: { color: textColor },
            grid: {
                left: '8%',
                right: '5%',
                bottom: '12%',
                top: '15%',
                containLabel: true
            },
            legend: {
                data: legendData,
                selectedMode: 'multiple',
                top: 5,
                left: 'center',
                textStyle: {
                    color: textColor,
                    fontSize: 12
                },
                icon: 'roundRect',
                itemWidth: 20,
                itemHeight: 3,
                itemGap: 15,
                formatter: function(name) {
                    // Show position name with count of players
                    const posType = Object.keys(POSITION_NAMES).find(k => POSITION_NAMES[k] === name);
                    if (posType) {
                        const count = groupedPlayers[posType]?.length || 0;
                        return `${name} (${count})`;
                    }
                    return name;
                }
            },
            tooltip: {
                trigger: 'item',
                backgroundColor: tooltipBg,
                borderColor: gridColor,
                textStyle: {
                    color: textColor,
                    fontSize: 11
                }
            },
            xAxis: {
                type: 'category',
                data: allGameweeks.map(gw => `GW${gw}`),
                axisLabel: {
                    color: textColor,
                    fontSize: 10,
                    interval: Math.max(0, Math.floor(allGameweeks.length / 10)) // Show every Nth label
                },
                axisLine: {
                    lineStyle: { color: gridColor, opacity: 0.3 }
                },
                axisTick: {
                    show: false
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
                name: 'Points',
                nameLocation: 'middle',
                nameGap: 50,
                nameTextStyle: {
                    color: textColor,
                    fontWeight: 'bold'
                },
                min: 0,
                max: maxScore + yAxisPadding,
                axisLabel: {
                    color: textColor,
                    fontSize: 10
                },
                axisLine: {
                    show: false
                },
                axisTick: {
                    show: false
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
            series: series
        };

        chart.setOption(option);

        // Handle legend click to show/hide positions
        chart.on('legendselectchanged', function(params) {
            const selected = params.selected;
            
            // Prevent default behavior for position legend items by blocking the event
            // and manually handling visibility
            
            // For each position, toggle all players in that position
            legendData.forEach((posName) => {
                const isPositionSelected = selected[posName] !== false;
                const playersInPosition = positionToPlayersMap.get(posName) || [];
                
                // Toggle each player series in this position
                playersInPosition.forEach(({ name, avgName }) => {
                    // Toggle visibility using ECharts actions
                    if (isPositionSelected) {
                        // Show the series
                        chart.dispatchAction({
                            type: 'legendSelect',
                            name: name
                        });
                        chart.dispatchAction({
                            type: 'legendSelect',
                            name: avgName
                        });
                    } else {
                        // Hide the series
                        chart.dispatchAction({
                            type: 'legendUnSelect',
                            name: name
                        });
                        chart.dispatchAction({
                            type: 'legendUnSelect',
                            name: avgName
                        });
                    }
                });
            });
        });

        // Handle window resize
        const resizeHandler = () => {
            chart.resize();
        };
        window.addEventListener('resize', resizeHandler);
        chart._resizeHandler = resizeHandler;

        return chart;
    } catch (err) {
        console.error('Failed to initialize player performance chart:', err);
        const chartDom = document.getElementById(containerId);
        if (chartDom) {
            chartDom.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Error loading chart. Please try again.</div>';
        }
        return null;
    }
}

/**
 * Cleanup chart instance
 */
export function disposePlayerPerformanceTrellis(chart) {
    if (!chart) return;
    if (chart._resizeHandler) {
        window.removeEventListener('resize', chart._resizeHandler);
        delete chart._resizeHandler;
    }
    chart.dispose();
}