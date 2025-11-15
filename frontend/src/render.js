// ============================================================================
// RENDER MODULE
// All page rendering functions (My Team, Transfer Committee, Analysis, etc.)
// ============================================================================

import { 
    fplBootstrap, 
    currentGW, 
    getAllPlayers, 
    getPlayerById, 
    loadMyTeam 
} from './data.js';

import {
    getPositionShort,
    getPositionType,
    formatCurrency,
    formatPercent,
    formatDecimal,
    getPtsHeatmap,
    getFormHeatmap,
    getHeatmapStyle,
    getDifficultyClass,
    getCurrentGW,
    getFixtureHeaders,
    getPastGWHeaders,
    getTeamShortName,
    calculatePPM,
    sortPlayers,
    filterByPosition,
    escapeHtml,
    calculateMinutesPercentage,
    getFormTrend
} from './utils.js';

import {
    getFixtures,
    getGWOpponent,
    calculateFixtureDifficulty
} from './fixtures.js';

import {
    analyzePlayerRisks,
    renderRiskTooltip,
    hasHighRisk
} from './risk.js';

// ============================================================================
// MY TEAM PAGE
// ============================================================================

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
                    onkeypress="if(event.key==='Enter') window.loadAndRenderTeam()"
                >
                <button 
                    onclick="window.loadAndRenderTeam()"
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
                    onmouseover="this.style.background='var(--primary-hover)'"
                    onmouseout="this.style.background='var(--primary-color)'"
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
}

/**
 * Render My Team page with loaded data
 */
