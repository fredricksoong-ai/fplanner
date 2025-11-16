# Charts Refactoring Guide

## ✅ REFACTORING COMPLETE! (8/8 charts)

### All Charts Modularized
- ✅ **Points vs Price** → `charts/pointsVsPrice.js` (366 lines)
- ✅ **Form vs Price** → `charts/formVsPrice.js` (267 lines)
- ✅ **Ownership vs Form** → `charts/ownershipVsForm.js` (266 lines)
- ✅ **Fixtures vs Form** → `charts/fixturesVsForm.js` (358 lines)
- ✅ **xGI vs Actual** → `charts/xgiVsActual.js` (189 lines)
- ✅ **xGC vs Actual** → `charts/xgcVsActual.js` (178 lines)
- ✅ **ICT vs Points** → `charts/ictVsPoints.js` (258 lines)
- ✅ **Minutes Efficiency** → `charts/minutesEfficiency.js` (315 lines)
- ✅ **Common utilities** → `charts/chartHelpers.js` (68 lines)

### Results
- **Before**: `renderCharts.js` was 3,268 lines
- **After**: `renderCharts.js` is 288 lines (91% reduction!)
- **All 166 tests passing**

---

## 📐 Extraction Pattern

Each chart follows this template:

```javascript
/**
 * [Chart Name] Chart Module
 * [Brief description]
 */

import { getAllPlayers } from '../data.js';
import { getPositionShort, calculatePPM, escapeHtml } from '../utils.js';
import { createChartCard, setupChartExport, filterPlayersByPosition } from './chartHelpers.js';

/**
 * Render [Chart Name] chart
 * @param {HTMLElement} contentContainer - Container element
 * @param {Object} echarts - ECharts instance
 * @param {string} positionFilter - Position filter
 * @returns {Object} Chart instance
 */
export async function render[ChartName]Chart(contentContainer, echarts, positionFilter) {
    if (!contentContainer) return null;

    // 1. Create chart card HTML
    contentContainer.innerHTML = createChartCard({
        title: '[Chart Title]',
        icon: '[Icon]',
        description: '[Description]',
        zones: [/* zone definitions */],
        chartId: '[chart-id]'
    });

    // 2. Wait for DOM
    await new Promise(resolve => setTimeout(resolve, 0));
    const chartContainer = document.getElementById('[chart-id]');
    if (!chartContainer) return null;

    // 3. Get theme colors
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    // 4. Get and filter players
    let players = getAllPlayers();
    players = filterPlayersByPosition(players, positionFilter);
    players = players.filter(p => /* chart-specific filter */);

    // 5. Get user's team
    const myTeamPlayerIds = getUserTeamPlayerIds();

    // 6. Prepare data by position
    const positions = {
        'GKP': { data: [], color: '#fbbf24', name: 'Goalkeepers' },
        'DEF': { data: [], color: '#3b82f6', name: 'Defenders' },
        'MID': { data: [], color: '#10b981', name: 'Midfielders' },
        'FWD': { data: [], color: '#ef4444', name: 'Forwards' }
    };

    // 7. Process players into series data
    players.forEach(player => {
        // Extract relevant metrics
        // Add to positions[position].data
    });

    // 8. Create chart options
    const option = create[ChartName]ChartOptions(
        positions,
        isDark,
        textColor,
        gridColor
    );

    // 9. Initialize chart
    if (!echarts) return null;
    const chartInstance = echarts.init(chartContainer);
    if (!chartInstance) return null;

    // 10. Set options and return
    try {
        chartInstance.setOption(option);
    } catch (error) {
        console.error('Error setting chart options:', error);
        return null;
    }

    // 11. Setup export and resize
    setupChartExport(chartInstance);
    const resizeHandler = () => chartInstance?.resize();
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    return chartInstance;
}

// Helper function for user team IDs (reuse across charts)
function getUserTeamPlayerIds() {
    const myTeamPlayerIds = new Set();
    const cachedTeamId = localStorage.getItem('fplanner_team_id');
    if (cachedTeamId) {
        const cachedTeamData = localStorage.getItem(`fplanner_team_${cachedTeamId}`);
        if (cachedTeamData) {
            try {
                const teamData = JSON.parse(cachedTeamData);
                if (teamData?.picks?.picks) {
                    return new Set(teamData.picks.picks.map(p => p.element));
                }
            } catch (e) {}
        }
    }
    return myTeamPlayerIds;
}

// Chart-specific option builder
function create[ChartName]ChartOptions(...) {
    // Return ECharts option object
}
```

---

## 🔧 Integration Steps

### 1. Create New Chart Module

Copy the old chart function from `renderCharts.js` lines [start]-[end]

### 2. Extract to New File

