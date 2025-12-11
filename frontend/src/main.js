// ============================================================================
// MAIN MODULE
// Entry point - Navigation, initialization, theme management
// ============================================================================

import './styles.css';
import { loadFPLData, loadMyTeam, refreshData, currentGW, loadEnrichedBootstrap, getGameweekEvent, getActiveGW } from './data.js';
import { escapeHtml, formatRank } from './utils.js';
import {
    updateOwnershipThreshold as updateAnalysisOwnership,
    setFixtureFilter,
    setMomentumFilter,
    setPriceRange
} from './renderDataAnalysis.js';
import { initMobileNav, updateMobileNav } from './mobileNav.js';
import { calculateRankIndicator, calculateGWIndicator } from './myTeam/compact/compactStyleHelpers.js';
import { sharedState } from './sharedState.js';
import { showManagerModal } from './myTeam/managerModal.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let currentPage = 'my-team';
let currentSubTab = 'overview'; // For Data Analysis sub-tabs
let currentTeamId = null;
let myTeamData = null;
let currentRivalId = null; // For rival team page
let currentLeagueContext = null; // League ID when viewing rivals

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Navigate to a specific page
 * @param {string} page - Page name ('my-team', 'team-builder', 'data-analysis', 'charts', 'search', 'refresh')
 * @param {string} subTab - Optional sub-tab for pages with tabs
 */
export async function navigate(page, subTab = 'overview') {
    // Handle refresh action
    if (page === 'refresh') {
        console.log('🔄 Refresh triggered - reloading data...');
        try {
            await loadEnrichedBootstrap(true); // Force refresh
            console.log('✅ Data refreshed');
            // Re-render current page (default to my-team)
            if (currentPage === 'my-team') {
                renderPage();
            } else {
                navigate('my-team', subTab);
            }
        } catch (err) {
            console.error('❌ Failed to refresh:', err);
        }
        return;
    }

    console.log(`🧭 Navigating to: ${page}${subTab !== 'overview' ? `/${subTab}` : ''}`);

    currentPage = page;
    currentSubTab = subTab;

    // Update URL hash
    window.location.hash = subTab !== 'overview' ? `#${page}/${subTab}` : `#${page}`;

    // Update active nav link
    updateNavLinks();

    // Render the appropriate page
    renderPage();
}

/**
 * Update navigation link styles
 */
function updateNavLinks() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const page = link.dataset.page;
        if (page === currentPage) {
            link.style.background = 'rgba(255, 255, 255, 0.2)';
            link.style.fontWeight = '700';
        } else {
            link.style.background = 'transparent';
            link.style.fontWeight = '500';
        }
    });

    // Update mobile navigation as well (pass subTab for proper highlighting)
    updateMobileNav(currentPage, currentSubTab);
}

/**
 * Render the current page
 */
