Complete Data Visualization Implementation Plan
Overview
Build a comprehensive "Charts" page with interactive visualizations using Apache ECharts, PLUS special analysis tools to test the defensive contribution theory.
Part A: General Data Visualization (Original Request)
Phase 1: Foundation & Core Charts (Week 1)
1.1 Setup & Dependencies
Install Apache ECharts: npm install echarts
Create frontend/src/charts.js - Main charts module
Create frontend/src/charts/ folder for individual chart implementations
1.2 Navigation & Layout
Update frontend/src/main.js: Add "Charts" nav item (icon: fa-chart-line)
Add route handler for #visualizations
Create CSS grid layout for responsive chart cards
Dark mode theme integration using CSS variables
1.3 Priority Chart #1: Points vs Price Scatter ⭐
File: frontend/src/charts/scatterPoints.js Features:
X-axis: Price (£m), Y-axis: Total Points
Symbol size: Based on ownership %
Symbol color: By position (GKP=yellow, DEF=blue, MID=green, FWD=red)
Background zones:
Premium Zone (£9m+, 80+ pts): Dark green
Value Zone (£5-9m, 40-80 pts): Light green
Budget Zone (<£5m, <40 pts): Yellow
Trap Zone (High price, low points): Red
Interactive tooltip: Player stats, PPM, form, fixtures, risks
Position filter buttons (All/GKP/DEF/MID/FWD)
Highlight top 10 players with name labels
1.4 Chart #2: Form vs Ownership Scatter
File: frontend/src/charts/scatterForm.js Features:
Quadrant visualization:
Top-left (high form, low own): GREEN - Prime differentials
Top-right (high form, high own): BLUE - Template picks
Bottom-left (poor form, low own): GRAY - Avoid
Bottom-right (poor form, high own): RED - Sell candidates
Symbol size by total points
Color by price (gradient)
Phase 2: Advanced Charts (Week 2)
2.1 Chart #3: Expected vs Actual Performance
File: frontend/src/charts/scatterXG.js
Diagonal reference line (perfect xG match)
Above line: Overperforming (hot streak)
Below line: Underperforming (due a return)
Filter: MID/FWD only
2.2 Chart #4: Points Per 90 Bar Chart
File: frontend/src/charts/barPP90.js
Grouped by position (GKP, DEF, MID, FWD)
Top 10 per position
Color by PPM heatmap
2.3 Chart #5: Fixture Difficulty Heatmap
File: frontend/src/charts/heatmapFixtures.js
20 teams × 8 gameweeks matrix
FDR color coding (1=green → 5=red)
Show opponent abbreviations in cells
Identify blank/double gameweeks
Phase 3: Comparison & Analysis (Week 3)
3.1 Chart #6: Player Comparison Radar
File: frontend/src/charts/radarComparison.js
Compare up to 5 players across 8 metrics:
Total Points, Form, PPM, PP90, Minutes %
xGI/90, FDR (next 5), Ownership %
Interactive player selection
Semi-transparent overlays
3.2 Chart #7: Price Change Timeline
File: frontend/src/charts/linePrice.js
Track weekly price changes for selected players
Markers on price change events
Color: Green (rising), Red (falling)
3.3 Chart #8: Team Distribution Donut
File: frontend/src/charts/donutTeams.js
Segments: Each Premier League team
Value: Total points from user's squad players
Inner ring: Player count per team
Part B: Defensive Contribution Theory Analysis (New Request)
Theory to Test
Hypothesis: Defensive contribution points are EASIER to earn when playing against MORE ATTACKING opponents (higher FDR)
Critical Finding
Current data CANNOT definitively test this theory - requires historical GW-by-GW tracking
Phase 4: Immediate Implementation - Defensive Potential Tool (1-2 days)
4.1 Chart #9: Defensive Potential Targets Table ⚔️
Purpose: Actionable tool to identify defenders facing tough fixtures File: frontend/src/render.js (add to Data Analysis page) What It Shows: Enhanced table showing DEF/MID/FWD players sorted by upcoming fixture difficulty Columns:
Player, Team, Position, Price
Def/90 (current season rate)
Avg FDR (next 5 GWs)
Fixture icons (next 5 with color-coded difficulty)
"Potential" indicator:
⚔️ HARD FIXTURES (FDR ≥ 3.5) - Theory suggests higher def con potential
✓ EASY FIXTURES (FDR ≤ 2.5) - Theory suggests lower def con potential
Filters:
Position: DEF/MID/FWD toggle
Min% threshold: >40% (regular starters only)
FDR threshold slider: Show players facing FDR ≥ X
Sort Options:
Avg FDR DESC (hardest fixtures first) - DEFAULT
Current Def/90 DESC (best performers first)
Price ASC (budget options first)
Data Requirements:
Uses EXISTING functions: calculateFixtureDifficulty(), getFixtures()
No new API calls needed
No new dependencies
User Value:
Immediately actionable for transfers
Users can manually observe over coming weeks
Validates theory through real-world testing
Implementation:
// Add to renderDataAnalysis() in render.js
function renderDefensiveTargets(position = 'all') {
    const players = getAllPlayers()
        .filter(p => {
            // DEF/MID/FWD only (no GKPs)
            if (p.element_type === 1) return false;
            // Position filter
            if (position !== 'all' && getPositionShort(p) !== position) return false;
            // Regular starters only
            return calculateMinutesPercentage(p, currentGW) > 40;
        })
        .map(p => {
            const avgFDR = calculateFixtureDifficulty(p.team, 5);
            const defCon90 = p.github_season?.defensive_contribution_per_90 || 0;
            return { ...p, avgFDR, defCon90 };
        })
        .sort((a, b) => b.avgFDR - a.avgFDR); // Hardest fixtures first
    
    // Render table with ⚔️ icon for FDR ≥ 3.5
}
Phase 5: Long-Term Solution - Historical Tracking System (3-4 weeks)
5.1 Backend Database Layer
Purpose: Store GW-by-GW data to enable statistical analysis New Files:
backend/db/schema.js - Database schema definition
backend/db/queries.js - Query functions
backend/data/player_history.db - SQLite database
Dependencies:
Install SQLite: npm install better-sqlite3
Schema:
CREATE TABLE player_gameweek_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  gameweek INTEGER NOT NULL,
  defensive_contribution REAL,
  minutes INTEGER,
  total_points INTEGER,
  opponent_team_id INTEGER,
  opponent_fdr INTEGER,
  is_home BOOLEAN,
  fixture_id INTEGER,
  timestamp TEXT,
  UNIQUE(player_id, gameweek)
);

