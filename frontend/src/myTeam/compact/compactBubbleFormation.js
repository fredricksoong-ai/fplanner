// ============================================================================
// COMPACT BUBBLE FORMATION RENDERER
// Football formation visualization with packed bubbles
// ============================================================================

import { getPlayerById, getActiveGW } from '../../data.js';
import { getPositionShort, escapeHtml } from '../../utils.js';
import { getGWOpponent } from '../../fixtures.js';
import { calculateGWPointsBreakdown, showPlayerModal } from './playerModal.js';

let echarts = null; // Lazy-loaded ECharts instance
let currentChart = null; // Current chart instance for cleanup

/**
 * Get points color and text color based on GW points and minutes
 * Uses heatmap colors matching player table badges for consistency
 * @param {number} gwPoints - GW points
 * @param {number} minutes - Minutes played
 * @returns {Object} Object with bgColor and textColor
 */
function getPointsColors(gwPoints, minutes) {
    // Check if dark mode
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Grey for players who haven't played yet (0 pts and 0 minutes)
    if (gwPoints === 0 && minutes <= 0) {
        if (isDark) {
            return {
                bgColor: '#3a3530', // Darker grey background for better visibility
                textColor: '#d4d0c8' // Lighter text for readability
            };
        } else {
            return {
                bgColor: '#e4e1e4', // Light grey background
                textColor: '#52505a' // Dark grey text
            };
        }
    }
    
    // Use heatmap colors matching player table badges
    if (gwPoints >= 14) {
        // Purple - excellent (14+) - matching league page purple
        if (isDark) {
            return {
                bgColor: '#6b2d8b', // Rich purple background
                textColor: '#e9d5ff' // Light purple text
            };
        } else {
            return {
                bgColor: '#9333ea', // Purple background
                textColor: '#faf5ff' // Very light purple/white text
            };
        }
    }
    
    if (gwPoints >= 9) {
        // Green - good (9-13) - using dark green heatmap
        if (isDark) {
            return {
                bgColor: '#2e4a3a', // Dark green background (heat-dark-green-bg)
                textColor: '#a8e8b8' // Light green text (heat-dark-green-text)
            };
        } else {
            return {
                bgColor: '#bbf7d0', // Light green background (heat-dark-green-bg)
                textColor: '#14532d' // Dark green text (heat-dark-green-text)
            };
        }
    }
    
    if (gwPoints >= 4) {
        // Yellow - average (4-8) - using yellow heatmap
        if (isDark) {
            return {
                bgColor: '#4a3f28', // Dark yellow background (heat-yellow-bg)
                textColor: '#e8cf88' // Light yellow text (heat-yellow-text)
            };
        } else {
            return {
                bgColor: '#fef9c3', // Light yellow background (heat-yellow-bg)
                textColor: '#854d0e' // Dark yellow text (heat-yellow-text)
            };
        }
    }
    
    // Red - poor (0-3) - using red heatmap
    if (isDark) {
        return {
            bgColor: '#4a2828', // Dark red background (heat-red-bg)
            textColor: '#e89999' // Light red text (heat-red-text)
        };
    } else {
        return {
            bgColor: '#fee2e2', // Light red background (heat-red-bg)
            textColor: '#991b1b' // Dark red text (heat-red-text)
        };
    }
}

/**
 * Calculate bubble size based on ownership (inverted)
 * @param {number} ownership - Ownership percentage
 * @returns {number} Bubble size in pixels
 */
function calculateBubbleSize(ownership) {
    const minSize = 30;
    const maxSize = 70;
    // Inverse: lower ownership = bigger bubble
    const size = maxSize - (ownership / 100) * (maxSize - minSize);
    return Math.max(minSize, Math.min(maxSize, size));
}

/**
 * Get font size based on bubble size
 * @param {number} bubbleSize - Bubble size
 * @returns {number} Font size
 */
