/**
 * Mobile-optimized components for My Team page
 * Utility functions for mobile device detection
 */

/**
 * Detect if user is on mobile device
 * @returns {boolean}
 */
export function isMobileDevice() {
    // Check viewport width
    const isMobileWidth = window.innerWidth <= 767;

    // Check user agent for mobile devices
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Use mobile layout if width is mobile size OR mobile user agent detected
    return isMobileWidth || isMobileUA;
}

/**
 * Check if mobile optimizations should be applied
 * @returns {boolean}
 */
export function shouldUseMobileLayout() {
    return isMobileDevice();
}
