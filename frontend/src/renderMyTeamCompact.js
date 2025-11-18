/**
 * Ultra-Compact Mobile My Team View
 * Matches desktop fields exactly, maximum density
 */

import {
    getPlayerById
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
    escapeHtml
} from './utils.js';

import {
    getGWOpponent,
    getFixtures,
    getMatchStatus
} from './fixtures.js';

import {
    analyzePlayerRisks,
    hasHighRisk,
    renderRiskTooltip
} from './risk.js';

/**
 * Render ultra-compact header with team info and GW card
 */
export function renderCompactHeader(teamData, gwNumber) {
    const { picks, team } = teamData;
    const entry = picks.entry_history;

    // Use team.summary_* fields (most accurate, from /api/entry/{teamId}/)
    const gwPoints = team.summary_event_points || 0;
    const totalPoints = team.summary_overall_points || 0;
    const overallRankNum = team.summary_overall_rank || 0;
    const gwRankNum = team.summary_event_rank || 0;
    const overallRank = overallRankNum ? overallRankNum.toLocaleString() : 'N/A';
    const gwRank = gwRankNum ? gwRankNum.toLocaleString() : 'N/A';

    // Team value and bank from entry_history (GW-specific)
    const teamValue = ((entry.value || 0) / 10).toFixed(1);
    const bank = ((entry.bank || 0) / 10).toFixed(1);
    const squadValue = ((entry.value || 0) / 10 - (entry.bank || 0) / 10).toFixed(1);
    const freeTransfers = entry.event_transfers || 0;
    const transferCost = entry.event_transfers_cost || 0;

    // Rank color based on localStorage cache comparison
    const cacheKey = `fpl_rank_${team.id}`;
    const cachedRank = localStorage.getItem(cacheKey);
    let rankColor = 'var(--text-secondary)';

    if (cachedRank && overallRankNum > 0) {
        const previousRank = parseInt(cachedRank, 10);
        const rankChange = previousRank - overallRankNum;

        if (rankChange > 0) {
            // Rank improved (number went down)
            rankColor = '#22c55e';
        } else if (rankChange < 0) {
            // Rank worsened (number went up)
            rankColor = '#ef4444';
        }
    }

    // Store current rank for next comparison
    if (overallRankNum > 0) {
        localStorage.setItem(cacheKey, overallRankNum.toString());
    }

    // Find captain and vice captain using getPlayerById
    const captainPick = picks.picks.find(p => p.is_captain);
    const vicePick = picks.picks.find(p => p.is_vice_captain);

    let captainInfo = 'None';
    let viceInfo = 'None';

    if (captainPick) {
        const captainPlayer = getPlayerById(captainPick.element);
        if (captainPlayer) {
            const captainOpp = getGWOpponent(captainPlayer.team, gwNumber);
            const oppBadge = `<span class="${getDifficultyClass(captainOpp.difficulty)}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.62rem; min-width: 3rem; display: inline-block; text-align: center;">${captainOpp.name} (${captainOpp.isHome ? 'H' : 'A'})</span>`;
            captainInfo = `${captainPlayer.web_name} vs. ${oppBadge}`;
        }
    }

    if (vicePick) {
        const vicePlayer = getPlayerById(vicePick.element);
        if (vicePlayer) {
            const viceOpp = getGWOpponent(vicePlayer.team, gwNumber);
            const oppBadge = `<span class="${getDifficultyClass(viceOpp.difficulty)}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.62rem; min-width: 3rem; display: inline-block; text-align: center;">${viceOpp.name} (${viceOpp.isHome ? 'H' : 'A'})</span>`;
            viceInfo = `${vicePlayer.web_name} vs. ${oppBadge}`;
        }
    }

    // Calculate GW text color based on rank performance (relative to overall rank)
    let gwTextColor = 'var(--text-primary)';

    if (overallRankNum > 0 && gwRankNum > 0) {
        const rankRatio = gwRankNum / overallRankNum;

        if (rankRatio <= 0.5) {
            // Exceptional: GW rank is 50% or better than overall rank
            gwTextColor = '#9333ea'; // Purple
        } else if (rankRatio < 1.0) {
            // Outperforming: GW rank is better than overall rank
            gwTextColor = '#22c55e'; // Green
        } else if (rankRatio <= 1.2) {
            // On par: Within 20% of overall rank
            gwTextColor = '#eab308'; // Yellow
        } else {
            // Underperforming: Worse than 20% of overall rank
            gwTextColor = '#ef4444'; // Red
        }
    }

    // Get selected league info
    const selectedLeagueId = localStorage.getItem(`fpl_selected_league_${team.id}`);
    let leagueInfo = '';

    if (selectedLeagueId && selectedLeagueId !== 'null') {
        // Store league data in a data attribute for later rendering
        leagueInfo = `
            <div id="league-info-placeholder" data-team-id="${team.id}" data-league-id="${selectedLeagueId}" style="margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid var(--border-color);">
                <div style="font-size: 0.65rem; color: var(--text-secondary);">Loading league...</div>
            </div>
        `;
    }

    // --- FIX: Add CSS variable to dynamically set header height
    const headerHeightStyle = `--compact-header-height: calc(3.5rem + 8rem + env(safe-area-inset-top));`;


    return `
        <div
            id="compact-header"
            style="
                position: sticky;
                top: calc(3.5rem + env(safe-area-inset-top)); /* Keeps this box sticky just below the top app bar */
                background: var(--bg-primary);
                z-index: 100;
                padding: 0.5rem 0;
                border-bottom: 2px solid var(--border-color);
                margin: 0;
            "
        >
            <div style="display: flex; justify-content: space-between; align-items: stretch; gap: 0.5rem;">
                <div style="flex: 1; display: grid; gap: 0.2rem; padding-left: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <button
                            id="change-team-btn"
                            style="
                                background: transparent;
                                border: 1px solid var(--border-color);
                                border-radius: 0.3rem;
                                padding: 0.2rem 0.35rem;
                                color: var(--text-secondary);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.2s;
                            "
                            title="Change Team"
                        >
                            <i class="fas fa-exchange-alt" style="font-size: 0.7rem;"></i>
                        </button>
                        <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; flex: 1;">
                            ${escapeHtml(team.name)}
                        </div>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        <span style="color: ${rankColor};">${overallRank}</span> • ${totalPoints.toLocaleString()} pts
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-secondary);">
                        Transfers: ${freeTransfers} FT${transferCost > 0 ? ` (-${transferCost} pts)` : ''}  •  Squad: £${squadValue}m + £${bank}m
                    </div>
                </div>

                <div style="display: flex; align-items: stretch; padding-right: 0.75rem;">
                    <div style="
                        background: var(--bg-secondary);
                        border: 1px solid var(--border-color);
                        border-radius: 6px;
                        padding: 0.6rem 0.75rem;
                        text-align: center;
                        min-width: 90px;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                    ">
                        <div style="font-size: 1.75rem; font-weight: 800; color: ${gwTextColor}; line-height: 1;">
                            ${gwPoints}
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.2rem; font-weight: 600;">
                            GW ${gwNumber}
                        </div>
                        ${leagueInfo}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render compact player row with ownership and transfer momentum
 */
export function renderCompactPlayerRow(pick, player, gwNumber) {
    const isCaptain = pick.is_captain;
    const isVice = pick.is_vice_captain;
    const isBench = pick.position > 11;

    let captainBadge = '';
    if (isCaptain) captainBadge = ' <span style="color: var(--primary-color); font-weight: 700; font-size: 0.7rem;">(C)</span>';
    if (isVice) captainBadge = ' <span style="color: var(--text-secondary); font-weight: 700; font-size: 0.7rem;">(VC)</span>';

    const gwOpp = getGWOpponent(player.team, gwNumber);
    const risks = analyzePlayerRisks(player);
    const riskTooltip = renderRiskTooltip(risks);

    // Get match status display with color coding
    const matchStatus = getMatchStatus(player.team, gwNumber, player);
    const isLive = matchStatus === 'LIVE';
    const isFinished = matchStatus.startsWith('FT');

    // Color code minutes played
    let statusColor = 'var(--text-secondary)';
    let statusBgColor = 'transparent';
    let statusWeight = '400';

    if (isFinished && matchStatus.includes('(')) {
        // Extract minutes from "FT (90)" format
        const minsMatch = matchStatus.match(/\((\d+)\)/);
        if (minsMatch) {
            const mins = parseInt(minsMatch[1]);
            statusWeight = '700';
            if (mins >= 90) {
                statusColor = '#166534'; // Soft green
                statusBgColor = 'rgba(34, 197, 94, 0.15)';
            } else if (mins >= 60) {
                statusColor = '#a16207'; // Soft yellow/orange
                statusBgColor = 'rgba(234, 179, 8, 0.15)';
            } else {
                statusColor = '#991b1b'; // Soft red
                statusBgColor = 'rgba(239, 68, 68, 0.15)';
            }
        } else {
            statusColor = '#22c55e'; // FT but no minutes data
        }
    } else if (isLive) {
        statusColor = '#ef4444';
        statusWeight = '700';
    }

    // Get GW-specific stats
    const hasGWStats = player.github_gw && player.github_gw.gw === gwNumber;
    const gwPoints = hasGWStats ? player.github_gw.total_points : (player.event_points || 0);
    const displayPoints = isCaptain ? (gwPoints * 2) : gwPoints;

    // Use GW points for heatmap (not season total)
    const ptsHeatmap = getPtsHeatmap(displayPoints, 'gw_pts');
    const ptsStyle = getHeatmapStyle(ptsHeatmap);

    const formHeatmap = getFormHeatmap(player.form);
    const formStyle = getHeatmapStyle(formHeatmap);

    // Ownership
    const ownership = parseFloat(player.selected_by_percent) || 0;

    // Transfer momentum (net transfers)
    const transfersIn = player.transfers_in_event || 0;
    const transfersOut = player.transfers_out_event || 0;
    const netTransfers = transfersIn - transfersOut;
    const transferColor = netTransfers > 0 ? '#22c55e' : netTransfers < 0 ? '#ef4444' : 'var(--text-secondary)';

    // Background color - captain/vice get purple highlights, no bench highlight
    let bgColor = 'var(--bg-primary)';
    if (isCaptain && !isBench) {
        bgColor = 'rgba(147, 51, 234, 0.12)'; // Purple for captain
    } else if (isVice && !isBench) {
        bgColor = 'rgba(147, 51, 234, 0.06)'; // Lighter purple for vice
    }

    // Add thick border after row 11 (last starter)
    const borderStyle = pick.position === 11 ? '3px solid var(--border-color)' : '1px solid var(--border-color)';

    return `
        <div
            class="player-row"
            data-player-id="${player.id}"
            style="
            display: grid;
            grid-template-columns: 2.5fr 1fr 1fr 0.8fr 0.8fr;
            gap: 0.25rem;
            padding: 0.4rem 0.75rem;
            background: ${bgColor};
            border-bottom: ${borderStyle};
            font-size: 0.75rem;
            align-items: center;
            cursor: pointer;
        ">
            <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(player.web_name)}${captainBadge}
                ${riskTooltip ? `${riskTooltip}` : ''}
            </div>
            <div style="text-align: center;">
                <span class="${getDifficultyClass(gwOpp.difficulty)}" style="padding: 0.08rem 0.25rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.62rem; min-width: 3rem; display: inline-block; text-align: center;">
                    ${gwOpp.name} (${gwOpp.isHome ? 'H' : 'A'})
                </span>
            </div>
            <div style="text-align: center; font-size: 0.6rem; font-weight: ${statusWeight}; color: ${statusColor}; background: ${statusBgColor}; padding: 0.2rem; border-radius: 0.2rem;">${matchStatus}</div>
            <div style="text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; padding: 0.05rem; border-radius: 0.2rem; font-size: 0.7rem;">${displayPoints}</div>
            <div style="text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600; padding: 0.05rem; border-radius: 0.2rem; font-size: 0.65rem;">${formatDecimal(player.form)}</div>
        </div>
    `;
}

/**
 * Render compact team list
 */
export function renderCompactTeamList(players, gwNumber) {
    const starters = players.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
    const bench = players.filter(p => p.position > 11).sort((a, b) => a.position - b.position);

    // Compact header row (scrolls with content)
    const headerRow = `
        <div style="
            display: grid;
            grid-template-columns: 2.5fr 1fr 1fr 0.8fr 0.8fr;
            gap: 0.25rem;
            padding: 0.4rem 0.75rem;
            background: var(--bg-secondary);
            color: var(--text-primary);
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: capitalize;
            border-top: 2px solid var(--border-color);
        ">
            <div>Player</div>
            <div style="text-align: center;">Opp</div>
            <div style="text-align: center;">Status</div>
            <div style="text-align: center;">Pts</div>
            <div style="text-align: center;">Form</div>
        </div>
    `;

    // Starting XI
    const startersHtml = starters.map(player => {
        const fullPlayer = getPlayerById(player.element);
        if (!fullPlayer) return '';
        return renderCompactPlayerRow(player, fullPlayer, gwNumber);
    }).join('');

    // Bench
    const benchHtml = bench.map(player => {
        const fullPlayer = getPlayerById(player.element);
        if (!fullPlayer) return '';
        return renderCompactPlayerRow(player, fullPlayer, gwNumber);
    }).join('');

    return `
        <div style="background: var(--bg-secondary);">
            ${headerRow}
            ${startersHtml}
            ${benchHtml}
        </div>
    `;
}

/**
 * Render match schedule section (collapsible)
 */
export function renderMatchSchedule(players, gwNumber) {
    const fixtures = getFixtures();
    const gwFixtures = fixtures.filter(f => f.event === gwNumber);

    // Get unique team IDs from player squad
    const teamIds = new Set(players.map(p => {
        const player = getPlayerById(p.element);
        return player ? player.team : null;
    }).filter(Boolean));

    // Filter fixtures for squad teams
    const squadFixtures = gwFixtures.filter(f =>
        teamIds.has(f.team_h) || teamIds.has(f.team_a)
    );

    if (squadFixtures.length === 0) {
        return '';
    }

    // Sort by kickoff time
    squadFixtures.sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));

    const fixturesHtml = squadFixtures.map(fixture => {
        const homeTeam = getTeamShortName(fixture.team_h);
        const awayTeam = getTeamShortName(fixture.team_a);

        // Convert to SGT (UTC+8)
        const kickoffDate = new Date(fixture.kickoff_time);
        const sgtTime = new Date(kickoffDate.getTime() + (8 * 60 * 60 * 1000));
        const timeStr = sgtTime.toLocaleString('en-SG', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        return `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.5rem 0;
                border-bottom: 1px solid var(--border-color);
                font-size: 0.75rem;
            ">
                <span style="color: var(--text-secondary); min-width: 100px;">${timeStr}</span>
                <span style="font-weight: 600;">${homeTeam} vs ${awayTeam}</span>
            </div>
        `;
    }).join('');

    return `
        <div>
            <details style="
                background: var(--bg-secondary);
                border-radius: 0;
                overflow: hidden;
            ">
                <summary style="
                    padding: 0.5rem 0.75rem;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.8rem;
                    color: var(--text-primary);
                    user-select: none;
                ">
                    <i class="fas fa-calendar-alt" style="margin-right: 0.5rem;"></i>
                    GW${gwNumber} Fixtures (SGT)
                </summary>
                <div style="padding: 0 0.75rem 0.5rem 0.75rem;">
                    ${fixturesHtml}
                </div>
            </details>
        </div>
    `;
}

/**
 * Show player modal with details
 * @param {number} playerId - Player ID
 */
export function showPlayerModal(playerId) {
    const player = getPlayerById(playerId);
    if (!player) return;

    // Create modal overlay
    const modalHTML = `
        <div id="player-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        ">
            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                max-width: 500px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <div style="
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                        ${escapeHtml(player.web_name)}
                    </h3>
                    <button
                        id="close-player-modal"
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
                <div style="padding: 1.5rem; text-align: center;">
                    <p style="color: var(--text-secondary); font-size: 1rem; margin: 0;">
                        Player details coming soon!
                    </p>
                    <p style="color: var(--text-tertiary); font-size: 0.875rem; margin-top: 0.5rem;">
                        This modal will show detailed player stats, fixtures, and analysis.
                    </p>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('player-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    document.getElementById('close-player-modal').addEventListener('click', closePlayerModal);
    document.getElementById('player-modal').addEventListener('click', (e) => {
        if (e.target.id === 'player-modal') {
            closePlayerModal();
        }
    });
}

/**
 * Close player modal
 */
export function closePlayerModal() {
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Attach click listeners to player rows
 */
export function attachPlayerRowListeners() {
    const playerRows = document.querySelectorAll('.player-row');
    playerRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking on risk indicator
            if (e.target.closest('.risk-indicator')) {
                return;
            }
            const playerId = parseInt(row.dataset.playerId);
            if (playerId) {
                showPlayerModal(playerId);
            }
        });
    });
}
