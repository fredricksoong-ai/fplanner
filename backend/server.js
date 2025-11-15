// ============================================================================
// FPLANNER BACKEND SERVICE
// Smart caching for FPL API + GitHub CSV data
// ============================================================================

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

// ============================================================================
// CACHE PERSISTENCE
// ============================================================================

/**
 * Validate cache structure to prevent corruption
 * @param {Object} cacheData - Cache object to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateCacheStructure(cacheData) {
  if (!cacheData || typeof cacheData !== 'object') {
    console.warn('⚠️ Cache validation failed: not an object');
    return false;
  }

  // Check required top-level properties
  const requiredProps = ['bootstrap', 'fixtures', 'github', 'stats'];
  for (const prop of requiredProps) {
    if (!(prop in cacheData)) {
      console.warn(`⚠️ Cache validation failed: missing '${prop}' property`);
      return false;
    }
  }

  // Validate bootstrap structure
  if (!cacheData.bootstrap || typeof cacheData.bootstrap !== 'object') {
    console.warn('⚠️ Cache validation failed: invalid bootstrap structure');
    return false;
  }

  // Validate fixtures structure
  if (!cacheData.fixtures || typeof cacheData.fixtures !== 'object') {
    console.warn('⚠️ Cache validation failed: invalid fixtures structure');
    return false;
  }

  // Validate github structure
  if (!cacheData.github || typeof cacheData.github !== 'object') {
    console.warn('⚠️ Cache validation failed: invalid github structure');
    return false;
  }

  // Validate stats structure
  if (!cacheData.stats || typeof cacheData.stats !== 'object') {
    console.warn('⚠️ Cache validation failed: invalid stats structure');
    return false;
  }

  // If bootstrap has data, validate it's an array or object
  if (cacheData.bootstrap.data) {
    if (typeof cacheData.bootstrap.data !== 'object') {
      console.warn('⚠️ Cache validation failed: invalid bootstrap data');
      return false;
    }
  }

  // If fixtures has data, validate it's an array
  if (cacheData.fixtures.data) {
    if (!Array.isArray(cacheData.fixtures.data)) {
      console.warn('⚠️ Cache validation failed: fixtures data must be array');
      return false;
    }
  }

  console.log('✅ Cache structure validation passed');
  return true;
}

/**
 * Load cache from disk on startup
 */
function loadCacheFromDisk() {
  if (fs.existsSync(CACHE_BACKUP_PATH)) {
    try {
      const fileContent = fs.readFileSync(CACHE_BACKUP_PATH, 'utf8');

      // Check if file is empty
      if (!fileContent || fileContent.trim().length === 0) {
        console.warn('⚠️ Cache backup file is empty, starting fresh');
        return;
      }

      const backup = JSON.parse(fileContent);

      // Validate cache structure
      if (!validateCacheStructure(backup)) {
        console.error('❌ Cache backup corrupted, starting fresh');
        // Rename corrupted file for debugging
        const corruptedPath = `${CACHE_BACKUP_PATH}.corrupted.${Date.now()}`;
        fs.renameSync(CACHE_BACKUP_PATH, corruptedPath);
        console.log(`   Corrupted cache moved to: ${corruptedPath}`);
        return;
      }

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

      // If JSON parse failed, rename the corrupted file
      if (err instanceof SyntaxError) {
        try {
          const corruptedPath = `${CACHE_BACKUP_PATH}.corrupted.${Date.now()}`;
          fs.renameSync(CACHE_BACKUP_PATH, corruptedPath);
          console.log(`   Corrupted cache moved to: ${corruptedPath}`);
        } catch (renameErr) {
          console.error('   Failed to move corrupted cache:', renameErr.message);
        }
      }
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
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Allow unsafe-inline only in development for Vite HMR
      scriptSrc: isDevelopment
        ? ["'self'", "'unsafe-inline'"]
        : ["'self'"],
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
    // Allow requests with no origin ONLY in development mode
    // In production, require a valid origin for security
    if (!origin) {
      const isDevelopment = process.env.NODE_ENV !== 'production';
      if (isDevelopment) {
        return callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked: no origin header (production mode)`);
        return callback(new Error('Not allowed by CORS'));
      }
    }

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
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`⚠️ API rate limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait 15 minutes before trying again'
    });
  }
});

// Health check rate limiter (lighter than API limiter)
const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1 per second)
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Health check rate limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Too many health check requests',
      message: 'Please reduce health check frequency'
    });
  }
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

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
 * Health check endpoint (rate limited to prevent abuse)
 */
app.get('/health', healthLimiter, (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
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
  console.log(`  GET  /api/stats          - Cache statistics`);
  console.log(`  GET  /health             - Health check`);
  console.log('');
});
