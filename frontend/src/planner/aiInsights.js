/**
 * AI Insights for Planner
 * Loads AI insights based on initial team snapshot (not changes)
 */

import { loadAndRenderInsights } from '../renderInsightBanner.js';
import { plannerState } from './state.js';
import { currentGW } from '../data.js';
import { getAllPlayers } from '../data.js';
import { calculateSquadAverages } from '../myTeam/teamSummaryHelpers.js';
import { analyzePlayerRisks, hasHighRisk, hasMediumRisk } from '../risk.js';
import { getTeamsWithBestFixtures, getTeamsWithWorstFixtures } from '../fixtures.js';
import { calculatePPM } from '../utils.js';

/**
 * Load AI insights for planner using shared banner pipeline
 */
export async function loadPlannerAIInsights() {
    const container = document.getElementById('planner-ai-insights');
    if (!container) return;

    if (!plannerState.isInitialized()) {
        container.innerHTML = `
            <div style="
                background: var(--bg-primary);
                border: 2px solid #fb923c;
                border-radius: 12px;
                padding: 0.75rem;
                margin-bottom: 1rem;
                text-align: center;
                color: #fb923c;
                font-size: 0.8rem;
            ">
                Load your team to generate planner insights.
            </div>
        `;
        return;
    }

    const initialPicks = plannerState.getInitialPicks();
    const allPlayers = getAllPlayers();
    const players = initialPicks
        .map(pick => allPlayers.find(p => p.id === pick.element))
        .filter(Boolean);

    const squadAverages = calculateSquadAverages(initialPicks, currentGW);

    const problemPlayers = [];
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;

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

        if (hasHighRisk(risks)) highRiskCount++;
        else if (hasMediumRisk(risks)) mediumRiskCount++;
        else if (risks.length > 0) lowRiskCount++;
    });

    const signature = safeBasePicks
        .map(pick => pick.element)
        .sort((a, b) => a - b)
        .join('-') || 'none';

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
            bestFixtures: getTeamsWithBestFixtures(10, 5),
            worstFixtures: getTeamsWithWorstFixtures(10, 5),
            currentGW
        }
    };

    const context = {
        page: 'planner',
        tab: 'sandbox',
        position: `all-${signature}`,
        gameweek: currentGW,
        data: contextData
    };

    const isMobile = window.innerWidth <= 767;

    await loadAndRenderInsights(context, 'planner-ai-insights', isMobile, {
        hideTabs: true,
        customTitle: '🤖 Planner Insights',
        customSubtitle: 'Snapshot guidance at GW ' + currentGW,
        preferredCategory: 'Planner'
    });
}

