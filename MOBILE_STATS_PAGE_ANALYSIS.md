# Mobile Stats Page - Inconsistencies Analysis

## Executive Summary
This document outlines the inconsistencies found in the Mobile Stats page implementation, including both user-reported issues and additional findings from code analysis.

---

## 1. ✅ CONFIRMED: Row Tint Overlap Issue on Horizontal Scroll

**Location:** `frontend/src/renderDataAnalysis.js:866-1035` (renderPositionSpecificTableMobile)

**Issue:**
Rows with background tints (for "my players" and "wishlisted" players) have overlapping issues when horizontally scrolled, while rows without tints scroll properly.

**Root Cause:**
The sticky column (player name) uses a simplified solid background color for rows with tints, while the scrollable portion uses gradients:

```javascript
// Line 950-952
const stickyColumnBg = rowBg.startsWith('linear-gradient')
    ? (isMyPlayer ? 'rgba(56, 189, 248, 0.16)' : (isWishlistedPlayer ? 'rgba(250, 204, 21, 0.18)' : 'var(--bg-secondary)'))
    : rowBg;
```

The gradient backgrounds (`COMBINED_TINT` at line 1307) don't align properly with the solid sticky column background, causing visual overlap.

**Affected Rows:**
- My Player rows: `rgba(56, 189, 248, 0.16)` tint
- Wishlisted rows: `rgba(250, 204, 21, 0.18)` tint
- Combined (my player + wishlisted): `linear-gradient(90deg, rgba(56, 189, 248, 0.16), rgba(250, 204, 21, 0.2))`

**Files Affected:**
- `frontend/src/renderDataAnalysis.js` (lines 1305-1321, 949-972)

---

## 2. ✅ CONFIRMED: Duplicate "Total pts" Column in Top Performers Table

**Location:** `frontend/src/dataAnalysis/overview.js:74-75`

**Issue:**
The Top Performers table includes both a standard "Total" column (always present in mobile tables) AND a context column also set to "Total", resulting in duplicate columns.

**Code Evidence:**
```javascript
// overview.js line 75
${isMobile ? renderPositionSpecificTableMobile(annotate(top20), 'total') : ...}
```

The mobile table header structure (renderDataAnalysis.js:876-884) shows:
- Line 881: `<th>Total</th>` - Standard column
- Line 883: `<th>${config.header}</th>` - Context column, which for 'total' is also "Total"

**Impact:**
- Wastes horizontal space on mobile
- Confuses users with redundant information
- Same issue exists in:
  - Overview Tab → Top Performers section
  - Potentially affects other tables where context column duplicates existing columns

**Files Affected:**
- `frontend/src/dataAnalysis/overview.js` (line 75)
- `frontend/src/renderDataAnalysis.js` (lines 746-759, contextConfig)

---

## 3. ✅ CONFIRMED: Inconsistent Heatmapping Application

**Location:** `frontend/src/renderDataAnalysis.js`

### 3.1 Mobile Tables (renderPositionSpecificTableMobile)

**Current Heatmapping:** (lines 986-996)
- ✅ GW Pts - Has heatmap
- ❌ **Total** - No heatmap (just font-weight: 600)
- ✅ Form - Has heatmap
- ✅ Context Column - Has conditional heatmap/styling

**Issue:** The "Total" column (line 990-992) doesn't have heatmapping, only bold font weight.

```javascript
// Line 990-992 - Total column WITHOUT heatmap
<td style="text-align: center; padding: 0.5rem; font-weight: 600;">
    ${player.total_points}
</td>
```

### 3.2 Desktop Tables (renderPositionSpecificTable)

**Current Heatmapping:** (lines 1196-1273)
- ✅ Pts (Total Points) - Has heatmap via `ptsStyle`
- ✅ PPM - Has heatmap via `ppmStyle`
- ✅ Form - Has heatmap via `formStyle`
- ❌ Own% - No heatmap
- ❌ Min% - No heatmap
- ❌ Position-specific metrics (Saves/90, CS/90, Def/90, Goals, Assists, etc.) - No heatmap

**Observation:**
Desktop tables have MORE heatmapping than mobile tables (Total pts has heatmap on desktop but not on mobile).

**Inconsistencies:**
1. **Mobile vs Desktop mismatch**: Total column has heatmap on desktop but not mobile
2. **Incomplete coverage**: Many columns lack heatmapping entirely (Own%, Min%, position-specific stats)
3. **No unified strategy**: Some tables prioritize certain metrics over others

**Files Affected:**
- `frontend/src/renderDataAnalysis.js` (lines 990-992 for mobile, 1196-1273 for desktop)

---

## 4. ✅ CONFIRMED: Charts Not Dynamically Adjusting Axis

**Location:** `frontend/src/charts/`

### Working Correctly (✅):
**Ownership vs Form** (`ownershipVsForm.js`)
- Lines 264, 275: `min: 0` only, no `max` specified → ECharts auto-scales

### Not Adjusting Properly (❌):

