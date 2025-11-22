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
    loadMyTeam
} from './data.js';
import { renderDashboardHeader } from './liveDashboard/dashboardHeader.js';
import { renderMyTeamLiveTable } from './liveDashboard/myTeamLiveTable.js';
import { renderLiveMatchesTable } from './liveDashboard/liveMatchesTable.js';
import { renderTopPlayersTable } from './liveDashboard/topPlayersTable.js';

let dashboardRefreshInterval = null;
let myTeamData = null;

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

        myTeamData = await loadMyTeam(teamId);
        await renderDashboardContent();
        
        // Setup auto-refresh if GW is live
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
    
    // Check 24-hour transition rule
    let displayGW = activeGW;
    let displayStatus = gwStatus;
    
    if (gwStatus === 'FINISHED') {
        // Check if within 24 hours of next GW deadline
        const nextEvent = fplBootstrap?.events?.find(e => e.id === activeGW + 1);
        if (nextEvent) {
            const deadline = new Date(nextEvent.deadline_time);
            const now = new Date();
            const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);
            
            if (hoursUntilDeadline < 24) {
                displayGW = activeGW + 1;
                displayStatus = 'UPCOMING';
            }
        }
    }
    
    // Render dashboard components
    const header = renderDashboardHeader(myTeamData, displayGW, displayStatus, isAutoRefreshActive());
    const teamTable = renderMyTeamLiveTable(myTeamData, displayGW, isLive);
    const matchesTable = renderLiveMatchesTable(myTeamData, displayGW, displayStatus);
    const topPlayers = renderTopPlayersTable(myTeamData, displayGW, isLive);
    
    container.innerHTML = `
        ${header}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; @media (max-width: 767px) { grid-template-columns: 1fr; }">
            ${teamTable}
            ${matchesTable}
        </div>
        ${topPlayers}
    `;
    
    // Add responsive CSS for mobile
    if (!document.getElementById('dashboard-responsive-style')) {
        const style = document.createElement('style');
        style.id = 'dashboard-responsive-style';
        style.textContent = `
            @media (max-width: 767px) {
                #app-container > div[style*="grid-template-columns: 1fr 1fr"] {
                    grid-template-columns: 1fr !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Setup auto-refresh for live GW
 */
function setupAutoRefresh() {
    const activeGW = getActiveGW();
    const isLive = isGameweekLive(activeGW);
    
    if (isLive) {
        // Start auto-refresh
        startAutoRefresh(async () => {
            // Reload team data and re-render
            const teamId = localStorage.getItem('fplanner_team_id');
            if (teamId) {
                myTeamData = await loadMyTeam(teamId);
                await renderDashboardContent();
            }
        });
    } else {
        // Stop auto-refresh if not live
        stopAutoRefresh();
    }
}

