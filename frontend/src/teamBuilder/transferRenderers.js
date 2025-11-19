// ============================================================================
// TRANSFER RENDERERS
// Team Builder transfer-related UI components
// ============================================================================

import { getPlayerById } from '../data.js';
import { escapeHtml, formatCurrency, getTeamShortName } from '../utils.js';
import { teamBuilderState } from './state.js';
import { getTeamAvailableChips } from './chipManager.js';
import { generateSuggestions } from './suggestionEngine.js';

/**
 * Render gameweek content (chips + transfers + suggestions)
 */
export function renderGameweekContent(plan, gameweek) {
    const gwPlan = plan.gameweekPlans[gameweek];
    if (!gwPlan) return '';

    const currentTeamData = teamBuilderState.getTeamData();
    const usedChips = currentTeamData.team.chips || [];
    const availableChips = getTeamAvailableChips(currentTeamData);

    return `
        <div style="margin-bottom: 2rem;">
            <!-- Chip Selection -->
            ${renderChipSelector(plan, gameweek, availableChips, usedChips)}

            <!-- Transfer List -->
            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 2px 8px var(--shadow);
                margin-bottom: 1rem;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.125rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                        Transfers for GW${gameweek}
                    </h3>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span style="font-size: 0.875rem; color: var(--text-secondary);">
                            Free Transfers: <strong>${gwPlan.freeTransfers}</strong>
                        </span>
                        ${gwPlan.pointsHit < 0 ? `
                            <span style="font-size: 0.875rem; color: #ef4444; font-weight: 600;">
                                ${gwPlan.pointsHit} pts
                            </span>
                        ` : ''}
                    </div>
                </div>

                ${gwPlan.transfers.length === 0 ? `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-exchange-alt" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p>No transfers planned for this gameweek</p>
                    </div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${gwPlan.transfers.map((transfer, idx) => renderTransferRow(transfer, idx, gameweek)).join('')}
                    </div>
                `}

                <button
                    id="add-transfer-btn"
                    style="
                        width: 100%;
                        padding: 0.75rem;
                        margin-top: 1rem;
                        border: 2px dashed var(--border-color);
                        background: var(--bg-secondary);
                        color: var(--text-primary);
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-plus"></i> Add Transfer
                </button>
            </div>

            <!-- Auto-Suggestions (lazy-loaded) -->
            ${renderAutoSuggestionsPlaceholder(gameweek)}
        </div>
    `;
}

/**
 * Render chip selector dropdown
 */
export function renderChipSelector(plan, gameweek, availableChips, usedChips) {
    const gwPlan = plan.gameweekPlans[gameweek];
    const currentChip = gwPlan.chipUsed;

    return `
        <div style="margin-bottom: 1rem;">
            <label style="font-weight: 600; color: var(--text-primary); margin-right: 0.5rem;">
                Chip:
            </label>
            <select
                id="chip-select-${gameweek}"
                class="chip-select"
                data-gw="${gameweek}"
                style="
                    padding: 0.5rem 1rem;
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    cursor: pointer;
                "
            >
                <option value="">None</option>
                ${availableChips.map(chip => `
                    <option value="${chip}" ${currentChip === chip ? 'selected' : ''}>
                        ${chip.charAt(0).toUpperCase() + chip.slice(1)}
                    </option>
                `).join('')}
            </select>
            ${currentChip ? `
                <span style="margin-left: 0.5rem; font-size: 0.875rem; color: var(--text-secondary);">
                    ${currentChip === 'wildcard' || currentChip === 'freehit' ? '✓ Unlimited transfers' : ''}
                </span>
            ` : ''}
        </div>
    `;
}

/**
 * Render a single transfer row
 */