function renderPage() {
    const container = document.getElementById('app-container');
    
    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p>Loading ${currentPage}...</p>
        </div>
    `;
    
    // Route to appropriate render function
    switch (currentPage) {
        case 'my-team':
            renderMyTeamPage();
            break;
        case 'rival':
            renderRivalTeamPage();
            break;
        case 'team-builder':
            renderTeamBuilderPage();
            break;
        case 'data-analysis':
            renderDataAnalysis();
            break;
        case 'charts':
            renderCharts();
            break;
        case 'search':
            renderSearch();
            break;
        case 'planner':
            // Check if it's a replacement page
            if (currentSubTab === 'replace' && position) {
                renderPlayerReplacementPage(parseInt(position));
            } else {
                renderPlannerPage();
            }
            break;
        default:
            container.innerHTML = '<p>Page not found</p>';
    }
}

// ============================================================================
// PAGE RENDER FUNCTIONS
// ============================================================================

async function renderMyTeamPage() {
    const { renderMyTeamForm } = await import('./renderMyTeam.js');
    renderMyTeamForm();
}

async function renderRivalTeamPage() {
    const { renderRivalTeam } = await import('./renderRivalTeam.js');
    renderRivalTeam(currentRivalId, currentLeagueContext);
}

async function renderTeamBuilderPage() {
    const { renderTeamBuilder } = await import('./renderTeamBuilder.js');
    renderTeamBuilder();
}

async function renderDataAnalysis() {
    const { renderDataAnalysis: render } = await import('./renderDataAnalysis.js');
    render(currentSubTab);
}

async function renderCharts() {
    const { renderCharts: render } = await import('./renderCharts.js');
    render();
}

async function renderSearch() {
    const { renderSearch: render } = await import('./renderSearch.js');
    render();
}

async function renderPlannerPage() {
    const { renderPlanner } = await import('./renderPlanner.js');
    renderPlanner();
}

async function renderPlayerReplacementPage(playerId) {
    const { renderPlayerReplacementPage } = await import('./planner/replacementPage.js');
    const container = document.getElementById('app-container');
    container.innerHTML = renderPlayerReplacementPage(playerId);
    
    // Attach event listeners
    const { attachReplacementPageListeners } = await import('./planner/eventHandlers.js');
    attachReplacementPageListeners();
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update button icon only
    const button = document.getElementById('theme-toggle');
    if (newTheme === 'dark') {
        button.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        button.innerHTML = '<i class="fas fa-moon"></i>';
    }
    
    console.log(`🎨 Theme switched to: ${newTheme}`);
}

// ============================================================================
// COUNTDOWN TIMER
// ============================================================================

let countdownInterval = null;

/**
 * Start the gameweek countdown timer
 */
function startCountdown() {
    // Clear any existing interval
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000); // Update every second
}

/**
 * Update countdown display
 */
function updateCountdown() {
    const countdownText = document.getElementById('countdown-text');

    if (!countdownText) return;

    // Import from data.js module (use centralized GW functions)
    import('./data.js').then(({ fplBootstrap, getActiveGW, getGameweekEvent, isGameweekLive }) => {
        if (!fplBootstrap) {
            countdownText.textContent = 'Loading...';
            return;
        }

        const activeGW = getActiveGW();
        const nextEvent = fplBootstrap.events.find(e => e.is_next);

        let targetDate;
        let gwNumber;

        // Always show countdown to next GW deadline
        if (nextEvent) {
            targetDate = new Date(nextEvent.deadline_time);
            gwNumber = nextEvent.id;
        } else {
            countdownText.textContent = 'Season ended';
            return;
        }

        const now = new Date();
        const diff = targetDate - now;

        if (diff <= 0) {
            countdownText.textContent = 'Updating...';
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Determine urgency color
        let urgencyColor = 'white'; // Default for >3 days
        if (days < 1) {
            urgencyColor = '#ef4444'; // Red for <1 day
        } else if (days < 3) {
            urgencyColor = '#f59e0b'; // Yellow for <3 days
        }

        let timeString = '';
        if (days > 0) {
            timeString = `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            timeString = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            timeString = `${minutes}m ${seconds}s`;
        } else {
            timeString = `${seconds}s`;
        }

        countdownText.innerHTML = `<span style="color: ${urgencyColor};">GW${gwNumber}: ${timeString}</span>`;
    });
}

/**
 * Load theme - always force dark mode
 */
function loadTheme() {
    // Always use dark mode
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    console.log('🎨 Theme loaded: dark (forced)');
}

