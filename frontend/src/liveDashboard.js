// ============================================================================
// LIVE GAMEWEEK DASHBOARD
// Personalized live monitoring dashboard for gameweek tracking
// ============================================================================

import { 
    fplBootstrap, 
    fplFixtures, 
    getActiveGW, 
    getGameweekStatus, 
    isGameweekLive,
    startAutoRefresh,
    stopAutoRefresh,
    isAutoRefreshActive,
    loadMyTeam,
    loadEnrichedBootstrap
} from './data.js';
import { renderDashboardHeader } from './liveDashboard/dashboardHeader.js';
import { renderLiveMatchesTable } from './liveDashboard/liveMatchesTable.js';
import { renderTopPlayersTable } from './liveDashboard/topPlayersTable.js';

let dashboardRefreshInterval = null;
let myTeamData = null;
let teamDataRefreshCount = 0; // Track refresh cycles for periodic team data refresh

/**
 * Render the live gameweek dashboard
 */
export async function renderLiveDashboard() {
    const container = document.getElementById('app-container');
    
    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p>Loading dashboard...</p>
        </div>
    `;

    try {
        // Load my team data
        const teamId = localStorage.getItem('fplanner_team_id');
        if (!teamId) {
            container.innerHTML = `
                <div style="text-align: center; padding: 4rem 2rem;">
                    <i class="fas fa-info-circle" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary);">Please set up your team first</p>
                    <button 
                        onclick="window.location.hash = '#my-team'"
                        style="
                            margin-top: 1rem;
                            padding: 0.75rem 1.5rem;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 0.5rem;
                            cursor: pointer;
                            font-weight: 600;
                        "
                    >
                        Go to Team Page
                    </button>
                </div>
            `;
            return;
        }

        // Initial load: refresh enriched bootstrap immediately
        console.log('🔄 Initial refresh on dashboard entry...');
        await loadEnrichedBootstrap(true); // Force refresh on page entry
        
        myTeamData = await loadMyTeam(teamId);
        await renderDashboardContent();
        
        // Setup auto-refresh - will start 2 minutes after initial refresh
        setupAutoRefresh();
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">Failed to load dashboard</p>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Render dashboard content
 */
async function renderDashboardContent() {
    const container = document.getElementById('app-container');
    const activeGW = getActiveGW();
    
    // Determine dashboard state
    const gwStatus = getGameweekStatus(activeGW);
    const isLive = isGameweekLive(activeGW);
    
    // Check 24-hour transition rule (use same logic as countdown timer)
    let displayGW = activeGW;
    let displayStatus = gwStatus;
    
    // Get next event (the one with is_next flag, same as countdown timer)
    const nextEvent = fplBootstrap?.events?.find(e => e.is_next);
    if (nextEvent) {
        const deadline = new Date(nextEvent.deadline_time);
        const now = new Date();
        const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);
        
        // If within 24 hours of next GW deadline, show next GW
        if (hoursUntilDeadline < 24 && hoursUntilDeadline > 0) {
            displayGW = nextEvent.id;
            displayStatus = 'UPCOMING';
        }
    }
    
    // Render dashboard components
    const header = renderDashboardHeader(myTeamData, displayGW, displayStatus, isAutoRefreshActive());
    const matchesTable = renderLiveMatchesTable(myTeamData, displayGW, displayStatus);
    const topPlayers = renderTopPlayersTable(myTeamData, displayGW, isLive);
    
    container.innerHTML = `
        ${header}
        ${matchesTable}
        ${topPlayers}
    `;
}

/**
 * Setup auto-refresh for live GW
 * Starts 2 minutes after initial refresh
 */
function setupAutoRefresh() {
    const activeGW = getActiveGW();
    const isLive = isGameweekLive(activeGW);
    
    if (isLive) {
        // Don't start immediately - wait 2 minutes after initial refresh
        console.log('⏰ Auto-refresh will start in 2 minutes...');
        
        setTimeout(() => {
            const stillLive = isGameweekLive(getActiveGW());
            if (stillLive) {
                // Start auto-refresh - refresh enriched bootstrap every 2 min, team data every 6 min
                teamDataRefreshCount = 0; // Reset counter when starting auto-refresh
                startAutoRefresh(async () => {
                    // Refresh enriched bootstrap (every 2 min)
                    await renderDashboardContent();
                    
                    // Refresh team data every 3rd cycle (every 6 min) to update league points
                    teamDataRefreshCount++;
                    if (teamDataRefreshCount >= 3) {
                        teamDataRefreshCount = 0;
                        const teamId = localStorage.getItem('fplanner_team_id');
                        if (teamId) {
                            console.log('🔄 Refreshing team data for league points update...');
                            try {
                                myTeamData = await loadMyTeam(teamId);
                                await renderDashboardContent();
                            } catch (err) {
                                console.error('Failed to refresh team data:', err);
                            }
                        }
                    }
                });
            }
        }, 2 * 60 * 1000); // 2 minutes delay
    } else {
        // Stop auto-refresh if not live
        stopAutoRefresh();
    }
}