function getFontSize(bubbleSize) {
    if (bubbleSize >= 60) return 10;
    if (bubbleSize >= 50) return 9;
    if (bubbleSize >= 40) return 8;
    return 7;
}

/**
 * Format GW stats breakdown for tooltip (matching player modal format)
 * @param {Object} player - Player object
 * @param {Object} liveStats - Live stats
 * @param {Object} gwStats - GW stats
 * @param {number} gwPoints - GW points
 * @param {number} minutes - Minutes played
 * @param {number} bps - BPS
 * @param {string} xG - Expected goals
 * @param {string} xA - Expected assists
 * @returns {string} Formatted HTML for stats
 */
function formatGWStatsForTooltip(player, liveStats, gwStats, gwPoints, minutes, bps, xG, xA) {
    const pointsBreakdown = calculateGWPointsBreakdown(player, liveStats, gwStats);
    const breakdownItems = Object.entries(pointsBreakdown);
    
    let html = '';
    
    // Points breakdown
    if (breakdownItems.length > 0) {
        breakdownItems.forEach(([key, item]) => {
            const isPositive = item.points > 0;
            const pointColor = isPositive ? '#22c55e' : '#ef4444';
            const prefix = isPositive ? '+' : '';
            
            html += `<div style="display: flex; justify-content: space-between; font-size: 0.65rem;">
                <span style="color: var(--text-secondary);">${item.label}</span>
                <span style="color: ${pointColor}; font-weight: 600;">${prefix}${item.points}</span>
            </div>`;
        });
    } else {
        html += `<div style="color: var(--text-secondary); font-size: 0.6rem;">No stats available yet</div>`;
    }
    
    // Supporting stats (minutes, BPS, xG/xA)
    if (minutes > 0 || bps > 0 || parseFloat(xG) > 0 || parseFloat(xA) > 0) {
        html += `<div style="margin-top: 0.25rem; padding-top: 0.25rem; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.6rem; color: var(--text-secondary);">`;
        
        if (minutes > 0) {
            html += `<div style="display: flex; justify-content: space-between;">
                <span>Minutes</span>
                <span style="font-weight: 500;">${minutes}</span>
            </div>`;
        }
        
        if (bps > 0) {
            html += `<div style="display: flex; justify-content: space-between;">
                <span>BPS</span>
                <span style="font-weight: 500;">${bps}</span>
            </div>`;
        }
        
        if (parseFloat(xG) > 0 || parseFloat(xA) > 0) {
            html += `<div style="display: flex; justify-content: space-between;">
                <span>xG/xA</span>
                <span style="font-weight: 500;">${xG}/${xA}</span>
            </div>`;
        }
        
        html += `</div>`;
    }
    
    return html;
}

/**
 * Render opponent badge for tooltip (matching player table style)
 * @param {Object} opponent - Opponent object from getGWOpponent
 * @returns {string} HTML for opponent badge
 */
function renderOpponentBadgeForTooltip(opponent) {
    const difficulty = opponent.difficulty || 3;
    
    // Map difficulty to colors (matching CSS classes)
    const difficultyStyles = {
        1: { bg: '#14532d', color: 'white' },      // Dark green
        2: { bg: '#bbf7d0', color: '#14532d' },    // Light green
        3: { bg: '#d1d5db', color: '#374151' },    // Gray
        4: { bg: '#fca5a5', color: '#991b1b' },    // Light red
        5: { bg: '#991b1b', color: 'white' }       // Dark red
    };
    
    const style = difficultyStyles[difficulty] || difficultyStyles[3];
    const opponentText = `${opponent.name} (${opponent.isHome ? 'H' : 'A'})`;
    
    return `<span style="
        background-color: ${style.bg};
        color: ${style.color};
        padding: 0.08rem 0.25rem;
        border-radius: 0.25rem;
        font-weight: 600;
        font-size: 0.6rem;
        display: inline-block;
        text-align: center;
        min-width: 3rem;
    ">${escapeHtml(opponentText)}</span>`;
}

