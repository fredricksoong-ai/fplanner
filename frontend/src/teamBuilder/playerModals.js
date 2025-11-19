// ============================================================================
// PLAYER MODALS
// Team Builder player selection modal dialogs
// ============================================================================

import { getPlayerById, getAllPlayers } from '../data.js';
import {
    getPositionShort,
    escapeHtml,
    formatCurrency,
    formatDecimal,
    calculatePPM,
    getTeamShortName
} from '../utils.js';
import { handleConfirmTransfer, closePlayerModal, getTransferOutPlayerId } from './transferManager.js';

/**
 * Show squad selection modal (pick player to transfer out)
 * @param {Array} squad - Current squad picks
 */
export function showSquadSelectionModal(squad) {
    const modalHtml = `
        <div id="player-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        ">
            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 2rem;
                max-width: 800px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                        Select Player to Transfer Out
                    </h3>
                    <button
                        id="close-modal-btn"
                        style="
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            color: var(--text-secondary);
                            cursor: pointer;
                        "
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div style="display: grid; gap: 0.5rem;">
                    ${squad.map(pick => {
                        const player = getPlayerById(pick.element);
                        if (!player) return '';

                        return `
                            <button
                                class="select-player-out-btn"
                                data-player-id="${player.id}"
                                style="
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    padding: 1rem;
                                    background: var(--bg-secondary);
                                    border: 2px solid var(--border-color);
                                    border-radius: 8px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    text-align: left;
                                "
                            >
                                <div>
                                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">
                                        ${escapeHtml(player.web_name)}
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                        ${getPositionShort(player)} • ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">Form: ${formatDecimal(player.form)}</div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">PPM: ${formatDecimal(calculatePPM(player))}</div>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Attach event listeners
    document.getElementById('close-modal-btn').addEventListener('click', closePlayerModal);
    document.querySelectorAll('.select-player-out-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerId = parseInt(btn.dataset.playerId);
            closePlayerModal();
            // Import at runtime to avoid circular dependency
            import('./transferManager.js').then(({ openPlayerSelectModal }) => {
                openPlayerSelectModal(playerId, showSquadSelectionModal, showReplacementSelectionModal);
            });
        });

        btn.addEventListener('mouseenter', e => {
            e.currentTarget.style.borderColor = 'var(--primary-color)';
        });
        btn.addEventListener('mouseleave', e => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
        });
    });
}

/**
 * Show replacement selection modal (pick player to transfer in)
 * @param {Object} playerOut - Player being transferred out
 * @param {Array} squad - Current squad picks
 * @param {number} bank - Available budget
 */
export function showReplacementSelectionModal(playerOut, squad, bank) {
    const allPlayers = getAllPlayers();
    const maxBudget = playerOut.now_cost + bank;
    const squadPlayerIds = new Set(squad.map(p => p.element));

    // Filter candidates
    const candidates = allPlayers.filter(p => {
        return p.element_type === playerOut.element_type &&
               p.id !== playerOut.id &&
               p.now_cost <= maxBudget &&
               !squadPlayerIds.has(p.id);
    });

    // Sort by PPM
    candidates.sort((a, b) => calculatePPM(b) - calculatePPM(a));

    const modalHtml = `
        <div id="player-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        ">
            <div style="
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 2rem;
                max-width: 900px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div>
                        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0;">
                            Select Replacement for ${escapeHtml(playerOut.web_name)}
                        </h3>
                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">
                            Budget: £${(maxBudget / 10).toFixed(1)}m • ${candidates.length} options
                        </p>
                    </div>
                    <button
                        id="close-modal-btn"
                        style="
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            color: var(--text-secondary);
                            cursor: pointer;
                        "
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div style="margin-bottom: 1rem;">
                    <input
                        type="text"
                        id="player-search-input"
                        placeholder="Search players..."
                        style="
                            width: 100%;
                            padding: 0.75rem;
                            border: 2px solid var(--border-color);
                            border-radius: 8px;
                            background: var(--bg-secondary);
                            color: var(--text-primary);
                            font-size: 1rem;
                        "
                    >
                </div>

                <div id="player-list" style="display: grid; gap: 0.5rem; max-height: 400px; overflow-y: auto;">
                    ${candidates.slice(0, 50).map(player => {
                        const priceDiff = player.now_cost - playerOut.now_cost;
                        const diffSign = priceDiff >= 0 ? '+' : '';
                        const diffColor = priceDiff < 0 ? '#22c55e' : '#ef4444';

                        return `
                            <button
                                class="select-player-in-btn"
                                data-player-id="${player.id}"
                                data-search="${escapeHtml(player.web_name).toLowerCase()}"
                                style="
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    padding: 1rem;
                                    background: var(--bg-secondary);
                                    border: 2px solid var(--border-color);
                                    border-radius: 8px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    text-align: left;
                                "
                            >
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">
                                        ${escapeHtml(player.web_name)}
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                        ${getTeamShortName(player.team)} • ${formatCurrency(player.now_cost)} • Form: ${formatDecimal(player.form)}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.875rem; font-weight: 600; color: ${diffColor}; margin-bottom: 0.25rem;">
                                        ${diffSign}£${Math.abs(priceDiff / 10).toFixed(1)}m
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                        PPM: ${formatDecimal(calculatePPM(player))}
                                    </div>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Attach event listeners
    document.getElementById('close-modal-btn').addEventListener('click', closePlayerModal);

    // Search functionality
    const searchInput = document.getElementById('player-search-input');
    searchInput.addEventListener('input', e => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.select-player-in-btn').forEach(btn => {
            const searchText = btn.dataset.search;
            btn.style.display = searchText.includes(query) ? 'flex' : 'none';
        });
    });

    // Select player in
    document.querySelectorAll('.select-player-in-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const playerInId = parseInt(btn.dataset.playerId);
            const playerOutId = getTransferOutPlayerId();
            // Import at runtime to get the render callback
            import('../renderTeamBuilder.js').then(({ renderTeamBuilderContent }) => {
                handleConfirmTransfer(playerOutId, playerInId, renderTeamBuilderContent);
            });
        });

        btn.addEventListener('mouseenter', e => {
            e.currentTarget.style.borderColor = 'var(--primary-color)';
        });
        btn.addEventListener('mouseleave', e => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
        });
    });
}
