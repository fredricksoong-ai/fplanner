// ============================================================================
// FPLANNER BACKEND SERVICE
// Smart caching for FPL API + GitHub CSV data
// ============================================================================

import express from 'express';
import axios from 'axios';
import Papa from 'papaparse';
import cors from 'cors';
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
const GITHUB_CSV_URL = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/2024-25/gws/merged_gw.csv';

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
 * Fetch GitHub CSV data
 */
async function fetchGithubCSV() {
  console.log('📡 Fetching GitHub CSV...');
  
  try {
    const response = await axios.get(GITHUB_CSV_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'FPLanner/1.0'
      }
    });
    
    console.log(`✅ GitHub CSV fetched (${Math.round(response.data.length / 1024)}KB)`);
    
    // Parse CSV
    const parsed = Papa.parse(response.data, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });
    
    if (parsed.errors.length > 0) {
      console.warn('⚠️ CSV parsing warnings:', parsed.errors.length);
    }
    
    console.log(`✅ Parsed ${parsed.data.length} player records`);
    
    cache.github.data = parsed.data;
    cache.github.timestamp = Date.now();
    cache.github.era = getCurrentEra();
    cache.stats.totalFetches++;
    
    return parsed.data;
  } catch (err) {
    console.error('❌ Failed to fetch GitHub CSV:', err.message);
    
    // Return cached data if available
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

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
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
    res.status(500).json({
      error: 'Failed to fetch FPL data',
      message: err.message
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
    res.status(500).json({
      error: 'Failed to fetch team data',
      message: err.message
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
        current_era: getCurrentEra()
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
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// SERVE FRONTEND IN PRODUCTION
// ============================================================================

// Serve static files from frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Handle client-side routing - send all non-API requests to index.html
app.get('*', (req, res) => {
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
