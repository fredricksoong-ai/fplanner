/**
 * Player Performance Trellis Chart
 * Shows weekly points performance for all 15 players in a trellis plot (small multiples)
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
 * Initialize Player Performance Trellis Chart
 * @param {string} containerId - DOM element ID
 * @param {Array} players - Array of 15 player objects
 * @param {number} currentGW - Current gameweek
 * @returns {Promise<Object>} ECharts instance
 */
export async function initializePlayerPerformanceTrellis(containerId, players, currentGW) {
    try {
        if (!players || players.length === 0) {
            console.error('No players provided for trellis chart');
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

        // Theme detection
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e5e7eb' : '#374151';
        const gridColor = isDark ? '#334155' : '#e5e7eb';
        const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';

        // Calculate grid layout: 3 columns × 5 rows (15 players)
        const cols = 3;
        const rows = 5;
        const totalPlayers = validPlayerData.length;
        
        // Responsive: adjust columns for mobile
        const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
        const effectiveCols = isMobile ? 2 : cols;
        const effectiveRows = Math.ceil(totalPlayers / effectiveCols);

        // Grid dimensions (as percentage)
        const gridWidth = 100 / effectiveCols;
        const gridHeight = 100 / effectiveRows;
        
        // Padding between grids
        const gridGap = 1; // 1% gap between charts

        // Create grids for each player
        const grids = [];
        const xAxes = [];
        const yAxes = [];
        const series = [];

        validPlayerData.forEach(({ player, history, avgPPG }, index) => {
        const row = Math.floor(index / effectiveCols);
        const col = index % effectiveCols;
        
        const left = col * gridWidth + gridGap;
        const top = row * gridHeight + 10; // 10% for title
        const width = gridWidth - (2 * gridGap);
        const height = gridHeight - 10 - gridGap; // Leave space for title and gap

        // Create grid for this player
        grids.push({
            left: `${left}%`,
            top: `${top}%`,
            width: `${width}%`,
            height: `${height}%`,
            containLabel: false
        });

        // Create X-axis (only show labels on bottom row)
        const showXAxisLabels = row === effectiveRows - 1;
        xAxes.push({
            gridIndex: index,
            type: 'category',
            data: allGameweeks.map(gw => `GW${gw}`),
            axisLabel: {
                show: showXAxisLabels,
                color: textColor,
                fontSize: 8,
                interval: Math.max(0, Math.floor(allGameweeks.length / 5)) // Show every Nth label
            },
            axisLine: {
                show: showXAxisLabels,
                lineStyle: { color: gridColor, opacity: 0.3 }
            },
            axisTick: {
                show: false
            },
            splitLine: {
                show: false
            }
        });

        // Create Y-axis (shared scale)
        yAxes.push({
            gridIndex: index,
            type: 'value',
            min: 0,
            max: maxScore,
            axisLabel: {
                show: col === 0, // Only show on leftmost column
                color: textColor,
                fontSize: 8
            },
            axisLine: {
                show: false
            },
            axisTick: {
                show: false
            },
            splitLine: {
                show: col === 0, // Only show on leftmost column
                lineStyle: {
                    color: gridColor,
                    type: 'dashed',
                    opacity: 0.2
                }
            }
        });

        // Prepare data for this player
        const pointsData = allGameweeks.map(gw => {
            const entry = history.find(h => h.gameweek === gw);
            return entry ? (entry.gw_points || 0) : null;
        });

        const avgData = allGameweeks.map(gw => {
            const avg = avgPPG.get(gw);
            return avg !== undefined ? avg : null;
        });

        const positionColor = POSITION_COLORS[player.element_type] || '#9E9E9E';
        const position = getPositionShort(player);

        // Main points line series
        series.push({
            name: `${player.web_name} - Points`,
            type: 'line',
            xAxisIndex: index,
            yAxisIndex: index,
            data: pointsData,
            smooth: false,
            symbol: 'circle',
            symbolSize: 4,
            lineStyle: {
                color: positionColor,
                width: 2
            },
            itemStyle: {
                color: positionColor
            },
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

        // Average PPG trend line
        series.push({
            name: `${player.web_name} - Avg PPG`,
            type: 'line',
            xAxisIndex: index,
            yAxisIndex: index,
            data: avgData,
            smooth: false,
            symbol: 'none',
            lineStyle: {
                color: positionColor,
                type: 'dashed',
                width: 1,
                opacity: 0.5
            },
            tooltip: {
                show: false
            },
            z: 5
            });
        });

        // Add player name labels using graphic components positioned absolutely
        const graphics = validPlayerData.map(({ player }, index) => {
            const row = Math.floor(index / effectiveCols);
            const col = index % effectiveCols;
            const position = getPositionShort(player);
            
            // Position label at top-left of each grid
            const labelLeft = col * gridWidth + gridGap + 2;
            const labelTop = row * gridHeight + 2;
            
            return {
                type: 'text',
                left: `${labelLeft}%`,
                top: `${labelTop}%`,
                style: {
                    text: `${player.web_name} - ${position}`,
                    fill: textColor,
                    fontSize: 9,
                    fontWeight: 'bold'
                },
                z: 100
            };
        });

        const option = {
            backgroundColor: 'transparent',
            textStyle: { color: textColor },
            grid: grids,
            xAxis: xAxes,
            yAxis: yAxes,
            series: series,
            graphic: graphics.length > 0 ? graphics : undefined,
            tooltip: {
                trigger: 'item',
                backgroundColor: tooltipBg,
                borderColor: gridColor,
                textStyle: {
                    color: textColor,
                    fontSize: 11
                }
            }
        };

        chart.setOption(option);

        // Handle window resize
        const resizeHandler = () => {
            chart.resize();
        };
        window.addEventListener('resize', resizeHandler);
        chart._resizeHandler = resizeHandler;

        return chart;
    } catch (err) {
        console.error('Failed to initialize player performance trellis chart:', err);
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