export function renderMyTeam(teamData) {
    const container = document.getElementById('app-container');
    const { picks, gameweek, team } = teamData;

    console.log(`🎨 Rendering My Team for ${team.player_first_name} ${team.player_last_name}...`);

    // Sort players by position order
    const allPlayers = picks.picks.sort((a, b) => a.position - b.position);

    // Find problem players for Transfer Committee integration
    const problemPlayersSection = renderProblemPlayersSection(allPlayers, picks, gameweek);

    const html = `
        <div class="mb-6">
            ${renderManagerInfo(teamData)}
        </div>

        <div class="mb-8">
            ${renderTeamSummary(allPlayers, gameweek, picks.entry_history)}
        </div>

        ${problemPlayersSection}

        <div class="mb-8">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <button
                    onclick="window.resetMyTeam()"
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
                    onmouseover="this.style.background='var(--bg-tertiary)'; this.style.color='var(--primary-color)'; this.style.borderColor='var(--primary-color)';"
                    onmouseout="this.style.background='var(--bg-secondary)'; this.style.color='var(--text-secondary)'; this.style.borderColor='var(--border-color)';"
                >
                    <i class="fas fa-arrow-left" style="margin-right: 6px;"></i>Change Team
                </button>
            </div>
            ${renderTeamTable(allPlayers, gameweek)}
        </div>
    `;

    container.innerHTML = html;
    attachRiskTooltipListeners();
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
            <div style="
                padding: 1rem 1.5rem;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            " onclick="window.toggleProblemPlayers()">
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
    
    // Handle optional fields safely
    const overallRank = team.summary_overall_rank || team.current_event_points || 0;
    const totalPlayers = team.last_deadline_total_players || team.total_players || 0;
    const overallPoints = team.summary_overall_points || team.overall_points || 0;
    
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
                    <div style="font-size: 0.875rem; opacity: 0.8; margin-top: 0.25rem;">GW${teamData.gameweek}: ${entry.total_points} pts</div>
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

        const ptsHeatmap = getPtsHeatmap(player.total_points, 'pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);

        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);

        // Get GW-specific stats from GitHub (only if matches current GW)
        const hasGWStats = player.github_gw && player.github_gw.gw === gameweek;

        // Minutes: use GitHub if available, otherwise show dash (will show season total in future)
        const gwMinutes = hasGWStats ? player.github_gw.minutes : '—';

        // Points: use GitHub if available, otherwise FPL API event_points
        const gwPoints = hasGWStats ? player.github_gw.total_points : (player.event_points || 0);

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
                    ${riskTooltip ? `<span style="margin-left: 0.5rem;">${riskTooltip}</span>` : ''}
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
// TRANSFER COMMITTEE PAGE
// ============================================================================

/**
 * Render Transfer Committee page (problem players with replacement suggestions)
 */
export function renderTransferCommittee() {
    const container = document.getElementById('app-container');

    // Check if team data is loaded
    const cachedTeamId = localStorage.getItem('fplanner_team_id');

    if (!cachedTeamId) {
        container.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto; padding: 4rem 2rem; text-align: center;">
                <div style="background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); padding: 3rem;">
                    <i class="fas fa-exchange-alt" style="font-size: 4rem; color: var(--text-tertiary); margin-bottom: 1.5rem; display: block;"></i>
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                        Load Your Team First
                    </h2>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem; line-height: 1.6;">
                        Transfer Committee requires your team data. Please go to My Team and load your squad first.
                    </p>
                    <button
                        onclick="window.location.hash = 'my-team'"
                        style="
                            padding: 12px 24px;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                            font-size: 1rem;
                        "
                        onmouseover="this.style.opacity='0.9'"
                        onmouseout="this.style.opacity='1'"
                    >
                        <i class="fas fa-users" style="margin-right: 0.5rem;"></i>Go to My Team
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Load team and analyze
    loadMyTeam(cachedTeamId)
        .then(teamData => {
            renderTransferCommitteeWithTeam(teamData);
        })
        .catch(err => {
            console.error('Failed to load team for Transfer Committee:', err);
            container.innerHTML = `
                <div style="max-width: 600px; margin: 0 auto; padding: 4rem 2rem; text-align: center;">
                    <div style="background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); padding: 3rem;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #ef4444; margin-bottom: 1.5rem; display: block;"></i>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                            Failed to Load Team
                        </h2>
                        <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                            ${escapeHtml(err.message)}
                        </p>
                        <button
                            onclick="window.location.hash = 'my-team'"
                            style="
                                padding: 12px 24px;
                                background: var(--primary-color);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-weight: 600;
                                cursor: pointer;
                            "
                        >
                            Go to My Team
                        </button>
                    </div>
                </div>
            `;
        });
}

/**
 * Render Transfer Committee with loaded team data
 */
function renderTransferCommitteeWithTeam(teamData) {
    const container = document.getElementById('app-container');
    const { picks, gameweek } = teamData;

    console.log('🔄 Rendering Transfer Committee...');

    // Find problem players (players with risks)
    const problemPlayers = [];

    picks.picks.forEach(pick => {
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

    console.log(`   🚨 Found ${problemPlayers.length} problem players`);

    // If no problems, show success message
    if (problemPlayers.length === 0) {
        container.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto; padding: 4rem 2rem; text-align: center;">
                <div style="background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); padding: 3rem;">
                    <i class="fas fa-check-circle" style="font-size: 4rem; color: #10b981; margin-bottom: 1.5rem; display: block;"></i>
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                        No Issues Detected!
                    </h2>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem; line-height: 1.6;">
                        Your squad looks good. No urgent transfer recommendations at this time.
                    </p>
                    <button
                        onclick="window.location.hash = 'my-team'"
                        style="
                            padding: 12px 24px;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                        "
                    >
                        <i class="fas fa-arrow-left" style="margin-right: 0.5rem;"></i>Back to My Team
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Next 5 gameweeks for fixture columns
    const next5GWs = [gameweek + 1, gameweek + 2, gameweek + 3, gameweek + 4, gameweek + 5];

    // Build table HTML
    let html = `
        <div style="padding: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 0.5rem;">
                <i class="fas fa-exchange-alt" style="margin-right: 0.5rem;"></i>Transfer Committee
            </h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                ${problemPlayers.length} player${problemPlayers.length !== 1 ? 's' : ''} flagged for review. Click expand to view replacement suggestions.
            </p>

            <div style="background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow); overflow: visible;">
                <div style="overflow-x: auto;">
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

    // Render problem players with replacement suggestions
    problemPlayers.forEach((problem, idx) => {
        const { player, risks } = problem;

        // Find replacements
        const replacements = findReplacements(player, picks, gameweek);

        // Render problem player row
        html += renderProblemPlayerRow(player, risks, idx, next5GWs, gameweek);

        // Render replacement rows (hidden by default)
        replacements.forEach((rep, repIdx) => {
            html += renderReplacementRow(rep, player, idx, repIdx, next5GWs, gameweek);
        });
    });

    html += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    attachRiskTooltipListeners();

    console.log('   ✅ Transfer Committee rendered');
}

/**
 * Render problem player row in Transfer Committee table
 */
function renderProblemPlayerRow(player, risks, idx, next5GWs, gameweek) {
    const posType = getPositionType(player);
    const riskTooltip = renderRiskTooltip(risks);
    const rowBg = idx % 2 === 0 ? '#f9fafb' : 'white';

    // Calculate metrics
    const ppm = calculatePPM(player);
    const ownership = parseFloat(player.selected_by_percent) || 0;
    const formHeatmap = getFormHeatmap(player.form);
    const formStyle = getHeatmapStyle(formHeatmap);

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

    // Transfer momentum
    let transferNet = '—';
    let transferColor = 'inherit';
    if (player.github_transfers) {
        const net = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
        const prefix = net > 0 ? '+' : '';
        transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
        transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
    } else if (player.transfers_in_event !== undefined && player.transfers_out_event !== undefined) {
        const net = player.transfers_in_event - player.transfers_out_event;
        const prefix = net > 0 ? '+' : '';
        transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
        transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
    }

    // Get next 5 fixtures
    const next5Fixtures = getFixtures(player.team, 5, false);

    return `
        <tr style="background: ${rowBg};">
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${getPositionShort(player)}</td>
            <td style="padding: 0.75rem 0.75rem;">
                <strong>${escapeHtml(player.web_name)}</strong>
                ${riskTooltip ? `<span style="margin-left: 0.5rem;">${riskTooltip}</span>` : ''}
            </td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${getTeamShortName(player.team)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">±£0.0</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(ppm)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${metricValue}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${defConFormatted}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
            ${next5Fixtures.map(fix => {
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
            <td style="padding: 0.75rem 0.5rem; text-align: center;">
                <button
                    onclick="window.toggleReplacements(${idx})"
                    style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        color: var(--primary-color);
                        font-size: 1rem;
                        padding: 0.25rem;
                    "
                >
                    <i id="expand-icon-${idx}" class="fas fa-chevron-down"></i>
                </button>
            </td>
        </tr>
    `;
}

/**
 * Render replacement suggestion row in Transfer Committee table
 */
function renderReplacementRow(rep, problemPlayer, problemIdx, repIdx, next5GWs, gameweek) {
    const player = rep.player;
    const priceDiff = rep.priceDiff;
    const posType = getPositionType(player);

    // Calculate metrics
    const ppm = calculatePPM(player);
    const ownership = parseFloat(player.selected_by_percent) || 0;
    const formHeatmap = getFormHeatmap(player.form);
    const formStyle = getHeatmapStyle(formHeatmap);

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

    // Transfer momentum
    let transferNet = '—';
    let transferColor = 'inherit';
    if (player.github_transfers) {
        const net = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
        const prefix = net > 0 ? '+' : '';
        transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
        transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
    } else if (player.transfers_in_event !== undefined && player.transfers_out_event !== undefined) {
        const net = player.transfers_in_event - player.transfers_out_event;
        const prefix = net > 0 ? '+' : '';
        transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
        transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
    }

    // Price difference styling
    const diffSign = priceDiff >= 0 ? '+' : '';
    const diffColor = priceDiff < 0 ? '#22c55e' : '#ef4444';

    // Get next 5 fixtures
    const next5Fixtures = getFixtures(player.team, 5, false);

    return `
        <tr
            id="rep-${problemIdx}-${repIdx}"
            class="replacement-row"
            data-problem="${problemIdx}"
            style="display: none; background: rgba(229, 231, 235, 0.8);"
        >
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${getPositionShort(player)}</td>
            <td style="padding: 0.75rem 0.75rem; padding-left: 2rem;">
                <span style="color: var(--text-tertiary); font-size: 0.875rem; margin-right: 0.5rem;">${repIdx + 1}.</span>
                <strong>${escapeHtml(player.web_name)}</strong>
            </td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${getTeamShortName(player.team)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; color: ${diffColor}; font-weight: 600;">${diffSign}£${Math.abs(priceDiff / 10).toFixed(1)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(ppm)}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center;">${metricValue}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${defConFormatted}</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
            <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
            ${next5Fixtures.map(fix => {
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
            <td style="padding: 0.75rem 0.5rem; text-align: center;"></td>
        </tr>
    `;
}

/**
 * Find replacement suggestions for a problem player
 */
function findReplacements(problemPlayer, picks, gameweek) {
    console.log(`   🔍 Finding replacements for ${problemPlayer.web_name}...`);

    const allPlayers = getAllPlayers();
    const teamValue = picks.entry_history.value || 1000;
    const bank = picks.entry_history.bank || 0;
    const maxBudget = problemPlayer.now_cost + bank;

    const myPlayerIds = new Set(picks.picks.map(p => p.element));

    // Filter candidates
    const candidates = allPlayers.filter(p => {
        return p.element_type === problemPlayer.element_type &&
               p.id !== problemPlayer.id &&
               p.now_cost <= maxBudget &&
               !myPlayerIds.has(p.id);
    });

    console.log(`   📊 Found ${candidates.length} candidates for position ${problemPlayer.element_type}`);

    // Score each candidate
    const scored = candidates.map(c => {
        const score = scoreReplacement(c);
        return {
            player: c,
            score: score,
            priceDiff: c.now_cost - problemPlayer.now_cost
        };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    const top5 = scored.slice(0, 5);
    console.log(`   ⭐ Top 5 replacements:`, top5.map(r => `${r.player.web_name} (${r.score.toFixed(0)})`));

    return top5;
}

/**
 * Score a replacement candidate
 */
function scoreReplacement(candidate) {
    let score = 0;

    // 1. Form (0-30 points)
    const form = parseFloat(candidate.form) || 0;
    score += Math.min(30, form * 5);

    // 2. Fixture Difficulty (0-25 points)
    const avgFDR = calculateFixtureDifficulty(candidate.team, 5);
    score += Math.max(0, (5 - avgFDR) * 5); // Inverted: lower FDR = higher score

    // 3. Points Per Million (0-20 points)
    const ppm = calculatePPM(candidate);
    score += Math.min(20, ppm * 10);

    // 4. Minutes Played (0-15 points)
    const minutesPct = calculateMinutesPercentage(candidate, currentGW);
    score += Math.min(15, minutesPct / 6.67);

    // 5. Transfer Trends (0-10 points)
    let netTransfers = 0;
    if (candidate.github_transfers) {
        netTransfers = candidate.github_transfers.transfers_in - candidate.github_transfers.transfers_out;
    } else if (candidate.transfers_in_event !== undefined && candidate.transfers_out_event !== undefined) {
        netTransfers = candidate.transfers_in_event - candidate.transfers_out_event;
    }
    score += Math.min(10, Math.max(0, netTransfers / 10000));

    return score;
}

/**
 * Toggle replacement suggestions for a problem player
 */
window.toggleReplacements = function(idx) {
    const rows = document.querySelectorAll(`.replacement-row[data-problem="${idx}"]`);
    const icon = document.getElementById(`expand-icon-${idx}`);

    if (rows.length === 0) {
        console.log(`   ⚠️ No replacement rows found for problem ${idx}`);
        return;
    }

    const isHidden = rows[0].style.display === 'none';
    rows.forEach(row => {
        row.style.display = isHidden ? 'table-row' : 'none';
    });

    if (icon) {
        if (isHidden) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }
};

/**
 * Generic player table renderer
 */
function renderPlayerTable(players, fixtureMode = 'next5') {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }
    
    let fixtureHeaders = [];
    if (fixtureMode === 'next5') {
        fixtureHeaders = getFixtureHeaders(5, 1);
    } else if (fixtureMode === 'past3next3') {
        fixtureHeaders = [...getPastGWHeaders(3), ...getFixtureHeaders(3, 1)];
    }
    
    let html = `
        <div style="overflow-x: auto; background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead style="background: var(--primary-color); color: white;">
                    <tr>
                        <th style="text-align: left; padding: 0.75rem 1rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 1rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Mins</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Own %</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Price</th>
                        ${fixtureHeaders.map(h => `<th style="text-align: center; padding: 0.5rem;">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    players.forEach((player, index) => {
        const rowBg = index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';
        const risks = analyzePlayerRisks(player);
        const riskTooltip = renderRiskTooltip(risks);
        const hasHighSeverity = hasHighRisk(risks);
        
        const ppm = calculatePPM(player);
        const ptsHeatmap = getPtsHeatmap(player.total_points, 'pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);
        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);
        const ppmHeatmap = getPtsHeatmap(ppm, 'value');
        const ppmStyle = getHeatmapStyle(ppmHeatmap);
        
        let fixtures = [];
        if (fixtureMode === 'next5') {
            fixtures = getFixtures(player.team_code, 10, false).filter(f => f.event > getCurrentGW()).slice(0, 5);
        } else if (fixtureMode === 'past3next3') {
            const past3 = getFixtures(player.team_code, 3, true);
            const next3 = getFixtures(player.team_code, 10, false).filter(f => f.event > getCurrentGW()).slice(0, 3);
            fixtures = [...past3, ...next3];
        }
        
        html += `
            <tr style="background: ${hasHighSeverity ? 'rgba(220, 38, 38, 0.05)' : rowBg};">
                <td style="padding: 0.75rem 1rem;">
                    <strong>${escapeHtml(player.web_name)}</strong>
                    ${riskTooltip ? `<span style="margin-left: 0.5rem;">${riskTooltip}</span>` : ''}
                </td>
                <td style="padding: 0.75rem 1rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 1rem; text-align: center;">${player.minutes || 0}</td>
                <td style="padding: 0.75rem 1rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">
                    ${player.total_points || 0}
                </td>
                <td style="padding: 0.75rem 1rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                    ${formatDecimal(player.form)}
                </td>
                <td style="padding: 0.75rem 1rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">
                    ${formatDecimal(ppm)}
                </td>
                <td style="padding: 0.75rem 1rem; text-align: center;">${formatPercent(player.selected_by_percent)}</td>
                <td style="padding: 0.75rem 1rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                ${fixtures.map(f => `
                    <td style="padding: 0.5rem; text-align: center;">
                        <span class="${getDifficultyClass(f.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; display: inline-block;">
                            ${f.opponent}
                        </span>
                    </td>
                `).join('')}
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// ============================================================================
// DATA ANALYSIS PAGE
// ============================================================================

// State for Data Analysis filters
let analysisState = {
    position: 'all',
    ownershipThreshold: 5,
    fixtureFilter: false,
    momentumFilter: false
};

export function renderDataAnalysis(subTab = 'overview', position = 'all') {
    const container = document.getElementById('app-container');
    analysisState.position = position;

    const tabHTML = `
        <div style="margin-bottom: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-chart-bar"></i> Data Analysis
            </h1>

            <!-- Main Tabs -->
            <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border-color); margin-bottom: 1rem;">
                <button
                    onclick="window.switchAnalysisTab('overview', '${position}')"
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
                    Overview
                </button>
                <button
                    onclick="window.switchAnalysisTab('differentials', '${position}')"
                    style="
                        padding: 0.75rem 1.5rem;
                        background: ${subTab === 'differentials' ? 'var(--primary-color)' : 'transparent'};
                        color: ${subTab === 'differentials' ? 'white' : 'var(--text-primary)'};
                        border: none;
                        border-bottom: 3px solid ${subTab === 'differentials' ? 'var(--primary-color)' : 'transparent'};
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.2s;
                    "
                >
                    Differentials
                </button>
            </div>

            <!-- Position Filter -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem;">
                ${['all', 'GKP', 'DEF', 'MID', 'FWD'].map(pos => `
                    <button
                        onclick="window.switchAnalysisTab('${subTab}', '${pos}')"
                        style="
                            padding: 0.5rem 1rem;
                            background: ${position === pos ? 'var(--accent-color)' : 'var(--bg-secondary)'};
                            color: ${position === pos ? 'white' : 'var(--text-primary)'};
                            border: 1px solid ${position === pos ? 'var(--accent-color)' : 'var(--border-color)'};
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 500;
                            font-size: 0.875rem;
                            transition: all 0.2s;
                        "
                    >
                        ${pos === 'all' ? 'All Positions' : pos}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    let contentHTML = '';
    if (subTab === 'overview') {
        contentHTML = renderAnalysisOverview(position);
    } else {
        contentHTML = renderDifferentials(position);
    }

    container.innerHTML = `
        <div style="padding: 2rem;">
            ${tabHTML}
            ${contentHTML}
        </div>
    `;

    attachRiskTooltipListeners();
}

function renderAnalysisOverview(position = 'all') {
    let players = getAllPlayers();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    const top20 = sortPlayers(players, 'total_points', false).slice(0, 20);
    const bestValue = players.filter(p => calculateMinutesPercentage(p, getCurrentGW()) > 30);
    const top15Value = sortPlayers(bestValue, 'ppm', false).slice(0, 15);
    const top15Form = sortPlayers(bestValue, 'form', false).slice(0, 15);

    // Defensive standouts (for outfield players only)
    let defensiveSection = '';
    if (position === 'DEF' || position === 'MID' || position === 'FWD') {
        const withDefCon = players.filter(p => p.github_season && p.github_season.defensive_contribution_per_90);
        const topDefensive = withDefCon.sort((a, b) =>
            b.github_season.defensive_contribution_per_90 - a.github_season.defensive_contribution_per_90
        ).slice(0, 10);

        if (topDefensive.length > 0) {
            defensiveSection = `
                <div style="margin-top: 3rem;">
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                        🛡️ Defensive Standouts
                    </h2>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                        Top ${position === 'all' ? 'outfield players' : position} by defensive contribution per 90
                    </p>
                    ${renderPositionSpecificTable(topDefensive, position)}
                </div>
            `;
        }
    }

    return `
        <div>
            <!-- Section 1: Top Performers -->
            <div style="margin-bottom: 3rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                    🏆 Top Performers
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Top ${position === 'all' ? '20 players' : '20 ' + position} by total points
                </p>
                ${renderPositionSpecificTable(top20, position)}
            </div>

            <!-- Section 2: Best Value -->
            <div style="margin-bottom: 3rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                    💰 Best Value
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Top 15 by points per million (min 30% minutes played)
                </p>
                ${renderPositionSpecificTable(top15Value, position)}
            </div>

            <!-- Section 3: Form Stars -->
            <div style="margin-bottom: 3rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                    🔥 Form Stars
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    Top 15 by recent form (min 30% minutes played)
                </p>
                ${renderPositionSpecificTable(top15Form, position)}
            </div>

            <!-- Section 4: Defensive Standouts (if applicable) -->
            ${defensiveSection}
        </div>
    `;
}

function renderDifferentials(position = 'all') {
    let players = getAllPlayers();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    // Apply filters
    const differentials = players.filter(p => {
        const ownership = parseFloat(p.selected_by_percent) || 0;
        if (ownership >= analysisState.ownershipThreshold) return false;

        // Position-specific thresholds
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        if (position === 'GKP' || p.element_type === 1) {
            if (minPercentage <= 50 && (p.saves || 0) <= 20) return false;
        } else if (position === 'DEF' || p.element_type === 2) {
            if (minPercentage <= 40 && (!p.github_season || p.github_season.defensive_contribution_per_90 <= 3.0)) return false;
        } else {
            if (minPercentage <= 30 || parseFloat(p.form) <= 3) return false;
        }

        // Fixture filter
        if (analysisState.fixtureFilter) {
            const fdr = calculateFixtureDifficulty(p.team, 5);
            if (fdr > 3.0) return false;
        }

        // Momentum filter
        if (analysisState.momentumFilter && p.github_transfers) {
            const netTransfers = p.github_transfers.transfers_in - p.github_transfers.transfers_out;
            if (netTransfers <= 0) return false;
        }

        return true;
    });

    const sortedDiffs = sortPlayers(differentials, 'total_points', false).slice(0, 20);

    return `
        <div>
            <!-- Filters -->
            <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
                <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">Filters</h3>

                <!-- Ownership Slider -->
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">
                        Ownership Threshold: <span id="ownership-value">${analysisState.ownershipThreshold}%</span>
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value="${analysisState.ownershipThreshold}"
                        style="width: 100%; max-width: 300px;"
                        oninput="window.updateOwnershipThreshold(this.value)"
                    />
                </div>

                <!-- Checkboxes -->
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input
                            type="checkbox"
                            ${analysisState.fixtureFilter ? 'checked' : ''}
                            onchange="window.toggleFixtureFilter(this.checked)"
                        />
                        <span>Only good fixtures (FDR ≤ 3.0)</span>
                    </label>

                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input
                            type="checkbox"
                            ${analysisState.momentumFilter ? 'checked' : ''}
                            onchange="window.toggleMomentumFilter(this.checked)"
                        />
                        <span>Only positive momentum (ΔT > 0)</span>
                    </label>
                </div>
            </div>

            <!-- Results -->
            <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                🎯 Differential Picks
            </h2>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Found ${sortedDiffs.length} ${position === 'all' ? 'players' : position} matching criteria
            </p>
            ${sortedDiffs.length > 0 ? renderPositionSpecificTable(sortedDiffs, position) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No differentials found matching criteria. Try adjusting filters.</div>'}
        </div>
    `;
}

/**
 * Render position-specific table with appropriate columns
 */
function renderPositionSpecificTable(players, position = 'all') {
    if (!players || players.length === 0) {
        return '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No players found</div>';
    }

    const currentGW = getCurrentGW();

    // Get my team's player IDs from cache
    let myPlayerIds = new Set();
    const cachedTeamId = localStorage.getItem('fplanner_team_id');
    if (cachedTeamId) {
        const cachedTeamData = localStorage.getItem(`fplanner_team_${cachedTeamId}`);
        if (cachedTeamData) {
            try {
                const teamData = JSON.parse(cachedTeamData);
                if (teamData && teamData.picks && teamData.picks.picks) {
                    myPlayerIds = new Set(teamData.picks.picks.map(p => p.element));
                }
            } catch (e) {
                console.log('Could not parse cached team data for highlighting');
            }
        }
    }

    // Get next 5 fixtures headers
    const fixtureHeaders = getFixtureHeaders(5, 1);

    // Build table based on position
    let html = `
        <div style="overflow-x: auto; background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead style="background: var(--primary-color); color: white;">
                    <tr>
    `;

    // Position-specific column headers
    if (position === 'GKP') {
        // GKP: Player, Team, Price, Pts, PPM, Own%, Min%, Form, Saves/90, CS/90, xGC/90, CS, ΔT, FDR(5), Fix 1-5
        html += `
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Min%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Saves/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">CS/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">xGC/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">CS</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
        `;
    } else if (position === 'DEF') {
        // DEF: Player, Team, Price, Pts, PPM, Own%, Min%, Form, Def/90, CS, xGC/90, G+A, ΔT, FDR(5), Fix 1-5
        html += `
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Min%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Def/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">CS</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">xGC/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">G+A</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
        `;
    } else if (position === 'MID' || position === 'FWD') {
        // MID/FWD: Player, Team, Price, Pts, PPM, Own%, Min%, Form, Def/90, Goals, Assists, xGI/90, PK, ΔT, FDR(5), Fix 1-5
        html += `
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Min%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Def/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Goals</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Assists</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">xGI/90</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PK</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
        `;
    } else {
        // ALL: Simplified view with position column
        html += `
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Pos</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 0.5rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Price</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">PPM</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Own%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Min%</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">ΔT</th>
                        <th style="text-align: center; padding: 0.75rem 0.5rem;">FDR(5)</th>
        `;
    }

    // Add fixture headers
    fixtureHeaders.forEach(h => {
        html += `<th style="text-align: center; padding: 0.5rem;">${h}</th>`;
    });

    html += `
                    </tr>
                </thead>
                <tbody>
    `;

    // Render rows
    players.forEach((player, index) => {
        // Check if player is in my team
        const isMyPlayer = myPlayerIds.has(player.id);

        // Highlight my players with soft purple background
        const rowBg = isMyPlayer ? 'rgba(137, 80, 252, 0.08)' : (index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)');

        // Calculate common metrics
        const ppm = calculatePPM(player);
        const minPercentage = calculateMinutesPercentage(player, currentGW);
        const ownership = parseFloat(player.selected_by_percent) || 0;
        const fdr5 = calculateFixtureDifficulty(player.team, 5);
        const fdrClass = getDifficultyClass(Math.round(fdr5));

        // Transfer momentum
        let transferNet = '—';
        let transferColor = 'inherit';
        if (player.github_transfers) {
            const net = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
            const prefix = net > 0 ? '+' : '';
            transferNet = `${prefix}${(net / 1000).toFixed(0)}k`;
            transferColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'inherit';
        }

        // Heatmaps
        const ptsHeatmap = getPtsHeatmap(player.total_points, 'pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);
        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);
        const ppmHeatmap = getPtsHeatmap(ppm, 'value');
        const ppmStyle = getHeatmapStyle(ppmHeatmap);

        // Get fixtures
        const next5 = getFixtures(player.team, 10, false).filter(f => f.event > currentGW).slice(0, 5);

        html += `<tr style="background: ${rowBg};">`;

        // Position-specific columns
        if (position === 'GKP') {
            const saves90 = player.github_season?.saves_per_90 || 0;
            const cs90 = player.github_season?.clean_sheets_per_90 || 0;
            const xGC90 = player.expected_goals_conceded_per_90 || 0;
            const cs = player.clean_sheets || 0;

            html += `
                <td style="padding: 0.75rem 0.5rem;"><strong>${escapeHtml(player.web_name)}</strong></td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">${player.total_points}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${minPercentage.toFixed(0)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(saves90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(cs90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatDecimal(xGC90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${cs}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(fdr5)}</span></td>
            `;
        } else if (position === 'DEF') {
            const def90 = player.github_season?.defensive_contribution_per_90 || 0;
            const cs = player.clean_sheets || 0;
            const xGC90 = player.expected_goals_conceded_per_90 || 0;
            const ga = (player.goals_scored || 0) + (player.assists || 0);

            html += `
                <td style="padding: 0.75rem 0.5rem;"><strong>${escapeHtml(player.web_name)}</strong></td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">${player.total_points}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${minPercentage.toFixed(0)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(def90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${cs}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatDecimal(xGC90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${ga}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(fdr5)}</span></td>
            `;
        } else if (position === 'MID' || position === 'FWD') {
            const def90 = player.github_season?.defensive_contribution_per_90 || 0;
            const goals = player.goals_scored || 0;
            const assists = player.assists || 0;
            const xGI90 = player.expected_goal_involvements_per_90 || 0;
            const pk = player.penalties_order === 1 ? '⚽' : '—';

            html += `
                <td style="padding: 0.75rem 0.5rem;"><strong>${escapeHtml(player.web_name)}</strong></td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">${player.total_points}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${minPercentage.toFixed(0)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${formatDecimal(def90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${goals}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${assists}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatDecimal(xGI90)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${pk}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(fdr5)}</span></td>
            `;
        } else {
            // ALL positions - simplified view
            html += `
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">${getPositionShort(player)}</td>
                <td style="padding: 0.75rem 0.5rem;"><strong>${escapeHtml(player.web_name)}</strong></td>
                <td style="padding: 0.75rem 0.5rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">${player.total_points}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${ppmStyle.background}; color: ${ppmStyle.color}; font-weight: 600;">${formatDecimal(ppm)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${ownership.toFixed(1)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem;">${minPercentage.toFixed(0)}%</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">${formatDecimal(player.form)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; color: ${transferColor};">${transferNet}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"><span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(fdr5)}</span></td>
            `;
        }

        // Add fixtures
        next5.forEach((f, fixIdx) => {
            // Highlight first fixture (next GW) with soft purple if this is my player
            const isNextGW = fixIdx === 0;
            const fixtureHighlight = (isMyPlayer && isNextGW) ? 'background: rgba(137, 80, 252, 0.08);' : '';

            html += `
                <td style="padding: 0.5rem; text-align: center; ${fixtureHighlight}">
                    <span class="${getDifficultyClass(f.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem; display: inline-block;">
                        ${f.opponent}
                    </span>
                </td>
            `;
        });

        html += `</tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

// ============================================================================
// SEARCH PAGE
// ============================================================================

export function renderSearch() {
    const container = document.getElementById('app-container');
    
    container.innerHTML = `
        <div style="padding: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-search"></i> Player Search
            </h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Search for players by name or filter by position
            </p>
            
            <div style="margin-bottom: 2rem;">
                <input 
                    type="text" 
                    id="player-search-input"
                    placeholder="Search players..."
                    style="
                        width: 100%;
                        padding: 1rem;
                        border: 2px solid var(--border-color);
                        border-radius: 8px;
                        font-size: 1rem;
                        background: var(--bg-secondary);
                        color: var(--text-primary);
                    "
                    oninput="window.performPlayerSearch()"
                >
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem;">
                <button onclick="window.filterByPosition('all')" class="position-filter-btn" data-position="all" style="padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600;">All</button>
                <button onclick="window.filterByPosition(1)" class="position-filter-btn" data-position="1" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer;">GKP</button>
                <button onclick="window.filterByPosition(2)" class="position-filter-btn" data-position="2" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer;">DEF</button>
                <button onclick="window.filterByPosition(3)" class="position-filter-btn" data-position="3" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer;">MID</button>
                <button onclick="window.filterByPosition(4)" class="position-filter-btn" data-position="4" style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border: none; border-radius: 0.5rem; cursor: pointer;">FWD</button>
            </div>
            
            <div id="search-results">
                <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Enter a search term or select a position</p>
            </div>
        </div>
    `;
}

// ============================================================================
// HELPER: ATTACH RISK TOOLTIP LISTENERS
// ============================================================================

function attachRiskTooltipListeners() {
    // Add hover listeners to risk indicators
    setTimeout(() => {
        const riskIndicators = document.querySelectorAll('.risk-indicator');
        riskIndicators.forEach(indicator => {
            const tooltip = indicator.querySelector('.risk-tooltip');
            if (tooltip) {
                indicator.addEventListener('mouseenter', () => {
                    tooltip.style.display = 'block';
                });
                indicator.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                });
            }
        });
    }, 100);
}

// ============================================================================
// GLOBAL FUNCTION BINDINGS
// ============================================================================

let currentPositionFilter = 'all';
let currentSearchQuery = '';

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

window.performPlayerSearch = function() {
    const input = document.getElementById('player-search-input');
    currentSearchQuery = input.value.toLowerCase().trim();
    updateSearchResults();
};

window.filterByPosition = function(position) {
    currentPositionFilter = position;
    
    // Update button styles
    document.querySelectorAll('.position-filter-btn').forEach(btn => {
        if (btn.dataset.position == position) {
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'var(--bg-secondary)';
            btn.style.color = 'var(--text-primary)';
        }
    });
    
    updateSearchResults();
};

function updateSearchResults() {
    const resultsContainer = document.getElementById('search-results');
    
    if (!currentSearchQuery && currentPositionFilter === 'all') {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Enter a search term or select a position</p>';
        return;
    }
    
    let players = getAllPlayers();
    
    // Filter by position
    if (currentPositionFilter !== 'all') {
        players = players.filter(p => p.element_type == currentPositionFilter);
    }
    
    // Filter by search query
    if (currentSearchQuery) {
        players = players.filter(p => 
            p.web_name.toLowerCase().includes(currentSearchQuery) ||
            p.first_name.toLowerCase().includes(currentSearchQuery) ||
            p.second_name.toLowerCase().includes(currentSearchQuery)
        );
    }
    
    // Sort by total points
    players = sortPlayers(players, 'total_points', false).slice(0, 50);
    
    if (players.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No players found</p>';
        return;
    }
    
    resultsContainer.innerHTML = `
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">Found ${players.length} player${players.length !== 1 ? 's' : ''}</p>
        ${renderPlayerTable(players, 'next5')}
    `;
    
    attachRiskTooltipListeners();
}