CREATE INDEX idx_player_gw ON player_gameweek_history(player_id, gameweek);
CREATE INDEX idx_gw ON player_gameweek_history(gameweek);
5.2 Backend Data Persistence
File: backend/server.js modifications Auto-persist after each GW finishes:
// Add scheduled task or manual trigger
async function saveCurrentGW() {
    const github = await fetchGithubData();
    if (!github.currentGWStats) return;
    
    const db = require('./db/queries');
    
    github.currentGWStats.forEach(player => {
        db.insertGWHistory({
            player_id: player.id,
            gameweek: github.currentGW,
            defensive_contribution: player.defensive_contribution,
            minutes: player.minutes,
            total_points: player.total_points,
            // ... opponent data from fixtures API
        });
    });
    
    console.log(`✅ Saved GW${github.currentGW} to database`);
}
New API Endpoint:
// GET /api/player-history/:playerId?gws=10
app.get('/api/player-history/:playerId', (req, res) => {
    const { playerId } = req.params;
    const gws = parseInt(req.query.gws) || 10;
    
    const history = db.getPlayerHistory(playerId, gws);
    res.json(history);
});
5.3 Frontend Historical Analysis Page
After 5-10 GWs of data collected New File: frontend/src/charts/historicalDefCon.js Chart Type: Multi-line time series Features:
X-axis: Last 10 gameweeks
Y-axis (left): Defensive contribution
Y-axis (right): Opponent FDR (overlay)
Multiple lines: 5-6 selected players
Visual test: Do def con peaks align with harder fixtures?
Player Selection:
Dropdown to select players
"Auto-select top def con players" button
Color-coded lines by position
Statistical Overlay:
Correlation coefficient display
Trend line
Significance indicator (p-value)
Phase 6: Statistical Analysis Tools (After data collection)
6.1 Chart #10: Def Con vs FDR Scatter Plot
File: frontend/src/charts/scatterDefConFDR.js Data Points:
Each point = One player's match
X-axis: Opponent FDR (1-5)
Y-axis: Defensive contribution in that match
Symbol size: Minutes played
Color: By position
Statistical Features:
Trend line with equation
Correlation coefficient (r)
P-value for significance
95% confidence interval shading
Hypothesis Test:
Positive correlation (r > 0.3) = Theory supported
No correlation (r ≈ 0) = Theory unsupported
6.2 Chart #11: Box Plot - Def Con by FDR Category
File: frontend/src/charts/boxPlotDefCon.js Categories:
FDR 1-2 (Easy opponents)
FDR 2-3 (Medium)
FDR 3-4 (Hard)
FDR 4-5 (Very hard)
Box Plot Elements:
Quartiles (25th, 50th, 75th percentile)
Whiskers (min/max)
Outliers (individual points)
Expected Pattern (if theory true):
Median increases from left to right
FDR 4-5 has highest median def con
6.3 Statistical Test Dashboard
File: frontend/src/charts/statsTests.js Tests Performed:
Linear Regression:
defensive_contribution ~ opponent_fdr + position + minutes
Display coefficient for opponent_fdr
Show if statistically significant (p < 0.05)
Paired T-Test:
For each player: avg def con vs easy opponents vs hard opponents
Display t-statistic and p-value
ANOVA:
Compare means across FDR categories (1, 2, 3, 4, 5)
Display F-statistic and p-value
Results Display:
📊 Statistical Analysis Results

