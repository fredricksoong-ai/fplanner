// ============================================================================
// MY TEAM PAGE MODULE
// Handles team loading, display, and problem player analysis
// ============================================================================

import {
    getPlayerById,
    loadMyTeam,
    loadLeagueStandings,
    fplFixtures as getFixturesData,
    fplBootstrap as getBootstrapData,
    loadEnrichedBootstrap,
    isGameweekLive,
    getActiveGW,
    startAutoRefresh,
    stopAutoRefresh,
    isAutoRefreshActive
} from './data.js';

import { sharedState } from './sharedState.js';

import {
    loadAndRenderLeagueInfo
} from './leagueInfo.js';

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
    calculateBenchPoints,
    calculateSquadAverages,
    classifyFixtureDifficulty,
    classifyRiskLevel,
    classifyMinutesPercentage,
    classifyOwnership,
    classifyBenchPoints
} from './myTeam/teamSummaryHelpers.js';

import {
    analyzeDifferentials,
    compareCaptains,
    extractPlayerIds
} from './myTeam/teamComparisonHelpers.js';

import { renderTeamSummary } from './myTeam/teamSummary.js';
import { renderTeamComparison } from './myTeam/teamComparison.js';
import { renderManagerInfo } from './myTeam/managerInfo.js';
import { renderFixturesTab, renderMobileFixturesTab, attachFixtureRowListeners, attachMobileFixtureRowListeners } from './myTeam/fixturesTab.js';
import { renderTeamTable } from './myTeam/teamTable.js';

import {
    renderLeaguesTab as renderLeaguesTabModule,
    renderLeagueSideMenu,
    toggleLeagueSelection as toggleLeagueSelectionModule,
    updateLeagueMenuItemUI as updateLeagueMenuItemUIModule,
    updateLeagueSelectionCount as updateLeagueSelectionCountModule,
    switchLeagueTab as switchLeagueTabModule,
    attachLeagueTabListeners as attachLeagueTabListenersModule
} from './myTeam/leagueManagement.js';

import {
    renderLeagueTabs,
    renderLeagueContent,
    updateLeagueTabsUI as updateLeagueTabsUIModule,
    updateLeagueContentUI as updateLeagueContentUIModule,
    loadLeagueStandingsForTab as loadLeagueStandingsForTabModule,
    loadMobileLeagueStandings,
    renderLeagueStandings,
    loadAndCompareRivalTeam as loadAndCompareRivalTeamModule,
    closeComparisonModal,
    renderComparisonModal
} from './myTeam/leagueStandings.js';

import {
    attachRiskTooltipListeners
} from './renderHelpers.js';

import {
    findReplacements,
    renderProblemPlayerRow,
    renderReplacementRow
} from './transferHelpers.js';

import {
    renderProblemPlayersSection as renderProblemPlayersSectionModule,
    toggleProblemPlayersVisibility
} from './myTeam/problemPlayers.js';

import {
    shouldUseMobileLayout
} from './renderMyTeamMobile.js';

import {
    renderCompactHeader,
    renderCompactTeamList,
    renderMatchSchedule,
    attachPlayerRowListeners,
    attachTransferListeners,
    showPlayerModal
} from './renderMyTeamCompact.js';

import {
    showRefreshToast
} from './pullToRefresh.js';

import {
    addSkeletonStyles
} from './mobileLoadingStates.js';

// ============================================================================
// MY TEAM PAGE
// ============================================================================

// State for My Team page (uses shared state for caches)
let myTeamState = {
    currentTab: 'overview', // 'overview', 'leagues', or 'fixtures'
    teamData: null, // Cached team data
    selectedLeagues: [], // Array of selected league IDs (max 3)
    activeLeagueTab: null, // Currently active league tab (null = no league selected, or league ID)
    comparisonRivalId: null, // Currently selected rival for comparison
    comparisonRivalData: null, // Cached rival team data
    leagueStandingsCache: sharedState.leagueStandingsCache, // Shared cache for league standings
    rivalTeamCache: sharedState.rivalTeamCache, // Shared cache for rival team data
    captainCache: sharedState.captainCache, // Shared cache for captain names
    pullToRefreshInstance: null, // Pull-to-refresh instance
    autoRefreshStarted: false // Track if auto-refresh has been started
};

let teamDataRefreshCount = 0; // Track refresh cycles for periodic team data refresh

/**
 * Setup auto-refresh for Team page during live GW
 */
