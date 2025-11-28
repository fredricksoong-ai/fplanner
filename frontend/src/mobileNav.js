/**
 * Mobile Navigation Component
 * Bottom navigation bar for mobile devices
 */

import { getGlassmorphism, getShadow, getAnimationCurve, getAnimationDuration, getMobileBorderRadius } from './styles/mobileDesignSystem.js';

/**
 * Check if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Create mobile bottom navigation bar
 * @param {string} currentPage - Currently active page
 * @param {function} onNavigate - Navigation callback function
 * @returns {string} HTML for mobile bottom nav
 */
export function createMobileNav(currentPage, onNavigate) {
    const navItems = [
        { id: 'fixtures', label: 'Fixtures', icon: 'fa-calendar-alt', action: 'fixtures' },
        { id: 'league', label: 'Leagues', icon: 'fa-trophy', action: 'league' },
        { id: 'my-team', label: 'Team', icon: 'fa-users', isGreen: true },
        { id: 'planner', label: 'Planner', icon: 'fa-calendar-check', action: 'planner' },
        { id: 'stats', label: 'Stats', icon: 'fa-chart-bar', action: 'stats' }
    ];

    const glassEffect = getGlassmorphism(isDarkMode(), 'light');
    const shadow = getShadow('medium');

    const navHtml = `
        <nav
            id="mobile-bottom-nav"
            class="hide-desktop"
            style="
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                width: 100%;
                backdrop-filter: ${glassEffect.backdropFilter};
                -webkit-backdrop-filter: ${glassEffect.WebkitBackdropFilter};
                background: ${glassEffect.background};
                border-top: ${glassEffect.border};
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-top: 6px !important
                padding: 0.3rem 0.5rem;
                padding-bottom: 6px !important
                z-index: 1000;
                gap: 1.75rem;
                box-shadow: ${shadow};
            "
        >
            ${navItems.map(item => {
                const isActive = currentPage === item.id;
                const curve = getAnimationCurve('spring');
                const duration = getAnimationDuration('standard');
                const radius = getMobileBorderRadius('medium');

                return `
                <button
                    class="mobile-nav-item no-select touch-target"
                    data-page="${item.id}"
                    ${item.action ? `data-action="${item.action}"` : ''}
                    ${item.disabled ? 'disabled' : ''}
                    style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 0.2rem;
                        background: ${item.isGreen ? 'transparent' : (isActive ? 'rgba(0, 255, 136, 0.12)' : 'transparent')};
                        border: none;
                        border-radius: ${isActive ? radius : '0'};
                        padding: 0.35rem 0.4rem;
                        color: ${item.isGreen ? '#00ff88' : (item.disabled ? 'var(--text-tertiary)' : 'var(--text-primary)')};
                        cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
                        transition: all ${duration} ${curve};
                        transform: scale(1);
                        flex: 1;
                        min-height: 52px;
                        opacity: ${item.disabled ? '0.5' : '1'};
                        box-shadow: ${isActive ? '0 0 12px rgba(0, 255, 136, 0.15)' : 'none'};
                    "
                >
                    <i class="fas ${item.icon}" style="
                        font-size: 1.3rem;
                        color: ${item.isGreen ? '#00ff88' : 'inherit'};
                        transition: transform ${duration} ${curve};
                    "></i>
                    <span style="
                        font-size: 0.7rem;
                        font-weight: ${isActive || item.isGreen ? '700' : '500'};
                        white-space: nowrap;
                        color: ${item.isGreen ? '#00ff88' : 'inherit'};
                        transition: font-weight ${duration} ${curve};
                    ">${item.label}</span>
                </button>
            `;
            }).join('')}
        </nav>
    `;

    return navHtml;
}

/**
 * Initialize mobile navigation
 * Adds event listeners and handles navigation
 * @param {function} navigateCallback - Function to call when navigation occurs
 */
