// ============================================================================
// COMPACT BUBBLE FORMATION RENDERER
// Football formation visualization with packed bubbles
// ============================================================================

import { getPlayerById, getActiveGW } from '../../data.js';
import { getPositionShort, escapeHtml } from '../../utils.js';
import { getGWOpponent } from '../../fixtures.js';

// Import calculateGWPointsBreakdown from player modal
function calculateGWPointsBreakdown(player, liveStats, gwStats) {
    const positionType = player.element_type; // 1=GKP, 2=DEF, 3=MID, 4=FWD
    const stats = liveStats || gwStats || {};
    const minutes = stats.minutes || 0;
    
    const breakdown = {};
    
    // [Minutes] Appearance points: 1pt (<60min), 2pts (60+min)
    if (minutes > 0) {
        breakdown.minutes = {
            label: 'Minutes',
            value: minutes >= 60 ? 2 : 1,
            points: minutes >= 60 ? 2 : 1
        };
    }
    
    // [Goals] Goal points: position_multiplier × goals_scored
    const goals = stats.goals_scored || 0;
    if (goals > 0) {
        const goalMultiplier = positionType === 1 ? 10 : (positionType === 2 ? 6 : (positionType === 3 ? 5 : 4));
        breakdown.goals = {
            label: 'Goals',
            value: goals,
            points: goals * goalMultiplier
        };
    }
    
    // [Assists] Assist points: assists × 3
    const assists = stats.assists || 0;
    if (assists > 0) {
        breakdown.assists = {
            label: 'Assists',
            value: assists,
            points: assists * 3
        };
    }
    
    // [Clean Sheet] Clean sheet points: position_multiplier × clean_sheets
    const cleanSheets = stats.clean_sheets || 0;
    if (cleanSheets > 0 && (positionType === 1 || positionType === 2)) {
        const csMultiplier = positionType === 1 ? 4 : 4; // Both GK and DEF get 4
        breakdown.cleanSheets = {
            label: 'Clean Sheets',
            value: cleanSheets,
            points: cleanSheets * csMultiplier
        };
    }
    
    // [Goals Conceded] For GK/DEF: -1 per 2 goals conceded
    if (positionType === 1 || positionType === 2) {
        const goalsConceded = stats.goals_conceded || 0;
        if (goalsConceded > 0) {
            const concededPoints = Math.floor(goalsConceded / 2) * -1;
            if (concededPoints < 0) {
                breakdown.goalsConceded = {
                    label: 'Goals Conceded',
                    value: goalsConceded,
                    points: concededPoints
                };
            }
        }
    }
    
    // [Saves] For GK: 1pt per 3 saves
    if (positionType === 1) {
        const saves = stats.saves || 0;
        if (saves > 0) {
            const savesPoints = Math.floor(saves / 3);
            if (savesPoints > 0) {
                breakdown.saves = {
                    label: 'Saves',
                    value: saves,
                    points: savesPoints
                };
            }
        }
    }
    
    // [Penalties Saved] For GK: 5pts per penalty saved
    if (positionType === 1) {
        const penaltiesSaved = stats.penalties_saved || 0;
        if (penaltiesSaved > 0) {
            breakdown.penaltiesSaved = {
                label: 'Penalties Saved',
                value: penaltiesSaved,
                points: penaltiesSaved * 5
            };
        }
    }
    
    // [Penalties Missed] -2pts per penalty missed
    const penaltiesMissed = stats.penalties_missed || 0;
    if (penaltiesMissed > 0) {
        breakdown.penaltiesMissed = {
            label: 'Penalties Missed',
            value: penaltiesMissed,
            points: penaltiesMissed * -2
        };
    }
    
    // [Yellow Cards] Yellow cards: yellow_cards × -1
    const yellowCards = stats.yellow_cards || 0;
    if (yellowCards > 0) {
        breakdown.yellowCards = {
            label: 'Yellow Cards',
            value: yellowCards,
            points: yellowCards * -1
        };
    }
    
    // [Red Cards] Red cards: red_cards × -3
    const redCards = stats.red_cards || 0;
    if (redCards > 0) {
        breakdown.redCards = {
            label: 'Red Cards',
            value: redCards,
            points: redCards * -3
        };
    }
    
    // [Own Goal] Own goals: own_goals × -2
    const ownGoals = stats.own_goals || 0;
    if (ownGoals > 0) {
        breakdown.ownGoal = {
            label: 'Own Goal',
            value: ownGoals,
            points: ownGoals * -2
        };
    }
    
    // [Bonus] Bonus points: bonus or provisional_bonus (1-3 points)
    const bonus = liveStats?.provisional_bonus ?? liveStats?.bonus ?? stats.bonus ?? 0;
    if (bonus > 0) {
        breakdown.bonus = {
            label: 'Bonus',
            value: bonus,
            points: bonus
        };
    }
    
    return breakdown;
}

