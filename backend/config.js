// ============================================================================
// BACKEND CONFIGURATION
// Centralized configuration constants for FPLanner backend service
// ============================================================================

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

export const SERVER = {
  PORT: process.env.PORT || 3001,
  HOST: '0.0.0.0',
  CACHE_BACKUP_PATH: path.join(__dirname, 'cache-backup.json'),
};

// ============================================================================
// AWS S3 CONFIGURATION
// ============================================================================

export const S3 = {
  ENABLED: process.env.AWS_S3_ENABLED === 'true',
  BUCKET: process.env.AWS_S3_BUCKET || 'fplanner-cache',
  REGION: process.env.AWS_REGION || 'us-east-1',
  ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  CACHE_KEY: 'cache-backup.json', // S3 object key for cache file
};

// ============================================================================
// MONGODB CONFIGURATION
// ============================================================================

export const MONGO = {
  ENABLED: process.env.MONGO_ENABLED === 'true',
  CONNECTION_STRING: process.env.MONGO_CONNECTION_STRING || '',
  DATABASE_NAME: process.env.MONGO_DATABASE_NAME || 'fplanner',
};

// ============================================================================
// API ENDPOINTS
// ============================================================================

// FPL Official API
export const FPL_BASE_URL = 'https://fantasy.premierleague.com/api';

// GitHub CSV Data (FPL-Elo-Insights)
export const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/olbauday/FPL-Elo-Insights/main/data/2025-2026';

// Gemini AI API
export const GEMINI = {
  API_KEY: process.env.GEMINI_API_KEY || '',
  API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent',
};

/**
 * Get GitHub CSV URLs for current gameweek context
 * @param {number} currentGW - Current gameweek number
 * @param {boolean} isFinished - Whether current GW is finished
 * @returns {Object} URLs for season stats, current GW, and next GW
 */
export function getGithubUrls(currentGW, isFinished) {
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

// ============================================================================
// CACHE TTL CONFIGURATION
// ============================================================================

export const TTL = {
  FIXTURES_LIVE: 2 * 60 * 1000,       // 2 minutes (during live GW - need frequent updates for match status)
  FIXTURES_FINISHED: 12 * 60 * 60 * 1000,  // 12 hours (when GW finished - rarely changes)
  GW_LIVE: 30 * 60 * 1000,            // 30 minutes (during live GW)
  GW_FINISHED: 12 * 60 * 60 * 1000,   // 12 hours (GW finished)
  GITHUB_CHECK_INTERVAL: 5 * 60 * 1000 // Check GitHub era every 5 min
};

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

export const ALLOWED_ORIGINS = [
  'http://localhost:5173',         // Vite dev server
  'http://localhost:3000',         // Alternative dev port
  'http://localhost:3001',         // Backend dev
  'https://fplanner.onrender.com', // Production domain (Render)
  'https://fplanner.vercel.app',   // Production domain (Vercel)
  'https://fplanner-git-*.vercel.app', // Preview deployments (wildcard handled in server)
  process.env.ALLOWED_ORIGIN,      // Custom domain from env var
].filter(Boolean);

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,         // Limit each IP to 100 requests per windowMs
  MESSAGE: 'Too many requests from this IP, please try again after 15 minutes'
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate FPL team ID
 * @param {string|number} teamId - Team ID to validate
 * @returns {boolean} True if valid
 */
export function isValidTeamId(teamId) {
  const id = parseInt(teamId);
  return !isNaN(id) && id > 0 && id < 10000000;
}

/**
 * Validate FPL league ID
 * @param {string|number} leagueId - League ID to validate
 * @returns {boolean} True if valid
 */
export function isValidLeagueId(leagueId) {
  const id = parseInt(leagueId);
  return !isNaN(id) && id > 0 && id < 100000000;
}

/**
 * Validate gameweek number
 * @param {string|number} gw - Gameweek number to validate
 * @returns {boolean} True if valid
 */
export function isValidGameweek(gw) {
  const gameweek = parseInt(gw);
  return !isNaN(gameweek) && gameweek >= 1 && gameweek <= 38;
}
