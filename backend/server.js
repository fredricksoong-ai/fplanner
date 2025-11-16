// ============================================================================
// FPLANNER BACKEND SERVICE
// Smart caching for FPL API + GitHub CSV data
// ============================================================================

// Load environment variables from .env file
import 'dotenv/config';

import express from 'express';
import axios from 'axios';
import Papa from 'papaparse';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
const CACHE_BACKUP_PATH = path.join(__dirname, 'cache-backup.json');

// Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// FPL API Endpoints
const FPL_BASE_URL = 'https://fantasy.premierleague.com/api';
// GitHub CSV Base URL (FPL-Elo-Insights)
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/olbauday/FPL-Elo-Insights/main/data/2025-2026';

/**
 * Get GitHub CSV URLs for current context
 */
function getGithubUrls(currentGW, isFinished) {
  return {
    // Season stats (always available)
    seasonStats: `${GITHUB_BASE_URL}/playerstats.csv`,
    
    // Current GW stats (only if GW finished)
    currentGWStats: isFinished ? 
      `${GITHUB_BASE_URL}/By Gameweek/GW${currentGW}/player_gameweek_stats.csv` : 
      null,
    
    // Next GW stats (for transfer data)
    nextGWStats: `${GITHUB_BASE_URL}/By Gameweek/GW${currentGW + 1}/player_gameweek_stats.csv`
  };
}

// Cache TTL Configuration
const TTL = {
  FIXTURES: 12 * 60 * 60 * 1000,      // 12 hours (rarely changes)
  GW_LIVE: 30 * 60 * 1000,            // 30 minutes (during live GW)
  GW_FINISHED: 12 * 60 * 60 * 1000,   // 12 hours (GW finished)
  GITHUB_CHECK_INTERVAL: 5 * 60 * 1000 // Check GitHub era every 5 min
};

// ============================================================================
// CACHE SYSTEM
// ============================================================================

