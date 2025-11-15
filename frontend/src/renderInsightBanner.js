// ============================================================================
// AI INSIGHTS BANNER COMPONENT
// Reusable banner for displaying AI-generated insights
// ============================================================================

import { aiInsights } from './aiInsights.js';
import { escapeHtml } from './utils.js';

/**
 * Get insight type styling configuration
 * @param {string} type - Insight type (opportunity, warning, action, insight)
 * @returns {Object} Style configuration
 */
function getInsightTypeConfig(type) {
    const configs = {
        opportunity: {
            icon: '✓',
            color: '#22c55e',
            bg: 'rgba(34, 197, 94, 0.1)',
            label: 'OPPORTUNITY'
        },
        warning: {
            icon: '⚠',
            color: '#fb923c',
            bg: 'rgba(251, 146, 60, 0.1)',
            label: 'WARNING'
        },
        action: {
            icon: '🎯',
            color: '#6b1970',
            bg: 'rgba(107, 25, 112, 0.1)',
            label: 'ACTION'
        },
        insight: {
            icon: '💡',
            color: '#8b5cf6',
            bg: 'rgba(139, 92, 246, 0.1)',
            label: 'INSIGHT'
        }
    };

    return configs[type] || configs.insight;
}

/**
 * Render a single insight item
 * @param {Object} item - Insight item
 * @param {string} item.type - Type of insight
 * @param {string} item.title - Insight title
 * @param {string} item.description - Insight description
 * @param {string} item.priority - Priority level (high, medium, low)
 * @returns {string} HTML string
 */
function renderInsightItem(item) {
    const config = getInsightTypeConfig(item.type);

    return `
        <div style="
            margin-bottom: 1rem;
            padding: 0.75rem 1rem;
            background: ${config.bg};
            border-left: 4px solid ${config.color};
            border-radius: 6px;
        ">
            <div style="font-weight: 600; margin-bottom: 0.25rem; color: var(--text-primary);">
                <span style="color: ${config.color};">${config.icon}</span>
                ${config.label}: ${escapeHtml(item.title)}
            </div>
            <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">
                ${escapeHtml(item.description)}
            </div>
        </div>
    `;
}

/**
 * Render loading state for AI insights banner
 * @returns {string} HTML string
 */
export function renderInsightBannerLoading() {
    return `
        <div class="ai-insights-banner" style="
            background: var(--bg-primary);
            border: 2px solid var(--accent-color);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 12px var(--shadow);
            text-align: center;
        ">
            <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--accent-color); margin-bottom: 0.5rem;"></i>
            <div style="color: var(--text-secondary); font-size: 0.875rem;">
                Generating AI insights...
            </div>
        </div>
    `;
}

/**
 * Render error state for AI insights banner
 * @param {string} message - Error message
 * @param {string} contextId - Unique context ID for retry button
 * @returns {string} HTML string
 */
export function renderInsightBannerError(message, contextId) {
    return `
        <div class="ai-insights-banner" style="
            background: var(--bg-primary);
            border: 2px solid #fb923c;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 12px var(--shadow);
            text-align: center;
        ">
            <div style="color: #fb923c; font-size: 1.25rem; margin-bottom: 0.5rem;">
                ⚠ ${escapeHtml(message)}
            </div>
            <button
                class="ai-insights-retry-btn"
                data-context="${contextId}"
                style="
                    padding: 0.5rem 1rem;
                    background: var(--accent-color);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    margin-top: 0.5rem;
                    transition: opacity 0.2s;
                "
                onmouseover="this.style.opacity='0.8'"
                onmouseout="this.style.opacity='1'"
            >
                <i class="fas fa-redo"></i> Retry
            </button>
        </div>
    `;
}

/**
 * Render AI insights banner
 * @param {Object} insights - Insights data from API
 * @param {string} contextId - Unique context ID for refresh functionality
 * @returns {string} HTML string
 */
