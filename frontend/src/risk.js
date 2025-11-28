// ============================================================================
// RISK MODULE
// Player risk analysis (injuries, rotation, form, suspension)
// ============================================================================

import { currentGW } from './data.js';
import { calculatePPM, calculateMinutesPercentage } from './utils.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} RiskFactor
 * @property {'injury'|'suspension'|'rotation'|'form'|'value'|'deadwood'|'price'} type - Risk type
 * @property {'high'|'medium'|'low'} severity - Risk severity level
 * @property {string} icon - Emoji icon representing the risk
 * @property {string} message - Short risk message for display
 * @property {string} details - Detailed risk description
 */

/**
 * @typedef {Object} RiskSummary
 * @property {number} totalRisks - Total number of risks
 * @property {number} highRisks - Number of high severity risks
 * @property {number} mediumRisks - Number of medium severity risks
 * @property {number} lowRisks - Number of low severity risks
 * @property {boolean} hasAnyRisk - Whether player has any risks
 * @property {boolean} hasHighRisk - Whether player has high severity risk
 * @property {boolean} hasMediumRisk - Whether player has medium severity risk
 * @property {RiskFactor[]} risks - Array of all risk factors
 */

// ============================================================================
// RISK ANALYSIS
// ============================================================================

/**
 * Analyze all risk factors for a player
 * @param {import('./utils.js').Player} player - Player object with stats and status
 * @returns {RiskFactor[]} Array of risk objects sorted by severity
 * @example
 * const risks = analyzePlayerRisks(player);
 * // Returns: [{ type: 'injury', severity: 'high', icon: '🔴', message: '25% fit', details: '...' }]
 */
export function analyzePlayerRisks(player) {
    const risks = [];
    const gw = currentGW || 1;
    
    // Calculate key metrics
    const minutesPct = calculateMinutesPercentage(player, gw);
    const ppm = calculatePPM(player);
    const medianPPM = 2.0; // Simplified baseline
    
    // 1. INJURY RISK (highest priority)
    if (player.chance_of_playing_next_round !== null && 
        player.chance_of_playing_next_round !== undefined) {
        if (player.chance_of_playing_next_round < 75) {
            risks.push({
                type: 'injury',
                severity: player.chance_of_playing_next_round < 50 ? 'high' : 'medium',
                icon: '🔴',
                message: `${player.chance_of_playing_next_round}% fit`,
                details: `Injury concern - only ${player.chance_of_playing_next_round}% chance of playing next round`
            });
        }
    }
    
    // 2. SUSPENSION RISK
    if (player.yellow_cards >= 4) {
        risks.push({
            type: 'suspension',
            severity: player.yellow_cards >= 9 ? 'high' : 'medium',
            icon: '🟨',
            message: `${player.yellow_cards} yellows`,
            details: `${player.yellow_cards} yellow cards - suspension risk`
        });
    }
    
    // Check for current suspension (status === "s" indicates currently suspended)
    if (player.status === 's') {
        risks.push({
            type: 'suspension',
            severity: 'high',
            icon: '🟥',
            message: `Suspended`,
            details: `Player is currently suspended`
        });
    }
    
    // 3. ROTATION RISK (based on minutes)
    if (gw >= 5) { // Only after 5 gameweeks
        if (minutesPct < 50 && player.minutes > 0) {
            risks.push({
                type: 'rotation',
                severity: minutesPct < 30 ? 'medium' : 'low',
                icon: '🔄',
                message: `${minutesPct.toFixed(0)}% minutes`,
                details: `Low playing time - rotation risk (${minutesPct.toFixed(0)}% of available minutes)`
            });
        }
    }
    
    // 4. POOR FORM
    const form = parseFloat(player.form) || 0;
    const avgPoints = gw > 0 ? (player.total_points || 0) / gw : 0;

    if (form < 3 && gw >= 3 && player.minutes > 180) {
        risks.push({
            type: 'form',
            severity: 'low',
            icon: '📉',
            message: `Form: ${form.toFixed(1)}`,
            details: `Poor recent form (${form.toFixed(1)})`
        });
    }
    
    // 5. POOR VALUE (underperforming for price)
    if (ppm < medianPPM * 0.6 && player.now_cost >= 60 && gw >= 5) {
        risks.push({
            type: 'value',
            severity: 'low',
            icon: '💰',
            message: `PPM: ${ppm.toFixed(1)}`,
            details: `Poor value (${ppm.toFixed(1)} points per million)`
        });
    }
    
    // 6. DEAD WOOD (not playing at all)
    if (minutesPct === 0 && gw >= 3) {
        risks.push({
            type: 'deadwood',
            severity: 'high',
            icon: '🪵',
            message: 'No minutes',
            details: 'Player has not played any minutes'
        });
    }
    
    // 7. PRICE DROP RISK
    if (player.cost_change_event < 0) {
        risks.push({
            type: 'price',
            severity: 'low',
            icon: '📉',
            message: `${player.cost_change_event / 10}m drop`,
            details: `Price dropped by £${Math.abs(player.cost_change_event / 10)}m this gameweek`
        });
    }
    
    return risks;
}

