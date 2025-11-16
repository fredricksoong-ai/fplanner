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
 * Render a category's insights as bullet points
 * @param {Array<string>} insights - Array of insight strings
 * @returns {string} HTML string
 */
function renderCategoryInsights(insights) {
    if (!insights || insights.length === 0) {
        return '<div style="color: var(--text-secondary); font-style: italic;">No insights available</div>';
    }

    return `
        <ul style="
            list-style: none;
            padding: 0;
            margin: 0;
        ">
            ${insights.map(insight => `
                <li style="
                    margin-bottom: 0.75rem;
                    padding-left: 1.5rem;
                    position: relative;
                    line-height: 1.6;
                    color: var(--text-primary);
                ">
                    <span style="
                        position: absolute;
                        left: 0;
                        color: var(--accent-color);
                        font-weight: 700;
                    ">•</span>
                    ${escapeHtml(insight)}
                </li>
            `).join('')}
        </ul>
    `;
}

/**
 * Render AI insights banner with tabbed categories
 * @param {Object} insights - Insights data from API
 * @param {string} contextId - Unique context ID for refresh functionality
 * @returns {string} HTML string
 */
export function renderInsightBanner(insights, contextId) {
    // Handle error state
    if (insights.error || !insights.categories) {
        const message = insights.message || 'Unable to load AI insights';
        return renderInsightBannerError(message, contextId);
    }

    const timestamp = new Date(insights.timestamp).toLocaleTimeString();
    const gwText = insights.gameweek ? ` FOR GW ${insights.gameweek}` : '';

    const categories = ['Overview', 'Hidden Gems', 'Differentials', 'Transfer Targets', 'Team Analysis'];

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
            <div style="margin-bottom: 1rem;">
                <h3 style="
                    color: var(--accent-color);
                    font-weight: 700;
                    font-size: 1rem;
                    margin: 0 0 1rem 0;
                ">
                    🤖 AI INSIGHTS${gwText}
                </h3>

                <!-- Tab Navigation -->
                <div class="ai-insights-tabs" style="
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    margin-bottom: 1rem;
                ">
                    ${categories.map((category, index) => `
                        <button
                            class="ai-insight-tab-btn"
                            data-category="${category}"
                            data-context="${contextId}"
                            style="
                                padding: 0.5rem 1rem;
                                background: ${index === 0 ? 'var(--accent-color)' : 'var(--bg-secondary)'};
                                color: ${index === 0 ? 'white' : 'var(--text-secondary)'};
                                border: 1px solid ${index === 0 ? 'var(--accent-color)' : 'var(--border-color)'};
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 0.75rem;
                                font-weight: 600;
                                transition: all 0.2s;
                                white-space: nowrap;
                            "
                            onmouseover="if(this.style.background !== 'var(--accent-color)') this.style.opacity='0.7'"
                            onmouseout="this.style.opacity='1'"
                        >
                            ${category}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Tab Content -->
            <div class="ai-insights-content" style="
                min-height: 200px;
                padding: 1rem;
                background: var(--bg-secondary);
                border-radius: 8px;
            ">
                ${categories.map((category, index) => `
                    <div
                        class="ai-insight-tab-content"
                        data-category="${category}"
                        style="display: ${index === 0 ? 'block' : 'none'};"
                    >
                        ${renderCategoryInsights(insights.categories[category])}
                    </div>
                `).join('')}
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
                Generated: ${timestamp} • Refreshes at 5am & 5pm UTC •
                <span style="opacity: 0.7;">Powered by Gemini AI</span>
            </div>
        </div>
    `;
}

/**
 * Attach event listeners to AI insights banner buttons
 * @param {string} contextId - Context identifier
 * @param {Function} onRetry - Callback function when retry is clicked (error state only)
 */
export function attachInsightBannerListeners(contextId, onRetry) {
    // Attach retry button listener (for error state only)
    const retryBtn = document.querySelector(`.ai-insights-retry-btn[data-context="${contextId}"]`);
    if (retryBtn && onRetry) {
        retryBtn.addEventListener('click', async () => {
            const originalHTML = retryBtn.innerHTML;

            // Show loading state
            retryBtn.disabled = true;
            retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';

            try {
                await onRetry();
            } finally {
                // Restore button state
                retryBtn.disabled = false;
                retryBtn.innerHTML = originalHTML;
            }
        });
    }

    // Attach tab switching listeners
    const tabBtns = document.querySelectorAll(`.ai-insight-tab-btn[data-context="${contextId}"]`);
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetCategory = btn.dataset.category;

            // Update button styles
            tabBtns.forEach(b => {
                if (b.dataset.category === targetCategory) {
                    b.style.background = 'var(--accent-color)';
                    b.style.color = 'white';
                    b.style.borderColor = 'var(--accent-color)';
                } else {
                    b.style.background = 'var(--bg-secondary)';
                    b.style.color = 'var(--text-secondary)';
                    b.style.borderColor = 'var(--border-color)';
                }
            });

            // Show/hide content
            const contents = document.querySelectorAll('.ai-insight-tab-content');
            contents.forEach(content => {
                if (content.dataset.category === targetCategory) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
        });
    });
}

/**
 * Helper function to load and render AI insights
 * Insights automatically refresh based on era schedule (5am & 5pm UTC)
 * @param {Object} context - Context for AI insights
 * @param {string} containerId - ID of container element to render into
 * @returns {Promise<void>}
 */
export async function loadAndRenderInsights(context, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }

    const contextId = `${context.page}_${context.tab}_${context.position}`;

    // Show loading state
    container.innerHTML = renderInsightBannerLoading();

    try {
        // Fetch insights (uses era-based caching automatically)
        const insights = await aiInsights.getInsights(context);

        // Render banner
        container.innerHTML = renderInsightBanner(insights, contextId);

        // Attach tab switching listeners
        attachInsightBannerListeners(contextId);

    } catch (error) {
        console.error('Failed to load AI insights:', error);
        container.innerHTML = renderInsightBannerError(
            'Failed to load AI insights',
            contextId
        );

        // Attach retry listener for error state only
        attachInsightBannerListeners(contextId, () => {
            loadAndRenderInsights(context, containerId);
        });
    }
}
