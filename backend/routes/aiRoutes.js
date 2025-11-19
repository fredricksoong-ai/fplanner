// ============================================================================
// AI ROUTES
// Handles AI insights endpoints using Gemini API
// ============================================================================

import express from 'express';
import { generateAIInsights } from '../services/aiService.js';
import { GEMINI } from '../config.js';
import logger from '../logger.js';

const router = express.Router();

// ============================================================================
// AI INSIGHTS ENDPOINT
// ============================================================================

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
router.post('/api/ai-insights', async (req, res) => {
  const { page, tab, position, gameweek, data } = req.body;

  logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.log(`📥 POST /api/ai-insights [${page}/${tab}/${position}]`);

  // Validate required fields
  if (!page || !tab || !gameweek || !data) {
    logger.warn('⚠️ Missing required fields');
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'page, tab, gameweek, and data are required'
    });
  }

  // Check if Gemini API key is configured
  if (!GEMINI.API_KEY) {
    logger.error('❌ Gemini API key not configured');
    return res.status(500).json({
      error: 'AI service not configured',
      message: 'Gemini API key is missing. Please configure GEMINI_API_KEY environment variable.'
    });
  }

  try {
    const insights = await generateAIInsights(page, tab, position, gameweek, data);

    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json(insights);

  } catch (error) {
    logger.error('❌ Error generating AI insights:', error.message);

    // Don't expose detailed error messages in production
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: 'Failed to generate insights',
      message: isProduction ? 'AI service temporarily unavailable' : error.message
    });
  }
});

export default router;
