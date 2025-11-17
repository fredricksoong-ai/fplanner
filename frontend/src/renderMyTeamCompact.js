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
 * Render ultra-compact header with team info and GW card
 */
export function renderCompactHeader(teamData, gwNumber) {
    const { picks, team } = teamData;
    const entry = picks.entry_history;

    const gwPoints = entry.event_points || 0;
    const totalPoints = entry.total_points || 0;
    const overallRank = entry.overall_rank ? entry.overall_rank.toLocaleString() : 'N/A';
    const teamValue = ((entry.value || 0) / 10).toFixed(1);
    const bank = ((entry.bank || 0) / 10).toFixed(1);
    const freeTransfers = entry.event_transfers || 0;
    const transferCost = entry.event_transfers_cost || 0;

    // Calculate GW card color based on points (simplified - can add average comparison later)
    let gwCardBg = 'var(--bg-secondary)';
    let gwCardColor = 'var(--text-primary)';
    if (gwPoints >= 60) {
        gwCardBg = 'rgba(34, 197, 94, 0.15)'; // Green
        gwCardColor = '#22c55e';
    } else if (gwPoints >= 45) {
        gwCardBg = 'rgba(59, 130, 246, 0.15)'; // Blue
        gwCardColor = '#3b82f6';
    } else if (gwPoints < 30 && gwPoints > 0) {
        gwCardBg = 'rgba(239, 68, 68, 0.15)'; // Red
        gwCardColor = '#ef4444';
    }

    return `
        <div
            id="compact-header"
            style="
                position: sticky;
                top: 0;
                background: var(--bg-primary);
                z-index: 100;
                padding: 0.75rem 1rem;
                padding-top: calc(0.75rem + env(safe-area-inset-top));
                border-bottom: 2px solid var(--border-color);
                margin: -1rem -1rem 0 -1rem;
            "
        >
            <!-- Row 1: Team name + Action buttons + GW Card -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <div style="flex: 1;">
                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">
                        ${escapeHtml(team.name)}
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; gap: 0.5rem; margin: 0 0.75rem;">
                    <button
                        id="change-team-btn-mobile"
                        class="touch-target"
                        style="
                            width: 44px;
                            height: 44px;
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
                        <i class="fas fa-arrow-left" style="font-size: 1rem;"></i>
                    </button>
                    <button
                        id="refresh-team-btn-mobile"
                        class="touch-target"
                        style="
                            width: 44px;
                            height: 44px;
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
                        <i class="fas fa-sync-alt" style="font-size: 1rem;"></i>
                    </button>
                </div>

                <!-- GW Points Card -->
                <div style="
                    background: ${gwCardBg};
                    border: 2px solid ${gwCardColor};
                    border-radius: 8px;
                    padding: 0.5rem 0.75rem;
                    text-align: center;
                    min-width: 85px;
                ">
                    <div style="font-size: 1.75rem; font-weight: 700; color: ${gwCardColor}; line-height: 1;">
                        ${gwPoints}
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        GW${gwNumber}
                    </div>
                </div>
            </div>

            <!-- Row 2: Stats -->
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                ${totalPoints.toLocaleString()} pts • £${teamValue}m • ${overallRank}
            </div>

            <!-- Row 3: Transfers -->
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                    ${freeTransfers} FT${transferCost > 0 ? ` (${transferCost})` : ' (0)'}
                </div>

                <!-- Expand arrow -->
                <button
                    id="expand-stats-btn"
                    style="
                        background: none;
                        border: none;
                        color: var(--text-secondary);
                        cursor: pointer;
                        padding: 0.25rem;
                        font-size: 0.9rem;
                    "
                    title="More Stats"
                >
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>

            <!-- Expandable Section (hidden by default) -->
            <div
                id="expanded-stats"
                style="
                    display: none;
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid var(--border-color);
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                "
            >
                <div style="display: grid; gap: 0.5rem;">
                    <div>Squad Value: £${((entry.value || 0) / 10 - (entry.bank || 0) / 10).toFixed(1)}m + £${bank}m bank</div>
                    ${team.years_active ? `<div>FPL History: ${team.years_active} Season${team.years_active > 1 ? 's' : ''}</div>` : ''}
                    <div>Manager: ${escapeHtml(team.player_first_name)} ${escapeHtml(team.player_last_name)}</div>
                </div>
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

    // Background color
    const bgColor = isInTemplate
        ? 'rgba(0, 255, 136, 0.08)'  // Green for template
        : 'rgba(107, 25, 112, 0.08)'; // Purple for differential

    const finalBg = hasHighSeverity ? 'rgba(220, 38, 38, 0.08)' : bgColor;

    return `
        <div style="
            display: grid;
            grid-template-columns: 2.5fr 1.2fr 0.8fr 0.8fr 0.8fr;
            gap: 0.3rem;
            padding: 0.5rem 0.75rem;
            background: ${finalBg};
            border-bottom: 1px solid var(--border-color);
            font-size: 0.8rem;
            align-items: center;
            min-height: 44px;
        ">
            <div style="font-weight: 600; color: var(--text-primary);">
                <span style="color: var(--text-secondary); font-size: 0.7rem; margin-right: 0.25rem;">${getPositionShort(player)}</span>
                ${escapeHtml(player.web_name)}${captainBadge}
                ${hasHighSeverity ? '<i class="fas fa-exclamation-triangle" style="color: var(--danger-color); font-size: 0.7rem; margin-left: 0.25rem;"></i>' : ''}
            </div>
            <div style="text-align: center;">
                <span class="${getDifficultyClass(gwOpp.difficulty)}" style="padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">
                    ${gwOpp.name} (${gwOpp.isHome ? 'H' : 'A'})
                </span>
            </div>
            <div style="text-align: center; font-size: 0.75rem; color: var(--text-secondary);">${gwMinutes}</div>
            <div style="text-align: center; background: ${ptsStyle.background}; color: ${ptsStyle.color}; font-weight: 700; padding: 0.3rem; border-radius: 0.25rem; font-size: 0.85rem;">${displayPoints}</div>
            <div style="text-align: center; background: ${formStyle.background}; color: ${formStyle.color}; font-weight: 600; padding: 0.3rem; border-radius: 0.25rem; font-size: 0.8rem;">${formatDecimal(player.form)}</div>
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
            grid-template-columns: 2.5fr 1.2fr 0.8fr 0.8fr 0.8fr;
            gap: 0.3rem;
            padding: 0.6rem 0.75rem;
            background: var(--primary-color);
            color: white;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            position: sticky;
            top: calc(10rem + env(safe-area-inset-top));
            z-index: 90;
        ">
            <div>Player</div>
            <div style="text-align: center;">Opp</div>
            <div style="text-align: center;">Min</div>
            <div style="text-align: center;">Pts</div>
            <div style="text-align: center;">Form</div>
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
    const benchHtml = bench.map(player => {
        const fullPlayer = getPlayerById(player.element);
        if (!fullPlayer) return '';

        const isInTemplate = templatePlayerIds.has(player.element);
        return renderCompactPlayerRow(player, fullPlayer, gwNumber, isInTemplate);
    }).join('');

    // Purple separator between starters and bench (matches desktop)
    const separator = `
        <div style="background: linear-gradient(90deg, #37003c, #2a002e); height: 2px; margin: 0.5rem 0;"></div>
    `;

    // Color legend
    const legend = `
        <div style="
            display: flex;
            gap: 1rem;
            padding: 0.75rem;
            font-size: 0.7rem;
            color: var(--text-secondary);
            background: var(--bg-secondary);
            border-radius: 0.5rem;
            margin-top: 0.5rem;
        ">
            <div style="display: flex; align-items: center; gap: 0.25rem;">
                <div style="width: 12px; height: 12px; background: rgba(0, 255, 136, 0.3); border-radius: 2px;"></div>
                <span>Template</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.25rem;">
                <div style="width: 12px; height: 12px; background: rgba(107, 25, 112, 0.3); border-radius: 2px;"></div>
                <span>Differential</span>
            </div>
        </div>
    `;

    return `
        ${headerRow}
        ${startersHtml}
        ${separator}
        ${benchHtml}
        ${legend}
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
                padding: 0.5rem;
                border-bottom: 1px solid var(--border-color);
                font-size: 0.75rem;
            ">
                <span style="color: var(--text-secondary); min-width: 100px;">${timeStr}</span>
                <span style="font-weight: 600;">${homeTeam} vs ${awayTeam}</span>
            </div>
        `;
    }).join('');

    return `
        <div style="margin-top: 1rem;">
            <details style="
                background: var(--bg-secondary);
                border-radius: 0.5rem;
                overflow: hidden;
            ">
                <summary style="
                    padding: 0.75rem;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.85rem;
                    color: var(--text-primary);
                    user-select: none;
                ">
                    <i class="fas fa-calendar-alt" style="margin-right: 0.5rem;"></i>
                    GW${gwNumber} Fixtures (SGT)
                </summary>
                <div style="padding: 0 0.5rem 0.5rem 0.5rem;">
                    ${fixturesHtml}
                </div>
            </details>
        </div>
    `;
}
