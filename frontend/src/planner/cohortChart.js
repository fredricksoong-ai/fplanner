/**
 * Cohort Comparison Chart
 * Displays percentile rankings across metrics for user team vs top cohorts
 */

import { loadECharts } from '../charts/chartHelpers.js';

const METRIC_LABELS = {
    avgPPM: 'PPM',
    avgFDR: 'FDR',
    avgForm: 'Form',
    expectedPoints: 'xPts',
    avgOwnership: 'Own%',
    avgXGI: 'xGI'
};

const METRIC_ORDER = ['avgPPM', 'avgFDR', 'avgForm', 'expectedPoints', 'avgOwnership', 'avgXGI'];

const COHORT_COLORS = {
    myTeam: '#a855f7',    // Purple
    top10k: '#22c55e',    // Green
    top50k: '#3b82f6',    // Blue
    top100k: '#f59e0b'    // Amber
};

/**
 * Initialize the cohort comparison chart
 * @param {string} containerId - DOM element ID to render chart
 * @param {Object} cohortData - Cohort comparison data with userPercentiles and buckets
 * @returns {Object} ECharts instance
 */
export async function initializeCohortChart(containerId, cohortData) {
    if (!cohortData || !cohortData.userPercentiles || !cohortData.buckets) {
        console.error('Invalid cohort data provided to chart');
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

    // Prepare data series
    const xAxisData = METRIC_ORDER.map(key => METRIC_LABELS[key] || key);

    // Build series for chart
    const series = [];

    // User's team percentiles (vs Top 10k)
    const userPercentileData = METRIC_ORDER.map(key => {
        const value = cohortData.userPercentiles[key];
        return value !== null && value !== undefined ? value : null;
    });

    series.push({
        name: 'My Team',
        type: 'line',
        data: userPercentileData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
            color: COHORT_COLORS.myTeam,
            width: 3
        },
        itemStyle: {
            color: COHORT_COLORS.myTeam,
            borderWidth: 2,
            borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim() || '#1e293b'
        },
        emphasis: {
            scale: 1.2,
            focus: 'series'
        },
        z: 10 // Keep user's line on top
    });

    // Cohort averages percentiles (vs Top 10k)
    cohortData.buckets.forEach(bucket => {
        const percentileData = METRIC_ORDER.map(key => {
            const value = bucket.percentiles[key];
            return value !== null && value !== undefined ? value : null;
        });

        series.push({
            name: bucket.label,
            type: 'line',
            data: percentileData,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: {
                color: COHORT_COLORS[bucket.key] || '#64748b',
                width: 2
            },
            itemStyle: {
                color: COHORT_COLORS[bucket.key] || '#64748b'
            },
            emphasis: {
                focus: 'series'
            }
        });
    });

    // Theme detection
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#334155' : '#e5e7eb';
    const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';

    const option = {
        grid: {
            left: '12%',
            right: '5%',
            top: '20%',
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
                const metricName = params[0].axisValue;
                let result = `<strong>${metricName}</strong><br/>`;
                params.forEach(param => {
                    const value = param.value !== null ? `${param.value}th` : 'N/A';
                    result += `${param.marker} ${param.seriesName}: <strong>${value}</strong> percentile<br/>`;
                });
                return result;
            }
        },
        legend: {
            data: ['My Team', ...cohortData.buckets.map(b => b.label)],
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
                rotate: 0
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
            min: 0,
            max: 100,
            interval: 25,
            axisLabel: {
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: 11,
                formatter: '{value}th'
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
        series
    };

    chart.setOption(option);

    // Handle window resize
    const resizeHandler = () => {
        chart.resize();
    };
    window.addEventListener('resize', resizeHandler);

    // Store resize handler for cleanup
    chart._resizeHandler = resizeHandler;

    return chart;
}

/**
 * Cleanup chart instance and event listeners
 * @param {Object} chart - ECharts instance
 */
export function disposeCohortChart(chart) {
    if (!chart) return;

    if (chart._resizeHandler) {
        window.removeEventListener('resize', chart._resizeHandler);
        delete chart._resizeHandler;
    }

    chart.dispose();
}
