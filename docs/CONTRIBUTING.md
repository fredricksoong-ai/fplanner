# Contributing to FPLanner with Claude Code

This guide is specifically designed for development with Claude Code. Following these guidelines will help Claude make accurate, safe, and maintainable changes to the codebase.

## 📚 Before Starting Any Task

### 1. Read Documentation First
Always start by reading the relevant documentation:

| Task Type | Read First |
|-----------|-----------|
| Adding metrics/columns | [DATA_DICTIONARY.md](DATA_DICTIONARY.md), [FIELD_REFERENCE.md](FIELD_REFERENCE.md) |
| Modifying My Team page | [MY_TEAM_IMPROVEMENTS.md](MY_TEAM_IMPROVEMENTS.md) |
| Modifying Data Analysis | [DATA_ANALYSIS_ENHANCEMENTS.md](DATA_ANALYSIS_ENHANCEMENTS.md) |
| Understanding data flow | [DATA_DICTIONARY.md](DATA_DICTIONARY.md#data-flow) |
| Any new feature | README.md + relevant doc above |

### 2. Understand the Architecture
```
User Request
    ↓
Read docs/ (understand context)
    ↓
Plan changes (identify affected files)
    ↓
Write tests (if applicable)
    ↓
Implement changes
    ↓
Test locally
    ↓
Commit with clear message
```

## 🔐 Security-First Development

### Critical Rules (NEVER SKIP)

#### 1. Input Validation
**Always validate user inputs on the backend:**

```javascript
// ❌ BAD - No validation
app.get('/api/team/:teamId', (req, res) => {
  const { teamId } = req.params;
  fetchTeamData(teamId); // Dangerous!
});

// ✅ GOOD - Validated
app.get('/api/team/:teamId', (req, res) => {
  const { teamId } = req.params;

  if (!isValidTeamId(teamId)) {
    return res.status(400).json({ error: 'Invalid team ID' });
  }

  fetchTeamData(teamId);
});
```

#### 2. XSS Protection
**Always escape HTML when using innerHTML:**

```javascript
// ❌ BAD - XSS vulnerability
container.innerHTML = `<p>Loading team ${teamId}...</p>`;

// ✅ GOOD - Escaped
import { escapeHtml } from './utils.js';
container.innerHTML = `<p>Loading team ${escapeHtml(teamId)}...</p>`;
```

**Rule:** If a variable is user-controlled or comes from an API, escape it!

#### 3. Error Messages
**Don't expose internal details in production:**

```javascript
// ❌ BAD - Exposes stack trace
catch (err) {
  res.status(500).json({ error: err.message });
}

// ✅ GOOD - Safe production messages
catch (err) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Failed to fetch data',
    message: isProduction ? 'Temporarily unavailable' : err.message
  });
}
```

## 📝 Code Style Guide

### File Organization

#### Frontend Modules
```
frontend/src/
├── main.js        # Navigation, initialization, theme
├── render.js      # UI rendering (⚠️ SPLIT THIS INTO MODULES)
├── data.js        # API client, data enrichment
├── utils.js       # Pure functions (calculations, formatting)
├── risk.js        # Risk analysis logic
└── fixtures.js    # Fixture difficulty logic
```

**Rule:** Keep modules focused. If a file exceeds 500 lines, consider splitting.

#### Import Order
```javascript
// 1. CSS imports
import './styles.css';

// 2. Data/API modules
import { loadFPLData, currentGW } from './data.js';

// 3. Utility functions
import { calculatePPM, escapeHtml } from './utils.js';

// 4. Feature modules
import { analyzePlayerRisks } from './risk.js';
import { getFixtures } from './fixtures.js';
```

### Naming Conventions

```javascript
// Functions: camelCase, descriptive verbs
function calculatePPM(player) { }
function renderMyTeam(teamData) { }

// Variables: camelCase, descriptive nouns
const currentGW = 11;
const fplBootstrap = data.bootstrap;

// Constants: UPPER_SNAKE_CASE
const TTL_GW_LIVE = 30 * 60 * 1000;
const FPL_BASE_URL = 'https://...';

// Files: kebab-case (or camelCase for modules)
// my-team-page.js  OR  renderMyTeam.js
```

### Comments

```javascript
/**
 * Calculate points per million for a player
 * @param {Object} player - Player object from FPL API
 * @param {number} player.total_points - Season total points
 * @param {number} player.now_cost - Price in tenths (÷10 for £m)
 * @returns {number} Points per million (1 decimal)
 */
export function calculatePPM(player) {
  if (!player.total_points || !player.now_cost) return 0;
  return parseFloat((player.total_points / (player.now_cost / 10)).toFixed(1));
}
```

**When to comment:**
- Complex algorithms (risk analysis, fixture swing)
- Non-obvious business logic
- Data quirks (e.g., "FPL API returns strings, must parse")
- Security considerations ("Escape HTML to prevent XSS")

## 🧪 Testing Guidelines

### Test-Driven Development (Recommended)

**Workflow:**
1. Write test first (defines expected behavior)
2. Implement feature to pass test
3. Refactor if needed

**Example: Adding a new calculation**

```javascript
// tests/utils.test.js
import { describe, test, expect } from 'vitest';
import { calculatePP90 } from '../src/utils.js';

describe('calculatePP90', () => {
  test('calculates points per 90 minutes correctly', () => {
    const player = {
      total_points: 100,
      minutes: 810 // 9 games * 90 min
    };

    const pp90 = calculatePP90(player);
    expect(pp90).toBe(11.11); // 100 / (810/90) = 11.11
  });

  test('returns 0 for players with no minutes', () => {
    const player = { total_points: 0, minutes: 0 };
    expect(calculatePP90(player)).toBe(0);
  });
});
```

### What to Test

| Priority | What | Why |
|----------|------|-----|
| **High** | utils.js calculations | Pure functions, easy to test, critical |
| **High** | risk.js analysis logic | Business logic, edge cases |
| **Medium** | fixtures.js calculations | Important but less complex |
| **Medium** | API endpoints | Integration tests, cache behavior |
| **Low** | Rendering functions | More effort, less ROI |

## 🎯 Common Tasks

### Task 1: Adding a New Metric Column

**Example: Add "Bonus Points Per Game" to My Team**

1. **Check if data exists** (DATA_DICTIONARY.md):
   ```javascript
   // player.bonus exists ✅
   // player.points_per_game exists ✅
   ```

2. **Create calculation** (if needed):
   ```javascript
   // utils.js
   export function calculateBonusPerGame(player, currentGW) {
     if (!currentGW || currentGW === 0) return 0;
     return (player.bonus / currentGW).toFixed(2);
   }
   ```

3. **Add to table** (render.js):
   ```javascript
   // In renderTeamRows() or similar
   const bonusPerGame = calculateBonusPerGame(player, getCurrentGW());

   // Add column header
   <th>Bonus/G</th>

   // Add cell
   <td>${bonusPerGame}</td>
   ```

4. **Test** (tests/utils.test.js):
   ```javascript
   test('calculateBonusPerGame divides bonus by gameweeks', () => {
     const player = { bonus: 15 };
     expect(calculateBonusPerGame(player, 10)).toBe('1.50');
   });
   ```

### Task 2: Adding a New Page

1. **Create render function** (render.js or new module):
   ```javascript
   export function renderNewPage() {
     const container = document.getElementById('app-container');
     container.innerHTML = `
       <div>
         <h1>New Page</h1>
         ${escapeHtml(userInput)} <!-- ✅ ALWAYS ESCAPE -->
       </div>
     `;
   }
   ```

2. **Add route** (main.js):
   ```javascript
   function renderPage() {
     switch (currentPage) {
       case 'my-team': return renderMyTeamPage();
       case 'new-page': return renderNewPage(); // Add here
       // ...
     }
   }
   ```

3. **Add navigation** (main.js setupNavigation):
   ```javascript
   const pages = [
     { id: 'my-team', label: 'My Team', icon: 'fa-users' },
     { id: 'new-page', label: 'New Page', icon: 'fa-star' }, // Add
   ];
   ```

### Task 3: Fixing a Bug

1. **Reproduce the bug** (understand the issue)
2. **Write a failing test** (captures the bug)
3. **Fix the code** (test should pass)
4. **Verify manually** (test in browser)
5. **Commit** with clear message: `fix: XYZ issue in ABC module`

## ⚠️ Common Pitfalls

### 1. FPL API String Numbers
```javascript
// ❌ BAD
if (player.form > 5) { } // form is a STRING!

// ✅ GOOD
if (parseFloat(player.form) > 5) { }
```

**Fields that are strings:**
- `form`
- `value_form`
- `value_season`
- `selected_by_percent`
- `points_per_game`
- `ict_index`, `influence`, `creativity`, `threat`

### 2. GitHub Data Availability
```javascript
// ❌ BAD - Will crash if undefined
const defCon = player.github_season.defensive_contribution_per_90;

// ✅ GOOD - Check existence first
const defCon = player.github_season?.defensive_contribution_per_90 || 0;

// OR
if (player.github_season) {
  const defCon = player.github_season.defensive_contribution_per_90;
}
```

### 3. render.js is Too Large
```javascript
// ❌ BAD - Adding more to render.js (already 2,052 lines)

// ✅ GOOD - Split into modules first:
// - renderMyTeam.js
// - renderTransferCommittee.js
// - renderDataAnalysis.js
// - renderSearch.js
```

### 4. Inline Event Handlers
```javascript
// ⚠️ CURRENT PATTERN (not ideal but used throughout)
<button onclick="window.loadTeam()">Load</button>

// ✅ BETTER (for new code)
// Use event delegation or addEventListener
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-action="load-team"]')) {
    loadTeam();
  }
});
```

## 🔄 Git Workflow

### Commit Messages

**Format:**
```
<type>: <description>

[optional body]
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting, no logic change)
- `refactor:` Code restructuring (no feature/fix)
- `test:` Adding tests
- `chore:` Build process, dependencies

**Examples:**
```bash
git commit -m "feat: add bonus per game column to My Team"
git commit -m "fix: escape teamId in loading message (XSS)"
git commit -m "refactor: split render.js into page modules"
git commit -m "test: add tests for calculatePPM function"
```

### Branch Strategy

- `main` - Production-ready code
- `claude/*` - Feature branches created by Claude Code
- Create branch per feature/fix
- Squash commits when merging

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] No console.log() statements (or use proper logging)
- [ ] Environment variables set:
  - `NODE_ENV=production`
  - `ALLOWED_ORIGIN=https://yourdomain.com`
- [ ] Security headers enabled (helmet)
- [ ] Rate limiting configured
- [ ] HTTPS enabled
- [ ] Error messages sanitized
- [ ] Build frontend: `npm run build`

## 📊 Performance Guidelines

### Frontend
- Avoid unnecessary re-renders
- Use `escapeHtml()` only once per value
- Debounce search inputs (already in utils.js)
- Lazy load images (if adding player photos)

### Backend
- Cache responses appropriately
- Use request deduplication for parallel requests
- Monitor cache hit/miss ratio (`/api/stats`)

## 🆘 When Things Go Wrong

### Debug Checklist

1. **Check browser console** for errors
2. **Check backend logs** for API errors
3. **Verify data exists** (DATA_DICTIONARY.md)
4. **Check cache** (`/api/stats` endpoint)
5. **Clear localStorage** (may have stale team data)
6. **Restart servers** (frontend + backend)

### Common Errors

**"Cannot read property 'X' of undefined"**
→ Check if GitHub data loaded: `if (player.github_season) { }`

**"Failed to fetch"**
→ Backend not running or CORS issue

**"Invalid team ID"**
→ Input validation rejecting request (check format)

**Stale data**
→ Force refresh: `/api/fpl-data?refresh=true`

## 📖 Additional Resources

- [DATA_DICTIONARY.md](DATA_DICTIONARY.md) - Complete field reference
- [FIELD_REFERENCE.md](FIELD_REFERENCE.md) - Quick lookup
- [Vite Documentation](https://vitejs.dev/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Remember:** When in doubt, ask! Claude Code works best with clear context. Reference specific files, line numbers, and documentation to get accurate help.

**Last Updated:** 2025-11-15
