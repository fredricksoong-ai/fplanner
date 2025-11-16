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
    getFixtures
} from './fixtures.js';

import {
    analyzePlayerRisks,
    hasHighRisk,
    renderRiskTooltip
} from './risk.js';

/**
 * Render ultra-compact header (minimal, focused on key stats)
 */
export function renderCompactHeader(teamData, gwNumber) {
    const { picks } = teamData;
    const gwPoints = picks.entry_history.event_points || 0;
    const totalPoints = picks.entry_history.total_points || 0;
    const gwRank = picks.entry_history.rank ? picks.entry_history.rank.toLocaleString() : 'N/A';
    const overallRank = picks.entry_history.overall_rank ? picks.entry_history.overall_rank.toLocaleString() : 'N/A';

    const rankChange = picks.entry_history.rank_sort || 0;
    const rankIcon = rankChange > 0 ? '↓' : rankChange < 0 ? '↑' : '→';

    return `
        <div style="
            position: sticky;
            top: calc(env(safe-area-inset-top) + 3.5rem);
            background: var(--bg-primary);
            z-index: 100;
            padding: 0.5rem 1rem;
            border-bottom: 2px solid var(--border-color);
            margin: -1rem -1rem 0.75rem -1rem;
        ">
            <!-- Top row: GW + Actions -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">
                    GW${gwNumber} • ${gwPoints}pts
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button
                        id="change-team-btn-mobile"
                        style="
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            background: var(--bg-secondary);
                            border: 1px solid var(--border-color);
                            color: var(--text-secondary);
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 0;
                        "
                        title="Change Team"
                    >
                        <i class="fas fa-arrow-left" style="font-size: 0.8rem;"></i>
                    </button>
                    <button
                        id="refresh-team-btn-mobile"
                        style="
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            background: var(--secondary-color);
                            border: none;
                            color: var(--primary-color);
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 0;
                        "
                        title="Refresh"
                    >
                        <i class="fas fa-sync-alt" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            </div>
            <!-- Stats row -->
            <div style="display: flex; gap: 0.75rem; font-size: 0.7rem; color: var(--text-secondary);">
                <span>Rank ${gwRank} ${rankIcon}</span>
                <span>|</span>
                <span>Overall: ${totalPoints}pts</span>
                <span>|</span>
                <span>${overallRank}</span>
            </div>
        </div>
    `;
}

/**
 * Render compact player row (matches desktop exactly)
 */
