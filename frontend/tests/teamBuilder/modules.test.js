/**
 * Team Builder Module Tests
 * Tests for refactored Team Builder modules
 */

import { describe, it, expect } from 'vitest';

// Test imports from modules
import {
    renderTeamInfoCard,
    renderPlanTabs,
    renderTransferSummary,
    renderPlanningHorizonControl,
    renderGameweekTabs,
    renderActionButtons
} from '../../src/teamBuilder/displayRenderers.js';

import {
    renderGameweekContent,
    renderChipSelector,
    renderTransferRow,
    renderAutoSuggestionsPlaceholder,
    renderAutoSuggestions
} from '../../src/teamBuilder/transferRenderers.js';

import {
    renderProjectedSquad
} from '../../src/teamBuilder/squadRenderers.js';

import {
    showSquadSelectionModal,
    showReplacementSelectionModal
} from '../../src/teamBuilder/playerModals.js';

import {
    handlePlanningHorizonChange
} from '../../src/teamBuilder/horizonManager.js';

describe('Team Builder - Module Imports', () => {
    describe('displayRenderers.js', () => {
        it('should export renderTeamInfoCard', () => {
            expect(renderTeamInfoCard).toBeDefined();
            expect(typeof renderTeamInfoCard).toBe('function');
        });

        it('should export renderPlanTabs', () => {
            expect(renderPlanTabs).toBeDefined();
            expect(typeof renderPlanTabs).toBe('function');
        });

        it('should export renderTransferSummary', () => {
            expect(renderTransferSummary).toBeDefined();
            expect(typeof renderTransferSummary).toBe('function');
        });

        it('should export renderPlanningHorizonControl', () => {
            expect(renderPlanningHorizonControl).toBeDefined();
            expect(typeof renderPlanningHorizonControl).toBe('function');
        });

        it('should export renderGameweekTabs', () => {
            expect(renderGameweekTabs).toBeDefined();
            expect(typeof renderGameweekTabs).toBe('function');
        });

        it('should export renderActionButtons', () => {
            expect(renderActionButtons).toBeDefined();
            expect(typeof renderActionButtons).toBe('function');
        });
    });

    describe('transferRenderers.js', () => {
        it('should export renderGameweekContent', () => {
            expect(renderGameweekContent).toBeDefined();
            expect(typeof renderGameweekContent).toBe('function');
        });

        it('should export renderChipSelector', () => {
            expect(renderChipSelector).toBeDefined();
            expect(typeof renderChipSelector).toBe('function');
        });

        it('should export renderTransferRow', () => {
            expect(renderTransferRow).toBeDefined();
            expect(typeof renderTransferRow).toBe('function');
        });

        it('should export renderAutoSuggestionsPlaceholder', () => {
            expect(renderAutoSuggestionsPlaceholder).toBeDefined();
            expect(typeof renderAutoSuggestionsPlaceholder).toBe('function');
        });

        it('should export renderAutoSuggestions', () => {
            expect(renderAutoSuggestions).toBeDefined();
            expect(typeof renderAutoSuggestions).toBe('function');
        });
    });

    describe('squadRenderers.js', () => {
        it('should export renderProjectedSquad', () => {
            expect(renderProjectedSquad).toBeDefined();
            expect(typeof renderProjectedSquad).toBe('function');
        });
    });

    describe('playerModals.js', () => {
        it('should export showSquadSelectionModal', () => {
            expect(showSquadSelectionModal).toBeDefined();
            expect(typeof showSquadSelectionModal).toBe('function');
        });

        it('should export showReplacementSelectionModal', () => {
            expect(showReplacementSelectionModal).toBeDefined();
            expect(typeof showReplacementSelectionModal).toBe('function');
        });
    });

    describe('horizonManager.js', () => {
        it('should export handlePlanningHorizonChange', () => {
            expect(handlePlanningHorizonChange).toBeDefined();
            expect(typeof handlePlanningHorizonChange).toBe('function');
        });
    });
});
