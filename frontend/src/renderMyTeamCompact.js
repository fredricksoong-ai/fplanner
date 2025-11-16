/**
 * Ultra-Compact Mobile My Team View
 * Maximum information density for live tracking
 */

import {
    getPlayerById
} from './data.js';

import {
    getPositionShort,
    formatCurrency,
    getTeamShortName,
    escapeHtml
} from './utils.js';

import {
    getGWOpponent
} from './fixtures.js';

/**
 * Render ultra-compact header with key stats
 */
export function renderCompactHeader(teamData, gwNumber) {
    const { picks, team } = teamData;
    const gwPoints = picks.entry_history.event_points || 0;
    const totalPoints = picks.entry_history.total_points || 0;
    const gwRank = picks.entry_history.rank ? picks.entry_history.rank.toLocaleString() : 'N/A';
    const overallRank = picks.entry_history.overall_rank ? picks.entry_history.overall_rank.toLocaleString() : 'N/A';

    // Calculate rank change indicator
    const rankChange = picks.entry_history.rank_sort || 0; // Positive = worse, negative = better
    const rankIcon = rankChange > 0 ? '↓' : rankChange < 0 ? '↑' : '→';

    return `
        <div style="
            position: sticky;
            top: calc(env(safe-area-inset-top) + 3.5rem);
            background: var(--bg-primary);
            z-index: 100;
            padding: 0.75rem 1rem;
            border-bottom: 2px solid var(--border-color);
            margin: -1rem -1rem 1rem -1rem;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">
                    GW${gwNumber} • ${gwPoints}pts
                </div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    Rank ${gwRank} ${rankIcon}
                </div>
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-secondary);">
                <span>Overall: ${totalPoints}pts</span>
                <span>|</span>
                <span>Rank: ${overallRank}</span>
            </div>
        </div>
    `;
}

/**
 * Render compact player row
 */
export function renderCompactPlayerRow(pick, fullPlayer, gwNumber, isInTemplate, isLive = false) {
    const opponent = getGWOpponent(fullPlayer.team, gwNumber);
    const isCaptain = pick.is_captain;
    const isViceCaptain = pick.is_vice_captain;

    // Match status
    let status = '';
    let statusColor = 'var(--text-secondary)';

    if (isLive) {
        status = '🔴LIVE';
        statusColor = 'var(--danger-color)';
    } else if (fullPlayer.minutes > 0) {
        status = `✓${fullPlayer.minutes}'`;
        statusColor = 'var(--success-color)';
    } else {
        status = '－';
    }

    // Points (doubled for captain)
    const displayPoints = isCaptain ? (fullPlayer.event_points * 2) : fullPlayer.event_points;

    // BPS
    const bps = fullPlayer.bps || 0;

    // Background color based on template
    const bgColor = isInTemplate
        ? 'rgba(0, 255, 136, 0.1)' // Green for template
        : 'rgba(107, 25, 112, 0.1)'; // Purple for differential

    // Bold if captain/VC
    const fontWeight = (isCaptain || isViceCaptain) ? '700' : '400';
    const captainBadge = isCaptain ? '(C)' : isViceCaptain ? '(VC)' : '';

    // Opponent display
    const oppDisplay = opponent
        ? `${getTeamShortName(opponent.opponentTeam)}(${opponent.isHome ? 'H' : 'A'})`
        : '－';

    return `
        <div style="
            display: grid;
            grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr;
            gap: 0.5rem;
            padding: 0.5rem;
            background: ${bgColor};
            border-bottom: 1px solid var(--border-color);
            font-size: 0.8rem;
            align-items: center;
        ">
            <div style="font-weight: ${fontWeight}; color: var(--text-primary);">
                ${escapeHtml(fullPlayer.web_name)} ${captainBadge}
            </div>
            <div style="color: var(--text-secondary);">
                ${oppDisplay}
            </div>
            <div style="color: ${statusColor}; font-size: 0.7rem;">
                ${status}
            </div>
            <div style="font-weight: 600; color: var(--text-primary); text-align: right;">
                ${displayPoints}pt
            </div>
            <div style="color: var(--text-secondary); text-align: right; font-size: 0.75rem;">
                ${bps} BPS
            </div>
        </div>
    `;
}

/**
 * Render compact team list
 */
