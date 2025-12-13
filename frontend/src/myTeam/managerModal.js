// ============================================================================
// MANAGER MODAL
// Modal for team management (switch team, future: team history, settings)
// ============================================================================

import { escapeHtml } from '../utils.js';
import { getGlassmorphism, getShadow, getMobileBorderRadius, getAnimationCurve, getAnimationDuration } from '../styles/mobileDesignSystem.js';
import { loadAndRenderLeagueInfo } from '../leagueInfo.js';

/**
 * Check if dark mode is active
 * @returns {boolean} True if dark mode is active
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Inject modal animation keyframes
 */
function injectModalAnimations() {
    if (document.getElementById('manager-modal-animations')) return;

    const style = document.createElement('style');
    style.id = 'manager-modal-animations';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes slideUp {
            from { 
                opacity: 0;
                transform: translateY(20px);
            }
            to { 
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes slideDown {
            from { 
                opacity: 1;
                transform: translateY(0);
            }
            to { 
                opacity: 0;
                transform: translateY(20px);
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Show Manager Modal
 * @param {Object} teamData - Current team data (optional)
 */
export function showManagerModal(teamData = null) {
    injectModalAnimations();

    // Remove existing modal
    const existingModal = document.getElementById('manager-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const isDark = isDarkMode();
    const glassEffect = getGlassmorphism(isDark, 'heavy');
    const shadow = getShadow('modal');
    const radius = getMobileBorderRadius('xlarge');
    const animationCurve = getAnimationCurve('decelerate');
    const animationDuration = getAnimationDuration('modal');

    // Get team info if available
    let teamName = 'My Team';
    let leagueInfoHTML = '';
    if (teamData && teamData.team) {
        teamName = teamData.team.name || 'My Team';
        const selectedLeagueId = localStorage.getItem(`fpl_selected_league_${teamData.team.id}`);
        if (selectedLeagueId && selectedLeagueId !== 'null') {
            leagueInfoHTML = `
                <div id="league-info-placeholder" data-team-id="${teamData.team.id}" data-league-id="${selectedLeagueId}" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
                    <div style="font-size: 9px; color: var(--text-secondary);">Loading league...</div>
                </div>
            `;
        }
    }

    const modalHTML = `
        <div id="manager-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            animation: fadeIn ${animationDuration} ${animationCurve};
        ">
            <div style="
                backdrop-filter: ${glassEffect.backdropFilter};
                -webkit-backdrop-filter: ${glassEffect.WebkitBackdropFilter};
                background: ${glassEffect.background};
                border: ${glassEffect.border};
                border-radius: ${radius};
                max-width: 400px;
                width: 100%;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: ${shadow};
                animation: slideUp ${animationDuration} ${animationCurve};
            ">
                <!-- Header -->
                <div style="
                    padding: 0.75rem 1rem;
                    border-bottom: ${glassEffect.border};
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                        ${escapeHtml(teamName)}
                    </div>
                    <button
                        id="close-manager-modal"
                        style="
                            background: transparent;
                            border: none;
                            font-size: 1.5rem;
                            color: var(--text-secondary);
                            cursor: pointer;
                            padding: 0;
                            width: 2rem;
                            height: 2rem;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        "
                    >
                        ×
                    </button>
                </div>
                
                <!-- Content -->
                <div style="padding: 1rem;">
                    ${leagueInfoHTML}
                    <button
                        id="manager-switch-team-btn"
                        style="
                            width: 100%;
                            padding: 0.75rem 1rem;
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            border-radius: ${radius};
                            font-size: 0.85rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all ${animationDuration} ${animationCurve};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 0.5rem;
                        "
                    >
                        <i class="fas fa-exchange-alt"></i>
                        Switch Team
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    attachManagerModalListeners();
    
    // Load league info if placeholder exists
    requestAnimationFrame(() => {
        const placeholder = document.getElementById('league-info-placeholder');
        if (placeholder) {
            loadAndRenderLeagueInfo();
        }
    });
}

/**
 * Attach event listeners to Manager Modal
 */
function attachManagerModalListeners() {
    const modal = document.getElementById('manager-modal');
    if (!modal) return;

    // Close button
    const closeBtn = document.getElementById('close-manager-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeManagerModal);
    }

    // Switch Team button
    const switchTeamBtn = document.getElementById('manager-switch-team-btn');
    if (switchTeamBtn) {
        switchTeamBtn.addEventListener('click', () => {
            closeManagerModal();
            if (window.resetMyTeam) {
                window.resetMyTeam();
            }
        });
    }

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'manager-modal') {
            closeManagerModal();
        }
    });
}

/**
 * Close Manager Modal with animation
 */
export function closeManagerModal() {
    const modal = document.getElementById('manager-modal');
    if (!modal) return;

    const animationCurve = getAnimationCurve('accelerate');
    const animationDuration = getAnimationDuration('modal');

    modal.style.animation = `fadeOut ${animationDuration} ${animationCurve}`;
    const content = modal.querySelector('div');
    if (content) {
        content.style.animation = `slideDown ${animationDuration} ${animationCurve}`;
    }

    setTimeout(() => {
        modal.remove();
    }, parseFloat(animationDuration));
}

// Expose globally
if (typeof window !== 'undefined') {
    window.showManagerModal = showManagerModal;
    window.closeManagerModal = closeManagerModal;
}

