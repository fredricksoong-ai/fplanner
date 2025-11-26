/**
 * Metric Indicators Rendering
 * Sleek indicator cards showing team metrics with deltas
 */

import { formatDecimal } from '../utils.js';

const METRIC_KEY_BY_TYPE = {
    ppm: 'avgPPM',
    fdr: 'avgFDR',
    form: 'avgForm',
    points: 'expectedPoints',
    ownership: 'avgOwnership',
    xgi: 'avgXGI'
};

/**
 * Render metric indicators row
 * @param {Object} originalMetrics - Original team metrics
 * @param {Object} currentMetrics - Current team metrics (after changes)
 * @returns {string} HTML string
 */
export function renderMetricIndicators(originalMetrics, currentMetrics, leagueComparison = null) {
    if (!originalMetrics || !currentMetrics) {
        return '';
    }

    const deltas = calculateDeltas(originalMetrics, currentMetrics);

    return `
        <div style="
            margin-bottom: 1rem;
            padding: 0.75rem;
            background: var(--bg-secondary);
            border-radius: 8px;
        ">
            <div style="
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: 0.75rem;
            ">
                Team Metrics
            </div>
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
                gap: 0.5rem;
            ">
                ${renderIndicatorCard('Avg PPM', deltas.avgPPM, 'ppm', leagueComparison)}
                ${renderIndicatorCard('Avg FDR', deltas.avgFDR, 'fdr', leagueComparison)}
                ${renderIndicatorCard('Avg Form', deltas.avgForm, 'form', leagueComparison)}
                ${renderIndicatorCard('Exp Pts', deltas.expectedPoints, 'points', leagueComparison)}
                ${renderIndicatorCard('Avg Own%', deltas.avgOwnership, 'ownership', leagueComparison)}
                ${renderIndicatorCard('Avg xGI', deltas.avgXGI, 'xgi', leagueComparison)}
            </div>
        </div>
    `;
}

/**
 * Render a single indicator card
 * @param {string} label - Metric label
 * @param {Object} delta - Delta object with value, delta, direction
 * @param {string} type - Metric type for special formatting
 * @returns {string} HTML string
 */
function renderIndicatorCard(label, delta, type, leagueComparison) {
    if (!delta) return '';

    const { value, delta: deltaValue, direction } = delta;
    
    // Format value based on type
    let displayValue = formatValue(value, type);
    
    // Format delta
    const deltaDisplay = formatDelta(deltaValue, type);
    const deltaColor = getDeltaColor(direction);
    const deltaIcon = getDeltaIcon(direction);

    return `
        <div style="
            background: var(--bg-primary);
            padding: 0.5rem;
            border-radius: 6px;
            text-align: center;
            border: 1px solid var(--border-color);
        ">
            <div style="
                font-size: 0.6rem;
                color: var(--text-secondary);
                margin-bottom: 0.25rem;
            ">
                ${label}
            </div>
            <div style="
                font-size: 0.85rem;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 0.15rem;
            ">
                ${displayValue}
            </div>
            ${deltaValue !== 0 ? `
                <div style="
                    font-size: 0.65rem;
                    color: ${deltaColor};
                    font-weight: 600;
                ">
                    ${deltaIcon} ${deltaDisplay}
                </div>
            ` : `
                <div style="
                    font-size: 0.65rem;
                    color: var(--text-tertiary);
                ">
                    —
                </div>
            `}
            ${renderLeagueComparisonLine(leagueComparison, type)}
        </div>
    `;
}

/**
 * Calculate deltas for all metrics
 * @param {Object} original - Original metrics
 * @param {Object} current - Current metrics
 * @returns {Object} Deltas object
 */
function calculateDeltas(original, current) {
    return {
        avgPPM: buildDelta(current.avgPPM, original.avgPPM, true),
        avgFDR: buildDelta(current.avgFDR, original.avgFDR, false),
        avgForm: buildDelta(current.avgForm, original.avgForm, true),
        expectedPoints: buildDelta(current.expectedPoints, original.expectedPoints, true),
        avgOwnership: buildDelta(current.avgOwnership, original.avgOwnership, true),
        avgXGI: buildDelta(current.avgXGI, original.avgXGI, true)
    };
}

function buildDelta(currentValue, originalValue, higherIsBetter) {
    const hasCurrent = typeof currentValue === 'number' && Number.isFinite(currentValue);
    const hasOriginal = typeof originalValue === 'number' && Number.isFinite(originalValue);

    if (!hasCurrent || !hasOriginal) {
        return {
            value: hasCurrent ? currentValue : null,
            delta: 0,
            direction: 'neutral'
        };
    }

    const delta = currentValue - originalValue;
    let direction = 'neutral';
    if (delta !== 0) {
        const improved = higherIsBetter ? delta > 0 : delta < 0;
        direction = improved ? 'up' : 'down';
    }
    return {
        value: currentValue,
        delta,
        direction
    };
}

/**
 * Format value based on type
 * @param {number} value - Value to format
 * @param {string} type - Metric type
 * @returns {string} Formatted value
 */
function formatValue(value, type) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '—';
    }
    if (type === 'ownership') {
        return `${formatDecimal(value)}%`;
    }
    return formatDecimal(value);
}

/**
 * Format delta value
 * @param {number} delta - Delta value
 * @param {string} type - Metric type
 * @returns {string} Formatted delta
 */
function formatDelta(delta, type) {
    if (delta === null || delta === undefined || Number.isNaN(delta)) {
        return '0.0';
    }
    const sign = delta >= 0 ? '+' : '';
    return type === 'ownership'
        ? `${sign}${formatDecimal(delta)}%`
        : `${sign}${formatDecimal(delta)}`;
}

/**
 * Get color for delta direction
 * @param {string} direction - 'up', 'down', or 'neutral'
 * @returns {string} Color hex
 */
function getDeltaColor(direction) {
    if (direction === 'up') return '#22c55e'; // Green for improvement
    if (direction === 'down') return '#ef4444'; // Red for worse
    return 'var(--text-tertiary)'; // Gray for neutral
}

/**
 * Get icon for delta direction
 * @param {string} direction - 'up', 'down', or 'neutral'
 * @returns {string} Icon/arrow
 */
function getDeltaIcon(direction) {
    if (direction === 'up') return '↑';
    if (direction === 'down') return '↓';
    return '—';
}

function renderLeagueComparisonLine(leagueComparison, type) {
    if (!leagueComparison) return '';
    const metricKey = METRIC_KEY_BY_TYPE[type];
    if (!metricKey) return '';

    const avg = leagueComparison.averages?.[metricKey];
    const percentile = leagueComparison.percentiles?.[metricKey];

    if ((avg === null || avg === undefined) && (percentile === null || percentile === undefined)) {
        return '';
    }

    const avgText = (avg !== null && avg !== undefined) ? formatValue(avg, type) : null;
    const percentileText = (percentile !== null && percentile !== undefined)
        ? `${percentile}<sup>th</sup> pct`
        : null;

    if (!avgText && !percentileText) {
        return '';
    }

    return `
        <div style="
            font-size: 0.6rem;
            color: var(--text-tertiary);
            margin-top: 0.25rem;
            line-height: 1.2;
        ">
            ${avgText ? `Avg ${avgText}<br>` : ''}
            ${percentileText ? `${percentileText}` : ''}
        </div>
    `;
}

