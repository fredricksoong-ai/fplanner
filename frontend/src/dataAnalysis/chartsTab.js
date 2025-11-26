import { loadECharts } from '../charts/chartHelpers.js';

const CHART_DEFINITIONS = [
    {
        key: 'points-price',
        title: 'Points vs Price',
        loader: async () => (await import('../charts/pointsVsPrice.js')).renderPointsPriceChart
    },
    {
        key: 'minutes-efficiency',
        title: 'Minutes Efficiency',
        loader: async () => (await import('../charts/minutesEfficiency.js')).renderMinutesEfficiencyChart
    },
    {
        key: 'form-price',
        title: 'Form vs Price',
        loader: async () => (await import('../charts/formVsPrice.js')).renderFormVsPriceChart
    },
    {
        key: 'ownership-form',
        title: 'Ownership vs Form',
        loader: async () => (await import('../charts/ownershipVsForm.js')).renderOwnershipVsFormChart
    },
    {
        key: 'ict-points',
        title: 'ICT Index vs Points',
        loader: async () => (await import('../charts/ictVsPoints.js')).renderIctVsPointsChart
    },
    {
        key: 'fixtures-form',
        title: 'Fixture Difficulty vs Form',
        loader: async () => (await import('../charts/fixturesVsForm.js')).renderFixturesVsFormChart
    },
    {
        key: 'xgi-actual',
        title: 'xGI vs Actual G+A',
        loader: async () => (await import('../charts/xgiVsActual.js')).renderXgiVsActualChart
    },
    {
        key: 'xgc-actual',
        title: 'xGC vs Actual Conceded',
        loader: async () => (await import('../charts/xgcVsActual.js')).renderXgcVsActualChart
    }
];

export function renderChartsSkeleton(position = 'all') {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
    return `
        <div style="margin-bottom: 1.5rem;">
            <div style="background: var(--bg-secondary); border-radius: 12px; padding: 1rem;">
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">
                    Charts focus on the top 50 players (by form or points) for smoother performance${position !== 'all' ? ` in the <strong>${position}</strong> category` : ''}.
                </p>
            </div>
        </div>
        ${CHART_DEFINITIONS.map(chart => `
            <section style="margin-bottom: 1.5rem;">
                <div
                    id="${chart.key}-chart-wrapper"
                    style="
                        min-height: ${isMobile ? '320px' : '420px'};
                        background: var(--bg-secondary);
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--text-secondary);
                    "
                >
                    <div style="text-align: center; padding: 1rem;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 1.25rem; margin-bottom: 0.5rem;"></i>
                        <div style="font-size: 0.8rem;">Loading ${chart.title}...</div>
                    </div>
                </div>
            </section>
        `).join('')}
    `;
}

export async function initializeChartsTab(position = 'all') {
    const echarts = await loadECharts();

    for (const chart of CHART_DEFINITIONS) {
        const container = document.getElementById(`${chart.key}-chart-wrapper`);
        if (!container) continue;

        try {
            const renderFn = await chart.loader();
            await renderFn(container, echarts, position);
        } catch (error) {
            console.error(`Failed to render chart ${chart.key}:`, error);
            container.innerHTML = `
                <div style="padding: 1rem; color: var(--text-secondary); text-align: center;">
                    Unable to load ${chart.title}. Please try again later.
                </div>
            `;
        }
    }
}