let cache = {
  bootstrap: {
    data: null,
    timestamp: null
  },
  fixtures: {
    data: null,
    timestamp: null
  },
  github: {
    data: null,
    timestamp: null,
    era: null  // 'morning' or 'evening'
  },
  stats: {
    totalFetches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastFetch: null
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current data era based on UTC time
 * Morning: 5am-5pm UTC | Evening: 5pm-5am UTC
 */
function getCurrentEra() {
  const now = new Date();
  const hour = now.getUTCHours();
  return (hour >= 5 && hour < 17) ? 'morning' : 'evening';
}

/**
 * Determine if bootstrap data needs refresh based on GW status
 */
function shouldRefreshBootstrap() {
  if (!cache.bootstrap.data || !cache.bootstrap.timestamp) {
    console.log('🔄 Bootstrap cache empty, needs fetch');
    return true;
  }

  const age = Date.now() - cache.bootstrap.timestamp;
  
  try {
    const currentEvent = cache.bootstrap.data.events.find(e => e.is_current);
    
    if (!currentEvent || currentEvent.finished) {
      // GW finished or between gameweeks
      const shouldRefresh = age > TTL.GW_FINISHED;
      if (shouldRefresh) {
        console.log(`🔄 Bootstrap cache stale (${Math.round(age / 1000 / 60)} min old, GW finished)`);
      }
      return shouldRefresh;
    } else {
      // GW in progress
      const shouldRefresh = age > TTL.GW_LIVE;
      if (shouldRefresh) {
        console.log(`🔄 Bootstrap cache stale (${Math.round(age / 1000 / 60)} min old, GW live)`);
      }
      return shouldRefresh;
    }
  } catch (err) {
    console.error('❌ Error checking bootstrap status:', err.message);
    return true; // Refresh on error
  }
}

/**
 * Determine if fixtures data needs refresh
 */
function shouldRefreshFixtures() {
  if (!cache.fixtures.data || !cache.fixtures.timestamp) {
    console.log('🔄 Fixtures cache empty, needs fetch');
    return true;
  }

  const age = Date.now() - cache.fixtures.timestamp;
  const shouldRefresh = age > TTL.FIXTURES;
  
  if (shouldRefresh) {
    console.log(`🔄 Fixtures cache stale (${Math.round(age / 1000 / 60 / 60)} hours old)`);
  }
  
  return shouldRefresh;
}

/**
 * Determine if GitHub data needs refresh based on era
 */
function shouldRefreshGithub() {
  if (!cache.github.data || !cache.github.timestamp) {
    console.log('🔄 GitHub cache empty, needs fetch');
    return true;
  }

  const currentEra = getCurrentEra();
  const shouldRefresh = cache.github.era !== currentEra;

  if (shouldRefresh) {
    console.log(`🔄 GitHub cache stale (era changed: ${cache.github.era} → ${currentEra})`);
  }

  return shouldRefresh;
}

/**
 * Validate team ID input
 * @param {string} teamId - Team ID to validate
 * @returns {boolean} - True if valid
 */
function isValidTeamId(teamId) {
  // Must be numeric and between 1-10 digits (FPL team IDs are typically 6-7 digits)
  return /^\d{1,10}$/.test(teamId);
}

/**
 * Validate league ID input
 * @param {string} leagueId - League ID to validate
 * @returns {boolean} - True if valid
 */
function isValidLeagueId(leagueId) {
  // Must be numeric and between 1-10 digits (similar to team IDs)
  return /^\d{1,10}$/.test(leagueId);
}

/**
 * Validate gameweek number
 * @param {number} gw - Gameweek number to validate
 * @returns {boolean} - True if valid
 */
function isValidGameweek(gw) {
  return Number.isInteger(gw) && gw >= 1 && gw <= 38;
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

/**
 * Fetch FPL Bootstrap data
 */
async function fetchBootstrap() {
  console.log('📡 Fetching FPL Bootstrap...');
  
  try {
    const response = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });
    
    console.log(`✅ Bootstrap fetched (${Math.round(JSON.stringify(response.data).length / 1024)}KB)`);
    
    cache.bootstrap.data = response.data;
    cache.bootstrap.timestamp = Date.now();
    cache.stats.totalFetches++;
    
    return response.data;
  } catch (err) {
    console.error('❌ Failed to fetch bootstrap:', err.message);
    
    // Return cached data if available, even if stale
    if (cache.bootstrap.data) {
      console.log('⚠️ Using stale bootstrap cache as fallback');
      return cache.bootstrap.data;
    }
    
    throw new Error('Bootstrap data unavailable');
  }
}

/**
 * Fetch FPL Fixtures data
 */
async function fetchFixtures() {
  console.log('📡 Fetching FPL Fixtures...');
  
  try {
    const response = await axios.get(`${FPL_BASE_URL}/fixtures/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });
    
    console.log(`✅ Fixtures fetched (${Math.round(JSON.stringify(response.data).length / 1024)}KB)`);
    
    cache.fixtures.data = response.data;
    cache.fixtures.timestamp = Date.now();
    cache.stats.totalFetches++;
    
    return response.data;
  } catch (err) {
    console.error('❌ Failed to fetch fixtures:', err.message);
    
    // Return cached data if available
    if (cache.fixtures.data) {
      console.log('⚠️ Using stale fixtures cache as fallback');
      return cache.fixtures.data;
    }
    
    throw new Error('Fixtures data unavailable');
  }
}

/**
 * Fetch GitHub CSV data (3-source strategy)
 * - Season stats (always)
 * - Current GW stats (if finished)
 * - Next GW stats (for transfers)
 */
async function fetchGithubCSV() {
  console.log('📡 Fetching GitHub CSV data...');
  
  try {
    // Get current GW from bootstrap
    if (!cache.bootstrap.data) {
      await fetchBootstrap();
    }

    // Find the latest FINISHED game week (not is_current which could be in-progress)
    const finishedEvents = cache.bootstrap.data.events.filter(e => e.finished);
    const latestFinishedGW = finishedEvents.length > 0
      ? Math.max(...finishedEvents.map(e => e.id))
      : 1;
    const currentGW = latestFinishedGW;
    const isFinished = true; // By definition, we're using a finished GW

    console.log(`📊 Latest Finished GW: ${currentGW}`);
    
    const urls = getGithubUrls(currentGW, isFinished);
    
    // Fetch all available sources in parallel
    const fetchPromises = [];
    
    // 1. Season stats (always fetch)
    console.log(`📡 Fetching season stats...`);
    fetchPromises.push(
      axios.get(urls.seasonStats, {
        timeout: 15000,
        headers: { 'User-Agent': 'FPLanner/1.0' }
      })
      .then(res => ({ type: 'season', data: res.data }))
      .catch(err => {
        console.error(`❌ Failed to fetch season stats:`, err.message);
        return null;
      })
    );
    
    // 2. Current GW stats (if finished)
    if (urls.currentGWStats) {
      console.log(`📡 Fetching GW${currentGW} stats...`);
      fetchPromises.push(
        axios.get(urls.currentGWStats, {
          timeout: 15000,
          headers: { 'User-Agent': 'FPLanner/1.0' }
        })
        .then(res => ({ type: 'currentGW', data: res.data }))
        .catch(err => {
          console.warn(`⚠️ GW${currentGW} stats not available yet:`, err.message);
          return null;
        })
      );
    }
    
    // 3. Next GW stats (for transfers)
    console.log(`📡 Fetching GW${currentGW + 1} stats for transfers...`);
    fetchPromises.push(
      axios.get(urls.nextGWStats, {
        timeout: 15000,
        headers: { 'User-Agent': 'FPLanner/1.0' }
      })
      .then(res => ({ type: 'nextGW', data: res.data }))
      .catch(err => {
        console.warn(`⚠️ GW${currentGW + 1} stats not available yet:`, err.message);
        return null;
      })
    );
    
    const results = await Promise.all(fetchPromises);
    
    // Parse CSVs
    const parsedData = {};
    
    for (const result of results.filter(r => r !== null)) {
      const parsed = Papa.parse(result.data, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });
      
      if (parsed.errors.length > 0) {
        console.warn(`⚠️ CSV parsing warnings for ${result.type}:`, parsed.errors.length);
      }
      
      parsedData[result.type] = parsed.data;
      console.log(`✅ Parsed ${result.type}: ${parsed.data.length} players`);
    }
    
    // Store in cache
    cache.github.data = {
      currentGW: currentGW,
      isFinished: isFinished,
      seasonStats: parsedData.season || [],
      currentGWStats: parsedData.currentGW || [],
      nextGWStats: parsedData.nextGW || []
    };
    
    cache.github.timestamp = Date.now();
    cache.github.era = getCurrentEra();
    cache.github.currentGW = currentGW;
    cache.stats.totalFetches++;
    
    console.log(`✅ GitHub data loaded:`);
    console.log(`   Season stats: ${parsedData.season?.length || 0} players`);
    console.log(`   GW${currentGW} stats: ${parsedData.currentGW?.length || 0} players`);
    console.log(`   GW${currentGW + 1} stats: ${parsedData.nextGW?.length || 0} players`);
    
    return cache.github.data;
    
  } catch (err) {
    console.error('❌ Failed to fetch GitHub CSV:', err.message);
    
    if (cache.github.data) {
      console.log('⚠️ Using stale GitHub cache as fallback');
      return cache.github.data;
    }
    
    throw new Error('GitHub data unavailable');
  }
}
/**
 * Fetch user team data
 */
async function fetchTeamData(teamId) {
  console.log(`📡 Fetching team ${teamId}...`);
  
  try {
    const response = await axios.get(`${FPL_BASE_URL}/entry/${teamId}/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });
    
    console.log(`✅ Team ${teamId} fetched`);
    return response.data;
  } catch (err) {
    console.error(`❌ Failed to fetch team ${teamId}:`, err.message);
    throw new Error(`Team data unavailable for team ${teamId}`);
  }
}