/**
 * Check if player has high-severity risks (injuries, red cards, deadwood)
 * @param {RiskFactor[]} risks - Array of risk objects from analyzePlayerRisks
 * @returns {boolean} True if any risks have 'high' severity
 */
export function hasHighRisk(risks) {
    return risks.some(risk => risk.severity === 'high');
}

/**
 * Check if player has medium-severity risks (yellow cards, rotation, poor form)
 * @param {RiskFactor[]} risks - Array of risk objects from analyzePlayerRisks
 * @returns {boolean} True if any risks have 'medium' severity
 */
export function hasMediumRisk(risks) {
    return risks.some(risk => risk.severity === 'medium');
}

/**
 * Get comprehensive risk summary for a player
 * @param {import('./utils.js').Player} player - Player object
 * @returns {RiskSummary} Complete risk analysis summary with counts and flags
 * @example
 * const summary = getRiskSummary(player);
 * console.log(summary.hasHighRisk); // true/false
 * console.log(summary.totalRisks);  // 3
 */
export function getRiskSummary(player) {
    const risks = analyzePlayerRisks(player);
    
    return {
        totalRisks: risks.length,
        highRisks: risks.filter(r => r.severity === 'high').length,
        mediumRisks: risks.filter(r => r.severity === 'medium').length,
        lowRisks: risks.filter(r => r.severity === 'low').length,
        hasAnyRisk: risks.length > 0,
        hasHighRisk: hasHighRisk(risks),
        hasMediumRisk: hasMediumRisk(risks),
        risks: risks
    };
}

// ============================================================================
// RISK DISPLAY
// ============================================================================

/**
 * Render risk tooltip HTML
 * @param {Array} risks - Array of risk objects
 * @returns {string} HTML for tooltip
 */
export function renderRiskTooltip(risks) {
    if (!risks || risks.length === 0) {
        return '';
    }
    
    // Generate tooltip content
    const riskItems = risks.map(risk => `
        <div style="
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px;
            margin: 2px 0;
            border-left: 3px solid ${getRiskBorderColor(risk.severity)};
            border-radius: 4px;
            font-size: 12px;
            background: ${getRiskBgColor(risk.severity)};
        ">
            <span style="font-size: 14px; flex-shrink: 0;">${risk.icon}</span>
            <span style="color: #374151; font-weight: 500;">${risk.details}</span>
        </div>
    `).join('');
    
    // Get primary icon (highest severity)
    const primaryIcon = getPrimaryRiskIcon(risks);
    
    return `
        <span
            class="risk-indicator"
            style="
                cursor: help;
                font-size: 0.7rem;
                position: relative;
                display: inline-block;
                margin-left: 4px;
            "
            title="Click to see risk details"
        >
            ${primaryIcon}
            <div class="risk-tooltip" style="
                display: none;
                position: absolute;
                z-index: 1000;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 8px;
                min-width: 220px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                left: 50%;
                transform: translateX(-50%);
                bottom: calc(100% + 4px);
                color: #374151;
            ">
                <div style="font-weight: 700; margin-bottom: 8px; font-size: 0.875rem;">
                    Risk Factors
                </div>
                ${riskItems}
            </div>
        </span>
    `;
}

