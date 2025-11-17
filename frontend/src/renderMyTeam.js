// ============================================================================
// MY TEAM PAGE MODULE
// Handles team loading, display, and problem player analysis
// ============================================================================

import {
    getPlayerById,
    loadMyTeam,
    loadLeagueStandings
} from './data.js';

import {
    getPositionShort,
    getPositionType,
    formatCurrency,
    formatDecimal,
    getPtsHeatmap,
    getFormHeatmap,
    getHeatmapStyle,
    getDifficultyClass,
    getTeamShortName,
    calculatePPM,
    escapeHtml,
    calculateMinutesPercentage
} from './utils.js';

import {
    getFixtures,
    getGWOpponent,
    calculateFixtureDifficulty
} from './fixtures.js';

import {
    analyzePlayerRisks,
    hasHighRisk,
    renderRiskTooltip
} from './risk.js';

import {
    attachRiskTooltipListeners
} from './renderHelpers.js';

import {
    findReplacements,
    renderProblemPlayerRow,
    renderReplacementRow
} from './transferHelpers.js';

import {
    shouldUseMobileLayout,
    renderMobileManagerInfo,
    renderMobileTeamSummary,
    renderSwipeablePlayerCards
} from './renderMyTeamMobile.js';

import {
    renderCompactHeader,
    renderCompactTeamList,
    renderMatchSchedule
} from './renderMyTeamCompact.js';

import {
    initPullToRefresh,
    showRefreshToast
} from './pullToRefresh.js';

import {
    addSkeletonStyles
} from './mobileLoadingStates.js';

// ============================================================================
// MY TEAM PAGE
// ============================================================================

// State for My Team page
let myTeamState = {
    currentTab: 'overview', // 'overview' or 'leagues'
    teamData: null, // Cached team data
    selectedLeagues: [], // Array of selected league IDs (max 3)
    activeLeagueTab: null, // Currently active league tab (null = no league selected, or league ID)
    comparisonRivalId: null, // Currently selected rival for comparison
    comparisonRivalData: null, // Cached rival team data
    leagueStandingsCache: new Map(), // Cache for league standings API responses
    rivalTeamCache: new Map(), // Cache for rival team data
    pullToRefreshInstance: null // Pull-to-refresh instance
};

/**
 * Render My Team input form
 */