export function renderCompactTeamList(players, gwNumber, templatePlayerIds = new Set()) {
    const starters = players.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
    const bench = players.filter(p => p.position > 11).sort((a, b) => a.position - b.position);

    // Header row
    const headerRow = `
        <div style="
            display: grid;
            grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr;
            gap: 0.5rem;
            padding: 0.5rem;
            background: var(--primary-color);
            color: white;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            border-radius: 0.5rem 0.5rem 0 0;
        ">
            <div>Player</div>
            <div>Opponent</div>
            <div>Status</div>
            <div style="text-align: right;">Pts</div>
            <div style="text-align: right;">BPS</div>
        </div>
    `;

    // Starting XI
    const startersHtml = starters.map(player => {
        const fullPlayer = getPlayerById(player.element);
        if (!fullPlayer) return '';
        const isInTemplate = templatePlayerIds.has(player.element);
        return renderCompactPlayerRow(player, fullPlayer, gwNumber, isInTemplate, false);
    }).join('');

    // Bench (collapsible)
    const benchPoints = bench.reduce((sum, p) => {
        const player = getPlayerById(p.element);
        return sum + (player?.event_points || 0);
    }, 0);

    const benchHtml = bench.map(player => {
        const fullPlayer = getPlayerById(player.element);
        if (!fullPlayer) return '';
        const isInTemplate = templatePlayerIds.has(player.element);
        return renderCompactPlayerRow(player, fullPlayer, gwNumber, isInTemplate, false);
    }).join('');

    return `
        <div style="background: var(--bg-secondary); border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem;">
            ${headerRow}
            ${startersHtml}
        </div>

        <!-- Collapsible Bench -->
        <details style="margin-bottom: 1rem;">
            <summary style="
                padding: 0.75rem;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 0.5rem;
                cursor: pointer;
                font-weight: 600;
                color: var(--text-primary);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span>💺 Bench</span>
                <span style="color: ${benchPoints > 5 ? 'var(--warning-color)' : 'var(--text-secondary)'};">
                    ${benchPoints}pts
                </span>
            </summary>
            <div style="margin-top: 0.5rem; background: var(--bg-secondary); border-radius: 0.5rem; overflow: hidden;">
                ${benchHtml}
            </div>
        </details>
    `;
}

/**
 * Render match schedule grouped by time
 */
export function renderMatchSchedule(players, gwNumber) {
    // Group players by match time
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

    // Sort by time
    const sortedGroups = Array.from(matchGroups.entries())
        .sort((a, b) => a[0] - b[0]);

    if (sortedGroups.length === 0) {
        return `
            <details style="margin-bottom: 1rem;">
                <summary style="
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 0.5rem;
                    cursor: pointer;
                    font-weight: 600;
                    color: var(--text-primary);
                ">
                    📅 Match Schedule
                </summary>
                <div style="padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
                    No upcoming matches
                </div>
            </details>
        `;
    }

    let currentDay = null;
    const scheduleHtml = sortedGroups.map(([_, group]) => {
        const dayHeader = currentDay !== group.day ? `
            <div style="
                padding: 0.5rem;
                background: var(--bg-tertiary);
                font-weight: 600;
                font-size: 0.75rem;
                text-transform: uppercase;
                color: var(--text-secondary);
            ">
                📅 ${group.day}
            </div>
        ` : '';

        currentDay = group.day;

        const playersHtml = group.players.map(p => {
            const fontWeight = (p.isCaptain || p.isViceCaptain) ? '700' : '400';
            const badge = p.isCaptain ? '(C)' : p.isViceCaptain ? '(VC)' : '';
            return `
                <div style="padding: 0.5rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
                    <span style="font-weight: ${fontWeight};">• ${p.name} ${badge}</span>
                    <span style="color: var(--text-secondary);"> vs ${p.opponent} (${p.isHome ? 'H' : 'A'})</span>
                </div>
            `;
        }).join('');

        return `
            ${dayHeader}
            <div style="
                padding: 0.5rem;
                background: var(--primary-color);
                color: white;
                font-weight: 600;
                font-size: 0.8rem;
            ">
                ${group.time} SGT
            </div>
            ${playersHtml}
        `;
    }).join('');

    return `
        <details style="margin-bottom: 1rem;">
            <summary style="
                padding: 0.75rem;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 0.5rem;
                cursor: pointer;
                font-weight: 600;
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
