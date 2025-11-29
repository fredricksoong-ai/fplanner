/**
 * Pull-to-Refresh Utility
 * Implements native-like pull-to-refresh on mobile devices
 */

import { getShadow, getAnimationCurve, getAnimationDuration } from './styles/mobileDesignSystem.js';

/**
 * Check if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Apply rubber-band resistance to pull distance
 * Creates iOS-like elastic effect when pulling
 * @param {number} distance - Raw pull distance
 * @param {number} max - Maximum effective pull distance
 * @returns {number} Adjusted distance with rubber-band effect
 */
function applyRubberBand(distance, max) {
    if (distance <= 0) return 0;
    if (distance <= max) return distance;

    // Apply exponential decay for overpull
    const excess = distance - max;
    const resistance = 0.5; // Higher = more resistance
    return max + excess * resistance * (1 - (excess / (max * 2)));
}

class PullToRefresh {
    constructor(options = {}) {
        this.element = options.element || document.getElementById('app-container');
        this.onRefresh = options.onRefresh || (() => {});
        this.threshold = options.threshold || 80; // Pull distance to trigger
        this.maxPull = options.maxPull || 150; // Max pull distance

        this.startY = 0;
        this.currentY = 0;
        this.pulling = false;
        this.refreshing = false;

        this.indicator = null;
        this.init();
    }

    init() {
        // Create pull indicator
        this.createIndicator();

        // Add touch event listeners
        this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    }

    createIndicator() {
        const shadow = getShadow('medium');
        const springCurve = getAnimationCurve('spring');
        const standardDuration = getAnimationDuration('standard');

        this.indicator = document.createElement('div');
        this.indicator.id = 'pull-to-refresh-indicator';
        this.indicator.style.cssText = `
            position: fixed;
            top: -60px;
            left: 50%;
            transform: translateX(-50%);
            width: 40px;
            height: 40px;
            background: var(--primary-color);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.25rem;
            transition: top ${standardDuration} ${springCurve}, transform ${standardDuration} ${springCurve}, opacity ${standardDuration} ${springCurve};
            z-index: 9999;
            box-shadow: ${shadow};
            will-change: transform, top;
        `;
        this.indicator.innerHTML = '<i class="fas fa-arrow-down"></i>';
        document.body.appendChild(this.indicator);
    }

    handleTouchStart(e) {
        // Only activate if scrolled to top
        if (this.element.scrollTop === 0 && !this.refreshing) {
            this.startY = e.touches[0].clientY;
            this.pulling = true;
        }
    }

    handleTouchMove(e) {
        if (!this.pulling || this.refreshing) return;

        this.currentY = e.touches[0].clientY;
        const rawDistance = this.currentY - this.startY;

        // Apply rubber-band effect for smooth elastic feel
        const pullDistance = applyRubberBand(rawDistance, this.maxPull);

        if (pullDistance > 0) {
            // Prevent default scroll when pulling down
            e.preventDefault();

            // Disable transitions during drag for immediate feedback
            this.indicator.style.transition = 'none';

            const progress = Math.min(pullDistance / this.threshold, 1);
            // Eased indicator movement with spring-like feel
            const indicatorTop = -60 + (pullDistance * 0.5);
            const scale = 0.8 + (progress * 0.2); // Subtle scale effect

            this.indicator.style.top = `${indicatorTop}px`;
            this.indicator.style.transform = `translateX(-50%) rotate(${progress * 180}deg) scale(${scale})`;
            this.indicator.style.opacity = Math.min(progress + 0.3, 1);

            // Change icon when threshold reached
            if (pullDistance >= this.threshold) {
                this.indicator.innerHTML = '<i class="fas fa-sync-alt"></i>';
            } else {
                this.indicator.innerHTML = '<i class="fas fa-arrow-down"></i>';
            }
        }
    }