export function renderTransferRow(transfer, index, gameweek) {
    const playerOut = getPlayerById(transfer.out);
    const playerIn = getPlayerById(transfer.in);

    if (!playerOut || !playerIn) return '';

    const priceDiff = playerIn.now_cost - playerOut.now_cost;
    const diffSign = priceDiff >= 0 ? '+' : '';
    const diffColor = priceDiff < 0 ? '#22c55e' : '#ef4444';

    return `
        <div style="
            display: grid;
            grid-template-columns: 1fr auto 1fr auto;
            gap: 1rem;
            align-items: center;
            padding: 1rem;
            background: var(--bg-secondary);
            border-radius: 8px;
        ">
            <!-- Player Out -->
            <div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">OUT</div>
                <div style="font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(playerOut.web_name)}
                </div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                    ${getTeamShortName(playerOut.team)} • ${formatCurrency(playerOut.now_cost)}
                </div>
            </div>

            <!-- Arrow -->
            <div>
                <i class="fas fa-arrow-right" style="color: var(--primary-color); font-size: 1.25rem;"></i>
            </div>

            <!-- Player In -->
            <div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">IN</div>
                <div style="font-weight: 600; color: var(--text-primary);">
                    ${escapeHtml(playerIn.web_name)}
                </div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                    ${getTeamShortName(playerIn.team)} • ${formatCurrency(playerIn.now_cost)}
                </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                <div style="font-size: 0.875rem; font-weight: 600; color: ${diffColor};">
                    ${diffSign}£${Math.abs(priceDiff / 10).toFixed(1)}m
                </div>
                <button
                    class="remove-transfer-btn"
                    data-gw="${gameweek}"
                    data-index="${index}"
                    style="
                        padding: 0.25rem 0.75rem;
                        background: #ef4444;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 0.75rem;
                        cursor: pointer;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-times"></i> Remove
                </button>
            </div>
        </div>
    `;
}

/**
 * Render auto-suggestions placeholder (lazy-loaded)
 */
export function renderAutoSuggestionsPlaceholder(gameweek) {
    return `
        <div id="suggestions-container-${gameweek}" style="
            background: var(--bg-primary);
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px var(--shadow);
            border-left: 4px solid #3b82f6;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                    <i class="fas fa-lightbulb"></i> Transfer Suggestions
                </h3>
                <button
                    id="load-suggestions-btn-${gameweek}"
                    class="load-suggestions-btn"
                    data-gw="${gameweek}"
                    style="
                        padding: 0.5rem 1rem;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 0.875rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    "
                >
                    <i class="fas fa-magic"></i> Get Suggestions
                </button>
            </div>
            <div id="suggestions-content-${gameweek}" style="margin-top: 1rem; display: none;">
                <!-- Suggestions will be loaded here -->
            </div>
        </div>
    `;
}

/**
 * Render auto-suggestions panel (called on demand)
 */
export function renderAutoSuggestions(plan, gameweek) {
    const suggestions = generateSuggestions(plan, gameweek, 5);

    if (suggestions.length === 0) {
        return `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 0.5rem; color: #22c55e;"></i>
                <p>No suggestions - your squad looks good for this gameweek!</p>
            </div>
        `;
    }

    const priorityColor = {
        high: '#ef4444',
        medium: '#fb923c',
        low: '#3b82f6'
    };

    return `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${suggestions.map((sug, idx) => `
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border-radius: 8px;
                    border-left: 3px solid ${priorityColor[sug.priority]};
                ">
                    <div style="flex: 1;">
                        <div style="font-size: 0.75rem; color: ${priorityColor[sug.priority]}; font-weight: 600; text-transform: uppercase; margin-bottom: 0.25rem;">
                            ${sug.type} • ${sug.priority} priority
                        </div>
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">
                            ${escapeHtml(sug.playerOut.web_name)} → ${escapeHtml(sug.playerIn.web_name)}
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary);">
                            ${sug.reason}
                        </div>
                    </div>
                    <button
                        class="apply-suggestion-btn"
                        data-out="${sug.playerOut.id}"
                        data-in="${sug.playerIn.id}"
                        data-gw="${gameweek}"
                        style="
                            padding: 0.5rem 1rem;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 0.875rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.2s;
                            white-space: nowrap;
                        "
                    >
                        <i class="fas fa-check"></i> Apply
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}
