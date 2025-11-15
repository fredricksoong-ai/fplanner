# FPLanner Data Dictionary

**Version:** 1.0
**Last Updated:** 2025-11-15
**Total Data Sources:** 5 (3 APIs + 3 CSV files)

## Table of Contents

- [Overview](#overview)
- [Data Flow](#data-flow)
- [Data Sources](#data-sources)
  - [1. FPL Bootstrap API](#1-fpl-bootstrap-api)
  - [2. FPL Fixtures API](#2-fpl-fixtures-api)
  - [3. GitHub CSV - Season Stats](#3-github-csv---season-stats)
  - [4. GitHub CSV - Current Gameweek](#4-github-csv---current-gameweek)
  - [5. GitHub CSV - Next Gameweek](#5-github-csv---next-gameweek)
  - [6. FPL Team/Picks API](#6-fpl-teampicks-api)
- [Calculated Fields](#calculated-fields)
- [Risk Analysis Fields](#risk-analysis-fields)
- [Fixture Analysis Fields](#fixture-analysis-fields)
- [Quick Reference](#quick-reference)

---

## Overview

FPLanner combines data from **5 primary sources** to create an enriched player dataset:

| Source | Type | Refresh Rate | Fields Count | Purpose |
|--------|------|--------------|--------------|---------|
| FPL Bootstrap API | REST API | 30min-12h (adaptive) | 50+ per player | Core player stats |
| FPL Fixtures API | REST API | 12h | 5 per fixture | Match schedule & FDR |
| GitHub Season CSV | CSV File | 12h (era-based) | 10 per player | Enhanced season metrics |
| GitHub Current GW CSV | CSV File | 12h (era-based) | 14 per player | Gameweek-specific stats |
| GitHub Next GW CSV | CSV File | 12h (era-based) | 2 per player | Transfer trends |

**Code Location:** Data fetching happens in [backend/server.js](../backend/server.js), enrichment in [frontend/src/data.js](../frontend/src/data.js)

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (server.js)                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ FPL Bootstrap│  │ FPL Fixtures │  │ GitHub CSVs  │      │
│  │     API      │  │     API      │  │  (3 files)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                     ┌──────▼───────┐                         │
│                     │ Smart Cache  │                         │
│                     │ (Era-based)  │                         │
│                     └──────┬───────┘                         │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             │ /api/fpl-data
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                   FRONTEND (data.js)                         │
│                                                              │
│              ┌────────────────────────────┐                  │
│              │ enrichPlayerWithGithubData │                  │
│              └────────┬───────────────────┘                  │
│                       │                                      │
│         ┌─────────────┼─────────────┐                        │
│         │             │             │                        │
│   ┌─────▼──────┐ ┌───▼────┐ ┌─────▼───────┐                │
│   │github_season│ │github_gw│ │github_     │                │
│   │   (10)      │ │  (14)   │ │transfers(2)│                │
│   └─────────────┘ └─────────┘ └─────────────┘                │
│                                                              │
│              ┌────────────────────────────┐                  │
│              │   Enriched Player Object   │                  │
│              │    (75+ total fields)      │                  │
│              └────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### 1. FPL Bootstrap API

**Endpoint:** `https://fantasy.premierleague.com/api/bootstrap-static/`
**Code Location:** [backend/server.js:176-205](../backend/server.js)
**Storage:** `cache.bootstrap.data` (backend), `fplBootstrap` (frontend)
**Structure:**

```javascript
{
  events: [],        // Gameweek information (38 objects)
  teams: [],         // Premier League teams (20 objects)
  elements: [],      // Players (500+ objects)
  element_types: []  // Positions: GKP, DEF, MID, FWD (4 objects)
}
```

#### 1.1 Player Fields (`elements` array)

**Primary Usage:** All tables, sorting, filtering, risk analysis

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `id` | `number` | Unique player identifier | Matching with GitHub data ([data.js:116](../frontend/src/data.js)) | `301` |
| `web_name` | `string` | Display name (surname or short name) | Table display ([render.js:340](../frontend/src/render.js)) | `"Salah"` |
| `first_name` | `string` | Player's first name | Search functionality ([render.js:796](../frontend/src/render.js)) | `"Mohamed"` |
| `second_name` | `string` | Player's last/family name | Search functionality ([render.js:797](../frontend/src/render.js)) | `"Salah"` |
| `element_type` | `number` | Position ID: 1=GKP, 2=DEF, 3=MID, 4=FWD | Position filtering ([utils.js:17-24](../frontend/src/utils.js)) | `3` |
| `team` | `number` | Team ID (1-20) | Team lookups ([fixtures.js:26](../frontend/src/fixtures.js)) | `10` |
| `team_code` | `number` | Official team code | Fixture analysis ([fixtures.js:20](../frontend/src/fixtures.js)) | `8` |
| `now_cost` | `number` | Current price in tenths (÷10 for £m) | Price display ([utils.js:61](../frontend/src/utils.js)), PPM calc | `125` = £12.5m |
| `total_points` | `number` | Total points scored this season | Sorting, heatmaps ([utils.js:119](../frontend/src/utils.js)) | `85` |
| `event_points` | `number` | Points scored in current gameweek | My Team display ([render.js:331](../frontend/src/render.js)) | `8` |
| `minutes` | `number` | Total minutes played this season | Rotation risk ([risk.js:64-72](../frontend/src/risk.js)), PP90 calc | `810` |
| `form` | `string` | Average points per game (recent 30 days) | Form heatmap ([utils.js:152-154](../frontend/src/utils.js)), risk | `"5.2"` |
| `selected_by_percent` | `string` | Ownership % across all teams | Differentials filter ([render.js:620](../frontend/src/render.js)) | `"32.5"` |
| `chance_of_playing_next_round` | `number\|null` | Injury/availability % (0-100, null=100%) | Injury risk ([risk.js:28-39](../frontend/src/risk.js)) | `75` or `null` |
| `yellow_cards` | `number` | Number of yellow cards this season | Suspension risk ([risk.js:42-50](../frontend/src/risk.js)) | `4` |
| `red_cards` | `number` | Number of red cards this season | Suspension risk ([risk.js:52-60](../frontend/src/risk.js)) | `0` |
| `cost_change_event` | `number` | Price change this GW (in tenths) | Price drop risk ([risk.js:112-120](../frontend/src/risk.js)) | `-1` = -£0.1m |
| `expected_goals_conceded_per_90` | `number` | xGC per 90 minutes (GKP/DEF) | Defensive metric ([render.js:320](../frontend/src/render.js)) | `0.85` |
| `expected_goal_involvements_per_90` | `number` | xGI per 90 (xG + xA, MID/FWD) | Attacking metric ([render.js:323](../frontend/src/render.js)) | `0.62` |
| `goals_scored` | `number` | Total goals this season | Display field | `12` |
| `assists` | `number` | Total assists this season | Display field | `8` |
| `clean_sheets` | `number` | Total clean sheets this season | Display field | `6` |
| `goals_conceded` | `number` | Total goals conceded (GKP/DEF) | Display field | `14` |
| `saves` | `number` | Total saves (GKP) | Display field | `45` |
| `bonus` | `number` | Total bonus points this season | Display field | `12` |
| `bps` | `number` | Total BPS (Bonus Point System) score | Display field | `456` |
| `influence` | `string` | Influence score (ICT Index component) | Display field | `"582.4"` |
| `creativity` | `string` | Creativity score (ICT Index component) | Display field | `"623.8"` |
| `threat` | `string` | Threat score (ICT Index component) | Display field | `"845.0"` |
| `ict_index` | `string` | Combined ICT Index score | Display field | `"20.5"` |
| `penalties_order` | `number\|null` | Penalty taker order (1=first, null=not on list) | Analysis field | `1` or `null` |
| `penalties_missed` | `number` | Penalties missed this season | Risk analysis | `0` |
| `penalties_saved` | `number` | Penalties saved (GKP only) | GKP metric | `1` |
| `transfers_in` | `number` | Total transfers in this season | Popularity metric | `1234567` |
| `transfers_out` | `number` | Total transfers out this season | Popularity metric | `987654` |
| `transfers_in_event` | `number` | Transfers in this gameweek | Current popularity | `45678` |
| `transfers_out_event` | `number` | Transfers out this gameweek | Current popularity | `12345` |
| `news` | `string` | Latest injury/availability news | Risk analysis display | `"Knee injury - 75% chance of playing"` |
| `news_added` | `string\|null` | Timestamp of news update (ISO 8601) | News freshness | `"2025-11-14T10:30:00Z"` |
| `status` | `string` | Player status: `"a"`=available, `"d"`=doubtful, `"i"`=injured, `"u"`=unavailable, `"s"`=suspended | Availability filtering | `"a"` |
| `in_dreamteam` | `boolean` | True if in current GW dream team | Achievement indicator | `false` |
| `dreamteam_count` | `number` | Times in dream team this season | Performance metric | `3` |
| `value_form` | `string` | Form relative to price | Value metric | `"0.4"` |
| `value_season` | `string` | Season points relative to price | Value metric | `"6.8"` |
| `points_per_game` | `string` | Average points per game | Performance metric | `"4.7"` |
| `ep_this` | `string\|null` | Expected points this GW (FPL prediction) | Planning aid | `"5.2"` |
| `ep_next` | `string\|null` | Expected points next GW | Planning aid | `"4.8"` |

**Total Bootstrap Player Fields:** 50+

#### 1.2 Gameweek Fields (`events` array)

**Primary Usage:** Current GW detection, data availability checks

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `id` | `number` | Gameweek number (1-38) | Current GW detection ([data.js:96](../frontend/src/data.js)) | `11` |
| `name` | `string` | Gameweek name | Display | `"Gameweek 11"` |
| `deadline_time` | `string` | Deadline timestamp (ISO 8601) | Countdown timer ([main.js](../frontend/src/main.js)) | `"2025-11-16T11:00:00Z"` |
| `is_current` | `boolean` | True if this is the current gameweek | GW detection ([server.js:108](../backend/server.js)) | `true` |
| `is_next` | `boolean` | True if this is the next gameweek | Fallback detection ([data.js:93](../frontend/src/data.js)) | `false` |
| `finished` | `boolean` | True if gameweek is complete | GitHub CSV availability ([server.js:258](../backend/server.js)) | `false` |

#### 1.3 Team Fields (`teams` array)

**Primary Usage:** Team name lookups, fixture analysis

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `id` | `number` | Team ID (1-20) | Team lookups ([utils.js:268](../frontend/src/utils.js)) | `1` |
| `code` | `number` | Official team code | Fixture matching ([fixtures.js:214](../frontend/src/fixtures.js)) | `3` |
| `name` | `string` | Full team name | Display ([utils.js:279](../frontend/src/utils.js)) | `"Arsenal"` |
| `short_name` | `string` | 3-letter abbreviation | Table display ([utils.js:269](../frontend/src/utils.js)) | `"ARS"` |
| `strength` | `number` | Team strength rating (1-5) | Analysis | `4` |
| `strength_overall_home` | `number` | Home strength | Advanced analysis | `1340` |
| `strength_overall_away` | `number` | Away strength | Advanced analysis | `1290` |
| `strength_attack_home` | `number` | Home attacking strength | Advanced analysis | `1350` |
| `strength_attack_away` | `number` | Away attacking strength | Advanced analysis | `1310` |
| `strength_defence_home` | `number` | Home defensive strength | Advanced analysis | `1330` |
| `strength_defence_away` | `number` | Away defensive strength | Advanced analysis | `1280` |

#### 1.4 Position Fields (`element_types` array)

**Primary Usage:** Position name lookups

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `id` | `number` | Position ID (1-4) | Position matching ([utils.js:17](../frontend/src/utils.js)) | `3` |
| `singular_name` | `string` | Position name (singular) | Display | `"Midfielder"` |
| `singular_name_short` | `string` | Short abbreviation | Table headers | `"MID"` |
| `plural_name` | `string` | Position name (plural) | Section headers | `"Midfielders"` |
| `plural_name_short` | `string` | Short plural | Display | `"MIDs"` |

---

### 2. FPL Fixtures API

**Endpoint:** `https://fantasy.premierleague.com/api/fixtures/`
**Code Location:** [backend/server.js:210-239](../backend/server.js)
**Storage:** `cache.fixtures.data` (backend), `fplFixtures` (frontend)
**Record Count:** ~380 fixtures per season

#### 2.1 Fixture Fields

**Primary Usage:** Fixture difficulty analysis, blank/double gameweek detection

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `event` | `number` | Gameweek number (null if not scheduled) | Filtering by GW ([fixtures.js:26-37](../frontend/src/fixtures.js)) | `11` |
| `team_h` | `number` | Home team ID | Determining home team ([fixtures.js:40](../frontend/src/fixtures.js)) | `1` |
| `team_a` | `number` | Away team ID | Determining opponent ([fixtures.js:41](../frontend/src/fixtures.js)) | `10` |
| `team_h_difficulty` | `number` | Home FDR rating (1=easiest, 5=hardest) | Fixture display ([fixtures.js:42](../frontend/src/fixtures.js)) | `3` |
| `team_a_difficulty` | `number` | Away FDR rating (1=easiest, 5=hardest) | Fixture display ([fixtures.js:42](../frontend/src/fixtures.js)) | `4` |
| `team_h_score` | `number\|null` | Home team goals (null if not played) | Results display | `2` or `null` |
| `team_a_score` | `number\|null` | Away team goals (null if not played) | Results display | `1` or `null` |
| `finished` | `boolean` | True if match is complete | Past fixtures | `true` |
| `started` | `boolean` | True if match has started | Live tracking | `false` |
| `kickoff_time` | `string\|null` | Match kickoff (ISO 8601) | Scheduling | `"2025-11-16T15:00:00Z"` |

**Note:** Fixture data is enriched client-side with opponent names and difficulty ratings.

---

### 3. GitHub CSV - Season Stats

**Source:** `https://raw.githubusercontent.com/ncklr/FPL-Elo-Insights/main/data/2024-25/playerstats.csv`
**Code Location:** [backend/server.js:28-46, 247-293](../backend/server.js)
**Availability:** Always available (updated twice daily)
**Format:** CSV parsed to JSON objects
**Storage:** `player.github_season` after enrichment

#### 3.1 Season Stats Fields

**Primary Usage:** Enhanced season-long performance metrics

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `id` | `number` | Player ID (matches FPL API) | Player matching ([data.js:116](../frontend/src/data.js)) | `301` |
| `form` | `number` | Recent form average (better than FPL's) | Enrichment ([data.js:119](../frontend/src/data.js)) | `5.2` |
| `value_form` | `number` | Form relative to price | Value analysis ([data.js:120](../frontend/src/data.js)) | `3.1` |
| `value_season` | `number` | Season points relative to price | Value analysis ([data.js:121](../frontend/src/data.js)) | `12.5` |
| `ict_index` | `number` | ICT Index (numeric version) | Performance metric ([data.js:122](../frontend/src/data.js)) | `15.6` |
| `defensive_contribution` | `number` | Defensive performance metric | DEF/GKP analysis ([data.js:123](../frontend/src/data.js)) | `2.3` |
| `defensive_contribution_per_90` | `number` | Defensive contribution per 90 min | Rate stat ([data.js:124](../frontend/src/data.js)) | `1.8` |
| `dreamteam_count` | `number` | Times in GW dream team | Achievement metric ([data.js:125](../frontend/src/data.js)) | `3` |
| `saves_per_90` | `number` | Saves per 90 minutes (GKP) | GKP specific ([data.js:126](../frontend/src/data.js)) | `3.2` |
| `clean_sheets_per_90` | `number` | Clean sheets per 90 (rate stat) | DEF/GKP metric ([data.js:127](../frontend/src/data.js)) | `0.3` |

**Enriched Player Object:**
```javascript
player.github_season = {
  form: 5.2,
  value_form: 3.1,
  value_season: 12.5,
  ict_index: 15.6,
  defensive_contribution: 2.3,
  defensive_contribution_per_90: 1.8,
  dreamteam_count: 3,
  saves_per_90: 0.0,
  clean_sheets_per_90: 0.3
}
```

---

### 4. GitHub CSV - Current Gameweek

**Source:** `https://raw.githubusercontent.com/ncklr/FPL-Elo-Insights/main/data/2024-25/By Gameweek/GW{N}/player_gameweek_stats.csv`
**Code Location:** [backend/server.js:295-324](../backend/server.js)
**Availability:** Only if current gameweek is finished (`event.finished === true`)
**Format:** CSV parsed to JSON objects
**Storage:** `player.github_gw` after enrichment

#### 4.1 Current Gameweek Stats Fields

**Primary Usage:** "My Team" table showing current GW performance

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `id` | `number` | Player ID | Player matching ([data.js:134](../frontend/src/data.js)) | `301` |
| `minutes` | `number` | Minutes played in this GW | My Team table ([render.js:330](../frontend/src/render.js)) | `90` |
| `total_points` | `number` | Points scored in this GW | My Team table ([render.js:331](../frontend/src/render.js)) | `8` |
| `goals_scored` | `number` | Goals in this GW | Enrichment ([data.js:140](../frontend/src/data.js)) | `1` |
| `assists` | `number` | Assists in this GW | Enrichment ([data.js:141](../frontend/src/data.js)) | `1` |
| `clean_sheets` | `number` | Clean sheets in this GW (1 or 0) | Enrichment ([data.js:142](../frontend/src/data.js)) | `0` |
| `goals_conceded` | `number` | Goals conceded in this GW | Enrichment ([data.js:143](../frontend/src/data.js)) | `2` |
| `bonus` | `number` | Bonus points in this GW | Enrichment ([data.js:144](../frontend/src/data.js)) | `2` |
| `bps` | `number` | BPS score in this GW | Enrichment ([data.js:145](../frontend/src/data.js)) | `45` |
| `saves` | `number` | Saves in this GW (GKP) | Enrichment ([data.js:146](../frontend/src/data.js)) | `0` |
| `expected_goals` | `number` | xG in this GW | Enrichment ([data.js:147](../frontend/src/data.js)) | `0.8` |
| `expected_assists` | `number` | xA in this GW | Enrichment ([data.js:148](../frontend/src/data.js)) | `0.6` |
| `expected_goal_involvements` | `number` | xGI in this GW (xG + xA) | Enrichment ([data.js:149](../frontend/src/data.js)) | `1.4` |
| `defensive_contribution` | `number` | Defensive metric in this GW | Enrichment ([data.js:150](../frontend/src/data.js)) | `1.2` |

**Enriched Player Object:**
```javascript
player.github_gw = {
  gw: 11,  // Which gameweek this data is from
  minutes: 90,
  total_points: 8,
  goals_scored: 1,
  assists: 1,
  clean_sheets: 0,
  goals_conceded: 2,
  bonus: 2,
  bps: 45,
  saves: 0,
  expected_goals: 0.8,
  expected_assists: 0.6,
  expected_goal_involvements: 1.4,
  defensive_contribution: 1.2
}
```

---

### 5. GitHub CSV - Next Gameweek

**Source:** `https://raw.githubusercontent.com/ncklr/FPL-Elo-Insights/main/data/2024-25/By Gameweek/GW{N+1}/player_gameweek_stats.csv`
**Code Location:** [backend/server.js:326-362](../backend/server.js)
**Availability:** For upcoming gameweek
**Format:** CSV parsed to JSON objects
**Storage:** `player.github_transfers` after enrichment

#### 5.1 Next Gameweek Transfer Fields

**Primary Usage:** Transfer trends for upcoming gameweek planning

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `id` | `number` | Player ID | Player matching ([data.js:157](../frontend/src/data.js)) | `301` |
| `transfers_in_event` | `number` | Transfers in for next GW | Enrichment ([data.js:161](../frontend/src/data.js)) | `15234` |
| `transfers_out_event` | `number` | Transfers out for next GW | Enrichment ([data.js:162](../frontend/src/data.js)) | `8765` |

**Enriched Player Object:**
```javascript
player.github_transfers = {
  gw: 12,  // Which gameweek this data is for
  transfers_in: 15234,
  transfers_out: 8765
}
```

**Note:** This gives you forward-looking transfer data beyond what FPL API provides.

---

### 6. FPL Team/Picks API

**Source:**
- Team Info: `https://fantasy.premierleague.com/api/entry/{teamId}/`
- Squad Picks: `https://fantasy.premierleague.com/api/entry/{teamId}/event/{gameweek}/picks/`

**Code Location:** [backend/server.js:366-405](../backend/server.js)
**Primary Usage:** "My Team" analysis feature

#### 6.1 Team Info Fields

**Primary Usage:** Manager statistics card

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `player_first_name` | `string` | Manager's first name | Manager info ([render.js:228](../frontend/src/render.js)) | `"John"` |
| `player_last_name` | `string` | Manager's last name | Manager info ([render.js:228](../frontend/src/render.js)) | `"Smith"` |
| `name` | `string` | Team name | Manager info ([render.js:229](../frontend/src/render.js)) | `"FC Awesome"` |
| `summary_overall_rank` | `number` | Current overall rank | Manager card ([render.js:233](../frontend/src/render.js)) | `1234567` |
| `summary_overall_points` | `number` | Total points this season | Manager card ([render.js:238](../frontend/src/render.js)) | `450` |
| `last_deadline_total_players` | `number` | Total active players in game | Percentile calc ([render.js:234](../frontend/src/render.js)) | `8500000` |
| `current_event` | `number` | Current gameweek | GW reference | `11` |

#### 6.2 Picks Response Fields

**Primary Usage:** Squad display with captain, vice captain, bench

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `picks` | `array` | Array of 15 player picks | Iteration ([render.js:166](../frontend/src/render.js)) | `[{...}, {...}]` |
| `entry_history` | `object` | Gameweek performance stats | Points display ([render.js:210-244](../frontend/src/render.js)) | `{...}` |

#### 6.3 Individual Pick Fields

**Primary Usage:** Squad table with captain/VC badges

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `element` | `number` | Player ID | Get player data ([render.js:286](../frontend/src/render.js)) | `301` |
| `position` | `number` | Squad position (1-15, 1-11=starting) | Sorting ([render.js:166](../frontend/src/render.js)) | `8` |
| `multiplier` | `number` | Points multiplier (2=captain, 0=bench) | Captain detection | `2` |
| `is_captain` | `boolean` | True if captain | Captain badge ([render.js:296-300](../frontend/src/render.js)) | `true` |
| `is_vice_captain` | `boolean` | True if vice captain | VC badge ([render.js:297-301](../frontend/src/render.js)) | `false` |

#### 6.4 Entry History Fields

**Primary Usage:** Gameweek performance summary

| Field Name | Type | Description | Code Usage | Example |
|------------|------|-------------|------------|---------|
| `total_points` | `number` | Points scored this GW | GW points ([render.js:239](../frontend/src/render.js)) | `65` |
| `value` | `number` | Team value in tenths (÷10 for £m) | Team value ([render.js:243](../frontend/src/render.js)) | `1000` = £100.0m |
| `bank` | `number` | Money in bank (tenths) | Bank display ([render.js:244](../frontend/src/render.js)) | `5` = £0.5m |
| `overall_rank` | `number` | Rank after this GW | Historical rank | `1200000` |
| `rank` | `number` | GW rank | Performance metric | `850000` |
| `event_transfers` | `number` | Transfers made this GW | Transfer tracking | `1` |
| `event_transfers_cost` | `number` | Points deducted for transfers | Hit tracking | `0` |
| `points_on_bench` | `number` | Points left on bench | Optimization metric | `8` |

---

## Calculated Fields

These fields are **calculated client-side** from the raw data.

**Code Location:** [frontend/src/utils.js](../frontend/src/utils.js)

### Utility Calculations

| Field Name | Formula | Description | Code Location | Example |
|------------|---------|-------------|---------------|---------|
| **PPM** | `total_points / (now_cost / 10)` | Points per million £ | [utils.js:302-305](../frontend/src/utils.js) | `6.8` |
| **PP90** | `(total_points / minutes) * 90` | Points per 90 minutes | [utils.js:312-315](../frontend/src/utils.js) | `5.2` |
| **Minutes %** | `(minutes / (currentGW * 90)) * 100` | Percentage of available minutes played | [utils.js:323-327](../frontend/src/utils.js) | `75.5%` |
| **Form Trend** | Compares form to points_per_game | `'up'`, `'down'`, or `'stable'` | [utils.js:333-341](../frontend/src/utils.js) | `'up'` |

### Heatmap Values

Used for color-coded table cells. Returns integer 0-10 for styling.

| Field | Range | Code Location |
|-------|-------|---------------|
| **Points Heatmap** | Based on total_points distribution | [utils.js:119-140](../frontend/src/utils.js) |
| **Form Heatmap** | Based on form value | [utils.js:152-168](../frontend/src/utils.js) |
| **PPM Heatmap** | Based on PPM distribution | [utils.js:177-198](../frontend/src/utils.js) |

**Styling:** [utils.js:206-221](../frontend/src/utils.js) - Returns CSS class `heatmap-0` through `heatmap-10`

---

## Risk Analysis Fields

**Code Location:** [frontend/src/risk.js](../frontend/src/risk.js)

Each player gets a `risks` array containing 0+ risk objects based on their data.

### Risk Object Structure

```javascript
{
  type: string,      // Risk category
  severity: string,  // 'high' | 'medium' | 'low'
  icon: string,      // Emoji indicator
  message: string,   // Short description
  details: string    // Full explanation
}
```

### Risk Types

| Type | Severity Levels | Trigger Conditions | Code Location | Icon |
|------|----------------|-------------------|---------------|------|
| **injury** | high, medium, low | `chance_of_playing_next_round < 75` | [risk.js:27-39](../frontend/src/risk.js) | 🔴/🟨/🟢 |
| **suspension** | high, medium | `yellow_cards >= 9` (high), `>= 4` (medium), or `red_cards > 0` | [risk.js:42-60](../frontend/src/risk.js) | 🟥/🟨 |
| **rotation** | medium | `minutes % < 50%` after GW5 | [risk.js:63-73](../frontend/src/risk.js) | 🔄 |
| **form** | medium | `form < 3` after GW3 with 180+ min | [risk.js:75-87](../frontend/src/risk.js) | 📉 |
| **value** | medium | `PPM < median * 0.6` after GW5 | [risk.js:89-98](../frontend/src/risk.js) | 💰 |
| **deadwood** | high | `minutes % === 0` after GW3 | [risk.js:101-109](../frontend/src/risk.js) | 🪵 |
| **price** | low | `cost_change_event < 0` | [risk.js:112-120](../frontend/src/risk.js) | 📉 |

### Risk Severity Definitions

- **high** 🔴 - Immediate action recommended
- **medium** 🟨 - Monitor closely, consider alternatives
- **low** 🟢 - Informational, low priority

---

## Fixture Analysis Fields

**Code Location:** [frontend/src/fixtures.js](../frontend/src/fixtures.js)

### Fixture Difficulty Rating (FDR)

**Scale:** 1 (easiest) to 5 (hardest)

| FDR Value | Classification | CSS Class | Usage |
|-----------|----------------|-----------|-------|
| `1` | Excellent | `fdr-1` | Green background |
| `2` | Good | `fdr-2` | Light green |
| `3` | Average | `fdr-3` | Yellow |
| `4` | Tough | `fdr-4` | Orange |
| `5` | Very Tough | `fdr-5` | Red |

### Calculated Fixture Metrics

| Metric | Type | Description | Code Location |
|--------|------|-------------|---------------|
| **Average FDR** | `number` | Average difficulty over N fixtures | [fixtures.js:122-129](../frontend/src/fixtures.js) |
| **FDR Class** | `string` | Text classification of difficulty | [fixtures.js:136-142](../frontend/src/fixtures.js) |
| **Fixture Swing** | `object` | Change from last 3 to next 3 GWs | [fixtures.js:151-167](../frontend/src/fixtures.js) |
| **Blank GWs** | `array` | Gameweeks with no fixture | [fixtures.js:261-277](../frontend/src/fixtures.js) |
| **Double GWs** | `array` | Gameweeks with 2+ fixtures | [fixtures.js:285-304](../frontend/src/fixtures.js) |

### Fixture Swing Object

```javascript
{
  current: 3.2,      // Avg FDR last 3 GWs
  upcoming: 2.1,     // Avg FDR next 3 GWs
  change: -1.1,      // Difference
  improving: true,   // True if getting easier
  worsening: false   // True if getting harder
}
```

---

## Quick Reference

### By Use Case

#### Building a Player Table

**Commonly Used Fields:**
```javascript
// Display
player.web_name           // Name
player.team               // Team ID → getTeamShortName(id)
player.element_type       // Position ID → getPositionName(id)
player.now_cost / 10      // Price in £m

// Performance
player.total_points       // Total points
player.form               // Recent form
player.event_points       // This GW points

// Value
calculatePPM(player)      // Points per million
calculatePP90(player)     // Points per 90

// Ownership
player.selected_by_percent

// Fixtures
getFixtures(player.team, 5)  // Next 5 fixtures
calculateFixtureDifficulty(player.team, 5)  // Avg FDR

// Risk
analyzePlayerRisks(player)   // Risk array
```

#### Risk Assessment

**Required Fields:**
```javascript
player.chance_of_playing_next_round  // Injury
player.yellow_cards                  // Suspension
player.red_cards                     // Suspension
player.minutes                       // Rotation
player.form                          // Form
player.total_points                  // Value (for PPM)
player.now_cost                      // Value (for PPM)
player.cost_change_event            // Price drops
```

#### Fixture Analysis

**Required Fields:**
```javascript
player.team              // Team ID
player.team_code         // Team code
fplFixtures              // Fixtures array
fplBootstrap.teams       // Teams array
```

#### Transfer Committee (Top Performers)

**Required Fields:**
```javascript
player.element_type      // Position filtering
player.total_points      // Sorting
player.now_cost          // Price
player.form              // Form
player.selected_by_percent  // Ownership
getFixtures(player.team, 5)  // Fixtures
```

#### Differentials

**Filters:**
```javascript
player.selected_by_percent < 5  // Low ownership
player.total_points > threshold  // Good points
player.minutes > minimum        // Actually playing
```

### By Data Source

#### FPL API Only
```javascript
player.id, player.web_name, player.element_type, player.team,
player.now_cost, player.total_points, player.form, player.minutes,
player.selected_by_percent, player.chance_of_playing_next_round,
player.yellow_cards, player.red_cards, player.event_points
```

#### GitHub Season Stats Only
```javascript
player.github_season.form
player.github_season.value_form
player.github_season.ict_index
player.github_season.dreamteam_count
```

#### GitHub Current GW Only
```javascript
player.github_gw.minutes
player.github_gw.total_points
player.github_gw.expected_goals
player.github_gw.expected_assists
```

#### Calculated Only
```javascript
calculatePPM(player)
calculatePP90(player)
calculateMinutesPercentage(player, currentGW)
analyzePlayerRisks(player)
getFixtures(player.team, count)
```

---

## Notes for Future Development

### Data Quality

1. **GitHub CSV Availability:**
   - Season stats: Always available
   - Current GW: Only after GW finishes
   - Next GW: Available before GW starts

2. **Missing Data Handling:**
   - Check `player.github_season`, `player.github_gw`, `player.github_transfers` existence before use
   - Graceful fallback if GitHub data unavailable

3. **Type Inconsistencies:**
   - FPL API returns some numbers as strings (e.g., `form`, `value_season`)
   - Always parse when doing calculations: `parseFloat(player.form)`

### Performance Considerations

1. **Large Datasets:**
   - 500+ players × 75+ fields = ~37,500 data points
   - Filter before enriching for better performance
   - Use memo/cache for calculated fields

2. **API Rate Limits:**
   - Backend cache handles this (12h or 30min TTL)
   - Don't bypass cache unless necessary

### Future Enhancements

Potential new calculated fields:

```javascript
// Advanced Value Metrics
player.roi = (player.total_points - player.cost_at_purchase) / player.cost_at_purchase

// Fixture-Adjusted Metrics
player.expected_points_next_5 = calculateExpectedPoints(player, next5Fixtures)

// Consistency Metrics
player.haul_frequency = (gwsWithScore >= 10) / totalGWs
player.blank_frequency = (gwsWithScore === 0) / totalGWs

// Team Metrics
player.team_strength = fplBootstrap.teams.find(t => t.id === player.team).strength
```

---

**End of Data Dictionary**