/**
 * Fetch user team picks for a specific gameweek
 */
async function fetchTeamPicks(teamId, gameweek) {
  console.log(`📡 Fetching picks for team ${teamId}, GW${gameweek}...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/entry/${teamId}/event/${gameweek}/picks/`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    console.log(`✅ Picks fetched for team ${teamId}, GW${gameweek}`);
    return response.data;
  } catch (err) {
    console.error(`❌ Failed to fetch picks for team ${teamId}:`, err.message);
    throw new Error(`Picks unavailable for team ${teamId}, GW${gameweek}`);
  }
}

/**
 * Fetch league standings
 * @param {string} leagueId - League ID
 * @param {number} page - Page number (default: 1)
 */
async function fetchLeagueStandings(leagueId, page = 1) {
  console.log(`📡 Fetching league ${leagueId} standings (page ${page})...`);

  try {
    const response = await axios.get(`${FPL_BASE_URL}/leagues-classic/${leagueId}/standings/`, {
      timeout: 10000,
      params: { page_standings: page },
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });

    console.log(`✅ League ${leagueId} standings fetched (${response.data.standings.results.length} entries)`);
    return response.data;
  } catch (err) {
    console.error(`❌ Failed to fetch league ${leagueId}:`, err.message);
    throw new Error(`League data unavailable for league ${leagueId}`);
  }
}

