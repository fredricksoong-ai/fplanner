/**
 * Data Analysis Module Tests
 * Tests for refactored Data Analysis modules
 */

import { describe, it, expect } from 'vitest';

// Test imports from main file
import {
    renderAnalysisOverview,
    renderDifferentials
} from '../src/renderDataAnalysis.js';

// Test imports from modules
import {
    TABLE_CONFIGS,
    getTableConfig,
    getFixtureHeaders,
    getNextFixtures
} from '../src/dataAnalysis/tableConfigs.js';

import {
    filterByPosition,
    filterByOwnership,
    filterByPriceRange,
    filterByFixtureDifficulty,
    filterByMomentum,
    applyDifferentialFilters
} from '../src/dataAnalysis/filterHelpers.js';

import {
    renderPlayerTableDesktop,
    renderPlayerTableMobile,
    renderPlayerTable
} from '../src/dataAnalysis/playerTableRenderer.js';

import {
    renderDifferentials as renderDifferentialsModule
} from '../src/dataAnalysis/differentials.js';

describe('Data Analysis - Module Imports', () => {
    describe('renderDataAnalysis.js', () => {
        it('should export renderAnalysisOverview', () => {
            expect(renderAnalysisOverview).toBeDefined();
            expect(typeof renderAnalysisOverview).toBe('function');
        });

        it('should export renderDifferentials', () => {
            expect(renderDifferentials).toBeDefined();
            expect(typeof renderDifferentials).toBe('function');
        });
    });

    describe('tableConfigs.js', () => {
        it('should export TABLE_CONFIGS', () => {
            expect(TABLE_CONFIGS).toBeDefined();
            expect(typeof TABLE_CONFIGS).toBe('object');
        });

        it('should export getTableConfig', () => {
            expect(getTableConfig).toBeDefined();
            expect(typeof getTableConfig).toBe('function');
        });

        it('should export getFixtureHeaders', () => {
            expect(getFixtureHeaders).toBeDefined();
            expect(typeof getFixtureHeaders).toBe('function');
        });

        it('should export getNextFixtures', () => {
            expect(getNextFixtures).toBeDefined();
            expect(typeof getNextFixtures).toBe('function');
        });
    });

    describe('filterHelpers.js', () => {
        it('should export filterByPosition', () => {
            expect(filterByPosition).toBeDefined();
            expect(typeof filterByPosition).toBe('function');
        });

        it('should export filterByOwnership', () => {
            expect(filterByOwnership).toBeDefined();
            expect(typeof filterByOwnership).toBe('function');
        });

        it('should export filterByPriceRange', () => {
            expect(filterByPriceRange).toBeDefined();
            expect(typeof filterByPriceRange).toBe('function');
        });

        it('should export filterByFixtureDifficulty', () => {
            expect(filterByFixtureDifficulty).toBeDefined();
            expect(typeof filterByFixtureDifficulty).toBe('function');
        });

        it('should export filterByMomentum', () => {
            expect(filterByMomentum).toBeDefined();
            expect(typeof filterByMomentum).toBe('function');
        });

        it('should export applyDifferentialFilters', () => {
            expect(applyDifferentialFilters).toBeDefined();
            expect(typeof applyDifferentialFilters).toBe('function');
        });
    });

    describe('playerTableRenderer.js', () => {
        it('should export renderPlayerTableDesktop', () => {
            expect(renderPlayerTableDesktop).toBeDefined();
            expect(typeof renderPlayerTableDesktop).toBe('function');
        });

        it('should export renderPlayerTableMobile', () => {
            expect(renderPlayerTableMobile).toBeDefined();
            expect(typeof renderPlayerTableMobile).toBe('function');
        });

        it('should export renderPlayerTable', () => {
            expect(renderPlayerTable).toBeDefined();
            expect(typeof renderPlayerTable).toBe('function');
        });
    });

    describe('differentials.js', () => {
        it('should export renderDifferentials', () => {
            expect(renderDifferentialsModule).toBeDefined();
            expect(typeof renderDifferentialsModule).toBe('function');
        });
    });
});
