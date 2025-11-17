/**
 * Mobile Navigation Component
 * Bottom navigation bar for mobile devices
 */

/**
 * Create mobile bottom navigation bar
 * @param {string} currentPage - Currently active page
 * @param {function} onNavigate - Navigation callback function
 * @returns {string} HTML for mobile bottom nav
 */
export function createMobileNav(currentPage, onNavigate) {
    const navItems = [
        { id: 'change-team', label: 'Change', icon: 'fa-arrow-left', action: 'change-team' },
        { id: 'refresh', label: 'Refresh', icon: 'fa-sync-alt', action: 'refresh' },
        { id: 'my-team', label: 'Team', icon: 'fa-users' },
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
                background: var(--primary-color);
                border-top: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: space-around;
                align-items: center;
                padding: 0.5rem 0;
                padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
                box-shadow: 0 -2px 10px var(--shadow);
                z-index: 1000;
            "
        >
            ${navItems.map(item => `
                <button
                    class="mobile-nav-item no-select touch-target"
                    data-page="${item.id}"
                    ${item.action ? `data-action="${item.action}"` : ''}
                    ${item.disabled ? 'disabled' : ''}
                    style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 0.25rem;
                        background: ${currentPage === item.id ? 'rgba(255,255,255,0.2)' : 'transparent'};
                        border: none;
                        padding: 0.5rem 0.75rem;
                        border-radius: 0.5rem;
                        color: ${item.disabled ? 'rgba(255,255,255,0.4)' : 'white'};
                        cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
                        transition: all 0.2s;
                        flex: 1;
                        max-width: 80px;
                        opacity: ${item.disabled ? '0.5' : '1'};
                    "
                >
                    <i class="fas ${item.icon}" style="font-size: 1.25rem;"></i>
                    <span style="
                        font-size: 0.7rem;
                        font-weight: ${currentPage === item.id ? '700' : '500'};
                    ">${item.label}</span>
                </button>
            `).join('')}
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

            // Handle action buttons (Change Team, Refresh)
            const action = item.dataset.action;
            if (action === 'change-team') {
                if (window.resetMyTeam) {
                    window.resetMyTeam();
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
                item.style.background = 'rgba(255,255,255,0.3)';
            }
        });

        item.addEventListener('touchend', () => {
            if (!item.disabled) {
                const page = item.dataset.page;
                const currentPage = getCurrentPage();
                item.style.background = currentPage === page ? 'rgba(255,255,255,0.2)' : 'transparent';
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

        item.style.background = isActive ? 'rgba(255,255,255,0.2)' : 'transparent';
        const label = item.querySelector('span');
        if (label) {
            label.style.fontWeight = isActive ? '700' : '500';
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
                padding-bottom: calc(5rem + env(safe-area-inset-bottom)) !important;
            }

            body {
                padding-bottom: env(safe-area-inset-bottom);
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