// ============================================================================
// CACHE PERSISTENCE
// ============================================================================

/**
 * Load cache from disk on startup
 */
function loadCacheFromDisk() {
  if (fs.existsSync(CACHE_BACKUP_PATH)) {
    try {
      const backup = JSON.parse(fs.readFileSync(CACHE_BACKUP_PATH, 'utf8'));
      
      // Only restore if backup is less than 24 hours old
      const backupAge = Date.now() - (backup.bootstrap?.timestamp || 0);
      if (backupAge < 24 * 60 * 60 * 1000) {
        cache = backup;
        console.log('✅ Cache restored from disk');
        console.log(`   Bootstrap: ${cache.bootstrap.data ? 'loaded' : 'empty'}`);
        console.log(`   Fixtures: ${cache.fixtures.data ? 'loaded' : 'empty'}`);
        console.log(`   GitHub: ${cache.github.data ? 'loaded' : 'empty'}`);
      } else {
        console.log('⚠️ Cache backup too old (>24h), starting fresh');
      }
    } catch (err) {
      console.error('❌ Failed to load cache from disk:', err.message);
      console.log('   Starting with empty cache');
    }
  } else {
    console.log('ℹ️ No cache backup found, starting fresh');
  }
}

/**
 * Save cache to disk
 */
function saveCacheToDisk() {
  try {
    fs.writeFileSync(CACHE_BACKUP_PATH, JSON.stringify(cache, null, 2));
    console.log('💾 Cache backed up to disk');
  } catch (err) {
    console.error('❌ Failed to backup cache:', err.message);
  }
}

// Save cache every 5 minutes
setInterval(saveCacheToDisk, 5 * 60 * 1000);

// Save cache on graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, saving cache...');
  saveCacheToDisk();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, saving cache...');
  saveCacheToDisk();
  process.exit(0);
});

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Vite dev
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false // Needed for external resources
}));

// CORS - Restrict to allowed origins
const allowedOrigins = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3001',  // Backend (for testing)
  process.env.ALLOWED_ORIGIN // Production domain (set via env var)
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false
}));

