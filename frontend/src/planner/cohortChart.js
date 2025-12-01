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
 * Get actual metric values for display
 * @param {Object} cohortData - Cohort comparison data
 * @returns {Object} User metrics and cohort averages by metric key
 */
function getActualValues(cohortData) {
    const actualValues = {
        userMetrics: {},
        cohortAverages: {}
    };

    // Get user's actual metric values from the first bucket's originalPercentiles calculation
    // We'll need to pass userMetrics separately, so we'll add it to cohortData in the calling function

    // For now, extract from bucket averages
    cohortData.buckets.forEach(bucket => {
        actualValues.cohortAverages[bucket.key] = bucket.averages;
    });

    return actualValues;
}

/**
 * Initialize the cohort comparison chart
 * @param {string} containerId - DOM element ID to render chart
 * @param {Object} cohortData - Cohort comparison data with userPercentiles and buckets
 * @param {Object} userMetrics - User's actual metric values
 * @returns {Object} ECharts instance
 */
export async function initializeCohortChart(containerId, cohortData, userMetrics = null) {
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

    // Build series for chart with actual values attached
    const series = [];

    // User's team percentiles (vs Top 10k)
    const userPercentileData = METRIC_ORDER.map(key => {
        const percentile = cohortData.userPercentiles[key];
        const actualValue = userMetrics?.[key];
        return percentile !== null && percentile !== undefined ? {
            value: percentile,
            actualValue: actualValue,
            metricKey: key
        } : null;
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
            const percentile = bucket.percentiles[key];
            const actualValue = bucket.averages[key];
            return percentile !== null && percentile !== undefined ? {
                value: percentile,
                actualValue: actualValue,
                metricKey: key
            } : null;
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

    // Calculate dynamic Y-axis range based on actual percentiles
    const allPercentiles = [];
    series.forEach(s => {
        s.data.forEach(point => {
            if (point && point.value !== null && point.value !== undefined) {
                allPercentiles.push(point.value);
            }
        });
    });

    const minPercentile = Math.min(...allPercentiles);
    const maxPercentile = Math.max(...allPercentiles);
    const range = maxPercentile - minPercentile;
    const padding = Math.max(5, range * 0.1); // At least 5% padding, or 10% of range

    const yMin = Math.max(0, Math.floor(minPercentile - padding));
    const yMax = Math.min(100, Math.ceil(maxPercentile + padding));

    // Calculate appropriate interval for Y-axis
    const yRange = yMax - yMin;
    const interval = yRange <= 20 ? 5 : (yRange <= 40 ? 10 : 25);

    // Theme detection
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#334155' : '#e5e7eb';
    const tooltipBg = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)';

    // Helper to format actual values based on metric type
    const formatActualValue = (metricKey, value) => {
        if (value === null || value === undefined) return 'N/A';
        if (metricKey === 'avgOwnership') return `${value.toFixed(1)}%`;
        if (metricKey === 'expectedPoints') return value.toFixed(0);
        return value.toFixed(2);
    };

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
                    if (param.data && param.data.value !== null) {
                        const percentile = `${param.data.value}th`;
                        const actualVal = formatActualValue(param.data.metricKey, param.data.actualValue);
                        result += `${param.marker} ${param.seriesName}: <strong>${percentile}</strong> (${actualVal})<br/>`;
                    } else {
                        result += `${param.marker} ${param.seriesName}: N/A<br/>`;
                    }
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
            min: yMin,
            max: yMax,
            interval: interval,
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
