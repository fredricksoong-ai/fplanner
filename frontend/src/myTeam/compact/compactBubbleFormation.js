// ============================================================================
// COMPACT BUBBLE FORMATION RENDERER
// Football formation visualization with packed bubbles
// ============================================================================

import { getPlayerById, getActiveGW } from '../../data.js';
import { getPositionShort, escapeHtml } from '../../utils.js';
import { getGWOpponent } from '../../fixtures.js';

let echarts = null; // Lazy-loaded ECharts instance
let currentChart = null; // Current chart instance for cleanup

/**
 * Get points color based on GW points
 * @param {number} gwPoints - GW points
 * @returns {string} Color with opacity
 */
function getPointsColor(gwPoints) {
    // Lighter opacity shades
    if (gwPoints >= 12) return 'rgba(168, 85, 247, 0.5)'; // Purple - excellent
    if (gwPoints >= 8) return 'rgba(34, 197, 94, 0.5)';  // Green - good
    if (gwPoints >= 5) return 'rgba(251, 191, 36, 0.5)';  // Yellow - average
    return 'rgba(239, 68, 68, 0.5)'; // Red - poor
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
 * Format GW stats for tooltip
 * @param {Object} player - Player object
 * @param {Object} liveStats - Live stats
 * @param {Object} gwStats - GW stats
 * @returns {string} Formatted stats string
 */
function formatGWStats(player, liveStats, gwStats) {
    const stats = liveStats || gwStats || {};
    const statsList = [];
    
    if (stats.minutes > 0) {
        statsList.push(`Mins: ${stats.minutes}`);
    }
    if (stats.goals_scored > 0) {
        statsList.push(`⚽ ${stats.goals_scored}`);
    }
    if (stats.assists > 0) {
        statsList.push(`🎯 ${stats.assists}`);
    }
    if (stats.bonus > 0 || stats.provisional_bonus > 0) {
        const bonus = stats.provisional_bonus ?? stats.bonus ?? 0;
        if (bonus > 0) {
            statsList.push(`⭐ ${bonus}`);
        }
    }
    if (stats.clean_sheets > 0 && (player.element_type === 1 || player.element_type === 2)) {
        statsList.push(`🧤 CS`);
    }
    if (stats.bps > 0) {
        statsList.push(`BPS: ${stats.bps}`);
    }
    
    return statsList.length > 0 ? statsList.join(' • ') : 'No stats';
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
    
    let currentX = (100 - (totalDiameter * scale / rowWidth * 100)) / 2 * rowWidth / 100;
    
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
export async function renderCompactBubbleFormation(players, gwNumber, isLive) {
    // Filter to starting 11 only (positions 1-11)
    const starters = players.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
    
    if (starters.length === 0) {
        return '';
    }

    return `
        <div style="
            background: var(--bg-secondary);
            border-radius: 0.75rem;
            padding: 1rem;
            margin-bottom: 1rem;
            border: 1px solid var(--border-color);
        ">
            <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; margin-bottom: 0.5rem;">
                Team Formation This GW ⚽
            </div>
            
            <div id="bubble-formation-chart" style="width: 100%; height: 450px; margin-top: 0.5rem;"></div>
            
            <div style="display: flex; gap: 1rem; margin-top: 0.75rem; font-size: 0.65rem; color: var(--text-secondary); flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: rgba(239, 68, 68, 0.5);"></div>
                    <span>0-4 pts</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: rgba(251, 191, 36, 0.5);"></div>
                    <span>5-7 pts</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: rgba(34, 197, 94, 0.5);"></div>
                    <span>8-11 pts</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: rgba(168, 85, 247, 0.5);"></div>
                    <span>12+ pts</span>
                </div>
            </div>
            
            <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.5rem; text-align: center; font-style: italic;">
                💡 Bubble size = Ownership (bigger = rarer pick)<br>
                Color = GW Points | Tap bubbles for details
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
export async function initBubbleFormationChart(players, gwNumber, isLive) {
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
    const rowHeight = containerHeight / numRows;
    const rowWidth = containerWidth;
    
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
                ownership,
                radius: bubbleSize / 2,
                size: bubbleSize
            };
        }).filter(Boolean);

        const rowCenterY = (rowIndex + 0.5) * rowHeight;
        packCirclesInRow(circles, rowWidth, rowCenterY);

        circles.forEach(circle => {
            const { pick, player, liveStats, gwStats, gwPoints, ownership, size } = circle;
            const fontSize = getFontSize(size);
            const pointsColor = getPointsColor(gwPoints);

            let labelText = escapeHtml(player.web_name);
            if (pick.is_captain) {
                labelText = `${escapeHtml(player.web_name)}\n(C)`;
            } else if (pick.is_vice_captain) {
                labelText = `${escapeHtml(player.web_name)}\n(VC)`;
            }

            allNodes.push({
                name: player.web_name,
                value: [circle.x, circle.y, size],
                symbolSize: size,
                symbol: 'circle',
                itemStyle: {
                    color: pointsColor,
                    opacity: 0.5,
                    borderColor: pick.is_captain ? '#a855f7' : (pick.is_vice_captain ? '#8b5cf6' : 'rgba(255, 255, 255, 0.2)'),
                    borderWidth: pick.is_captain ? 3 : (pick.is_vice_captain ? 2.5 : 2),
                    shadowBlur: 0
                },
                label: {
                    show: true,
                    formatter: labelText,
                    fontSize: fontSize,
                    fontWeight: 'bold',
                    color: '#fff',
                    textBorderColor: 'rgba(0, 0, 0, 0.6)',
                    textBorderWidth: 1.5
                },
                playerData: {
                    player,
                    pick,
                    liveStats,
                    gwStats,
                    gwPoints,
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
            top: '2%',
            bottom: '2%'
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
            trigger: 'item',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderColor: '#3a3530',
            textStyle: {
                color: '#d4d0c8',
                fontSize: 11
            },
            formatter: function(params) {
                const { player, pick, liveStats, gwStats, gwPoints, ownership, gwNumber, activeGW } = params.data.playerData;
                const captainText = pick.is_captain ? ' (C)' : (pick.is_vice_captain ? ' (VC)' : '');
                
                const opponent = getGWOpponent(player.team, activeGW);
                const opponentBadge = renderOpponentBadgeForTooltip(opponent);
                
                const gwStatsText = formatGWStats(player, liveStats, gwStats);
                
                return `<strong>${escapeHtml(player.web_name)}${captainText}</strong> (${getPositionShort(player)})<br/>
                        vs. ${opponentBadge}<br/>
                        <br/>
                        <strong>GW ${gwNumber} Points: ${gwPoints}</strong><br/>
                        <br/>
                        <strong>GW Stats:</strong><br/>
                        ${gwStatsText}`;
            }
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

    // Resize handler
    const resizeHandler = () => {
        if (currentChart) {
            currentChart.resize();
        }
    };
    window.addEventListener('resize', resizeHandler);

    return currentChart;
}