export function renderInsightBanner(insights, contextId) {
    // Handle error state
    if (insights.error || !insights.items || insights.items.length === 0) {
        const message = insights.message || 'Unable to load AI insights';
        return renderInsightBannerError(message, contextId);
    }

    const timestamp = new Date(insights.timestamp).toLocaleTimeString();
    const gwText = insights.gameweek ? ` FOR GW ${insights.gameweek}` : '';

    return `
        <div class="ai-insights-banner" id="ai-insights-${contextId}" style="
            background: var(--bg-primary);
            border: 2px solid var(--accent-color);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 12px var(--shadow);
        ">
            <!-- Header -->
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                flex-wrap: wrap;
                gap: 0.5rem;
            ">
                <h3 style="
                    color: var(--accent-color);
                    font-weight: 700;
                    font-size: 1rem;
                    margin: 0;
                ">
                    🤖 AI INSIGHTS${gwText}
                </h3>
                <button
                    class="ai-insights-refresh-btn"
                    data-context="${contextId}"
                    style="
                        padding: 0.5rem 1rem;
                        background: var(--accent-color);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        transition: opacity 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 0.25rem;
                    "
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'"
                >
                    <i class="fas fa-sync-alt"></i>
                    <span>Refresh</span>
                </button>
            </div>

            <!-- Insights Items -->
            <div class="ai-insights-items">
                ${insights.items.map(item => renderInsightItem(item)).join('')}
            </div>

            <!-- Footer -->
            <div style="
                text-align: center;
                font-size: 0.75rem;
                color: var(--text-secondary);
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid var(--border-color);
            ">
                Last updated: ${timestamp} •
                <span style="opacity: 0.7;">Powered by Gemini AI</span>
            </div>
        </div>
    `;
}

/**
 * Attach event listeners to AI insights banner buttons
 * @param {string} contextId - Context identifier
 * @param {Function} onRefresh - Callback function when refresh is clicked
 */
export function attachInsightBannerListeners(contextId, onRefresh) {
    // Attach refresh button listener
    const refreshBtn = document.querySelector(`.ai-insights-refresh-btn[data-context="${contextId}"]`);
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('i');
            const originalHTML = refreshBtn.innerHTML;

            // Show loading state
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Loading...</span>';

            try {
                await onRefresh();
            } finally {
                // Restore button state
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = originalHTML;
            }
        });
    }

    // Attach retry button listener (for error state)
    const retryBtn = document.querySelector(`.ai-insights-retry-btn[data-context="${contextId}"]`);
    if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
            const originalHTML = retryBtn.innerHTML;

            // Show loading state
            retryBtn.disabled = true;
            retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';

            try {
                await onRefresh();
            } finally {
                // Restore button state
                retryBtn.disabled = false;
                retryBtn.innerHTML = originalHTML;
            }
        });
    }
}

/**
 * Helper function to load and render AI insights
 * @param {Object} context - Context for AI insights
 * @param {string} containerId - ID of container element to render into
 * @param {Function} onRefresh - Optional callback after refresh
 * @returns {Promise<void>}
 */
export async function loadAndRenderInsights(context, containerId, onRefresh) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }

    const contextId = `${context.page}_${context.tab}_${context.position}`;

    // Show loading state
    container.innerHTML = renderInsightBannerLoading();

    try {
        // Fetch insights
        const insights = await aiInsights.getInsights(context);

        // Render banner
        container.innerHTML = renderInsightBanner(insights, contextId);

        // Attach listeners
        attachInsightBannerListeners(contextId, async () => {
            // Refresh insights
            const freshInsights = await aiInsights.refresh(context);

            // Re-render
            container.innerHTML = renderInsightBanner(freshInsights, contextId);

            // Re-attach listeners
            attachInsightBannerListeners(contextId, arguments.callee);

            // Call optional callback
            if (onRefresh) {
                onRefresh(freshInsights);
            }
        });

    } catch (error) {
        console.error('Failed to load AI insights:', error);
        container.innerHTML = renderInsightBannerError(
            'Failed to load AI insights',
            contextId
        );

        // Attach retry listener
        attachInsightBannerListeners(contextId, () => {
            loadAndRenderInsights(context, containerId, onRefresh);
        });
    }
}