function setupTeamAutoRefresh() {
    const activeGW = getActiveGW();
    const isLive = isGameweekLive(activeGW);

    if (isLive && !myTeamState.autoRefreshStarted) {
        myTeamState.autoRefreshStarted = true;
        console.log('⏰ Auto-refresh will start in 2 minutes...');

        setTimeout(() => {
            const stillLive = isGameweekLive(getActiveGW());
            if (stillLive) {
                teamDataRefreshCount = 0;
                startAutoRefresh(async () => {
                    // Refresh enriched bootstrap every 2 min
                    await loadEnrichedBootstrap(true);

                    // Refresh team data every 3rd cycle (every 6 min)
                    teamDataRefreshCount++;
                    if (teamDataRefreshCount >= 3) {
                        teamDataRefreshCount = 0;
                        const teamId = localStorage.getItem('fplanner_team_id');
                        if (teamId) {
                            console.log('🔄 Refreshing team data...');
                            try {
                                const teamData = await loadMyTeam(teamId, { forceRefresh: true });
                                myTeamState.teamData = teamData;
                            } catch (err) {
                                console.error('Failed to refresh team data:', err);
                            }
                        }
                    }

                    // Re-render current tab
                    if (myTeamState.teamData) {
                        renderMyTeam(myTeamState.teamData, myTeamState.currentTab);
                    }
                });
            }
        }, 2 * 60 * 1000); // 2 minutes delay
    } else if (!isLive) {
        stopAutoRefresh();
        myTeamState.autoRefreshStarted = false;
    }
}

/**
 * Render My Team input form
 */