// ============================================================================
// APP INITIALIZATION
// ============================================================================

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Initializing FPLanner...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        // Load theme
        loadTheme();

        // Setup navigation
        setupNavigation();

        // Initialize mobile navigation
        initMobileNav(navigate);

        // Load FPL data from backend
        console.log('📡 Loading data from backend...');
        await loadFPLData();
        console.log('✅ Data loaded successfully');

        // Load enriched bootstrap for live_stats (includes minutes played)
        try {
            await loadEnrichedBootstrap(true);
            console.log('✅ Enriched data loaded');
        } catch (err) {
            console.warn('⚠️ Could not load enriched data:', err.message);
        }

        startCountdown();

        // Expose updateNavTeamWidget globally
        if (typeof window !== 'undefined') {
            window.updateNavTeamWidget = updateNavTeamWidget;
            
            // Update widget if team data already exists (e.g., from cache)
            if (sharedState.myTeamData) {
                updateNavTeamWidget(sharedState.myTeamData);
            }
            
            // Handle window resize to show/hide widget
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    // Re-update widget on resize to handle mobile/desktop switch
                    if (sharedState.myTeamData) {
                        updateNavTeamWidget(sharedState.myTeamData);
                    }
                }, 250);
            });
        }

        // Parse URL hash for initial page
        const hash = window.location.hash.slice(1); // Remove #
        const [page, subTab, position] = hash.split('/');

        if (page) {
            if (page === 'rival' && subTab) {
                // Handle rival/{teamId} route
                currentRivalId = parseInt(subTab);
                navigate('rival');
            } else if (page === 'planner' && subTab === 'replace' && position) {
                // Handle planner/replace/{playerId} route
                currentPage = page;
                currentSubTab = subTab;
                updateNavLinks();
                renderPlayerReplacementPage(parseInt(position));
            } else if (page === 'data-analysis' && position) {
                currentPage = page;
                currentSubTab = subTab || 'overview';
                updateNavLinks();
                renderDataAnalysis(subTab || 'overview', position);
            } else {
                navigate(page, subTab || 'overview');
            }
        } else {
            navigate('my-team');
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ FPLanner initialized successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
    } catch (err) {
        console.error('❌ Failed to initialize app:', err);
        
        const container = document.getElementById('app-container');
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--danger-color);">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">Failed to Load</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    ${escapeHtml(err.message)}
                </p>
                <button
                    id="retry-button"
                    style="
                        padding: 1rem 2rem;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                    "
                >
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;

        // Add event listener to retry button
        const retryButton = document.getElementById('retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', () => location.reload());
        }
    }
}

/**
 * Setup navigation links
 */
function setupNavigation() {
    const navContainer = document.getElementById('nav-links');
    
    const pages = [
        { id: 'my-team', label: 'My Team', icon: 'fa-users' },
        { id: 'team-builder', label: 'Team Builder', icon: 'fa-chess' },
        { id: 'data-analysis', label: 'Data Analysis', icon: 'fa-chart-bar' },
        { id: 'charts', label: 'Charts', icon: 'fa-chart-line' },
        { id: 'search', label: 'Search', icon: 'fa-search' }
    ];
    
    navContainer.innerHTML = pages.map(page => `
        <a
            href="#${page.id}"
            class="nav-link"
            data-page="${page.id}"
            style="
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 0.5rem;
                font-weight: 500;
                text-decoration: none;
                transition: all 0.2s;
                cursor: pointer;
            "
        >
            <i class="fas ${page.icon}"></i> ${page.label}
        </a>
    `).join('');

    // Add event listeners to navigation links
    const navLinks = navContainer.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        // Click handler
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigate(page);
        });

        // Hover effects
        link.addEventListener('mouseenter', () => {
            if (link.dataset.page !== currentPage) {
                link.style.background = 'rgba(255,255,255,0.1)';
            }
        });

        link.addEventListener('mouseleave', () => {
            if (link.dataset.page !== currentPage) {
                link.style.background = 'transparent';
            }
        });
    });

    updateNavLinks();
}

// ============================================================================
// NAV TEAM WIDGET
// Updates the team info widget in the navigation bar
// ============================================================================

/**
 * Calculate color for GW points based on difference from average
 * @param {number} points - User's GW points
 * @param {number} average - GW average points
 * @returns {string} Color hex code
 */
function calculatePointsColor(points, average) {
    if (!average || average === 0) return 'white';

    const diff = points - average;

    if (diff >= 15) return '#9333ea'; // Exceptional - Purple
    if (diff >= 5) return '#22c55e';  // Above average - Green
    if (diff >= -4) return '#eab308'; // On average - Yellow
    return '#ef4444';                 // Below average - Red
}