// Rate limiting - Prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait 15 minutes before trying again'
    });
  }
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Request size limiting
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} [${req.ip}]`);
  next();
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /api/fpl-data
 * Returns combined FPL data (bootstrap + fixtures + github)
 * Query params:
 *   - refresh=true: Force cache refresh
 */
app.get('/api/fpl-data', async (req, res) => {
  const startTime = Date.now();
  const forceRefresh = req.query.refresh === 'true';
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📥 GET /api/fpl-data ${forceRefresh ? '(FORCE REFRESH)' : ''}`);
  
  try {
    // Determine what needs fetching
    const needsBootstrap = forceRefresh || shouldRefreshBootstrap();
    const needsFixtures = forceRefresh || shouldRefreshFixtures();
    const needsGithub = forceRefresh || shouldRefreshGithub();
    
    // Track cache performance
    if (!needsBootstrap && !needsFixtures && !needsGithub) {
      cache.stats.cacheHits++;
      console.log('✨ Full cache hit - returning immediately');
    } else {
      cache.stats.cacheMisses++;
    }
    
    // Fetch data in parallel
    const fetchPromises = [];
    
    if (needsBootstrap) {
      fetchPromises.push(fetchBootstrap());
    } else {
      console.log('✅ Bootstrap cache valid, using cached data');
    }
    
    if (needsFixtures) {
      fetchPromises.push(fetchFixtures());
    } else {
      console.log('✅ Fixtures cache valid, using cached data');
    }
    
    if (needsGithub) {
      fetchPromises.push(fetchGithubCSV());
    } else {
      console.log('✅ GitHub cache valid, using cached data');
    }
    
    // Wait for all fetches
    if (fetchPromises.length > 0) {
      await Promise.all(fetchPromises);
      cache.stats.lastFetch = new Date().toISOString();
    }
    
    // Prepare response
    const response = {
      bootstrap: cache.bootstrap.data,
      fixtures: cache.fixtures.data,
      github: cache.github.data,
      meta: {
        cached: fetchPromises.length === 0,
        bootstrap_age: cache.bootstrap.timestamp ? Date.now() - cache.bootstrap.timestamp : null,
        fixtures_age: cache.fixtures.timestamp ? Date.now() - cache.fixtures.timestamp : null,
        github_age: cache.github.timestamp ? Date.now() - cache.github.timestamp : null,
        github_era: cache.github.era,
        current_era: getCurrentEra(),
        timestamp: new Date().toISOString()
      }
    };
    
    const duration = Date.now() - startTime;
    console.log(`✅ Response ready (${duration}ms)`);
    console.log(`   Cache hits: ${cache.stats.cacheHits}, misses: ${cache.stats.cacheMisses}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    res.json(response);
  } catch (err) {
    console.error('❌ Error in /api/fpl-data:', err.message);

    // Don't expose detailed error messages in production
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'Failed to fetch FPL data',
      message: isProduction ? 'Data temporarily unavailable. Please try again later.' : err.message
    });
  }
});

/**
 * GET /api/team/:teamId
 * Returns user's team data for current gameweek
 */
app.get('/api/team/:teamId', async (req, res) => {
  const { teamId } = req.params;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📥 GET /api/team/${teamId}`);

  // Validate team ID
  if (!isValidTeamId(teamId)) {
    console.warn(`⚠️ Invalid team ID format: ${teamId}`);
    return res.status(400).json({
      error: 'Invalid team ID',
      message: 'Team ID must be a number between 1 and 10 digits'
    });
  }

  try {
    // Ensure we have bootstrap data to get current GW
    if (!cache.bootstrap.data || shouldRefreshBootstrap()) {
      await fetchBootstrap();
    }

    // Find current gameweek
    const currentEvent = cache.bootstrap.data.events.find(e => e.is_current);
    const currentGW = currentEvent ? currentEvent.id : 1;

    console.log(`   Current GW: ${currentGW}`);

    // Fetch team info and picks in parallel
    const [teamInfo, teamPicks] = await Promise.all([
      fetchTeamData(teamId),
      fetchTeamPicks(teamId, currentGW)
    ]);

    const response = {
      team: teamInfo,
      picks: teamPicks,
      gameweek: currentGW,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Team data ready`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json(response);
  } catch (err) {
    console.error(`❌ Error fetching team ${teamId}:`, err.message);

    // Don't expose detailed error messages in production
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(err.message.includes('unavailable') ? 404 : 500).json({
      error: 'Failed to fetch team data',
      message: isProduction ? 'Team not found or unavailable' : err.message
    });
  }
});

/**
 * POST /api/ai-insights
 * Generate AI insights using Gemini API
 * Request body:
 *   - page: string (data-analysis, my-team, etc)
 *   - tab: string (overview, differentials, etc)
 *   - position: string (all, GKP, DEF, MID, FWD)
 *   - gameweek: number
 *   - data: object (page-specific context data)
 */
app.post('/api/ai-insights', async (req, res) => {
  const { page, tab, position, gameweek, data } = req.body;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📥 POST /api/ai-insights [${page}/${tab}/${position}]`);

  // Validate required fields
  if (!page || !tab || !gameweek) {
    console.warn('⚠️ Missing required fields');
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'page, tab, and gameweek are required'
    });
  }

  // Check if Gemini API key is configured
  if (!GEMINI_API_KEY) {
    console.error('❌ Gemini API key not configured');
    return res.status(500).json({
      error: 'AI service not configured',
      message: 'Gemini API key is missing. Please configure GEMINI_API_KEY environment variable.'
    });
  }

  try {
    // Build prompt based on page/tab
    const prompt = buildAIPrompt(page, tab, position, gameweek, data);

    console.log(`🤖 Calling Gemini API...`);

    // Call Gemini API
    const geminiResponse = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.8,
          topK: 40
        }
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Parse Gemini response
    const insights = parseGeminiResponse(geminiResponse.data, gameweek);

    console.log(`✅ AI Insights generated (${insights.items.length} items)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json(insights);

  } catch (error) {
    console.error('❌ Error generating AI insights:', error.message);

    // Don't expose detailed error messages in production
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'Failed to generate insights',
      message: isProduction ? 'AI service temporarily unavailable' : error.message
    });
  }
});

/**
 * GET /api/leagues/:leagueId
 * Returns league standings
 * Query params:
 *   - page: Page number (default: 1)
 */
app.get('/api/leagues/:leagueId', async (req, res) => {
  const { leagueId } = req.params;
  const page = parseInt(req.query.page) || 1;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📥 GET /api/leagues/${leagueId} (page ${page})`);

  // Validate league ID
  if (!isValidLeagueId(leagueId)) {
    console.warn(`⚠️ Invalid league ID format: ${leagueId}`);
    return res.status(400).json({
      error: 'Invalid league ID',
      message: 'League ID must be a number between 1 and 10 digits'
    });
  }

  // Validate page number
  if (page < 1 || page > 100) {
    console.warn(`⚠️ Invalid page number: ${page}`);
    return res.status(400).json({
      error: 'Invalid page number',
      message: 'Page must be between 1 and 100'
    });
  }

  try {
    const leagueData = await fetchLeagueStandings(leagueId, page);

    const response = {
      league: leagueData.league,
      standings: leagueData.standings,
      new_entries: leagueData.new_entries,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ League data ready`);
    console.log(`   League: ${leagueData.league.name}`);
    console.log(`   Entries: ${leagueData.standings.results.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json(response);
  } catch (err) {
    console.error(`❌ Error fetching league ${leagueId}:`, err.message);

    // Don't expose detailed error messages in production
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(err.message.includes('unavailable') ? 404 : 500).json({
      error: 'Failed to fetch league data',
      message: isProduction ? 'League not found or unavailable' : err.message
    });
  }
});

