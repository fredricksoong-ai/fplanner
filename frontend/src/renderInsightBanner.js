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
 * @param {boolean} isMobile - Whether viewing on mobile device
 * @returns {string} HTML string
 */
function renderCategoryInsights(insights, isMobile = false) {
    if (!insights || insights.length === 0) {
        return `<div style="color: var(--text-secondary); font-style: italic; font-size: ${isMobile ? '0.8rem' : '1rem'};">No insights available</div>`;
    }

    const fontSize = isMobile ? '0.8rem' : '1rem';
    const marginBottom = isMobile ? '0.5rem' : '0.75rem';
    const paddingLeft = isMobile ? '1.25rem' : '1.5rem';

    return `
        <ul style="
            list-style: none;
            padding: 0;
            margin: 0;
        ">
            ${insights.map(insight => `
                <li style="
                    margin-bottom: ${marginBottom};
                    padding-left: ${paddingLeft};
                    position: relative;
                    line-height: 1.6;
                    color: var(--text-primary);
                    font-size: ${fontSize};
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
 * @param {boolean} isMobile - Whether viewing on mobile device
 * @returns {string} HTML string
 */
export function renderInsightBanner(insights, contextId, isMobile = false, options = {}) {
    const { hideTabs = false, customTitle, customSubtitle, preferredCategory, hideRegenerateButton = false } = options;

    // Handle error state (including parse errors from backend)
    if (insights.error || insights.parseError || !insights.categories || Object.keys(insights.categories).length === 0) {
        const message = insights.message || 'Unable to load AI insights';
        return renderInsightBannerError(message, contextId);
    }

    const timestamp = new Date(insights.timestamp).toLocaleTimeString();
    const categoryKeys = Object.keys(insights.categories);
    const orderedCategories = preferredCategory && categoryKeys.includes(preferredCategory)
        ? [preferredCategory, ...categoryKeys.filter(key => key !== preferredCategory)]
        : categoryKeys;

    const showTabs = !hideTabs && orderedCategories.length > 1;
    const activeCategory = orderedCategories[0];

    // Mobile-specific sizing
    const bannerPadding = isMobile ? '0.75rem' : '1.5rem';
    const bannerMargin = isMobile ? '1rem' : '2rem';
    const headerFontSize = isMobile ? '0.875rem' : '1rem';
    const tabPadding = isMobile ? '0.4rem 0.6rem' : '0.5rem 1rem';
    const tabFontSize = isMobile ? '0.7rem' : '0.75rem';
    const contentPadding = isMobile ? '0.75rem' : '1rem';
    const footerFontSize = isMobile ? '0.65rem' : '0.75rem';

    return `
        <div class="ai-insights-banner" id="ai-insights-${contextId}" style="
            background: var(--bg-primary);
            border: 2px solid var(--accent-color);
            border-radius: 12px;
            padding: ${bannerPadding};
            margin-bottom: ${bannerMargin};
            box-shadow: 0 4px 12px var(--shadow);
        ">
            <!-- Header -->
            <div style="margin-bottom: ${isMobile ? '0.75rem' : '1rem'};">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                    align-items: flex-start;
                ">
                    <div style="flex: 1 1 auto; min-width: 150px;">
                        <h3 style="
                            color: var(--accent-color);
                            font-weight: 700;
                            font-size: ${headerFontSize};
                            margin: 0 0 ${isMobile ? '0.5rem' : '0.75rem'} 0;
                        ">
                            ${customTitle || '🤖 AI Insights'}
                        </h3>
                        ${customSubtitle ? `
                            <p style="
                                color: var(--text-secondary);
                                margin: 0;
                                font-size: ${isMobile ? '0.7rem' : '0.8rem'};
                            ">
                                ${customSubtitle}
                            </p>
                        ` : ''}
                    </div>
                    ${hideRegenerateButton ? '' : `
                        <button
                            class="ai-insights-regenerate-btn"
                            data-context="${contextId}"
                            style="
                                padding: ${isMobile ? '0.4rem 0.75rem' : '0.5rem 1rem'};
                                background: transparent;
                                border: 1px solid var(--accent-color);
                                border-radius: 6px;
                                color: var(--accent-color);
                                font-size: ${isMobile ? '0.7rem' : '0.8rem'};
                                font-weight: 600;
                                cursor: pointer;
                                transition: opacity 0.2s, background 0.2s, color 0.2s;
                                display: inline-flex;
                                align-items: center;
                                gap: 0.35rem;
                                white-space: nowrap;
                            "
                            onmouseover="this.style.opacity='0.85'"
                            onmouseout="this.style.opacity='1'"
                        >
                            <i class="fas fa-redo"></i>
                            Regenerate
                        </button>
                    `}
                </div>

                ${showTabs ? `
                    <!-- Tab Navigation -->
                    <div class="ai-insights-tabs" style="
                        display: flex;
                        gap: 0.5rem;
                        flex-wrap: wrap;
                        margin-bottom: ${isMobile ? '0.75rem' : '1rem'};
                    ">
                        ${orderedCategories.map((category, index) => `
                            <button
                                class="ai-insight-tab-btn"
                                data-category="${category}"
                                data-context="${contextId}"
                                data-is-active="${index === 0}"
                                style="
                                    padding: ${tabPadding};
                                    background: ${index === 0 ? 'var(--accent-color)' : 'var(--bg-secondary)'};
                                    color: ${index === 0 ? 'white' : 'var(--text-secondary)'};
                                    border: 1px solid ${index === 0 ? 'var(--accent-color)' : 'var(--border-color)'};
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: ${tabFontSize};
                                    font-weight: 600;
                                    transition: all 0.2s;
                                    white-space: nowrap;
                                "
                            >
                                ${category}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <!-- Tab Content -->
            <div class="ai-insights-content" style="
                min-height: ${isMobile ? '150px' : '200px'};
                padding: ${contentPadding};
                background: var(--bg-secondary);
                border-radius: 8px;
            ">
                ${orderedCategories.map((category, index) => `
                    <div
                        class="ai-insight-tab-content"
                        data-category="${category}"
                        data-context="${contextId}"
                        style="display: ${(!showTabs && category === activeCategory) || (showTabs && index === 0) ? 'block' : 'none'};"
                    >
                        ${renderCategoryInsights(insights.categories[category], isMobile)}
                    </div>
                `).join('')}
            </div>

            <!-- Footer -->
            <div style="
                text-align: center;
                font-size: ${footerFontSize};
                color: var(--text-secondary);
                margin-top: ${isMobile ? '0.75rem' : '1rem'};
                padding-top: ${isMobile ? '0.75rem' : '1rem'};
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
export function attachInsightBannerListeners(contextId, { onRetry, onRegenerate } = {}) {
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

    // Attach regenerate button listener (success state)
    const regenerateBtn = document.querySelector(`.ai-insights-regenerate-btn[data-context="${contextId}"]`);
    if (regenerateBtn && onRegenerate) {
        regenerateBtn.addEventListener('click', async () => {
            const originalHTML = regenerateBtn.innerHTML;
            regenerateBtn.disabled = true;
            regenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Regenerating...';

            try {
                await onRegenerate();
            } finally {
                if (document.contains(regenerateBtn)) {
                    regenerateBtn.disabled = false;
                    regenerateBtn.innerHTML = originalHTML;
                }
            }
        });
    }

    // Attach tab switching listeners
    const tabBtns = document.querySelectorAll(`.ai-insight-tab-btn[data-context="${contextId}"]`);
    if (tabBtns.length > 0) {
        tabBtns.forEach(btn => {
            // Tab click handler
            btn.addEventListener('click', () => {
                const targetCategory = btn.dataset.category;

                // Update button styles
                tabBtns.forEach(b => {
                    const isActive = b.dataset.category === targetCategory;
                    b.dataset.isActive = isActive;

                    if (isActive) {
                        b.style.background = 'var(--accent-color)';
                        b.style.color = 'white';
                        b.style.borderColor = 'var(--accent-color)';
                        b.style.opacity = '1';
                    } else {
                        b.style.background = 'var(--bg-secondary)';
                        b.style.color = 'var(--text-secondary)';
                        b.style.borderColor = 'var(--border-color)';
                        b.style.opacity = '1';
                    }
                });

                // Show/hide content
                const contents = document.querySelectorAll(`.ai-insight-tab-content[data-context="${contextId}"]`);
                contents.forEach(content => {
                    if (content.dataset.category === targetCategory) {
                        content.style.display = 'block';
                    } else {
                        content.style.display = 'none';
                    }
                });
            });

            // Hover effects (CSP-compliant)
            btn.addEventListener('mouseenter', () => {
                if (btn.dataset.isActive !== 'true') {
                    btn.style.opacity = '0.7';
                }
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.opacity = '1';
            });
        });
    }
}

/**
 * Helper function to load and render AI insights
 * Insights automatically refresh based on era schedule (5am & 5pm UTC)
 * @param {Object} context - Context for AI insights
 * @param {string} containerId - ID of container element to render into
 * @param {boolean} isMobile - Whether viewing on mobile device
 * @returns {Promise<void>}
 */
export async function loadAndRenderInsights(context, containerId, isMobile = false, options = {}) {
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
        const insights = await aiInsights.getInsights(context, { forceRefresh: options.forceRefresh });

        // Check if there's a parse error or other error
        const hasError = insights.error || insights.parseError || !insights.categories || Object.keys(insights.categories).length === 0;

        // Render banner
        container.innerHTML = renderInsightBanner(insights, contextId, isMobile, options);

        // Attach listeners
        if (hasError) {
            // Attach retry listener with force refresh for error states
            attachInsightBannerListeners(contextId, {
                onRetry: () => loadAndRenderInsights(context, containerId, isMobile, { ...options, forceRefresh: true }),
                onRegenerate: () => loadAndRenderInsights(context, containerId, isMobile, { ...options, forceRefresh: true })
            });
        } else {
            // Attach tab switching listeners for success state
            attachInsightBannerListeners(contextId, {
                onRegenerate: () => loadAndRenderInsights(context, containerId, isMobile, { ...options, forceRefresh: true })
            });
        }

    } catch (error) {
        console.error('Failed to load AI insights:', error);
        container.innerHTML = renderInsightBannerError(
            'Failed to load AI insights',
            contextId
        );

        // Attach retry listener for error state with force refresh
        attachInsightBannerListeners(contextId, {
            onRetry: () => loadAndRenderInsights(context, containerId, isMobile, { ...options, forceRefresh: true }),
            onRegenerate: () => loadAndRenderInsights(context, containerId, isMobile, { ...options, forceRefresh: true })
        });
    }
}
