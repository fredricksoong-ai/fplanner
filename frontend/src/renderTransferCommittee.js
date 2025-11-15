// ============================================================================
// TRANSFER COMMITTEE PAGE MODULE
// Analyzes problem players and suggests replacements
// ============================================================================

import {
    getPlayerById,
    loadMyTeam
} from './data.js';

import {
    escapeHtml
} from './utils.js';

import {
    analyzePlayerRisks,
    hasHighRisk
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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Attach event listeners to "Go to My Team" buttons
 */
function attachGoToMyTeamListeners() {
    const buttons = document.querySelectorAll('.go-to-my-team-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.hash = 'my-team';
        });
        btn.addEventListener('mouseenter', (e) => {
            e.target.style.opacity = '0.9';
        });
        btn.addEventListener('mouseleave', (e) => {
            e.target.style.opacity = '1';
        });
    });
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
                        class="go-to-my-team-btn"
                        style="
                            padding: 12px 24px;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                            font-size: 1rem;
                            transition: opacity 0.2s;
                        "
                    >
                        <i class="fas fa-users" style="margin-right: 0.5rem;"></i>Go to My Team
                    </button>
                </div>
            </div>
        `;
        attachGoToMyTeamListeners();
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
                            class="go-to-my-team-btn"
                            style="
                                padding: 12px 24px;
                                background: var(--primary-color);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: opacity 0.2s;
                            "
                        >
                            Go to My Team
                        </button>
                    </div>
                </div>
            `;
            attachGoToMyTeamListeners();
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
                        class="go-to-my-team-btn"
                        style="
                            padding: 12px 24px;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: opacity 0.2s;
                        "
                    >
                        <i class="fas fa-arrow-left" style="margin-right: 0.5rem;"></i>Back to My Team
                    </button>
                </div>
            </div>
        `;
        attachGoToMyTeamListeners();
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
    attachGoToMyTeamListeners();

    console.log('   ✅ Transfer Committee rendered');
}
