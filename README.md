# FPLanner

Fantasy Premier League analysis tool with smart caching, multi-source data enrichment, and comprehensive player analytics.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20.0.0
- npm or yarn

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Development

```bash
# Terminal 1: Start backend server (port 3001)
cd backend
npm start

# Terminal 2: Start frontend dev server (port 5173)
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### Production Build

```bash
# Build frontend
cd frontend
npm run build

# Start production server (serves frontend + API)
cd ../backend
NODE_ENV=production ALLOWED_ORIGIN=https://yourdomain.com npm start
```

## 📁 Project Structure

```
fplanner/
├── frontend/              # Vite + Vanilla JS SPA
│   ├── src/
│   │   ├── main.js       # App initialization & navigation (483 lines)
│   │   ├── render.js     # UI rendering - ALL pages (2,052 lines) ⚠️ SPLIT THIS
│   │   ├── data.js       # API client & data enrichment (223 lines)
│   │   ├── utils.js      # Calculations, formatters, heatmaps (455 lines)
│   │   ├── risk.js       # Player risk analysis (361 lines)
│   │   ├── fixtures.js   # Fixture difficulty analysis (351 lines)
│   │   └── styles.css    # CSS custom properties & themes
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/              # Express.js API server
│   ├── server.js        # All backend logic (706 lines)
│   ├── cache-backup.json # Persistent cache file
│   └── package.json
│
└── docs/                 # Documentation
    ├── DATA_DICTIONARY.md           # Complete field reference (691 lines) ⭐
    ├── FIELD_REFERENCE.md           # Quick lookup guide
    ├── MY_TEAM_IMPROVEMENTS.md      # My Team feature docs
    ├── DATA_ANALYSIS_ENHANCEMENTS.md
    └── CONTRIBUTING.md              # Claude Code development guide
```

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- Build Tool: Vite 5.0.8
- Styling: TailwindCSS 3.4.0 + CSS Custom Properties
- Framework: Vanilla JavaScript (ES Modules)
- Icons: Font Awesome 6.4.0
- Typography: Google Fonts (Inter)

**Backend:**
- Runtime: Node.js >= 20.0.0
- Framework: Express.js 4.18.2
- HTTP Client: Axios 1.6.2
- CSV Parser: PapaParse 5.4.1
- Security: helmet, express-rate-limit

### Data Sources

1. **FPL Official API**
   - Bootstrap (player/team/GW data)
   - Fixtures (match schedule & FDR)
   - Team/Picks (user squad data)

2. **GitHub CSV (FPL-Elo-Insights)**
   - Season stats (always available)
   - Current GW stats (if finished)
   - Next GW transfers (for planning)

### Smart Caching System

**Adaptive TTL:**
- GW in progress: 30-minute refresh
- GW finished: 12-hour refresh
- Fixtures: 12-hour refresh
- GitHub data: Era-based (morning/evening detection)

**Features:**
- Graceful degradation (serves stale cache on error)
- Persistent disk backup (survives server restarts)
- Request deduplication (prevents parallel fetch stampede)

## 📊 Key Features

### My Team Analysis
- Current GW performance
- Risk indicators (injury, suspension, rotation, form)
- Next 5 fixture difficulty
- Team analytics cards (bench points, avg PPM, etc.)

### Transfer Committee
- Top performers by position
- Fixture swing analysis
- Value recommendations

### Data Analysis
- Position-specific tables (GKP, DEF, MID, FWD)
- Best value (PPM)
- Form stars
- Defensive contribution metrics
- Differential finder with filters

## 🔐 Security

### Implemented Protections
- ✅ Helmet security headers
- ✅ Rate limiting (100 requests/15min per IP)
- ✅ CORS restrictions
- ✅ Input validation
- ✅ XSS protection (escapeHtml)
- ✅ CSP headers
- ✅ SRI on CDN links
- ✅ Request size limiting (1MB)
- ✅ Sanitized error messages in production

### Environment Variables

```bash
# Backend
PORT=3001                          # Server port (default: 3001)
NODE_ENV=production                # Environment mode
ALLOWED_ORIGIN=https://yourdomain.com  # CORS allowed origin
```

## 🧪 Testing

⚠️ **No tests currently!** This is a HIGH priority gap.

**Recommended test structure:**
```bash
frontend/
├── tests/
│   ├── utils.test.js      # Calculations (PPM, PP90, etc.)
│   ├── risk.test.js       # Risk analysis logic
│   └── fixtures.test.js   # Fixture difficulty calculations