export function renderCompactPlayerRow(pick, player, gwNumber, isInTemplate) {
    const isCaptain = pick.is_captain;
    const isVice = pick.is_vice_captain;

    let captainBadge = '';
    if (isCaptain) captainBadge = ' <span style="color: var(--primary-color); font-weight: 700; font-size: 0.7rem;">(C)</span>';
    if (isVice) captainBadge = ' <span style="color: var(--text-secondary); font-weight: 700; font-size: 0.7rem;">(VC)</span>';

    const gwOpp = getGWOpponent(player.team, gwNumber);
    const posType = getPositionType(player);
    const risks = analyzePlayerRisks(player);
    const hasHighSeverity = hasHighRisk(risks);

    const ptsHeatmap = getPtsHeatmap(player.total_points, 'pts');
    const ptsStyle = getHeatmapStyle(ptsHeatmap);

    const formHeatmap = getFormHeatmap(player.form);
    const formStyle = getHeatmapStyle(formHeatmap);

    // Get GW-specific stats
    const hasGWStats = player.github_gw && player.github_gw.gw === gwNumber;
    const gwMinutes = hasGWStats ? player.github_gw.minutes : '—';
    const gwPoints = hasGWStats ? player.github_gw.total_points : (player.event_points || 0);
    const displayPoints = isCaptain ? (gwPoints * 2) : gwPoints;

    // Position-specific metrics
    let metricValue = '';
    if (posType === 'GKP' || posType === 'DEF') {
        const xGC = player.expected_goals_conceded_per_90 || 0;
        metricValue = formatDecimal(xGC);
    } else {
        const xGI = player.expected_goal_involvements_per_90 || 0;
        metricValue = formatDecimal(xGI);
    }

    const defCon = player.github_season?.defensive_contribution_per_90 || 0;
    const defConFormatted = formatDecimal(defCon);

    const ppm = calculatePPM(player);
    const ownership = parseFloat(player.selected_by_percent) || 0;

    // Transfer momentum
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

    // Background color
    const bgColor = isInTemplate
        ? 'rgba(0, 255, 136, 0.08)'  // Green for template
        : 'rgba(107, 25, 112, 0.08)'; // Purple for differential

    const finalBg = hasHighSeverity ? 'rgba(220, 38, 38, 0.08)' : bgColor;

    return `
        <div style="
            display: grid;
            grid-template-columns: 0.5fr 2fr 1fr 1fr 1fr 1fr 1fr 1fr;
            gap: 0.25rem;
            padding: 0.4rem 0.5rem;
            background: ${finalBg};
            border-bottom: 1px solid var(--border-color);
            font-size: 0.7rem;
            align-items: center;
        ">
            <div style="font-weight: 600; color: var(--text-secondary);">${getPositionShort(player)}</div>
            <div style="font-weight: 600; color: var(--text-primary);">
                ${escapeHtml(player.web_name)}${captainBadge}
                ${hasHighSeverity ? '<i class="fas fa-exclamation-triangle" style="color: var(--danger-color); font-size: 0.6rem; margin-left: 0.25rem;"></i>' : ''}
            </div>
            <div style="color: var(--text-secondary);">${getTeamShortName(player.team)}</div>
            <div style="text-align: center;">
                <span class="${getDifficultyClass(gwOpp.difficulty)}" style="padding: 0.15rem 0.3rem; border-radius: 0.2rem; font-weight: 600; font-size: 0.65rem;">
                    ${gwOpp.name}${gwOpp.isHome ? 'H' : 'A'}
                </span>
            </div>
            <div style="text-align: center; font-size: 0.65rem; color: var(--text-secondary);">${gwMinutes}</div>
            <div style="text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; padding: 0.25rem; border-radius: 0.2rem;">${displayPoints}</div>
            <div style="text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600; padding: 0.25rem; border-radius: 0.2rem;">${formatDecimal(player.form)}</div>
            <div style="text-align: center; font-size: 0.65rem; color: ${transferColor}; font-weight: 600;">${transferNet}</div>
        </div>
    `;
}

/**
 * Render compact team list
 */
export function renderCompactTeamList(players, gwNumber, templatePlayerIds = new Set()) {
    const starters = players.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
    const bench = players.filter(p => p.position > 11).sort((a, b) => a.position - b.position);

    // Compact header row
    const headerRow = `
        <div style="
            display: grid;
            grid-template-columns: 0.5fr 2fr 1fr 1fr 1fr 1fr 1fr 1fr;
            gap: 0.25rem;
            padding: 0.4rem 0.5rem;
            background: var(--primary-color);
            color: white;
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            position: sticky;
            top: calc(env(safe-area-inset-top) + 7rem);
            z-index: 90;
        ">
            <div>Pos</div>
            <div>Player</div>
            <div>Team</div>
            <div style="text-align: center;">Opp</div>
            <div style="text-align: center;">Min</div>
            <div style="text-align: center;">Pts</div>
            <div style="text-align: center;">Form</div>
            <div style="text-align: center;">ΔT</div>
        </div>
    `;

    // Starting XI
    const startersHtml = starters.map(player => {
        const fullPlayer = getPlayerById(player.element);
        if (!fullPlayer) return '';
        const isInTemplate = templatePlayerIds.has(player.element);
        return renderCompactPlayerRow(player, fullPlayer, gwNumber, isInTemplate);
    }).join('');

    // Bench
    const benchPoints = bench.reduce((sum, p) => {
        const player = getPlayerById(p.element);
        return sum + (player?.event_points || 0);
    }, 0);

    const benchHtml = bench.map(player => {
        const fullPlayer = getPlayerById(player.element);
        if (!fullPlayer) return '';
        const isInTemplate = templatePlayerIds.has(player.element);
        return renderCompactPlayerRow(player, fullPlayer, gwNumber, isInTemplate);
    }).join('');

    // Separator between starters and bench
    const separator = `
        <div style="
            padding: 0;
            background: linear-gradient(90deg, #37003c, #2a002e);
            height: 2px;
            margin: 0.25rem 0;
        "></div>
    `;

    return `
        <div style="background: var(--bg-secondary); border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem;">
            ${headerRow}
            ${startersHtml}
            ${separator}
            ${benchHtml}
        </div>

        <!-- Color legend -->
        <div style="display: flex; gap: 1rem; justify-content: center; font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.25rem;">
                <div style="width: 12px; height: 12px; background: rgba(0, 255, 136, 0.2); border-radius: 2px;"></div>
                <span>Template</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.25rem;">
                <div style="width: 12px; height: 12px; background: rgba(107, 25, 112, 0.2); border-radius: 2px;"></div>
                <span>Differential</span>
            </div>
        </div>
    `;
}

