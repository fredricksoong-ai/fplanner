// ============================================================================
// FPLANNER BACKEND SERVICE
// Smart caching for FPL API + GitHub CSV data
// ============================================================================

// Load environment variables from .env file
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration
import { SERVER, ALLOWED_ORIGINS, RATE_LIMIT } from './config.js';

// Cache Manager
import {
  cache,
  loadCacheFromDisk,
  initializeCachePersistence
} from './services/cacheManager.js';
import { fetchBootstrap, fetchFixtures } from './services/fplService.js';
import { fetchGithubCSV } from './services/githubService.js';

// Route Modules
import fplRoutes from './routes/fplRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import leagueRoutes from './routes/leagueRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import plannerRoutes from './routes/plannerRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import { startCohortScheduler } from './services/cohortScheduler.js';

// Logger
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if origin matches any allowed pattern
    const isAllowed = ALLOWED_ORIGINS.some(allowedOrigin => {
      // Handle wildcard patterns (e.g., https://fplanner-git-*.vercel.app)
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return allowedOrigin === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`⚠️ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false
}));

// Rate limiting - Disabled for development
// const limiter = rateLimit({
//   windowMs: RATE_LIMIT.WINDOW_MS,
//   max: RATE_LIMIT.MAX_REQUESTS,
//   message: {
//     error: RATE_LIMIT.MESSAGE,
//     retryAfter: '15 minutes'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: (req, res) => {
//     logger.warn(`⚠️ Rate limit exceeded: ${req.ip}`);
//     res.status(429).json({
//       error: 'Too many requests',
//       message: RATE_LIMIT.MESSAGE
//     });
//   }
// });

// Apply rate limiting to all API routes (disabled)
// app.use('/api/', limiter);

// Request size limiting
app.use(express.json({ limit: '1mb' }));

// ============================================================================
// REQUEST LOGGING
// ============================================================================

app.use((req, res, next) => {
  // Skip logging for health checks to reduce noise
  if (req.path !== '/health') {
    logger.log(`${req.method} ${req.path} [${req.ip}]`);
  }
  next();
});

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

// FPL Routes (includes /health, /api/fpl-data, /api/stats)
app.use('/', fplRoutes);

// Team Routes (/api/team/:teamId)
app.use('/', teamRoutes);

// League Routes (/api/leagues/:leagueId)
app.use('/', leagueRoutes);

// AI Routes (/api/ai-insights)
app.use('/', aiRoutes);

// Planner Routes (/api/planner/*)
app.use('/', plannerRoutes);

// History Routes (/api/history/*)
app.use('/', historyRoutes);

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
// CACHE WARMUP
// ============================================================================

async function warmCachesOnStartup() {
  if (process.env.SKIP_CACHE_WARMUP === 'true') {
    logger.log('⏭️ Cache warmup skipped via SKIP_CACHE_WARMUP');
    return;
  }

  logger.log('🔥 Warming caches in background...');

  const tasks = [
    {
      name: 'bootstrap',
      shouldRun: () => !cache.bootstrap.data,
      action: () => fetchBootstrap()
    },
    {
      name: 'fixtures',
      shouldRun: () => !cache.fixtures.data,
      action: () => fetchFixtures()
    },
    {
      name: 'github',
      shouldRun: () => !cache.github.data,
      action: () => fetchGithubCSV()
    }
  ];

  for (const task of tasks) {
    if (!task.shouldRun()) {
      logger.log(`✅ ${task.name} cache already hydrated, skipping warmup fetch`);
      continue;
    }

    try {
      const start = Date.now();
      await task.action();
      logger.log(`🔥 ${task.name} cache warmed in ${Date.now() - start}ms`);
    } catch (err) {
      logger.warn(`⚠️ Failed to warm ${task.name} cache: ${err.message}`);
    }
  }

  logger.log('🔥 Cache warmup complete');
}

function enforceRenderPortBinding() {
  if (process.env.RENDER && !process.env.PORT) {
    logger.error('❌ Render environment detected but PORT is not set. The service must listen on $PORT.');
    process.exit(1);
  }
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

(async () => {
  // Load cache from S3/disk before starting server
  await loadCacheFromDisk();

  // Initialize cache persistence (auto-save and graceful shutdown)
  initializeCachePersistence();

  // Kick off cache warmup asynchronously
  warmCachesOnStartup()
    .catch(err => {
      logger.warn(`⚠️ Cache warmup encountered an error: ${err.message}`);
    })
    .finally(() => {
      startCohortScheduler();
    });

  // Ensure platform-provided port binding is respected (Render)
  enforceRenderPortBinding();

  app.listen(SERVER.PORT, SERVER.HOST, () => {
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.log('🚀 FPLanner Backend Server');
    logger.log(`📡 Listening on host ${SERVER.HOST} and port ${SERVER.PORT}`);
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.log('');
    logger.log('Available endpoints:');
    logger.log(`  GET  /api/fpl-data       - Combined FPL data`);
    logger.log(`  GET  /api/fpl-data?refresh=true - Force refresh`);
    logger.log(`  GET  /api/team/:teamId   - User team data`);
    logger.log(`  POST /api/ai-insights    - AI insights (Gemini)`);
    logger.log(`  GET  /api/leagues/:leagueId - League standings`);
    logger.log(`  GET  /api/stats          - Cache statistics`);
    logger.log(`  GET  /health             - Health check`);
    logger.log('');
  });
})();