export function initMobileNav(navigateCallback) {
    // Add mobile nav to body
    const existingMobileNav = document.getElementById('mobile-bottom-nav');
    if (!existingMobileNav) {
        document.body.insertAdjacentHTML('beforeend', createMobileNav('my-team', navigateCallback));
    }

    // Add event listeners to mobile nav items
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Handle action buttons (League, Fixtures, Stats, Planner)
            const action = item.dataset.action;
            if (action === 'league') {
                console.log('🏆 League button clicked - navigating to leagues tab');
                // Navigate to leagues tab in my-team page
                navigateCallback('my-team', 'leagues');
                return;
            }
            if (action === 'fixtures') {
                console.log('📅 Fixtures button clicked - navigating to fixtures tab');
                // Navigate to fixtures tab in my-team page
                navigateCallback('my-team', 'fixtures');
                return;
            }
            if (action === 'stats') {
                console.log('📊 Stats button clicked - navigating to data analysis');
                // Navigate to data analysis page
                navigateCallback('data-analysis');
                return;
            }
            if (action === 'planner') {
                console.log('📋 Planner button clicked - navigating to planner');
                // Navigate to planner page
                navigateCallback('planner');
                return;
            }

            // Regular navigation
            const page = item.dataset.page;
            if (!item.disabled) {
                navigateCallback(page);
            }
        });

        // Add touch feedback with spring animation
        item.addEventListener('touchstart', () => {
            if (!item.disabled) {
                item.style.transform = 'scale(0.92)';
                const icon = item.querySelector('i');
                if (icon) {
                    icon.style.transform = 'scale(0.95)';
                }
            }
        });

        item.addEventListener('touchend', () => {
            if (!item.disabled) {
                item.style.transform = 'scale(1)';
                const icon = item.querySelector('i');
                if (icon) {
                    icon.style.transform = 'scale(1)';
                }
            }
        });
    });

    // Add padding to main content to account for bottom nav on mobile
    addMainContentPadding();
}

/**
 * Update mobile navigation active state
 * @param {string} activePage - The currently active page
 * @param {string} subTab - Optional subtab for pages with tabs
 */
export function updateMobileNav(activePage, subTab = 'overview') {
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    const radius = getMobileBorderRadius('medium');

    mobileNavItems.forEach(item => {
        const page = item.dataset.page;
        const action = item.dataset.action;

        // Special case: highlight action buttons when on their respective tabs
        let isActive = false;
        if (action === 'league' && activePage === 'my-team' && subTab === 'leagues') {
            isActive = true;
        } else if (action === 'fixtures' && activePage === 'my-team' && subTab === 'fixtures') {
            isActive = true;
        } else if (action === 'stats' && activePage === 'data-analysis') {
            isActive = true;
        } else if (action === 'planner' && activePage === 'planner') {
            isActive = true;
        } else if (page === activePage && subTab === 'overview') {
            isActive = true;
        } else {
            isActive = false;
        }

        const isTeam = page === 'my-team';

        // Update subtle green background with glow for active items
        item.style.background = isTeam ? 'transparent' : (isActive ? 'rgba(0, 255, 136, 0.12)' : 'transparent');
        item.style.borderRadius = isActive ? radius : '0';
        item.style.boxShadow = isActive ? '0 0 12px rgba(0, 255, 136, 0.15)' : 'none';

        const label = item.querySelector('span');
        if (label) {
            label.style.fontWeight = isActive || isTeam ? '700' : '500';
            if (isTeam) {
                label.style.color = '#00ff88';
            }
        }

        // Set icon color for Team button
        if (isTeam) {
            const icon = item.querySelector('i');
            if (icon) {
                icon.style.color = '#00ff88';
            }
        }
    });
}

/**
 * Add padding to main content area for mobile bottom nav
 */
function addMainContentPadding() {
    const style = document.createElement('style');
    style.id = 'mobile-nav-padding';
    style.textContent = `
        @media (max-width: 767px) {
            #app-container {
                padding-bottom: calc(4.4rem + env(safe-area-inset-bottom)) !important;
            }

            body {
                padding-bottom: 0;
                margin-bottom: 0;
            }

            /* Ensure smooth scrolling on iOS */
            body {
                -webkit-overflow-scrolling: touch;
            }
        }
    `;

    // Remove existing style if present
    const existingStyle = document.getElementById('mobile-nav-padding');
    if (existingStyle) {
        existingStyle.remove();
    }

    document.head.appendChild(style);
}

/**
 * Get current page from URL hash or default
 * @returns {string} Current page ID
 */
function getCurrentPage() {
    const hash = window.location.hash.slice(1);
    const page = hash.split('/')[0] || 'my-team';
    return page;
}

/**
 * Recreate mobile nav with updated active page
 * @param {string} currentPage - Currently active page
 */
export function refreshMobileNav(currentPage) {
    const existingNav = document.getElementById('mobile-bottom-nav');
    if (existingNav) {
        existingNav.remove();
    }

    // Re-add with updated state
    document.body.insertAdjacentHTML('beforeend', createMobileNav(currentPage, null));

    // Re-init will be handled by the navigation system
}
