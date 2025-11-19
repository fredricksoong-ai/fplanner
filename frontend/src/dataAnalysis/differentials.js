// ============================================================================
// DIFFERENTIALS TAB
// Low-owned players with quality metrics and customizable filters
// ============================================================================

import { applyDifferentialFilters } from './filterHelpers.js';
import { renderPlayerTable } from './playerTableRenderer.js';
import { sortPlayers } from '../utils.js';

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

/**
 * Render differentials tab with filters and results
 * @param {string} position - Position filter ('all', 'GKP', 'DEF', 'MID', 'FWD')
 * @param {Object} filterState - Current filter state
 * @param {Function} renderSectionHeader - Section header renderer
 * @param {Set} myPlayerIds - Set of player IDs in user's team
 * @returns {string} HTML for differentials tab
 */
export function renderDifferentials(position, filterState, renderSectionHeader, myPlayerIds) {
    // Apply filters
    const filtered = applyDifferentialFilters(filterState, position);

    // Sort by total points and limit to top 20
    const sortedDiffs = sortPlayers(filtered, 'total_points', false).slice(0, 20);

    return `
        <div>
            <!-- Filters -->
            ${renderFilterPanel(filterState)}

            <!-- Results -->
            ${renderSectionHeader('🎯', 'Differential Picks', `Found ${sortedDiffs.length} ${position === 'all' ? 'players' : position} matching criteria`)}
            ${sortedDiffs.length > 0
                ? renderPlayerTable(sortedDiffs, position, { contextType: 'ownership', myPlayerIds })
                : renderNoResults()
            }
        </div>
    `;
}

/**
 * Render filter panel
 * @param {Object} state - Current filter state
 * @returns {string} HTML for filter panel
 */
function renderFilterPanel(state) {
    return `
        <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">Filters</h3>

            <!-- Ownership Slider -->
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">
                    Ownership Threshold: <span id="ownership-value">${state.ownershipThreshold}%</span>
                </label>
                <input
                    type="range"
                    id="ownership-threshold-slider"
                    min="1"
                    max="10"
                    value="${state.ownershipThreshold}"
                    style="width: 100%; max-width: 300px;"
                />
            </div>

            <!-- Price Range Filter -->
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">Price Range</label>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${renderPriceRangeButton('all', 'All Prices', state)}
                    ${renderPriceRangeButton('budget', 'Budget (<£6.0m)', state)}
                    ${renderPriceRangeButton('mid', 'Mid-range (£6-9m)', state)}
                    ${renderPriceRangeButton('premium', 'Premium (>£9.0m)', state)}
                </div>
            </div>

            <!-- Checkboxes -->
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input
                        type="checkbox"
                        id="fixture-filter-checkbox"
                        ${state.fixtureFilter ? 'checked' : ''}
                    />
                    <span>Only good fixtures (FDR ≤ 3.0)</span>
                </label>

                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input
                        type="checkbox"
                        id="momentum-filter-checkbox"
                        ${state.momentumFilter ? 'checked' : ''}
                    />
                    <span>Only positive momentum (ΔT > 0)</span>
                </label>
            </div>
        </div>
    `;
}

/**
 * Render price range filter button
 * @param {string} range - Range identifier
 * @param {string} label - Button label
 * @param {Object} state - Current filter state
 * @returns {string} HTML for button
 */
function renderPriceRangeButton(range, label, state) {
    const isActive = state.priceRange === range;

    return `
        <button
            class="price-range-btn"
            data-range="${range}"
            style="
                padding: 0.5rem 1rem;
                background: ${isActive ? 'var(--accent-color)' : 'var(--bg-primary)'};
                color: ${isActive ? 'white' : 'var(--text-primary)'};
                border: 1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-color)'};
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                font-size: 0.875rem;
            "
        >${label}</button>
    `;
}

/**
 * Render no results message
 * @returns {string} HTML for no results
 */
function renderNoResults() {
    return `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            No differentials found matching criteria. Try adjusting filters.
        </div>
    `;
}
