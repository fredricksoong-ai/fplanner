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

// ============================================================================
// MY TEAM PAGE
// ============================================================================

// State for My Team page
let myTeamState = {
    currentTab: 'overview', // 'overview' or 'leagues'
    teamData: null, // Cached team data
    selectedLeagues: [] // Array of selected league IDs (max 3)
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

    // Render tab navigation
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
            </div>
        </div>
    `;

    // Render content based on current tab
    let contentHTML = '';
    if (subTab === 'overview') {
        contentHTML = renderTeamOverviewTab(teamData);
    } else if (subTab === 'leagues') {
        contentHTML = renderLeaguesTab(teamData);
    }

    container.innerHTML = tabHTML + contentHTML;
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

    // Add event listener for Problem Players toggle (if on overview tab)
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

    // Add event delegation for league card clicks
    container.addEventListener('click', (e) => {
        const card = e.target.closest('.league-card');
        if (card && card.classList.contains('selectable')) {
            const leagueId = parseInt(card.dataset.leagueId);
            toggleLeagueSelection(leagueId);
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

/**
 * Render My Leagues tab content
 */
function renderLeaguesTab(teamData) {
    const { team } = teamData;

    const html = `
        <div>
            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                <i class="fas fa-trophy"></i> League Management
            </h3>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Select up to 3 leagues to track. Your selected leagues will be displayed with detailed standings.
            </p>

            <div id="league-selection-container">
                ${renderLeagueSelection(team)}
            </div>

            <div id="league-standings-container" style="margin-top: 2rem;">
                <!-- League standings will be rendered here -->
            </div>
        </div>
    `;

    // After rendering, load standings for selected leagues
    setTimeout(() => loadSelectedLeagueStandings(), 100);

    return html;
}

/**
 * Render league selection UI
 */
function renderLeagueSelection(team) {
    if (!team.leagues || !team.leagues.classic || team.leagues.classic.length === 0) {
        return `
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; text-align: center;">
                <i class="fas fa-info-circle" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">You are not in any leagues yet. Join a league to see standings here!</p>
            </div>
        `;
    }

    const leagues = team.leagues.classic;

    // Sort leagues by entry_rank (user's rank in league)
    const sortedLeagues = [...leagues].sort((a, b) => {
        // Prioritize leagues where user has a rank (in case some don't)
        if (!a.entry_rank) return 1;
        if (!b.entry_rank) return -1;
        return a.entry_rank - b.entry_rank;
    });

    return `
        <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px var(--shadow);">
            <h4 style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem;">
                Your Leagues (${leagues.length})
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
                ${sortedLeagues.map(league => {
                    const isSelected = myTeamState.selectedLeagues.includes(league.id);
                    const canSelect = isSelected || myTeamState.selectedLeagues.length < 3;

                    return `
                        <div
                            class="league-card ${canSelect ? 'selectable' : 'disabled'}"
                            data-league-id="${league.id}"
                            style="
                                background: ${isSelected ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                                color: ${isSelected ? 'white' : 'var(--text-primary)'};
                                padding: 1rem;
                                border-radius: 8px;
                                border: 2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'};
                                cursor: ${canSelect ? 'pointer' : 'not-allowed'};
                                transition: all 0.2s;
                                opacity: ${canSelect ? '1' : '0.5'};
                            "
                        >
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(league.name)}</div>
                                    <div style="font-size: 0.875rem; opacity: 0.8;">
                                        Rank: ${league.entry_rank ? league.entry_rank.toLocaleString() : 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <i class="fas fa-${isSelected ? 'check-circle' : 'circle'}" style="font-size: 1.5rem; opacity: 0.8;"></i>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${myTeamState.selectedLeagues.length === 0 ? `
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 1rem; text-align: center;">
                    <i class="fas fa-hand-pointer"></i> Click on a league to select it (max 3)
                </p>
            ` : `
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 1rem; text-align: center;">
                    ${myTeamState.selectedLeagues.length}/3 leagues selected
                </p>
            `}
        </div>
    `;
}

/**
 * Toggle league selection
 */
function toggleLeagueSelection(leagueId) {
    const index = myTeamState.selectedLeagues.indexOf(leagueId);

    if (index > -1) {
        // Deselect
        myTeamState.selectedLeagues.splice(index, 1);
    } else {
        // Select (if under limit)
        if (myTeamState.selectedLeagues.length < 3) {
            myTeamState.selectedLeagues.push(leagueId);
        }
    }

    // Save to localStorage
    localStorage.setItem('fplanner_selected_leagues', JSON.stringify(myTeamState.selectedLeagues));

    // Re-render the leagues tab
    renderMyTeam(myTeamState.teamData, 'leagues');
}

/**
 * Load standings for selected leagues
 */
async function loadSelectedLeagueStandings() {
    const container = document.getElementById('league-standings-container');

    if (!container) return;

    if (myTeamState.selectedLeagues.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p>Loading league standings...</p>
        </div>
    `;

    try {
        // Load all selected leagues in parallel
        const leaguePromises = myTeamState.selectedLeagues.map(leagueId =>
            loadLeagueStandings(leagueId)
        );

        const leaguesData = await Promise.all(leaguePromises);

        // Render standings for each league
        const standingsHTML = leaguesData.map(leagueData =>
            renderLeagueStandings(leagueData)
        ).join('');

        container.innerHTML = standingsHTML;

    } catch (err) {
        console.error('Failed to load league standings:', err);
        container.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 12px; text-align: center;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ef4444; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">Failed to load league standings. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Render league standings table
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
                        </tr>
                    </thead>
                    <tbody>
                        ${results.slice(0, 50).map((entry, index) => {
                            const isUser = entry.entry === userTeamId;
                            const rowBg = isUser ? 'rgba(56, 189, 248, 0.1)' : (index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)');
                            const rankChange = entry.last_rank - entry.rank;
                            const rankChangeIcon = rankChange > 0 ? '▲' : rankChange < 0 ? '▼' : '━';
                            const rankChangeColor = rankChange > 0 ? '#22c55e' : rankChange < 0 ? '#ef4444' : 'var(--text-secondary)';

                            return `
                                <tr style="background: ${rowBg}; ${isUser ? 'border-left: 4px solid var(--primary-color);' : ''}">
                                    <td style="padding: 0.75rem 0.5rem; text-align: center;">
                                        <div style="font-weight: 600;">${entry.rank.toLocaleString()}</div>
                                        <div style="font-size: 0.75rem; color: ${rankChangeColor};">
                                            ${rankChange !== 0 ? rankChangeIcon + ' ' + Math.abs(rankChange) : rankChangeIcon}
                                        </div>
                                    </td>
                                    <td style="padding: 0.75rem 0.75rem;">
                                        <strong>${escapeHtml(entry.player_name)}</strong>
                                        ${isUser ? ' <span style="color: var(--primary-color); font-weight: 700;">(You)</span>' : ''}
                                    </td>
                                    <td style="padding: 0.75rem 0.75rem;">${escapeHtml(entry.entry_name)}</td>
                                    <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${entry.event_total}</td>
                                    <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600;">${entry.total.toLocaleString()}</td>
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