/**
 * Render match schedule (collapsible)
 */
export function renderMatchSchedule(players, gwNumber) {
    const matchGroups = new Map();

    players.forEach(pick => {
        const player = getPlayerById(pick.element);
        if (!player) return;

        const opponent = getGWOpponent(player.team, gwNumber);
        if (!opponent || !opponent.kickoffTime) return;

        // Convert to SGT (UTC+8)
        const kickoffDate = new Date(opponent.kickoffTime);
        const sgtTime = new Date(kickoffDate.getTime() + (8 * 60 * 60 * 1000));

        const dayKey = sgtTime.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeKey = sgtTime.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
        const sortKey = sgtTime.getTime();

        if (!matchGroups.has(sortKey)) {
            matchGroups.set(sortKey, {
                day: dayKey,
                time: timeKey,
                players: []
            });
        }

        matchGroups.get(sortKey).players.push({
            name: player.web_name,
            opponent: `${getTeamShortName(opponent.opponentTeam)}`,
            isHome: opponent.isHome,
            isCaptain: pick.is_captain,
            isViceCaptain: pick.is_vice_captain
        });
    });

    const sortedGroups = Array.from(matchGroups.entries())
        .sort((a, b) => a[0] - b[0]);

    if (sortedGroups.length === 0) {
        return '';
    }

    let currentDay = null;
    const scheduleHtml = sortedGroups.map(([_, group]) => {
        const dayHeader = currentDay !== group.day ? `
            <div style="
                padding: 0.4rem 0.5rem;
                background: var(--bg-tertiary);
                font-weight: 600;
                font-size: 0.7rem;
                text-transform: uppercase;
                color: var(--text-secondary);
            ">
                📅 ${group.day}
            </div>
        ` : '';

        currentDay = group.day;

        const playersHtml = group.players.map(p => {
            const fontWeight = (p.isCaptain || p.isViceCaptain) ? '700' : '500';
            const badge = p.isCaptain ? '(C)' : p.isViceCaptain ? '(VC)' : '';
            return `
                <div style="padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--border-color); font-size: 0.75rem;">
                    <span style="font-weight: ${fontWeight};">• ${p.name} ${badge}</span>
                    <span style="color: var(--text-secondary);"> vs ${p.opponent} (${p.isHome ? 'H' : 'A'})</span>
                </div>
            `;
        }).join('');

        return `
            ${dayHeader}
            <div style="
                padding: 0.4rem 0.5rem;
                background: var(--primary-color);
                color: white;
                font-weight: 600;
                font-size: 0.75rem;
            ">
                ${group.time} SGT
            </div>
            ${playersHtml}
        `;
    }).join('');

    return `
        <details style="margin-bottom: 1rem;">
            <summary style="
                padding: 0.6rem;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 0.5rem;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.85rem;
                color: var(--text-primary);
            ">
                📅 Match Schedule
            </summary>
            <div style="margin-top: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 0.5rem; overflow: hidden;">
                ${scheduleHtml}
            </div>
        </details>
    `;
}
