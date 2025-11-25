/**
 * AI Insights for Planner
 * Loads AI insights based on initial team snapshot (not changes)
 */

import { aiInsights } from '../aiInsights.js';
import { plannerState } from './state.js';
import { currentGW } from '../data.js';
import { getAllPlayers } from '../data.js';
import { calculateSquadAverages } from '../myTeam/teamSummaryHelpers.js';
import { analyzePlayerRisks, hasHighRisk, hasMediumRisk } from '../risk.js';
import { getTeamsWithBestFixtures, getTeamsWithWorstFixtures } from '../fixtures.js';
import { calculatePPM } from '../utils.js';

/**
 * Load AI insights for planner
 * Uses initial team snapshot only (not changes)
 */
export async function loadPlannerAIInsights() {
    const container = document.getElementById('planner-ai-insights');
    if (!container) {
        return;
    }

    const initialSquad = plannerState.getInitialSquad();
    const initialPicks = plannerState.getInitialPicks();
    
    if (!initialSquad || !initialPicks) {
        container.innerHTML = renderPlannerInsightsError('No team snapshot available yet.');
        return;
    }

    const allPlayers = getAllPlayers();
    const players = initialPicks
        .map(pick => allPlayers.find(p => p.id === pick.element))
        .filter(p => p !== undefined);

    if (players.length === 0) {
        return;
    }

    // Calculate team metrics
    const squadAverages = calculateSquadAverages(initialPicks, currentGW);

    // Find problem players
    const problemPlayers = [];
    players.forEach(player => {
        const risks = analyzePlayerRisks(player);
        if (hasHighRisk(risks) || hasMediumRisk(risks)) {
            problemPlayers.push({
                name: player.web_name,
                position: player.element_type,
                risks: risks.map(r => r.type),
                severity: hasHighRisk(risks) ? 'high' : 'medium'
            });
        }
    });

    // Count risks
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;

    players.forEach(player => {
        const risks = analyzePlayerRisks(player);
        if (hasHighRisk(risks)) {
            highRiskCount++;
        } else if (hasMediumRisk(risks)) {
            mediumRiskCount++;
        } else if (risks.length > 0) {
            lowRiskCount++;
        }
    });

    // Get team fixture analysis
    const teamsWithBestFixtures = getTeamsWithBestFixtures(10, 5);
    const teamsWithWorstFixtures = getTeamsWithWorstFixtures(10, 5);

    // Prepare context data for AI
    const contextData = {
        currentSquad: players.map(p => ({
            name: p.web_name,
            position: p.element_type,
            points: p.total_points,
            form: parseFloat(p.form) || 0,
            ppm: calculatePPM(p),
            ownership: parseFloat(p.selected_by_percent) || 0,
            price: p.now_cost / 10
        })),
        teamMetrics: {
            avgPPM: squadAverages.avgPPM,
            avgFDR: squadAverages.avgFDR,
            avgOwnership: squadAverages.avgOwnership,
            avgMinPercent: squadAverages.avgMinPercent
        },
        problemPlayers,
        riskCount: {
            high: highRiskCount,
            medium: mediumRiskCount,
            low: lowRiskCount
        },
        teamAnalysis: {
            bestFixtures: teamsWithBestFixtures,
            worstFixtures: teamsWithWorstFixtures,
            currentGW
        }
    };

    // Build context for AI service
    const context = {
        page: 'planner',
        tab: 'sandbox',
        position: 'all',
        gameweek: currentGW,
        data: contextData
    };

    // Check if mobile
    const isMobile = window.innerWidth <= 767;

    // Show loading state
    container.innerHTML = renderPlannerInsightsLoading();

    try {
        const insights = await aiInsights.getInsights(context);
        container.innerHTML = renderPlannerInsights(insights, isMobile);
    } catch (error) {
        console.error('Failed to load planner AI insights:', error);
        container.innerHTML = renderPlannerInsightsError('Unable to load AI guidance right now.');
    }
}

function renderPlannerInsights(insights, isMobile) {
    const items = (insights?.plannerInsights && insights.plannerInsights.length > 0)
        ? insights.plannerInsights
        : (insights?.categories?.Overview || []);

    return `
        <div style="
            background: var(--bg-primary);
            border: 2px solid var(--accent-color);
            border-radius: 12px;
            padding: ${isMobile ? '0.75rem' : '1rem'};
            margin-bottom: 1rem;
            box-shadow: 0 4px 12px var(--shadow);
        ">
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
                gap: 0.5rem;
            ">
                <h3 style="
                    color: var(--accent-color);
                    font-weight: 700;
                    font-size: ${isMobile ? '0.9rem' : '1rem'};
                    margin: 0;
                ">
                    🤖 Planner Insights
                </h3>
                <span style="
                    font-size: 0.65rem;
                    color: var(--text-secondary);
                ">
                    Snapshot guidance (initial team)
                </span>
            </div>
            <ul style="
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: 0.6rem;
            ">
                ${items.map(item => `
                    <li style="
                        padding: 0.6rem 0.7rem;
                        background: var(--bg-secondary);
                        border-radius: 8px;
                        font-size: ${isMobile ? '0.8rem' : '0.9rem'};
                        line-height: 1.4;
                        color: var(--text-primary);
                        border-left: 3px solid var(--accent-color);
                    ">
                        ${item}
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

function renderPlannerInsightsLoading() {
    return `
        <div style="
            background: var(--bg-primary);
            border: 2px solid var(--border-color);
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1rem;
            text-align: center;
        ">
            <i class="fas fa-spinner fa-spin" style="color: var(--accent-color);"></i>
            <span style="margin-left: 0.5rem; color: var(--text-secondary);">
                Generating planner guidance...
            </span>
        </div>
    `;
}

function renderPlannerInsightsError(message) {
    return `
        <div style="
            background: var(--bg-primary);
            border: 2px solid #fb923c;
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1rem;
            color: #fb923c;
            font-size: 0.85rem;
            text-align: center;
        ">
            ${message}
        </div>
    `;
}

