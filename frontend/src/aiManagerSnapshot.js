// ============================================================================
// AI MANAGER SNAPSHOT BUILDER
// Converts cached My Team data into a compact structure for prompts
// ============================================================================

import { sharedState } from './sharedState.js';
import { getPlayerById } from './data.js';
import { getPositionShort, getTeamShortName } from './utils.js';
import { analyzePlayerRisks } from './risk.js';

/**
 * Build a sanitized manager snapshot for AI prompts.
 * @param {Object} [teamData=sharedState.myTeamData] - Loaded My Team payload
 * @returns {Object|null} Snapshot or null if team data missing
 */
export function buildManagerSnapshot(teamData = sharedState.myTeamData) {
    if (!teamData || !teamData.team || !teamData.picks?.picks) {
        return null;
    }

    const { team, picks, gameweek, timestamp } = teamData;
    const entry = picks.entry_history || {};

    const squad = picks.picks.map(pick => {
        const player = getPlayerById(pick.element);
        const playerName = player?.web_name || `Player ${pick.element}`;
        const position = player ? getPositionShort(player) : null;
        const club = player ? getTeamShortName(player.team) : null;
        const rawForm = player ? parseFloat(player.form) : null;
        const normalizedForm = Number.isFinite(rawForm) ? Number(rawForm.toFixed(1)) : null;
        const rawOwnership = player ? parseFloat(player.selected_by_percent) : null;
        const normalizedOwnership = Number.isFinite(rawOwnership) ? Number(rawOwnership.toFixed(1)) : null;
        const priceMillions = player && Number.isFinite(player.now_cost)
            ? Number((player.now_cost / 10).toFixed(1))
            : null;
        const risks = player ? analyzePlayerRisks(player)
            .filter(risk => risk.severity !== 'low')
            .map(risk => `${risk.type}: ${risk.message}`) : [];

        return {
            name: playerName,
            id: pick.element,
            position,
            club,
            priceMillions,
            form: normalizedForm,
            ownershipPercent: normalizedOwnership,
            isStarter: pick.position <= 11,
            isCaptain: Boolean(pick.is_captain),
            isViceCaptain: Boolean(pick.is_vice_captain),
            multiplier: pick.multiplier,
            problemFlags: risks.length > 0 ? risks : undefined
        };
    });

    const problemPlayers = squad
        .filter(player => Array.isArray(player.problemFlags))
        .map(player => ({
            name: player.name,
            position: player.position,
            club: player.club,
            flags: player.problemFlags
        }));

    return {
        meta: {
            manager: `${team.player_first_name} ${team.player_last_name}`,
            teamName: team.name,
            gameweek,
            timestamp
        },
        budget: {
            squadValueMillions: Number(((entry.value ?? 0) / 10).toFixed(1)),
            bankMillions: Number(((entry.bank ?? 0) / 10).toFixed(1)),
            transfersUsedThisGW: entry.event_transfers || 0,
            transferCostPaid: entry.event_transfers_cost || 0
        },
        chips: {
            active: picks.active_chip || null,
            used: team.chips?.map(chip => ({ name: chip.name, event: chip.event })) || []
        },
        squad,
        problemPlayers,
        benchStrength: {
            benchPoints: entry.points_on_bench || 0,
            benchPlayers: squad.filter(player => !player.isStarter).map(player => player.name)
        }
    };
}

