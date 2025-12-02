/**
 * Team Points Chart - GW-by-GW cumulative points with insights
 * Enhanced version showing actual vs expected, GW-by-GW performance, and forecasts
 */

import { loadECharts } from '../charts/chartHelpers.js';
import { getAllPlayers, getActiveGW } from '../data.js';
import { getCurrentGW } from '../utils.js';

const CHART_COLOR = '#a855f7'; // Purple, matching cohort chart
const EXPECTED_COLOR = '#3b82f6'; // Blue for forecast (not green since green is for best)
const BEST_COLOR = '#10b981'; // Green for best GW
const WORST_COLOR = '#ef4444'; // Red for worst GW

/**
 * Calculate expected points for current team
 * @param {Array} picks - Current team picks
 * @returns {number} Expected points for next GW
 */
function calculateExpectedPoints(picks) {
  if (!picks || picks.length === 0) return 0;
  
  const allPlayers = getAllPlayers();
  let totalExpected = 0;
  
  // Only count starting 11
  const starting11 = picks.filter(p => p.position <= 11);
  
  starting11.forEach(pick => {
    const player = allPlayers.find(p => p.id === pick.element);
    if (player) {
      const epNext = parseFloat(player.ep_next) || 0;
      // Apply captain multiplier if applicable
      const multiplier = pick.is_captain ? 2 : 1;
      totalExpected += epNext * multiplier;
    }
  });
  
  return Math.round(totalExpected);
}