/**
 * Pack circles in a row (touching each other - NO gaps)
 * Centers the row so that the middle bubble(s) align with x=50 across all rows
 * @param {Array} circles - Array of circle objects with radius
 * @param {number} rowWidth - Row width in percentage
 * @param {number} rowCenterY - Row center Y position
 * @returns {Array} Circles with x, y positions
 */
function packCirclesInRow(circles, rowWidth, rowCenterY) {
    const totalDiameter = circles.reduce((sum, c) => sum + c.radius * 2, 0);
    const availableWidth = rowWidth * 0.95;
    
    let scale = 1;
    if (totalDiameter > availableWidth) {
        scale = availableWidth / totalDiameter;
    }
    
    // Calculate total width after scaling
    const scaledTotalWidth = totalDiameter * scale;
    
    // Center point is always at x = 50 (middle of container)
    const centerX = 50;
    
    // For odd number of bubbles: center the middle bubble at x=50
    // For even number of bubbles: center the touch point between the two middle bubbles at x=50
    const numCircles = circles.length;
    const isOdd = numCircles % 2 === 1;
    
    let startX;
    if (isOdd) {
        // Odd (1, 3, 5 bubbles): center the middle bubble at centerX
        const middleIndex = Math.floor(numCircles / 2);
        let xOffset = 0;
        
        // Calculate offset to position middle bubble's center at centerX
        for (let i = 0; i < middleIndex; i++) {
            xOffset += circles[i].radius * 2 * scale;
        }
        // Add half the middle bubble's diameter to get to its center
        xOffset += circles[middleIndex].radius * scale;
        
        startX = centerX - xOffset;
    } else {
        // Even (2, 4 bubbles): center the touch point between the two middle bubbles at centerX
        const leftMiddleIndex = numCircles / 2 - 1;
        let xOffset = 0;
        
        // Calculate offset to position the right edge of left middle bubble at centerX
        // (This is where it touches the right middle bubble)
        for (let i = 0; i <= leftMiddleIndex; i++) {
            xOffset += circles[i].radius * 2 * scale;
        }
        
        startX = centerX - xOffset;
    }
    
    // Position all bubbles starting from startX
    let currentX = startX;
    circles.forEach(circle => {
        const scaledRadius = circle.radius * scale;
        circle.x = currentX + scaledRadius;
        circle.y = rowCenterY;
        currentX += scaledRadius * 2; // No spacing - bubbles touch
    });
    
    return circles;
}

/**
 * Render bubble formation chart HTML container
 * @param {Array} players - Player picks array
 * @param {number} gwNumber - Gameweek number
 * @param {boolean} isLive - Whether gameweek is live
 * @returns {string} HTML for bubble formation section
 */