/**
 * Build AI prompt based on context
 */
function buildAIPrompt(page, tab, position, gameweek, data) {
  const positionText = position === 'all' ? 'all positions' : position;

  if (page === 'data-analysis' && tab === 'overview') {
    return `You are an expert Fantasy Premier League analyst. Analyze the following market data for Gameweek ${gameweek} and provide 3-4 actionable insights.

Context:
- Viewing: ${positionText} overview
- Market Data: ${JSON.stringify(data, null, 2)}

Provide insights as a JSON array with this exact structure:
[
  {
    "type": "opportunity|warning|action|insight",
    "title": "Short headline (max 60 chars)",
    "description": "1-2 sentence explanation with specific stats and player names",
    "priority": "high|medium|low"
  }
]

Focus on:
1. Best value players (high PPM, good form)
2. Emerging differentials (low ownership, strong performance)
3. Position-specific trends and comparisons
4. Form vs price analysis

Be concise, data-driven, and actionable. Use actual player names from the data provided.`;
  }

  if (page === 'data-analysis' && tab === 'differentials') {
    return `You are an expert Fantasy Premier League analyst. Analyze the following differential players data for Gameweek ${gameweek} and provide 3-4 actionable insights.

Context:
- Viewing: ${positionText} differentials
- Ownership Threshold: ${data.ownershipThreshold}%
- Players Data: ${JSON.stringify(data, null, 2)}

Provide insights as a JSON array with this exact structure:
[
  {
    "type": "opportunity|warning|action|insight",
    "title": "Short headline (max 60 chars)",
    "description": "1-2 sentence explanation with specific stats and player names",
    "priority": "high|medium|low"
  }
]

Focus on:
1. Transfer momentum alerts (players rising/falling)
2. Price prediction insights
3. Fixture window analysis (next 3-5 gameweeks)
4. Contrarian advantage opportunities

Be concise, data-driven, and actionable. Use actual player names from the data provided.`;
  }

  // Default generic prompt
  return `You are an expert Fantasy Premier League analyst. Provide 3-4 helpful insights for Gameweek ${gameweek} as a JSON array.`;
}

