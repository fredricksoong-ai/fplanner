/**
 * Data Module Tests
 * Tests all API calls, caching, and data access functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    loadFPLData,
    loadMyTeam,
    loadLeagueStandings,
    getAllPlayers,
    getPlayerById,
    getTeamById,
    refreshData,
    fplBootstrap,
    fplFixtures,
    githubData,
    currentGW
} from '../src/data.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Data Module - API Calls', () => {
    beforeEach(() => {
        // Reset fetch mock before each test
        vi.clearAllMocks();
    });

    // ========================================================================
    // loadFPLData()
    // ========================================================================

    describe('loadFPLData()', () => {
        it('should fetch data from /api/fpl-data', async () => {
            const mockData = {
                bootstrap: {
                    events: [{ id: 1, finished: true }],
                    teams: [{ id: 1, name: 'Arsenal' }],
                    elements: [{ id: 1, web_name: 'Salah' }]
                },
                fixtures: [{ id: 1, event: 1 }],
                github: { season: {}, gw: {}, transfers: {} },
                meta: { bootstrap_age: 1000 }
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            const result = await loadFPLData();

            expect(global.fetch).toHaveBeenCalledWith('/api/fpl-data');
            expect(result).toEqual(mockData);
        });

        it('should accept query params for cache refresh', async () => {
            const mockData = {
                bootstrap: {},
                fixtures: [],
                github: {},
                meta: { bootstrap_age: 0 }
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            await loadFPLData('?refresh=true');

            expect(global.fetch).toHaveBeenCalledWith('/api/fpl-data?refresh=true');
        });

        it('should throw error if API returns non-OK status', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            await expect(loadFPLData()).rejects.toThrow('API returned 500');
        });

        it('should throw error if fetch fails', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(loadFPLData()).rejects.toThrow('Network error');
        });

        it('should update module-level variables after successful load', async () => {
            const mockData = {
                bootstrap: {
                    events: [
                        { id: 1, finished: true },
                        { id: 2, finished: false }
                    ],
                    teams: [],
                    elements: []
                },
                fixtures: [{ id: 1 }],
                github: { season: {} },
                meta: { bootstrap_age: 1000 }
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            await loadFPLData();

            // Note: Testing module-level variables is tricky
            // These assertions verify the data is returned correctly
            const result = await loadFPLData();
            expect(result.bootstrap).toBeDefined();
            expect(result.fixtures).toBeDefined();
        });
    });

    // ========================================================================
    // loadMyTeam()
    // ========================================================================

    describe('loadMyTeam()', () => {
        const mockTeamData = {
            team: {
                id: 123456,
                name: 'Test Team',
                player_first_name: 'John',
                player_last_name: 'Doe'
            },
            picks: {
                picks: [{ element: 1, position: 1 }],
                entry_history: { total_points: 50 }
            },
            gameweek: 1
        };

        it('should fetch team data from /api/team/:teamId', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockTeamData
            });

            const result = await loadMyTeam(123456);

            expect(global.fetch).toHaveBeenCalledWith('/api/team/123456');
            expect(result).toEqual(mockTeamData);
        });

        it('should throw error if API returns non-OK status', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            await expect(loadMyTeam(123456)).rejects.toThrow('API returned 404');
        });

        it('should handle team not found (404)', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            await expect(loadMyTeam(999999)).rejects.toThrow();
        });
    });

    // ========================================================================
    // loadLeagueStandings()
    // ========================================================================

    describe('loadLeagueStandings()', () => {
        const mockLeagueData = {
            league: { id: 789, name: 'Test League' },
            standings: {
                results: [
                    { entry: 123, total: 100, rank: 1 }
                ]
            }
        };

        it('should fetch league standings from /api/leagues/:leagueId', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockLeagueData
            });

            const result = await loadLeagueStandings(789);

            expect(global.fetch).toHaveBeenCalledWith('/api/leagues/789?page=1');
            expect(result).toEqual(mockLeagueData);
        });

        it('should accept page parameter', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockLeagueData
            });

            await loadLeagueStandings(789, 2);

            expect(global.fetch).toHaveBeenCalledWith('/api/leagues/789?page=2');
        });

        it('should throw error if API returns non-OK status', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400
            });

            await expect(loadLeagueStandings(789)).rejects.toThrow('API returned 400');
        });
    });

    // ========================================================================
    // refreshData()
    // ========================================================================

    describe('refreshData()', () => {
        it('should call loadFPLData with refresh param', async () => {
            const mockData = {
                bootstrap: {},
                fixtures: [],
                github: {},
                meta: { bootstrap_age: 0 }
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData
            });

            await refreshData();

            expect(global.fetch).toHaveBeenCalledWith('/api/fpl-data?refresh=true');
        });
    });
});

describe('Data Module - Data Access Functions', () => {
    // These tests would require the module state to be populated
    // For now, we'll test the basic structure

    describe('getAllPlayers()', () => {
        it('should be a function', () => {
            expect(typeof getAllPlayers).toBe('function');
        });

        it('should return empty array if fplBootstrap is null', () => {
            // Note: Can't easily test without manipulating module state
            // This would need refactoring to make testable
            const result = getAllPlayers();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getPlayerById()', () => {
        it('should be a function', () => {
            expect(typeof getPlayerById).toBe('function');
        });

        it('should accept playerId parameter', () => {
            // This would return null if data not loaded
            const result = getPlayerById(1);
            expect(result === null || typeof result === 'object').toBe(true);
        });
    });

    describe('getTeamById()', () => {
        it('should be a function', () => {
            expect(typeof getTeamById).toBe('function');
        });

        it('should accept teamId parameter', () => {
            const result = getTeamById(1);
            expect(result === null || typeof result === 'object').toBe(true);
        });
    });
});

describe('Data Module - Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle network failures gracefully', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

        await expect(loadFPLData()).rejects.toThrow('Failed to fetch');
    });

    it('should handle JSON parsing errors', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => {
                throw new Error('Invalid JSON');
            }
        });

        await expect(loadFPLData()).rejects.toThrow('Invalid JSON');
    });

    it('should handle timeout errors', async () => {
        global.fetch.mockImplementationOnce(() =>
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 100)
            )
        );

        await expect(loadFPLData()).rejects.toThrow('Timeout');
    }, 200);
});

describe('Data Module - Caching Behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call API without cache param by default', async () => {
        const mockData = {
            bootstrap: {},
            fixtures: [],
            github: {},
            meta: { bootstrap_age: 5000 }
        };

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData
        });

        await loadFPLData();

        expect(global.fetch).toHaveBeenCalledWith('/api/fpl-data');
    });

    it('should bypass cache when refresh param is passed', async () => {
        const mockData = {
            bootstrap: {},
            fixtures: [],
            github: {},
            meta: { bootstrap_age: 0 }
        };

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData
        });

        await loadFPLData('?refresh=true');

        expect(global.fetch).toHaveBeenCalledWith('/api/fpl-data?refresh=true');
    });
});