```bash
# Create file
touch frontend/src/charts/[chartName].js

# Add imports and structure
# Follow the template above
```

### 3. Update renderCharts.js

```javascript
// Add import
import { render[ChartName]Chart } from './charts/[chartName].js';

// Update switch statement in renderCurrentChart()
case '[chart-type]':
    currentChart = await render[ChartName]Chart(contentContainer, echarts, currentPositionFilter);
    break;
```

### 4. Test

```bash
cd frontend
npm run test:run
# All 166 tests should pass
```

### 5. Commit

```bash
git add -A
git commit -m "refactor: extract [ChartName] chart module"
git push
```

---

## 🎯 Specific Chart Details

### Form vs Price (`formVsPrice.js`)
- **Location**: Lines 726-975
- **Metrics**: Price (X), Form (Y), Ownership (bubble size)
- **Zones**: Hot Form Value, Premium Form, Cold Trap
- **Chart ID**: `form-price-chart`

### Ownership vs Form (`ownershipVsForm.js`)
- **Location**: Lines 1596-1939
- **Metrics**: Ownership (X), Form (Y), PPM (bubble size)
- **Zones**: Differential picks, Popular picks
- **Chart ID**: `ownership-form-chart`

### Fixtures vs Form (`fixturesVsForm.js`)
- **Location**: Lines 1940-2304
- **Metrics**: FDR (X), Form (Y), Ownership (bubble size)
- **Zones**: Good fixtures + form, avoid zones
- **Chart ID**: `fdr-form-chart`
- **Special**: Uses `calculateFixtureDifficulty()`

### xGI vs Actual (`xgiVsActual.js`)
- **Location**: Lines 1292-1595
- **Metrics**: xGI (X), Actual G+A (Y), Minutes (bubble size)
- **Zones**: Overperforming, underperforming
- **Chart ID**: `xgi-actual-chart`
- **Special**: Only forwards and midfielders

### xGC vs Actual (`xgcVsActual.js`)
- **Location**: Lines 2305-2599
- **Metrics**: xGC (X), Actual conceded (Y)
- **Zones**: Strong defense, weak defense
- **Chart ID**: `xgc-actual-chart`
- **Special**: Only goalkeepers and defenders

### ICT vs Points (`ictVsPoints.js`)
- **Location**: Lines 2600-2888
- **Metrics**: ICT Index (X), Points (Y)
- **Chart ID**: `ict-points-chart`

### Minutes Efficiency (`minutesEfficiency.js`)
- **Location**: Lines 946-1291
- **Metrics**: Minutes (X), Points per 90 (Y)
- **Chart ID**: `minutes-efficiency-chart`
- **Special**: PP90 calculation

---

## ✅ Testing Checklist

After each extraction:
- [ ] npm run test:run passes
- [ ] Chart renders in browser
- [ ] Position filters work
- [ ] Chart type switching works
- [ ] Export button works
- [ ] Responsive resize works
- [ ] Dark mode works

---

## 📊 Expected Results

### Before Refactoring
```
renderCharts.js: 3,203 lines
```

### After Full Refactoring
```
renderCharts.js: ~800 lines (75% reduction)
charts/
├── chartHelpers.js: ~150 lines
├── pointsVsPrice.js: ~350 lines
├── formVsPrice.js: ~220 lines
├── ownershipVsForm.js: ~340 lines
├── fixturesVsForm.js: ~365 lines
├── xgiVsActual.js: ~304 lines
├── xgcVsActual.js: ~295 lines
├── ictVsPoints.js: ~289 lines
└── minutesEfficiency.js: ~346 lines
```

**Total**: Same functionality, much better organization!

---

## 🚀 Quick Completion Script

To finish all remaining charts quickly:

```bash
# Run this from frontend/src directory
for chart in formVsPrice ownershipVsForm fixturesVsForm xgiVsActual xgcVsActual ictVsPoints minutesEfficiency; do
    echo "Extracting $chart..."
    # 1. Copy function from renderCharts.js
    # 2. Create charts/$chart.js
    # 3. Update imports and switch statement
    # 4. Test: npm run test:run
    # 5. Commit: git commit -m "refactor: extract $chart chart"
done
```

---

## 💡 Benefits of This Refactoring

1. **Maintainability**: Each chart is independently maintained
2. **Testability**: Can unit test individual charts
3. **Performance**: Can lazy-load charts on demand
4. **Readability**: ~300 lines per file vs 3,203 lines
5. **Collaboration**: Multiple devs can work on different charts
6. **Debugging**: Easier to find and fix chart-specific issues

---

This refactoring is **safe** because:
- ✅ 190+ tests protect against regressions
- ✅ Incremental approach (test after each extraction)
- ✅ No functionality changes
- ✅ Backward compatible during migration
