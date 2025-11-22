# Data Refresh Locations

## Summary of All Refresh Operations

### 1. **Dashboard Page** (`frontend/src/liveDashboard.js`)
- **Initial Load**: 
  - `loadEnrichedBootstrap(true)` - Force refresh on page entry
  - `loadMyTeam(teamId)` - Load team data once
- **Pull-to-Refresh** (to be removed):
  - `loadEnrichedBootstrap(true)` - Force refresh
- **Auto-Refresh** (every 2 minutes during live GW):
  - `loadEnrichedBootstrap()` - Only enriched bootstrap, NOT team data
  - ⚠️ **Issue**: League standings NOT refreshed

### 2. **Team Page** (`frontend/src/renderMyTeam.js`)
- **Manual Refresh** (`handleTeamRefresh()`):
  - `loadMyTeam(teamId)` - Reloads team data with rate limiting (30s minimum)
  - ⚠️ **Issue**: League standings NOT refreshed
- **Pull-to-Refresh** (if exists):
  - Check `pullToRefreshInstance` usage

### 3. **League Standings** (`frontend/src/myTeam/leagueStandings.js`)
- **Load Triggers**:
  - User switches league tab → `loadLeagueStandingsForTab()`
  - User selects a league → `loadLeagueStandingsForTab()`
  - **NOT automatically refreshed** during auto-refresh or team refresh

### 4. **Auto-Refresh System** (`frontend/src/data.js`)
- **Function**: `startAutoRefresh()`
- **Interval**: Every 2 minutes (only during live GW)
- **What it refreshes**: Only `loadEnrichedBootstrap()` 
- **What it DOESN'T refresh**:
  - Team data (`loadMyTeam`)
  - League standings (`loadLeagueStandings`)
  - ⚠️ **Issue**: League points won't update

### 5. **Initial App Load** (`frontend/src/main.js`)
- `loadFPLData()` - Loads bootstrap + fixtures + GitHub data once on app start

## API Endpoints Used

1. **`/api/bootstrap/enriched`** - Enriched bootstrap with live stats
2. **`/api/team/:teamId`** - Team data (includes leagues list)
3. **`/api/leagues/:leagueId`** - League standings

## Issues to Fix

1. ⚠️ **League standings not refreshed during auto-refresh**
   - Need to refresh league standings cache when team data is refreshed
   - Need to refresh active league tab during dashboard auto-refresh

2. ⚠️ **Team data not refreshed during dashboard auto-refresh**
   - Currently only enriched bootstrap is refreshed
   - Team data needs periodic refresh for league points to update

3. ⚠️ **Pull-to-refresh triggers rate limiting**
   - Needs to be removed as requested

## Recommended Fixes

1. **Remove pull-to-refresh** from dashboard
2. **Add league standings refresh** to auto-refresh callback
3. **Add team data refresh** periodically (less frequent than enriched bootstrap)
4. **Clear league standings cache** when refreshing team data

