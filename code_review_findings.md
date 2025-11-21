# Code Review Findings - FPL Data Flow Logic

## Summary

The FPL Planner codebase has a **well-structured data handling architecture** with clear separation between FPL API calls (`fplService.js`), GitHub data fetching (`githubService.js`), and caching (`cacheManager.js`). Gameweek detection, data source routing, and error handling are all implemented and functional. The main gaps are: (1) using a different GitHub repo than specified, (2) no live match endpoint usage during games, and (3) JSON-based persistence rather than SQLite.

---

## Priority 1: Critical Gaps

### Issue 1: No Live GW Endpoint Usage
- **Location**: `backend/services/fplService.js`
- **Problem**: The `/api/event/{gw}/live/` endpoint is NOT implemented. During live matches, we cannot fetch real-time player points.
- **Current state**: Only uses `/bootstrap-static/`, `/fixtures/`, `/entry/{id}/`, `/element-summary/{id}/`
- **Impact**: Cannot show live bonus points or in-game stats during matches
- **Fix estimate**: 2-3 hours

### Issue 2: Wrong GitHub Repository
- **Location**: `backend/config.js:3`
- **Problem**: Uses `olbauday/FPL-Elo-Insights` instead of `vaastav/Fantasy-Premier-League`
- **Code snippet**:
  ```javascript
  export const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/olbauday/FPL-Elo-Insights/main/data/2025-2026';
  ```
- **Impact**: May have different data structure/reliability than expected
- **Fix estimate**: 1 hour (if switching repos) OR document current approach (30 min)

---

## Priority 2: Improvements Needed

### Issue 3: Era-Based GitHub Refresh May Miss Updates
- **Location**: `backend/services/cacheManager.js:getCurrentEra()`
- **Problem**: GitHub cache refreshes based on "morning/evening" era, not the 5am/5pm UTC schedule mentioned in requirements
- **Code snippet**:
  ```javascript
  export function getCurrentEra() {
    const hour = new Date().getUTCHours();
    return (hour >= 5 && hour < 17) ? 'morning' : 'evening';
  }
  ```
- **Impact**: May serve stale data for several hours after GitHub updates
- **Recommendation**: Add explicit check for hours 5 and 17 UTC to force refresh
- **Fix estimate**: 1 hour

### Issue 4: No Explicit Data Source Routing Logic
- **Location**: Multiple files
- **Problem**: No single function decides "use GitHub vs FPL API based on GW state"
- **Current behavior**:
  - GitHub data always fetched for stats/predictions
  - FPL API always fetched for bootstrap/fixtures
  - No conditional routing based on live/finished state
- **Impact**: Works, but harder to maintain and understand
- **Recommendation**: Create explicit `getDataSource(dataType, gwState)` utility
- **Fix estimate**: 2 hours

### Issue 5: Team Data Not Cached
- **Location**: `backend/services/fplService.js:fetchTeamData()`
- **Problem**: Individual team/picks requests bypass cache
- **Impact**: Repeated API calls for same team data
- **Fix estimate**: 1.5 hours

---

## Priority 3: Nice-to-Haves

### Issue 6: No Retry Logic for API Calls
- **Location**: All axios calls in `fplService.js` and `githubService.js`
- **Problem**: Single attempt with timeout, then falls back to cache
- **Impact**: Temporary network glitches cause unnecessary cache fallbacks
- **Recommendation**: Add axios-retry with 2-3 attempts and exponential backoff
- **Fix estimate**: 30 minutes

### Issue 7: Frontend GW Detection Duplicates Backend Logic
- **Location**: `frontend/src/data.js` and `backend/services/cacheManager.js`
- **Problem**: Both have `getActiveGW()` / `detectCurrentGW()` logic
- **Impact**: Potential inconsistencies, harder to maintain
- **Recommendation**: Consolidate to backend, expose via API
- **Fix estimate**: 1 hour

### Issue 8: No User-Facing Error Messages for GitHub Failures
- **Location**: `backend/services/githubService.js`
- **Problem**: GitHub errors logged but not surfaced meaningfully to UI
- **Impact**: Users see generic error without knowing GitHub data is unavailable
- **Fix estimate**: 30 minutes

---

## Code Snippets

### Current Gameweek Detection (Working)
`frontend/src/data.js:getActiveGW()`
```javascript
export function getActiveGW() {
    if (!fplBootstrap || !fplBootstrap.events) {
        return currentGW || 1;
    }
    const currentEvent = fplBootstrap.events.find(e => e.is_current);
    if (currentEvent) return currentEvent.id;

    const nextEvent = fplBootstrap.events.find(e => e.is_next);
    if (nextEvent) return nextEvent.id;

    return currentGW || 1;
}
```