/**
 * Update the navigation team widget with team data
 * @param {Object} teamData - Team data with picks and team info
 */
export async function updateNavTeamWidget(teamData) {
    const widget = document.getElementById('nav-team-widget');
    const teamInfo = document.getElementById('nav-team-info');
    
    // Only show on mobile
    const isMobile = window.innerWidth <= 767;
    
    // Hide old team info
    if (teamInfo) {
        teamInfo.style.display = 'none';
    }
    
    if (!widget) return;
    
    if (!isMobile) {
        widget.style.display = 'none';
        return;
    }

    if (!teamData || !teamData.team || !teamData.picks) {
        widget.style.display = 'none';
        return;
    }

    const { picks, team } = teamData;
    const entry = picks.entry_history;

    // Get data
    const teamName = team.name || 'My Team';
    const squadValue = ((entry.value || 0) / 10 - (entry.bank || 0) / 10).toFixed(1);
    const bank = ((entry.bank || 0) / 10).toFixed(1);
    
    // Get ranks
    const overallRankNum = team.summary_overall_rank || 0;
    const gwRankNum = team.summary_event_rank || 0;
    const overallRankFormatted = formatRank(overallRankNum);
    const gwRankFormatted = formatRank(gwRankNum);
    
    // Calculate rank indicators
    const previousGWRank = entry?.previous_gw_rank || null;
    const rankIndicator = calculateRankIndicator(team.id, overallRankNum, previousGWRank);
    const gwIndicator = calculateGWIndicator(gwRankNum, overallRankNum);

    // Get glassmorphism for widget
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const { getGlassmorphism, getShadow, getMobileBorderRadius, getAnimationCurve, getAnimationDuration } = await import('./styles/mobileDesignSystem.js');
    const glassEffect = getGlassmorphism(isDark, 'light');
    const shadow = getShadow('low');
    const radius = getMobileBorderRadius('medium');
    const animationDuration = getAnimationDuration('fast');
    const springCurve = getAnimationCurve('spring');

    // Build widget HTML
    widget.innerHTML = `
        <div
            id="nav-team-widget-content"
            style="
                backdrop-filter: ${glassEffect.backdropFilter};
                -webkit-backdrop-filter: ${glassEffect.WebkitBackdropFilter};
                background: ${glassEffect.background};
                border: ${glassEffect.border};
                border-radius: ${radius};
                padding: 0.4rem 0.6rem;
                cursor: pointer;
                transition: all ${animationDuration} ${springCurve};
                box-shadow: ${shadow};
                display: flex;
                flex-direction: column;
                gap: 0.2rem;
                min-width: 140px;
                max-width: 200px;
                flex-shrink: 1;
            "
        >
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                <div style="font-size: 0.75rem; font-weight: 700; color: white; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(teamName)}
                </div>
                <div style="font-size: 0.7rem; color: ${rankIndicator.color}; line-height: 1.2; white-space: nowrap;">
                    ${overallRankFormatted} ${rankIndicator.chevron}
                </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                <div style="font-size: 0.65rem; color: rgba(255, 255, 255, 0.8); line-height: 1.2;">
                    (£${squadValue}m + £${bank}m)
                </div>
                <div style="font-size: 0.7rem; color: ${gwIndicator.color}; line-height: 1.2; white-space: nowrap;">
                    ${gwRankFormatted} ${gwIndicator.chevron}
                </div>
            </div>
        </div>
    `;

    widget.style.display = 'flex';
    
    // Add click handler to open Manager Modal
    const widgetContent = document.getElementById('nav-team-widget-content');
    if (widgetContent) {
        // Remove existing listeners
        const newContent = widgetContent.cloneNode(true);
        widgetContent.parentNode.replaceChild(newContent, widgetContent);
        
        newContent.addEventListener('click', () => {
            showManagerModal(teamData);
        });
    }
}

// ============================================================================
// GLOBAL FUNCTION BINDINGS (for onclick handlers)
// ============================================================================