#### Points vs Price (`pointsVsPrice.js`)
- Line 313: `max: 15` (FIXED - won't adjust)
- Line 325: `max: yAxisMax` (Dynamic but calculated once, doesn't update on filter change)

#### Form vs Price (`formVsPrice.js`)
- Line 278: `max: 15` (FIXED - won't adjust)
- Line 290: `max: yAxisMax` (Dynamic but calculated once)

#### Minutes Efficiency (`minutesEfficiency.js`)
- Y-axis: `max: yAxisMax` (Dynamic but calculated once)

#### Fixtures vs Form (`fixturesVsForm.js`)
- Uses 'max' in markArea zones (lines 165, 184) which doesn't auto-adjust

#### ICT vs Points (`ictVsPoints.js`)
- Lines 159, 170: No `max` specified → Should auto-scale BUT doesn't recalculate zones

**Root Cause:**
1. **Static max values**: Some charts have hardcoded `max: 15` for price axis
2. **One-time calculation**: `yAxisMax` is calculated when chart is rendered, but NOT recalculated when position filter changes
3. **No listener for filter changes**: Charts don't re-render/recalculate when user adds/removes positions

**Expected Behavior:**
When a user filters by position (e.g., only GKP), the chart should:
1. Recalculate min/max values based on filtered data
2. Adjust axis ranges to fit the new data range
3. Update zone boundaries dynamically

**Current Behavior:**
Charts maintain their original axis ranges even when filtered data has a much smaller range.

**Files Affected:**
- `frontend/src/charts/pointsVsPrice.js` (lines 108-121, 313, 325)
- `frontend/src/charts/formVsPrice.js` (lines 88-92, 278, 290)
- `frontend/src/charts/minutesEfficiency.js` (lines 76-79, 155)
- `frontend/src/charts/fixturesVsForm.js` (lines 90, 165, 184)
- `frontend/src/charts/ictVsPoints.js` (lines 73, 159, 170)
- `frontend/src/charts/xgiVsActual.js` (not reviewed but likely similar)
- `frontend/src/charts/xgcVsActual.js` (not reviewed but likely similar)

**Why Ownership vs Form Works:**
It doesn't specify any `max` values, allowing ECharts to automatically calculate and adjust based on the data.

---

## Additional Findings

### 5. Context Column Redundancy Pattern

**Issue:** The mobile table design has a "context column" that changes based on table type, but this can lead to redundancy:

**Examples:**
- **Top Performers**: context='total' → Duplicates existing Total column
- **Best Value**: context='ppm' → Unique, no duplicate
- **Form Stars**: context='ppm' → Unique, no duplicate
- **Penalty Takers**: context='penalty' → Unique, no duplicate
- **Defensive Standouts**: context='def90' → Unique, no duplicate

**Recommendation:**
For tables where context column would duplicate existing columns, use a different context or omit the context column entirely.

---

## Summary of Issues

| # | Issue | Severity | Location | Status |
|---|-------|----------|----------|--------|
| 1 | Row tint overlap on scroll | Medium | `renderDataAnalysis.js:949-972` | Confirmed |
| 2 | Duplicate "Total pts" columns | High | `overview.js:75` | Confirmed |
| 3 | Inconsistent heatmapping | Medium | Mobile & Desktop tables | Confirmed |
| 4 | Charts not adjusting axis | High | All chart modules except Ownership vs Form | Confirmed |
| 5 | Context column redundancy | Low | Overview tab tables | Confirmed |

---

## Recommendations Priority

1. **HIGH**: Fix duplicate Total column in Top Performers
2. **HIGH**: Implement dynamic axis adjustment for all charts
3. **MEDIUM**: Fix row tint overlap issue on horizontal scroll
4. **MEDIUM**: Apply consistent heatmapping to Total column on mobile
5. **LOW**: Review and optimize context column strategy

---

## Files Summary

**Core Files:**
- `frontend/src/renderDataAnalysis.js` - Main rendering logic for Stats page
- `frontend/src/dataAnalysis/overview.js` - Overview tab
- `frontend/src/dataAnalysis/hiddenGems.js` - Hidden Gems tab
- `frontend/src/dataAnalysis/transferTargets.js` - Transfer Targets tab
- `frontend/src/dataAnalysis/chartsTab.js` - Charts tab initialization

**Chart Files:**
- `frontend/src/charts/ownershipVsForm.js` - ✅ Working correctly
- `frontend/src/charts/pointsVsPrice.js` - ❌ Needs fix
- `frontend/src/charts/formVsPrice.js` - ❌ Needs fix
- `frontend/src/charts/minutesEfficiency.js` - ❌ Needs fix
- `frontend/src/charts/ictVsPoints.js` - ❌ Needs fix
- `frontend/src/charts/fixturesVsForm.js` - ❌ Needs fix
- `frontend/src/charts/xgiVsActual.js` - ❌ Likely needs fix
- `frontend/src/charts/xgcVsActual.js` - ❌ Likely needs fix

**Helper Files:**
- `frontend/src/charts/chartHelpers.js` - Shared chart utilities
