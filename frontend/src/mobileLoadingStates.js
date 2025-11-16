/**
 * Mobile Loading States
 * Skeleton screens and loading indicators for mobile
 */

/**
 * Render skeleton loading for player cards
 * @returns {string} HTML for skeleton cards
 */
export function renderPlayerCardSkeleton() {
    return `
        <div class="mobile-card" style="background: var(--bg-secondary); position: relative; overflow: hidden;">
            <!-- Skeleton shimmer effect -->
            <div class="skeleton-shimmer"></div>

            <!-- Header skeleton -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                <div style="flex: 1;">
                    <div class="skeleton-line" style="width: 60%; height: 16px; margin-bottom: 0.5rem;"></div>
                    <div class="skeleton-line" style="width: 40%; height: 12px;"></div>
                </div>
                <div>
                    <div class="skeleton-line" style="width: 50px; height: 20px;"></div>
                </div>
            </div>

            <!-- Stats skeleton -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.75rem;">
                <div style="text-align: center;">
                    <div class="skeleton-line" style="width: 100%; height: 24px; margin: 0 auto;"></div>
                </div>
                <div style="text-align: center;">
                    <div class="skeleton-line" style="width: 100%; height: 24px; margin: 0 auto;"></div>
                </div>
                <div style="text-align: center;">
                    <div class="skeleton-line" style="width: 100%; height: 24px; margin: 0 auto;"></div>
                </div>
            </div>

            <!-- Fixture skeleton -->
            <div class="skeleton-line" style="width: 100%; height: 32px;"></div>
        </div>
    `;
}

/**
 * Render skeleton loading for team summary
 * @returns {string} HTML for skeleton summary
 */
export function renderTeamSummarySkeleton() {
    return `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;">
            <div class="mobile-card" style="position: relative; overflow: hidden;">
                <div class="skeleton-shimmer"></div>
                <div class="skeleton-line" style="width: 60%; height: 12px; margin-bottom: 0.5rem;"></div>
                <div class="skeleton-line" style="width: 80%; height: 32px; margin-bottom: 0.5rem;"></div>
                <div class="skeleton-line" style="width: 50%; height: 10px;"></div>
            </div>
            <div class="mobile-card" style="position: relative; overflow: hidden;">
                <div class="skeleton-shimmer"></div>
                <div class="skeleton-line" style="width: 60%; height: 12px; margin-bottom: 0.5rem;"></div>
                <div class="skeleton-line" style="width: 80%; height: 32px; margin-bottom: 0.5rem;"></div>
                <div class="skeleton-line" style="width: 50%; height: 10px;"></div>
            </div>
        </div>
    `;
}

/**
 * Render full loading state for My Team mobile
 * @returns {string} HTML for full loading state
 */
export function renderMyTeamMobileLoading() {
    return `
        <div style="padding: 1rem;">
            <!-- Manager info skeleton -->
            <div class="mobile-card" style="text-align: center; position: relative; overflow: hidden;">
                <div class="skeleton-shimmer"></div>
                <div class="skeleton-line" style="width: 60%; height: 20px; margin: 0 auto 0.5rem;"></div>
                <div class="skeleton-line" style="width: 50%; height: 14px; margin: 0 auto 0.5rem;"></div>
                <div class="skeleton-line" style="width: 120px; height: 32px; margin: 0 auto;"></div>
            </div>

            <!-- Summary skeleton -->
            ${renderTeamSummarySkeleton()}

            <!-- Starting XI skeleton -->
            <div style="margin-bottom: 2rem;">
                <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">
                    <i class="fas fa-users"></i> Starting XI
                </h3>
                <div class="swipeable scroll-mobile">
                    ${Array(3).fill(0).map(() => `
                        <div style="min-width: 280px; max-width: 280px;">
                            ${renderPlayerCardSkeleton()}
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Bench skeleton -->
            <div>
                <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">
                    <i class="fas fa-couch"></i> Bench
                </h3>
                <div class="swipeable scroll-mobile">
                    ${Array(2).fill(0).map(() => `
                        <div style="min-width: 280px; max-width: 280px;">
                            ${renderPlayerCardSkeleton()}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Add skeleton CSS styles to document
 */
export function addSkeletonStyles() {
    const styleId = 'skeleton-styles';

    // Don't add if already exists
    if (document.getElementById(styleId)) {
        return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Skeleton line */
        .skeleton-line {
            background: linear-gradient(
                90deg,
                var(--bg-tertiary) 0%,
                var(--border-color) 50%,
                var(--bg-tertiary) 100%
            );
            background-size: 200% 100%;
            animation: skeleton-loading 1.5s ease-in-out infinite;
            border-radius: 0.25rem;
        }

        /* Skeleton shimmer effect */
        .skeleton-shimmer {
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                90deg,
                transparent 0%,
                rgba(255, 255, 255, 0.1) 50%,
                transparent 100%
            );
            animation: shimmer 2s infinite;
            pointer-events: none;
        }

        @keyframes skeleton-loading {
            0% {
                background-position: 200% 0;
            }
            100% {
                background-position: -200% 0;
            }
        }

        @keyframes shimmer {
            0% {
                left: -100%;
            }
            100% {
                left: 100%;
            }
        }

        /* Fade in animation for loaded content */
        .fade-in {
            animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show mobile loading state
 */
export function showMobileLoading() {
    addSkeletonStyles();
    const container = document.getElementById('app-container');
    if (container) {
        container.innerHTML = renderMyTeamMobileLoading();
    }
}

/**
 * Create a mini loading spinner for refresh
 * @returns {HTMLElement} Spinner element
 */
export function createMiniSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'mini-spinner';
    spinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    spinner.style.cssText = `
        display: inline-block;
        color: var(--secondary-color);
        font-size: 1rem;
        margin-left: 0.5rem;
    `;
    return spinner;
}
