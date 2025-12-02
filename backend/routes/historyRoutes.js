// ============================================================================
// HISTORY ROUTES
// Provides access to historical player data (form, price, ownership, points)
// ============================================================================

import express from 'express';
import { isValidGameweek } from '../config.js';
import { fetchElementSummary } from '../services/fplService.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * GET /api/history/player/:playerId/ownership
 * Returns player history (points, form, price, ownership) across all gameweeks
 * Uses FPL API element-summary endpoint which provides all historical data
 */
router.get('/api/history/player/:playerId/ownership', async (req, res) => {
  const playerId = parseInt(req.params.playerId, 10);

  if (isNaN(playerId) || playerId < 1) {
    return res.status(400).json({
      error: 'Invalid player ID',
      message: 'Player ID must be a positive number'
    });
  }

  try {
    // Fetch player history from FPL API - has everything we need!
    const playerSummary = await fetchElementSummary(playerId);
    const playerHistory = playerSummary.history || [];

    if (playerHistory.length === 0) {
      return res.status(404).json({
        error: 'No data available',
        message: `No historical data found for player ${playerId}`
      });
    }

    // Sort by gameweek
    const sortedHistory = playerHistory
      .filter(h => h.round && h.round >= 1 && h.round <= 38)
      .sort((a, b) => a.round - b.round);

    // Calculate form (rolling average of last 3-5 gameweeks)
    const formMap = new Map();
    const cumulativePointsMap = new Map();
    
    let cumulativeTotal = 0;
    sortedHistory.forEach((entry, index) => {
      const points = entry.total_points || 0;
      
      // Calculate cumulative total points
      cumulativeTotal += points;
      cumulativePointsMap.set(entry.round, cumulativeTotal);

      // Calculate form as average of last 3-5 gameweeks (or available data)
      const lookback = Math.min(5, index + 1);
      const startIndex = Math.max(0, index - lookback + 1);
      const recentPoints = sortedHistory
        .slice(startIndex, index + 1)
        .map(e => e.total_points || 0);
      const avgPoints = recentPoints.reduce((sum, p) => sum + p, 0) / recentPoints.length;
      formMap.set(entry.round, parseFloat(avgPoints.toFixed(1)));
    });

    // Transform to chart format
    const gameweeks = sortedHistory.map(entry => ({
      gameweek: entry.round,
      ownership: parseFloat(entry.selected_by_percent || 0),
      price: entry.value || null, // Price in tenths
      gw_points: entry.total_points || 0,
      form: formMap.get(entry.round) || null,
      total_points: cumulativePointsMap.get(entry.round) || 0
    }));

    res.json({
      playerId,
      gameweeks,
      source: 'fpl_api'
    });
  } catch (err) {
    logger.error(`❌ Failed to load player ownership for ${playerId}:`, err.message);
    res.status(500).json({
      error: 'Failed to load ownership data',
      message: err.message
    });
  }
});

export default router;
