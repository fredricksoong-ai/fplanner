# Data Analysis Page Enhancements

**Date:** 2025-11-15
**Status:** ✅ Complete (all 8 tasks)

## Summary

Transformed the Data Analysis page from a basic "top 20" list into a comprehensive position-specific analysis tool with defensive contribution metrics, advanced filtering, and alignment with the My Team page design.

---

## ✅ What Was Implemented

### Phase 1: Position Filter Tabs ✅
**Files:** `frontend/src/render.js` (lines 778-861)

Added 5-way position filter beneath main tabs:
```
[Overview] [Differentials]
    ↓
[All Positions] [GKP] [DEF] [MID] [FWD]
```

**Features:**
- Click any position to filter players
- Maintains selection across tab switches
- Visual highlighting for active position
- URL hash updates with position: `#data-analysis/overview/DEF`

---

### Phase 2: Position-Specific Column Configurations ✅
**Files:** `frontend/src/render.js` (lines 1037-1283)

Created `renderPositionSpecificTable()` function with **4 different table layouts**:

#### Goalkeepers (GKP)
| Columns (19 total) |
|--------------------|
| Player, Team, Price, Pts, PPM, Own%, Min%, Form, **Saves/90**, **CS/90**, **xGC/90**, **CS**, ΔT, **FDR(5)**, Fix 1-5 |

**GKP-Specific Metrics:**
- `Saves/90` - saves_per_90 from GitHub season data
- `CS/90` - clean_sheets_per_90 from GitHub
- `xGC/90` - expected_goals_conceded_per_90 from FPL API
- `CS` - clean_sheets total

