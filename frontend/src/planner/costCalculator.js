/**
 * Transfer Cost Calculator
 * Calculates transfer costs and points hits
 */

import { getAllPlayers } from '../data.js';
import { formatCurrency } from '../utils.js';
import { plannerState } from './state.js';

const POINTS_HIT_PER_TRANSFER = -4;

/**
 * Calculate transfer costs for changes
 * @param {Array} changes - Array of {out: playerId, in: playerId}
 * @param {number} initialBank - Initial bank balance
 * @returns {Object} Cost summary
 */
export function calculateTransferCosts(changes, initialBank) {
    if (!changes || changes.length === 0) {
        return {
            transferCount: 0,
            freeTransfersUsed: 0,
            freeTransfersRemaining: 1,
            pointsHit: 0,
            budgetImpact: 0,
            newBank: initialBank
        };
    }

    const transferCount = changes.length;
    
    // Simple logic: first transfer is free, rest cost -4 points each
    // In reality, this would track free transfers across gameweeks
    const freeTransfersUsed = Math.min(1, transferCount);
    const extraTransfers = Math.max(0, transferCount - freeTransfersUsed);
    const pointsHit = extraTransfers * POINTS_HIT_PER_TRANSFER;

    // Calculate budget impact
    const allPlayers = getAllPlayers();
    let totalCost = 0;
    
    changes.forEach(change => {
        const playerOut = allPlayers.find(p => p.id === change.out);
        const playerIn = allPlayers.find(p => p.id === change.in);
        
        if (playerOut && playerIn) {
            // Selling price is what you paid (we'll use current price as approximation)
            // Buying price is current price
            totalCost += (playerIn.now_cost - playerOut.now_cost);
        }
    });

    const newBank = initialBank - totalCost;

    return {
        transferCount,
        freeTransfersUsed,
        freeTransfersRemaining: Math.max(0, 1 - freeTransfersUsed),
        pointsHit,
        budgetImpact: -totalCost,
        newBank
    };
}

/**
 * Render cost summary bar
 * @param {Object} costSummary - Cost summary object
 * @returns {string} HTML string
 */
export function renderCostSummary(costSummary) {
    if (!costSummary) {
        return '';
    }

    const { transferCount, freeTransfersUsed, freeTransfersRemaining, pointsHit, budgetImpact, newBank } = costSummary;

    const pointsHitColor = pointsHit < 0 ? '#ef4444' : 'var(--text-primary)';
    const budgetColor = budgetImpact < 0 ? '#ef4444' : budgetImpact > 0 ? '#22c55e' : 'var(--text-primary)';

    return `
        <div style="
            margin-bottom: 1rem;
            padding: 0.75rem;
            background: var(--bg-secondary);
            border-radius: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            align-items: center;
            justify-content: space-between;
        ">
            <div style="
                display: flex;
                flex-wrap: wrap;
                gap: 1rem;
                font-size: 0.75rem;
                color: var(--text-secondary);
            ">
                <span>
                    <strong style="color: var(--text-primary);">Transfers:</strong> 
                    ${transferCount} (${freeTransfersUsed} free, ${freeTransfersRemaining} remaining)
                </span>
                <span style="color: ${pointsHitColor};">
                    <strong>Points Hit:</strong> ${pointsHit}
                </span>
                <span style="color: ${budgetColor};">
                    <strong>Budget:</strong> ${formatCurrency(newBank)} 
                    ${budgetImpact !== 0 ? `(${budgetImpact >= 0 ? '+' : ''}${formatCurrency(budgetImpact)})` : ''}
                </span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                ${transferCount > 0 ? `
                    <button
                        id="planner-reset-all-btn"
                        style="
                            padding: 0.4rem 0.75rem;
                            background: var(--bg-primary);
                            color: var(--text-primary);
                            border: 1px solid var(--border-color);
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 0.7rem;
                            font-weight: 600;
                        "
                    >
                        Reset All
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Get current cost summary
 * @returns {Object} Cost summary
 */
export function getCurrentCostSummary() {
    const changes = plannerState.getChanges();
    const initialBank = plannerState.getInitialBank();
    return calculateTransferCosts(changes, initialBank);
}

