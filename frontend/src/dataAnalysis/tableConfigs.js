// ============================================================================
// DATA ANALYSIS TABLE CONFIGURATIONS
// Column definitions and metrics for different position types
// ============================================================================

/**
 * Column configuration schema:
 * {
 *   key: string - unique identifier
 *   label: string - display header
 *   align: 'left'|'center'|'right' - text alignment
 *   getValue: (player, context) => value - data extractor
 *   style: (value, player, context) => styleObject - optional styling
 *   format: (value) => string - optional formatter
 * }
 */

import {
    calculatePPM,
    calculateMinutesPercentage,
    formatCurrency,
    formatDecimal,
    escapeHtml,
    getTeamShortName,
    getPositionShort,
    getDifficultyClass
} from '../utils.js';
import { calculateFixtureDifficulty, getFixtures } from '../fixtures.js';
import { currentGW } from '../data.js';

// ============================================================================
// COMMON COLUMNS (shared across positions)
// ============================================================================

const COMMON_COLUMNS = {
    player: {
        key: 'player',
        label: 'Player',
        align: 'left',
        getValue: (p) => escapeHtml(p.web_name),
        renderCell: (p, isMyPlayer) =>
            `<strong>${escapeHtml(p.web_name)}</strong>${isMyPlayer ? ' <span style="color: #8b5cf6; font-size: 0.75rem;">⭐</span>' : ''}`
    },
    team: {
        key: 'team',
        label: 'Team',
        align: 'left',
        getValue: (p) => getTeamShortName(p.team)
    },
    price: {
        key: 'price',
        label: 'Price',
        align: 'center',
        getValue: (p) => formatCurrency(p.now_cost)
    },
    points: {
        key: 'points',
        label: 'Pts',
        align: 'center',
        getValue: (p) => p.total_points,
        hasHeatmap: true,
        heatmapKey: 'total_points'
    },
    ppm: {
        key: 'ppm',
        label: 'PPM',
        align: 'center',
        getValue: (p) => formatDecimal(calculatePPM(p)),
        hasHeatmap: true,
        heatmapKey: 'ppm'
    },
    ownership: {
        key: 'ownership',
        label: 'Own%',
        align: 'center',
        getValue: (p) => `${(parseFloat(p.selected_by_percent) || 0).toFixed(1)}%`,
        fontSize: '0.8rem'
    },
    minutes: {
        key: 'minutes',
        label: 'Min%',
        align: 'center',
        getValue: (p) => `${calculateMinutesPercentage(p, currentGW).toFixed(0)}%`,
        fontSize: '0.8rem'
    },
    form: {
        key: 'form',
        label: 'Form',
        align: 'center',
        getValue: (p) => formatDecimal(p.form),
        hasHeatmap: true,
        heatmapKey: 'form'
    },
    transfers: {
        key: 'transfers',
        label: 'ΔT',
        align: 'center',
        getValue: (p) => {
            const net = (p.transfers_in_event || 0) - (p.transfers_out_event || 0);
            return net >= 0 ? `+${net}` : net.toString();
        },
        getColor: (p) => {
            const net = (p.transfers_in_event || 0) - (p.transfers_out_event || 0);
            return net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'var(--text-secondary)';
        },
        fontSize: '0.8rem'
    },
    fdr: {
        key: 'fdr',
        label: 'FDR(5)',
        align: 'center',
        getValue: (p) => formatDecimal(calculateFixtureDifficulty(p.team, 5)),
        renderCell: (p) => {
            const fdr5 = calculateFixtureDifficulty(p.team, 5);
            const fdrClass = getDifficultyClass(Math.round(fdr5));
            return `<span class="${fdrClass}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.75rem;">${formatDecimal(fdr5)}</span>`;
        }
    }
};

// ============================================================================
// POSITION-SPECIFIC COLUMNS
// ============================================================================

