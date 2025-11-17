/**
 * League Selector Modal
 * Bottom sheet for selecting a league to compare against
 */

/**
 * Get user's leagues from localStorage or fetch from API
 * @param {number} teamId - Team ID
 * @returns {Promise<Array>} Array of leagues
 */
export async function fetchUserLeagues(teamId) {
    try {
        const response = await fetch(`/api/entry/${teamId}/`);
        if (!response.ok) {
            throw new Error('Failed to fetch team data');
        }

        const data = await response.json();

        // Extract classic leagues only (not head-to-head)
        const leagues = data.leagues?.classic || [];

        // Store in localStorage for quick access
        localStorage.setItem(`fpl_leagues_${teamId}`, JSON.stringify(leagues));

        return leagues;
    } catch (error) {
        console.error('Error fetching leagues:', error);

        // Try to get from cache
        const cached = localStorage.getItem(`fpl_leagues_${teamId}`);
        if (cached) {
            return JSON.parse(cached);
        }

        return [];
    }
}

/**
 * Get currently selected league ID
 * @param {number} teamId - Team ID
 * @returns {number|null} Selected league ID or null
 */
export function getSelectedLeagueId(teamId) {
    const stored = localStorage.getItem(`fpl_selected_league_${teamId}`);
    return stored ? parseInt(stored, 10) : null;
}

/**
 * Set selected league ID
 * @param {number} teamId - Team ID
 * @param {number} leagueId - League ID to select
 */
export function setSelectedLeagueId(teamId, leagueId) {
    localStorage.setItem(`fpl_selected_league_${teamId}`, leagueId.toString());
}

/**
 * Create league selector modal HTML
 * @param {Array} leagues - Array of leagues
 * @param {number} selectedLeagueId - Currently selected league ID
 * @returns {string} HTML for modal
 */
function createLeagueModal(leagues, selectedLeagueId) {
    return `
        <div
            id="league-modal-overlay"
            style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 2000;
                display: flex;
                align-items: flex-end;
                animation: fadeIn 0.2s ease;
            "
        >
            <div
                id="league-modal-content"
                style="
                    background: var(--bg-primary);
                    border-radius: 1rem 1rem 0 0;
                    width: 100%;
                    max-height: 70vh;
                    overflow-y: auto;
                    padding: 1rem;
                    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
                    animation: slideUp 0.3s ease;
                "
            >
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">
                        <i class="fas fa-trophy" style="color: #00ff87; margin-right: 0.5rem;"></i>
                        Select League
                    </h3>
                    <button
                        id="close-league-modal"
                        style="
                            background: transparent;
                            border: none;
                            color: var(--text-secondary);
                            font-size: 1.5rem;
                            cursor: pointer;
                            padding: 0;
                            line-height: 1;
                        "
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- No Selection Option -->
                <button
                    class="league-option"
                    data-league-id="null"
                    style="
                        width: 100%;
                        padding: 0.75rem;
                        margin-bottom: 0.5rem;
                        background: ${selectedLeagueId === null ? 'rgba(0, 255, 135, 0.1)' : 'var(--bg-secondary)'};
                        border: ${selectedLeagueId === null ? '2px solid #00ff87' : '1px solid var(--border-color)'};
                        border-radius: 0.5rem;
                        text-align: left;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    "
                >
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">
                            No League (Overall)
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            Compare against all FPL managers
                        </div>
                    </div>
                    ${selectedLeagueId === null ? '<i class="fas fa-check" style="color: #00ff87; font-size: 1.2rem;"></i>' : ''}
                </button>

                <!-- League Options -->
                ${leagues.map(league => `
                    <button
                        class="league-option"
                        data-league-id="${league.id}"
                        style="
                            width: 100%;
                            padding: 0.75rem;
                            margin-bottom: 0.5rem;
                            background: ${selectedLeagueId === league.id ? 'rgba(0, 255, 135, 0.1)' : 'var(--bg-secondary)'};
                            border: ${selectedLeagueId === league.id ? '2px solid #00ff87' : '1px solid var(--border-color)'};
                            border-radius: 0.5rem;
                            text-align: left;
                            cursor: pointer;
                            transition: all 0.2s;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        "
                    >
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">
                                ${escapeHtml(league.name)}
                            </div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                ${league.entry_rank ? `Rank: ${league.entry_rank.toLocaleString()}` : 'Not yet ranked'}
                            </div>
                        </div>
                        ${selectedLeagueId === league.id ? '<i class="fas fa-check" style="color: #00ff87; font-size: 1.2rem;"></i>' : ''}
                    </button>
                `).join('')}
            </div>
        </div>

        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }

            .league-option:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .league-option:active {
                transform: translateY(0);
            }
        </style>
    `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show league selector modal
 * @param {number} teamId - Team ID
 * @param {function} onLeagueSelected - Callback when league is selected
 */
export async function showLeagueSelector(teamId, onLeagueSelected) {
    // Fetch leagues
    const leagues = await fetchUserLeagues(teamId);
    const selectedLeagueId = getSelectedLeagueId(teamId);

    // Create modal
    const modalHtml = createLeagueModal(leagues, selectedLeagueId);

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Get modal elements
    const overlay = document.getElementById('league-modal-overlay');
    const closeBtn = document.getElementById('close-league-modal');
    const leagueOptions = document.querySelectorAll('.league-option');

    // Close modal function
    const closeModal = () => {
        overlay.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => {
            overlay.remove();
        }, 200);
    };

    // Close button
    closeBtn.addEventListener('click', closeModal);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    // League selection
    leagueOptions.forEach(option => {
        option.addEventListener('click', () => {
            const leagueId = option.dataset.leagueId;

            if (leagueId === 'null') {
                // Clear selection
                localStorage.removeItem(`fpl_selected_league_${teamId}`);
                console.log('✅ Cleared league selection');
            } else {
                // Set selection
                setSelectedLeagueId(teamId, parseInt(leagueId, 10));
                console.log('✅ Selected league:', leagueId);
            }

            closeModal();

            // Callback
            if (onLeagueSelected) {
                onLeagueSelected(leagueId === 'null' ? null : parseInt(leagueId, 10));
            }
        });
    });

    // Add fadeOut animation to styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
