/**
 * Team Builder Helpers Tests
 * Tests transfer planning logic, squad validation, and storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    createNewPlan,
    calculateProjectedSquad,
    addTransfer,
    removeTransfer,
    setChip,
    validateSquad,
    findSuggestedTransfers,
    savePlansToStorage,
    loadPlansFromStorage,
    deletePlanFromStorage,
    getAvailableChips
} from '../src/teamBuilderHelpers.js';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
global.localStorage = localStorageMock;

describe('Team Builder Helpers - Plan Management', () => {
    // ========================================================================
    // createNewPlan()
    // ========================================================================

    describe('createNewPlan()', () => {
        const mockTeam = {
            picks: [
                { element: 1, position: 1, selling_price: 100 },
                { element: 2, position: 2, selling_price: 100 },
                { element: 3, position: 3, selling_price: 100 },
                { element: 4, position: 4, selling_price: 100 },
                { element: 5, position: 5, selling_price: 100 },
                { element: 6, position: 6, selling_price: 100 },
                { element: 7, position: 7, selling_price: 100 },
                { element: 8, position: 8, selling_price: 100 },
                { element: 9, position: 9, selling_price: 100 },
                { element: 10, position: 10, selling_price: 100 },
                { element: 11, position: 11, selling_price: 100 },
                { element: 12, position: 12, selling_price: 100 },
                { element: 13, position: 13, selling_price: 100 },
                { element: 14, position: 14, selling_price: 100 },
                { element: 15, position: 15, selling_price: 100 }
            ],
            entry_history: { bank: 0, value: 1000 }
        };

        it('should create a new plan with correct structure', () => {
            const plan = createNewPlan('Test Plan', mockTeam);

            expect(plan).toHaveProperty('id');
            expect(plan).toHaveProperty('name', 'Test Plan');
            expect(plan).toHaveProperty('created');
            expect(plan).toHaveProperty('modified');
            expect(plan).toHaveProperty('currentGW');
            expect(plan).toHaveProperty('planningHorizon', 3);
            expect(plan).toHaveProperty('gameweeks');
            expect(plan).toHaveProperty('initialSquad');
            expect(plan).toHaveProperty('initialBank');
        });

        it('should generate unique ID for each plan', () => {
            const plan1 = createNewPlan('Plan 1', mockTeam);
            const plan2 = createNewPlan('Plan 2', mockTeam);

            expect(plan1.id).not.toBe(plan2.id);
        });

        it('should accept custom planning horizon', () => {
            const plan = createNewPlan('Test Plan', mockTeam, 5);

            expect(plan.planningHorizon).toBe(5);
            expect(plan.gameweeks).toHaveLength(5);
        });

        it('should copy initial squad from current team', () => {
            const plan = createNewPlan('Test Plan', mockTeam);

            expect(plan.initialSquad).toHaveLength(15);
            expect(plan.initialSquad[0].element).toBe(1);
        });

        it('should initialize bank from team value', () => {
            const plan = createNewPlan('Test Plan', mockTeam);

            expect(plan.initialBank).toBe(0); // From entry_history.bank
        });

        it('should initialize empty gameweeks array', () => {
            const plan = createNewPlan('Test Plan', mockTeam, 3);

            expect(plan.gameweeks).toHaveLength(3);
            plan.gameweeks.forEach(gw => {
                expect(gw).toHaveProperty('gw');
                expect(gw).toHaveProperty('transfers');
                expect(gw.transfers).toEqual([]);
                expect(gw).toHaveProperty('chip', null);
            });
        });
    });

    // ========================================================================
    // addTransfer()
    // ========================================================================

    describe('addTransfer()', () => {
        let plan;
        const mockTeam = {
            picks: Array.from({ length: 15 }, (_, i) => ({
                element: i + 1,
                position: i + 1,
                selling_price: 100
            })),
            entry_history: { bank: 0, value: 1000 }
        };

        beforeEach(() => {
            plan = createNewPlan('Test Plan', mockTeam, 3);
        });

        it('should add transfer to specified gameweek', () => {
            const result = addTransfer(plan, 1, 1, 16); // Remove player 1, add player 16

            expect(result.success).toBe(true);
            expect(plan.gameweeks[0].transfers).toHaveLength(1);
            expect(plan.gameweeks[0].transfers[0].out).toBe(1);
            expect(plan.gameweeks[0].transfers[0].in).toBe(16);
        });

        it('should prevent transfer if player not in squad', () => {
            const result = addTransfer(plan, 1, 999, 16); // Player 999 not in squad

            expect(result.success).toBe(false);
            expect(result.error).toContain('not in projected squad');
        });

        it('should prevent duplicate player in squad', () => {
            addTransfer(plan, 1, 1, 16); // Add player 16
            const result = addTransfer(plan, 1, 2, 16); // Try to add player 16 again

            expect(result.success).toBe(false);
            expect(result.error).toContain('already in projected squad');
        });

        it('should update modified timestamp', () => {
            const beforeModified = plan.modified;

            // Wait 1ms to ensure timestamp changes
            setTimeout(() => {
                addTransfer(plan, 1, 1, 16);
                expect(plan.modified).toBeGreaterThan(beforeModified);
            }, 10);
        });
    });

    // ========================================================================
    // removeTransfer()
    // ========================================================================

    describe('removeTransfer()', () => {
        let plan;
        const mockTeam = {
            picks: Array.from({ length: 15 }, (_, i) => ({
                element: i + 1,
                position: i + 1,
                selling_price: 100
            })),
            entry_history: { bank: 0, value: 1000 }
        };

        beforeEach(() => {
            plan = createNewPlan('Test Plan', mockTeam, 3);
            addTransfer(plan, 1, 1, 16);
            addTransfer(plan, 1, 2, 17);
        });

        it('should remove transfer at specified index', () => {
            const result = removeTransfer(plan, 1, 0);

            expect(result.success).toBe(true);
            expect(plan.gameweeks[0].transfers).toHaveLength(1);
            expect(plan.gameweeks[0].transfers[0].out).toBe(2);
        });

        it('should return error if index out of bounds', () => {
            const result = removeTransfer(plan, 1, 999);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid transfer index');
        });

        it('should update modified timestamp', () => {
            const beforeModified = plan.modified;

            setTimeout(() => {
                removeTransfer(plan, 1, 0);
                expect(plan.modified).toBeGreaterThan(beforeModified);
            }, 10);
        });
    });

    // ========================================================================
    // setChip()
    // ========================================================================

    describe('setChip()', () => {
        let plan;
        const mockTeam = {
            picks: Array.from({ length: 15 }, (_, i) => ({
                element: i + 1,
                position: i + 1,
                selling_price: 100
            })),
            entry_history: { bank: 0, value: 1000 }
        };

        beforeEach(() => {
            plan = createNewPlan('Test Plan', mockTeam, 3);
        });

        it('should set chip for specified gameweek', () => {
            const result = setChip(plan, 1, 'wildcard');

            expect(result.success).toBe(true);
            expect(plan.gameweeks[0].chip).toBe('wildcard');
        });

        it('should prevent setting already used chip', () => {
            const usedChips = ['wildcard'];
            const result = setChip(plan, 1, 'wildcard', usedChips);

            expect(result.success).toBe(false);
            expect(result.error).toContain('already been used');
        });

        it('should remove chip when null is passed', () => {
            setChip(plan, 1, 'wildcard');
            const result = setChip(plan, 1, null);

            expect(result.success).toBe(true);
            expect(plan.gameweeks[0].chip).toBe(null);
        });

        it('should prevent duplicate chip usage across gameweeks', () => {
            setChip(plan, 1, 'wildcard');
            const result = setChip(plan, 2, 'wildcard');

            expect(result.success).toBe(false);
            expect(result.error).toContain('already used in GW');
        });
    });

    // ========================================================================
    // validateSquad()
    // ========================================================================

    describe('validateSquad()', () => {
        it('should be a function', () => {
            expect(typeof validateSquad).toBe('function');
        });

        // Note: Full validation tests would require mocked player data
        // This is a placeholder for basic structure test
        it('should accept plan and gameweek parameters', () => {
            const mockTeam = {
                picks: Array.from({ length: 15 }, (_, i) => ({
                    element: i + 1,
                    position: i + 1,
                    selling_price: 100
                })),
                entry_history: { bank: 0, value: 1000 }
            };
            const plan = createNewPlan('Test', mockTeam);

            // This will likely return errors without full data, but shouldn't crash
            const result = validateSquad(plan, 1);
            expect(result).toHaveProperty('valid');
            expect(result).toHaveProperty('errors');
            expect(Array.isArray(result.errors)).toBe(true);
        });
    });
});

describe('Team Builder Helpers - Storage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    // ========================================================================
    // savePlansToStorage()
    // ========================================================================

    describe('savePlansToStorage()', () => {
        it('should save plans array to localStorage', () => {
            const mockTeam = {
                picks: Array.from({ length: 15 }, (_, i) => ({
                    element: i + 1,
                    position: i + 1,
                    selling_price: 100
                })),
                entry_history: { bank: 0, value: 1000 }
            };
            const plans = [
                createNewPlan('Plan 1', mockTeam),
                createNewPlan('Plan 2', mockTeam)
            ];

            savePlansToStorage(plans);

            const saved = localStorage.getItem('fplanner_transfer_plans');
            expect(saved).toBeTruthy();

            const parsed = JSON.parse(saved);
            expect(parsed).toHaveLength(2);
        });

        it('should handle empty plans array', () => {
            savePlansToStorage([]);

            const saved = localStorage.getItem('fplanner_transfer_plans');
            const parsed = JSON.parse(saved);
            expect(parsed).toEqual([]);
        });

        it('should wrap storage errors in try-catch', () => {
            // Mock localStorage to throw error
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn(() => {
                throw new Error('Storage full');
            });

            // Should not throw error
            expect(() => savePlansToStorage([{}])).not.toThrow();

            // Restore original
            localStorage.setItem = originalSetItem;
        });
    });

    // ========================================================================
    // loadPlansFromStorage()
    // ========================================================================

    describe('loadPlansFromStorage()', () => {
        it('should load plans from localStorage', () => {
            const mockTeam = {
                picks: Array.from({ length: 15 }, (_, i) => ({
                    element: i + 1,
                    position: i + 1,
                    selling_price: 100
                })),
                entry_history: { bank: 0, value: 1000 }
            };
            const plans = [
                createNewPlan('Plan 1', mockTeam),
                createNewPlan('Plan 2', mockTeam)
            ];
            savePlansToStorage(plans);

            const loaded = loadPlansFromStorage();

            expect(loaded).toHaveLength(2);
            expect(loaded[0].name).toBe('Plan 1');
            expect(loaded[1].name).toBe('Plan 2');
        });

        it('should return empty array if no plans stored', () => {
            const loaded = loadPlansFromStorage();

            expect(loaded).toEqual([]);
        });

        it('should handle corrupted data gracefully', () => {
            localStorage.setItem('fplanner_transfer_plans', 'invalid json');

            const loaded = loadPlansFromStorage();

            expect(loaded).toEqual([]);
        });
    });

    // ========================================================================
    // deletePlanFromStorage()
    // ========================================================================

    describe('deletePlanFromStorage()', () => {
        it('should delete plan with matching ID', () => {
            const mockTeam = {
                picks: Array.from({ length: 15 }, (_, i) => ({
                    element: i + 1,
                    position: i + 1,
                    selling_price: 100
                })),
                entry_history: { bank: 0, value: 1000 }
            };
            const plan1 = createNewPlan('Plan 1', mockTeam);
            const plan2 = createNewPlan('Plan 2', mockTeam);
            savePlansToStorage([plan1, plan2]);

            deletePlanFromStorage(plan1.id);

            const remaining = loadPlansFromStorage();
            expect(remaining).toHaveLength(1);
            expect(remaining[0].id).toBe(plan2.id);
        });

        it('should handle deleting non-existent plan', () => {
            const mockTeam = {
                picks: Array.from({ length: 15 }, (_, i) => ({
                    element: i + 1,
                    position: i + 1,
                    selling_price: 100
                })),
                entry_history: { bank: 0, value: 1000 }
            };
            const plan = createNewPlan('Plan', mockTeam);
            savePlansToStorage([plan]);

            deletePlanFromStorage('non-existent-id');

            const remaining = loadPlansFromStorage();
            expect(remaining).toHaveLength(1);
        });
    });
});

describe('Team Builder Helpers - Chip Management', () => {
    // ========================================================================
    // getAvailableChips()
    // ========================================================================

    describe('getAvailableChips()', () => {
        it('should be a function', () => {
            expect(typeof getAvailableChips).toBe('function');
        });

        it('should accept teamData parameter', () => {
            const mockTeamData = {
                chips: [
                    { name: 'wildcard', status_for_entry: 'available' },
                    { name: 'freehit', status_for_entry: 'available' }
                ]
            };

            // Function should not throw
            expect(() => getAvailableChips(mockTeamData)).not.toThrow();
        });
    });
});
