/**
 * Mobile Loading States
 * Skeleton screens and loading indicators for mobile with Apple glassmorphism
 */

import { getAnimationCurve, getAnimationDuration } from './styles/mobileDesignSystem.js';

/**
 * Check if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Add skeleton CSS styles to document with glassmorphism
 * Apple-style translucent loading skeletons with blur effects
 */
export function addSkeletonStyles() {
    const styleId = 'skeleton-styles';

    // Don't add if already exists
    if (document.getElementById(styleId)) {
        return;
    }

    const dark = isDarkMode();
    const standardCurve = getAnimationCurve('standard');
    const standardDuration = getAnimationDuration('standard');

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Glass-like skeleton line with translucent effect */
        .skeleton-line {
            background: ${dark
                ? 'linear-gradient(90deg, rgba(58, 58, 60, 0.4) 0%, rgba(72, 72, 74, 0.6) 50%, rgba(58, 58, 60, 0.4) 100%)'
                : 'linear-gradient(90deg, rgba(209, 209, 214, 0.4) 0%, rgba(209, 209, 214, 0.6) 50%, rgba(209, 209, 214, 0.4) 100%)'
            };
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            background-size: 200% 100%;
            animation: skeleton-loading 1.8s ${standardCurve} infinite;
            border-radius: 0.5rem;
            border: 1px solid ${dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
        }

        /* Glass shimmer effect */
        .skeleton-shimmer {
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                90deg,
                transparent 0%,
                ${dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)'} 50%,
                transparent 100%
            );
            animation: shimmer 2.5s ${standardCurve} infinite;
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
                opacity: 0;
            }
            50% {
                opacity: 1;
            }
            100% {
                left: 100%;
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