export function renderMyTeamForm() {
    const container = document.getElementById('app-container');

    const cachedTeamId = localStorage.getItem('fplanner_team_id') || '';

    // Auto-load if cached team exists
    if (cachedTeamId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>Loading your team...</p>
            </div>
        `;

        // Auto-load the cached team
        setTimeout(() => {
            loadMyTeam(cachedTeamId)
                .then(teamData => {
                    renderMyTeam(teamData);
                })
                .catch(err => {
                    console.error('Failed to auto-load team:', err);
                    // Clear bad cache and show form
                    localStorage.removeItem('fplanner_team_id');
                    renderMyTeamFormContent();
                });
        }, 100);

        return;
    }

    // No cache - show input form
    renderMyTeamFormContent();
}

/**
 * Render the actual form content
 */
function renderMyTeamFormContent() {
    const container = document.getElementById('app-container');

    container.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-users"></i> My Team Analysis
            </h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Enter your FPL Team ID to see detailed analysis with fixture difficulty, risk assessment, and recommendations
            </p>
            <div style="max-width: 500px; margin: 0 auto;">
                <input
                    type="text"
                    id="team-id-input"
                    placeholder="Enter your Team ID (e.g., 123456)"
                    style="
                        width: 100%;
                        padding: 1rem;
                        border: 2px solid var(--border-color);
                        border-radius: 8px;
                        font-size: 1rem;
                        margin-bottom: 1rem;
                        background: var(--bg-secondary);
                        color: var(--text-primary);
                    "
                >
                <button
                    id="load-team-btn"
                    style="
                        width: 100%;
                        padding: 1rem;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-search"></i> Load My Team
                </button>

                <div style="margin-top: 2rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; text-align: left;">
                    <p style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
                        <i class="fas fa-info-circle"></i> How to find your Team ID:
                    </p>
                    <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                        <li>Go to the FPL website and log in</li>
                        <li>Click on "Points" or "My Team"</li>
                        <li>Check your browser URL: https://fantasy.premierleague.com/entry/<strong>YOUR_ID</strong>/event/X</li>
                        <li>Copy the number between "/entry/" and "/event/"</li>
                    </ol>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    const loadBtn = document.getElementById('load-team-btn');
    const teamInput = document.getElementById('team-id-input');

    if (loadBtn) {
        loadBtn.addEventListener('click', () => window.loadAndRenderTeam());
        loadBtn.addEventListener('mouseenter', (e) => {
            e.target.style.background = 'var(--primary-hover)';
        });
        loadBtn.addEventListener('mouseleave', (e) => {
            e.target.style.background = 'var(--primary-color)';
        });
    }

    if (teamInput) {
        teamInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.loadAndRenderTeam();
        });
    }
}

/**
 * Handle team data refresh with rate limit protection
 * Reloads team data from API and re-renders
 */
async function handleTeamRefresh() {
    if (!myTeamState.teamData) {
        throw new Error('No team data to refresh');
    }

    const teamId = localStorage.getItem('fplanner_team_id');
    if (!teamId) {
        throw new Error('No team ID found');
    }

    // Check last refresh time to prevent rate limiting
    const lastRefresh = localStorage.getItem('fplanner_last_refresh');
    const now = Date.now();
    const MIN_REFRESH_INTERVAL = 30000; // 30 seconds minimum between refreshes

    if (lastRefresh && (now - parseInt(lastRefresh)) < MIN_REFRESH_INTERVAL) {
        const waitTime = Math.ceil((MIN_REFRESH_INTERVAL - (now - parseInt(lastRefresh))) / 1000);
        throw new Error(`Please wait ${waitTime}s before refreshing`);
    }

    console.log('🔄 Refreshing team data...');

    // Reload team data
    const freshData = await loadMyTeam(teamId);

    // Update last refresh timestamp
    localStorage.setItem('fplanner_last_refresh', now.toString());

    // Re-render with fresh data
    renderMyTeam(freshData, myTeamState.currentTab);

    console.log('✅ Team data refreshed');
}

/**
 * Render My Team page with loaded data
 * @param {Object} teamData - Team data from API
 * @param {string} subTab - Current sub-tab ('overview' or 'leagues')
 */
export function renderMyTeam(teamData, subTab = 'overview') {
    const container = document.getElementById('app-container');
    const { picks, gameweek, team } = teamData;

    console.log(`🎨 Rendering My Team for ${team.player_first_name} ${team.player_last_name}...`);

    // Cache team data and update state
    myTeamState.teamData = teamData;
    myTeamState.currentTab = subTab;

    // Load selected leagues from localStorage
    const savedLeagues = localStorage.getItem('fplanner_selected_leagues');
    if (savedLeagues) {
        try {
            myTeamState.selectedLeagues = JSON.parse(savedLeagues);
        } catch (err) {
            console.error('Failed to parse saved leagues:', err);
            myTeamState.selectedLeagues = [];
        }
    }

    // Check if mobile layout
    const useMobile = shouldUseMobileLayout();

    // Render content based on layout
    let contentHTML = '';
    if (useMobile) {
        // Mobile: Skip header/tabs, go straight to compact view
        contentHTML = renderTeamOverviewTab(teamData);
        container.innerHTML = contentHTML;
    } else {
        // Desktop: Show header and tabs
        const tabHTML = `
            <div style="margin-bottom: 2rem;">
                <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                    <i class="fas fa-users"></i> My Team
                </h1>

                <!-- Main Tabs -->
                <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border-color); margin-bottom: 1rem;">
                    <button
                        class="my-team-tab-btn"
                        data-tab="overview"
                        style="
                            padding: 0.75rem 1.5rem;
                            background: ${subTab === 'overview' ? 'var(--primary-color)' : 'transparent'};
                            color: ${subTab === 'overview' ? 'white' : 'var(--text-primary)'};
                            border: none;
                            border-bottom: 3px solid ${subTab === 'overview' ? 'var(--primary-color)' : 'transparent'};
                            cursor: pointer;
                            font-weight: 600;
                            transition: all 0.2s;
                        "
                    >
                        <i class="fas fa-users"></i> Team Overview
                    </button>
                    <button
                        class="my-team-tab-btn"
                        data-tab="leagues"
                        style="
                            padding: 0.75rem 1.5rem;
                            background: ${subTab === 'leagues' ? 'var(--primary-color)' : 'transparent'};
                            color: ${subTab === 'leagues' ? 'white' : 'var(--text-primary)'};
                            border: none;
                            border-bottom: 3px solid ${subTab === 'leagues' ? 'var(--primary-color)' : 'transparent'};
                            cursor: pointer;
                            font-weight: 600;
                            transition: all 0.2s;
                        "
                    >
                        <i class="fas fa-trophy"></i> My Leagues
                    </button>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <button
                        id="change-team-btn"
                        style="
                            padding: 8px 16px;
                            border-radius: 20px;
                            background: var(--bg-secondary);
                            color: var(--text-secondary);
                            border: 1px solid var(--border-color);
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s ease;
                        "
                    >
                        <i class="fas fa-arrow-left" style="margin-right: 6px;"></i>Change Team
                    </button>

                    <button
                        id="refresh-team-btn"
                        class="hide-desktop touch-target"
                        style="
                            padding: 8px 16px;
                            border-radius: 20px;
                            background: var(--secondary-color);
                            color: var(--primary-color);
                            border: none;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                        "
                    >
                        <i class="fas fa-sync-alt"></i>Refresh
                    </button>
                </div>
            </div>
        `;

        // Render content based on current tab
        if (subTab === 'overview') {
            contentHTML = renderTeamOverviewTab(teamData);
        } else if (subTab === 'leagues') {
            contentHTML = renderLeaguesTab(teamData);
        }

        container.innerHTML = tabHTML + contentHTML;
    }
    attachRiskTooltipListeners();

    // Add tab click event listeners
    const tabButtons = document.querySelectorAll('.my-team-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            renderMyTeam(myTeamState.teamData, tab);
        });
    });

    // Add event listener for Change Team button
    const changeTeamBtn = document.getElementById('change-team-btn');
    if (changeTeamBtn) {
        changeTeamBtn.addEventListener('click', () => window.resetMyTeam());
        changeTeamBtn.addEventListener('mouseenter', (e) => {
            e.target.style.background = 'var(--bg-tertiary)';
            e.target.style.color = 'var(--primary-color)';
            e.target.style.borderColor = 'var(--primary-color)';
        });
        changeTeamBtn.addEventListener('mouseleave', (e) => {
            e.target.style.background = 'var(--bg-secondary)';
            e.target.style.color = 'var(--text-secondary)';
            e.target.style.borderColor = 'var(--border-color)';
        });
    }

    // Add event listener for Refresh button (mobile only)
    const refreshBtn = document.getElementById('refresh-team-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('fa-spin');
            refreshBtn.disabled = true;

            try {
                await handleTeamRefresh();
                showRefreshToast('✅ Team data refreshed!');
            } catch (error) {
                console.error('Refresh failed:', error);
                // Show user-friendly error message
                showRefreshToast(error.message || '⚠️ Failed to refresh');
            } finally {
                icon.classList.remove('fa-spin');
                refreshBtn.disabled = false;
            }
        });
    }

    // Add event listeners for mobile icon buttons
    const changeTeamBtnMobile = document.getElementById('change-team-btn-mobile');
    if (changeTeamBtnMobile) {
        changeTeamBtnMobile.addEventListener('click', () => window.resetMyTeam());
    }

    const refreshBtnMobile = document.getElementById('refresh-team-btn-mobile');
    if (refreshBtnMobile) {
        refreshBtnMobile.addEventListener('click', async () => {
            const icon = refreshBtnMobile.querySelector('i');
            icon.classList.add('fa-spin');
            refreshBtnMobile.disabled = true;

            try {
                await handleTeamRefresh();
                showRefreshToast('✅ Team data refreshed!');
            } catch (error) {
                console.error('Refresh failed:', error);
                // Show user-friendly error message
                showRefreshToast(error.message || '⚠️ Failed to refresh');
            } finally {
                icon.classList.remove('fa-spin');
                refreshBtnMobile.disabled = false;
            }
        });
    }

    // Removed: expand stats button event listener (expandable section removed from compact header)

    // Set sticky table header position dynamically on mobile
    if (shouldUseMobileLayout()) {
        requestAnimationFrame(() => {
            const compactHeader = document.getElementById('compact-header');
            if (compactHeader) {
                const headerHeight = compactHeader.offsetHeight;
                const pwaHeaderHeight = 56; // 3.5rem = 56px
                const totalTop = pwaHeaderHeight + headerHeight;
                document.documentElement.style.setProperty('--compact-header-height', `${totalTop}px`);
            }
        });

        // Add event listener for change team button
        const changeTeamBtn = document.getElementById('change-team-btn');
        if (changeTeamBtn) {
            changeTeamBtn.addEventListener('click', () => {
                if (window.resetMyTeam) {
                    window.resetMyTeam();
                }
            });
        }
    }

    // Add skeleton styles for loading states
    if (shouldUseMobileLayout()) {
        addSkeletonStyles();
    }

    // Add event delegation for Problem Players toggle and replacement buttons
    container.addEventListener('click', (e) => {
        // Problem Players header toggle
        const header = e.target.closest('#problem-players-header');
        if (header) {
            window.toggleProblemPlayers();
            return;
        }

        // Toggle replacement buttons
        const btn = e.target.closest('.toggle-replacements-btn');
        if (btn) {
            const idx = parseInt(btn.dataset.idx);
            window.toggleReplacements(idx);
        }
    });

    // Add event delegation for league menu item clicks
    container.addEventListener('click', (e) => {
        const menuItem = e.target.closest('.league-menu-item');
        if (menuItem && menuItem.classList.contains('selectable')) {
            const leagueId = parseInt(menuItem.dataset.leagueId);
            toggleLeagueSelection(leagueId);
        }
    });

    // Attach league tab listeners
    attachLeagueTabListeners();

    // Add event delegation for rival team row clicks
    container.addEventListener('click', (e) => {
        const row = e.target.closest('.rival-team-row');
        if (row) {
            const rivalId = parseInt(row.dataset.rivalId);
            loadAndCompareRivalTeam(rivalId);
        }
    });

    // Add event delegation for modal close button
    container.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.close-modal-btn');
        if (closeBtn) {
            closeComparisonModal();
        }
    });
}

/**
 * Render Team Overview tab content
 */
function renderTeamOverviewTab(teamData) {
    const { picks, gameweek } = teamData;

    // Sort players by position order
    const allPlayers = picks.picks.sort((a, b) => a.position - b.position);

    // Find problem players for Transfer Committee integration
    const problemPlayersSection = renderProblemPlayersSection(allPlayers, picks, gameweek);

    // Check if mobile layout should be used
    const useMobile = shouldUseMobileLayout();

    if (useMobile) {
        // Mobile ultra-compact layout
        // Get selected league (if any) for template player comparison
        const teamId = teamData.team.id;
        const selectedLeagueId = localStorage.getItem(`fpl_selected_league_${teamId}`);

        // TODO: Fetch league members and calculate template players (>50% ownership)
        // For now, empty set until league template calculation is implemented
        const templatePlayerIds = new Set();

        console.log('Selected league for comparison:', selectedLeagueId || 'Overall (no league)');

        return `
            ${renderCompactHeader(teamData, gameweek)}

            ${renderCompactTeamList(allPlayers, gameweek, templatePlayerIds)}

            ${renderMatchSchedule(allPlayers, gameweek)}
        `;
    } else {
        // Desktop layout (original)
        return `
            <div class="mb-6">
                ${renderManagerInfo(teamData)}
            </div>

            <div class="mb-8">
                ${renderTeamSummary(allPlayers, gameweek, picks.entry_history)}
            </div>

            ${problemPlayersSection}

            <div class="mb-8">
                ${renderTeamTable(allPlayers, gameweek)}
            </div>
        `;
    }
}

/**
 * Render My Leagues tab content with side menu layout
 */
function renderLeaguesTab(teamData) {
    const { team } = teamData;

    // Set active league tab to first selected league if not set
    if (myTeamState.selectedLeagues.length > 0 && !myTeamState.activeLeagueTab) {
        myTeamState.activeLeagueTab = myTeamState.selectedLeagues[0];
    }

    const useMobile = shouldUseMobileLayout();

    const html = `
        <div style="display: ${useMobile ? 'flex' : 'grid'}; ${useMobile ? 'flex-direction: column;' : 'grid-template-columns: 300px 1fr;'} gap: 1.5rem; ${useMobile ? '' : 'height: calc(100vh - 300px);'}">
            <!-- Left Sidebar: League Selection -->
            <div id="league-selection-sidebar" style="background: var(--bg-secondary); padding: ${useMobile ? '1rem' : '1.5rem'}; border-radius: 12px; ${useMobile ? '' : 'overflow-y: auto;'}">
                <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                    <i class="fas fa-trophy"></i> Your Leagues
                </h3>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">
                    Select up to 3 leagues to track
                </p>
                ${renderLeagueSideMenu(team)}
            </div>

            <!-- Right Content: League Tabs and Standings -->
            <div style="display: flex; flex-direction: column; background: var(--bg-primary); border-radius: 12px; overflow: hidden; ${useMobile ? 'min-height: 400px' : ''}">
                ${renderLeagueTabs()}
                <div id="league-content-container" style="flex: 1; overflow-y: auto; padding: ${useMobile ? '1rem' : '1.5rem'};">
                    ${renderLeagueContent()}
                </div>
            </div>

            <!-- Modal for team comparison -->
            <div id="comparison-modal" style="display: none;"></div>
        </div>
    `;

    // Load standings after DOM is ready
    requestAnimationFrame(() => {
        if (myTeamState.activeLeagueTab) {
            loadLeagueStandingsForTab(myTeamState.activeLeagueTab);
        }
    });

    return html;
}

/**
 * Render league side menu (replaces old card grid)
 */
function renderLeagueSideMenu(team) {
    if (!team.leagues || !team.leagues.classic || team.leagues.classic.length === 0) {
        return `
            <div style="text-align: center; padding: 1rem;">
                <i class="fas fa-info-circle" style="font-size: 1.5rem; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;"></i>
                <p style="color: var(--text-secondary); font-size: 0.875rem;">No leagues found. Join a league first!</p>
            </div>
        `;
    }

    const leagues = team.leagues.classic;

    // Sort leagues by entry_rank (user's rank in league)
    const sortedLeagues = [...leagues].sort((a, b) => {
        if (!a.entry_rank) return 1;
        if (!b.entry_rank) return -1;
        return a.entry_rank - b.entry_rank;
    });

    return `
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${sortedLeagues.map(league => {
                const isSelected = myTeamState.selectedLeagues.includes(league.id);
                const canSelect = isSelected || myTeamState.selectedLeagues.length < 3;

                return `
                    <div
                        class="league-menu-item ${canSelect ? 'selectable' : 'disabled'}"
                        data-league-id="${league.id}"
                        style="
                            background: ${isSelected ? 'var(--primary-color)' : 'var(--bg-primary)'};
                            color: ${isSelected ? 'white' : 'var(--text-primary)'};
                            padding: 0.875rem;
                            border-radius: 8px;
                            border: 2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'};
                            cursor: ${canSelect ? 'pointer' : 'not-allowed'};
                            transition: all 0.2s;
                            opacity: ${canSelect ? '1' : '0.5'};
                            display: flex;
                            align-items: center;
                            gap: 0.75rem;
                        "
                    >
                        <div>
                            <i class="fas fa-${isSelected ? 'check-square' : 'square'}" style="font-size: 1.25rem;"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(league.name)}">
                                ${escapeHtml(league.name)}
                            </div>
                            <div style="font-size: 0.75rem; opacity: 0.8;">
                                Rank: ${league.entry_rank ? league.entry_rank.toLocaleString() : 'N/A'}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <p style="color: var(--text-secondary); font-size: 0.75rem; text-align: center;" id="league-selection-count">
                ${myTeamState.selectedLeagues.length}/3 leagues selected
            </p>
        </div>
    `;
}

/**
 * Render league tabs for selected leagues
 */
function renderLeagueTabs() {
    if (myTeamState.selectedLeagues.length === 0) {
        return '';
    }

    // Get team data to access league names
    const teamLeagues = myTeamState.teamData?.team?.leagues?.classic || [];

    return `
        <div class="league-tabs-container" style="display: flex; gap: 0.25rem; background: var(--bg-secondary); padding: 0.5rem; border-bottom: 2px solid var(--border-color);">
            ${myTeamState.selectedLeagues.map((leagueId, index) => {
                const isActive = myTeamState.activeLeagueTab === leagueId;

                // Try to get league name from team data first (immediate), then from standings cache
                const teamLeague = teamLeagues.find(l => l.id === leagueId);
                const leagueData = myTeamState.leagueStandingsCache.get(leagueId);
                const leagueName = teamLeague?.name || leagueData?.league?.name || `League ${index + 1}`;

                return `
                    <button
                        class="league-tab-btn"
                        data-league-id="${leagueId}"
                        style="
                            padding: 0.75rem 1.25rem;
                            background: ${isActive ? 'var(--primary-color)' : 'var(--bg-primary)'};
                            color: ${isActive ? 'white' : 'var(--text-primary)'};
                            border: none;
                            border-radius: 6px 6px 0 0;
                            cursor: pointer;
                            font-weight: ${isActive ? '600' : '500'};
                            font-size: 0.875rem;
                            transition: all 0.2s;
                            white-space: nowrap;
                            max-width: 200px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        "
                        title="${escapeHtml(leagueName)}"
                    >
                        <i class="fas fa-trophy" style="margin-right: 0.5rem; font-size: 0.75rem;"></i>
                        ${escapeHtml(leagueName)}
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render content for the active league tab
 */
function renderLeagueContent() {
    if (myTeamState.selectedLeagues.length === 0) {
        return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem;">
                <i class="fas fa-hand-pointer" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                    No Leagues Selected
                </h3>
                <p style="color: var(--text-secondary); max-width: 400px;">
                    Select up to 3 leagues from the sidebar to view detailed standings and compare with rivals.
                </p>
            </div>
        `;
    }

    if (!myTeamState.activeLeagueTab) {
        return `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Loading...</p>
            </div>
        `;
    }

    // Check if data is cached
    if (myTeamState.leagueStandingsCache.has(myTeamState.activeLeagueTab)) {
        const leagueData = myTeamState.leagueStandingsCache.get(myTeamState.activeLeagueTab);
        return renderLeagueStandings(leagueData);
    }

    // Show loading state
    return `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p>Loading league standings...</p>
        </div>
    `;
}

/**
 * Toggle league selection (with dynamic tab management)
 */
function toggleLeagueSelection(leagueId) {
    console.log(`🔄 Toggle league selection: ${leagueId}`);

    const index = myTeamState.selectedLeagues.indexOf(leagueId);
    const wasSelected = index > -1;

    if (wasSelected) {
        // Deselect - remove from selected leagues
        myTeamState.selectedLeagues.splice(index, 1);
        console.log(`➖ Deselected league ${leagueId}`);

        // If this was the active tab, switch to another tab or clear
        if (myTeamState.activeLeagueTab === leagueId) {
            myTeamState.activeLeagueTab = myTeamState.selectedLeagues[0] || null;
            console.log(`🔄 Active tab changed to: ${myTeamState.activeLeagueTab}`);
        }
    } else {
        // Select (if under limit)
        if (myTeamState.selectedLeagues.length >= 3) {
            console.warn('⚠️ Already at max 3 leagues');
            return; // Already at max, do nothing
        }
        myTeamState.selectedLeagues.push(leagueId);
        console.log(`✅ Selected league ${leagueId}`);

        // Set newly selected league as active tab
        myTeamState.activeLeagueTab = leagueId;
        console.log(`🎯 Set as active tab: ${leagueId}`);
    }

    // Save to localStorage
    localStorage.setItem('fplanner_selected_leagues', JSON.stringify(myTeamState.selectedLeagues));

    // Update UI: menu item, tabs, and content
    updateLeagueMenuItemUI(leagueId, !wasSelected);
    updateLeagueSelectionCount();
    updateLeagueTabsUI();
    updateLeagueContentUI();

    // Load data for newly selected league
    if (!wasSelected && !myTeamState.leagueStandingsCache.has(leagueId)) {
        console.log(`📥 Loading data for league ${leagueId}...`);
        loadLeagueStandingsForTab(leagueId);
    }
}

/**
 * Update a single league menu item's UI without re-rendering
 */
function updateLeagueMenuItemUI(leagueId, isSelected) {
    const menuItem = document.querySelector(`.league-menu-item[data-league-id="${leagueId}"]`);
    if (!menuItem) return;

    // Update menu item styling
    menuItem.style.background = isSelected ? 'var(--primary-color)' : 'var(--bg-primary)';
    menuItem.style.color = isSelected ? 'white' : 'var(--text-primary)';
    menuItem.style.borderColor = isSelected ? 'var(--primary-color)' : 'var(--border-color)';

    // Update icon
    const icon = menuItem.querySelector('i.fas');
    if (icon) {
        icon.className = isSelected ? 'fas fa-check-square' : 'fas fa-square';
    }

    // Update all menu items' selectability
    const allMenuItems = document.querySelectorAll('.league-menu-item');
    allMenuItems.forEach(item => {
        const itemId = parseInt(item.dataset.leagueId);
        const itemIsSelected = myTeamState.selectedLeagues.includes(itemId);
        const canSelect = itemIsSelected || myTeamState.selectedLeagues.length < 3;

        item.classList.toggle('selectable', canSelect);
        item.classList.toggle('disabled', !canSelect);
        item.style.cursor = canSelect ? 'pointer' : 'not-allowed';
        item.style.opacity = canSelect ? '1' : '0.5';
    });
}

/**
 * Update league selection count text
 */
function updateLeagueSelectionCount() {
    const countText = document.getElementById('league-selection-count');
    if (countText) {
        countText.textContent = `${myTeamState.selectedLeagues.length}/3 leagues selected`;
    }
}

/**
 * Update league tabs UI (dynamically add/remove tabs)
 */
function updateLeagueTabsUI() {
    // Find the tabs container
    const tabsContainer = document.querySelector('.league-tabs-container');
    if (!tabsContainer) {
        console.warn('⚠️ League tabs container not found');
        return;
    }

    // Re-render tabs HTML
    const newTabsHTML = renderLeagueTabs();

    if (newTabsHTML) {
        // Parse the new HTML to get just the buttons
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newTabsHTML;
        const newButtons = tempDiv.querySelector('.league-tabs-container').innerHTML;
        tabsContainer.innerHTML = newButtons;
        tabsContainer.style.display = 'flex'; // Make sure it's visible
        console.log('✅ Updated league tabs UI');
    } else {
        // No selected leagues, clear tabs
        tabsContainer.innerHTML = '';
        tabsContainer.style.display = 'none';
        console.log('🔄 Cleared league tabs (no selections)');
    }

    // Re-attach event listeners for new tabs
    attachLeagueTabListeners();
}

/**
 * Update league content UI (show content for active tab)
 */
function updateLeagueContentUI() {
    const contentContainer = document.getElementById('league-content-container');
    if (!contentContainer) return;

    contentContainer.innerHTML = renderLeagueContent();
}

/**
 * Switch to a specific league tab
 */
function switchLeagueTab(leagueId) {
    myTeamState.activeLeagueTab = leagueId;

    // Update tabs styling
    updateLeagueTabsUI();

    // Update content
    updateLeagueContentUI();

    // Load data if not cached
    if (!myTeamState.leagueStandingsCache.has(leagueId)) {
        loadLeagueStandingsForTab(leagueId);
    }
}

/**
 * Attach event listeners to league tabs
 */
function attachLeagueTabListeners() {
    const tabButtons = document.querySelectorAll('.league-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const leagueId = parseInt(e.currentTarget.dataset.leagueId);
            switchLeagueTab(leagueId);
        });
    });
}

/**
 * Load standings for a specific league tab (with caching)
 */
async function loadLeagueStandingsForTab(leagueId) {
    const contentContainer = document.getElementById('league-content-container');
    if (!contentContainer) return;

    // Check if this is still the active tab
    if (myTeamState.activeLeagueTab !== leagueId) {
        console.log(`⏭️ Skipping load for league ${leagueId} (no longer active)`);
        return;
    }

    // Check cache first
    if (myTeamState.leagueStandingsCache.has(leagueId)) {
        console.log(`✅ Using cached data for league ${leagueId}`);
        updateLeagueContentUI();
        return;
    }

    // Show loading state
    contentContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p>Loading league standings...</p>
        </div>
    `;

    try {
        // Fetch and cache
        const data = await loadLeagueStandings(leagueId);
        myTeamState.leagueStandingsCache.set(leagueId, data);

        // Update content if still active tab
        if (myTeamState.activeLeagueTab === leagueId) {
            updateLeagueContentUI();
            updateLeagueTabsUI(); // Update tab name with fetched league name
        }

    } catch (err) {
        console.error(`Failed to load league ${leagueId}:`, err);

        // Show error if still active tab
        if (myTeamState.activeLeagueTab === leagueId) {
            contentContainer.innerHTML = `
                <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; text-align: center;">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary);">Failed to load league standings. Please try again.</p>
                </div>
            `;
        }
    }
}

/**
 * Render league standings table (with richer data)
 */
function renderLeagueStandings(leagueData) {
    const { league, standings } = leagueData;
    const results = standings.results;

    if (!results || results.length === 0) {
        return `
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; text-align: center; margin-bottom: 2rem;">
                <p style="color: var(--text-secondary);">No standings data available for ${escapeHtml(league.name)}</p>
            </div>
        `;
    }

    // Find user's entry in standings
    const userTeamId = parseInt(localStorage.getItem('fplanner_team_id'));
    const userEntry = results.find(r => r.entry === userTeamId);

    // Calculate statistics
    const leaderPoints = results[0]?.total || 0;
    const userPoints = userEntry?.total || 0;
    const avgGWPoints = results.reduce((sum, r) => sum + (r.event_total || 0), 0) / results.length;

    return `
        <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); margin-bottom: 2rem;">
            <div style="margin-bottom: 1rem;">
                <h4 style="font-size: 1.125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                    <i class="fas fa-trophy"></i> ${escapeHtml(league.name)}
                </h4>
                <p style="font-size: 0.875rem; color: var(--text-secondary);">
                    ${standings.has_next ? `Showing top ${results.length} entries` : `${results.length} entries total`}
                </p>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                    <thead style="background: var(--primary-color); color: white;">
                        <tr>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Rank</th>
                            <th style="text-align: left; padding: 0.75rem 0.75rem;">Manager</th>
                            <th style="text-align: left; padding: 0.75rem 0.75rem;">Team</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Total</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;" title="Points behind leader">From 1st</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;" title="Points gap to you">Gap</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.slice(0, 50).map((entry, index) => {
                            const isUser = entry.entry === userTeamId;
                            const rowBg = isUser ? 'rgba(56, 189, 248, 0.1)' : (index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)');
                            const rankChange = entry.last_rank - entry.rank;
                            const rankChangeIcon = rankChange > 0 ? '▲' : rankChange < 0 ? '▼' : '━';
                            const rankChangeColor = rankChange > 0 ? '#22c55e' : rankChange < 0 ? '#ef4444' : 'var(--text-secondary)';

                            // Calculate points from leader
                            const fromLeader = entry.total - leaderPoints;
                            const fromLeaderText = fromLeader === 0 ? '—' : fromLeader.toLocaleString();

                            // Calculate gap to user
                            let gapText = '—';
                            let gapColor = 'var(--text-secondary)';
                            if (!isUser && userEntry) {
                                const gap = entry.total - userPoints;
                                if (gap > 0) {
                                    gapText = `+${gap}`;
                                    gapColor = '#ef4444'; // Red = ahead of you
                                } else if (gap < 0) {
                                    gapText = gap.toString();
                                    gapColor = '#22c55e'; // Green = behind you
                                }
                            }

                            // Color-code GW points based on league average
                            const gwPoints = entry.event_total || 0;
                            let gwBgColor = 'transparent';
                            let gwTextColor = 'inherit';
                            if (gwPoints > avgGWPoints + 10) {
                                gwBgColor = 'rgba(34, 197, 94, 0.15)'; // Green
                                gwTextColor = '#22c55e';
                            } else if (gwPoints < avgGWPoints - 10) {
                                gwBgColor = 'rgba(239, 68, 68, 0.15)'; // Red
                                gwTextColor = '#ef4444';
                            }

                            return `
                                <tr
                                    class="${!isUser ? 'rival-team-row' : ''}"
                                    data-rival-id="${entry.entry}"
                                    style="background: ${rowBg}; ${isUser ? 'border-left: 4px solid var(--primary-color);' : ''} ${!isUser ? 'cursor: pointer;' : ''}"
                                >
                                    <td style="padding: 0.75rem 0.5rem; text-align: center;">
                                        <div style="font-weight: 600;">${entry.rank.toLocaleString()}</div>
                                        <div style="font-size: 0.75rem; color: ${rankChangeColor};">
                                            ${rankChange !== 0 ? rankChangeIcon + ' ' + Math.abs(rankChange) : rankChangeIcon}
                                        </div>
                                    </td>
                                    <td style="padding: 0.75rem 0.75rem;">
                                        <strong>${escapeHtml(entry.player_name)}</strong>
                                        ${isUser ? ' <span style="color: var(--primary-color); font-weight: 700;">(You)</span>' : ''}
                                        ${!isUser ? ' <i class="fas fa-eye" style="margin-left: 0.5rem; color: var(--text-secondary); font-size: 0.75rem;"></i>' : ''}
                                    </td>
                                    <td style="padding: 0.75rem 0.75rem;">${escapeHtml(entry.entry_name)}</td>
                                    <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600; background: ${gwBgColor}; color: ${gwTextColor};">
                                        ${gwPoints}
                                    </td>
                                    <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${entry.total.toLocaleString()}</td>
                                    <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: var(--text-secondary);">
                                        ${fromLeaderText}
                                    </td>
                                    <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; font-weight: 600; color: ${gapColor};">
                                        ${gapText}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            ${standings.has_next ? `
                <div style="margin-top: 1rem; text-align: center;">
                    <p style="font-size: 0.875rem; color: var(--text-secondary);">
                        <i class="fas fa-info-circle"></i> Showing top 50 entries
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Load and compare rival team (with modal and caching)
 */
async function loadAndCompareRivalTeam(rivalId) {
    console.log(`Loading rival team ${rivalId} for comparison...`);

    // Update state
    myTeamState.comparisonRivalId = rivalId;

    // Get or create modal
    let modal = document.getElementById('comparison-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'comparison-modal';
        document.body.appendChild(modal);
    }

    // Show loading modal
    modal.style.display = 'block';
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <div style="text-align: center; color: white;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p style="font-size: 1.125rem;">Loading rival team for comparison...</p>
            </div>
        </div>
    `;

    try {
        // Check cache first
        let rivalTeamData;
        if (myTeamState.rivalTeamCache.has(rivalId)) {
            console.log(`✅ Using cached data for rival team ${rivalId}`);
            rivalTeamData = myTeamState.rivalTeamCache.get(rivalId);
        } else {
            // Load rival's team data
            rivalTeamData = await loadMyTeam(rivalId);
            myTeamState.rivalTeamCache.set(rivalId, rivalTeamData);
        }

        myTeamState.comparisonRivalData = rivalTeamData;

        // Render comparison in modal
        modal.innerHTML = renderComparisonModal(myTeamState.teamData, rivalTeamData);

        // Add click handler to close modal when clicking overlay
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'comparison-modal-overlay') {
                closeComparisonModal();
            }
        });

    } catch (err) {
        console.error('Failed to load rival team:', err);
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="background: var(--bg-primary); padding: 2rem; border-radius: 12px; text-align: center; max-width: 400px;">
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Failed to load rival team. Please try again.</p>
                    <button
                        class="close-modal-btn"
                        style="
                            padding: 0.5rem 1rem;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                        "
                    >
                        Close
                    </button>
                </div>
            </div>
        `;
    }
}

/**
 * Close comparison modal
 */
function closeComparisonModal() {
    const modal = document.getElementById('comparison-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
}

/**
 * Render comparison modal wrapper
 */
function renderComparisonModal(myTeamData, rivalTeamData) {
    return `
        <div
            id="comparison-modal-overlay"
            style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 1000;
                overflow-y: auto;
                padding: 2rem;
            "
        >
            <div style="
                max-width: 1400px;
                margin: 0 auto;
                background: var(--bg-primary);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                position: relative;
            ">
                ${renderTeamComparison(myTeamData, rivalTeamData)}
            </div>
        </div>
    `;
}

/**
 * Render team comparison view (side-by-side)
 */
function renderTeamComparison(myTeamData, rivalTeamData) {
    const { picks: myPicks, team: myTeam, gameweek } = myTeamData;
    const { picks: rivalPicks, team: rivalTeam } = rivalTeamData;

    // Get player IDs for both teams
    const myPlayerIds = new Set(myPicks.picks.map(p => p.element));
    const rivalPlayerIds = new Set(rivalPicks.picks.map(p => p.element));

    // Find differentials
    const myDifferentials = myPicks.picks.filter(p => !rivalPlayerIds.has(p.element));
    const rivalDifferentials = rivalPicks.picks.filter(p => !myPlayerIds.has(p.element));
    const sharedPlayers = myPicks.picks.filter(p => rivalPlayerIds.has(p.element));

    // Find captains
    const myCaptain = myPicks.picks.find(p => p.is_captain);
    const rivalCaptain = rivalPicks.picks.find(p => p.is_captain);

    return `
        <div style="padding: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                    <i class="fas fa-compress-arrows-alt"></i> Team Comparison
                </h2>
                <button
                    class="close-modal-btn"
                    style="
                        padding: 0.5rem 1rem;
                        background: var(--bg-secondary);
                        color: var(--text-secondary);
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-times"></i> Close
                </button>
            </div>

        <!-- Team Headers -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
            <!-- Your Team -->
            <div style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%); padding: 1.5rem; border-radius: 12px; color: white;">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">
                    <i class="fas fa-user"></i> ${escapeHtml(myTeam.player_first_name)} ${escapeHtml(myTeam.player_last_name)}
                </h3>
                <p style="opacity: 0.9; margin-bottom: 0.5rem;">${escapeHtml(myTeam.name)}</p>
                <p style="font-size: 0.875rem; opacity: 0.8;">GW${gameweek}: ${myPicks.entry_history.total_points} pts | Total: ${myTeam.summary_overall_points?.toLocaleString() || 0} pts</p>
            </div>

            <!-- Rival Team -->
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 1.5rem; border-radius: 12px; color: white;">
                <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">
                    <i class="fas fa-users"></i> ${escapeHtml(rivalTeam.player_first_name)} ${escapeHtml(rivalTeam.player_last_name)}
                </h3>
                <p style="opacity: 0.9; margin-bottom: 0.5rem;">${escapeHtml(rivalTeam.name)}</p>
                <p style="font-size: 0.875rem; opacity: 0.8;">GW${gameweek}: ${rivalPicks.entry_history.total_points} pts | Total: ${rivalTeam.summary_overall_points?.toLocaleString() || 0} pts</p>
            </div>
        </div>

        <!-- Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px var(--shadow);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Shared Players</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${sharedPlayers.length}</div>
            </div>
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px var(--shadow);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Your Differentials</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${myDifferentials.length}</div>
            </div>
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px var(--shadow);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Their Differentials</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #ef4444;">${rivalDifferentials.length}</div>
            </div>
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px var(--shadow);">
                <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Captain Match</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: ${myCaptain?.element === rivalCaptain?.element ? '#22c55e' : '#fb923c'};">
                    ${myCaptain?.element === rivalCaptain?.element ? 'Same' : 'Different'}
                </div>
            </div>
        </div>

        <!-- Side-by-Side Teams -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            ${renderComparisonTeamColumn(myPicks, 'Your Team', myPlayerIds, rivalPlayerIds, myCaptain, gameweek, '#3b82f6')}
            ${renderComparisonTeamColumn(rivalPicks, 'Rival Team', rivalPlayerIds, myPlayerIds, rivalCaptain, gameweek, '#ef4444')}
        </div>
        </div>
    `;
}

/**
 * Render a single team column for comparison
 */
function renderComparisonTeamColumn(picks, title, ownPlayerIds, otherPlayerIds, captain, gameweek, accentColor) {
    const players = picks.picks.sort((a, b) => a.position - b.position);

    return `
        <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem; border-bottom: 2px solid ${accentColor}; padding-bottom: 0.5rem;">
                ${title}
            </h4>
            <div style="font-size: 0.875rem;">
                ${players.map((pick, index) => {
                    const player = getPlayerById(pick.element);
                    if (!player) return '';

                    const isShared = otherPlayerIds.has(pick.element);
                    const isDifferential = !isShared;
                    const isCaptain = pick.is_captain;
                    const isVice = pick.is_vice_captain;
                    const isBench = pick.position > 11;

                    const bgColor = isDifferential ? `rgba(${accentColor === '#3b82f6' ? '59, 130, 246' : '239, 68, 68'}, 0.1)` :
                                    isShared ? 'rgba(34, 197, 94, 0.1)' : 'transparent';

                    // Separator between starting 11 and bench
                    const separator = index === 11 ? `<div style="border-top: 2px solid var(--border-color); margin: 0.5rem 0;"></div>` : '';

                    return `
                        ${separator}
                        <div style="background: ${bgColor}; padding: 0.5rem; border-radius: 6px; margin-bottom: 0.25rem; display: flex; justify-content: space-between; align-items: center; ${isBench ? 'opacity: 0.6;' : ''}">
                            <div style="flex: 1;">
                                <span style="font-weight: 600;">${escapeHtml(player.web_name)}</span>
                                ${isCaptain ? ' <span style="color: var(--primary-color); font-weight: 700;">(C)</span>' : ''}
                                ${isVice ? ' <span style="color: var(--text-secondary); font-weight: 700;">(VC)</span>' : ''}
                                <br>
                                <span style="font-size: 0.75rem; color: var(--text-secondary);">
                                    ${getPositionShort(player)} | ${getTeamShortName(player.team)}
                                </span>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600;">${player.event_points || 0} pts</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary);">${formatCurrency(player.now_cost)}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Render Problem Players section (Transfer Committee integration)
 */
function renderProblemPlayersSection(allPlayers, picks, gameweek) {
    // Find problem players
    const problemPlayers = [];
    allPlayers.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (!player) return;

        const risks = analyzePlayerRisks(player);
        if (hasHighRisk(risks) || risks.some(r => r.severity === 'medium')) {
            problemPlayers.push({
                pick: pick,
                player: player,
                risks: risks
            });
        }
    });

    // If no problem players, don't show the section
    if (problemPlayers.length === 0) {
        return '';
    }

    // Next 5 gameweeks for fixture columns
    const next5GWs = [gameweek + 1, gameweek + 2, gameweek + 3, gameweek + 4, gameweek + 5];

    let html = `
        <div class="mb-8" style="
            background: var(--bg-primary);
            border-radius: 12px;
            box-shadow: 0 2px 8px var(--shadow);
            border: 2px solid #fb923c;
        ">
            <div
                id="problem-players-header"
                style="
                padding: 1rem 1.5rem;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div>
                    <h3 style="font-size: 1.125rem; font-weight: 700; color: #fb923c; margin-bottom: 0.25rem;">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>Problem Players
                    </h3>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">
                        ${problemPlayers.length} player${problemPlayers.length !== 1 ? 's' : ''} flagged for review. Click to view replacement suggestions.
                    </p>
                </div>
                <div>
                    <i id="problem-players-icon" class="fas fa-chevron-down" style="color: var(--text-secondary); font-size: 1.25rem;"></i>
                </div>
            </div>

            <div id="problem-players-content" style="display: none; padding: 1.5rem; overflow-x: auto;">
                <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                    <thead style="background: var(--primary-color); color: white;">
                        <tr>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Pos</th>
                            <th style="text-align: left; padding: 0.75rem 0.75rem;">Player</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Team</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Diff</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">xGI/xGC</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">DefCon/90</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">Net Δ</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[0]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[1]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[2]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[3]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;">GW${next5GWs[4]}</th>
                            <th style="text-align: center; padding: 0.75rem 0.5rem;"></th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    // Render problem players with replacements
    problemPlayers.forEach((problem, idx) => {
        const { player, risks } = problem;
        const replacements = findReplacements(player, picks, gameweek);

        html += renderProblemPlayerRow(player, risks, idx, next5GWs, gameweek);

        replacements.forEach((rep, repIdx) => {
            html += renderReplacementRow(rep, player, idx, repIdx, next5GWs, gameweek);
        });
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    return html;
}

/**
 * Toggle Problem Players section visibility
 */
window.toggleProblemPlayers = function() {
    const content = document.getElementById('problem-players-content');
    const icon = document.getElementById('problem-players-icon');

    if (!content || !icon) return;

    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';

    if (isHidden) {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
};

/**
 * Render team summary cards
 */
function renderTeamSummary(players, gameweek, entryHistory) {
    // Calculate bench statistics
    const bench = players.filter(p => p.position > 11);
    let benchPoints = 0;

    bench.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (player) {
            const hasGWStats = player.github_gw && player.github_gw.gw === gameweek;
            const gwPoints = hasGWStats ? player.github_gw.total_points : player.event_points;
            benchPoints += gwPoints || 0;
        }
    });

    // Calculate squad averages
    let totalPPM = 0;
    let totalOwnership = 0;
    let totalMinPercent = 0;
    let highRiskCount = 0;

    players.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (player) {
            totalPPM += calculatePPM(player);
            totalOwnership += parseFloat(player.selected_by_percent) || 0;
            totalMinPercent += calculateMinutesPercentage(player, gameweek);

            const risks = analyzePlayerRisks(player);
            if (hasHighRisk(risks)) {
                highRiskCount++;
            }
        }
    });

    const avgPPM = totalPPM / players.length;
    const avgOwnership = totalOwnership / players.length;
    const avgMinPercent = totalMinPercent / players.length;

    // Calculate fixture difficulty for next 5 GWs
    let totalFDR = 0;
    players.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (player) {
            totalFDR += calculateFixtureDifficulty(player.team, 5);
        }
    });
    const avgFDR = totalFDR / players.length;

    return `
        <div>
            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                <i class="fas fa-chart-bar"></i> Team Analytics
            </h3>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <!-- Bench Points -->
                <div style="
                    background: var(--bg-primary);
                    padding: 1.5rem;
                    border-radius: 12px;
                    border-left: 4px solid ${benchPoints > 0 ? '#ef4444' : '#22c55e'};
                    box-shadow: 0 2px 8px var(--shadow);
                ">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                        Bench Points
                    </div>
                    <div style="font-size: 2rem; font-weight: 700; color: ${benchPoints > 0 ? '#ef4444' : 'var(--text-primary)'};">
                        ${benchPoints}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        ${benchPoints > 0 ? '⚠️ Points wasted' : '✓ No wasted points'}
                    </div>
                </div>

                <!-- Average PPM -->
                <div style="
                    background: var(--bg-primary);
                    padding: 1.5rem;
                    border-radius: 12px;
                    border-left: 4px solid var(--primary-color);
                    box-shadow: 0 2px 8px var(--shadow);
                ">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                        Avg PPM
                    </div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">
                        ${avgPPM.toFixed(1)}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        Squad value efficiency
                    </div>
                </div>

                <!-- Average Ownership -->
                <div style="
                    background: var(--bg-primary);
                    padding: 1.5rem;
                    border-radius: 12px;
                    border-left: 4px solid ${avgOwnership > 50 ? '#fb923c' : '#22c55e'};
                    box-shadow: 0 2px 8px var(--shadow);
                ">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                        Avg Ownership
                    </div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">
                        ${avgOwnership.toFixed(1)}%
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        ${avgOwnership > 50 ? 'Template heavy' : 'Differential picks'}
                    </div>
                </div>

                <!-- Fixture Difficulty -->
                <div style="
                    background: var(--bg-primary);
                    padding: 1.5rem;
                    border-radius: 12px;
                    border-left: 4px solid ${avgFDR <= 2.5 ? '#22c55e' : avgFDR <= 3.5 ? '#fb923c' : '#ef4444'};
                    box-shadow: 0 2px 8px var(--shadow);
                ">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                        Next 5 GWs FDR
                    </div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">
                        ${avgFDR.toFixed(2)}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        ${avgFDR <= 2.5 ? '✓ Excellent fixtures' : avgFDR <= 3.5 ? 'Average fixtures' : '⚠️ Tough fixtures'}
                    </div>
                </div>

                <!-- High Risk Players -->
                <div style="
                    background: var(--bg-primary);
                    padding: 1.5rem;
                    border-radius: 12px;
                    border-left: 4px solid ${highRiskCount > 2 ? '#ef4444' : highRiskCount > 0 ? '#fb923c' : '#22c55e'};
                    box-shadow: 0 2px 8px var(--shadow);
                ">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                        High Risk Players
                    </div>
                    <div style="font-size: 2rem; font-weight: 700; color: ${highRiskCount > 2 ? '#ef4444' : 'var(--text-primary)'};">
                        ${highRiskCount}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        ${highRiskCount > 2 ? '⚠️ Action needed' : highRiskCount > 0 ? 'Monitor closely' : '✓ Squad stable'}
                    </div>
                </div>

                <!-- Minutes % -->
                <div style="
                    background: var(--bg-primary);
                    padding: 1.5rem;
                    border-radius: 12px;
                    border-left: 4px solid ${avgMinPercent >= 70 ? '#22c55e' : avgMinPercent >= 50 ? '#fb923c' : '#ef4444'};
                    box-shadow: 0 2px 8px var(--shadow);
                ">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                        Avg Minutes %
                    </div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">
                        ${avgMinPercent.toFixed(0)}%
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        ${avgMinPercent >= 70 ? '✓ Regular starters' : avgMinPercent >= 50 ? 'Mixed rotation' : '⚠️ High rotation risk'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render manager info card
 */
function renderManagerInfo(teamData) {
    const { team, picks } = teamData;
    const entry = picks.entry_history;

    // Use team.summary_* fields (most accurate, from /api/entry/{teamId}/)
    const overallRank = team.summary_overall_rank || 0;
    const totalPlayers = team.last_deadline_total_players || team.total_players || 0;
    const overallPoints = team.summary_overall_points || 0;
    const gwPoints = team.summary_event_points || 0;
    const gwRank = team.summary_event_rank || 0;

    return `
        <div style="
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
            padding: 2rem;
            border-radius: 12px;
            color: white;
            box-shadow: 0 4px 12px var(--shadow);
        ">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                <div>
                    <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.25rem;">Manager</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${escapeHtml(team.player_first_name)} ${escapeHtml(team.player_last_name)}</div>
                    <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">${escapeHtml(team.name)}</div>
                </div>
                <div>
                    <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.25rem;">Overall Rank</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${overallRank.toLocaleString()}</div>
                    <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">of ${totalPlayers.toLocaleString()}</div>
                </div>
                <div>
                    <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.25rem;">Total Points</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${overallPoints.toLocaleString()}</div>
                    <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">GW${teamData.gameweek}: ${gwPoints} pts (Rank: ${gwRank.toLocaleString()})</div>
                </div>
                <div>
                    <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.25rem;">Team Value</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">£${(entry.value / 10).toFixed(1)}m</div>
                    <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">Bank: £${(entry.bank / 10).toFixed(1)}m</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render team table
 */
function renderTeamTable(players, gameweek) {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }

    // Separate starters and bench
    const starters = players.filter(p => p.position <= 11);
    const bench = players.filter(p => p.position > 11);

    // Next 5 gameweeks for fixture columns
    const next5GWs = [gameweek + 1, gameweek + 2, gameweek + 3, gameweek + 4, gameweek + 5];

    let html = `
        <div style="overflow-x: auto; background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead style="background: var(--primary-color); color: white;">
                    <tr>
                        <th style="text-align: left; padding: 0.75rem 0.5rem; white-space: nowrap;">Pos</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Opp</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Min</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">DefCon/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">xGI/xGC</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[0]}</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[1]}</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[2]}</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[3]}</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem; white-space: nowrap;">GW${next5GWs[4]}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Render starting 11
    html += renderTeamRows(starters, gameweek, next5GWs);

    // Dark purple separator line between starters and bench
    html += `<tr><td colspan="18" style="padding: 0; background: linear-gradient(90deg, #37003c, #2a002e); height: 3px;"></td></tr>`;

    // Render bench
    html += renderTeamRows(bench, gameweek, next5GWs);

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

/**
 * Render team table rows
 */
function renderTeamRows(players, gameweek, next5GWs) {
    let html = '';

    players.forEach((pick, index) => {
        const player = getPlayerById(pick.element);
        if (!player) return;

        const rowBg = index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';
        const isCaptain = pick.is_captain;
        const isVice = pick.is_vice_captain;

        let captainBadge = '';
        if (isCaptain) captainBadge = ' <span style="color: var(--primary-color); font-weight: 700;">(C)</span>';
        if (isVice) captainBadge = ' <span style="color: var(--text-secondary); font-weight: 700;">(VC)</span>';

        const gwOpp = getGWOpponent(player.team, gameweek);
        const posType = getPositionType(player);
        const risks = analyzePlayerRisks(player);
        const riskTooltip = renderRiskTooltip(risks);
        const hasHighSeverity = hasHighRisk(risks);

        // Get GW-specific stats from GitHub (only if matches current GW)
        const hasGWStats = player.github_gw && player.github_gw.gw === gameweek;

        // Minutes: use GitHub if available, otherwise show dash (will show season total in future)
        const gwMinutes = hasGWStats ? player.github_gw.minutes : '—';

        // Points: use GitHub if available, otherwise FPL API event_points
        const gwPoints = hasGWStats ? player.github_gw.total_points : (player.event_points || 0);

        // Use GW points for heatmap (not season total)
        const ptsHeatmap = getPtsHeatmap(gwPoints, 'gw_pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);

        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);

        // Get next 5 fixtures for this player
        const next5Fixtures = getFixtures(player.team, 5, false);

        // Position-specific xGI/xGC
        let metricValue = '';
        if (posType === 'GKP' || posType === 'DEF') {
            const xGC = player.expected_goals_conceded_per_90 || 0;
            metricValue = formatDecimal(xGC);
        } else {
            const xGI = player.expected_goal_involvements_per_90 || 0;
            metricValue = formatDecimal(xGI);
        }

        // Defensive contribution per 90
        const defCon = player.github_season?.defensive_contribution_per_90 || 0;
        const defConFormatted = formatDecimal(defCon);

        // Calculate additional metrics
        const ppm = calculatePPM(player);
        const ownership = parseFloat(player.selected_by_percent) || 0;

        // Transfer momentum: Use GitHub or FPL API data
        let transferNet = '—';
        let transferColor = 'inherit';
        if (player.github_transfers) {
            const netTransfers = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
            const prefix = netTransfers > 0 ? '+' : '';
            transferNet = `${prefix}${(netTransfers / 1000).toFixed(0)}k`;
            transferColor = netTransfers > 0 ? '#22c55e' : netTransfers < 0 ? '#ef4444' : 'inherit';
        } else if (player.transfers_in_event !== undefined && player.transfers_out_event !== undefined) {
            const netTransfers = player.transfers_in_event - player.transfers_out_event;
            const prefix = netTransfers > 0 ? '+' : '';
            transferNet = `${prefix}${(netTransfers / 1000).toFixed(0)}k`;
            transferColor = netTransfers > 0 ? '#22c55e' : netTransfers < 0 ? '#ef4444' : 'inherit';
        }

        html += `
            <tr style="background: ${hasHighSeverity ? 'rgba(220, 38, 38, 0.05)' : rowBg};">
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">${getPositionShort(player)}</td>
                <td style="padding: 0.75rem 0.5rem;">
                    <strong>${escapeHtml(player.web_name)}</strong>${captainBadge}
                    ${riskTooltip ? `${riskTooltip}` : ''}
                </td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">
                    <span class="${getDifficultyClass(gwOpp.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">
                        ${gwOpp.name}${gwOpp.isHome ? ' (H)' : ' (A)'}
                    </span>
                </td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">
                    ${gwMinutes}
                </td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">
                    ${gwPoints}
                </td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                    ${formatDecimal(player.form)}
                </td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${defConFormatted}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${metricValue}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                ${next5Fixtures.map((fix, idx) => {
                    const fdrClass = getDifficultyClass(fix.difficulty);
                    return `
                        <td style="padding: 0.75rem 0.5rem; text-align: center;">
                            <span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; white-space: nowrap;">
                                ${fix.opponent}
                            </span>
                        </td>
                    `;
                }).join('')}
                ${next5Fixtures.length < 5 ? Array(5 - next5Fixtures.length).fill('<td style="padding: 0.75rem 0.5rem; text-align: center;">—</td>').join('') : ''}
            </tr>
        `;
    });

    return html;
}

// ============================================================================
// GLOBAL FUNCTION BINDINGS
// ============================================================================

window.loadAndRenderTeam = async function() {
    const input = document.getElementById('team-id-input');
    const teamId = input.value.trim();

    if (!teamId) {
        alert('Please enter a team ID');
        return;
    }

    try {
        const container = document.getElementById('app-container');
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>Loading team ${escapeHtml(teamId)}...</p>
            </div>
        `;

        const teamData = await loadMyTeam(teamId);

        // CACHE TEAM ID ← ADD THIS
        localStorage.setItem('fplanner_team_id', teamId);

        renderMyTeam(teamData);
    } catch (err) {
        alert(`Failed to load team: ${err.message}`);
        renderMyTeamForm();
    }
};

window.resetMyTeam = function() {
    localStorage.removeItem('fplanner_team_id'); // Clear cache
    renderMyTeamForm();
};
