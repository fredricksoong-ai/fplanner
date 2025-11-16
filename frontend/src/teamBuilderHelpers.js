// ============================================================================
// TEAM BUILDER HELPERS MODULE
// Core logic for transfer planning, validation, and state management
// ============================================================================

import { getAllPlayers, currentGW } from './data.js';
import { getPositionType, calculatePPM } from './utils.js';
import { calculateFixtureDifficulty } from './fixtures.js';
import { analyzePlayerRisks, hasHighRisk } from './risk.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const SQUAD_LIMITS = {
    GKP: { min: 2, max: 2 },
    DEF: { min: 3, max: 5 },
    MID: { min: 2, max: 5 },
    FWD: { min: 1, max: 3 }
};

const MAX_PLAYERS_PER_TEAM = 3;
const TOTAL_SQUAD_SIZE = 15;
const BUDGET_LIMIT = 1000; // £100.0m in tenths
const POINTS_HIT_PER_TRANSFER = -4;

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Create a new empty transfer plan
 * @param {string} name - Plan name (e.g., "Plan A")
 * @param {Object} currentTeam - Current team data from loadMyTeam()
 * @param {number} planningHorizon - Number of gameweeks to plan (default 3)
 * @returns {Object} New plan object
 */
export function createNewPlan(name, currentTeam, planningHorizon = 3) {
    const startGW = currentGW + 1;
    const gameweekPlans = {};

    // Initialize empty gameweek plans
    for (let i = 0; i < planningHorizon; i++) {
        const gw = startGW + i;
        gameweekPlans[gw] = {
            transfers: [], // Array of {out: playerId, in: playerId}
            freeTransfers: i === 0 ? (currentTeam.picks.entry_history.event_transfers_cost === 0 ? 1 : 1) : 0, // Will be calculated
            pointsHit: 0,
            chipUsed: null // null, 'wildcard', 'freehit', etc.
        };
    }

    return {
        id: generatePlanId(),
        name,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        planningHorizon,
        startGW,
        gameweekPlans,
        currentTeamSnapshot: {
            picks: currentTeam.picks.picks.map(p => ({ ...p })),
            bank: currentTeam.picks.entry_history.bank,
            value: currentTeam.picks.entry_history.value
        }
    };
}

/**
 * Generate a unique plan ID
 */