/**
 * Parse Gemini API response into insights structure
 */
function parseGeminiResponse(geminiData, gameweek) {
  try {
    // Extract text from Gemini response
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      throw new Error('No text content in Gemini response');
    }

    // Try to extract JSON from response (handles markdown code blocks)
    let jsonText = text;

    // Remove markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Try to find JSON array directly
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonText = arrayMatch[0];
      }
    }

    // Parse JSON
    const items = JSON.parse(jsonText);

    // Validate structure
    if (!Array.isArray(items)) {
      throw new Error('Parsed response is not an array');
    }

    // Validate and sanitize each item
    const validatedItems = items.map(item => ({
      type: ['opportunity', 'warning', 'action', 'insight'].includes(item.type) ? item.type : 'insight',
      title: String(item.title || 'Insight').substring(0, 80),
      description: String(item.description || '').substring(0, 500),
      priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium'
    }));

    return {
      gameweek: gameweek,
      items: validatedItems,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error('❌ Failed to parse Gemini response:', error);

    // Return fallback insights
    return {
      gameweek: gameweek,
      items: [{
        type: 'insight',
        title: 'AI Analysis Available',
        description: 'AI insights are being generated. Please refresh in a moment.',
        priority: 'low'
      }],
      timestamp: Date.now(),
      parseError: true
    };
  }
}

/**
 * GET /api/stats
 * Returns cache statistics and health info
 */
app.get('/api/stats', (req, res) => {
  const now = Date.now();
  
  res.json({
    uptime: process.uptime(),
    cache: {
      bootstrap: {
        exists: !!cache.bootstrap.data,
        age_ms: cache.bootstrap.timestamp ? now - cache.bootstrap.timestamp : null,
        age_minutes: cache.bootstrap.timestamp ? Math.round((now - cache.bootstrap.timestamp) / 1000 / 60) : null
      },
      fixtures: {
        exists: !!cache.fixtures.data,
        age_ms: cache.fixtures.timestamp ? now - cache.fixtures.timestamp : null,
        age_hours: cache.fixtures.timestamp ? Math.round((now - cache.fixtures.timestamp) / 1000 / 60 / 60) : null
      },
      github: {
        exists: !!cache.github.data,
        age_ms: cache.github.timestamp ? now - cache.github.timestamp : null,
        era: cache.github.era,
        current_era: getCurrentEra(),
        current_gw: cache.github.currentGW,
        season_stats: cache.github.data?.seasonStats?.length || 0,
        current_gw_stats: cache.github.data?.currentGWStats?.length || 0,
        next_gw_stats: cache.github.data?.nextGWStats?.length || 0
      }
    },
    stats: cache.stats,
    memory: {
      used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    gemini_api_configured: !!GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here'
  });
});

// ============================================================================
// SERVE FRONTEND IN PRODUCTION
// ============================================================================

// Serve static files from frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Handle client-side routing - send all non-API, non-asset requests to index.html
app.get('*', (req, res, next) => {
    // Don't intercept requests for files with extensions (JS, CSS, images, etc.)
    // This allows Vite's dynamically imported chunks to load properly
    if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
        return next(); // File with extension - let it 404 if not found
    }

    // All other routes get the SPA
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Load cache from disk before starting server
loadCacheFromDisk();

app.listen(PORT, HOST, () => { 
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 FPLanner Backend Server');
  console.log(`📡 Listening on host ${HOST} and port ${PORT}`); // Update console log
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  /api/fpl-data       - Combined FPL data`);
  console.log(`  GET  /api/fpl-data?refresh=true - Force refresh`);
  console.log(`  GET  /api/team/:teamId   - User team data`);
  console.log(`  POST /api/ai-insights    - AI insights (Gemini)`);
  console.log(`  GET  /api/leagues/:leagueId - League standings`);
  console.log(`  GET  /api/stats          - Cache statistics`);
  console.log(`  GET  /health             - Health check`);
  console.log('');
});
