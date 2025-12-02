/**
 * Team Points Chart - GW-by-GW cumulative points
 * Similar style to cohort chart but for team performance over time
 */

import { loadECharts } from '../charts/chartHelpers.js';

const CHART_COLOR = '#a855f7'; // Purple, matching cohort chart

/**
 * Initialize team points chart
 * @param {string} containerId - DOM element ID
 * @param {Array} teamHistory - Array of {event, points, total_points, overall_rank, ...}
 * @returns {Object} ECharts instance
 */
export async function initializeTeamPointsChart(containerId, teamHistory) {
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

  // Theme detection
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';

  // Calculate Y-axis range
  const minPoints = Math.min(...cumulativePoints);
  const maxPoints = Math.max(...cumulativePoints);
  const range = maxPoints - minPoints;
  const padding = Math.max(10, range * 0.1);
  const yMin = Math.max(0, Math.floor(minPoints - padding));
  const yMax = Math.ceil(maxPoints + padding);

  const option = {
    grid: {
      left: '12%',
      right: '5%',
      top: '15%',
      bottom: '15%',
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
        const dataIndex = params[0].dataIndex;
        const gw = sortedHistory[dataIndex];
        let result = `<strong>${params[0].axisValue}</strong><br/>`;
        result += `${params[0].marker} Total: <strong>${gw.total_points}</strong> pts<br/>`;
        result += `GW Points: <strong>${gw.points || 0}</strong> pts`;
        if (gw.overall_rank) {
          result += `<br/>Rank: <strong>${gw.overall_rank.toLocaleString()}</strong>`;
        }
        return result;
      }
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLabel: {
        color: isDark ? '#94a3b8' : '#64748b',
        fontSize: 11,
        interval: 0,
        rotate: xAxisData.length > 10 ? 45 : 0
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
          opacity: 0.3
        }
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      }
    },
    series: [{
      name: 'Cumulative Points',
      type: 'line',
      data: cumulativePoints.map((total, idx) => ({
        value: total,
        gwPoints: gwPoints[idx],
        event: sortedHistory[idx].event
      })),
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        color: CHART_COLOR,
        width: 3
      },
      itemStyle: {
        color: CHART_COLOR,
        borderWidth: 2,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#1e293b'
      },
      emphasis: {
        scale: 1.2,
        focus: 'series'
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0,
            color: isDark ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.2)'
          }, {
            offset: 1,
            color: isDark ? 'rgba(168, 85, 247, 0.05)' : 'rgba(168, 85, 247, 0.05)'
          }]
        }
      }
    }]
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