/**
 * Get primary risk icon (highest severity)
 * @param {Array} risks - Array of risk objects
 * @returns {string} Emoji icon
 */
function getPrimaryRiskIcon(risks) {
    if (risks.some(r => r.severity === 'high')) {
        // Return first high severity icon
        const highRisk = risks.find(r => r.severity === 'high');
        return highRisk.icon;
    }
    
    if (risks.some(r => r.severity === 'medium')) {
        // Return warning emoji for medium risks
        return '⚠️';
    }
    
    // Low severity
    return 'ℹ️';
}

/**
 * Get background color for risk severity
 * @param {string} severity - Risk severity ('high', 'medium', 'low')
 * @returns {string} CSS color
 */
function getRiskBgColor(severity) {
    if (severity === 'high') return '#fef2f2'; // Red tint
    if (severity === 'medium') return '#fffbeb'; // Yellow tint
    return '#eff6ff'; // Blue tint
}

/**
 * Get border color for risk severity
 * @param {string} severity - Risk severity ('high', 'medium', 'low')
 * @returns {string} CSS color
 */
function getRiskBorderColor(severity) {
    if (severity === 'high') return '#dc2626'; // Red
    if (severity === 'medium') return '#f59e0b'; // Yellow/orange
    return '#3b82f6'; // Blue
}

/**
 * Get risk badge HTML
 * @param {Array} risks - Array of risk objects
 * @returns {string} HTML for badge
 */
export function getRiskBadge(risks) {
    if (!risks || risks.length === 0) return '';
    
    const hasHigh = hasHighRisk(risks);
    const hasMedium = hasMediumRisk(risks);
    
    let badge = '';
    if (hasHigh) {
        badge = '<span style="color: var(--danger-color); font-weight: 700;">🔴</span>';
    } else if (hasMedium) {
        badge = '<span style="color: var(--warning-color); font-weight: 700;">⚠️</span>';
    } else {
        badge = '<span style="color: var(--text-tertiary);">ℹ️</span>';
    }
    
    return badge;
}

// ============================================================================
// SPECIFIC RISK CHECKS
// ============================================================================

/**
 * Check if player has injury risk (< 75% chance to play)
 * @param {import('./utils.js').Player} player - Player object
 * @returns {boolean} True if chance_of_playing_next_round < 75%
 */
export function hasInjuryRisk(player) {
    return player.chance_of_playing_next_round !== null &&
           player.chance_of_playing_next_round !== undefined &&
           player.chance_of_playing_next_round < 75;
}

/**
 * Check if player has rotation risk (< 50% minutes after GW5)
 * @param {import('./utils.js').Player} player - Player object
 * @returns {boolean} True if playing < 50% of minutes (only checked after GW5)
 */
export function hasRotationRisk(player) {
    const gw = currentGW || 1;
    if (gw < 5) return false;

    const minutesPct = calculateMinutesPercentage(player, gw);
    return minutesPct < 50 && player.minutes > 0;
}

/**
 * Check if player has suspension risk (4+ yellows or currently suspended)
 * @param {import('./utils.js').Player} player - Player object
 * @returns {boolean} True if player has disciplinary concerns
 */
export function hasSuspensionRisk(player) {
    return player.yellow_cards >= 4 || player.status === 's';
}

/**
 * Check if player is dead wood (0 minutes played after GW3)
 * @param {import('./utils.js').Player} player - Player object
 * @returns {boolean} True if player has not played any minutes (only checked after GW3)
 */
export function isDeadWood(player) {
    const gw = currentGW || 1;
    if (gw < 3) return false;

    const minutesPct = calculateMinutesPercentage(player, gw);
    return minutesPct === 0;
}

/**
 * Check if player has poor form (< 3 points per game after GW3)
 * @param {import('./utils.js').Player} player - Player object
 * @returns {boolean} True if form < 3 (requires 180+ minutes and GW3+)
 */
export function hasPoorForm(player) {
    const gw = currentGW || 1;
    if (gw < 3 || player.minutes <= 180) return false;

    const form = parseFloat(player.form) || 0;
    return form < 3;
}