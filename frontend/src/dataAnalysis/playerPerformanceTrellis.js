/**
 * Player Performance Charts
 * Shows weekly points performance for all 15 players in 4 separate charts (one per position)
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

const POSITION_TITLES = {
    1: 'Goalkeepers',
    2: 'Defenders',
    3: 'Midfielders',
    4: 'Forwards'
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
 * Get maximum single-week score across players in a position group
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
 * Group players by position
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
 * Get top and bottom performers from latest gameweek within a position group
 * @param {Array} playerData - Array of {player, history, avgPPG} for a position
 * @param {Array} allGameweeks - Array of gameweek numbers
 * @returns {Object} { topPlayers: Set<playerId>, bottomPlayers: Set<playerId>, latestGW: number }
 */
function getTopBottomPerformersInPosition(playerData, allGameweeks) {
    if (!allGameweeks || allGameweeks.length === 0) {
        return { topPlayers: new Set(), bottomPlayers: new Set(), latestGW: null };
    }
    
    const latestGW = Math.max(...allGameweeks);
    
    // Get points for latest gameweek for each player in this position
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
    
    // Get top 3 and bottom 3 within this position
    const top3 = playerPoints.slice(0, 3).map(p => p.playerId);
    const bottom3 = playerPoints.slice(-3).map(p => p.playerId);
    
    return {
        topPlayers: new Set(top3),
        bottomPlayers: new Set(bottom3),
        latestGW
    };
}

/**
 * Create a single position chart
 * @param {string} containerId - DOM element ID
 * @param {number} posType - Position type (1=GKP, 2=DEF, 3=MID, 4=FWD)
 * @param {Array} playersInPosition - Array of {player, history, avgPPG} for this position
 * @param {Array} allGameweeks - All gameweeks with data
 * @param {number} currentGW - Current gameweek
 * @returns {Promise<Object>} ECharts instance
 */
async function createPositionChart(containerId, posType, playersInPosition, allGameweeks, currentGW) {
    if (!playersInPosition || playersInPosition.length === 0) {
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

    // Get max score for this position group
    const maxScore = getMaxSingleWeekScore(playersInPosition);
    
    // Get top/bottom performers within this position
    const { topPlayers, bottomPlayers, latestGW } = getTopBottomPerformersInPosition(playersInPosition, allGameweeks);

    // Theme detection
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#334155' : '#e5e7eb';
    const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';

    const positionColor = POSITION_COLORS[posType] || '#9E9E9E';
    const positionTitle = POSITION_TITLES[posType] || 'Players';
    const positionName = POSITION_NAMES[posType] || '';

    // Create series array
    const series = [];

    // Add each player's line
    playersInPosition.forEach(({ player, history, avgPPG }, playerIndex) => {
        const position = getPositionShort(player);
        
        // Prepare data for this player
        const pointsData = allGameweeks.map(gw => {
            const entry = history.find(h => h.gameweek === gw);
            return entry ? (entry.gw_points || 0) : null;
        });

        // Check if this player should have a label (within position group)
        const isTopPerformer = topPlayers.has(player.id);
        const isBottomPerformer = bottomPlayers.has(player.id);
        const showLabel = isTopPerformer || isBottomPerformer;
        
        // Find the last data point for label positioning
        let lastDataIndex = pointsData.length - 1;
        while (lastDataIndex >= 0 && pointsData[lastDataIndex] === null) {
            lastDataIndex--;
        }
        
        const lastPoints = lastDataIndex >= 0 ? pointsData[lastDataIndex] : 0;

        // Vary opacity slightly to distinguish players
        const opacity = 0.8 - (playerIndex * 0.1);
        const lineOpacity = Math.max(0.5, opacity);

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
                opacity: lineOpacity
            },
            itemStyle: {
                color: positionColor,
                opacity: lineOpacity
            },
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
            z: 10
        });

        // Average PPG trend line
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
                opacity: Math.max(0.3, lineOpacity * 0.5)
            },
            tooltip: {
                show: false
            },
            z: 5
        });
    });

    // Y-axis padding
    const yAxisPadding = maxScore * 0.1;

    const option = {
        backgroundColor: 'transparent',
        textStyle: { color: textColor },
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
                // Position tooltip to avoid being cut off
                const [x, y] = point;
                const [width, height] = size.viewSize;
                const tooltipWidth = size.contentSize[0];
                const tooltipHeight = size.contentSize[1];
                
                // If tooltip would be cut off on left, position it to the right of cursor
                if (x < tooltipWidth) {
                    return [x + 20, y];
                }
                // If tooltip would be cut off on right, position it to the left
                if (x + tooltipWidth > width) {
                    return [x - tooltipWidth - 20, y];
                }
                // Default: position above cursor
                return [x - tooltipWidth / 2, y - tooltipHeight - 10];
            },
            formatter: function(params) {
                // Axis-based tooltip shows all players at this gameweek
                const firstParam = params[0];
                const idx = firstParam.dataIndex;
                const gw = allGameweeks[idx];
                const gwLabel = `GW${gw}`;
                
                let result = `<strong>${gwLabel}</strong><br/>`;
                
                // Show all players' points for this gameweek
                params.forEach(param => {
                    // Skip average lines in tooltip
                    if (param.seriesName && param.seriesName.endsWith(' - Avg')) {
                        return;
                    }
                    
                    const points = param.value;
                    if (points !== null && points !== undefined) {
                        const player = playersInPosition.find(({ player }) => player.web_name === param.seriesName);
                        if (player) {
                            const oppInfo = getGWOpponent(player.player.team, gw);
                            const venue = oppInfo.isHome ? 'H' : 'A';
                            const position = getPositionShort(player.player);
                            
                            result += `<span style="color: ${positionColor};">●</span> ${param.seriesName} (${position}): <strong>${points}</strong> pts vs ${oppInfo.name} (${venue})<br/>`;
                        }
                    }
                });
                
                return result;
            }
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

    chart.setOption(option);

    // Handle window resize
    const resizeHandler = () => {
        chart.resize();
    };
    window.addEventListener('resize', resizeHandler);
    chart._resizeHandler = resizeHandler;

    return chart;
}

