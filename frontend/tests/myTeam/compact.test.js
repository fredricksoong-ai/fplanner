/**
 * My Team Compact Module Tests
 * Tests for refactored My Team Compact modules
 */

import { describe, it, expect } from 'vitest';

// Test imports from main file
import {
    renderCompactHeader,
    renderCompactPlayerRow,
    renderCompactTeamList,
    renderMatchSchedule,
    showPlayerModal,
    closePlayerModal,
    attachPlayerRowListeners
} from '../../src/renderMyTeamCompact.js';

// Test imports from modules
import {
    renderOpponentBadge,
    renderStatCard,
    calculateRankColor,
    calculateGWTextColor,
    calculateStatusColor,
    calculatePlayerBgColor
} from '../../src/myTeam/compact/compactStyleHelpers.js';

import {
    renderCompactHeader as renderCompactHeaderModule
} from '../../src/myTeam/compact/compactHeader.js';

import {
    renderCompactPlayerRow as renderCompactPlayerRowModule
} from '../../src/myTeam/compact/compactPlayerRow.js';

import {
    renderCompactTeamList as renderCompactTeamListModule
} from '../../src/myTeam/compact/compactTeamList.js';

import {
    renderMatchSchedule as renderMatchScheduleModule
} from '../../src/myTeam/compact/compactSchedule.js';

import {
    showPlayerModal as showPlayerModalModule,
    closePlayerModal as closePlayerModalModule
} from '../../src/myTeam/compact/playerModal.js';

import {
    attachPlayerRowListeners as attachPlayerRowListenersModule
} from '../../src/myTeam/compact/compactEventHandlers.js';

describe('My Team Compact - Module Imports', () => {
    describe('renderMyTeamCompact.js (re-exports)', () => {
        it('should export renderCompactHeader', () => {
            expect(renderCompactHeader).toBeDefined();
            expect(typeof renderCompactHeader).toBe('function');
        });

        it('should export renderCompactPlayerRow', () => {
            expect(renderCompactPlayerRow).toBeDefined();
            expect(typeof renderCompactPlayerRow).toBe('function');
        });

        it('should export renderCompactTeamList', () => {
            expect(renderCompactTeamList).toBeDefined();
            expect(typeof renderCompactTeamList).toBe('function');
        });

        it('should export renderMatchSchedule', () => {
            expect(renderMatchSchedule).toBeDefined();
            expect(typeof renderMatchSchedule).toBe('function');
        });

        it('should export showPlayerModal', () => {
            expect(showPlayerModal).toBeDefined();
            expect(typeof showPlayerModal).toBe('function');
        });

        it('should export closePlayerModal', () => {
            expect(closePlayerModal).toBeDefined();
            expect(typeof closePlayerModal).toBe('function');
        });

        it('should export attachPlayerRowListeners', () => {
            expect(attachPlayerRowListeners).toBeDefined();
            expect(typeof attachPlayerRowListeners).toBe('function');
        });
    });

    describe('compactStyleHelpers.js', () => {
        it('should export renderOpponentBadge', () => {
            expect(renderOpponentBadge).toBeDefined();
            expect(typeof renderOpponentBadge).toBe('function');
        });

        it('should export renderStatCard', () => {
            expect(renderStatCard).toBeDefined();
            expect(typeof renderStatCard).toBe('function');
        });

        it('should export calculateRankColor', () => {
            expect(calculateRankColor).toBeDefined();
            expect(typeof calculateRankColor).toBe('function');
        });

        it('should export calculateGWTextColor', () => {
            expect(calculateGWTextColor).toBeDefined();
            expect(typeof calculateGWTextColor).toBe('function');
        });

        it('should export calculateStatusColor', () => {
            expect(calculateStatusColor).toBeDefined();
            expect(typeof calculateStatusColor).toBe('function');
        });

        it('should export calculatePlayerBgColor', () => {
            expect(calculatePlayerBgColor).toBeDefined();
            expect(typeof calculatePlayerBgColor).toBe('function');
        });
    });

    describe('Individual module files', () => {
        it('should import compactHeader module', () => {
            expect(renderCompactHeaderModule).toBeDefined();
            expect(typeof renderCompactHeaderModule).toBe('function');
        });

        it('should import compactPlayerRow module', () => {
            expect(renderCompactPlayerRowModule).toBeDefined();
            expect(typeof renderCompactPlayerRowModule).toBe('function');
        });

        it('should import compactTeamList module', () => {
            expect(renderCompactTeamListModule).toBeDefined();
            expect(typeof renderCompactTeamListModule).toBe('function');
        });

        it('should import compactSchedule module', () => {
            expect(renderMatchScheduleModule).toBeDefined();
            expect(typeof renderMatchScheduleModule).toBe('function');
        });

        it('should import playerModal module', () => {
            expect(showPlayerModalModule).toBeDefined();
            expect(typeof showPlayerModalModule).toBe('function');
            expect(closePlayerModalModule).toBeDefined();
            expect(typeof closePlayerModalModule).toBe('function');
        });

        it('should import compactEventHandlers module', () => {
            expect(attachPlayerRowListenersModule).toBeDefined();
            expect(typeof attachPlayerRowListenersModule).toBe('function');
        });
    });
});
