/**
 * Pull-to-Refresh Utility
 * Implements native-like pull-to-refresh on mobile devices
 */

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
            transition: top 0.3s ease, transform 0.3s ease;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
        const pullDistance = Math.min(this.currentY - this.startY, this.maxPull);

        if (pullDistance > 0) {
            // Prevent default scroll when pulling down
            e.preventDefault();

            const progress = Math.min(pullDistance / this.threshold, 1);
            const indicatorTop = -60 + (pullDistance * 0.6); // Slower movement

            this.indicator.style.top = `${indicatorTop}px`;
            this.indicator.style.transform = `translateX(-50%) rotate(${progress * 180}deg)`;

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

        const pullDistance = this.currentY - this.startY;

        if (pullDistance >= this.threshold) {
            this.triggerRefresh();
        } else {
            this.reset();
        }

        this.pulling = false;
    }

    async triggerRefresh() {
        this.refreshing = true;

        // Show loading state
        this.indicator.style.top = '20px';
        this.indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            await this.onRefresh();
        } catch (error) {
            console.error('Refresh failed:', error);
        } finally {
            // Delay reset for visual feedback
            setTimeout(() => {
                this.reset();
                this.refreshing = false;
            }, 500);
        }
    }

    reset() {
        this.indicator.style.top = '-60px';
        this.indicator.style.transform = 'translateX(-50%) rotate(0deg)';
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
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background: var(--success-color);
        color: var(--primary-color);
        padding: 0.75rem 1.5rem;
        border-radius: 2rem;
        font-weight: 600;
        font-size: 0.875rem;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        opacity: 0;
        transition: all 0.3s ease;
    `;
    toast.innerHTML = `<i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i>${message}`;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Remove after 2 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 2000);
}

export default PullToRefresh;
