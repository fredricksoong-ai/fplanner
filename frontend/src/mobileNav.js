/**
 * Mobile Navigation Component
 * Bottom navigation bar for mobile devices
 */

import { showLeagueSelector } from './leagueSelector.js';

/**
 * Create mobile bottom navigation bar
 * @param {string} currentPage - Currently active page
 * @param {function} onNavigate - Navigation callback function
 * @returns {string} HTML for mobile bottom nav
 */
export function createMobileNav(currentPage, onNavigate) {
    const navItems = [
        { id: 'league', label: 'League', icon: 'fa-trophy', action: 'league' },
        { id: 'my-team', label: 'Team', icon: 'fa-users' },
        { id: 'refresh', label: 'Refresh', icon: 'fa-sync-alt', action: 'refresh', isGreen: true },
        { id: 'fixtures', label: 'Fixtures', icon: 'fa-calendar-alt', disabled: true },
        { id: 'stats', label: 'Stats', icon: 'fa-chart-bar', disabled: true }
    ];

    const navHtml = `
        <nav
            id="mobile-bottom-nav"
            class="hide-desktop"
            style="
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: #37003c;
                border-top: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: space-around;
                align-items: center;
                padding: 0.25rem 0;
                padding-bottom: max(0.25rem, env(safe-area-inset-bottom));
                z-index: 1000;
            "
        >
            ${navItems.map(item => {
                // Determine icon and text color
                let iconColor = 'white';
                let textColor = 'white';
                let itemBg = currentPage === item.id ? 'rgba(255,255,255,0.2)' : 'transparent';
                
                if (item.disabled) {
                    iconColor = 'rgba(255,255,255,0.4)';
                    textColor = 'rgba(255,255,255,0.4)';
                } else if (item.isGreen) {
                    // NEW STYLING: Green background with primary text/icon color for contrast
                    iconColor = 'var(--primary-color)'; // Dark purple/primary color for icon
                    textColor = 'var(--primary-color)'; // Dark purple/primary color for text
                    itemBg = '#00ff87'; // FPL Green for background
                } else if (currentPage === item.id) {
                    // Active style for non-refresh buttons
                    itemBg = 'rgba(255,255,255,0.2)';
                }

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
                        gap: 0.15rem;
                        background: ${buttonBg};
                        border: none;
                        padding: 0.3rem 0.35rem;
                        border-radius: 0.4rem;
                        color: ${textColor};
                        cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
                        transition: all 0.2s;
                        flex: 1;
                        max-width: 70px;
                        opacity: ${item.disabled ? '0.5' : '1'};
                    "
                >
                    <i class="fas ${item.icon}" style="font-size: 1.1rem; color: ${iconColor};"></i>
                    <span style="
                        font-size: 0.65rem;
                        font-weight: ${currentPage === item.id || item.isGreen ? '700' : '500'};
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

            // Handle action buttons (League, Refresh)
            const action = item.dataset.action;
            if (action === 'league') {
                console.log('🏆 League button clicked');
                // Get team ID from window or localStorage
                const teamId = window.currentTeamId || localStorage.getItem('teamId');
                console.log('Team ID:', teamId);

                if (teamId) {
                    console.log('Opening league selector...');
                    try {
                        showLeagueSelector(parseInt(teamId, 10), (leagueId) => {
                            console.log('✅ League selected:', leagueId);
                            // Trigger refresh to update template players
                            if (window.handleTeamRefresh) {
                                window.handleTeamRefresh();
                            }
                        });
                    } catch (error) {
                        console.error('❌ Error opening league selector:', error);
                    }
                } else {
                    console.error('❌ No team ID found');
                }
                return;
            }
            if (action === 'refresh') {
                const icon = item.querySelector('i');
                const originalIcon = icon.className;
                icon.className = 'fas fa-sync-alt fa-spin';
                item.disabled = true;

                // Trigger refresh
                if (window.handleTeamRefresh) {
                    window.handleTeamRefresh()
                        .then(() => {
                            console.log('✅ Team refreshed from bottom nav');
                        })
                        .catch((error) => {
                            console.error('❌ Refresh failed:', error);
                        })
                        .finally(() => {
                            icon.className = originalIcon;
                            item.disabled = false;
                        });
                } else {
                    // Fallback: reload page
                    window.location.reload();
                }
                return;
            }

            // Regular navigation
            const page = item.dataset.page;
            if (!item.disabled) {
                navigateCallback(page);
            }
        });

        // Add touch feedback
        item.addEventListener('touchstart', () => {
            if (!item.disabled) {
                item.style.background = 'rgba(255,255,255,0.25)';
            }
        });

        item.addEventListener('touchend', () => {
            if (!item.disabled) {
                const page = item.dataset.page;
                const currentPage = getCurrentPage();
                const isRefresh = item.dataset.action === 'refresh';
                item.style.background = isRefresh ? '#00ff87' : (currentPage === page ? 'rgba(255,255,255,0.15)' : 'transparent');
            }
        });
    });

    // Add padding to main content to account for bottom nav on mobile
    addMainContentPadding();
}

/**
 * Update mobile navigation active state
 * @param {string} activePage - The currently active page
 */
export function updateMobileNav(activePage) {
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        const page = item.dataset.page;
        const isActive = page === activePage;
        const isRefresh = item.dataset.action === 'refresh';

        item.style.background = isRefresh ? '#00ff87' : (isActive ? 'rgba(255,255,255,0.15)' : 'transparent');
        const label = item.querySelector('span');
        if (label) {
            label.style.fontWeight = isActive || item.dataset.action === 'refresh' ? '700' : '500';
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
                /* Reduced from 5rem to 3.5rem to fix overlap while maintaining safe space */
                padding-bottom: calc(3.5rem + env(safe-area-inset-bottom)) !important;
            }

            body {
                padding-bottom: 0;
                margin-bottom: 0;
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
