// ============================================================================
// RISK MODULE
// Player risk analysis (injuries, rotation, form, suspension)
// ============================================================================

import { currentGW } from './data.js';
import { calculatePPM, calculateMinutesPercentage } from './utils.js';

// ============================================================================
// RISK ANALYSIS
// ============================================================================

/**
 * Analyze all risk factors for a player
 * @param {Object} player - Player object
 * @returns {Array} Array of risk objects
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
    
    if (player.red_cards > 0) {
        risks.push({
            type: 'suspension',
            severity: 'high',
            icon: '🟥',
            message: `Red card`,
            details: `Player has received a red card`
        });
    }
    
    // 3. ROTATION RISK (based on minutes)
    if (gw >= 5) { // Only after 5 gameweeks
        if (minutesPct < 50 && player.minutes > 0) {
            risks.push({
                type: 'rotation',
                severity: minutesPct < 30 ? 'high' : 'medium',
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
            severity: form < 2 ? 'high' : 'medium',
            icon: '📉',
            message: `Form: ${form.toFixed(1)}`,
            details: `Poor recent form (${form.toFixed(1)} pts/game)`
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
 * Check if player has high-severity risks
 * @param {Array} risks - Array of risk objects
 * @returns {boolean} True if any high-severity risks
 */
export function hasHighRisk(risks) {
    return risks.some(risk => risk.severity === 'high');
}

/**
 * Check if player has medium-severity risks
 * @param {Array} risks - Array of risk objects
 * @returns {boolean} True if any medium-severity risks
 */
export function hasMediumRisk(risks) {
    return risks.some(risk => risk.severity === 'medium');
}

/**
 * Get risk summary for a player
 * @param {Object} player - Player object
 * @returns {Object} Risk summary
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
            margin-bottom: 0.5rem;
            padding: 0.5rem;
            background: ${getRiskBgColor(risk.severity)};
            border-radius: 0.25rem;
        ">
            <div style="font-weight: 600; margin-bottom: 0.25rem;">
                ${risk.icon} ${risk.message}
            </div>
            <div style="font-size: 0.875rem; opacity: 0.9;">
                ${risk.details}
            </div>
        </div>
    `).join('');
    
    // Get primary icon (highest severity)
    const primaryIcon = getPrimaryRiskIcon(risks);
    
    return `
        <span 
            class="risk-indicator"
            style="
                cursor: help;
                font-size: 1.25rem;
                position: relative;
                display: inline-block;
            "
            title="Click to see risk details"
        >
            ${primaryIcon}
            <div class="risk-tooltip" style="
                display: none;
                position: absolute;
                z-index: 1000;
                background: var(--bg-primary);
                border: 2px solid var(--border-color);
                border-radius: 0.5rem;
                padding: 1rem;
                min-width: 250px;
                box-shadow: 0 4px 12px var(--shadow);
                right: 0;
                bottom: calc(100% + 0.5rem);
                color: var(--text-primary);
            ">
                <div style="font-weight: 700; margin-bottom: 0.75rem; font-size: 1rem;">
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
    if (severity === 'high') return 'rgba(220, 38, 38, 0.1)'; // Red tint
    if (severity === 'medium') return 'rgba(245, 158, 11, 0.1)'; // Yellow tint
    return 'rgba(59, 130, 246, 0.1)'; // Blue tint
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
 * Check if player has injury risk
 * @param {Object} player - Player object
 * @returns {boolean} True if injured
 */
export function hasInjuryRisk(player) {
    return player.chance_of_playing_next_round !== null && 
           player.chance_of_playing_next_round !== undefined &&
           player.chance_of_playing_next_round < 75;
}

/**
 * Check if player has rotation risk
 * @param {Object} player - Player object
 * @returns {boolean} True if rotation risk
 */
export function hasRotationRisk(player) {
    const gw = currentGW || 1;
    if (gw < 5) return false;
    
    const minutesPct = calculateMinutesPercentage(player, gw);
    return minutesPct < 50 && player.minutes > 0;
}

/**
 * Check if player has suspension risk
 * @param {Object} player - Player object
 * @returns {boolean} True if suspension risk
 */
export function hasSuspensionRisk(player) {
    return player.yellow_cards >= 4 || player.red_cards > 0;
}

/**
 * Check if player is dead wood (not playing)
 * @param {Object} player - Player object
 * @returns {boolean} True if dead wood
 */
export function isDeadWood(player) {
    const gw = currentGW || 1;
    if (gw < 3) return false;
    
    const minutesPct = calculateMinutesPercentage(player, gw);
    return minutesPct === 0;
}

/**
 * Check if player has poor form
 * @param {Object} player - Player object
 * @returns {boolean} True if poor form
 */
export function hasPoorForm(player) {
    const gw = currentGW || 1;
    if (gw < 3 || player.minutes <= 180) return false;
    
    const form = parseFloat(player.form) || 0;
    return form < 3;
}