export function renderMyTeamForm() {
    const container = document.getElementById('app-container');

    const cachedTeamId = localStorage.getItem('fplanner_team_id') || '';

    // Check URL hash for subtab (e.g., #my-team/fixtures)
    const hash = window.location.hash.slice(1);
    const [page, subTab] = hash.split('/');
    const targetSubTab = subTab || 'overview';

    // Special case: fixtures tab doesn't require team data
    if (targetSubTab === 'fixtures') {
        const useMobile = shouldUseMobileLayout();
        const renderFixturesOnly = () => {
            if (useMobile) {
                container.innerHTML = renderMobileFixturesTab();
                requestAnimationFrame(() => {
                    attachMobileFixtureRowListeners();
                });
            } else {
                container.innerHTML = renderFixturesTab();
                requestAnimationFrame(() => {
                    attachFixtureRowListeners();
                });
            }
        };

        renderFixturesOnly();

        if (cachedTeamId) {
            setTimeout(() => {
                loadMyTeam(cachedTeamId)
                    .then(teamData => {
                        window.currentTeamId = cachedTeamId;
                        renderMyTeam(teamData, targetSubTab);
                    })
                    .catch(err => {
                        console.error('Failed to auto-load team:', err);
                        localStorage.removeItem('fplanner_team_id');
                        renderMyTeamFormContent();
                    });
            }, 100);
        }

        return;
    }

    // Auto-load if cached team exists
    if (cachedTeamId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>Loading your team...</p>
            </div>
        `;

        // targetSubTab already set above

        // Auto-load the cached team
        setTimeout(() => {
            loadMyTeam(cachedTeamId)
                .then(teamData => {
                    window.currentTeamId = cachedTeamId; // Expose globally for mobile nav
                    renderMyTeam(teamData, targetSubTab);
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
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--secondary-color); margin-bottom: 1rem;">
            Welcome to Hell
            </h1>
            <div style="max-width: 500px; margin: 0 auto;">
                <input
                    type="text"
                    id="team-id-input"
                    placeholder="Enter Team ID (e.g., 123456)"
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
                        <i class="fas fa-info-circle"></i> How to locate your Team ID:
                    </p>
                    <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; word-break: break-word;">
                        <li>1. Visit FPL Website</li>
                        <li>Click on "Points" or "My Team"</li>
                        <li>Check browser URL: ...com/entry/<strong>YOUR_TEAM_ID</strong>/event/X</li>
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
    const freshData = await loadMyTeam(teamId, { forceRefresh: true });

    // Update last refresh timestamp
    localStorage.setItem('fplanner_last_refresh', now.toString());

    // Invalidate league standings cache so they refresh with updated points
    if (myTeamState.activeLeagueTab) {
        console.log('🔄 Invalidating league standings cache...');
        myTeamState.leagueStandingsCache.delete(myTeamState.activeLeagueTab);
    }

    // Re-render with fresh data
    renderMyTeam(freshData, myTeamState.currentTab);

    // Refresh active league standings if on leagues tab
    // First invalidate cache for ALL selected leagues, not just active one
    myTeamState.selectedLeagues.forEach(leagueId => {
        myTeamState.leagueStandingsCache.delete(leagueId);
        console.log(`🔄 Invalidated cache for league ${leagueId}`);
    });
    
    // Refresh active league standings if on leagues tab
    if (myTeamState.currentTab === 'leagues' && myTeamState.activeLeagueTab) {
        console.log('🔄 Refreshing active league standings...');
        // Force reload by clearing cache first
        myTeamState.leagueStandingsCache.delete(myTeamState.activeLeagueTab);
        setTimeout(() => {
            loadLeagueStandingsForTab(myTeamState.activeLeagueTab);
        }, 500); // Small delay to ensure DOM is ready
    }

    console.log('✅ Team data refreshed');
}

// Expose handleTeamRefresh globally for mobile nav and other components
window.handleTeamRefresh = handleTeamRefresh;

/**
 * Render My Team page with loaded data
 * @param {Object} teamData - Team data from API (can be null for fixtures tab)
 * @param {string} subTab - Current sub-tab ('overview', 'leagues', or 'fixtures')
 */
export function renderMyTeam(teamData, subTab = 'overview') {
    const container = document.getElementById('app-container');
    
    // Special case: fixtures tab can render without team data
    if (subTab === 'fixtures' && !teamData) {
        const useMobile = shouldUseMobileLayout();
        if (useMobile) {
            container.innerHTML = renderMobileFixturesTab();
            requestAnimationFrame(() => {
                attachMobileFixtureRowListeners();
            });
        } else {
            container.innerHTML = renderFixturesTab();
            requestAnimationFrame(() => {
                attachFixtureRowListeners();
            });
        }
        return;
    }
    
    // Rest of function requires teamData
    if (!teamData) {
        console.warn('⚠️ Team data required for non-fixtures tabs');
        renderMyTeamForm();
        return;
    }
    
    const { picks, gameweek, team } = teamData;

    console.log(`🎨 Rendering My Team for ${team.player_first_name} ${team.player_last_name}...`);

    // Cache team data and update state
    myTeamState.teamData = teamData;
    myTeamState.currentTab = subTab;
    sharedState.updateTeamData(teamData);

    // Setup auto-refresh for live GW
    setupTeamAutoRefresh();

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
        // Mobile: Render based on subTab
        if (subTab === 'leagues') {
            contentHTML = renderMobileLeaguesTab(teamData);
        } else if (subTab === 'fixtures') {
            contentHTML = renderMobileFixturesTab();
        } else {
            contentHTML = renderTeamOverviewTab(teamData);
        }
        container.innerHTML = contentHTML;

        // Attach event listeners based on tab
        requestAnimationFrame(() => {
            if (subTab === 'overview') {
                attachPlayerRowListeners(myTeamState);
                attachTransferListeners();
            } else if (subTab === 'fixtures') {
                attachMobileFixtureRowListeners();
            }
        });
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
                    <button
                        class="my-team-tab-btn"
                        data-tab="fixtures"
                        style="
                            padding: 0.75rem 1.5rem;
                            background: ${subTab === 'fixtures' ? 'var(--primary-color)' : 'transparent'};
                            color: ${subTab === 'fixtures' ? 'white' : 'var(--text-primary)'};
                            border: none;
                            border-bottom: 3px solid ${subTab === 'fixtures' ? 'var(--primary-color)' : 'transparent'};
                            cursor: pointer;
                            font-weight: 600;
                            transition: all 0.2s;
                        "
                    >
                        <i class="fas fa-calendar-alt"></i> Fixtures
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
        } else if (subTab === 'fixtures') {
            contentHTML = renderFixturesTab();
        }

        container.innerHTML = tabHTML + contentHTML;
        
        // Attach fixture row listeners if on fixtures tab
        if (subTab === 'fixtures') {
            requestAnimationFrame(() => {
                if (useMobile) {
                    attachMobileFixtureRowListeners();
                } else {
                    attachFixtureRowListeners();
                }
            });
        }
    }
    attachRiskTooltipListeners();

    // Attach player modal listeners for desktop table rows
    if (!useMobile) {
        requestAnimationFrame(() => {
            attachDesktopPlayerRowListeners(myTeamState);
        });
    }

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

    // Initialize league info for mobile (shows league position in GW card)
    if (useMobile) {
        requestAnimationFrame(async () => {
            await loadAndRenderLeagueInfo();
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
            const leagueId = parseInt(row.dataset.leagueId);
            // Navigate to rival team page with league context
            window.navigateToRival(rivalId, leagueId || null);
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
        // Check if current gameweek is live
        const isLive = isGameweekLive(gameweek);

        // Mobile ultra-compact layout
        return `
            ${renderCompactHeader(teamData, gameweek, isAutoRefreshActive())}
            ${renderCompactTeamList(allPlayers, gameweek, isLive)}
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
 * Render mobile-optimized leagues tab (simplified view)
 */
function renderMobileLeaguesTab(teamData) {
    const { team } = teamData;

    // Check if user has leagues
    if (!team.leagues || !team.leagues.classic || team.leagues.classic.length === 0) {
        return `
            <div style="padding: 2rem; text-align: center;">
                <i class="fas fa-trophy" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem; display: block;"></i>
                <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">
                    No Leagues Found
                </h3>
                <p style="color: var(--text-secondary);">
                    Join a league to view standings here!
                </p>
            </div>
        `;
    }

    const leagues = team.leagues.classic;

    // Get selected league from localStorage or default to first league
    const teamId = team.id;
    const selectedLeagueId = localStorage.getItem(`fpl_selected_league_${teamId}`) || leagues[0].id.toString();

    // Render league selector dropdown and standings
    const html = `
        <div>
            <!-- League Selector -->
            <div style="margin-bottom: 0.75rem; padding-top: 0.75rem;">
                <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem; padding: 0 0.75rem;">
                    Select League
                </label>
                <select
                    id="mobile-leagues-dropdown"
                    style="
                        width: calc(100% - 1.5rem);
                        margin: 0 0.75rem;
                        padding: 0.5rem;
                        font-size: 0.85rem;
                        background: var(--bg-secondary);
                        border: 1px solid var(--border-color);
                        border-radius: 0.5rem;
                        color: var(--text-primary);
                        cursor: pointer;
                    "
                >
                    ${leagues.map(league => `
                        <option value="${league.id}" ${league.id.toString() === selectedLeagueId ? 'selected' : ''}>
                            ${escapeHtml(league.name)} (Rank: ${league.entry_rank || 'N/A'})
                        </option>
                    `).join('')}
                </select>
            </div>

            <!-- League Standings Container -->
            <div id="mobile-league-standings">
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Loading league standings...</p>
                </div>
            </div>
        </div>
    `;

    // Load standings after DOM is ready
    requestAnimationFrame(() => {
        loadMobileLeagueStandingsWrapper(selectedLeagueId);

        // Add event listener for league selector
        const dropdown = document.getElementById('mobile-leagues-dropdown');
        if (dropdown) {
            dropdown.addEventListener('change', (e) => {
                const leagueId = e.target.value;
                localStorage.setItem(`fpl_selected_league_${teamId}`, leagueId);
                loadMobileLeagueStandingsWrapper(leagueId);
            });
        }
    });

    return html;
}

/**
 * Load and render league standings for mobile view (wrapper)
 */
async function loadMobileLeagueStandingsWrapper(leagueId) {
    return loadMobileLeagueStandings(leagueId, myTeamState);
}

/**
 * Render My Leagues tab content with side menu layout (wrapper)
 */
function renderLeaguesTab(teamData) {
    return renderLeaguesTabModule(
        teamData,
        myTeamState,
        (leagueId) => loadLeagueStandingsForTab(leagueId),
        () => renderLeagueTabs(myTeamState),
        () => renderLeagueContent(myTeamState)
    );
}

// League management wrapper functions

function toggleLeagueSelection(leagueId) {
    toggleLeagueSelectionModule(
        leagueId,
        myTeamState,
        (id, selected) => updateLeagueMenuItemUI(id, selected),
        () => updateLeagueSelectionCount(),
        () => updateLeagueTabsUI(),
        () => updateLeagueContentUI(),
        (id) => loadLeagueStandingsForTab(id)
    );
}

function updateLeagueMenuItemUI(leagueId, isSelected) {
    updateLeagueMenuItemUIModule(leagueId, isSelected, myTeamState);
}

function updateLeagueSelectionCount() {
    updateLeagueSelectionCountModule(myTeamState);
}

function updateLeagueTabsUI() {
    updateLeagueTabsUIModule(myTeamState, () => attachLeagueTabListeners());
}

function updateLeagueContentUI() {
    updateLeagueContentUIModule(myTeamState);
}

function switchLeagueTab(leagueId) {
    switchLeagueTabModule(
        leagueId,
        myTeamState,
        () => updateLeagueTabsUI(),
        () => updateLeagueContentUI(),
        (id) => loadLeagueStandingsForTab(id)
    );
}

function attachLeagueTabListeners() {
    attachLeagueTabListenersModule((leagueId) => switchLeagueTab(leagueId));
}

// League standings wrapper functions

function loadLeagueStandingsForTab(leagueId) {
    return loadLeagueStandingsForTabModule(
        leagueId,
        myTeamState,
        () => updateLeagueContentUI(),
        () => updateLeagueTabsUI()
    );
}

function loadAndCompareRivalTeam(rivalId) {
    return loadAndCompareRivalTeamModule(rivalId, myTeamState);
}

/**
 * Render Problem Players section (wrapper)
 */
function renderProblemPlayersSection(allPlayers, picks, gameweek) {
    return renderProblemPlayersSectionModule(allPlayers, picks, gameweek);
}

/**
 * Toggle Problem Players section visibility (wrapper)
 */
window.toggleProblemPlayers = function() {
    toggleProblemPlayersVisibility();
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
        window.currentTeamId = teamId; // Expose globally for mobile nav

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