const POSITION_SPECIFIC_COLUMNS = {
    // Goalkeeper columns
    GKP: {
        saves90: {
            key: 'saves90',
            label: 'Saves/90',
            align: 'center',
            getValue: (p) => formatDecimal(p.github_season?.saves_per_90 || 0),
            bold: true
        },
        cs90: {
            key: 'cs90',
            label: 'CS/90',
            align: 'center',
            getValue: (p) => formatDecimal(p.github_season?.clean_sheets_per_90 || 0),
            bold: true
        },
        xGC90: {
            key: 'xGC90',
            label: 'xGC/90',
            align: 'center',
            getValue: (p) => formatDecimal(p.expected_goals_conceded_per_90 || 0)
        },
        cs: {
            key: 'cs',
            label: 'CS',
            align: 'center',
            getValue: (p) => p.clean_sheets || 0
        }
    },

    // Defender columns
    DEF: {
        def90: {
            key: 'def90',
            label: 'Def/90',
            align: 'center',
            getValue: (p) => formatDecimal(p.github_season?.defensive_contribution_per_90 || 0),
            bold: true
        },
        cs: {
            key: 'cs',
            label: 'CS',
            align: 'center',
            getValue: (p) => p.clean_sheets || 0
        },
        xGC90: {
            key: 'xGC90',
            label: 'xGC/90',
            align: 'center',
            getValue: (p) => formatDecimal(p.expected_goals_conceded_per_90 || 0)
        },
        ga: {
            key: 'ga',
            label: 'G+A',
            align: 'center',
            getValue: (p) => (p.goals_scored || 0) + (p.assists || 0),
            bold: true
        }
    },

    // Midfielder/Forward columns
    ATTACK: {
        def90: {
            key: 'def90',
            label: 'Def/90',
            align: 'center',
            getValue: (p) => formatDecimal(p.github_season?.defensive_contribution_per_90 || 0),
            bold: true
        },
        goals: {
            key: 'goals',
            label: 'Goals',
            align: 'center',
            getValue: (p) => p.goals_scored || 0
        },
        assists: {
            key: 'assists',
            label: 'Assists',
            align: 'center',
            getValue: (p) => p.assists || 0
        },
        xGI90: {
            key: 'xGI90',
            label: 'xGI/90',
            align: 'center',
            getValue: (p) => formatDecimal(p.expected_goal_involvements_per_90 || 0)
        },
        pk: {
            key: 'pk',
            label: 'PK',
            align: 'center',
            getValue: (p) => p.penalties_order === 1 ? '⚽' : '—'
        }
    }
};

// ============================================================================
// COLUMN CONFIGURATIONS BY POSITION
// ============================================================================

