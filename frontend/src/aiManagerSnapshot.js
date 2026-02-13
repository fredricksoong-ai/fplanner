// ============================================================================
// AI MANAGER SNAPSHOT BUILDER
// Converts cached My Team data into a compact structure for prompts
// ============================================================================

import { sharedState } from './sharedState.js';
import { getPlayerById, isGameweekLive, getActiveGW } from './data.js';
import { getPositionShort, getTeamShortName, calculatePPM } from './utils.js';
import { getFixtures, getGWOpponents } from './fixtures.js';
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

// ============================================================================
// MY TEAM AI INSIGHTS CONTEXT BUILDER
// Assembles enriched squad data for the Squad Doctor prompt
// ============================================================================

/**
 * Build context data for My Team AI insights (Squad Doctor).
 * Enriches the manager snapshot with fixtures, performance metrics,
 * drop candidates, chip availability, and season trajectory.
 * @param {Object} teamData - Full team data from loadMyTeam
 * @returns {Object|null} Context data for AI insights or null if data missing
 */
export function buildMyTeamInsightsContext(teamData) {
    const managerSnapshot = buildManagerSnapshot(teamData);
    if (!managerSnapshot) return null;

    const { team } = teamData;

    // 1. Enrich squad with fixtures + performance metrics
    // Filter problemFlags to FPL-official statuses only (injury, active suspension, deadwood).
    // Exclude self-computed flags (yellow card count, rotation, form, value, price drop)
    // so Gemini doesn't treat them as official FPL statuses.
    const FPL_OFFICIAL_PREFIXES = ['injury:', 'deadwood:'];
    const enrichedSquad = managerSnapshot.squad.map(player => {
        const fullPlayer = getPlayerById(player.id);
        // Get next 3 fixtures for this player's club
        const nextFixtures = fullPlayer
            ? getFixtures(fullPlayer.team, 3, false).map(f => ({
                opponent: f.opponent,
                difficulty: f.difficulty,
                gw: f.event
            }))
            : [];

        // Keep only FPL-official flags for the AI prompt
        const officialFlags = (player.problemFlags || []).filter(flag =>
            FPL_OFFICIAL_PREFIXES.some(prefix => flag.startsWith(prefix)) ||
            flag === 'suspension: Suspended'
        );

        return {
            ...player,
            problemFlags: officialFlags.length > 0 ? officialFlags : undefined,
            nextFixtures,
            totalPoints: fullPlayer?.total_points || 0,
            minutesPlayed: fullPlayer?.minutes || 0,
            xG: fullPlayer?.expected_goals ? Number(parseFloat(fullPlayer.expected_goals).toFixed(2)) : null,
            xA: fullPlayer?.expected_assists ? Number(parseFloat(fullPlayer.expected_assists).toFixed(2)) : null,
            ppm: fullPlayer ? calculatePPM(fullPlayer) : null
        };
    });

    // 2. Pre-filter drop candidates (gives AI a strong signal)
    const dropCandidates = enrichedSquad
        .filter(p => {
            const hasRisks = p.problemFlags && p.problemFlags.length > 0;
            const lowForm = p.form !== null && p.form < 3;
            const lowPPM = p.ppm !== null && p.ppm < 1.2;
            return hasRisks || lowForm || lowPPM;
        })
        .map(p => ({
            name: p.name,
            position: p.position,
            club: p.club,
            form: p.form,
            ppm: p.ppm,
            priceMillions: p.priceMillions,
            flags: p.problemFlags || [],
            nextFixtures: p.nextFixtures
        }));

    // 3. Chips available (not yet used)
    // All chips refresh mid-season, so each can be used up to 2 times total.
    // A chip is available if it's been used fewer than 2 times.
    const usedChipNames = (managerSnapshot.chips.used || []).map(c => c.name);
    const allChips = ['wildcard', 'freehit', 'bboost', '3xc'];
    const chipsAvailable = allChips.filter(c => {
        const timesUsed = usedChipNames.filter(name => name === c).length;
        return timesUsed < 2;
    });

    // 4. Season trajectory (compact) from teamHistory
    let trajectory = null;
    if (teamData.teamHistory?.current?.length > 0) {
        const history = teamData.teamHistory.current;
        const recent5 = history.slice(-5);
        trajectory = {
            totalGWs: history.length,
            recentGWPoints: recent5.map(gw => gw.points),
            recentRanks: recent5.map(gw => gw.overall_rank),
            currentOverallRank: history[history.length - 1]?.overall_rank || null,
            bestRank: Math.min(...history.map(gw => gw.overall_rank).filter(Boolean)),
            worstRank: Math.max(...history.map(gw => gw.overall_rank).filter(Boolean))
        };
    }

    // 5. League context from team.leagues (no extra API call)
    let leagueContext = null;
    if (team.leagues?.classic?.length > 0) {
        leagueContext = team.leagues.classic.slice(0, 3).map(l => ({
            name: l.name,
            rank: l.entry_rank,
            lastRank: l.entry_last_rank
        }));
    }

    // 6. Current GW context (opponents + live points if available)
    const activeGW = getActiveGW();
    const gwIsLive = isGameweekLive(activeGW);
    const currentGWData = {
        gameweek: activeGW,
        isLive: gwIsLive,
        players: enrichedSquad.map(p => {
            const fullPlayer = getPlayerById(p.id);
            const opponents = getGWOpponents(fullPlayer?.team, activeGW);
            return {
                name: p.name,
                position: p.position,
                isStarter: p.isStarter,
                isCaptain: p.isCaptain,
                currentGWPoints: fullPlayer?.event_points || 0,
                opponents: opponents.map(o => ({
                    name: o.name, difficulty: o.difficulty, isHome: o.isHome
                }))
            };
        })
    };

    // Strip squad, problemPlayers, benchStrength from snapshot to avoid duplication —
    // enrichedSquad already contains all player data plus fixtures/xG/PPM.
    // Snapshot now carries only meta, budget, and chips for the AI prompt.
    const { squad: _sq, problemPlayers: _pp, benchStrength: _bs, ...snapshotWithoutSquad } = managerSnapshot;

    return {
        squad: enrichedSquad,
        dropCandidates,
        chipsAvailable,
        trajectory,
        leagueContext,
        currentGWData,
        managerSnapshot: snapshotWithoutSquad
    };
}