window.navigateToPage = (page, subTab = 'overview') => {
    navigate(page, subTab);
};

window.navigateToRival = (rivalId, leagueId = null) => {
    currentRivalId = rivalId;
    currentLeagueContext = leagueId;
    window.location.hash = `#rival/${rivalId}`;
    navigate('rival');
};

window.switchAnalysisTab = (tab) => {
    currentSubTab = tab;
    renderDataAnalysis();
};

window.loadTeam = async () => {
    const input = document.getElementById('team-id-input');
    const teamId = input.value.trim();
    
    if (!teamId) {
        alert('Please enter a team ID');
        return;
    }
    
    try {
        console.log(`🔄 Loading team ${teamId}...`);
        myTeamData = await loadMyTeam(teamId);
        currentTeamId = teamId;

        // Team loaded successfully
        alert(`Team loaded! Manager: ${myTeamData.team.player_first_name} ${myTeamData.team.player_last_name}`);
        
    } catch (err) {
        alert(`Failed to load team: ${err.message}`);
    }
};

// Theme toggle removed - always dark mode

// Import and expose render functions
Promise.all([
    import('./renderDataAnalysis.js'),
    import('./renderSearch.js')
]).then(([daModule, searchModule]) => {
    window.renderDataAnalysis = daModule.renderDataAnalysis;
    window.renderSearch = searchModule.renderSearch;
});

// ============================================================================
// DATA ANALYSIS HELPER FUNCTIONS
// ============================================================================

/**
 * Switch between analysis tabs and positions
 */
window.switchAnalysisTab = (tab, position = 'all') => {
    window.location.hash = `data-analysis/${tab}/${position}`;
    window.renderDataAnalysis(tab, position);
};

/**
 * Update ownership threshold filter
 */
window.updateOwnershipThreshold = (value) => {
    document.getElementById('ownership-value').textContent = `${value}%`;

    // Update state in renderDataAnalysis module
    updateAnalysisOwnership(value);

    // Get current hash
    const hash = window.location.hash.slice(1);
    const parts = hash.split('/');
    const tab = parts[1] || 'differentials';
    const position = parts[2] || 'all';

    // Re-render with updated state
    setTimeout(() => {
        window.renderDataAnalysis(tab, position);
    }, 100);
};

/**
 * Toggle fixture quality filter
 */
window.toggleFixtureFilter = (checked) => {
    // Update state in renderDataAnalysis module
    setFixtureFilter(checked);

    // Re-render differentials
    const hash = window.location.hash.slice(1);
    const parts = hash.split('/');
    const position = parts[2] || 'all';
    setTimeout(() => {
        window.renderDataAnalysis('differentials', position);
    }, 50);
};

/**
 * Toggle momentum filter
 */
window.toggleMomentumFilter = (checked) => {
    // Update state in renderDataAnalysis module
    setMomentumFilter(checked);

    // Re-render differentials
    const hash = window.location.hash.slice(1);
    const parts = hash.split('/');
    const position = parts[2] || 'all';
    setTimeout(() => {
        window.renderDataAnalysis('differentials', position);
    }, 50);
};

/**
 * Toggle price range filter
 */
window.togglePriceRange = (range) => {
    // Update state in renderDataAnalysis module
    setPriceRange(range);

    // Re-render differentials
    const hash = window.location.hash.slice(1);
    const parts = hash.split('/');
    const position = parts[2] || 'all';
    setTimeout(() => {
        window.renderDataAnalysis('differentials', position);
    }, 50);
};

// ============================================================================
// START THE APP
// ============================================================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Handle browser back/forward
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    const [page, subTab, position] = hash.split('/');
    if (page) {
        currentPage = page;
        currentSubTab = subTab || 'overview';
        updateNavLinks();
        if (page === 'planner' && subTab === 'replace' && position) {
            renderPlayerReplacementPage(parseInt(position));
        } else if (page === 'data-analysis' && position) {
            renderDataAnalysis(subTab || 'overview', position);
        } else {
            renderPage();
        }
    }
});