    handleTouchEnd(e) {
        if (!this.pulling || this.refreshing) return;

        // Re-enable spring transitions for smooth bounce-back
        const springCurve = getAnimationCurve('spring');
        const standardDuration = getAnimationDuration('standard');
        this.indicator.style.transition = `top ${standardDuration} ${springCurve}, transform ${standardDuration} ${springCurve}, opacity ${standardDuration} ${springCurve}`;

        const rawDistance = this.currentY - this.startY;
        const pullDistance = applyRubberBand(rawDistance, this.maxPull);

        if (pullDistance >= this.threshold) {
            this.triggerRefresh();
        } else {
            this.reset();
        }

        this.pulling = false;
    }

    async triggerRefresh() {
        // Prevent multiple simultaneous refreshes
        if (this.refreshing) {
            console.log('⏸️ Refresh already in progress, ignoring pull...');
            this.reset();
            return;
        }

        this.refreshing = true;

        // Show loading state
        this.indicator.style.top = '20px';
        this.indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            await this.onRefresh();
        } catch (error) {
            console.error('Refresh failed:', error);
            throw error; // Re-throw to let caller handle it
        } finally {
            // Delay reset for visual feedback
            setTimeout(() => {
                this.reset();
                this.refreshing = false;
            }, 500);
        }
    }

    reset() {
        // Smooth spring bounce-back
        const springCurve = getAnimationCurve('spring');
        const standardDuration = getAnimationDuration('standard');
        this.indicator.style.transition = `all ${standardDuration} ${springCurve}`;

        this.indicator.style.top = '-60px';
        this.indicator.style.transform = 'translateX(-50%) rotate(0deg) scale(1)';
        this.indicator.style.opacity = '1';
        this.indicator.innerHTML = '<i class="fas fa-arrow-down"></i>';
        this.startY = 0;
        this.currentY = 0;
    }

    destroy() {
        if (this.indicator && this.indicator.parentNode) {
            this.indicator.parentNode.removeChild(this.indicator);
        }

        this.element.removeEventListener('touchstart', this.handleTouchStart);
        this.element.removeEventListener('touchmove', this.handleTouchMove);
        this.element.removeEventListener('touchend', this.handleTouchEnd);
    }
}

/**
 * Initialize pull-to-refresh for My Team page
 * @param {function} refreshCallback - Function to call on refresh
 * @returns {PullToRefresh} Instance of PullToRefresh
 */
export function initPullToRefresh(refreshCallback) {
    // Only enable on mobile devices
    if (window.innerWidth > 767) {
        return null;
    }

    return new PullToRefresh({
        element: document.getElementById('app-container'),
        onRefresh: refreshCallback,
        threshold: 80,
        maxPull: 150
    });
}

/**
 * Show a simple refresh success toast
 */
export function showRefreshToast(message = 'Team data refreshed!') {
    showToast(message, 'success');
}

/**
 * Show a warning toast (for API errors, stale data, etc.)
 */
export function showWarningToast(message = 'Warning') {
    showToast(message, 'warning');
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'warning'
 * @param {number} duration - Duration in milliseconds (default: 3000 for warning, 2000 for success)
 */
function showToast(message, type = 'success', duration = null) {
    const shadow = getShadow('medium');
    const springCurve = getAnimationCurve('spring');
    const standardDuration = getAnimationDuration('standard');
    
    const isWarning = type === 'warning';
    const defaultDuration = isWarning ? 5000 : 2000; // Warnings stay longer
    const displayDuration = duration || defaultDuration;
    
    const bgColor = isWarning ? '#f59e0b' : 'var(--success-color)';
    const icon = isWarning ? 'fa-exclamation-triangle' : 'fa-check-circle';

    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px) scale(0.9);
        background: ${bgColor};
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 2rem;
        font-weight: 600;
        font-size: 0.875rem;
        z-index: 9999;
        box-shadow: ${shadow};
        opacity: 0;
        transition: all ${standardDuration} ${springCurve};
        max-width: 90%;
        text-align: center;
        word-wrap: break-word;
    `;
    toast.innerHTML = `<i class="fas ${icon}" style="margin-right: 0.5rem;"></i>${message}`;
    document.body.appendChild(toast);

    // Animate in with spring bounce
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    });

    // Remove after duration
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px) scale(0.9)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, parseInt(standardDuration));
    }, displayDuration);
}

export default PullToRefresh;