export async function renderCompactBubbleFormation(players, gwNumber, isLive, myTeamState = null) {
    // Filter to starting 11 only (positions 1-11)
    const starters = players.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
    
    if (starters.length === 0) {
        return '';
    }

    return `
        <div style="
            background: linear-gradient(135deg, 
                rgba(30, 30, 30, 0.95) 0%, 
                rgba(20, 20, 25, 0.98) 50%,
                rgba(25, 25, 30, 0.95) 100%
            );
            border-radius: 0.75rem;
            padding-top: 0px !important;
            padding-right: 1rem;
            padding-bottom: 4px !important;
            padding-left: 1rem;
            margin-bottom: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 
                0 4px 6px -1px rgba(0, 0, 0, 0.3),
                0 2px 4px -1px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
            position: relative;
            overflow: hidden;
        ">
            <!-- Subtle pattern overlay -->
            <div style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: 
                    radial-gradient(circle at 20% 50%, rgba(168, 85, 247, 0.03) 0%, transparent 50%),
                    radial-gradient(circle at 80% 80%, rgba(34, 197, 94, 0.03) 0%, transparent 50%),
                    radial-gradient(circle at 40% 20%, rgba(251, 191, 36, 0.02) 0%, transparent 50%);
                pointer-events: none;
                z-index: 0;
            "></div>
            
            <!-- Content wrapper -->
            <div style="position: relative; z-index: 1;">
                <div id="bubble-formation-chart" style="width: 100%; height: 350px;"></div>
                
                <div style="display: flex; gap: 1rem; margin-top: 0.75rem; font-size: 0.65rem; color: var(--text-secondary); flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                        <div style="
                            width: 12px; 
                            height: 12px; 
                            border-radius: 50%; 
                            background: var(--heat-gray-bg);
                            border: 1px solid var(--heat-gray-text);
                            box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
                        "></div>
                        <span>Yet to play</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                        <div style="
                            width: 12px; 
                            height: 12px; 
                            border-radius: 50%; 
                            background: var(--heat-red-bg);
                            border: 1px solid var(--heat-red-text);
                            box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
                        "></div>
                        <span>0-3 pts</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                        <div style="
                            width: 12px; 
                            height: 12px; 
                            border-radius: 50%; 
                            background: var(--heat-yellow-bg);
                            border: 1px solid var(--heat-yellow-text);
                            box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
                        "></div>
                        <span>4-8 pts</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                        <div style="
                            width: 12px; 
                            height: 12px; 
                            border-radius: 50%; 
                            background: var(--heat-dark-green-bg);
                            border: 1px solid var(--heat-dark-green-text);
                            box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
                        "></div>
                        <span>9-13 pts</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                        <div style="
                            width: 12px; 
                            height: 12px; 
                            border-radius: 50%; 
                            background: #9333ea;
                            border: 1px solid #e9d5ff;
                            box-shadow: 0 0 4px rgba(147, 51, 234, 0.3);
                        "></div>
                        <span>14+ pts</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize the bubble formation chart after DOM is ready
 * @param {Array} players - Player picks array
 * @param {number} gwNumber - Gameweek number
 * @param {boolean} isLive - Whether gameweek is live
 */
export async function initBubbleFormationChart(players, gwNumber, isLive, myTeamState = null) {
    // Wait for DOM to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const chartDom = document.getElementById('bubble-formation-chart');
    
    if (!chartDom) {
        console.warn('Bubble formation chart container not found');
        return;
    }

    // Clean up previous chart
    if (currentChart) {
        currentChart.dispose();
        currentChart = null;
    }

    // Lazy load ECharts if not already loaded
    if (!echarts) {
        echarts = await import('echarts');
    }

    // Rebuild data (same logic as render function)
    const starters = players.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
    
    if (starters.length === 0) {
        return;
    }

    const activeGW = getActiveGW();
    
    const positionGroups = {
        gk: starters.filter(p => p.position === 1),
        def: starters.filter(p => p.position >= 2 && p.position <= 4),
        mid: starters.filter(p => p.position >= 5 && p.position <= 8),
        fwd: starters.filter(p => p.position >= 9 && p.position <= 11)
    };

    const containerWidth = 100;
    const containerHeight = 100;
    const numRows = 4;
    // Tighter spacing: use more of the container height, less wasted space
    const rowHeight = containerHeight / (numRows + 0.2); // Even tighter spacing
    const rowWidth = containerWidth;
    // Adjust starting position to reduce top gap further
    const topOffset = 0.5; // Start much closer to top
    
    const allNodes = [];
    let rowIndex = 0;

    const groups = [
        { key: 'gk', players: positionGroups.gk },
        { key: 'def', players: positionGroups.def },
        { key: 'mid', players: positionGroups.mid },
        { key: 'fwd', players: positionGroups.fwd }
    ];

    groups.forEach(group => {
        const groupPlayers = group.players;
        if (groupPlayers.length === 0) {
            rowIndex++;
            return;
        }

        const sortedPlayers = [...groupPlayers].sort((a, b) => a.position - b.position);

        const circles = sortedPlayers.map(pick => {
            const player = getPlayerById(pick.element);
            if (!player) return null;

            const hasGWStats = player.github_gw && player.github_gw.gw === gwNumber;
            const liveStats = player.live_stats;
            const gwStats = (!isLive || !liveStats) && hasGWStats ? player.github_gw : {};

            let gwPoints = liveStats?.total_points ?? 
                         (hasGWStats ? gwStats.total_points : (player.event_points || 0));
            
            // Get minutes
            let minutes = 0;
            if (liveStats?.minutes !== null && liveStats?.minutes !== undefined) {
                minutes = liveStats.minutes;
            } else if (hasGWStats && gwStats.minutes !== null && gwStats.minutes !== undefined) {
                minutes = gwStats.minutes;
            }
            
            if (pick.is_captain) {
                gwPoints = gwPoints * 2;
            }

            const ownership = parseFloat(player.selected_by_percent) || 0;
            const bubbleSize = calculateBubbleSize(ownership);

            return {
                pick,
                player,
                liveStats,
                gwStats,
                gwPoints,
                minutes,
                ownership,
                radius: bubbleSize / 2,
                size: bubbleSize
            };
        }).filter(Boolean);

        const rowCenterY = topOffset + (rowIndex + 0.5) * rowHeight;
        packCirclesInRow(circles, rowWidth, rowCenterY);

        circles.forEach(circle => {
            const { pick, player, liveStats, gwStats, gwPoints, minutes, ownership, size } = circle;
            const fontSize = getFontSize(size);
            const colors = getPointsColors(gwPoints, minutes);

            // Just the player name, no (C) or (VC) labels
            const labelText = escapeHtml(player.web_name);

            allNodes.push({
                name: player.web_name,
                value: [circle.x, circle.y, size],
                symbolSize: size,
                symbol: 'circle',
                itemStyle: {
                    color: colors.bgColor,
                    opacity: 1, // Full opacity for better visibility
                    // White borders for captain/vice captain - visible against colored backgrounds
                    borderColor: pick.is_captain ? 'rgba(255, 255, 255, 0.9)' : (pick.is_vice_captain ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)'),
                    borderWidth: pick.is_captain ? 4 : (pick.is_vice_captain ? 2.5 : 2),
                    shadowBlur: 0
                },
                label: {
                    show: true,
                    formatter: labelText,
                    fontSize: fontSize,
                    fontWeight: 'bold',
                    color: colors.textColor, // Use matching text color from heatmap
                    textBorderColor: 'rgba(0, 0, 0, 0.4)', // Subtle border for readability
                    textBorderWidth: 1
                },
                playerData: {
                    player,
                    pick,
                    liveStats,
                    gwStats,
                    gwPoints,
                    minutes,
                    ownership,
                    gwNumber,
                    activeGW
                }
            });
        });

        rowIndex++;
    });

    const option = {
        grid: {
            left: '2%',
            right: '2%',
            top: '1%', // Reduced top margin
            bottom: '1%' // Reduced bottom margin
        },
        xAxis: {
            type: 'value',
            show: false,
            min: 0,
            max: 100
        },
        yAxis: {
            type: 'value',
            show: false,
            min: 0,
            max: 100,
            inverse: true
        },
        tooltip: {
            show: false // Disable tooltip - we'll use player modal instead
        },
        series: [{
            type: 'scatter',
            data: allNodes,
            symbolSize: function(data) {
                return data[2];
            },
            label: {
                show: true,
                position: 'inside'
            },
            emphasis: {
                scale: true
            }
        }]
    };

    // Initialize chart
    currentChart = echarts.init(chartDom);
    currentChart.setOption(option);

    // Add click event listener to open player modal
    currentChart.on('click', function(params) {
        if (params.data && params.data.playerData) {
            const { player } = params.data.playerData;
            if (player && player.id) {
                showPlayerModal(player.id, myTeamState);
            }
        }
    });

    // Resize handler
    const resizeHandler = () => {
        if (currentChart) {
            currentChart.resize();
        }
    };
    window.addEventListener('resize', resizeHandler);

    return currentChart;
}

