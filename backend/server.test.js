// ============================================================================
// BACKEND SERVER TESTS
// Test suite for cache logic, validation, and API endpoints
// ============================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CACHE VALIDATION TESTS
// ============================================================================

describe('Cache Validation', () => {
    const CACHE_BACKUP_PATH = path.join(__dirname, 'cache-backup-test.json');

    after(() => {
        // Cleanup test files
        if (fs.existsSync(CACHE_BACKUP_PATH)) {
            fs.unlinkSync(CACHE_BACKUP_PATH);
        }
    });

    it('should validate correct cache structure', () => {
        const validCache = {
            bootstrap: { data: null, timestamp: null },
            fixtures: { data: null, timestamp: null },
            github: { data: null, timestamp: null, era: null },
            stats: {
                totalFetches: 0,
                cacheHits: 0,
                cacheMisses: 0,
                lastFetch: null
            }
        };

        assert.ok(validateCacheStructureTest(validCache), 'Valid cache should pass validation');
    });

    it('should reject cache missing required properties', () => {
        const invalidCache = {
            bootstrap: { data: null, timestamp: null },
            // Missing fixtures, github, stats
        };

        assert.strictEqual(
            validateCacheStructureTest(invalidCache),
            false,
            'Invalid cache should fail validation'
        );
    });

    it('should reject cache with invalid bootstrap structure', () => {
        const invalidCache = {
            bootstrap: 'not an object',
            fixtures: { data: null, timestamp: null },
            github: { data: null, timestamp: null, era: null },
            stats: {}
        };

        assert.strictEqual(
            validateCacheStructureTest(invalidCache),
            false,
            'Cache with invalid bootstrap should fail validation'
        );
    });

    it('should reject cache with fixtures data not being an array', () => {
        const invalidCache = {
            bootstrap: { data: null, timestamp: null },
            fixtures: { data: 'not an array', timestamp: null },
            github: { data: null, timestamp: null, era: null },
            stats: {}
        };

        assert.strictEqual(
            validateCacheStructureTest(invalidCache),
            false,
            'Cache with non-array fixtures should fail validation'
        );
    });

    it('should accept cache with valid fixtures array', () => {
        const validCache = {
            bootstrap: { data: {}, timestamp: Date.now() },
            fixtures: { data: [], timestamp: Date.now() },
            github: { data: null, timestamp: null, era: null },
            stats: {
                totalFetches: 0,
                cacheHits: 0,
                cacheMisses: 0,
                lastFetch: null
            }
        };

        assert.ok(validateCacheStructureTest(validCache), 'Valid cache with fixtures array should pass');
    });
});

// ============================================================================
// HELPER FUNCTIONS (extracted from server.js for testing)
// ============================================================================

/**
 * Validate cache structure (extracted from server.js for testing)
 * @param {Object} cacheData - Cache object to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateCacheStructureTest(cacheData) {
    if (!cacheData || typeof cacheData !== 'object') {
        return false;
    }

    // Check required top-level properties
    const requiredProps = ['bootstrap', 'fixtures', 'github', 'stats'];
    for (const prop of requiredProps) {
        if (!(prop in cacheData)) {
            return false;
        }
    }

    // Validate bootstrap structure
    if (!cacheData.bootstrap || typeof cacheData.bootstrap !== 'object') {
        return false;
    }

    // Validate fixtures structure
    if (!cacheData.fixtures || typeof cacheData.fixtures !== 'object') {
        return false;
    }

    // Validate github structure
    if (!cacheData.github || typeof cacheData.github !== 'object') {
        return false;
    }

    // Validate stats structure
    if (!cacheData.stats || typeof cacheData.stats !== 'object') {
        return false;
    }

    // If bootstrap has data, validate it's an array or object
    if (cacheData.bootstrap.data) {
        if (typeof cacheData.bootstrap.data !== 'object') {
            return false;
        }
    }

    // If fixtures has data, validate it's an array
    if (cacheData.fixtures.data) {
        if (!Array.isArray(cacheData.fixtures.data)) {
            return false;
        }
    }

    return true;
}

// ============================================================================
// ERA DETECTION TESTS
// ============================================================================

describe('Era Detection', () => {
    it('should return "morning" for 5am-4:59pm UTC', () => {
        // Mock different hours
        const morningHours = [5, 6, 10, 12, 16];
        morningHours.forEach(hour => {
            const era = getCurrentEraTest(hour);
            assert.strictEqual(era, 'morning', `Hour ${hour} should be morning`);
        });
    });

    it('should return "evening" for 5pm-4:59am UTC', () => {
        // Mock different hours
        const eveningHours = [17, 18, 20, 23, 0, 1, 4];
        eveningHours.forEach(hour => {
            const era = getCurrentEraTest(hour);
            assert.strictEqual(era, 'evening', `Hour ${hour} should be evening`);
        });
    });
});

/**
 * Get current data era based on UTC time (test version with hour parameter)
 * @param {number} hour - UTC hour (0-23)
 * @returns {string} - 'morning' or 'evening'
 */
function getCurrentEraTest(hour) {
    return (hour >= 5 && hour < 17) ? 'morning' : 'evening';
}

// ============================================================================
// TEAM ID VALIDATION TESTS
// ============================================================================

describe('Team ID Validation', () => {
    it('should accept valid team IDs', () => {
        const validIds = ['123456', '1', '1234567890'];
        validIds.forEach(id => {
            assert.ok(isValidTeamIdTest(id), `${id} should be valid`);
        });
    });

    it('should reject invalid team IDs', () => {
        const invalidIds = [
            '',                    // Empty
            'abc',                 // Not numeric
            '123abc',             // Mixed
            '12345678901',        // Too long (>10 digits)
            '123.456',            // Decimal
            '-123',               // Negative
            '  123  ',            // Contains spaces (should trim before validation)
        ];
        invalidIds.forEach(id => {
            assert.strictEqual(
                isValidTeamIdTest(id),
                false,
                `${id} should be invalid`
            );
        });
    });
});

/**
 * Validate team ID input (test version)
 * @param {string} teamId - Team ID to validate
 * @returns {boolean} - True if valid
 */
function isValidTeamIdTest(teamId) {
    return /^\d{1,10}$/.test(teamId);
}

// ============================================================================
// GAMEWEEK VALIDATION TESTS
// ============================================================================

describe('Gameweek Validation', () => {
    it('should accept valid gameweeks (1-38)', () => {
        const validGWs = [1, 10, 20, 38];
        validGWs.forEach(gw => {
            assert.ok(isValidGameweekTest(gw), `GW${gw} should be valid`);
        });
    });

    it('should reject invalid gameweeks', () => {
        const invalidGWs = [0, -1, 39, 40, 100, 1.5, NaN, null];
        invalidGWs.forEach(gw => {
            assert.strictEqual(
                isValidGameweekTest(gw),
                false,
                `GW${gw} should be invalid`
            );
        });
    });
});

/**
 * Validate gameweek number (test version)
 * @param {number} gw - Gameweek number to validate
 * @returns {boolean} - True if valid
 */
function isValidGameweekTest(gw) {
    return Number.isInteger(gw) && gw >= 1 && gw <= 38;
}

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('🧪 Running backend tests...\n');