let echarts = null; // Lazy-loaded ECharts instance
let currentChart = null; // Current chart instance for cleanup

/**
 * Get points color based on GW points and minutes
 * @param {number} gwPoints - GW points
 * @param {number} minutes - Minutes played
 * @returns {string} Color with opacity
 */
function getPointsColor(gwPoints, minutes) {
    // Grey for players who haven't played yet (0 pts and 0 minutes)
    if (gwPoints === 0 && minutes <= 0) {
        return 'rgba(156, 163, 175, 0.5)'; // Grey - yet to play
    }
    
    // Lighter opacity shades for players who have played
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
            <div id="bubble-formation-chart" style="width: 100%; height: 450px;"></div>
            
            <div style="display: flex; gap: 1rem; margin-top: 0.75rem; font-size: 0.65rem; color: var(--text-secondary); flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 0.3rem;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: rgba(156, 163, 175, 0.5);"></div>
                    <span>Yet to play</span>
                </div>
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
    const rowHeight = containerHeight / (numRows + 0.5); // Reduced spacing between rows
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

        const rowCenterY = (rowIndex + 0.5) * rowHeight;
        packCirclesInRow(circles, rowWidth, rowCenterY);

        circles.forEach(circle => {
            const { pick, player, liveStats, gwStats, gwPoints, minutes, ownership, size } = circle;
            const fontSize = getFontSize(size);
            const pointsColor = getPointsColor(gwPoints, minutes);

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
            borderWidth: 1,
            textStyle: {
                color: '#d4d0c8',
                fontSize: 11
            },
            appendToBody: true, // Render tooltip outside chart container to avoid clipping
            confine: false, // Allow tooltip to move outside chart bounds
            position: function(point, params, dom, rect, size) {
                // Position tooltip to avoid screen edges
                const [x, y] = point;
                const [width, height] = size.viewSize;
                const tooltipWidth = size.contentSize[0] || 200;
                const tooltipHeight = size.contentSize[1] || 150;
                
                let posX = x + 15;
                let posY = y - 15;
                
                // Adjust if too close to right edge
                if (posX + tooltipWidth > width - 15) {
                    posX = x - tooltipWidth - 15;
                }
                
                // Adjust if too close to bottom edge
                if (posY + tooltipHeight > height - 15) {
                    posY = height - tooltipHeight - 15;
                }
                
                // Adjust if too close to top edge
                if (posY < 15) {
                    posY = 15;
                }
                
                // Adjust if too close to left edge
                if (posX < 15) {
                    posX = 15;
                }
                
                return [posX, posY];
            },
            formatter: function(params) {
                const { player, pick, liveStats, gwStats, gwPoints, minutes, ownership, gwNumber, activeGW } = params.data.playerData;
                const captainText = pick.is_captain ? ' (C)' : (pick.is_vice_captain ? ' (VC)' : '');
                
                const opponent = getGWOpponent(player.team, activeGW);
                const opponentBadge = renderOpponentBadgeForTooltip(opponent);
                
                // Get supporting stats
                const bps = liveStats?.bps ?? gwStats.bps ?? 0;
                const xG = gwStats.expected_goals ? parseFloat(gwStats.expected_goals).toFixed(2) : '0.00';
                const xA = gwStats.expected_assists ? parseFloat(gwStats.expected_assists).toFixed(2) : '0.00';
                
                // Format GW stats using same format as player modal
                const gwStatsHTML = formatGWStatsForTooltip(player, liveStats, gwStats, gwPoints, minutes, bps, xG, xA);
                
                return `<strong>${escapeHtml(player.web_name)}${captainText}</strong> (${getPositionShort(player)})<br/>
                        vs. ${opponentBadge}<br/>
                        <br/>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--border-color);">
                            <span style="color: var(--text-secondary); font-weight: 600;">Total Points</span>
                            <span style="font-weight: 700; font-size: 0.8rem;">${gwPoints}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.65rem;">
                            ${gwStatsHTML}
                        </div>`;
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

