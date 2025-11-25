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
 * Load AI insights for planner
 * Uses initial team snapshot only (not changes)
 */
export async function loadPlannerAIInsights() {
    const initialSquad = plannerState.getInitialSquad();
    const initialPicks = plannerState.getInitialPicks();
    
    if (!initialSquad || !initialPicks) {
        console.warn('Cannot load AI insights: no initial squad data');
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

    // Load and render insights
    await loadAndRenderInsights(context, 'planner-ai-insights', isMobile);
}

