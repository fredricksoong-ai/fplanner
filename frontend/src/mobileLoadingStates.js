/**
 * Mobile Loading States
 * Skeleton screens and loading indicators for mobile
 */

/**
 * Add skeleton CSS styles to document
 * Note: Skeleton styles are kept for potential future use, even though
 * the loading state functions that used them have been removed.
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
    `;
    document.head.appendChild(style);
}