### Data Fetching Pattern (Working)
`backend/services/fplService.js`
```javascript
export async function fetchBootstrap() {
  try {
    const response = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, {
      timeout: 10000,
      headers: { 'User-Agent': 'FPLanner/1.0' }
    });
    updateBootstrapCache(response.data);
    return response.data;
  } catch (err) {
    logger.error('Failed to fetch bootstrap:', err.message);
    if (cache.bootstrap.data) {
      return cache.bootstrap.data; // Stale cache fallback
    }
    throw new Error('Bootstrap data unavailable');
  }
}
```

### Cache Persistence (Working)
`backend/services/cacheManager.js`
```javascript
export function initializeCachePersistence() {
  loadCacheFromDisk(); // Restore on startup
  setInterval(saveCacheToDisk, 5 * 60 * 1000); // Auto-save every 5 min
  process.on('SIGTERM', () => { saveCacheToDisk(); process.exit(0); });
  process.on('SIGINT', () => { saveCacheToDisk(); process.exit(0); });
}
```

---

## Review Checklist Results

### Gameweek State Detection
- [x] Logic exists - `frontend/src/data.js`, `backend/services/cacheManager.js`
- [x] Checks `is_current`, `is_next`, `finished` flags from bootstrap events
- [x] Uses `deadline_time` for countdown timer
- **Rating**: ✅ Working

### Data Source Routing
- [x] Fetches from both GitHub and FPL API
- [ ] Explicit routing logic between sources - **MISSING**
- [x] GitHub data cached with era-based TTL
- **Rating**: ⚠️ Partial (implicit routing only)

### GitHub Repository Integration
- [x] Direct HTTPS file download via axios
- [x] Files: `playerstats.csv`, `GW{N}/player_gameweek_stats.csv`
- [x] Error handling with fallback to existing cache
- **Rating**: ✅ Working (but uses different repo)

### Data Persistence
- [x] JSON file storage (`cache-backup.json`)
- [x] Auto-save every 5 minutes + graceful shutdown
- [x] Restore on startup if < 24 hours old
- **What persists**: Bootstrap, fixtures, GitHub stats, cache stats
- **What doesn't persist**: Individual team data, user preferences
- **Rating**: ✅ Working

### Error Handling
- [x] Try/catch around all external calls
- [x] Stale cache fallback on API failure
- [x] Production-safe error messages
- [x] Rate limiting (100 req/15 min)
- [ ] Retry logic - **MISSING**
- **Rating**: ⚠️ Partial

---

## Recommendations

### 1. Immediate (This Sprint)
- **Add live GW endpoint** (`/api/event/{gw}/live/`) to `fplService.js` - Critical for live match data
- **Document GitHub repo decision** - Why `olbauday/FPL-Elo-Insights` vs `vaastav/Fantasy-Premier-League`?

### 2. Short-term (Next Sprint)
- Create explicit `getDataSource()` routing function
- Add axios-retry for transient failures
- Implement team data caching

### 3. Backlog
- Consolidate frontend/backend GW detection
- Add user-facing error messages for GitHub failures
- Consider SQLite if team persistence becomes important

---

## SQLite Decision

### Recommendation: **NOT NOW**

**Reasoning:**

Current JSON-based persistence (`cache-backup.json`) is sufficient for the prototype because:

1. **Already implemented and working** - Auto-saves every 5 min, restores on startup
2. **Covers the main use case** - Persists bootstrap, fixtures, and GitHub stats across restarts
3. **Simple deployment** - No additional dependencies or migration complexity

**When to reconsider SQLite:**
- If we need to store **user-specific data** (saved teams, preferences, historical picks)
- If we need **query capabilities** (filter teams by score, sort players by form)
- If cache.json grows > 10MB and needs structured access

**Alternative approach:** If user data persistence becomes needed, start with localStorage on frontend before adding backend database.

---

## File Structure Map

```
/home/user/fplanner
├── backend/
│   ├── config.js                 # URLs, TTL constants
│   ├── server.js                 # Express app, middleware
│   ├── routes/
│   │   ├── fplRoutes.js          # Main /api/fpl-data endpoint
│   │   ├── teamRoutes.js         # /api/team/:teamId
│   │   └── leagueRoutes.js       # /api/leagues/:leagueId
│   └── services/
│       ├── fplService.js         # FPL API calls ⭐
│       ├── githubService.js      # GitHub CSV fetching ⭐
│       └── cacheManager.js       # In-memory + disk cache ⭐
├── frontend/
│   └── src/
│       ├── data.js               # API calls, GW detection ⭐
│       ├── main.js               # Countdown timer
│       └── sharedState.js        # State management
└── docs/
```

**Key files marked with ⭐**