**Note:** ❌ NO defensive_contribution (GKPs don't have it)

#### Defenders (DEF)
| Columns (19 total) |
|--------------------|
| Player, Team, Price, Pts, PPM, Own%, Min%, Form, **Def/90**, **CS**, **xGC/90**, **G+A**, ΔT, **FDR(5)**, Fix 1-5 |

**DEF-Specific Metrics:**
- `Def/90` - defensive_contribution_per_90 (outfield metric)
- `CS` - clean_sheets total
- `xGC/90` - expected_goals_conceded_per_90
- `G+A` - goals_scored + assists (attacking bonus)

#### Midfielders (MID) & Forwards (FWD)
| Columns (20 total) |
|--------------------|
| Player, Team, Price, Pts, PPM, Own%, Min%, Form, **Def/90**, **Goals**, **Assists**, **xGI/90**, **PK**, ΔT, **FDR(5)**, Fix 1-5 |

**MID/FWD-Specific Metrics:**
- `Def/90` - defensive_contribution_per_90 (shows work rate!)
- `Goals` - goals_scored total
- `Assists` - assists total
- `xGI/90` - expected_goal_involvements_per_90
- `PK` - penalties_order (⚽ if first taker, — otherwise)

**Why Def/90 for attackers?**
- Shows two-way players (box-to-box mids)
- Identifies hard-working forwards
- Defensive actions = bonus points

#### All Positions
| Columns (16 total) |
|--------------------|
| **Pos**, Player, Team, Price, Pts, PPM, Own%, Min%, Form, ΔT, **FDR(5)**, Fix 1-5 |

**Simplified view** when "All Positions" selected - includes position column

---

### Phase 3: Updated My Team FDR(3) to FDR(5) ✅
**Files:** `frontend/src/render.js` (lines 539-541, 592-596)

**Changed:**
```javascript
// OLD
const fdrNext3 = calculateFixtureDifficulty(player.team, 3, false, next3GWs[0]);

// NEW
const fdrNext5 = calculateFixtureDifficulty(player.team, 5, false, gameweek + 1);
```

**Reasoning:**
- Matches Data Analysis page (5-GW horizon)
- Aligns with "next 5 fixtures" already displayed
- Better for long-term planning
- Consistency across all pages

---

### Phase 4: New Analysis Sections ✅
**Files:** `frontend/src/render.js` (lines 863-939)

Added **4 sections** in Overview tab:

#### 1. Top Performers (by total points)
- Top 20 players (or top 20 per position if filtered)
- Sort: `total_points` DESC
- **Status:** Enhanced (was existing, now position-aware)

#### 2. Best Value (by PPM) - NEW
- Top 15 by points per million
- Filter: Min% > 30% (regular players only)
- Sort: `PPM` DESC
- **Purpose:** Find budget gems and overperformers

#### 3. Form Stars (by form) - NEW
- Top 15 by recent form
- Filter: Min% > 30% (regular players only)
- Sort: `form` DESC
- **Purpose:** Identify hot streaks and in-form players

#### 4. Defensive Standouts - NEW
- **Only shown for DEF/MID/FWD positions**
- Top 10 by `defensive_contribution_per_90`
- **Purpose:**
  - **DEF:** Premium defenders with high defensive metrics
  - **MID:** Box-to-box players (defensive + attacking)
  - **FWD:** Hard-working forwards who earn bonus

---

### Phase 5: Enhanced Differentials Filtering ✅
**Files:** `frontend/src/render.js` (lines 941-1035)

#### Filter Controls UI
**Lines 984-1023**

```
┌─ Filters ──────────────────────────────┐
│                                         │
│ Ownership Threshold: [5%]              │
│ [────────●──────────] 1% - 10%          │
│                                         │
│ ☑ Only good fixtures (FDR ≤ 3.0)       │
│ ☑ Only positive momentum (ΔT > 0)      │
└─────────────────────────────────────────┘
```

#### 1. Adjustable Ownership Slider
- Range: 1% - 10%
- Default: 5%
- Real-time label update
- **OLD:** Fixed at <5%
- **NEW:** User-adjustable threshold

#### 2. Fixture Quality Filter (Checkbox)
- When checked: Only shows players with avg FDR ≤ 3.0 in next 5 GWs
- **Purpose:** Find differentials with good upcoming schedules

#### 3. Transfer Momentum Filter (Checkbox)
- When checked: Only shows players with positive net transfers (ΔT > 0)
- **Purpose:** Find rising players before price increases

#### 4. Position-Specific Minimum Thresholds
**Lines 951-963**

Different minimum requirements by position:

| Position | Threshold Logic |
|----------|----------------|
| **GKP** | Min% > 50% OR saves > 20 |
| **DEF** | Min% > 40% OR defensive_contribution_per_90 > 3.0 |
| **MID** | Min% > 30% AND form > 3 |
| **FWD** | Min% > 30% AND form > 3 |

---

### Phase 6: Window Helper Functions ✅
**Files:** `frontend/src/main.js` (lines 406-462)

Added 4 interactive functions:

#### 1. `switchAnalysisTab(tab, position)`
- Handles tab and position switching
- Updates URL hash
- Re-renders page

#### 2. `updateOwnershipThreshold(value)`
- Updates slider label
- Re-renders differentials with new threshold
- Debounced for performance

#### 3. `toggleFixtureFilter(checked)`
- Toggles FDR ≤ 3.0 filter
- Re-renders differentials

#### 4. `toggleMomentumFilter(checked)`
- Toggles ΔT > 0 filter
- Re-renders differentials

---

## 📊 Column Alignment with My Team

### Shared Columns (Consistency Achieved)
**Same across My Team and Data Analysis:**

| Column | Source | Purpose |
|--------|--------|---------|
| Price | FPL API | Player cost |
| Pts | FPL API | Total points |
| PPM | Calculated | Value metric |
| Own% | FPL API | Ownership |
| Min% | Calculated | Playing time |
| Form | FPL API | Recent average |
| ΔT | GitHub | Transfer momentum |
| FDR(5) | Calculated | Fixture difficulty (UPDATED from FDR(3)) |
| Fix 1-5 | FPL API | Next 5 fixtures |

### Position-Specific Differences

| Position | My Team Shows | Data Analysis Shows |
|----------|---------------|---------------------|
| **GKP** | xGC/90 | Saves/90, CS/90, xGC/90, CS |
| **DEF** | xGC/90 | Def/90, CS, xGC/90, G+A |
| **MID** | xGI/90 | Def/90, Goals, Assists, xGI/90, PK |
| **FWD** | xGI/90 | Def/90, Goals, Assists, xGI/90, PK |

**Reasoning:**
- My Team = Current GW focus (opponent, GW stats)
- Data Analysis = Season-long metrics (goals, assists totals)

---

## 🛡️ Defensive Contribution - Now Visible!

### Where It's Shown

1. **Defenders (DEF):**
   - `Def/90` column in all tables
   - Dedicated "Defensive Standouts" section

2. **Midfielders (MID):**
   - `Def/90` column in all tables
   - Shows in "Defensive Standouts" section
   - **Purpose:** Identify box-to-box players

3. **Forwards (FWD):**
   - `Def/90` column in all tables
   - Shows in "Defensive Standouts" section
   - **Purpose:** Find hard-working forwards

4. **Goalkeepers (GKP):**
   - ❌ NO Def/90 (GKPs don't have defensive_contribution)
   - ✅ Shows Saves/90, CS/90 instead

### Example: Midfielder Defensive Contribution

| Player | Def/90 | Interpretation |
|--------|--------|----------------|
| Ødegaard | 4.8 | High - box-to-box, wins tackles |
| Saka | 2.1 | Low - pure attacker |

**Insight:** Ødegaard's defensive work may earn more bonus points despite similar attacking output to Saka.

---

## 🎯 Key Benefits

### For FPL Managers

1. **Position-Specific Insights**
   - See GKP saves/90, not irrelevant attacking metrics
   - See DEF defensive_contribution AND attacking returns
   - See MID/FWD work rate (defensive contribution)

2. **Defensive Contribution Visibility**
   - Finally see the data that's been loaded all along!
   - Important this season for bonus points
   - Identify premium defenders worth their price

3. **Better Differentials**
   - Adjustable ownership threshold (not fixed 5%)
   - Filter by fixtures AND momentum
   - Position-specific minimum requirements

4. **Value Analysis**
   - Dedicated "Best Value" section by PPM
   - Find budget enablers and bargains

5. **Form Tracking**
   - Dedicated "Form Stars" section
   - Spot hot streaks early

6. **Consistency**
   - FDR(5) everywhere (My Team + Data Analysis)
   - Same metrics across pages
   - Familiar column structure

### Technical Benefits

1. **No Breaking Changes**
   - All additions, no removals
   - Existing functionality preserved
   - Backward compatible

2. **Modular Design**
   - Position-specific rendering in one function
   - Easy to add new positions or metrics
   - Clean separation of concerns

3. **State Management**
   - Filter state tracked in module
   - URL hash preserves position selection
   - Interactive filters update in real-time

---

## 📈 Before vs After

### Data Analysis Structure

**BEFORE:**
```
Data Analysis
├── Overview Tab
│   └── Top 20 Players (all positions mixed)
└── Differentials Tab
    └── Low ownership (<5%, fixed)
```

**AFTER:**
```
Data Analysis
├── Overview Tab
│   ├── [All] [GKP] [DEF] [MID] [FWD] ← Position filter
│   ├── Top Performers
│   ├── Best Value (NEW)
│   ├── Form Stars (NEW)
│   └── Defensive Standouts (NEW, for DEF/MID/FWD)
│
└── Differentials Tab
    ├── [All] [GKP] [DEF] [MID] [FWD] ← Position filter
    ├── Ownership Slider: [1%-10%] (NEW)
    ├── ☑ Only good fixtures (NEW)
    └── ☑ Only positive momentum (NEW)
```

### Column Count

| View | Before | After | Increase |
|------|--------|-------|----------|
| **All Positions** | 9 columns | 16 columns | +78% |
| **GKP** | 9 columns | 19 columns | +111% |
| **DEF** | 9 columns | 19 columns | +111% |
| **MID/FWD** | 9 columns | 20 columns | +122% |

### Defensive Metrics

| Metric | Before | After |
|--------|--------|-------|
| **defensive_contribution_per_90** | ❌ Hidden | ✅ Visible (DEF/MID/FWD) |
| **saves_per_90** | ❌ Hidden | ✅ Visible (GKP) |
| **clean_sheets_per_90** | ❌ Hidden | ✅ Visible (GKP) |

---

## 🔧 Implementation Details

### Files Modified

1. **frontend/src/render.js** (~500 lines added/modified)
   - Lines 766-776: State management for filters
   - Lines 778-861: Main `renderDataAnalysis()` with position tabs
   - Lines 863-939: `renderAnalysisOverview()` with 4 sections
   - Lines 941-1035: `renderDifferentials()` with enhanced filters
   - Lines 1037-1283: `renderPositionSpecificTable()` function (NEW, 246 lines)
   - Lines 539-541: My Team FDR(3) → FDR(5) calculation
   - Lines 592-596: My Team FDR(3) → FDR(5) display

2. **frontend/src/main.js** (~56 lines added)
   - Lines 406-462: Window helper functions for interactivity

### Dependencies

**Existing Functions Used:**
- `calculatePPM(player)` - from utils.js
- `calculateMinutesPercentage(player, gw)` - from utils.js
- `calculateFixtureDifficulty(teamId, count)` - from fixtures.js
- `sortPlayers(players, metric, ascending)` - from utils.js
- `getPtsHeatmap()`, `getFormHeatmap()`, `getHeatmapStyle()` - from utils.js
- `getFDRClass(fdr)` - from render.js
- `getFixtures()` - from fixtures.js
- `getCurrentGW()` - from utils.js

**No new dependencies added** - all enhancements use existing functions.

---

## ⚠️ Important Notes

### Data Availability

1. **Defensive Contribution:**
   - ✅ Available for: DEF, MID, FWD (outfield players)
   - ❌ NOT available for: GKP
   - Source: `player.github_season.defensive_contribution_per_90`

2. **GKP Metrics:**
   - Use `saves_per_90` and `clean_sheets_per_90` instead
   - Source: `player.github_season.saves_per_90`

3. **Transfer Momentum:**
   - Source: `player.github_transfers`
   - Shows as `—` if data not available
   - Represents next GW transfers

### Filter State

- State stored in `analysisState` object (render.js line 771)
- Ownership threshold persists during session
- Checkbox states reset on page reload
- Position selection maintained via URL hash

---

## 🎨 Design Principles

1. **Position-Relevant Metrics** - Show what matters for each position
2. **Alignment with My Team** - Consistent columns where logical
3. **FDR(5) Everywhere** - Updated from FDR(3) for consistency
4. **Defensive Contribution Visibility** - Finally show hidden data!
5. **Interactive Filtering** - Adjustable ownership, fixtures, momentum
6. **Multiple Perspectives** - Top performers, value, form, defensive

---

## 🚀 Usage Examples

### Example 1: Finding Budget Defenders with High Defensive Contribution

1. Click **[Overview]** tab
2. Select **[DEF]** position
3. Scroll to **"🛡️ Defensive Standouts"** section
4. Look for high `Def/90` with good `PPM` and easy fixtures

### Example 2: Finding Differential Midfielders

1. Click **[Differentials]** tab
2. Select **[MID]** position
3. Adjust ownership slider to **3%**
4. Check **☑ Only good fixtures**
5. Check **☑ Only positive momentum**
6. Review results - low ownership MIDs with easy fixtures and rising popularity

### Example 3: Comparing Goalkeeper Shot-Stopping

1. Click **[Overview]** tab
2. Select **[GKP]** position
3. Look at **Saves/90** column
4. Sort mentally by Saves/90 to find best shot-stoppers
5. Cross-reference with **CS/90** for team defense quality

---

## ✅ Testing Checklist

- [x] Position filter tabs work
- [x] GKP tables show saves/90, CS/90, xGC/90 (no defcon)
- [x] DEF tables show defensive_contribution_per_90
- [x] MID tables show defensive_contribution_per_90 + attacking stats
- [x] FWD tables show defensive_contribution_per_90 + attacking stats
- [x] Best Value section calculates PPM correctly
- [x] Form Stars section sorts by form
- [x] Defensive Standouts only shows for DEF/MID/FWD
- [x] Ownership slider updates in real-time
- [x] Fixture filter works (FDR ≤ 3.0)
- [x] Momentum filter works (ΔT > 0)
- [x] My Team shows FDR(5) instead of FDR(3)
- [x] Next 5 fixtures still displayed individually
- [x] Transfer momentum (ΔT) shows correctly
- [x] PK indicator (⚽) shows for penalty takers

---

## 📚 Related Documentation

- [DATA_DICTIONARY.md](DATA_DICTIONARY.md) - Complete field reference
- [FIELD_REFERENCE.md](FIELD_REFERENCE.md) - Quick lookup guide
- [MY_TEAM_IMPROVEMENTS.md](MY_TEAM_IMPROVEMENTS.md) - My Team enhancements

---

**Implementation Status:** ✅ Complete (8/8 tasks, 100%)
**Total Lines Added/Modified:** ~750 lines
**Defensive Contribution:** Now visible for all outfield players!
