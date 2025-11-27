// ============================================================================
// DATA ANALYSIS TRANSFER TARGETS TAB
// Shows rising stars, sell candidates, and fixture turnarounds
// ============================================================================

import { getAllPlayers } from '../data.js';
import { getCurrentGW, calculateMinutesPercentage } from '../utils.js';
import { calculateFixtureDifficulty } from '../fixtures.js';
import { isMobileDevice } from '../renderMyTeamMobile.js';

function getTransferMomentum(player) {
    if (player?.github_transfers) {
        return player.github_transfers.transfers_in - player.github_transfers.transfers_out;
    }
    if (typeof player?.transfers_in_event === 'number' && typeof player?.transfers_out_event === 'number') {
        return player.transfers_in_event - player.transfers_out_event;
    }
    return null;
}

/**
 * Render Transfer Targets tab
 * @param {string} position - Position filter ('all', 'GKP', 'DEF', 'MID', 'FWD')
 * @param {Function} renderSectionHeader - Function to render section headers
 * @param {Function} renderPositionSpecificTableMobile - Mobile table renderer
 * @param {Function} renderPositionSpecificTable - Desktop table renderer
 * @returns {string} HTML for transfer targets tab
 */
export function renderTransferTargets(
    position = 'all',
    renderSectionHeader,
    renderPositionSpecificTableMobile,
    renderPositionSpecificTable
) {
    let players = getAllPlayers();
    const isMobile = isMobileDevice();

    // Filter by position if selected
    if (position !== 'all') {
        const posMap = { 'GKP': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
        players = players.filter(p => p.element_type === posMap[position]);
    }

    // Rising stars (positive momentum + good fixtures + good form)
    // Make filters more lenient to ensure we show results
    const risingStars = players.filter(p => {
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        if (minPercentage < 15) return false;

        const form = parseFloat(p.form) || 0;
        const fdr5 = calculateFixtureDifficulty(p.team, 5);

        // Allow players without transfer data
        const netMomentum = getTransferMomentum(p);
        const hasPositiveMomentum = netMomentum === null ? true : netMomentum > 0;

        return form > 3.0 && fdr5 <= 3.8;
    }).sort((a, b) => {
        // Sort by form first, then by transfer momentum
        const formDiff = (parseFloat(b.form) || 0) - (parseFloat(a.form) || 0);
        if (Math.abs(formDiff) > 0.5) return formDiff;
        const aNet = getTransferMomentum(a) ?? 0;
        const bNet = getTransferMomentum(b) ?? 0;
        return bNet - aNet;
    }).slice(0, 20);

    // Sell candidates (negative momentum OR bad form/fixtures)
    const sellCandidates = players.filter(p => {
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        const ownership = parseFloat(p.selected_by_percent) || 0;
        if (minPercentage < 15 || ownership < 1) return false;

        const form = parseFloat(p.form) || 0;
        const fdr5 = calculateFixtureDifficulty(p.team, 5);

        // Consider sell candidates if they have bad form OR bad fixtures
        const hasBadForm = form < 3;
        const hasBadFixtures = fdr5 >= 3.8;

        const netMomentum = getTransferMomentum(p);
        const hasNegativeMomentum = netMomentum !== null ? netMomentum < -5000 : false; // Less strict threshold

        return (hasBadForm || hasBadFixtures) && (hasNegativeMomentum || hasBadForm);
    }).sort((a, b) => {
        // Sort by form ascending (worst first)
        const formDiff = (parseFloat(a.form) || 0) - (parseFloat(b.form) || 0);
        if (Math.abs(formDiff) > 0.5) return formDiff;
        const aNet = getTransferMomentum(a) ?? 0;
        const bNet = getTransferMomentum(b) ?? 0;
        return aNet - bNet;
    }).slice(0, 20);

    // Fixture turnarounds (players with good upcoming fixtures)
    const fixtureTurnarounds = players.filter(p => {
        const minPercentage = calculateMinutesPercentage(p, getCurrentGW());
        if (minPercentage < 20) return false;

        const next3FDR = calculateFixtureDifficulty(p.team, 3);
        const form = parseFloat(p.form) || 0;
        // Players with good fixtures and decent form
        return next3FDR <= 3.0 && form > 2;
    }).sort((a, b) => {
        const aFDR = calculateFixtureDifficulty(a.team, 5);
        const bFDR = calculateFixtureDifficulty(b.team, 5);
        return aFDR - bFDR;
    }).slice(0, 20);

    return `
        <div>
            <!-- Section 1: Rising Stars -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('⭐', 'Rising Stars', 'High form + good fixtures + positive transfer momentum')}
                ${risingStars.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(risingStars, 'transfers') : renderPositionSpecificTable(risingStars, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No rising stars found</div>'}
            </div>

            <!-- Section 2: Sell Candidates -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('📉', 'Sell Candidates', 'Poor form or bad fixtures + negative transfer momentum')}
                ${sellCandidates.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(sellCandidates, 'transfers') : renderPositionSpecificTable(sellCandidates, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No sell candidates found</div>'}
            </div>

            <!-- Section 3: Fixture Turnarounds -->
            <div style="margin-bottom: 3rem;">
                ${renderSectionHeader('🔄', 'Fixture Turnarounds', 'Players with improving fixtures (good time to buy before price rises)')}
                ${fixtureTurnarounds.length > 0 ? (isMobile ? renderPositionSpecificTableMobile(fixtureTurnarounds, 'fdr5') : renderPositionSpecificTable(fixtureTurnarounds, position)) : '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No fixture turnarounds found</div>'}
            </div>
        </div>
    `;
}
