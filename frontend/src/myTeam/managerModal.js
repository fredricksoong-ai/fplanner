// ============================================================================
// MANAGER MODAL
// Modal for team management with tabbed interface (Overview, Transfers, League, Season Progress)
// ============================================================================

import { escapeHtml } from '../utils.js';
import { getGlassmorphism, getShadow, getMobileBorderRadius, getAnimationCurve, getAnimationDuration, getSegmentedControlStyles } from '../styles/mobileDesignSystem.js';
import { loadAndRenderLeagueInfo } from '../leagueInfo.js';
import { loadTransferHistory, getPlayerById, getActiveGW } from '../data.js';
import { initializeTeamPointsChart, disposeTeamPointsChart } from '../dataAnalysis/teamPointsChart.js';

// Chart instance for cleanup
let seasonProgressChartInstance = null;

/**
 * Check if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Inject modal animation keyframes
 */
function injectModalAnimations() {
    if (document.getElementById('manager-modal-animations')) return;

    const style = document.createElement('style');
    style.id = 'manager-modal-animations';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes slideUp {
            from { 
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
            to { 
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        @keyframes slideDown {
            from { 
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            to { 
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show Manager Modal
 * @param {Object} teamData - Current team data (optional)
 */
export function showManagerModal(teamData = null) {
    injectModalAnimations();

    // Remove existing modal
    const existingModal = document.getElementById('manager-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Cleanup existing chart
    if (seasonProgressChartInstance) {
        disposeTeamPointsChart(seasonProgressChartInstance);
        seasonProgressChartInstance = null;
    }

    const isDark = isDarkMode();
    const glassEffect = getGlassmorphism(isDark, 'heavy');
    const shadow = getShadow('modal');
    const radius = getMobileBorderRadius('xlarge');
    const animationCurve = getAnimationCurve('decelerate');
    const animationDuration = getAnimationDuration('modal');

    // Get team info if available
    let teamName = 'My Team';
    let teamPoints = null;
    let teamRank = null;
    let overviewHTML = '';
    let transfersHTML = '';
    let leagueInfoHTML = '';
    let seasonProgressHTML = '';
    let teamHistory = null;

    if (teamData && teamData.team && teamData.picks) {
        teamName = teamData.team.name || 'My Team';
        const entry = teamData.picks.entry_history;
        teamPoints = entry?.total_points || 0;
        teamRank = entry?.overall_rank || null;
        const freeTransfers = entry?.event_transfers || 0;
        const transferCost = entry?.event_transfers_cost || 0;
        const bank = (entry?.bank || 0) / 10; // Convert to millions
        const value = (entry?.value || 1000) / 10; // Convert to millions
        
        // Overview tab content
        overviewHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                    <span style="font-size: 0.7rem; color: var(--text-secondary);">Total Points</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">${teamPoints.toLocaleString()}</span>
                </div>
                ${teamRank ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                    <span style="font-size: 0.7rem; color: var(--text-secondary);">Overall Rank</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">#${teamRank.toLocaleString()}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                    <span style="font-size: 0.7rem; color: var(--text-secondary);">Team Value</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">£${value.toFixed(1)}m</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                    <span style="font-size: 0.7rem; color: var(--text-secondary);">Bank</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">£${bank.toFixed(1)}m</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0;">
                    <span style="font-size: 0.7rem; color: var(--text-secondary);">Free Transfers</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">${freeTransfers}${transferCost > 0 ? ` <span style="color: #ef4444; font-weight: 400;">(-${transferCost} pts)</span>` : ''}</span>
                </div>
            </div>
        `;
        
        // Transfers tab content - show directly without expand/collapse
        transfersHTML = `
            <div style="margin-bottom: 0.75rem; padding: 0.5rem; background: var(--bg-secondary); border-radius: 0.5rem;">
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                    Transfers: ${freeTransfers}${transferCost > 0 ? ` <span style="color: #ef4444;">(-${transferCost} pts)</span>` : ''}
                </div>
                <div id="manager-transfers-details" data-team-id="${teamData.team.id}" data-transfer-cost="${transferCost}" style="font-size: 0.65rem;">
                    <div style="color: var(--text-secondary); text-align: center; padding: 1rem;">Loading transfers...</div>
                </div>
            </div>
        `;
        
        // League tab content
        const selectedLeagueId = localStorage.getItem(`fpl_selected_league_${teamData.team.id}`);
        if (selectedLeagueId && selectedLeagueId !== 'null') {
            leagueInfoHTML = `
                <div id="league-info-placeholder" data-team-id="${teamData.team.id}" data-league-id="${selectedLeagueId}">
                    <div style="font-size: 0.7rem; color: var(--text-secondary); text-align: center; padding: 1rem;">Loading league...</div>
                </div>
            `;
        } else {
            leagueInfoHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary); font-size: 0.75rem;">
                    <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    <p style="margin: 0;">No league selected</p>
                </div>
            `;
        }

        // Season Progress tab content
        teamHistory = teamData?.teamHistory?.current || [];
        if (teamHistory.length > 0) {
            seasonProgressHTML = `
                <div id="manager-season-progress-chart" style="width: 100%; height: 300px;"></div>
            `;
        } else {
            seasonProgressHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary); font-size: 0.75rem;">
                    <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    <p style="margin: 0;">Team history data not available</p>
                </div>
            `;
        }
    } else {
        // No team data - show empty states
        overviewHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary); font-size: 0.75rem;">
                <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                <p style="margin: 0;">No team data available</p>
            </div>
        `;
        transfersHTML = overviewHTML;
        leagueInfoHTML = overviewHTML;
        seasonProgressHTML = overviewHTML;
    }

    // Build tab navigation
    const segStyles = getSegmentedControlStyles(isDark, true);
    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'transfers', label: 'Transfers' },
        { id: 'league', label: 'League' },
        { id: 'season-progress', label: 'Season Progress' }
    ];

    const containerStyle = Object.entries(segStyles.container)
        .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`)
        .join('; ');

    const tabNavigationHTML = `
        <div style="margin-bottom: 0.75rem; overflow-x: auto;">
            <div style="${containerStyle}">
                ${tabs.map(tab => {
                    const isActive = tab.id === 'overview';
                    const buttonStyle = Object.entries({
                        ...segStyles.button,
                        ...(isActive ? segStyles.activeButton : {})
                    })
                    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`)
                    .join('; ');

                    return `
                        <button
                            class="manager-modal-tab-btn"
                            data-tab="${tab.id}"
                            style="${buttonStyle}"
                            onmousedown="this.style.transform='scale(0.95)'"
                            onmouseup="this.style.transform='scale(1)'"
                            onmouseleave="this.style.transform='scale(1)'"
                            ontouchstart="this.style.transform='scale(0.95)'"
                            ontouchend="this.style.transform='scale(1)'"
                        >
                            ${tab.label}
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Build header with team info
    const headerSubtitle = teamRank ? `#${teamRank.toLocaleString()} • ${teamPoints.toLocaleString()} pts` : (teamPoints ? `${teamPoints.toLocaleString()} pts` : '');

    const modalHTML = `
        <div id="manager-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            animation: fadeIn ${animationDuration} ${animationCurve};
        ">
            <div style="
                backdrop-filter: ${glassEffect.backdropFilter};
                -webkit-backdrop-filter: ${glassEffect.WebkitBackdropFilter};
                background: ${glassEffect.background};
                border: ${glassEffect.border};
                border-radius: ${radius};
                max-width: 500px;
                width: 100%;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: ${shadow};
                animation: slideUp ${animationDuration} ${animationCurve};
            ">
                <!-- Header -->
                <div style="
                    padding: 0.75rem 1rem;
                    border-bottom: 2px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 0.65rem;
                ">
                    <div>
                        <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                            ${escapeHtml(teamName)}
                        </div>
                        ${headerSubtitle ? `
                        <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            ${headerSubtitle}
                        </div>
                        ` : ''}
                    </div>
                    <button
                        id="close-manager-modal"
                        style="
                            background: transparent;
                            border: none;
                            font-size: 1.5rem;
                            color: var(--text-secondary);
                            cursor: pointer;
                            padding: 0;
                            width: 2rem;
                            height: 2rem;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        "
                    >
                        ×
                    </button>
                </div>
                
                <!-- Content -->
                <div style="padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    ${tabNavigationHTML}
                    
                    <!-- Tab Content -->
                    <!-- Overview Tab -->
                    <div id="manager-modal-tab-overview" class="manager-modal-tab-content" style="display: block;">
                        ${overviewHTML}
                    </div>

                    <!-- Transfers Tab -->
                    <div id="manager-modal-tab-transfers" class="manager-modal-tab-content" style="display: none;">
                        ${transfersHTML}
                    </div>

                    <!-- League Tab -->
                    <div id="manager-modal-tab-league" class="manager-modal-tab-content" style="display: none;">
                        ${leagueInfoHTML}
                    </div>

                    <!-- Season Progress Tab -->
                    <div id="manager-modal-tab-season-progress" class="manager-modal-tab-content" style="display: none;">
                        ${seasonProgressHTML}
                    </div>

                    <!-- Switch Team Button -->
                    <button
                        id="manager-switch-team-btn"
                        style="
                            width: 100%;
                            padding: 0.75rem 1rem;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: ${radius};
                            font-size: 0.85rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all ${animationDuration} ${animationCurve};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 0.5rem;
                            margin-top: 0.5rem;
                        "
                    >
                        <i class="fas fa-exchange-alt"></i>
                        Switch Team
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    attachManagerModalListeners(teamData, teamHistory);
    
    // Load league info if placeholder exists
    requestAnimationFrame(() => {
        const placeholder = document.getElementById('league-info-placeholder');
        if (placeholder) {
            loadAndRenderLeagueInfo();
        }
        
        // Load transfers directly for the Transfers tab (no expand/collapse needed)
        const transfersDetails = document.getElementById('manager-transfers-details');
        if (transfersDetails) {
            loadManagerTransfers(transfersDetails);
        }
    });
}

/**
 * Load and render transfers for manager modal
 */
async function loadManagerTransfers(container) {
    const teamId = container.dataset.teamId;
    const transferCost = parseInt(container.dataset.transferCost) || 0;
    
    if (!teamId) {
        container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 1rem;">No team ID</div>';
        return;
    }

    try {
        const transfers = await loadTransferHistory(teamId);
        renderManagerTransferDetails(container, transfers, transferCost);
    } catch (err) {
        container.innerHTML = '<div style="color: #ef4444; text-align: center; padding: 1rem;">Failed to load transfers</div>';
    }
}

/**
 * Render transfer details in manager modal
 */
function renderManagerTransferDetails(container, transfers, transferCost = 0) {
    const currentGW = getActiveGW();

    // Filter to current GW transfers
    const gwTransfers = transfers.filter(t => t.event === currentGW);

    if (gwTransfers.length === 0) {
        container.innerHTML = '<div style="font-size: 0.65rem; color: var(--text-secondary); text-align: center; padding: 1rem;">No transfers this GW</div>';
        return;
    }

    let totalPointsDiff = 0;

    const transferRows = gwTransfers.map(transfer => {
        const playerIn = getPlayerById(transfer.element_in);
        const playerOut = getPlayerById(transfer.element_out);

        if (!playerIn || !playerOut) return '';

        // Get GW points for both players
        const inPoints = playerIn.live_stats?.total_points ?? playerIn.event_points ?? 0;
        const outPoints = playerOut.live_stats?.total_points ?? playerOut.event_points ?? 0;
        totalPointsDiff += (inPoints - outPoints);

        return `
            <div style="display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 0.25rem; padding: 0.2rem 0; align-items: center;">
                <div style="color: var(--text-primary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(playerOut.web_name)}</div>
                <div style="color: #ef4444; font-weight: 700; text-align: right; min-width: 1.5rem;">${outPoints}</div>
                <div style="color: var(--text-primary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(playerIn.web_name)}</div>
                <div style="color: #22c55e; font-weight: 700; text-align: right; min-width: 1.5rem;">${inPoints}</div>
            </div>
        `;
    }).join('');

    // Calculate net with transfer cost
    const netWithCost = totalPointsDiff - transferCost;
    const netColor = netWithCost > 0 ? '#22c55e' : netWithCost < 0 ? '#ef4444' : 'var(--text-secondary)';
    const netSymbol = netWithCost > 0 ? '+' : '';

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 0.25rem; padding-bottom: 0.25rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border-color); font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase;">
            <div>Out</div>
            <div style="text-align: right;">Pts</div>
            <div>In</div>
            <div style="text-align: right;">Pts</div>
        </div>
        ${transferRows}
        <div style="margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid var(--border-color);">
            ${transferCost > 0 ? `
                <div style="display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 0.65rem;">
                    <span>Transfer Cost:</span>
                    <span style="color: #ef4444; font-weight: 600;">-${transferCost}</span>
                </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-weight: 700;">
                <span style="color: var(--text-secondary); font-size: 0.65rem;">Net Points:</span>
                <span style="color: ${netColor}; font-size: 0.65rem;">${netSymbol}${netWithCost}</span>
            </div>
        </div>
    `;
}

/**
 * Initialize Season Progress chart
 */
async function initializeSeasonProgressChart(teamHistory, currentPicks) {
    if (!teamHistory || teamHistory.length === 0) {
        return;
    }

    const chartContainer = document.getElementById('manager-season-progress-chart');
    if (!chartContainer) {
        return;
    }

    // Dispose existing chart
    if (seasonProgressChartInstance) {
        disposeTeamPointsChart(seasonProgressChartInstance);
        seasonProgressChartInstance = null;
    }

    // Initialize chart
    try {
        seasonProgressChartInstance = await initializeTeamPointsChart(
            'manager-season-progress-chart',
            teamHistory,
            currentPicks
        );
    } catch (err) {
        console.error('Failed to initialize season progress chart:', err);
    }
}

/**
 * Attach event listeners to Manager Modal
 */
function attachManagerModalListeners(teamData, teamHistory) {
    const modal = document.getElementById('manager-modal');
    if (!modal) return;

    // Close button
    const closeBtn = document.getElementById('close-manager-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeManagerModal);
    }

    // Switch Team button
    const switchTeamBtn = document.getElementById('manager-switch-team-btn');
    if (switchTeamBtn) {
        switchTeamBtn.addEventListener('click', () => {
            closeManagerModal();
            if (window.resetMyTeam) {
                window.resetMyTeam();
            }
        });
    }

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'manager-modal') {
            closeManagerModal();
        }
    });

    // Tab switching
    const tabButtons = document.querySelectorAll('.manager-modal-tab-btn');
    const segStyles = getSegmentedControlStyles(isDarkMode(), true);
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Update button styles
            tabButtons.forEach(b => {
                const isActive = b === btn;
                const buttonStyle = Object.entries({
                    ...segStyles.button,
                    ...(isActive ? segStyles.activeButton : {})
                })
                .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`)
                .join('; ');
                b.style.cssText = buttonStyle;
            });

            // Show/hide tab content
            const tabContents = document.querySelectorAll('.manager-modal-tab-content');
            tabContents.forEach(content => {
                content.style.display = 'none';
            });
            const activeContent = document.getElementById(`manager-modal-tab-${tabId}`);
            if (activeContent) {
                activeContent.style.display = 'block';
                
                // Load transfers if Transfers tab is opened
                if (tabId === 'transfers') {
                    const transfersDetails = document.getElementById('manager-transfers-details');
                    if (transfersDetails && transfersDetails.innerHTML.includes('Loading transfers')) {
                        loadManagerTransfers(transfersDetails);
                    }
                }
                
                // Initialize chart if Season Progress tab is opened
                if (tabId === 'season-progress' && teamHistory && teamHistory.length > 0) {
                    const currentPicks = teamData?.picks?.picks || null;
                    initializeSeasonProgressChart(teamHistory, currentPicks);
                }
            }
        });
    });
}

/**
 * Close Manager Modal with animation
 */
export function closeManagerModal() {
    const modal = document.getElementById('manager-modal');
    if (!modal) return;

    // Cleanup chart
    if (seasonProgressChartInstance) {
        disposeTeamPointsChart(seasonProgressChartInstance);
        seasonProgressChartInstance = null;
    }

    const animationCurve = getAnimationCurve('accelerate');
    const animationDuration = getAnimationDuration('modal');

    modal.style.animation = `fadeOut ${animationDuration} ${animationCurve}`;
    const content = modal.querySelector('div');
    if (content) {
        content.style.animation = `slideDown ${animationDuration} ${animationCurve}`;
    }

    setTimeout(() => {
        modal.remove();
    }, parseFloat(animationDuration));
}

// Expose globally
if (typeof window !== 'undefined') {
    window.showManagerModal = showManagerModal;
    window.closeManagerModal = closeManagerModal;
}

