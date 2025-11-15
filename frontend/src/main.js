// ============================================================================
// MAIN MODULE
// Entry point - Navigation, initialization, theme management
// ============================================================================

import './styles.css';
import { loadFPLData, loadMyTeam, refreshData, currentGW } from './data.js';
import { escapeHtml } from './utils.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let currentPage = 'my-team';
let currentSubTab = 'overview'; // For Data Analysis sub-tabs
let currentTeamId = null;
let myTeamData = null;

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Navigate to a specific page
 * @param {string} page - Page name ('my-team', 'transfer-committee', 'data-analysis', 'search')
 * @param {string} subTab - Optional sub-tab for pages with tabs
 */
export function navigate(page, subTab = 'overview') {
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
        case 'data-analysis':
            renderDataAnalysis();
            break;
        case 'search':
            renderSearch();
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

async function renderDataAnalysis() {
    const { renderDataAnalysis: render } = await import('./renderDataAnalysis.js');
    render(currentSubTab);
}

async function renderSearch() {
    const { renderSearch: render } = await import('./renderSearch.js');
    render();
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
    
    // Import from data.js module
    import('./data.js').then(({ fplBootstrap }) => {
        if (!fplBootstrap) {
            countdownText.textContent = 'Loading...';
            return;
        }
        
        const currentEvent = fplBootstrap.events.find(e => e.is_current);
        const nextEvent = fplBootstrap.events.find(e => e.is_next);
        
        let targetDate;
        let gwNumber;
        let isLive = false;
        
        if (currentEvent && !currentEvent.finished) {
            // Current GW is live
            targetDate = new Date(currentEvent.deadline_time);
            gwNumber = currentEvent.id;
            isLive = true;
        } else if (nextEvent) {
            // Next GW deadline
            targetDate = new Date(nextEvent.deadline_time);
            gwNumber = nextEvent.id;
        } else {
            countdownText.textContent = 'Season ended';
            return;
        }
        
        const now = new Date();
        const diff = targetDate - now;
        
        if (diff <= 0 && isLive) {
            countdownText.innerHTML = `<span style="color: #00ff88;">⚽ GW${gwNumber} LIVE</span>`;
            return;
        }
        
        if (diff <= 0) {
            countdownText.textContent = 'Updating...';
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
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
        
        countdownText.textContent = `GW${gwNumber}: ${timeString}`;
    });
}

/**
 * Load saved theme preference
 */
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const button = document.getElementById('theme-toggle');
    if (savedTheme === 'dark') {
        button.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    console.log(`🎨 Theme loaded: ${savedTheme}`);
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
        
        // Load FPL data from backend
        console.log('📡 Loading data from backend...');
        await loadFPLData();
        console.log('✅ Data loaded successfully');
        startCountdown();


        // Parse URL hash for initial page
        const hash = window.location.hash.slice(1); // Remove #
        const [page, subTab] = hash.split('/');
        
        if (page) {
            navigate(page, subTab || 'overview');
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
        { id: 'data-analysis', label: 'Data Analysis', icon: 'fa-chart-bar' },
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
// GLOBAL FUNCTION BINDINGS (for onclick handlers)
// ============================================================================

window.navigateToPage = (page) => {
    navigate(page);
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

window.toggleTheme = toggleTheme;

// Setup theme toggle click handler and hover effects
document.addEventListener('DOMContentLoaded', () => {
    const themeButton = document.getElementById('theme-toggle');
    if (themeButton) {
        themeButton.addEventListener('click', toggleTheme);

        // Add hover effects
        themeButton.addEventListener('mouseenter', () => {
            themeButton.style.background = 'rgba(255,255,255,0.3)';
        });
        themeButton.addEventListener('mouseleave', () => {
            themeButton.style.background = 'rgba(255,255,255,0.2)';
        });
    }
});

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
    // Get current hash
    const hash = window.location.hash.slice(1);
    const parts = hash.split('/');
    const tab = parts[1] || 'differentials';
    const position = parts[2] || 'all';

    // Re-render with new ownership value
    setTimeout(() => {
        window.renderDataAnalysis(tab, position);
    }, 100);
};

/**
 * Toggle fixture quality filter
 */
window.toggleFixtureFilter = (checked) => {
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
    const [page, subTab] = hash.split('/');
    if (page) {
        currentPage = page;
        currentSubTab = subTab || 'overview';
        renderPage();
    }
});