backend/
├── tests/
│   ├── api.test.js        # Endpoint tests
│   └── cache.test.js      # Cache logic tests
```

**To add testing:**
```bash
# Frontend (Vitest)
cd frontend
npm install -D vitest @vitest/ui

# Backend (Jest)
cd backend
npm install -D jest supertest
```

## 📝 Development Conventions

### For Claude Code Development

1. **Always read docs/ first** before implementing features
2. **Security checklist**:
   - Validate all inputs
   - Escape HTML when using innerHTML
   - Don't expose detailed errors in production
3. **Code style**: Match existing patterns
4. **Before adding features**: Check DATA_DICTIONARY.md for available fields

### Common Patterns

**Calculating PPM:**
```javascript
import { calculatePPM } from './utils.js';
const ppm = calculatePPM(player); // player.total_points / (player.now_cost / 10)
```

**Getting fixtures:**
```javascript
import { getFixtures, calculateFixtureDifficulty } from './fixtures.js';
const next5 = getFixtures(player.team, 5, false); // Next 5 fixtures
const avgFDR = calculateFixtureDifficulty(player.team, 5); // 1.0-5.0
```

**Risk analysis:**
```javascript
import { analyzePlayerRisks } from './risk.js';
const risks = analyzePlayerRisks(player); // Array of risk objects
```

### Important Data Quirks

1. **FPL API returns some numbers as strings:**
   ```javascript
   parseFloat(player.form)             // ✅ Always parse
   parseFloat(player.selected_by_percent)
   ```

2. **Price is in tenths:**
   ```javascript
   player.now_cost / 10  // 125 → £12.5m
   ```

3. **Check GitHub data existence:**
   ```javascript
   if (player.github_season) {
       const defCon = player.github_season.defensive_contribution_per_90;
   }
   ```

## 🚨 Known Issues & TODOs

### High Priority
- [ ] **Split render.js** into separate page modules (currently 2,052 lines)
- [ ] **Add test suite** (utils, risk, fixtures, API endpoints)
- [ ] **Add TypeScript** or JSDoc type hints

### Medium Priority
- [ ] Implement code splitting (lazy load pages)
- [ ] Add request deduplication to prevent parallel fetch stampede
- [ ] Move inline styles to TailwindCSS classes
- [ ] Add error boundaries
- [ ] Implement pm2 for process management

### Low Priority
- [ ] Column sorting on tables
- [ ] User preferences (save default position filters)
- [ ] Export data to CSV

## 📚 Documentation

- **[DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md)** - Complete field reference (start here!)
- **[FIELD_REFERENCE.md](docs/FIELD_REFERENCE.md)** - Quick lookup guide
- **[MY_TEAM_IMPROVEMENTS.md](docs/MY_TEAM_IMPROVEMENTS.md)** - My Team feature changelog
- **[DATA_ANALYSIS_ENHANCEMENTS.md](docs/DATA_ANALYSIS_ENHANCEMENTS.md)** - Data Analysis changelog
- **[CONTRIBUTING.md](docs/CONTRIBUTING.md)** - Guide for Claude Code development

## 🤝 Contributing

This project is designed for development with Claude Code. See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

**Before making changes:**
1. Read the relevant docs/ file
2. Check existing patterns in the codebase
3. Add tests for new features
4. Follow security best practices

## 📄 License

MIT

## 🙏 Acknowledgments

- **FPL Official API** - Player and fixture data
- **FPL-Elo-Insights** (GitHub) - Enhanced stats and defensive metrics
- Built with Claude Code

---

**Version:** 1.0.0
**Last Updated:** 2025-11-15