/**
 * Initialize Player Performance Charts (4 separate charts by position)
 * @param {string} baseContainerId - Base container ID prefix
 * @param {Array} players - Array of 15 player objects
 * @param {number} currentGW - Current gameweek
 * @returns {Promise<Object>} Object with chart instances: { gkp: chart, def: chart, mid: chart, fwd: chart }
 */
export async function initializePlayerPerformanceTrellis(baseContainerId, players, currentGW) {
    try {
        if (!players || players.length === 0) {
            console.error('No players provided for player performance charts');
            return null;
        }

        // Prepare player data
        const playerData = await preparePlayerHistoryData(players);
        
        // Filter out players with no history
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

        // Group players by position
        const groupedPlayers = groupPlayersByPosition(validPlayerData);

        // Create charts for each position
        const chartInstances = {};

        // GKP Chart
        if (groupedPlayers[1] && groupedPlayers[1].length > 0) {
            chartInstances.gkp = await createPositionChart(
                `${baseContainerId}-gkp`,
                1,
                groupedPlayers[1],
                allGameweeks,
                currentGW
            );
        }

        // DEF Chart
        if (groupedPlayers[2] && groupedPlayers[2].length > 0) {
            chartInstances.def = await createPositionChart(
                `${baseContainerId}-def`,
                2,
                groupedPlayers[2],
                allGameweeks,
                currentGW
            );
        }

        // MID Chart
        if (groupedPlayers[3] && groupedPlayers[3].length > 0) {
            chartInstances.mid = await createPositionChart(
                `${baseContainerId}-mid`,
                3,
                groupedPlayers[3],
                allGameweeks,
                currentGW
            );
        }

        // FWD Chart
        if (groupedPlayers[4] && groupedPlayers[4].length > 0) {
            chartInstances.fwd = await createPositionChart(
                `${baseContainerId}-fwd`,
                4,
                groupedPlayers[4],
                allGameweeks,
                currentGW
            );
        }

        return chartInstances;
    } catch (err) {
        console.error('Failed to initialize player performance charts:', err);
        return null;
    }
}

/**
 * Cleanup chart instances
 */
export function disposePlayerPerformanceTrellis(chartInstances) {
    if (!chartInstances) return;
    
    Object.values(chartInstances).forEach(chart => {
        if (chart && chart._resizeHandler) {
            window.removeEventListener('resize', chart._resizeHandler);
            delete chart._resizeHandler;
        }
        if (chart) {
            chart.dispose();
        }
    });
}