function generatePlanId() {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate projected squad after applying transfers up to a specific gameweek
 * @param {Object} plan - Transfer plan
 * @param {number} targetGW - Calculate squad after this GW's transfers
 * @returns {Object} { squad: Array, bank: number, value: number }
 */
export function calculateProjectedSquad(plan, targetGW) {
    let squad = [...plan.currentTeamSnapshot.picks];
    let bank = plan.currentTeamSnapshot.bank;

    // Apply transfers from startGW to targetGW
    const startGW = plan.startGW;
    for (let gw = startGW; gw <= targetGW; gw++) {
        const gwPlan = plan.gameweekPlans[gw];
        if (!gwPlan) continue;

        gwPlan.transfers.forEach(transfer => {
            // Remove player out
            const outIdx = squad.findIndex(p => p.element === transfer.out);
            if (outIdx >= 0) {
                squad.splice(outIdx, 1);
            }

            // Add player in
            const playerIn = getAllPlayers().find(p => p.id === transfer.in);
            if (playerIn) {
                squad.push({
                    element: playerIn.id,
                    position: squad.length + 1, // Will be reordered later
                    selling_price: playerIn.now_cost, // Use current price as purchase price
                    multiplier: 1,
                    is_captain: false,
                    is_vice_captain: false
                });

                // Update bank
                const playerOut = getAllPlayers().find(p => p.id === transfer.out);
                if (playerOut) {
                    bank += playerOut.now_cost; // Add back selling price
                }
                bank -= playerIn.now_cost; // Deduct purchase price
            }
        });
    }

    // Calculate total value
    const squadValue = squad.reduce((sum, pick) => {
        const player = getAllPlayers().find(p => p.id === pick.element);
        return sum + (player ? player.now_cost : 0);
    }, 0);

    return {
        squad,
        bank,
        value: squadValue
    };
}

/**
 * Add a transfer to a gameweek plan
 * @param {Object} plan - Transfer plan
 * @param {number} gameweek - Target gameweek
 * @param {number} playerOutId - Player to transfer out
 * @param {number} playerInId - Player to transfer in
 * @returns {Object} { success: boolean, error?: string, updatedPlan: Object }
 */
export function addTransfer(plan, gameweek, playerOutId, playerInId) {
    const gwPlan = plan.gameweekPlans[gameweek];
    if (!gwPlan) {
        return { success: false, error: 'Invalid gameweek' };
    }

    // Check if player out is already being transferred
    const existingTransferOut = gwPlan.transfers.find(t => t.out === playerOutId);
    if (existingTransferOut) {
        return { success: false, error: 'Player already being transferred out this gameweek' };
    }

    // Check if player in is already being transferred in
    const existingTransferIn = gwPlan.transfers.find(t => t.in === playerInId);
    if (existingTransferIn) {
        return { success: false, error: 'Player already being transferred in this gameweek' };
    }

    // Get projected squad BEFORE this transfer
    const prevGW = gameweek - 1;
    const projected = calculateProjectedSquad(plan, prevGW);

    // Check if player out is in the squad
    const hasPlayerOut = projected.squad.find(p => p.element === playerOutId);
    if (!hasPlayerOut) {
        return { success: false, error: 'Player not in squad' };
    }

    // Get player objects
    const playerOut = getAllPlayers().find(p => p.id === playerOutId);
    const playerIn = getAllPlayers().find(p => p.id === playerInId);

    if (!playerOut || !playerIn) {
        return { success: false, error: 'Invalid player selection' };
    }

    // Check budget
    const newBank = projected.bank + playerOut.now_cost - playerIn.now_cost;
    if (newBank < 0) {
        const shortfall = Math.abs(newBank) / 10;
        return { success: false, error: `Insufficient funds (short £${shortfall.toFixed(1)}m)` };
    }

    // Check position match
    if (playerOut.element_type !== playerIn.element_type) {
        return { success: false, error: 'Players must be in same position' };
    }

    // Add transfer
    const updatedPlan = { ...plan };
    updatedPlan.gameweekPlans[gameweek].transfers.push({
        out: playerOutId,
        in: playerInId,
        timestamp: new Date().toISOString()
    });

    // Recalculate free transfers and points hit for all GWs
    recalculateTransferCosts(updatedPlan);

    // Validate the new squad
    const validation = validateSquad(updatedPlan, gameweek);
    if (!validation.valid) {
        return { success: false, error: validation.errors[0] };
    }

    updatedPlan.modified = new Date().toISOString();

    return { success: true, updatedPlan };
}

/**
 * Remove a transfer from a gameweek plan
 * @param {Object} plan - Transfer plan
 * @param {number} gameweek - Target gameweek
 * @param {number} transferIndex - Index of transfer to remove
 * @returns {Object} Updated plan
 */
export function removeTransfer(plan, gameweek, transferIndex) {
    const updatedPlan = { ...plan };
    updatedPlan.gameweekPlans[gameweek].transfers.splice(transferIndex, 1);

    // Recalculate costs
    recalculateTransferCosts(updatedPlan);

    updatedPlan.modified = new Date().toISOString();
    return updatedPlan;
}

/**
 * Recalculate free transfers and points hit for all gameweeks in plan
 * @param {Object} plan - Transfer plan (mutated in place)
 */
function recalculateTransferCosts(plan) {
    let freeTransfersAvailable = 1; // Start with 1 FT

    const gameweeks = Object.keys(plan.gameweekPlans).sort((a, b) => a - b);

    gameweeks.forEach(gw => {
        const gwPlan = plan.gameweekPlans[gw];
        const transferCount = gwPlan.transfers.length;

        // Check if chip is active (Wildcard or Free Hit = unlimited free transfers)
        if (gwPlan.chipUsed === 'wildcard' || gwPlan.chipUsed === 'freehit') {
            gwPlan.freeTransfers = transferCount;
            gwPlan.pointsHit = 0;
            freeTransfersAvailable = 1; // Reset to 1 FT for next GW
            return;
        }

        // Normal transfer logic
        gwPlan.freeTransfers = Math.min(freeTransfersAvailable, transferCount);

        const extraTransfers = Math.max(0, transferCount - freeTransfersAvailable);
        gwPlan.pointsHit = extraTransfers * POINTS_HIT_PER_TRANSFER;

        // Calculate FT for next week
        if (transferCount === 0) {
            // Banked - can have max 2 FT
            freeTransfersAvailable = Math.min(2, freeTransfersAvailable + 1);
        } else {
            // Used at least 1 transfer - reset to 1 FT for next week
            freeTransfersAvailable = 1;
        }
    });
}

/**
 * Set chip for a gameweek
 * @param {Object} plan - Transfer plan
 * @param {number} gameweek - Target gameweek
 * @param {string|null} chipName - 'wildcard', 'freehit', 'benchboost', 'triplecaptain', or null
 * @param {Array} usedChips - Array of already used chips from team data
 * @returns {Object} { success: boolean, error?: string, updatedPlan?: Object }
 */
export function setChip(plan, gameweek, chipName, usedChips = []) {
    // Check if chip already used
    if (chipName && usedChips.some(c => c.name === chipName)) {
        return { success: false, error: `${chipName} has already been used this season` };
    }

    // Check if chip used in another GW of this plan
    const chipUsedElsewhere = Object.entries(plan.gameweekPlans).find(
        ([gw, gwPlan]) => gw != gameweek && gwPlan.chipUsed === chipName
    );
    if (chipUsedElsewhere && chipName) {
        return { success: false, error: `${chipName} already planned for GW${chipUsedElsewhere[0]}` };
    }

    const updatedPlan = { ...plan };
    updatedPlan.gameweekPlans[gameweek].chipUsed = chipName;

    // Recalculate costs (Wildcard/Free Hit affect transfer costs)
    recalculateTransferCosts(updatedPlan);

    updatedPlan.modified = new Date().toISOString();

    return { success: true, updatedPlan };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate squad composition after transfers
 * @param {Object} plan - Transfer plan
 * @param {number} gameweek - Gameweek to validate
 * @returns {Object} { valid: boolean, errors: Array, warnings: Array }
 */
export function validateSquad(plan, gameweek) {
    const { squad, bank, value } = calculateProjectedSquad(plan, gameweek);
    const errors = [];
    const warnings = [];

    // Check squad size
    if (squad.length !== TOTAL_SQUAD_SIZE) {
        errors.push(`Squad must have ${TOTAL_SQUAD_SIZE} players (currently ${squad.length})`);
    }

    // Check position counts
    const positionCounts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
    squad.forEach(pick => {
        const player = getAllPlayers().find(p => p.id === pick.element);
        if (player) {
            const pos = getPositionType(player);
            positionCounts[pos]++;
        }
    });

    Object.entries(SQUAD_LIMITS).forEach(([pos, limits]) => {
        const count = positionCounts[pos];
        if (count < limits.min) {
            errors.push(`Need at least ${limits.min} ${pos} (have ${count})`);
        }
        if (count > limits.max) {
            errors.push(`Maximum ${limits.max} ${pos} allowed (have ${count})`);
        }
    });

    // Check max players per team
    const teamCounts = {};
    squad.forEach(pick => {
        const player = getAllPlayers().find(p => p.id === pick.element);
        if (player) {
            teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
        }
    });

    Object.entries(teamCounts).forEach(([team, count]) => {
        if (count > MAX_PLAYERS_PER_TEAM) {
            const player = getAllPlayers().find(p => p.team === parseInt(team));
            errors.push(`Max ${MAX_PLAYERS_PER_TEAM} players from ${player?.team_name || 'one team'} (have ${count})`);
        }
    });

    // Check budget
    if (value + bank > BUDGET_LIMIT) {
        errors.push(`Total value exceeds £100.0m`);
    }

    if (bank < 0) {
        errors.push(`Insufficient funds (£${Math.abs(bank / 10).toFixed(1)}m over budget)`);
    }

    // Warning: Low bank balance
    if (bank < 5 && bank >= 0) {
        warnings.push(`Low remaining budget (£${(bank / 10).toFixed(1)}m)`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

// ============================================================================
// AUTO-SUGGESTION
// ============================================================================

/**
 * Find suggested transfers for a gameweek
 * @param {Object} plan - Transfer plan
 * @param {number} gameweek - Target gameweek
 * @param {number} maxSuggestions - Maximum number of suggestions (default 5)
 * @returns {Array} Array of suggestions { type, priority, playerOut, playerIn, reason }
 */
export function findSuggestedTransfers(plan, gameweek, maxSuggestions = 5) {
    const { squad, bank } = calculateProjectedSquad(plan, gameweek - 1);
    const allPlayers = getAllPlayers();
    const suggestions = [];

    // 1. Problem players (injuries, suspensions, rotation risk)
    squad.forEach(pick => {
        const player = allPlayers.find(p => p.id === pick.element);
        if (!player) return;

        const risks = analyzePlayerRisks(player);
        if (hasHighRisk(risks)) {
            // Find replacements
            const replacements = findBestReplacements(player, squad, bank, 3);
            replacements.forEach((rep, idx) => {
                suggestions.push({
                    type: 'problem',
                    priority: idx === 0 ? 'high' : 'medium',
                    playerOut: player,
                    playerIn: rep.player,
                    reason: `${player.web_name} has ${risks.map(r => r.type).join(', ')}`,
                    score: rep.score
                });
            });
        }
    });

    // 2. Fixture-based upgrades
    squad.forEach(pick => {
        const player = allPlayers.find(p => p.id === pick.element);
        if (!player) return;

        const fdr = calculateFixtureDifficulty(player.team, 5);
        if (fdr >= 4.0) {
            // Poor fixtures - suggest better options
            const replacements = findBestReplacements(player, squad, bank, 2);
            replacements.forEach(rep => {
                const repFdr = calculateFixtureDifficulty(rep.player.team, 5);
                if (repFdr < fdr - 0.5) {
                    suggestions.push({
                        type: 'fixtures',
                        priority: 'medium',
                        playerOut: player,
                        playerIn: rep.player,
                        reason: `${player.web_name} has tough fixtures (FDR ${fdr.toFixed(1)})`,
                        score: rep.score
                    });
                }
            });
        }
    });

    // 3. Value upgrades (better form/PPM)
    squad.forEach(pick => {
        const player = allPlayers.find(p => p.id === pick.element);
        if (!player) return;

        const playerPPM = calculatePPM(player);
        const playerForm = parseFloat(player.form) || 0;

        // Look for significantly better value options
        const replacements = findBestReplacements(player, squad, bank, 2);
        replacements.forEach(rep => {
            const repPPM = calculatePPM(rep.player);
            const repForm = parseFloat(rep.player.form) || 0;

            // Only suggest if significantly better (20% PPM improvement or 2+ form difference)
            if (repPPM > playerPPM * 1.2 || repForm > playerForm + 2) {
                suggestions.push({
                    type: 'upgrade',
                    priority: 'low',
                    playerOut: player,
                    playerIn: rep.player,
                    reason: `${rep.player.web_name} has better value (PPM ${repPPM.toFixed(1)} vs ${playerPPM.toFixed(1)})`,
                    score: rep.score
                });
            }
        });
    });

    // Sort by priority and score
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    suggestions.sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.score - a.score;
    });

    // Remove duplicates (same player out)
    const seen = new Set();
    const uniqueSuggestions = suggestions.filter(s => {
        const key = `${s.playerOut.id}_${s.playerIn.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return uniqueSuggestions.slice(0, maxSuggestions);
}

/**
 * Find best replacement candidates for a player
 * @param {Object} player - Player to replace
 * @param {Array} currentSquad - Current squad picks
 * @param {number} bank - Available bank
 * @param {number} limit - Max replacements to return
 * @returns {Array} Array of { player, score, priceDiff }
 */
function findBestReplacements(player, currentSquad, bank, limit = 5) {
    const allPlayers = getAllPlayers();
    const maxBudget = player.now_cost + bank;
    const squadPlayerIds = new Set(currentSquad.map(p => p.element));

    // Filter candidates
    const candidates = allPlayers.filter(p => {
        return p.element_type === player.element_type &&
               p.id !== player.id &&
               p.now_cost <= maxBudget &&
               !squadPlayerIds.has(p.id) &&
               p.status !== 'u' && // Not unavailable
               p.chance_of_playing_next_round !== 0; // Not ruled out
    });

    // Score each candidate
    const scored = candidates.map(c => ({
        player: c,
        score: scoreReplacement(c),
        priceDiff: c.now_cost - player.now_cost
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
}

/**
 * Score a replacement candidate
 * @param {Object} player - Player to score
 * @returns {number} Score (0-100)
 */
function scoreReplacement(player) {
    let score = 0;

    // Form (0-30)
    const form = parseFloat(player.form) || 0;
    score += Math.min(30, form * 5);

    // Fixtures (0-25)
    const fdr = calculateFixtureDifficulty(player.team, 5);
    score += Math.max(0, (5 - fdr) * 5);

    // PPM (0-20)
    const ppm = calculatePPM(player);
    score += Math.min(20, ppm * 10);

    // Minutes (0-15)
    const minutesPct = (player.minutes || 0) / (38 * 90) * 100;
    score += Math.min(15, minutesPct / 6.67);

    // Transfer momentum (0-10)
    let netTransfers = 0;
    if (player.github_transfers) {
        netTransfers = player.github_transfers.transfers_in - player.github_transfers.transfers_out;
    } else if (player.transfers_in_event !== undefined) {
        netTransfers = player.transfers_in_event - player.transfers_out_event;
    }
    score += Math.min(10, Math.max(0, netTransfers / 10000));

    return score;
}

// ============================================================================
// LOCALSTORAGE PERSISTENCE
// ============================================================================

const STORAGE_KEY = 'fplanner_transfer_plans';

/**
 * Save plans to localStorage
 * @param {Array} plans - Array of plan objects
 */
export function savePlansToStorage(plans) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
        console.log(`💾 Saved ${plans.length} plan(s) to localStorage`);
    } catch (err) {
        console.error('❌ Failed to save plans:', err);
    }
}

/**
 * Load plans from localStorage
 * @returns {Array} Array of plan objects
 */
export function loadPlansFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const plans = JSON.parse(stored);
        console.log(`📂 Loaded ${plans.length} plan(s) from localStorage`);
        return plans;
    } catch (err) {
        console.error('❌ Failed to load plans:', err);
        return [];
    }
}

/**
 * Delete a plan from storage
 * @param {string} planId - Plan ID to delete
 */
export function deletePlanFromStorage(planId) {
    const plans = loadPlansFromStorage();
    const filtered = plans.filter(p => p.id !== planId);
    savePlansToStorage(filtered);
    console.log(`🗑️ Deleted plan ${planId}`);
}

/**
 * Get available chips for team
 * @param {Object} teamData - Team data from loadMyTeam()
 * @returns {Array} Array of available chip names
 */
export function getAvailableChips(teamData) {
    const allChips = ['wildcard', 'freehit', 'benchboost', 'triplecaptain'];
    const usedChips = teamData.team.chips || [];
    const usedChipNames = usedChips.map(c => c.name);

    return allChips.filter(chip => !usedChipNames.includes(chip));
}