export const TABLE_CONFIGS = {
    GKP: [
        COMMON_COLUMNS.player,
        COMMON_COLUMNS.team,
        COMMON_COLUMNS.price,
        COMMON_COLUMNS.points,
        COMMON_COLUMNS.ppm,
        COMMON_COLUMNS.ownership,
        COMMON_COLUMNS.minutes,
        COMMON_COLUMNS.form,
        POSITION_SPECIFIC_COLUMNS.GKP.saves90,
        POSITION_SPECIFIC_COLUMNS.GKP.cs90,
        POSITION_SPECIFIC_COLUMNS.GKP.xGC90,
        POSITION_SPECIFIC_COLUMNS.GKP.cs,
        COMMON_COLUMNS.transfers,
        COMMON_COLUMNS.fdr
    ],

    DEF: [
        COMMON_COLUMNS.player,
        COMMON_COLUMNS.team,
        COMMON_COLUMNS.price,
        COMMON_COLUMNS.points,
        COMMON_COLUMNS.ppm,
        COMMON_COLUMNS.ownership,
        COMMON_COLUMNS.minutes,
        COMMON_COLUMNS.form,
        POSITION_SPECIFIC_COLUMNS.DEF.def90,
        POSITION_SPECIFIC_COLUMNS.DEF.cs,
        POSITION_SPECIFIC_COLUMNS.DEF.xGC90,
        POSITION_SPECIFIC_COLUMNS.DEF.ga,
        COMMON_COLUMNS.transfers,
        COMMON_COLUMNS.fdr
    ],

    MID: [
        COMMON_COLUMNS.player,
        COMMON_COLUMNS.team,
        COMMON_COLUMNS.price,
        COMMON_COLUMNS.points,
        COMMON_COLUMNS.ppm,
        COMMON_COLUMNS.ownership,
        COMMON_COLUMNS.minutes,
        COMMON_COLUMNS.form,
        POSITION_SPECIFIC_COLUMNS.ATTACK.def90,
        POSITION_SPECIFIC_COLUMNS.ATTACK.goals,
        POSITION_SPECIFIC_COLUMNS.ATTACK.assists,
        POSITION_SPECIFIC_COLUMNS.ATTACK.xGI90,
        POSITION_SPECIFIC_COLUMNS.ATTACK.pk,
        COMMON_COLUMNS.transfers,
        COMMON_COLUMNS.fdr
    ],

    FWD: [
        COMMON_COLUMNS.player,
        COMMON_COLUMNS.team,
        COMMON_COLUMNS.price,
        COMMON_COLUMNS.points,
        COMMON_COLUMNS.ppm,
        COMMON_COLUMNS.ownership,
        COMMON_COLUMNS.minutes,
        COMMON_COLUMNS.form,
        POSITION_SPECIFIC_COLUMNS.ATTACK.def90,
        POSITION_SPECIFIC_COLUMNS.ATTACK.goals,
        POSITION_SPECIFIC_COLUMNS.ATTACK.assists,
        POSITION_SPECIFIC_COLUMNS.ATTACK.xGI90,
        POSITION_SPECIFIC_COLUMNS.ATTACK.pk,
        COMMON_COLUMNS.transfers,
        COMMON_COLUMNS.fdr
    ],

    ALL: [
        {
            key: 'position',
            label: 'Pos',
            align: 'left',
            getValue: (p) => getPositionShort(p),
            bold: true
        },
        COMMON_COLUMNS.player,
        COMMON_COLUMNS.team,
        COMMON_COLUMNS.price,
        COMMON_COLUMNS.points,
        COMMON_COLUMNS.ppm,
        COMMON_COLUMNS.ownership,
        COMMON_COLUMNS.minutes,
        COMMON_COLUMNS.form,
        COMMON_COLUMNS.transfers,
        COMMON_COLUMNS.fdr
    ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get table configuration for a position
 * @param {string} position - 'GKP', 'DEF', 'MID', 'FWD', or 'all'
 * @returns {Array} Column configuration
 */
export function getTableConfig(position) {
    const posUpper = position.toUpperCase();

    // Handle MID/FWD - both use same attack columns
    if (posUpper === 'MID' || posUpper === 'FWD') {
        return TABLE_CONFIGS[posUpper];
    }

    return TABLE_CONFIGS[posUpper] || TABLE_CONFIGS.ALL;
}

/**
 * Get fixture headers for next N gameweeks
 * @param {number} count - Number of fixtures to get
 * @returns {Array<string>} Fixture headers
 */
export function getFixtureHeaders(count = 5) {
    const fixtures = getFixtures();
    const upcomingGWs = [];

    for (let i = 1; i <= count; i++) {
        const gw = currentGW + i;
        const gwFixtures = fixtures.filter(f => f.event === gw);
        if (gwFixtures.length > 0) {
            upcomingGWs.push(`GW${gw}`);
        } else {
            upcomingGWs.push(`—`);
        }
    }

    return upcomingGWs;
}

/**
 * Get next N fixtures for a team
 * @param {number} teamId - Team ID
 * @param {number} fromGW - Starting gameweek
 * @param {number} count - Number of fixtures
 * @returns {Array} Fixtures with opponent and difficulty
 */
export function getNextFixtures(teamId, fromGW, count = 5) {
    const fixtures = getFixtures();
    const teamFixtures = [];

    for (let i = 1; i <= count; i++) {
        const gw = fromGW + i;
        const fixture = fixtures.find(f =>
            f.event === gw && (f.team_h === teamId || f.team_a === teamId)
        );

        if (fixture) {
            const isHome = fixture.team_h === teamId;
            const opponentId = isHome ? fixture.team_a : fixture.team_h;
            const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

            const fplBootstrap = window.fplData?.bootstrap;
            const opponent = fplBootstrap?.teams.find(t => t.id === opponentId);
            const opponentShort = opponent ? opponent.short_name : '?';

            teamFixtures.push({
                opponent: `${isHome ? '' : '@'}${opponentShort}`,
                difficulty: difficulty
            });
        } else {
            teamFixtures.push({ opponent: '—', difficulty: 3 });
        }
    }

    return teamFixtures;
}
