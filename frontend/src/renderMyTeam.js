// ============================================================================
// MY TEAM PAGE MODULE
// Handles team loading, display, and problem player analysis
// ============================================================================

import {
    getPlayerById,
    loadMyTeam
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
            </div>
            ${renderTeamTable(allPlayers, gameweek)}
        </div>
    `;

    container.innerHTML = html;
    attachRiskTooltipListeners();

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

    // Add event listener for Problem Players toggle
    const problemPlayersHeader = document.getElementById('problem-players-header');
    if (problemPlayersHeader) {
        problemPlayersHeader.addEventListener('click', () => window.toggleProblemPlayers());
    }

    // Add event delegation for toggle replacement buttons
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-replacements-btn');
        if (btn) {
            const idx = parseInt(btn.dataset.idx);
            window.toggleReplacements(idx);
        }
    });
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
