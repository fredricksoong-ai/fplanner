# Field Reference - Quick Lookup

**Quick reference for building analysis tables and selecting columns**

Jump to: [All Fields Alphabetical](#all-fields-alphabetical) | [By Data Source](#by-data-source) | [By Use Case](#by-use-case) | [Common Table Templates](#common-table-templates)

---

## All Fields Alphabetical

Quick lookup of every available field across all data sources.

| Field Name | Source | Type | Example | Notes |
|------------|--------|------|---------|-------|
| `assists` | FPL API | number | `8` | Season total |
| `bonus` | FPL API | number | `12` | Season total bonus points |
| `bps` | FPL API | number | `456` | Season total BPS score |
| `chance_of_playing_next_round` | FPL API | number\|null | `75` | 0-100%, null = 100% |
| `clean_sheets` | FPL API | number | `6` | Season total |
| `clean_sheets_per_90` | GitHub Season | number | `0.3` | Rate stat |
| `cost_change_event` | FPL API | number | `-1` | Price change in tenths |
| `creativity` | FPL API | string | `"623.8"` | ICT component |
| `defensive_contribution` | GitHub Season | number | `2.3` | Defensive metric |
| `defensive_contribution_per_90` | GitHub Season | number | `1.8` | Rate stat |
| `dreamteam_count` | FPL/GitHub | number | `3` | Times in dream team |
| `element_type` | FPL API | number | `3` | 1=GKP,2=DEF,3=MID,4=FWD |
| `ep_next` | FPL API | string\|null | `"4.8"` | Expected points next GW |
| `ep_this` | FPL API | string\|null | `"5.2"` | Expected points this GW |
| `event_points` | FPL API | number | `8` | Points this GW |
| `expected_assists` | GitHub GW | number | `0.6` | xA this GW |
| `expected_goal_involvements` | GitHub GW | number | `1.4` | xGI this GW |
| `expected_goal_involvements_per_90` | FPL API | number | `0.62` | xGI per 90 (season) |
| `expected_goals` | GitHub GW | number | `0.8` | xG this GW |
| `expected_goals_conceded_per_90` | FPL API | number | `0.85` | xGC per 90 |
| `first_name` | FPL API | string | `"Mohamed"` | Player first name |
| `form` | FPL/GitHub | string/number | `"5.2"` | Recent form average |
| `goals_conceded` | FPL API | number | `14` | Season total (GKP/DEF) |
| `goals_scored` | FPL API | number | `12` | Season total |
| `github_gw` | GitHub GW | object | `{...}` | Current GW stats object |
| `github_season` | GitHub Season | object | `{...}` | Season stats object |
| `github_transfers` | GitHub Next GW | object | `{...}` | Transfer stats object |
| `ict_index` | FPL/GitHub | string/number | `"20.5"` | ICT Index score |
| `id` | FPL API | number | `301` | Unique player ID |
| `in_dreamteam` | FPL API | boolean | `false` | In current GW dream team |
| `influence` | FPL API | string | `"582.4"` | ICT component |
| `minutes` | FPL API | number | `810` | Season total minutes |
| `news` | FPL API | string | `"Knee injury..."` | Injury/availability news |
| `news_added` | FPL API | string\|null | `"2025-11-14..."` | News timestamp |
| `now_cost` | FPL API | number | `125` | Price in tenths (÷10) |
| `penalties_missed` | FPL API | number | `0` | Season total |
| `penalties_order` | FPL API | number\|null | `1` | Penalty taker order |
| `penalties_saved` | FPL API | number | `1` | Season total (GKP) |
| `points_per_game` | FPL API | string | `"4.7"` | Average PPG |
| `red_cards` | FPL API | number | `0` | Season total |
| `saves` | FPL API | number | `45` | Season total (GKP) |
| `saves_per_90` | GitHub Season | number | `3.2` | Rate stat (GKP) |
| `second_name` | FPL API | string | `"Salah"` | Player surname |
| `selected_by_percent` | FPL API | string | `"32.5"` | Ownership % |
| `status` | FPL API | string | `"a"` | a/d/i/u/s |
| `team` | FPL API | number | `10` | Team ID (1-20) |
| `team_code` | FPL API | number | `8` | Official team code |
| `threat` | FPL API | string | `"845.0"` | ICT component |
| `total_points` | FPL API | number | `85` | Season total points |
| `transfers_in` | FPL API | number | `1234567` | Season total |
| `transfers_in_event` | FPL/GitHub | number | `45678` | This/next GW |
| `transfers_out` | FPL API | number | `987654` | Season total |
| `transfers_out_event` | FPL/GitHub | number | `12345` | This/next GW |
| `value_form` | FPL/GitHub | string/number | `"0.4"` | Form / price |
| `value_season` | FPL/GitHub | string/number | `"6.8"` | Points / price |
| `web_name` | FPL API | string | `"Salah"` | Display name |
| `yellow_cards` | FPL API | number | `4` | Season total |

### Calculated Fields (Functions)

| Field Name | Function | Returns | Example |
|------------|----------|---------|---------|
| PPM | `calculatePPM(player)` | number | `6.8` |
| PP90 | `calculatePP90(player)` | number | `5.2` |
| Minutes % | `calculateMinutesPercentage(player, currentGW)` | number | `75.5` |
| Fixtures | `getFixtures(player.team, count)` | array | `[{...}, {...}]` |
| FDR | `calculateFixtureDifficulty(player.team, count)` | number | `2.8` |
| Risks | `analyzePlayerRisks(player)` | array | `[{...}, {...}]` |
| Team Name | `getTeamShortName(player.team)` | string | `"LIV"` |
| Position | `getPositionName(player.element_type)` | string | `"MID"` |
| Heatmap | `getPtsHeatmap(player.total_points, 'pts')` | number | `8` |

---

## By Data Source

### FPL Bootstrap API - Player Fields (50+)

**Always available** | Code: [server.js:176-205](../backend/server.js)

#### Essential Display Fields
```javascript
player.id                    // Unique ID
player.web_name              // "Salah"
player.first_name            // "Mohamed"
player.second_name           // "Salah"
player.element_type          // 1-4 (position)
player.team                  // 1-20 (team ID)
player.now_cost              // Price in tenths
```

#### Performance Fields
```javascript
player.total_points          // Season total
player.event_points          // This GW
player.form                  // Recent average (string)
player.points_per_game       // Season average (string)
player.minutes               // Season total
```

#### Value Fields
```javascript
player.value_form            // Form / price (string)
player.value_season          // Points / price (string)
player.selected_by_percent   // Ownership % (string)
```

#### Attacking Stats
```javascript
player.goals_scored          // Season total
player.assists               // Season total
player.expected_goal_involvements_per_90  // xGI per 90
player.penalties_order       // Penalty taker? (1=first)
player.penalties_missed      // Season total
```

#### Defensive Stats (GKP/DEF)
```javascript
player.clean_sheets          // Season total
player.goals_conceded        // Season total
player.saves                 // Season total (GKP)
player.penalties_saved       // Season total (GKP)
player.expected_goals_conceded_per_90  // xGC per 90
```

#### Bonus System
```javascript
player.bonus                 // Total bonus points
player.bps                   // Total BPS score
player.ict_index             // ICT Index (string)
player.influence             // ICT component (string)
player.creativity            // ICT component (string)
player.threat                // ICT component (string)
```

#### Availability/Risk
```javascript
player.chance_of_playing_next_round  // 0-100 or null
player.status                // "a"/"d"/"i"/"u"/"s"
player.news                  // Injury news text
player.news_added            // Timestamp
player.yellow_cards          // Season total
player.red_cards             // Season total
```

#### Pricing
```javascript
player.cost_change_event     // Price change this GW (tenths)
player.transfers_in          // Season total
player.transfers_out         // Season total
player.transfers_in_event    // This GW
player.transfers_out_event   // This GW
```

#### Achievements
```javascript
player.in_dreamteam          // In current GW dream team?
player.dreamteam_count       // Times in dream team
```

#### FPL Projections
```javascript
player.ep_this               // Expected points this GW (string|null)
player.ep_next               // Expected points next GW (string|null)
```

---

### FPL Fixtures API

**Always available** | Code: [server.js:210-239](../backend/server.js)

```javascript
fixture.event                // Gameweek number
fixture.team_h               // Home team ID
fixture.team_a               // Away team ID
fixture.team_h_difficulty    // Home FDR (1-5)
fixture.team_a_difficulty    // Away FDR (1-5)
fixture.team_h_score         // Home goals (null if not played)
fixture.team_a_score         // Away goals (null if not played)
fixture.finished             // Match complete?
fixture.started              // Match started?
fixture.kickoff_time         // ISO 8601 timestamp
```

---

### GitHub CSV - Season Stats

**Always available** | Code: [server.js:247-293](../backend/server.js)

Accessed via `player.github_season`:

```javascript
player.github_season.form                           // Recent form (number)
player.github_season.value_form                     // Form / price
player.github_season.value_season                   // Points / price
player.github_season.ict_index                      // ICT Index (number)
player.github_season.defensive_contribution         // Defensive metric
player.github_season.defensive_contribution_per_90  // Rate stat
player.github_season.dreamteam_count                // Times in dream team
player.github_season.saves_per_90                   // GKP rate stat
player.github_season.clean_sheets_per_90            // Rate stat
```

**Check existence:** `if (player.github_season) { ... }`

---

### GitHub CSV - Current Gameweek

**Only if current GW finished** | Code: [server.js:295-324](../backend/server.js)

Accessed via `player.github_gw`:

```javascript
player.github_gw.gw                           // Which GW this is
player.github_gw.minutes                      // Minutes this GW
player.github_gw.total_points                 // Points this GW
player.github_gw.goals_scored                 // Goals this GW
player.github_gw.assists                      // Assists this GW
player.github_gw.clean_sheets                 // Clean sheets (1 or 0)
player.github_gw.goals_conceded               // Goals conceded
player.github_gw.bonus                        // Bonus points
player.github_gw.bps                          // BPS score
player.github_gw.saves                        // Saves (GKP)
player.github_gw.expected_goals               // xG this GW
player.github_gw.expected_assists             // xA this GW
player.github_gw.expected_goal_involvements   // xGI this GW
player.github_gw.defensive_contribution       // Defensive metric
```

**Check existence:** `if (player.github_gw) { ... }`

---

### GitHub CSV - Next Gameweek

**For upcoming GW** | Code: [server.js:326-362](../backend/server.js)

Accessed via `player.github_transfers`:

```javascript
player.github_transfers.gw              // Which GW this is for
player.github_transfers.transfers_in    // Transfers in for next GW
player.github_transfers.transfers_out   // Transfers out for next GW
```

**Check existence:** `if (player.github_transfers) { ... }`

---

### FPL Team/Picks API

**User team data** | Code: [server.js:366-405](../backend/server.js)

#### Team Info
```javascript
teamData.player_first_name           // Manager first name
teamData.player_last_name            // Manager last name
teamData.name                        // Team name
teamData.summary_overall_rank        // Current rank
teamData.summary_overall_points      // Total points
teamData.last_deadline_total_players // Total players in game
teamData.current_event               // Current GW
```

#### Picks
```javascript
picksData.picks                      // Array of 15 picks
picksData.entry_history              // GW performance
```

#### Individual Pick
```javascript
pick.element                         // Player ID
pick.position                        // Squad position (1-15)
pick.multiplier                      // 2=captain, 0=bench
pick.is_captain                      // Boolean
pick.is_vice_captain                 // Boolean
```

#### Entry History
```javascript
entry_history.total_points           // Points this GW
entry_history.value                  // Team value (tenths)
entry_history.bank                   // ITB (tenths)
entry_history.overall_rank           // Rank after GW
entry_history.rank                   // GW rank
entry_history.event_transfers        // Transfers made
entry_history.event_transfers_cost   // Points deducted
entry_history.points_on_bench        // Bench points
```

---

## By Use Case

### Standard Player Table

**Recommended columns for general player tables:**

```javascript
// Basic Info
player.web_name                      // Name
getTeamShortName(player.team)        // Team
getPositionName(player.element_type) // Position
player.now_cost / 10                 // Price

// Performance
player.total_points                  // Total Pts
player.form                          // Form
player.selected_by_percent + '%'     // Own %

// Value
calculatePPM(player)                 // PPM
calculatePP90(player)                // PP90

// Fixtures (next 5)
getFixtures(player.team, 5)          // Fixtures array
calculateFixtureDifficulty(player.team, 5)  // Avg FDR
```

**Code Example:**
```javascript
const tableColumns = [
  { field: 'web_name', label: 'Name' },
  { field: 'team', label: 'Team', format: getTeamShortName },
  { field: 'element_type', label: 'Pos', format: getPositionName },
  { field: 'now_cost', label: 'Price', format: v => `£${(v/10).toFixed(1)}m` },
  { field: 'total_points', label: 'Pts' },
  { field: 'form', label: 'Form', format: parseFloat },
  { field: 'selected_by_percent', label: 'Own%', format: v => `${v}%` },
  { field: null, label: 'PPM', calc: calculatePPM },
  { field: null, label: 'Fixtures', calc: p => getFixtures(p.team, 5) }
];
```

---

### Transfer Committee / Top Performers

**For finding best players by position:**

```javascript
// Filtering
player.element_type === position     // Position filter
player.total_points > threshold      // Minimum points
player.minutes > minMinutes          // Actually playing

// Sorting
player.total_points                  // Primary sort

// Display
player.web_name
player.now_cost / 10
player.total_points
player.form
calculatePPM(player)
getFixtures(player.team, 5)
calculateFixtureDifficulty(player.team, 5)
player.selected_by_percent
```

---

### Differentials

**Low ownership, high performance:**

```javascript
// Filters
parseFloat(player.selected_by_percent) < 5.0  // <5% owned
player.total_points > 30                      // Decent points
player.minutes > 180                          // Playing time

// Display
player.web_name
player.selected_by_percent + '%'
player.total_points
player.form
calculatePPM(player)
getFixtures(player.team, 3)
```

---

### My Team Analysis

**Current squad with risks and fixtures:**

```javascript
// Basic Info
player.web_name
player.element_type
player.now_cost / 10

// This GW Performance
player.event_points                  // FPL API
player.github_gw?.minutes            // GitHub (if GW finished)
player.github_gw?.total_points       // GitHub (if GW finished)

// Captain/VC
pick.is_captain                      // From picks data
pick.is_vice_captain                 // From picks data

// Risk Indicators
analyzePlayerRisks(player)           // Full risk array
player.chance_of_playing_next_round  // Injury %
player.news                          // Injury news

// Fixtures
getFixtures(player.team, 5, false)   // Next 5
calculateFixtureDifficulty(player.team, 5)
```

---

### Fixture Analysis

**Comparing teams/players by upcoming fixtures:**

```javascript
// Team-level
getFixtures(teamId, 5, false)                 // Next 5 fixtures
calculateFixtureDifficulty(teamId, 5)         // Avg FDR
getBlankGameweeks(teamId, 8)                  // Blanks in next 8
getDoubleGameweeks(teamId, 8)                 // Doubles in next 8

// Fixture Swing
const swing = {
  current: calculateFixtureDifficulty(teamId, 3, true),   // Last 3
  upcoming: calculateFixtureDifficulty(teamId, 3, false), // Next 3
  change: upcoming - current
};
```

---

### Goalkeeper Comparison

**GKP-specific metrics:**

```javascript
// Standard
player.total_points
player.clean_sheets
player.saves
player.penalties_saved

// Advanced (GitHub)
player.github_season?.saves_per_90
player.github_season?.clean_sheets_per_90

// Defensive
player.expected_goals_conceded_per_90
player.goals_conceded

// Value
calculatePPM(player)
player.now_cost / 10

// Fixtures
calculateFixtureDifficulty(player.team, 5)
```

---

### Defender Comparison

**DEF-specific metrics:**

```javascript
// Defensive
player.clean_sheets
player.goals_conceded
player.expected_goals_conceded_per_90

// Attacking
player.goals_scored
player.assists
player.expected_goal_involvements_per_90

// Advanced (GitHub)
player.github_season?.defensive_contribution
player.github_season?.defensive_contribution_per_90
player.github_season?.clean_sheets_per_90

// Performance
player.total_points
player.bonus
calculatePPM(player)
```

---

### Midfielder/Forward Comparison

**MID/FWD-specific metrics:**

```javascript
// Attacking
player.goals_scored
player.assists
player.expected_goal_involvements_per_90

// Advanced (GitHub GW - if available)
player.github_gw?.expected_goals
player.github_gw?.expected_assists
player.github_gw?.expected_goal_involvements

// Performance
player.total_points
player.bonus
player.bps

// Threat
player.threat                        // ICT component
player.ict_index

// Penalties
player.penalties_order               // 1 = first taker
player.penalties_missed

// Value
calculatePPM(player)
calculatePP90(player)
```

---

### Form Analysis

**Recent performance tracking:**

```javascript
// Recent Form
player.form                          // FPL API (string)
player.github_season?.form           // GitHub (number, better)

// Comparison
player.points_per_game               // Season average
formTrend = player.form > player.points_per_game ? 'up' : 'down'

// Value Form
player.value_form                    // FPL API
player.github_season?.value_form     // GitHub

// Visual
const heatmap = getFormHeatmap(parseFloat(player.form));
const style = getHeatmapStyle(heatmap);
```

---

### Risk Dashboard

**All risk indicators:**

```javascript
// Get all risks
const risks = analyzePlayerRisks(player);

// Risk types available:
risks.filter(r => r.type === 'injury')      // Injury risk
risks.filter(r => r.type === 'suspension')  // Card accumulation
risks.filter(r => r.type === 'rotation')    // Low minutes
risks.filter(r => r.type === 'form')        // Poor form
risks.filter(r => r.type === 'value')       // Poor PPM
risks.filter(r => r.type === 'deadwood')    // No minutes
risks.filter(r => r.type === 'price')       // Price drops

// Individual risk fields
player.chance_of_playing_next_round  // Injury %
player.yellow_cards                  // Suspension risk
player.minutes                       // Rotation risk
player.form                          // Form risk
```

---

### Expected Stats (xG/xA)

**Underlying numbers:**

```javascript
// Season totals (FPL API)
player.expected_goal_involvements_per_90     // xGI per 90
player.expected_goals_conceded_per_90        // xGC per 90 (GKP/DEF)

// This GW (GitHub - if available)
player.github_gw?.expected_goals             // xG this GW
player.github_gw?.expected_assists           // xA this GW
player.github_gw?.expected_goal_involvements // xGI this GW

// Comparison to actual
const xGOverperformance = player.goals_scored -
  (player.expected_goal_involvements_per_90 * player.minutes / 90);
```

---

## Common Table Templates

### Template 1: Overview Table

**Best for: General player browsing**

| Column | Field | Format |
|--------|-------|--------|
| Name | `player.web_name` | - |
| Team | `player.team` | `getTeamShortName()` |
| Pos | `player.element_type` | `getPositionName()` |
| Price | `player.now_cost` | `£X.Xm` |
| Pts | `player.total_points` | - |
| Form | `player.form` | `parseFloat()` |
| Own% | `player.selected_by_percent` | `X.X%` |
| PPM | `calculatePPM(player)` | 1 decimal |
| Next 5 | `getFixtures(player.team, 5)` | Abbreviations |

---

### Template 2: My Team Table

**Best for: Squad analysis**

| Column | Field | Format |
|--------|-------|--------|
| Name | `player.web_name` | With C/VC badge |
| Pos | `player.element_type` | `getPositionName()` |
| Price | `player.now_cost` | `£X.Xm` |
| GW Pts | `player.event_points` | - |
| GW Min | `player.github_gw?.minutes` | If available |
| Risk | `analyzePlayerRisks(player)` | Icons |
| Next 3 | `getFixtures(player.team, 3)` | With FDR colors |
| Status | `player.chance_of_playing_next_round` | % or ✓ |

---

### Template 3: Transfer Targets

**Best for: Finding replacements**

| Column | Field | Format |
|--------|-------|--------|
| Name | `player.web_name` | - |
| Team | `player.team` | Short name |
| Pos | `player.element_type` | Abbreviation |
| Price | `player.now_cost` | `£X.Xm` |
| Pts | `player.total_points` | - |
| PPM | `calculatePPM(player)` | 1 decimal |
| Form | `player.form` | `parseFloat()` |
| Own% | `player.selected_by_percent` | `X.X%` |
| FDR (5) | `calculateFixtureDifficulty(player.team, 5)` | With color |
| Fixtures | `getFixtures(player.team, 5)` | Abbreviations |

---

### Template 4: Detailed Stats

**Best for: Deep analysis**

| Column | Field | Format |
|--------|-------|--------|
| Name | `player.web_name` | - |
| Pos | `player.element_type` | Abbreviation |
| Price | `player.now_cost` | `£X.Xm` |
| Pts | `player.total_points` | - |
| Min | `player.minutes` | - |
| PP90 | `calculatePP90(player)` | 2 decimals |
| G | `player.goals_scored` | - |
| A | `player.assists` | - |
| xGI/90 | `player.expected_goal_involvements_per_90` | 2 decimals |
| Bonus | `player.bonus` | - |
| BPS | `player.bps` | - |

---

### Template 5: Differentials Table

**Best for: Finding hidden gems**

| Column | Field | Format |
|--------|-------|--------|
| Name | `player.web_name` | - |
| Team | `player.team` | Short name |
| Price | `player.now_cost` | `£X.Xm` |
| Own% | `player.selected_by_percent` | `X.X%` ⚠️ if <5% |
| Pts | `player.total_points` | - |
| PPM | `calculatePPM(player)` | 1 decimal |
| Form | `player.form` | With heatmap |
| Next 3 | `getFixtures(player.team, 3)` | With FDR |

---

## Code Location Reference

**Where each category of fields is used:**

| Category | Primary File | Lines |
|----------|-------------|-------|
| Data Fetching | [backend/server.js](../backend/server.js) | 176-405 |
| Data Enrichment | [frontend/src/data.js](../frontend/src/data.js) | 109-166 |
| Player Tables | [frontend/src/render.js](../frontend/src/render.js) | 444-577 |
| Risk Analysis | [frontend/src/risk.js](../frontend/src/risk.js) | 18-123 |
| Fixture Analysis | [frontend/src/fixtures.js](../frontend/src/fixtures.js) | All |
| Calculations | [frontend/src/utils.js](../frontend/src/utils.js) | 302-341 |
| Heatmaps | [frontend/src/utils.js](../frontend/src/utils.js) | 119-221 |

---

## Type Conversion Guide

**Important:** Some FPL API fields are returned as strings and need parsing.

| Field | API Type | Convert To | Method |
|-------|----------|------------|--------|
| `form` | string | number | `parseFloat(player.form)` |
| `value_form` | string | number | `parseFloat(player.value_form)` |
| `value_season` | string | number | `parseFloat(player.value_season)` |
| `selected_by_percent` | string | number | `parseFloat(player.selected_by_percent)` |
| `points_per_game` | string | number | `parseFloat(player.points_per_game)` |
| `ict_index` | string | number | `parseFloat(player.ict_index)` |
| `influence` | string | number | `parseFloat(player.influence)` |
| `creativity` | string | number | `parseFloat(player.creativity)` |
| `threat` | string | number | `parseFloat(player.threat)` |
| `ep_this` | string\|null | number | `ep_this ? parseFloat(ep_this) : null` |
| `ep_next` | string\|null | number | `ep_next ? parseFloat(ep_next) : null` |

**Price conversion:**
```javascript
const priceInPounds = player.now_cost / 10;  // 125 → £12.5m
```

---

## Data Availability Checklist

Before using fields, check availability:

```javascript
// FPL Bootstrap - ALWAYS available
if (fplBootstrap && fplBootstrap.elements) {
  // Use player.* fields
}

// FPL Fixtures - ALWAYS available
if (fplFixtures && fplFixtures.length > 0) {
  // Use fixture analysis
}

// GitHub Season Stats - USUALLY available
if (player.github_season) {
  // Use player.github_season.* fields
}

// GitHub Current GW - Only if GW finished
if (player.github_gw) {
  // Use player.github_gw.* fields
  const gwNumber = player.github_gw.gw;
}

// GitHub Transfers - For next GW
if (player.github_transfers) {
  // Use player.github_transfers.* fields
}

// Team/Picks Data - Only when team loaded
if (teamData && picksData) {
  // Use team analysis features
}
```

---

**For detailed field descriptions, see [DATA_DICTIONARY.md](DATA_DICTIONARY.md)**
