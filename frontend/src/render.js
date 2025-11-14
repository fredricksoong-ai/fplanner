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
    escapeHtml
} from './utils.js';

import {
    getFixtures,
    getGWOpponent,
    calculateFixtureDifficulty,
    getFDRClass
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
    
    const html = `
        <div class="mb-6">
            ${renderManagerInfo(teamData)}
        </div>
        
        <div class="mb-8">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 class="text-2xl font-bold" style="color: var(--primary-color);">
                    <i class="fas fa-users"></i> My Team - GW${gameweek}
                </h2>
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
    
    const fixtureHeaders = getFixtureHeaders(5, 1); // Next 5 GWs
    
    let html = `
        <div style="overflow-x: auto; background: var(--bg-primary); border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
                <thead style="background: var(--primary-color); color: white;">
                    <tr>
                        <th style="text-align: left; padding: 0.75rem 1rem;">Pos</th>
                        <th style="text-align: left; padding: 0.75rem 1rem;">Player</th>
                        <th style="text-align: left; padding: 0.75rem 1rem;">Team</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Opp</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Mins</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Pts</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Form</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">xGI/xGC</th>
                        <th style="text-align: center; padding: 0.75rem 1rem;">Price</th>
                        <th style="text-align: center; padding: 0.5rem;">${fixtureHeaders[0]}</th>
                        <th style="text-align: center; padding: 0.5rem;">${fixtureHeaders[1]}</th>
                        <th style="text-align: center; padding: 0.5rem;">${fixtureHeaders[2]}</th>
                        <th style="text-align: center; padding: 0.5rem;">${fixtureHeaders[3]}</th>
                        <th style="text-align: center; padding: 0.5rem;">${fixtureHeaders[4]}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    players.forEach((pick, index) => {
        const player = getPlayerById(pick.element);
        if (!player) return;
        
        const rowBg = index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)';
        const isCaptain = pick.is_captain;
        const isVice = pick.is_vice_captain;
        
        let captainBadge = '';
        if (isCaptain) captainBadge = ' <span style="color: var(--primary-color); font-weight: 700;">(C)</span>';
        if (isVice) captainBadge = ' <span style="color: var(--text-secondary); font-weight: 700;">(VC)</span>';
        
        const gwOpp = getGWOpponent(player.team_code, gameweek);
        const next5 = getFixtures(player.team_code, 10, false).filter(f => f.event > gameweek).slice(0, 5);
        
        const posType = getPositionType(player);
        const risks = analyzePlayerRisks(player);
        const riskTooltip = renderRiskTooltip(risks);
        const hasHighSeverity = hasHighRisk(risks);
        
        const ptsHeatmap = getPtsHeatmap(player.total_points, 'pts');
        const ptsStyle = getHeatmapStyle(ptsHeatmap);
        
        const formHeatmap = getFormHeatmap(player.form);
        const formStyle = getHeatmapStyle(formHeatmap);
        
        // Position-specific metrics
        let metricValue = '';
        if (posType === 'GKP' || posType === 'DEF') {
            const xGC = player.expected_goals_conceded_per_90 || 0;
            metricValue = formatDecimal(xGC);
        } else {
            const xGI = player.expected_goal_involvements_per_90 || 0;
            metricValue = formatDecimal(xGI);
        }
        
        html += `
            <tr style="background: ${hasHighSeverity ? 'rgba(220, 38, 38, 0.05)' : rowBg};">
                <td style="padding: 0.75rem 1rem; font-weight: 600;">${getPositionShort(player)}</td>
                <td style="padding: 0.75rem 1rem;">
                    <strong>${escapeHtml(player.web_name)}</strong>${captainBadge}
                    ${riskTooltip ? `<span style="margin-left: 0.5rem;">${riskTooltip}</span>` : ''}
                </td>
                <td style="padding: 0.75rem 1rem;">${getTeamShortName(player.team)}</td>
                <td style="padding: 0.75rem 1rem; text-align: center;">
                    <span class="${getDifficultyClass(gwOpp.difficulty)}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">
                        ${gwOpp.name}${gwOpp.isHome ? ' (H)' : ' (A)'}
                    </span>
                </td>
                <td style="padding: 0.75rem 1rem; text-align: center;">${player.minutes || 0}</td>
                <td style="padding: 0.75rem 1rem; text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 600;">
                    ${player.total_points || 0}
                </td>
                <td style="padding: 0.75rem 1rem; text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600;">
                    ${formatDecimal(player.form)}
                </td>
                <td style="padding: 0.75rem 1rem; text-align: center;">${metricValue}</td>
                <td style="padding: 0.75rem 1rem; text-align: center;">${formatCurrency(player.now_cost)}</td>
                ${next5.map(f => `
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
// TRANSFER COMMITTEE PAGE
// ============================================================================

/**
 * Render Transfer Committee page (top performers by position)
 */
export function renderTransferCommittee() {
    const container = document.getElementById('app-container');
    
    container.innerHTML = `
        <div style="padding: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-trophy"></i> Transfer Committee
            </h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Top performing players by position with upcoming fixture analysis
            </p>
            
            ${renderPositionTables()}
        </div>
    `;
    
    attachRiskTooltipListeners();
}

function renderPositionTables() {
    const players = getAllPlayers();
    
    const positions = [
        { id: 1, name: 'Goalkeepers', short: 'GKP' },
        { id: 2, name: 'Defenders', short: 'DEF' },
        { id: 3, name: 'Midfielders', short: 'MID' },
        { id: 4, name: 'Forwards', short: 'FWD' }
    ];
    
    let html = '';
    
    positions.forEach(pos => {
        const positionPlayers = filterByPosition(players, pos.id);
        const top10 = sortPlayers(positionPlayers, 'total_points', false).slice(0, 10);
        
        html += `
            <div style="margin-bottom: 3rem;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                    ${pos.name}
                </h2>
                ${renderPlayerTable(top10, 'next5')}
            </div>
        `;
    });
    
    return html;
}

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

export function renderDataAnalysis(subTab = 'overview') {
    const container = document.getElementById('app-container');
    
    const tabHTML = `
        <div style="margin-bottom: 2rem;">
            <h1 style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-chart-bar"></i> Data Analysis
            </h1>
            <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border-color); margin-bottom: 2rem;">
                <button 
                    onclick="window.switchAnalysisTab('overview')"
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
                    onclick="window.switchAnalysisTab('differentials')"
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
        </div>
    `;
    
    let contentHTML = '';
    if (subTab === 'overview') {
        contentHTML = renderAnalysisOverview();
    } else {
        contentHTML = renderDifferentials();
    }
    
    container.innerHTML = `
        <div style="padding: 2rem;">
            ${tabHTML}
            ${contentHTML}
        </div>
    `;
    
    attachRiskTooltipListeners();
}

function renderAnalysisOverview() {
    const players = getAllPlayers();
    const top20 = sortPlayers(players, 'total_points', false).slice(0, 20);
    
    return `
        <div>
            <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                Top 20 Players (Overall Points)
            </h2>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Showing past 3 and next 3 gameweeks
            </p>
            ${renderPlayerTable(top20, 'past3next3')}
        </div>
    `;
}

function renderDifferentials() {
    const players = getAllPlayers();
    
    // Differentials: Low ownership (<5%), decent points (>30), good form (>3)
    const differentials = players.filter(p => 
        parseFloat(p.selected_by_percent) < 5 &&
        p.total_points > 30 &&
        parseFloat(p.form) > 3 &&
        p.minutes > 270 // At least 3 full games
    );
    
    const sortedDiffs = sortPlayers(differentials, 'total_points', false).slice(0, 20);
    
    return `
        <div>
            <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                Differential Picks
            </h2>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Low ownership (<5%), strong performance (30+ pts, 3+ form)
            </p>
            ${sortedDiffs.length > 0 ? renderPlayerTable(sortedDiffs, 'past3next3') : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No differentials found matching criteria</div>'}
        </div>
    `;
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
                <p>Loading team ${teamId}...</p>
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