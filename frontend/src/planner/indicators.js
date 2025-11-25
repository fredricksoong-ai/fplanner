/**
 * Metric Indicators Rendering
 * Sleek indicator cards showing team metrics with deltas
 */

import { formatDecimal } from '../utils.js';

/**
 * Render metric indicators row
 * @param {Object} originalMetrics - Original team metrics
 * @param {Object} currentMetrics - Current team metrics (after changes)
 * @returns {string} HTML string
 */
export function renderMetricIndicators(originalMetrics, currentMetrics) {
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
                grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                gap: 0.5rem;
            ">
                ${renderIndicatorCard('Avg PPM', deltas.avgPPM, 'ppm')}
                ${renderIndicatorCard('Avg FDR', deltas.avgFDR, 'fdr')}
                ${renderIndicatorCard('Avg Form', deltas.avgForm, 'form')}
                ${renderIndicatorCard('Exp Pts', deltas.expectedPoints, 'points')}
                ${renderIndicatorCard('Risk', deltas.riskCount, 'risk')}
                ${renderIndicatorCard('Budget', deltas.budget, 'budget')}
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
function renderIndicatorCard(label, delta, type) {
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
        avgPPM: {
            value: current.avgPPM,
            delta: current.avgPPM - original.avgPPM,
            direction: current.avgPPM > original.avgPPM ? 'up' : 
                      current.avgPPM < original.avgPPM ? 'down' : 'neutral'
        },
        avgFDR: {
            value: current.avgFDR,
            delta: current.avgFDR - original.avgFDR,
            direction: current.avgFDR < original.avgFDR ? 'up' : // Lower FDR is better
                       current.avgFDR > original.avgFDR ? 'down' : 'neutral'
        },
        avgForm: {
            value: current.avgForm,
            delta: current.avgForm - original.avgForm,
            direction: current.avgForm > original.avgForm ? 'up' : 
                      current.avgForm < original.avgForm ? 'down' : 'neutral'
        },
        expectedPoints: {
            value: current.expectedPoints,
            delta: current.expectedPoints - original.expectedPoints,
            direction: current.expectedPoints > original.expectedPoints ? 'up' : 
                      current.expectedPoints < original.expectedPoints ? 'down' : 'neutral'
        },
        riskCount: {
            value: `${current.riskCount.high}🔴 ${current.riskCount.medium}🟠`,
            delta: (current.riskCount.high + current.riskCount.medium) - 
                   (original.riskCount.high + original.riskCount.medium),
            direction: (current.riskCount.high + current.riskCount.medium) < 
                       (original.riskCount.high + original.riskCount.medium) ? 'up' :
                       (current.riskCount.high + current.riskCount.medium) > 
                       (original.riskCount.high + original.riskCount.medium) ? 'down' : 'neutral'
        },
        budget: {
            value: current.budget || 0,
            delta: (current.budget || 0) - (original.budget || 0),
            direction: (current.budget || 0) > (original.budget || 0) ? 'up' :
                       (current.budget || 0) < (original.budget || 0) ? 'down' : 'neutral'
        }
    };
}

/**
 * Format value based on type
 * @param {number} value - Value to format
 * @param {string} type - Metric type
 * @returns {string} Formatted value
 */
function formatValue(value, type) {
    if (type === 'risk') {
        return value; // Already formatted as string
    }
    if (type === 'budget') {
        return `£${(value / 10).toFixed(1)}m`;
    }
    if (type === 'points') {
        return formatDecimal(value);
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
    if (type === 'budget') {
        const absDelta = Math.abs(delta);
        const sign = delta >= 0 ? '+' : '-';
        return `${sign}£${(absDelta / 10).toFixed(1)}m`;
    }
    if (type === 'points') {
        const sign = delta >= 0 ? '+' : '';
        return `${sign}${formatDecimal(delta)}`;
    }
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${formatDecimal(delta, 1)}`;
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

