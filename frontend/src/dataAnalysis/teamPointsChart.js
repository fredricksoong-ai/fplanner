/**
 * Team Points Chart - GW-by-GW cumulative points with insights
 * Enhanced version showing actual vs expected, GW-by-GW performance, and forecasts
 */

import { loadECharts } from '../charts/chartHelpers.js';
import { getGameweekEvent, fplBootstrap } from '../data.js';

const CHART_COLOR = '#a855f7'; // Purple, matching cohort chart
const BEST_COLOR = '#10b981'; // Green for best GW
const WORST_COLOR = '#ef4444'; // Red for worst GW


/**
 * Initialize team points chart with enhanced insights
 * @param {string} containerId - DOM element ID
 * @param {Array} teamHistory - Array of {event, points, total_points, overall_rank, ...}
 * @param {Array} currentPicks - Current team picks (optional, unused but kept for API compatibility)
 * @returns {Object} ECharts instance
 */
export async function initializeTeamPointsChart(containerId, teamHistory, currentPicks = null) {
  if (!teamHistory || !Array.isArray(teamHistory) || teamHistory.length === 0) {
    console.error('Invalid team history data');
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

  // Prepare data: sort by gameweek and calculate cumulative points
  const sortedHistory = [...teamHistory]
    .filter(gw => gw.event && gw.total_points !== null && gw.total_points !== undefined)
    .sort((a, b) => a.event - b.event);

  if (sortedHistory.length === 0) {
    console.error('No valid gameweek data in team history');
    return null;
  }

  const xAxisData = sortedHistory.map(gw => `GW${gw.event}`);
  const cumulativePoints = sortedHistory.map(gw => gw.total_points);
  const gwPoints = sortedHistory.map(gw => gw.points || 0);

  // Calculate statistics for insights
  const avgGWPoints = gwPoints.reduce((sum, pts) => sum + pts, 0) / gwPoints.length;
  const bestGW = sortedHistory.reduce((best, gw) => 
    (gw.points || 0) > (best.points || 0) ? gw : best
  );
  const worstGW = sortedHistory.reduce((worst, gw) => 
    (gw.points || 0) < (worst.points || 0) ? gw : worst
  );

  // Calculate FPL GW averages
  const fplGWaverages = sortedHistory.map(gw => {
    const event = getGameweekEvent(gw.event);
    return event?.average_entry_score || 0;
  });
  
  // Calculate cumulative FPL average starting from your first GW total
  // This shows what your cumulative would be if you scored FPL GW average each week
  const firstGW = sortedHistory[0];
  const firstGWTotal = firstGW.total_points;
  const cumulativeFPLAverages = sortedHistory.map((gw, idx) => {
    if (idx === 0) {
      return firstGWTotal; // Start from your actual first GW total
    }
    // Add FPL GW average for each subsequent GW
    return firstGWTotal + fplGWaverages.slice(1, idx + 1).reduce((sum, avg) => sum + avg, 0);
  });


  // Theme detection
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';

  // Calculate Y-axis range (include FPL average for context)
  let allPoints = [...cumulativePoints, ...cumulativeFPLAverages];
  const minPoints = Math.min(...allPoints);
  const maxPoints = Math.max(...allPoints);
  const range = maxPoints - minPoints;
  const padding = Math.max(10, range * 0.1);
  const yMin = Math.max(0, Math.floor(minPoints - padding));
  const yMax = Math.ceil(maxPoints + padding);

  // Build selective X-axis labels: only best and worst GWs
  const xAxisLabels = xAxisData.map((label, idx) => {
    const gw = sortedHistory[idx];
    if (gw.event === bestGW.event) {
      return `{best|${label}}`;
    } else if (gw.event === worstGW.event) {
      return `{worst|${label}}`;
    }
    return ''; // Empty string hides the label
  });

  // Build series array
  const series = [];

  // 1. Cumulative points line (main series)
  const cumulativeData = cumulativePoints.map((total, idx) => ({
    value: total,
    gwPoints: gwPoints[idx],
    event: sortedHistory[idx].event,
    isBest: sortedHistory[idx].event === bestGW.event,
    isWorst: sortedHistory[idx].event === worstGW.event
  }));

  series.push({
    name: 'Cumulative Points',
    type: 'line',
    data: cumulativeData,
    smooth: true,
    symbol: 'circle', // Show dots on all points
    symbolSize: function(data, params) {
      if (!data) return 0;
      // Larger symbols for best/worst GWs
      if (data.isBest || data.isWorst) return 10;
      return 6; // Regular dots
    },
    lineStyle: {
      color: CHART_COLOR, // Purple line
      width: 3
    },
    itemStyle: function(params) {
      if (!params.data) return { color: CHART_COLOR };
      const data = params.data;
      // Use purple for all points, but larger/bordered for best/worst
      return {
        color: CHART_COLOR, // Always purple for consistency with legend
        borderWidth: data.isBest || data.isWorst ? 3 : 0,
        borderColor: data.isBest ? BEST_COLOR : (data.isWorst ? WORST_COLOR : CHART_COLOR)
      };
    },
    emphasis: {
      scale: 1.2,
      focus: 'series',
      lineStyle: {
        width: 4
      }
    },
    // Reduced area fill opacity for cleaner look
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [{
          offset: 0,
          color: isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.1)'
        }, {
          offset: 1,
          color: isDark ? 'rgba(168, 85, 247, 0.02)' : 'rgba(168, 85, 247, 0.02)'
        }]
      }
    },
    z: 10
  });

  // 2. FPL Average line (reference line showing FPL average)
  series.push({
    name: 'FPL Average',
    type: 'line',
    data: cumulativeFPLAverages.map(total => ({ value: total })),
    lineStyle: {
      color: '#64748b', // Gray for neutral reference
      type: 'dashed',
      width: 2,
      opacity: 0.5
    },
    symbol: 'none',
    tooltip: {
      show: true,
      formatter: function(params) {
        const idx = params.dataIndex;
        const fplAvg = cumulativeFPLAverages[idx];
        const actual = cumulativePoints[idx];
        const diff = actual - fplAvg;
        const diffText = diff > 0 ? `+${diff.toFixed(0)}` : diff.toFixed(0);
        const gwAvg = fplGWaverages[idx];
        return `FPL Average<br/>GW Avg: ${gwAvg.toFixed(1)} pts<br/>Cumulative: ${fplAvg.toFixed(0)} pts<br/>Your Total: ${actual} pts (${diffText} vs FPL avg)`;
      }
    },
    z: 4
  });


  const option = {
    color: [CHART_COLOR, '#64748b'], // Explicit colors: purple for Cumulative, gray for FPL Average
    grid: {
      left: '10%',
      right: '8%',
      top: '18%', // Space for top legend
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
      confine: true, // Keep tooltip within chart area
      position: function(point, params, dom, rect, size) {
        // Position tooltip to avoid being cut off on left side
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
        // Get the first param to determine which GW we're hovering over
        const firstParam = params[0];
        const idx = firstParam.dataIndex;
        const gw = sortedHistory[idx];
        const gwLabel = firstParam.axisValue;
        
        // Get your data
        const yourTotal = cumulativePoints[idx];
        const yourGWPoints = gwPoints[idx];
        const yourRank = gw.overall_rank;
        const isBest = gw.event === bestGW.event;
        const isWorst = gw.event === worstGW.event;
        
        // Get FPL average data
        const fplTotal = cumulativeFPLAverages[idx];
        const fplGWAvg = fplGWaverages[idx];
        
        // Calculate differences
        const totalDiff = yourTotal - fplTotal;
        const gwDiff = yourGWPoints - fplGWAvg;
        const totalDiffText = totalDiff > 0 ? `+${totalDiff.toFixed(0)}` : totalDiff.toFixed(0);
        const gwDiffText = gwDiff > 0 ? `+${gwDiff.toFixed(0)}` : gwDiff.toFixed(0);
        
        // Get markers with colors
        const yourMarker = params.find(p => p.seriesName === 'Cumulative Points')?.marker || '●';
        const fplMarker = params.find(p => p.seriesName === 'FPL Average')?.marker || '●';
        
        // Build compact tooltip format
        let result = `<strong>${gwLabel}</strong><br/>`;
        
        // Best/Worst GW banner
        if (isBest) {
          result += `<span style="color: ${BEST_COLOR}; font-weight: 600;">⭐ Best GW!</span><br/>`;
        } else if (isWorst) {
          result += `<span style="color: ${WORST_COLOR}; font-weight: 600;">⚠️ Worst GW</span><br/>`;
        }
        
        result += `<br/>`;
        result += `${yourMarker} Total: <strong>${yourTotal}</strong> pts (${totalDiffText})<br/>`;
        result += `- GW: <strong>${yourGWPoints}</strong> pts (${gwDiffText})<br/>`;
        if (yourRank) {
          result += `- Rank: <strong>${yourRank.toLocaleString()}</strong><br/>`;
        }
        result += `<br/>`;
        result += `${fplMarker} FPL Average:<br/>`;
        result += `- Total: <strong>${fplTotal.toFixed(0)}</strong> pts<br/>`;
        result += `- GW: <strong>${Math.round(fplGWAvg)}</strong> pts<br/>`;
        
        return result;
      }
    },
    legend: {
      data: ['Cumulative Points', 'FPL Average'],
      top: 5,
      left: 'center',
      textStyle: {
        color: textColor,
        fontSize: 11
      },
      icon: 'roundRect',
      itemWidth: 20,
      itemHeight: 3,
      itemGap: 12
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLabel: {
        color: isDark ? '#94a3b8' : '#64748b',
        fontSize: 11,
        interval: 0,
        rotate: 0, // No rotation needed with selective labels
        formatter: function(value, index) {
          return xAxisLabels[index] || '';
        },
        rich: {
          best: {
            color: BEST_COLOR,
            fontWeight: 700,
            fontSize: 12
          },
          worst: {
            color: WORST_COLOR,
            fontWeight: 700,
            fontSize: 12
          }
        }
      },
      axisLine: {
        lineStyle: {
          color: gridColor
        }
      },
      axisTick: {
        show: true, // Show tick marks for each GW
        alignWithLabel: true,
        lineStyle: {
          color: gridColor,
          opacity: 0.3
        },
        length: 4
      },
      splitLine: {
        show: true, // Show vertical grid lines for each GW
        lineStyle: {
          color: gridColor,
          type: 'dashed',
          opacity: 0.2
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'Cumulative Points',
      min: yMin,
      max: yMax,
      axisLabel: {
        color: isDark ? '#94a3b8' : '#64748b',
        fontSize: 11,
        formatter: '{value}'
      },
      splitLine: {
        lineStyle: {
          color: gridColor,
          type: 'dashed',
          opacity: 0.2 // More subtle grid
        }
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      }
    },
    series
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
 * Cleanup chart instance
 */
export function disposeTeamPointsChart(chart) {
  if (!chart) return;
  if (chart._resizeHandler) {
    window.removeEventListener('resize', chart._resizeHandler);
    delete chart._resizeHandler;
  }
  chart.dispose();
}