/**
 * Initialize team points chart with enhanced insights
 * @param {string} containerId - DOM element ID
 * @param {Array} teamHistory - Array of {event, points, total_points, overall_rank, ...}
 * @param {Array} currentPicks - Current team picks (optional, for expected points calculation)
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

  // Calculate expected points for current team (if picks available)
  const currentGW = getCurrentGW();
  const activeGW = getActiveGW();
  const lastGW = sortedHistory[sortedHistory.length - 1];
  const lastGWNumber = lastGW?.event || currentGW;
  
  let expectedPointsLine = null;
  let forecastGWs = [];
  
  if (currentPicks && lastGWNumber) {
    const expectedPts = calculateExpectedPoints(currentPicks);
    
    // Build expected points cumulative line (starting from last GW)
    const lastTotal = lastGW.total_points;
    const expectedCumulative = [lastTotal]; // Start from last actual total
    const expectedGWLabels = [`GW${lastGWNumber}`];
    
    // Project forward 5 GWs
    for (let i = 1; i <= 5; i++) {
      const nextGW = lastGWNumber + i;
      expectedCumulative.push(lastTotal + (expectedPts * i));
      expectedGWLabels.push(`GW${nextGW}`);
    }
    
    expectedPointsLine = {
      labels: expectedGWLabels,
      values: expectedCumulative,
      gwPoints: expectedPts
    };
    
    // Forecast data for future GWs
    forecastGWs = Array.from({ length: 5 }, (_, i) => ({
      event: lastGWNumber + i + 1,
      expectedPoints: expectedPts
    }));
  }

  // Theme detection
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';

  // Calculate Y-axis range (include expected points if available)
  let allPoints = [...cumulativePoints];
  if (expectedPointsLine) {
    allPoints = [...allPoints, ...expectedPointsLine.values];
  }
  const minPoints = Math.min(...allPoints);
  const maxPoints = Math.max(...allPoints);
  const range = maxPoints - minPoints;
  const padding = Math.max(10, range * 0.1);
  const yMin = Math.max(0, Math.floor(minPoints - padding));
  const yMax = Math.ceil(maxPoints + padding);

  // Build selective X-axis labels: only best, worst, and forecast GWs
  const xAxisLabels = xAxisData.map((label, idx) => {
    const gw = sortedHistory[idx];
    if (gw.event === bestGW.event) {
      return `{best|${label}}`;
    } else if (gw.event === worstGW.event) {
      return `{worst|${label}}`;
    }
    return ''; // Empty string hides the label
  });

  // Add forecast GWs if available
  if (expectedPointsLine) {
    expectedPointsLine.labels.slice(1).forEach(label => {
      xAxisLabels.push(`{forecast|${label}}`);
    });
  }

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
  
  // Pad with nulls for forecast GWs if expected line exists
  if (expectedPointsLine) {
    for (let i = 0; i < 5; i++) {
      cumulativeData.push(null);
    }
  }

  series.push({
    name: 'Cumulative Points',
    type: 'line',
    data: cumulativeData,
    smooth: true,
    symbol: function(data, params) {
      if (!data) return 'none';
      // Highlight best/worst with larger symbols
      if (data.isBest || data.isWorst) return 'circle';
      return 'none'; // No symbols for regular points (cleaner)
    },
    symbolSize: function(data, params) {
      if (!data) return 0;
      if (data.isBest || data.isWorst) return 10;
      return 0;
    },
    lineStyle: {
      color: CHART_COLOR,
      width: 3
    },
    itemStyle: function(params) {
      if (!params.data) return {};
      const data = params.data;
      return {
        color: data.isBest ? BEST_COLOR : (data.isWorst ? WORST_COLOR : CHART_COLOR),
        borderWidth: data.isBest || data.isWorst ? 3 : 0,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#1e293b'
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

  // 2. Average trend line (more subtle)
  const firstGW = sortedHistory[0];
  const avgCumulativeData = sortedHistory.map((gw, idx) => {
    const expectedTotal = firstGW.total_points + (avgGWPoints * idx);
    return expectedTotal;
  });
  
  series.push({
    name: 'Average Trend',
    type: 'line',
    data: avgCumulativeData.map(total => ({ value: total })),
    lineStyle: {
      color: '#f59e0b',
      type: 'dashed',
      width: 1.5,
      opacity: 0.4 // More subtle
    },
    symbol: 'none',
    tooltip: {
      show: false
    },
    z: 5
  });

  // 3. Expected points forecast (if available)
  if (expectedPointsLine) {
    const expectedData = [...Array(sortedHistory.length - 1).fill(null), expectedPointsLine.values[0], ...expectedPointsLine.values.slice(1)];
    
    series.push({
      name: 'Expected Forecast',
      type: 'line',
      data: expectedData.map((val, idx) => {
        if (val === null) return null;
        return {
          value: val,
          isForecast: idx >= sortedHistory.length,
          expectedGWPoints: expectedPointsLine.gwPoints
        };
      }),
      smooth: true,
      symbol: 'diamond',
      symbolSize: 5,
      lineStyle: {
        color: EXPECTED_COLOR,
        width: 2,
        type: 'dashed',
        opacity: 0.7
      },
      itemStyle: {
        color: EXPECTED_COLOR
      },
      emphasis: {
        focus: 'series'
      },
      z: 8
    });
  }

  const option = {
    grid: {
      left: '10%',
      right: '8%',
      top: '15%',
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
      formatter: function(params) {
        let result = `<strong>${params[0].axisValue}</strong><br/>`;
        
        params.forEach(param => {
          if (param.seriesName === 'Cumulative Points') {
            if (param.data && param.data.value !== null) {
              const idx = param.dataIndex;
              const gw = sortedHistory[idx];
              result += `${param.marker} Total: <strong>${gw.total_points}</strong> pts<br/>`;
              // Include GW points in tooltip (removed from bars)
              result += `GW Points: <strong>${param.data.gwPoints || 0}</strong> pts`;
              const vsAvg = param.data.gwPoints > avgGWPoints ? '+' : '';
              const diff = (param.data.gwPoints - avgGWPoints).toFixed(1);
              result += ` (${vsAvg}${diff} vs avg)<br/>`;
              if (gw.overall_rank) {
                result += `Rank: <strong>${gw.overall_rank.toLocaleString()}</strong><br/>`;
              }
              if (param.data.isBest) {
                result += `<span style="color: ${BEST_COLOR}; font-weight: 600;">⭐ Best GW!</span><br/>`;
              }
              if (param.data.isWorst) {
                result += `<span style="color: ${WORST_COLOR}; font-weight: 600;">⚠️ Worst GW</span><br/>`;
              }
            }
          } else if (param.seriesName === 'Expected Forecast') {
            if (param.data && param.data.value !== null) {
              result += `${param.marker} Expected: <strong>${param.data.value.toFixed(0)}</strong> pts`;
              if (param.data.isForecast) {
                result += ` (forecast: ${param.data.expectedGWPoints} pts/GW)`;
              }
              result += `<br/>`;
            }
          }
        });
        
        return result;
      }
    },
    legend: {
      data: ['Cumulative Points', 'Average Trend', ...(expectedPointsLine ? ['Expected Forecast'] : [])],
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
      data: expectedPointsLine ? [...xAxisData, ...expectedPointsLine.labels.slice(1)] : xAxisData,
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
          },
          forecast: {
            color: EXPECTED_COLOR,
            fontStyle: 'italic',
            fontSize: 11
          }
        }
      },
      axisLine: {
        lineStyle: {
          color: gridColor
        }
      },
      axisTick: {
        show: false
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