Hypothesis: Defensive contribution increases vs harder opponents

✅ Linear Regression: β = +0.23 (p = 0.001) - SIGNIFICANT
   Interpretation: Each +1 FDR increases def con by 0.23 on average

✅ Paired T-Test: t = 3.45 (p = 0.002) - SIGNIFICANT
   Interpretation: Players average 0.35 more def con vs FDR 4-5 than FDR 1-2

✅ ANOVA: F = 8.12 (p < 0.001) - SIGNIFICANT
   Interpretation: Def con differs significantly across FDR categories

CONCLUSION: Theory SUPPORTED with high confidence
Timeline & Priorities
Immediate (This Week)
Must Build:
Chart #1: Points vs Price scatter ⭐ (User's original request)
Chart #9: Defensive Potential Targets ⚔️ (Theory application)
Basic chart infrastructure (ECharts setup, navigation, theming)
Short-Term (Weeks 2-3)
Should Build: 4. Chart #2: Form vs Ownership 5. Chart #5: Fixture Difficulty Heatmap 6. Chart #4: Points Per 90 Bars 7. Backend historical tracking system (start collecting data)
Medium-Term (Week 4+)
Nice to Have: 8. Chart #3: xG scatter 9. Chart #6: Radar comparison 10. Chart #7: Price timeline 11. Chart #8: Team donut
Long-Term (After 5-10 GWs)
Validation Phase: 12. Chart #10: Def Con vs FDR scatter (with historical data) 13. Chart #11: Box plot analysis 14. Statistical test dashboard 15. Publication of findings
Technical Implementation Summary
Dependencies to Install
npm install echarts          # ~300KB - Main charting library
npm install better-sqlite3   # ~2MB - Database for historical tracking
New Files to Create
frontend/src/
├── charts.js                    # Main charts module
├── charts/
│   ├── scatterPoints.js         # Chart #1 ⭐
│   ├── scatterForm.js           # Chart #2
│   ├── scatterXG.js             # Chart #3
│   ├── barPP90.js               # Chart #4
│   ├── heatmapFixtures.js       # Chart #5
│   ├── radarComparison.js       # Chart #6
│   ├── linePrice.js             # Chart #7
│   ├── donutTeams.js            # Chart #8
│   ├── historicalDefCon.js      # Chart #10 (future)
│   ├── scatterDefConFDR.js      # Chart #11 (future)
│   ├── boxPlotDefCon.js         # Chart #12 (future)
│   └── statsTests.js            # Statistical dashboard (future)

backend/
├── db/
│   ├── schema.js                # Database schema
│   ├── queries.js               # Query functions
│   └── player_history.db        # SQLite database
└── server.js                    # MODIFY: Add persistence logic
Files to Modify
frontend/src/
├── main.js                      # Add "Charts" navigation
├── render.js                    # Add renderDataVisualization()
│                                # Add renderDefensiveTargets() to Data Analysis
├── utils.js                     # Add chart data prep helpers
└── styles.css                   # Add chart grid styles

backend/
└── server.js                    # Add /api/player-history endpoint
                                 # Add GW persistence function
Key Decisions Made
Chart Library: Apache ECharts
Why: Best balance of features, bundle size, interactivity, and dark mode support
Database: SQLite
Why: Lightweight, no separate server, ~50KB per GW, built-in to Node
Defensive Theory Approach
Immediate: Build actionable tool (Chart #9) users can test manually Long-term: Collect data for statistical validation (Charts #10-11)
Design Philosophy
Responsive first (mobile-friendly)
Dark mode compatible
Interactive (tooltips, zoom, filters)
Performance-optimized (lazy loading, sampling)
Actionable insights (not just pretty charts)
Success Metrics
User Engagement
% of users clicking "Charts" tab
Time spent on visualization page
Most viewed charts
Theory Validation (After 10 GWs)
Statistical significance of FDR-DefCon correlation
User feedback on defensive targets
Accuracy of predictions
Technical Performance
Page load time < 2 seconds
Chart render time < 500ms
Mobile usability score > 90
Ready to proceed with implementation?
